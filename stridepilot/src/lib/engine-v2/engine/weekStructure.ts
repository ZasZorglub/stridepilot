import { buildWeeklyStructure as buildWeeklyStructureForWeek } from "../weeklyStructure";
import type { PhasePlan, PlanType, ProgressionCurves, RunnerClassification, RunnerInput, WeeklyStructure } from "../models";

export function buildWeeklyStructure(params: {
  input: RunnerInput;
  classification: RunnerClassification;
  phasePlan: PhasePlan;
  planType: PlanType;
  curves: ProgressionCurves;
}): WeeklyStructure[] {
  return params.phasePlan.weeks.map((phaseWeek) =>
    buildWeeklyStructureForWeek(params.input, params.classification, phaseWeek, params.planType, params.curves),
  );
}
