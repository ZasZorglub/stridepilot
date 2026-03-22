import type { PlanTypeDecision, RunnerClassification, RunnerInput } from "./models";

export function choosePlanType(input: RunnerInput, classification: RunnerClassification): PlanTypeDecision {
  const level = classification.traits.runnerLevel;
  const reasons: string[] = [];

  if (input.goalType === "return_to_running") {
    reasons.push("Runner is explicitly returning after time off, so re-entry structure takes priority.");
    return { planType: "return_to_running", reasons };
  }

  if (input.goalType === "build_consistency") {
    reasons.push("Primary goal is consistency rather than race performance, so the engine prioritizes repeatable training before sharper specificity.");
    return { planType: "consistency_builder", reasons };
  }

  if (input.raceDistance === "5K") {
    if (input.goalType === "finish_without_walking") {
      reasons.push("5K goal is completion without walking, so continuous running progression is primary.");
      return { planType: "5k_finish_no_walk", reasons };
    }
    if (input.goalType === "target_time") {
      reasons.push("5K goal is an explicit target time, so the engine chooses the most specific 5K performance plan type.");
      return { planType: "5k_target_time", reasons };
    }
    if (input.goalType === "improve_time") {
      reasons.push("5K goal is performance-oriented, so the engine chooses a sharper 5K improvement plan.");
      return { planType: "5k_improve", reasons };
    }
    reasons.push("5K goal is completion-focused, so the engine chooses a finish-first 5K plan.");
    return { planType: "5k_finish", reasons };
  }

  if (input.raceDistance === "10K") {
    if (input.goalType === "target_time") {
      reasons.push("10K goal is a target time, so the engine chooses a fully performance-oriented 10K plan type.");
      return { planType: "10k_target_time", reasons };
    }
    if (input.goalType === "improve_time") {
      reasons.push("10K goal is performance-oriented, so the engine chooses a 10K improvement plan.");
      return { planType: "10k_improve", reasons };
    }
    reasons.push(
      level === "beginner_plus" || level === "true_beginner"
        ? "10K goal is completion-focused, but runner still needs continuity and durability first."
        : "10K goal is distance-oriented for a runner who already runs continuously, so the engine chooses a true 10K finish plan rather than a beginner run-walk plan.",
    );
    return { planType: "10k_finish", reasons };
  }

  if (input.raceDistance === "HalfMarathon") {
    const planType = input.goalType === "target_time" ? "hm_target_time" : input.goalType === "improve_time" ? "hm_improve" : "hm_finish";
    reasons.push(
      planType === "hm_target_time"
        ? "Half marathon goal is target-time specific."
        : planType === "hm_improve"
          ? "Half marathon goal is performance-oriented."
          : "Half marathon goal is finish-oriented.",
    );
    return { planType, reasons };
  }

  const planType =
    input.goalType === "target_time" ? "marathon_target_time" : input.goalType === "improve_time" ? "marathon_improve" : "marathon_finish";
  reasons.push(
    planType === "marathon_target_time"
      ? "Marathon goal is target-time specific."
      : planType === "marathon_improve"
        ? "Marathon goal is performance-oriented."
        : "Marathon goal is finish-oriented.",
  );
  return { planType, reasons };
}
