import { TrainingPlan } from "@/lib/types";
import { normalizeStepDuration } from "@/lib/duration";
import { CapabilityState } from "./capability";

function clonePlan(plan: TrainingPlan): TrainingPlan {
  return {
    ...plan,
    sessions: plan.sessions.map((session) => ({
      ...session,
      steps: session.steps.map((step) => ({ ...step })),
    })),
  };
}

function isQualitySession(session: TrainingPlan["sessions"][number]): boolean {
  return /interval|tempo|benchmark|test|måldag/i.test(session.title) || session.loadScore >= 7;
}

function isEasySession(session: TrainingPlan["sessions"][number]): boolean {
  return /roligt|easy|recovery/i.test(session.title) || session.loadScore <= 5;
}

function isLongSession(session: TrainingPlan["sessions"][number]): boolean {
  return /udholdenhed|langt|long/i.test(session.title);
}

function sumRunMinutes(session: TrainingPlan["sessions"][number]): number {
  return session.steps.filter((step) => step.type === "run").reduce((sum, step) => sum + step.durationSec / 60, 0);
}

function setPrimaryRunDuration(session: TrainingPlan["sessions"][number], deltaMinutes: number): TrainingPlan["sessions"][number] {
  const next = {
    ...session,
    steps: session.steps.map((step) => ({ ...step })),
  };
  const runSteps = next.steps.filter((step) => step.type === "run");
  const targetStep = runSteps[runSteps.length - 1];

  if (!targetStep) return next;

  targetStep.durationSec = normalizeStepDuration(Math.max(5 * 60, targetStep.durationSec + deltaMinutes * 60));
  return {
    ...next,
    loadScore: Math.max(1, Math.min(10, Math.round(next.loadScore + deltaMinutes / 4))),
  };
}

function convertQualityToEasy(session: TrainingPlan["sessions"][number]): TrainingPlan["sessions"][number] {
  return {
    ...session,
    title: `Uge ${session.week} - Roligt pas`,
    notes: "Tilpasset til roligere belastning efter den seneste feedback.",
    loadScore: Math.min(session.loadScore, 4),
    steps: session.steps.map((step) => {
      if (step.type !== "run") return step;
      return {
        ...step,
        label: "Roligt løb",
        durationSec: normalizeStepDuration(step.durationSec * 0.82),
        cue: "Hold et roligt og stabilt tempo hele vejen.",
      };
    }),
  };
}

export function adaptUpcomingSessions(plan: TrainingPlan, capability: CapabilityState): TrainingPlan {
  const nextPlan = clonePlan(plan);

  if (capability.fatigueIndex >= 0.7 || capability.recoveryNeeded) {
    const qualityIndex = nextPlan.sessions.findIndex(isQualitySession);
    if (qualityIndex >= 0) {
      nextPlan.sessions[qualityIndex] = convertQualityToEasy(nextPlan.sessions[qualityIndex]);
    }
  }

  if (capability.lastWorkoutDifficulty === "easy" && capability.weeklyLoad > 0) {
    const easyIndex = nextPlan.sessions.findIndex(isEasySession);
    if (easyIndex >= 0) {
      const bonusMinutes = capability.fatigueIndex <= 0.35 ? 5 : 3;
      nextPlan.sessions[easyIndex] = setPrimaryRunDuration(nextPlan.sessions[easyIndex], bonusMinutes);
    }
  }

  if (capability.lastWorkoutDifficulty === "hard" || capability.lastWorkoutDifficulty === "very_hard" || capability.recoveryNeeded) {
    const longIndex = nextPlan.sessions.findIndex(isLongSession);
    if (longIndex >= 0) {
      const reductionMinutes = capability.recoveryNeeded ? -10 : -5;
      nextPlan.sessions[longIndex] = setPrimaryRunDuration(nextPlan.sessions[longIndex], reductionMinutes);
      nextPlan.sessions[longIndex].notes = "Kortet lidt ned for at holde den samlede belastning realistisk.";
    }
  }

  const weekLoads = new Map<number, number>();
  nextPlan.sessions.forEach((session) => {
    weekLoads.set(session.week, (weekLoads.get(session.week) ?? 0) + session.loadScore);
  });

  nextPlan.sessions = nextPlan.sessions.map((session) => {
    const runMinutes = sumRunMinutes(session);
    const cappedRunMinutes = Math.min(runMinutes, capability.longestRunMinutes + 10);

    if (runMinutes <= cappedRunMinutes) return session;

    return setPrimaryRunDuration(session, cappedRunMinutes - runMinutes);
  });

  return nextPlan;
}
