import { Goal, RunnerProfile, TrainingPlan, WorkoutSession, WorkoutStep } from "./types";
import { FeedbackSignal } from "./adaptation";
import { normalizeStepDuration } from "./duration";

export interface FeasibilityResult {
  feasible: boolean;
  warnings: string[];
  minWeeksRequired: number;
}

export interface SafetyAdjustment {
  type: string;
  detail: string;
}

const MIN_WEEKS: Record<Goal["distance"], { beginner: number; experienced: number }> = {
  "5K": { beginner: 8, experienced: 4 },
  "10K": { beginner: 10, experienced: 6 },
  Halvmaraton: { beginner: 12, experienced: 8 },
  Marathon: { beginner: 16, experienced: 12 },
};

const MIN_RUNS_PER_WEEK: Record<Goal["distance"], number> = {
  "5K": 2,
  "10K": 3,
  Halvmaraton: 3,
  Marathon: 3,
};

const TARGET_TIME_FLOOR_SEC: Record<Goal["distance"], { beginner: number; experienced: number }> = {
  "5K": { beginner: 22 * 60, experienced: 17 * 60 },
  "10K": { beginner: 48 * 60, experienced: 40 * 60 },
  Halvmaraton: { beginner: 105 * 60, experienced: 90 * 60 },
  Marathon: { beginner: 240 * 60, experienced: 200 * 60 },
};

function isBeginner(experience: RunnerProfile["runningExperience"]): boolean {
  return experience === "nybegynder";
}

function parseTargetTimeToSec(value?: string): number | null {
  if (!value) return null;
  const parts = value.split(":").map((part) => Number(part));
  if (parts.some((part) => !Number.isFinite(part) || part < 0)) return null;

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return null;
}

function sessionRunSec(session: WorkoutSession): number {
  return session.steps.filter((step) => step.type === "run").reduce((sum, step) => sum + step.durationSec, 0);
}

function scaleSessionRunSteps(session: WorkoutSession, factor: number): WorkoutSession {
  const nextSteps: WorkoutStep[] = session.steps.map((step) => {
    if (step.type !== "run") return step;
    return {
        ...step,
        durationSec: normalizeStepDuration(step.durationSec * factor),
      };
  });

  return {
    ...session,
    steps: nextSteps,
    loadScore: Math.max(1, Math.min(10, Math.round(session.loadScore * factor))),
  };
}

export function validatePlanFeasibility(params: {
  goal: Goal;
  runnerProfile: RunnerProfile;
  runsPerWeek: number;
}): FeasibilityResult {
  const { goal, runnerProfile, runsPerWeek } = params;
  const minWeeksRequired = isBeginner(runnerProfile.runningExperience)
    ? MIN_WEEKS[goal.distance].beginner
    : MIN_WEEKS[goal.distance].experienced;

  const warnings: string[] = [];
  const minRuns = MIN_RUNS_PER_WEEK[goal.distance];
  if (runsPerWeek < minRuns) {
    warnings.push(`Minimum for ${goal.distance} er ${minRuns} pas om ugen.`);
  }

  const selectedDays = goal.availableTrainingDays?.length ?? 0;
  if (selectedDays > 0 && selectedDays < minRuns) {
    warnings.push(
      "Du har valgt færre træningsdage end programmet normalt kræver. Programmet kan blive mindre effektivt eller kræve en længere tidshorisont.",
    );
  }

  if (goal.weeks < minWeeksRequired) {
    return {
      feasible: false,
      warnings,
      minWeeksRequired,
    };
  }

  const targetTimeSec = parseTargetTimeToSec(goal.targetTime);
  if (targetTimeSec !== null) {
    const floor = isBeginner(runnerProfile.runningExperience)
      ? TARGET_TIME_FLOOR_SEC[goal.distance].beginner
      : TARGET_TIME_FLOOR_SEC[goal.distance].experienced;
    const pressureModifier = runsPerWeek < minRuns || goal.weeks <= minWeeksRequired + 1 ? 1.08 : 1;
    if (targetTimeSec < floor / pressureModifier) {
      return {
        feasible: false,
        warnings,
        minWeeksRequired,
      };
    }
  }

  return {
    feasible: true,
    warnings,
    minWeeksRequired,
  };
}

function applyWeeklyProgressionCap(plan: TrainingPlan, adjustments: SafetyAdjustment[]): TrainingPlan {
  const byWeek = new Map<number, WorkoutSession[]>();
  for (const session of plan.sessions) {
    const bucket = byWeek.get(session.week) ?? [];
    bucket.push(session);
    byWeek.set(session.week, bucket);
  }

  const weeks = [...byWeek.keys()].sort((a, b) => a - b);
  let sessions = [...plan.sessions];

  for (let i = 1; i < weeks.length; i += 1) {
    const prevWeek = weeks[i - 1];
    const currWeek = weeks[i];
    const prevSessions = sessions.filter((s) => s.week === prevWeek);
    const currSessions = sessions.filter((s) => s.week === currWeek);
    const prevLoad = prevSessions.reduce((sum, s) => sum + sessionRunSec(s), 0);
    const currLoad = currSessions.reduce((sum, s) => sum + sessionRunSec(s), 0);

    const maxAllowed = Math.round(prevLoad * 1.05);
    if (prevLoad > 0 && currLoad > maxAllowed) {
      const factor = maxAllowed / currLoad;
      sessions = sessions.map((session) => (session.week === currWeek ? scaleSessionRunSteps(session, factor) : session));
      adjustments.push({
        type: "progression_cap",
        detail: `Uge ${currWeek} blev justeret for at holde stigning inden for 5%.`,
      });
    }
  }

  return { ...plan, sessions };
}

function applySessionSpikeProtection(plan: TrainingPlan, adjustments: SafetyAdjustment[]): TrainingPlan {
  const ordered = [...plan.sessions].sort((a, b) => (a.week === b.week ? a.id.localeCompare(b.id) : a.week - b.week));
  const out: WorkoutSession[] = [];
  let prevLongest = 0;

  for (const session of ordered) {
    const runSec = sessionRunSec(session);
    const maxAllowed = prevLongest > 0 ? Math.round(prevLongest * 1.3) : runSec;
    if (prevLongest > 0 && runSec > maxAllowed) {
      const factor = maxAllowed / runSec;
      out.push(scaleSessionRunSteps(session, factor));
      adjustments.push({
        type: "session_spike_protection",
        detail: `Session i uge ${session.week} blev dæmpet for at undgå stort spring.`,
      });
    } else {
      out.push(session);
    }
    prevLongest = Math.max(prevLongest, sessionRunSec(out[out.length - 1]));
  }

  return { ...plan, sessions: out };
}

function applyRecoveryWeek(plan: TrainingPlan, adjustments: SafetyAdjustment[]): TrainingPlan {
  const weeks = [...new Set(plan.sessions.map((s) => s.week))].sort((a, b) => a - b);
  let sessions = [...plan.sessions];

  for (const week of weeks) {
    if (week % 4 !== 0) continue;
    sessions = sessions.map((session) => (session.week === week ? scaleSessionRunSteps(session, 0.8) : session));
    adjustments.push({
      type: "recovery_week",
      detail: `Uge ${week} blev sat til restitution (ca. 80% load).`,
    });
  }

  return { ...plan, sessions };
}

function applyFeedbackSafety(plan: TrainingPlan, recentFeedback: FeedbackSignal[], adjustments: SafetyAdjustment[]): TrainingPlan {
  const latest = recentFeedback[0];
  if (!latest || plan.sessions.length === 0) return plan;

  const sessions = [...plan.sessions];
  const first = sessions[0];

  if (latest.painLevel >= 6) {
    sessions[0] = scaleSessionRunSteps(first, 0.85);
    adjustments.push({ type: "pain_guardrail", detail: "Næste pas blev skaleret ned pga. smerte >= 6." });
  }

  if (latest.effort >= 9) {
    sessions[0] = scaleSessionRunSteps(sessions[0], 0.9);
    adjustments.push({ type: "rpe_guardrail", detail: "Næste pas blev dæmpet pga. RPE >= 9." });
  }

  if (latest.completionPct < 70 && sessions[1]) {
    sessions[1] = {
      ...sessions[1],
      steps: sessions[0].steps.map((step) => ({ ...step })),
      loadScore: sessions[0].loadScore,
      notes: "Gentagelsespas efter lav gennemførelse.",
    };
    adjustments.push({ type: "completion_repeat", detail: "Næste pas gentages pga. gennemførelse under 70%." });
  }

  if (latest.energy <= 2) {
    sessions[0] = scaleSessionRunSteps(sessions[0], 0.9);
    adjustments.push({ type: "energy_guardrail", detail: "Næste pas blev justeret ned pga. lav energi." });
  }

  return { ...plan, sessions };
}

function goalSpecificFinalSession(plan: TrainingPlan, goal: Goal, adjustments: SafetyAdjustment[]): TrainingPlan {
  if (plan.sessions.length === 0) return plan;
  const sessions = [...plan.sessions];
  const idx = sessions.length - 1;
  const last = sessions[idx];

  const simulationTitle =
    goal.distance === "5K"
      ? "Måldag — 5 km"
      : goal.distance === "10K"
        ? "Måldag — 10 km"
        : goal.distance === "Halvmaraton"
          ? "Måldag — Halvmaraton"
          : "Måldag — Maraton";

  sessions[idx] = {
    ...last,
    title: simulationTitle,
    notes: `${simulationTitle} som afslutning på forløbet.`,
  };

  adjustments.push({
    type: "goal_specific_final_phase",
    detail: "Afsluttende pas blev gjort målspecifikt.",
  });

  return { ...plan, sessions };
}

export function applyPlanSafety(params: {
  plan: TrainingPlan;
  goal: Goal;
  recentFeedback: FeedbackSignal[];
}): { plan: TrainingPlan; adjustments: SafetyAdjustment[] } {
  const { goal, recentFeedback } = params;
  const adjustments: SafetyAdjustment[] = [];

  let plan = params.plan;
  plan = applyWeeklyProgressionCap(plan, adjustments);
  plan = applySessionSpikeProtection(plan, adjustments);
  plan = applyRecoveryWeek(plan, adjustments);
  plan = applyFeedbackSafety(plan, recentFeedback, adjustments);
  plan = goalSpecificFinalSession(plan, goal, adjustments);

  return { plan, adjustments };
}
