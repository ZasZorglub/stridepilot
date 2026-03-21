import { normalizeStepDuration } from "./duration";
import { Goal, RunnerProfile, RunnerProfileInsights, TrainingPlan, WorkoutSession, WorkoutStep } from "./types";
import { buildGoalPlan, GoalConfig as CoachGoalConfig, GoalIntent as CoachGoalIntent, interpretRunnerProfile as interpretCoachRunnerProfile, mapCoachPlanToAppPlan } from "./coach";
import { calendarWeekIndexFromDate, sessionDateFromCalendarWeek, visiblePlanSessions } from "./calendar-week";

export const DAYS: WorkoutSession["dayOfWeek"][] = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lordag", "Sondag"];

function mapPreferredDays(days?: Goal["availableTrainingDays"]): CoachGoalConfig["preferredTrainingDays"] {
  if (!days || days.length === 0) return undefined;
  return days.map((day) => {
    if (day === "Mandag") return "monday";
    if (day === "Tirsdag") return "tuesday";
    if (day === "Onsdag") return "wednesday";
    if (day === "Torsdag") return "thursday";
    if (day === "Fredag") return "friday";
    if (day === "Lordag") return "saturday";
    return "sunday";
  });
}

export interface WeeklyLoadPoint {
  week: number;
  load: number;
  longestContinuousRunSec: number;
  totalRunSec: number;
}

interface PlanGenerationSignals {
  profileInsights?: RunnerProfileInsights | null;
}

function clampWeeks(weeks: number): number {
  return Math.min(52, Math.max(12, Number.isFinite(weeks) ? Math.round(weeks) : 12));
}

function clampLoad(value: number): number {
  return Math.max(1, Math.min(10, Math.round(value)));
}

function roundLoad(value: number): number {
  return Math.round(value * 10) / 10;
}

function goalIntent(goal: Goal): CoachGoalIntent {
  if (goal.goalType === "target_time") return "target_time";
  if (goal.goalType === "pr") return "improve";
  if (goal.goalType === "run_without_walking") return "finish_comfortably";
  return "finish";
}

function toCoachGoalConfig(goal: Goal, profile: RunnerProfile): CoachGoalConfig {
  const requestedRuns = goal.availableTrainingDays?.length || profile.realisticTrainingDaysPerWeek || profile.currentRunsPerWeek || 3;

  return {
    goalDistance: goal.distance,
    goalIntent: goalIntent(goal),
    targetDate: goal.endDate ?? goal.startDate,
    trainingDaysPerWeek: Math.max(2, Math.min(4, requestedRuns)) as 2 | 3 | 4,
    startDate: goal.startDate,
    targetTime: goal.targetTime,
    preferredTrainingDays: mapPreferredDays(goal.availableTrainingDays),
  };
}

export function sessionContinuousRunSec(session: Pick<WorkoutSession, "steps">): number {
  let current = 0;
  let longest = 0;

  for (const step of session.steps) {
    if (step.type === "run") {
      current += step.durationSec;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }

  return longest;
}

export function sessionTrainingLoad(session: Pick<WorkoutSession, "steps">): number {
  const runSec = session.steps.filter((s) => s.type === "run").reduce((sum, step) => sum + step.durationSec, 0);
  const walkSec = session.steps.filter((s) => s.type === "walk").reduce((sum, step) => sum + step.durationSec, 0);
  const warmCoolSec = session.steps.filter((s) => s.type === "warmup" || s.type === "cooldown").reduce((sum, step) => sum + step.durationSec, 0);
  const continuousRunSec = sessionContinuousRunSec(session);
  const intervalCount = session.steps.filter((s) => s.type === "run").length;
  const intensityMultiplier = intervalCount >= 4 ? 1.18 : continuousRunSec >= 20 * 60 ? 1.08 : 1;
  const structureBonus = intervalCount >= 4 ? intervalCount * 0.18 : 0;

  const rawLoad = (runSec / 60) * intensityMultiplier + walkSec / 180 + warmCoolSec / 240 + structureBonus;
  return roundLoad(rawLoad);
}

export function generateFallbackPlan(profile: RunnerProfile, goal: Goal, _signals?: PlanGenerationSignals): TrainingPlan {
  void _signals;
  const coachProfile = interpretCoachRunnerProfile({
    onboardingText: profile.userTrainingContext,
    injuryHistory: profile.injuryHistory,
    weakPoints: profile.weakPoints,
    otherTraining: profile.otherTraining,
    currentAbility: profile.currentRunningAbility,
    goalDistance: goal.distance,
    goalTime: goal.targetTime,
    goalType: goal.goalType,
    activityLevel: profile.activityLevel,
    currentRunsPerWeek: profile.currentRunsPerWeek,
    currentWeeklyVolumeKm: profile.currentWeeklyVolumeKm,
    longestRunMinutes: profile.longestCurrentRunMin,
    realisticTrainingDaysPerWeek: profile.realisticTrainingDaysPerWeek,
    typicalWorkoutMinutes: profile.typicalWorkoutMinutes,
    preferredGuidance: profile.preferredGuidance,
  });

  const coachPlan = buildGoalPlan(coachProfile, toCoachGoalConfig({ ...goal, weeks: clampWeeks(goal.weeks) }, profile));
  return mapCoachPlanToAppPlan(coachPlan, coachPlan.goal);
}

export function buildWeeklyLoad(plan: TrainingPlan, startDateIso?: string): WeeklyLoadPoint[] {
  const weeks = Array.from({ length: plan.weeks }, (_, index) => index + 1);
  const sessions = visiblePlanSessions(plan, startDateIso);

  return weeks.map((week) => {
    const weekSessions = sessions.filter((session) => {
      if (!startDateIso) return session.week === week;
      return calendarWeekIndexFromDate(startDateIso, sessionDateFromCalendarWeek(startDateIso, session)) === week;
    });
    const totalRunSec = weekSessions.reduce(
      (sum, session) => sum + session.steps.filter((step) => step.type === "run").reduce((stepSum, step) => stepSum + step.durationSec, 0),
      0,
    );
    const longestContinuousRunSec = weekSessions.reduce((longest, session) => Math.max(longest, sessionContinuousRunSec(session)), 0);
    const load = roundLoad(weekSessions.reduce((sum, session) => sum + sessionTrainingLoad(session), 0));

    return {
      week,
      load,
      longestContinuousRunSec,
      totalRunSec,
    };
  });
}

export function enforceAvailableTrainingDays(
  plan: TrainingPlan,
  preferredDays?: WorkoutSession["dayOfWeek"][],
): { plan: TrainingPlan; warnings: string[] } {
  if (!preferredDays || preferredDays.length === 0) {
    return { plan, warnings: [] };
  }

  const normalizedPreferred = DAYS.filter((day) => preferredDays.includes(day));
  if (normalizedPreferred.length === 0) {
    return { plan, warnings: [] };
  }

  const sessionsByWeek = new Map<number, TrainingPlan["sessions"]>();
  for (const session of plan.sessions) {
    const bucket = sessionsByWeek.get(session.week) ?? [];
    bucket.push(session);
    sessionsByWeek.set(session.week, bucket);
  }

  let trimmedSessions = false;
  const alignedSessions: TrainingPlan["sessions"] = [];

  for (const [week, weekSessions] of [...sessionsByWeek.entries()].sort((a, b) => a[0] - b[0])) {
    const limitedSessions = weekSessions.slice(0, normalizedPreferred.length);
    if (weekSessions.length > normalizedPreferred.length) {
      trimmedSessions = true;
    }

    limitedSessions.forEach((session, index) => {
      alignedSessions.push({
        ...session,
        week,
        dayOfWeek: normalizedPreferred[index],
      });
    });
  }

  const warnings = trimmedSessions
    ? [
        "Planen er tilpasset dine valgte træningsdage. For at holde dig på disse dage er nogle uger gjort mere kompakte, og et længere forløb eller flere træningsdage kan give en stærkere progression.",
      ]
    : [];

  return {
    plan: {
      ...plan,
      sessionsPerWeek: Math.min(plan.sessionsPerWeek, normalizedPreferred.length),
      sessions: alignedSessions,
    },
    warnings,
  };
}

export function normalizeTrainingPlan(raw: unknown, fallbackProfile: RunnerProfile, fallbackGoal: Goal): TrainingPlan {
  const fallback = generateFallbackPlan(fallbackProfile, fallbackGoal);

  if (!raw || typeof raw !== "object") {
    return fallback;
  }

  const parsed = raw as Partial<TrainingPlan>;
  const sessions = Array.isArray(parsed.sessions)
    ? parsed.sessions
        .map((session, idx) => {
          if (!session || typeof session !== "object") return null;
          const s = session as Partial<WorkoutSession>;
          const rawSteps = Array.isArray(s.steps) ? s.steps : [];
          const steps = rawSteps
            .map((step) => {
              if (!step || typeof step !== "object") return null;
              const st = step as Partial<WorkoutStep>;
              const durationSec = Number(st.durationSec);
              if (!Number.isFinite(durationSec) || durationSec <= 0) return null;
              return {
                type: st.type ?? "walk",
                label: st.label ?? "Interval",
                durationSec: normalizeStepDuration(Math.round(durationSec)),
                cue: st.cue ?? "Hold et komfortabelt tempo.",
              } as WorkoutStep;
            })
            .filter(Boolean) as WorkoutStep[];

          if (steps.length === 0) return null;

          return {
            id: s.id ?? `session-${idx + 1}`,
            title: s.title ?? `Traeningspas ${idx + 1}`,
            week: Number.isFinite(Number(s.week)) ? Math.max(1, Math.round(Number(s.week))) : 1,
            dayOfWeek: (s.dayOfWeek as WorkoutSession["dayOfWeek"]) ?? "Tirsdag",
            notes: s.notes,
            loadScore: clampLoad(Number(s.loadScore ?? 5)),
            steps,
          };
        })
        .filter(Boolean) as WorkoutSession[]
    : [];

  if (sessions.length === 0) {
    return fallback;
  }

  return {
    summary: parsed.summary ?? fallback.summary,
    weeks: clampWeeks(Number(parsed.weeks ?? fallback.weeks)),
    sessionsPerWeek: Math.min(5, Math.max(2, Number(parsed.sessionsPerWeek ?? fallback.sessionsPerWeek))),
    sessions,
  };
}
