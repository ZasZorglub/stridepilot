import type { GoalType, WeeklySkeletonRole } from "../types";
import { getTaperStrategy } from "../phases/taperStrategies";

function targetSessionCount(sessionsPerWeek: number, simplifyToSessionCount?: number): number {
  if (simplifyToSessionCount) return Math.min(sessionsPerWeek, simplifyToSessionCount);
  return Math.min(sessionsPerWeek, 4);
}

export function buildRaceWeekRoles(params: {
  goalType: GoalType;
  raceDistance: "5K" | "10K" | "HalfMarathon" | "Marathon";
  sessionsPerWeek: number;
}): WeeklySkeletonRole[] {
  const { goalType, raceDistance, sessionsPerWeek } = params;
  const strategy = getTaperStrategy({ goalType, raceDistance });
  const count = targetSessionCount(sessionsPerWeek, strategy.simplifyToSessionCount);
  const finishLike =
    goalType === "finish" ||
    goalType === "finish_without_walking" ||
    goalType === "build_consistency" ||
    goalType === "return_to_running";

  if (count <= 2) {
    return finishLike
      ? ["strides", "easy"]
      : [strategy.sharpeningFamily === "race_pace_short" ? "race_pace_short" : "strides", "easy"];
  }

  if (count === 3) {
    if (finishLike) {
      return strategy.allowSharpening ? ["easy", "strides", "easy"] : ["easy", "recovery", "easy"];
    }
    return ["easy", strategy.sharpeningFamily === "race_pace_short" ? "race_pace_short" : "strides", "easy"];
  }

  if (finishLike) {
    return strategy.allowSharpening ? ["easy", "recovery", "strides", "easy"] : ["easy", "easy", "recovery", "easy"];
  }

  return ["easy", "recovery", strategy.sharpeningFamily === "race_pace_short" ? "race_pace_short" : "strides", "easy"];
}
