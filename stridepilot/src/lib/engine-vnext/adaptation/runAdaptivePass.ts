import { validateEnginePlan } from "../../engine-v2/validation";
import type {
  EnginePlan,
  PlanMutationHistoryEntry,
  VNextAdaptivePassPlanMeta,
  VNextAdaptivePassResult,
  VNextAdaptivePassValidationSummary,
  VNextAdaptationFeedback,
} from "../../engine-v2/models";
import { applyVNextAdaptationDecision } from "./applyAdaptationDecision";
import { applyAdaptiveVersioning, buildAdaptiveHistoryEntry } from "./buildMutationHistory";
import { decideVNextAdaptation } from "./decideAdaptation";
import { validateVNextPlan } from "../validators/validatePlan";

function buildPlanMeta(plan: EnginePlan, targetWeekIndex: number): VNextAdaptivePassPlanMeta {
  return {
    totalWeeks: plan.weeks.length,
    protectedRunner: Boolean(plan.adaptationHooks?.protectedRunner),
    planType: plan.planTypeDecision.planType,
    targetWeekIndex,
  };
}

function summarizeValidation(plan: EnginePlan): VNextAdaptivePassValidationSummary {
  const vNextValidation = plan.vNextValidation ?? validateVNextPlan(plan);
  const engineIssues = validateEnginePlan(plan);
  const criticalIssueCount = engineIssues.filter((issue) => issue.severity === "critical").length;
  const importantIssueCount = engineIssues.filter((issue) => issue.severity === "important").length;
  const minorIssueCount = engineIssues.filter((issue) => issue.severity === "minor").length;

  return {
    passed: criticalIssueCount === 0 && (vNextValidation.hardFailCount ?? 0) === 0,
    vNextHardFailCount: vNextValidation.hardFailCount ?? 0,
    vNextAutoAdjustCount: vNextValidation.autoAdjustCount ?? 0,
    vNextWarningCount: vNextValidation.warningCount ?? 0,
    criticalIssueCount,
    importantIssueCount,
    minorIssueCount,
  };
}

export function runVNextAdaptivePass(plan: EnginePlan, feedback: VNextAdaptationFeedback): VNextAdaptivePassResult {
  const decision = decideVNextAdaptation(plan, feedback);
  const mutationResult = applyVNextAdaptationDecision(plan, decision);
  const preliminaryPlan = mutationResult.plan;
  const finalValidation = summarizeValidation(preliminaryPlan);
  const historyEntry: PlanMutationHistoryEntry = buildAdaptiveHistoryEntry({
    plan,
    feedback,
    decision,
    mutation: mutationResult.mutation,
    validation: finalValidation,
  });
  const finalPlan = applyAdaptiveVersioning({
    originalPlan: plan,
    finalPlan: preliminaryPlan,
    historyEntry,
  });

  return {
    originalPlanMeta: buildPlanMeta(plan, feedback.targetWeekIndex),
    feedback,
    decision,
    mutation: mutationResult.mutation,
    historyEntry,
    finalPlan,
    finalValidation,
    applied: mutationResult.mutation.applied,
    fallback: mutationResult.mutation.fallback,
  };
}
