import { TrainingPlan } from "@/lib/types";
import { normalizeStepDuration } from "@/lib/duration";
import { CapabilityState } from "./capability";
import { CoachDecision } from "./coachDecision";

function clonePlan(plan: TrainingPlan): TrainingPlan {
  return {
    ...plan,
    sessions: plan.sessions.map((session) => ({
      ...session,
      steps: session.steps.map((step) => ({ ...step })),
    })),
  };
}

function classifySession(session: TrainingPlan["sessions"][number]): "interval" | "tempo" | "easy" | "long" | "other" {
  const title = `${session.title} ${session.notes ?? ""}`.toLowerCase();
  if (/interval/.test(title)) return "interval";
  if (/tempo/.test(title)) return "tempo";
  if (/udholdenhed|lang|long/.test(title)) return "long";
  if (/roligt|easy|recovery/.test(title) || session.loadScore <= 5) return "easy";
  return "other";
}

function reduceRunDuration(session: TrainingPlan["sessions"][number], factor: number): TrainingPlan["sessions"][number] {
  return {
    ...session,
    steps: session.steps.map((step) =>
      step.type === "run"
        ? {
            ...step,
            durationSec: normalizeStepDuration(Math.max(5 * 60, step.durationSec * factor)),
          }
        : step,
    ),
  };
}

function increaseRunDuration(session: TrainingPlan["sessions"][number], factor: number): TrainingPlan["sessions"][number] {
  return {
    ...session,
    steps: session.steps.map((step) =>
      step.type === "run"
        ? {
            ...step,
            durationSec: normalizeStepDuration(Math.max(5 * 60, step.durationSec * factor)),
          }
        : step,
    ),
  };
}

function adjustPrimaryRunByMinutes(session: TrainingPlan["sessions"][number], deltaMinutes: number): TrainingPlan["sessions"][number] {
  const next = {
    ...session,
    steps: session.steps.map((step) => ({ ...step })),
  };
  const targetRun = next.steps.filter((step) => step.type === "run").slice(-1)[0];

  if (!targetRun) return next;

  targetRun.durationSec = normalizeStepDuration(Math.max(5 * 60, targetRun.durationSec + deltaMinutes * 60));
  return next;
}

function convertToEasy(session: TrainingPlan["sessions"][number]): TrainingPlan["sessions"][number] {
  const reduced = reduceRunDuration(session, 0.8);
  return {
    ...reduced,
    title: `Uge ${session.week} - Roligt pas`,
    notes: "Tilpasset til et roligere pas for at give lidt mere luft i belastningen.",
    loadScore: Math.max(1, Math.min(10, Math.round(session.loadScore * 0.8))),
  };
}

function upcomingWeekLoad(plan: TrainingPlan): number {
  if (plan.sessions.length === 0) return 0;
  const nextWeek = Math.min(...plan.sessions.map((session) => session.week));
  return plan.sessions.filter((session) => session.week === nextWeek).reduce((sum, session) => sum + session.loadScore, 0);
}

export function adaptUpcomingSessions(plan: TrainingPlan, capability: CapabilityState, decision?: CoachDecision): TrainingPlan {
  const nextPlan = clonePlan(plan);
  if (nextPlan.sessions.length === 0) return nextPlan;

  if (decision?.type === "progress") {
    const strategicIndex = nextPlan.sessions.findIndex((session) => {
      const type = classifySession(session);
      return type === "easy" || type === "long";
    });
    if (strategicIndex >= 0) {
      nextPlan.sessions[strategicIndex] = increaseRunDuration(nextPlan.sessions[strategicIndex], 1.05);
    }
  } else if (decision?.type === "reduce_load") {
    const strategicIndex = nextPlan.sessions.findIndex((session) => session.steps.some((step) => step.type === "run"));
    if (strategicIndex >= 0) {
      nextPlan.sessions[strategicIndex] = reduceRunDuration(nextPlan.sessions[strategicIndex], 0.9);
    }
  } else if (decision?.type === "recovery_block") {
    const strategicIndex = nextPlan.sessions.findIndex((session) => {
      const type = classifySession(session);
      return type === "interval" || type === "tempo";
    });
    if (strategicIndex >= 0) {
      nextPlan.sessions[strategicIndex] = convertToEasy(nextPlan.sessions[strategicIndex]);
    }
  } else if (decision?.type === "confidence_build") {
    const strategicIndex = nextPlan.sessions.findIndex((session) => session.steps.some((step) => step.type === "run"));
    if (strategicIndex >= 0) {
      const softened = adjustPrimaryRunByMinutes(nextPlan.sessions[strategicIndex], -5);
      nextPlan.sessions[strategicIndex] = {
        ...softened,
        title: `Uge ${softened.week} - Roligt pas`,
        notes: "Holdt lidt kortere og roligere for at bygge overskud og rytme.",
      };
    }
  }

  const baselineWeeklyLoad = upcomingWeekLoad(nextPlan);

  if (capability.recoveryDebt >= 6) {
    const qualityIndex = nextPlan.sessions.findIndex((session) => {
      const type = classifySession(session);
      return type === "interval" || type === "tempo";
    });

    if (qualityIndex >= 0) {
      nextPlan.sessions[qualityIndex] = convertToEasy(nextPlan.sessions[qualityIndex]);
    }
  }

  if (capability.fatigueIndex >= 6) {
    const nextRunIndex = nextPlan.sessions.findIndex((session) => session.steps.some((step) => step.type === "run"));
    if (nextRunIndex >= 0) {
      nextPlan.sessions[nextRunIndex] = reduceRunDuration(nextPlan.sessions[nextRunIndex], 0.9);
    }
  }

  if (baselineWeeklyLoad > 0 && capability.weeklyLoad > baselineWeeklyLoad) {
    const easyIndex = nextPlan.sessions.findIndex((session) => classifySession(session) === "easy");
    if (easyIndex >= 0) {
      const extraMinutes = capability.weeklyLoad >= baselineWeeklyLoad * 1.15 ? 5 : 3;
      nextPlan.sessions[easyIndex] = adjustPrimaryRunByMinutes(nextPlan.sessions[easyIndex], extraMinutes);
    }
  }

  if (baselineWeeklyLoad > 0 && capability.weeklyLoad < baselineWeeklyLoad) {
    const longIndex = nextPlan.sessions.findIndex((session) => classifySession(session) === "long");
    if (longIndex >= 0) {
      const reductionMinutes = capability.weeklyLoad <= baselineWeeklyLoad * 0.85 ? -10 : -5;
      nextPlan.sessions[longIndex] = adjustPrimaryRunByMinutes(nextPlan.sessions[longIndex], reductionMinutes);
    }
  }

  return nextPlan;
}
