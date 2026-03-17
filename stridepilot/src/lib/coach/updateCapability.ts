import { CapabilityState, WorkoutFeedback } from "./capability";

function clampFatigue(value: number): number {
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100));
}

function roundMetric(value: number): number {
  return Math.max(0, Math.round(value * 10) / 10);
}

export function updateCapability(capability: CapabilityState, feedback: WorkoutFeedback): CapabilityState {
  let weeklyLoad = capability.weeklyLoad;
  let fatigueIndex = capability.fatigueIndex;
  let recoveryNeeded = false;

  if (feedback.difficulty === "very_hard") {
    weeklyLoad *= 0.9;
    fatigueIndex += 0.18;
  } else if (feedback.difficulty === "hard") {
    fatigueIndex += 0.1;
  } else if (feedback.difficulty === "easy") {
    fatigueIndex -= 0.06;
  } else {
    fatigueIndex -= 0.02;
  }

  if (feedback.energy === "high" && feedback.difficulty === "easy") {
    weeklyLoad *= 1.05;
    fatigueIndex -= 0.08;
  } else if (feedback.energy === "low") {
    fatigueIndex += 0.08;
  }

  if (feedback.pain === "moderate") {
    weeklyLoad *= 0.85;
    fatigueIndex += 0.2;
  }

  if (feedback.pain === "high") {
    weeklyLoad *= 0.75;
    fatigueIndex += 0.35;
    recoveryNeeded = true;
  }

  if (!feedback.completed) {
    fatigueIndex += 0.12;
  }

  const continuousRunMinutes =
    feedback.difficulty === "easy" && feedback.energy === "high" && feedback.pain === "none"
      ? capability.continuousRunMinutes + 2
      : feedback.difficulty === "very_hard" || feedback.pain === "moderate" || feedback.pain === "high"
        ? Math.max(5, capability.continuousRunMinutes - 1)
        : capability.continuousRunMinutes;

  const longestRunMinutes =
    feedback.completed && feedback.difficulty !== "very_hard" && feedback.pain !== "high"
      ? Math.max(capability.longestRunMinutes, continuousRunMinutes + 5)
      : capability.longestRunMinutes;

  return {
    continuousRunMinutes: roundMetric(continuousRunMinutes),
    longestRunMinutes: roundMetric(longestRunMinutes),
    weeklyLoad: roundMetric(weeklyLoad),
    fatigueIndex: clampFatigue(fatigueIndex),
    recoveryNeeded,
    lastWorkoutDifficulty: feedback.difficulty,
  };
}
