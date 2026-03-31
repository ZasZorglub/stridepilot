export type RunnerLevel =
  | "true_beginner"
  | "beginner"
  | "beginner_plus"
  | "recreational"
  | "intermediate"
  | "advanced";

export type GoalType =
  | "finish"
  | "finish_without_walking"
  | "build_consistency"
  | "improve_time"
  | "target_time"
  | "return_to_running";

export type BackboneType = "continuous" | "long_run" | "hybrid";

export type PhaseType = "base" | "build" | "specific" | "peak" | "taper" | "race_week";

export type WorkoutFamily =
  | "easy"
  | "recovery"
  | "support"
  | "steady"
  | "quality"
  | "intervals"
  | "threshold"
  | "race_pace"
  | "race_pace_short"
  | "long_run"
  | "long_with_segments"
  | "long_short"
  | "short_quality"
  | "strides";

export type PlanArchetypeId =
  | "true_beginner_5k_finish"
  | "beginner_finish"
  | "beginner_plus_improve"
  | "recreational_target_time"
  | "intermediate_finish"
  | "half_marathon_finish"
  | "half_marathon_target"
  | "marathon_finish"
  | "return_to_running";

export type WeeklySkeletonRole = WorkoutFamily;

export interface PlanArchetype {
  id: PlanArchetypeId;
  label: string;
  goalType: GoalType;
  distanceFocus: "5K" | "10K" | "HalfMarathon" | "Marathon" | "mixed";
  runnerLevels: RunnerLevel[];
  backboneType: BackboneType;
  qualityPolicy: "none" | "light" | "moderate";
  longRunPolicy: "support" | "anchor" | "specific";
}

export interface WeeklyTemplateDefinition {
  archetypeId: PlanArchetypeId;
  phase: PhaseType;
  sessionsPerWeek: number;
  roles: WeeklySkeletonRole[];
}

export interface SelectArchetypeInput {
  runnerLevel: RunnerLevel;
  goalType: GoalType;
  raceDistance: "5K" | "10K" | "HalfMarathon" | "Marathon";
  returnToRunning?: boolean;
}

export interface SelectWeeklyTemplateInput {
  archetype: PlanArchetype;
  phase: PhaseType;
  sessionsPerWeek: number;
  goalType?: GoalType;
  raceDistance?: "5K" | "10K" | "HalfMarathon" | "Marathon";
  isStepBackWeek?: boolean;
}
