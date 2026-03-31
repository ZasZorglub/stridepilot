import type { EnginePlan } from "../../engine-v2/models";
import { noBackToBackQualityRule, noHardBeforeLongRunRule } from "../rules/spacingRules";
import { runRules } from "../rules/runRules";
import { beginnerReturnIntensityLockRule, longRunShareSanityRule, raceWeekDistinctnessRule, taperDistinctnessRule } from "../rules/structureRules";
import type { VNextValidationReport } from "../rules/types";

export function validateVNextPlan(plan: EnginePlan): VNextValidationReport {
  return runRules(plan, [
    noHardBeforeLongRunRule,
    noBackToBackQualityRule,
    longRunShareSanityRule,
    beginnerReturnIntensityLockRule,
    taperDistinctnessRule,
    raceWeekDistinctnessRule,
  ]);
}
