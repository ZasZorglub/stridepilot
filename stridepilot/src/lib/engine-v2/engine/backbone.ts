import { selectBackbone } from "../backboneSelection";
import { buildProgressionCurves } from "../progressionCurves";
import type { BackboneSelection, GoalClassification, PhasePlan, PlanType, ProgressionCurves, RunnerClassification, RunnerInput } from "../models";

export function determineBackboneType(profile: RunnerInput, goal: GoalClassification, classification: RunnerClassification): BackboneSelection {
  return selectBackbone(profile, classification, goal);
}

export function buildBackboneProgression(params: {
  input: RunnerInput;
  classification: RunnerClassification;
  goalClassification: GoalClassification;
  backboneSelection: BackboneSelection;
  phasePlan: PhasePlan;
  planType: PlanType;
}): ProgressionCurves {
  return buildProgressionCurves(
    params.input,
    params.classification,
    params.goalClassification,
    params.backboneSelection,
    params.phasePlan,
    params.planType,
  );
}
