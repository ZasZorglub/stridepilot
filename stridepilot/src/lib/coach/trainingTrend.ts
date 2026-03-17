import { CapabilityState, WorkoutFeedback } from "./capability";

export type TrendDirection = "rising" | "stable" | "falling";

export type TrainingTrend = {
  fatigueTrend: TrendDirection;
  loadTrend: TrendDirection;
  painTrend: TrendDirection;
};

function detectNumericTrend(values: number[]): TrendDirection {
  if (values.length < 3) return "stable";

  const recent = values.slice(-3);
  if (recent[0] < recent[1] && recent[1] < recent[2]) return "rising";
  if (recent[0] > recent[1] && recent[1] > recent[2]) return "falling";
  return "stable";
}

function painScore(pain: WorkoutFeedback["pain"]): number {
  if (pain === "high") return 3;
  if (pain === "moderate") return 2;
  if (pain === "mild") return 1;
  return 0;
}

export function evaluateTrainingTrend(
  recentFeedback: WorkoutFeedback[],
  recentCapability: CapabilityState[],
): TrainingTrend {
  if (recentFeedback.length < 3 || recentCapability.length < 3) {
    return {
      fatigueTrend: "stable",
      loadTrend: "stable",
      painTrend: "stable",
    };
  }

  return {
    fatigueTrend: detectNumericTrend(recentCapability.map((entry) => entry.fatigueIndex)),
    loadTrend: detectNumericTrend(recentCapability.map((entry) => entry.weeklyLoad)),
    painTrend: detectNumericTrend(recentFeedback.map((entry) => painScore(entry.pain))),
  };
}
