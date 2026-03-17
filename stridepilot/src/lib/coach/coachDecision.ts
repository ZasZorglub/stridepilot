import { RunnerState } from "./runnerState";

export type CoachDecisionType =
  | "maintain"
  | "progress"
  | "reduce_load"
  | "recovery_block"
  | "confidence_build";

export type CoachDecision = {
  type: CoachDecisionType;
  reason: string;
};

export function evaluateRunnerState(state: RunnerState): CoachDecision {
  if (state.injuryRisk >= 8) {
    return {
      type: "recovery_block",
      reason: "Der er tegn på at kroppen er presset, så vi lægger en kort recovery-periode ind.",
    };
  }

  if (state.injuryRisk >= 6) {
    return {
      type: "reduce_load",
      reason: "Belastningen begynder at samle sig, så vi holder progressionen lidt mere kontrolleret.",
    };
  }

  if (state.confidence <= 3) {
    return {
      type: "confidence_build",
      reason: "Det vigtigste lige nu er at bygge rytme og overskud.",
    };
  }

  if (state.trainingMomentum >= 7 && state.injuryRisk <= 4) {
    return {
      type: "progress",
      reason: "Du virker stabil og har godt momentum, så vi kan begynde at bygge lidt mere på.",
    };
  }

  return {
    type: "maintain",
    reason: "Planen ser balanceret ud, så vi fortsætter i samme tempo.",
  };
}
