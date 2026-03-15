import { Goal, RunnerProfile, TrainingPlan, WorkoutSession, WorkoutStep } from "./types";
import { normalizeStepDuration } from "./duration";

export const DAYS: WorkoutSession["dayOfWeek"][] = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lordag", "Sondag"];

export interface WeeklyLoadPoint {
  week: number;
  load: number;
  longestContinuousRunSec: number;
  totalRunSec: number;
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

function distanceFactor(distance: Goal["distance"]): number {
  if (distance === "Marathon") return 1.7;
  if (distance === "Halvmaraton") return 1.4;
  if (distance === "10K") return 1.2;
  return 1;
}

function runningAbilityFactor(ability: RunnerProfile["currentRunningAbility"]): number {
  if (ability === "helt_ny") return 0.6;
  if (ability === "fem_min") return 0.75;
  if (ability === "ti_femten_min") return 0.88;
  if (ability === "tyve_tredive_min") return 1;
  return 1.1;
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

function deriveLoadScore(steps: WorkoutStep[], week: number): number {
  const raw = sessionTrainingLoad({ steps }) / 4.5 + week / 10;
  return clampLoad(raw);
}

function parseTargetTimeSec(targetTime?: string): number | null {
  if (!targetTime) return null;
  const parts = targetTime.split(":").map((part) => Number(part));
  if (parts.some((part) => !Number.isFinite(part) || part < 0)) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

function defaultGoalTimeSec(distance: Goal["distance"]): number {
  if (distance === "5K") return 30 * 60;
  if (distance === "10K") return 60 * 60;
  if (distance === "Halvmaraton") return 1 * 3600 + 55 * 60;
  return 4 * 3600;
}

function resolveTrainingDays(goal: Goal, sessionsPerWeek: number): WorkoutSession["dayOfWeek"][] {
  const preferred = goal.availableTrainingDays?.length ? DAYS.filter((day) => goal.availableTrainingDays?.includes(day)) : [];
  const source = preferred.length > 0 ? preferred : DAYS;
  return Array.from({ length: sessionsPerWeek }).map((_, index) => source[index % source.length]);
}

function buildIntervalSession(params: {
  week: number;
  dayIndex: number;
  weeks: number;
  goal: Goal;
  recoveryWeek: boolean;
}): WorkoutSession {
  const { week, dayIndex, weeks, goal, recoveryWeek } = params;
  const factor = distanceFactor(goal.distance);
  const progression = week / weeks;
  const repeatsBase = 3 + Math.floor(progression * 4);
  const repeats = recoveryWeek ? Math.max(3, repeatsBase - 1) : repeatsBase;
  const runSecBase = normalizeStepDuration((60 + progression * 120) * factor);
  const walkSec = normalizeStepDuration(Math.max(30, 120 - progression * 60));
  const runSec = recoveryWeek ? normalizeStepDuration(runSecBase * 0.9) : runSecBase;

  const steps: WorkoutStep[] = [{ type: "warmup", label: "Rask gang", durationSec: 5 * 60, cue: "Varm op i roligt tempo." }];
  for (let i = 0; i < repeats; i += 1) {
    steps.push({
      type: "run",
      label: `Løb ${i + 1}`,
      durationSec: runSec,
      cue: progression > 0.7 ? "Løb tæt på målfart i kontrolleret tempo." : "Løb i kontrolleret tempo.",
    });
    if (i < repeats - 1 || progression < 0.85) {
      steps.push({ type: "walk", label: `Gang ${i + 1}`, durationSec: walkSec, cue: "Sænk tempoet og find rolig vejrtrækning." });
    }
  }
  steps.push({ type: "cooldown", label: "Nedkøling", durationSec: 5 * 60, cue: "Afslut med let gang." });

  return {
    id: `w${week}-d${dayIndex + 1}`,
    title: `Uge ${week} - Intervalpas ${dayIndex + 1}`,
    week,
    dayOfWeek: "Tirsdag",
    notes: recoveryWeek ? "Restitutionsuge: hold fokus på teknik og rolig belastning." : undefined,
    loadScore: deriveLoadScore(steps, week),
    steps,
  };
}

function buildSteadySession(params: { week: number; dayIndex: number; weeks: number; goal: Goal; recoveryWeek: boolean }): WorkoutSession {
  const { week, dayIndex, weeks, goal, recoveryWeek } = params;
  const factor = distanceFactor(goal.distance);
  const progression = week / weeks;
  const steadyRun = normalizeStepDuration((10 * 60 + progression * 12 * 60) * factor);
  const runSec = recoveryWeek ? normalizeStepDuration(steadyRun * 0.8) : steadyRun;

  const steps: WorkoutStep[] = [
    { type: "warmup", label: "Rask gang", durationSec: 5 * 60, cue: "Varm op i roligt tempo." },
    { type: "run", label: "Roligt kontinuerligt løb", durationSec: runSec, cue: "Hold jævnt tempo, hvor du stadig kan føre en samtale." },
    { type: "cooldown", label: "Nedkøling", durationSec: 5 * 60, cue: "Lad pulsen falde gradvist." },
  ];

  return {
    id: `w${week}-d${dayIndex + 1}`,
    title: `Uge ${week} - Roligt pas ${dayIndex + 1}`,
    week,
    dayOfWeek: "Torsdag",
    notes: recoveryWeek ? "Kortere roligt pas pga. restitutionsuge." : undefined,
    loadScore: deriveLoadScore(steps, week),
    steps,
  };
}

function buildLongOrGoalSession(params: {
  week: number;
  dayIndex: number;
  weeks: number;
  goal: Goal;
  recoveryWeek: boolean;
}): WorkoutSession {
  const { week, dayIndex, weeks, goal, recoveryWeek } = params;
  const progression = week / weeks;
  const isFinalWeek = week === weeks;
  const baseGoalSec = parseTargetTimeSec(goal.targetTime) ?? defaultGoalTimeSec(goal.distance);

  if (isFinalWeek) {
    const finalRunSec = normalizeStepDuration(baseGoalSec);
    const title = goal.distance === "5K" ? "Måldag — 5 km" : goal.distance === "10K" ? "Måldag — 10 km" : goal.distance === "Halvmaraton" ? "Måldag — Halvmaraton" : "Måldag — Maraton";
    const steps: WorkoutStep[] = [
      { type: "warmup", label: "Opvarmning", durationSec: 8 * 60, cue: "Varm op roligt og kontrolleret." },
      { type: "run", label: title, durationSec: finalRunSec, cue: "Løb efter planlagt disponering og hold stabil rytme." },
      { type: "cooldown", label: "Nedkøling", durationSec: 6 * 60, cue: "Afslut roligt." },
    ];
    return {
      id: `w${week}-d${dayIndex + 1}`,
      title,
      week,
      dayOfWeek: "Lordag",
      notes: "Finale: mål-specifikt pas.",
      loadScore: deriveLoadScore(steps, week),
      steps,
    };
  }

  const longRunSecBase = normalizeStepDuration((20 * 60 + progression * 22 * 60) * distanceFactor(goal.distance));
  const longRunSec = recoveryWeek ? normalizeStepDuration(longRunSecBase * 0.8) : longRunSecBase;
  const steps: WorkoutStep[] = [
    { type: "warmup", label: "Rask gang", durationSec: 5 * 60, cue: "Varm op i roligt tempo." },
    { type: "run", label: "Udholdenhedsløb", durationSec: longRunSec, cue: "Hold roligt, stabilt tempo." },
    { type: "cooldown", label: "Nedkøling", durationSec: 5 * 60, cue: "Afslut med let gang." },
  ];

  return {
    id: `w${week}-d${dayIndex + 1}`,
    title: `Uge ${week} - Udholdenhedspas ${dayIndex + 1}`,
    week,
    dayOfWeek: "Lordag",
    notes: recoveryWeek ? "Kortere udholdenhedspas pga. restitutionsuge." : undefined,
    loadScore: deriveLoadScore(steps, week),
    steps,
  };
}

function buildSession(params: { week: number; dayIndex: number; weeks: number; goal: Goal; sessionsPerWeek: number }): WorkoutSession {
  const { week, dayIndex, weeks, goal, sessionsPerWeek } = params;
  const recoveryWeek = week % 4 === 0 && week !== weeks;
  const isLastSessionOfWeek = dayIndex === sessionsPerWeek - 1;

  if (isLastSessionOfWeek) {
    return buildLongOrGoalSession({ week, dayIndex, weeks, goal, recoveryWeek });
  }
  if (dayIndex === 0) {
    return buildIntervalSession({ week, dayIndex, weeks, goal, recoveryWeek });
  }
  return buildSteadySession({ week, dayIndex, weeks, goal, recoveryWeek });
}

export function generateFallbackPlan(profile: RunnerProfile, goal: Goal): TrainingPlan {
  const weeks = clampWeeks(goal.weeks);
  const abilityFactor = runningAbilityFactor(profile.currentRunningAbility);
  const suggestedSessionsPerWeek =
    profile.currentRunningAbility === "helt_ny"
      ? 2
      : profile.activityLevel === "meget_lav"
      ? 2
      : profile.activityLevel === "lav"
        ? 3
        : profile.activityLevel === "moderat"
      ? 3
      : profile.activityLevel === "høj"
        ? 4
        : 5;
  const sessionsPerWeek = goal.availableTrainingDays?.length
    ? Math.max(1, Math.min(suggestedSessionsPerWeek, goal.availableTrainingDays.length))
    : suggestedSessionsPerWeek;
  const sessions: WorkoutSession[] = [];
  const trainingDays = resolveTrainingDays(goal, sessionsPerWeek);

  for (let week = 1; week <= weeks; week += 1) {
    for (let dayIndex = 0; dayIndex < sessionsPerWeek; dayIndex += 1) {
      const session = buildSession({ week, dayIndex, weeks, goal, sessionsPerWeek });
      session.dayOfWeek = trainingDays[dayIndex];
      const adjustedSteps = session.steps.map((step, index) => {
          if (step.type !== "run") return step;
          const isGoalDay = week === weeks && dayIndex === sessionsPerWeek - 1;
          if (isGoalDay) return step;
          const scaledDuration = index === 1 ? step.durationSec * abilityFactor : step.durationSec * abilityFactor;
          return {
            ...step,
            durationSec: normalizeStepDuration(scaledDuration),
          };
        });
      sessions.push({
        ...session,
        steps: adjustedSteps,
        loadScore: deriveLoadScore(adjustedSteps, week),
      });
    }
  }

  return {
    summary: `Komplet baseline-program til ${goal.distance} over ${weeks} uger med tydelig progression, restitutionsuger og måldag.`,
    weeks,
    sessionsPerWeek,
    sessions,
  };
}

export function buildWeeklyLoad(plan: TrainingPlan): WeeklyLoadPoint[] {
  const weeks = Array.from({ length: plan.weeks }, (_, index) => index + 1);

  return weeks.map((week) => {
    const sessions = plan.sessions.filter((session) => session.week === week);
    const totalRunSec = sessions.reduce(
      (sum, session) => sum + session.steps.filter((step) => step.type === "run").reduce((stepSum, step) => stepSum + step.durationSec, 0),
      0,
    );
    const longestContinuousRunSec = sessions.reduce((longest, session) => Math.max(longest, sessionContinuousRunSec(session)), 0);
    const load = roundLoad(sessions.reduce((sum, session) => sum + sessionTrainingLoad(session), 0));

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
            loadScore: clampLoad(Number(s.loadScore ?? deriveLoadScore(steps, Number(s.week ?? 1)))),
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
