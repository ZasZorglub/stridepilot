import { CapabilityState, WorkoutFeedback } from "./capability";

function clampScale(value: number): number {
  return Math.max(0, Math.min(10, Math.round(value * 10) / 10));
}

function roundMetric(value: number): number {
  return Math.max(0, Math.round(value * 10) / 10);
}

export function updateCapability(capability: CapabilityState, feedback: WorkoutFeedback): CapabilityState {
  let weeklyLoad = capability.weeklyLoad;
  let fatigueIndex = capability.fatigueIndex;
  let recoveryDebt = capability.recoveryDebt;

  if (feedback.difficulty === "easy") recoveryDebt -= 1;
  if (feedback.difficulty === "hard") recoveryDebt += 1;
  if (feedback.difficulty === "very_hard") recoveryDebt += 2;

  if (feedback.pain === "moderate") recoveryDebt += 2;
  if (feedback.pain === "high") recoveryDebt += 4;

  if (feedback.energy === "high") fatigueIndex -= 1;
  if (feedback.energy === "low") fatigueIndex += 1;

  recoveryDebt = clampScale(recoveryDebt);
  fatigueIndex = clampScale(fatigueIndex);

  if (recoveryDebt > 7) {
    weeklyLoad *= 0.8;
  } else if (recoveryDebt > 5) {
    weeklyLoad *= 0.9;
  }

  return {
    continuousRunMinutes: roundMetric(capability.continuousRunMinutes),
    longestRunMinutes: roundMetric(capability.longestRunMinutes),
    weeklyLoad: roundMetric(weeklyLoad),
    fatigueIndex,
    recoveryDebt,
    intervalTolerance: roundMetric(capability.intervalTolerance),
    consistencyScore: roundMetric(capability.consistencyScore),
  };
}
