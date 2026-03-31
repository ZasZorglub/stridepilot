import type {
  BackboneSelection,
  BuiltWeek,
  GoalClassification,
  PhasePlan,
  PlanTypeDecision,
  ProgressionCurves,
  RunnerClassification,
  RunnerInput,
  TimelineRecommendation,
  WeeklyStructure,
} from "../models";

export interface LayeredPlanBuildState {
  input: RunnerInput;
  classification?: RunnerClassification;
  goalClassification?: GoalClassification;
  timelineRecommendation?: TimelineRecommendation;
  resolvedInput?: RunnerInput;
  backboneSelection?: BackboneSelection;
  planTypeDecision?: PlanTypeDecision;
  phasePlan?: PhasePlan;
  curves?: ProgressionCurves;
  weeklyStructures?: WeeklyStructure[];
  weeks?: BuiltWeek[];
  longRunProgression?: number[];
  weeklyVolumeProgression?: number[];
  stepBackWeeks?: number[];
  taperWeeks?: number[];
  safetyAdjustments?: string[];
  modifierAdjustments?: string[];
}
