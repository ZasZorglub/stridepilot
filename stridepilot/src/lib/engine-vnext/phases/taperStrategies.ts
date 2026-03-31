import type { GoalType } from "../types";

export interface TaperStrategy {
  taperVolumeRatio: number;
  raceWeekVolumeRatio: number;
  longRunReduction: number;
  allowSharpening: boolean;
  sharpeningFamily: "none" | "strides" | "race_pace_short";
  simplifyToSessionCount?: number;
}

function distanceIndex(raceDistance: "5K" | "10K" | "HalfMarathon" | "Marathon"): number {
  if (raceDistance === "5K") return 0;
  if (raceDistance === "10K") return 1;
  if (raceDistance === "HalfMarathon") return 2;
  return 3;
}

export function getTaperStrategy(params: {
  raceDistance: "5K" | "10K" | "HalfMarathon" | "Marathon";
  goalType: GoalType;
}): TaperStrategy {
  const { raceDistance, goalType } = params;
  const idx = distanceIndex(raceDistance);
  const finishLike =
    goalType === "finish" ||
    goalType === "finish_without_walking" ||
    goalType === "build_consistency" ||
    goalType === "return_to_running";
  const targetLike = goalType === "target_time";
  const improveLike = goalType === "improve_time";

  if (finishLike) {
    return {
      taperVolumeRatio: [0.76, 0.72, 0.68, 0.62][idx],
      raceWeekVolumeRatio: [0.58, 0.54, 0.48, 0.4][idx],
      longRunReduction: [0.4, 0.44, 0.5, 0.58][idx],
      allowSharpening: raceDistance !== "Marathon" && goalType !== "return_to_running",
      sharpeningFamily: raceDistance === "Marathon" || goalType === "return_to_running" ? "none" : "strides",
      simplifyToSessionCount: raceDistance === "Marathon" ? 3 : undefined,
    };
  }

  if (improveLike) {
    return {
      taperVolumeRatio: [0.8, 0.76, 0.7, 0.64][idx],
      raceWeekVolumeRatio: [0.62, 0.58, 0.52, 0.44][idx],
      longRunReduction: [0.45, 0.48, 0.54, 0.6][idx],
      allowSharpening: true,
      sharpeningFamily: raceDistance === "Marathon" ? "strides" : "race_pace_short",
      simplifyToSessionCount: raceDistance === "Marathon" ? 3 : undefined,
    };
  }

  if (targetLike) {
    return {
      taperVolumeRatio: [0.82, 0.78, 0.72, 0.66][idx],
      raceWeekVolumeRatio: [0.64, 0.6, 0.54, 0.46][idx],
      longRunReduction: [0.48, 0.52, 0.58, 0.64][idx],
      allowSharpening: true,
      sharpeningFamily: "race_pace_short",
      simplifyToSessionCount: raceDistance === "Marathon" ? 3 : undefined,
    };
  }

  return {
    taperVolumeRatio: 0.72,
    raceWeekVolumeRatio: 0.54,
    longRunReduction: 0.5,
    allowSharpening: false,
    sharpeningFamily: "none",
  };
}
