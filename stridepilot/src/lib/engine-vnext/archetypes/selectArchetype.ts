import { getArchetypeById } from "./catalog";
import type { PlanArchetype, SelectArchetypeInput } from "../types";

export function selectArchetype(input: SelectArchetypeInput): PlanArchetype {
  const { runnerLevel, goalType, raceDistance, returnToRunning } = input;

  if (returnToRunning || goalType === "return_to_running") {
    return getArchetypeById("return_to_running");
  }

  if (raceDistance === "5K" && goalType === "finish_without_walking" && runnerLevel === "true_beginner") {
    return getArchetypeById("true_beginner_5k_finish");
  }

  if (goalType === "improve_time" && raceDistance === "5K" && (runnerLevel === "beginner_plus" || runnerLevel === "beginner")) {
    return getArchetypeById("beginner_plus_improve");
  }

  if (goalType === "target_time" && raceDistance === "HalfMarathon") {
    return getArchetypeById("half_marathon_target");
  }

  if (goalType === "target_time") {
    return getArchetypeById("recreational_target_time");
  }

  if (raceDistance === "HalfMarathon" && goalType === "finish") {
    return getArchetypeById("half_marathon_finish");
  }

  if (raceDistance === "Marathon" && goalType === "finish") {
    return getArchetypeById("marathon_finish");
  }

  if (raceDistance === "10K" && goalType === "finish" && runnerLevel === "intermediate") {
    return getArchetypeById("intermediate_finish");
  }

  return getArchetypeById("beginner_finish");
}
