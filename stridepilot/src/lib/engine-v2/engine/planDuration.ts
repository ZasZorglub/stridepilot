import { applyTimelineRecommendation, buildTimelineRecommendation } from "../timelineRecommendation";
import type { GoalClassification, RunnerClassification, RunnerInput, TimelineRecommendation } from "../models";

export interface PlanDurationDecision {
  goalClassification: GoalClassification;
  timelineRecommendation: TimelineRecommendation;
  resolvedInput: RunnerInput;
}

export function determinePlanDuration(profile: RunnerInput, goal: Pick<RunnerInput, "raceDistance" | "goalType">, classification: RunnerClassification): PlanDurationDecision {
  const mergedInput: RunnerInput = {
    ...profile,
    raceDistance: goal.raceDistance,
    goalType: goal.goalType,
  };
  const { goalClassification, recommendation } = buildTimelineRecommendation(mergedInput, classification);
  return {
    goalClassification,
    timelineRecommendation: recommendation,
    resolvedInput: applyTimelineRecommendation(mergedInput, recommendation),
  };
}
