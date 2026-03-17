import { CoachDecision } from "./coachDecision";

export type TrainingPhase = "build" | "recover" | "stabilize";

export type TrainingBlock = {
  phase: TrainingPhase;
  weekIndex: number;
};

function clampWeekIndex(value: number): number {
  return Math.max(1, Math.round(value));
}

export function createInitialTrainingBlock(): TrainingBlock {
  return {
    phase: "build",
    weekIndex: 1,
  };
}

export function updateTrainingBlock(previous: TrainingBlock, decision: CoachDecision): TrainingBlock {
  if (decision.type === "recovery_block") {
    return {
      phase: "recover",
      weekIndex: 1,
    };
  }

  if (decision.type === "reduce_load") {
    return {
      phase: "stabilize",
      weekIndex: 1,
    };
  }

  if (decision.type === "progress") {
    const nextWeekIndex = clampWeekIndex(previous.weekIndex + 1);

    if (nextWeekIndex >= 4) {
      return {
        phase: "recover",
        weekIndex: 1,
      };
    }

    return {
      phase: previous.phase,
      weekIndex: nextWeekIndex,
    };
  }

  if (previous.weekIndex >= 4) {
    return {
      phase: "recover",
      weekIndex: 1,
    };
  }

  return {
    phase: previous.phase,
    weekIndex: clampWeekIndex(previous.weekIndex),
  };
}
