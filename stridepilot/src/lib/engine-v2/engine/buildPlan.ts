import { buildCoachExplanation } from "../explanationEngine";
import { buildAdaptationHooks } from "../../engine-vnext/adaptation/buildAdaptationHooks";
import { buildBasePlanVersionMetadata } from "../../engine-vnext/adaptation/buildMutationHistory";
import { buildReturnToRunningState } from "../../engine-vnext/eligibility/returnToRunning";
import { applyReturnToRunningCaps } from "../../engine-vnext/progression/returnModeCaps";
import { validateVNextPlan } from "../../engine-vnext/validators/validatePlan";
import { buildPhasePlan } from "../phaseEngine";
import { choosePlanType } from "../planTypes";
import { validateEnginePlan } from "../validation";
import type { EnginePlan, FeedbackSignal, RunnerInput } from "../models";
import { adaptPlanFromFeedback, updatePlanAfterFeedback } from "./adaptation";
import { buildBackboneProgression, determineBackboneType } from "./backbone";
import { applyRunnerModifiers } from "./modifiers";
import { determinePlanDuration } from "./planDuration";
import { determineRunnerLevel } from "./runnerLevel";
import { applySafetyRules } from "./safety";
import { generateSessions } from "./sessionGenerator";
import { placeSessionsOnDays } from "./sessionPlacement";
import { insertStepBackWeeks } from "./stepBack";
import { insertTaper } from "./taper";
import type { LayeredPlanBuildState } from "./types";
import { buildWeeklyVolumeCurve } from "./volumeCurve";
import { buildLongRunProgression } from "./longRunProgression";
import { buildWeeklyStructure } from "./weekStructure";

export function buildFullPlan(input: RunnerInput): EnginePlan {
  const state: LayeredPlanBuildState = { input };

  state.classification = determineRunnerLevel(input);

  const durationDecision = determinePlanDuration(input, { raceDistance: input.raceDistance, goalType: input.goalType }, state.classification);
  state.goalClassification = durationDecision.goalClassification;
  state.timelineRecommendation = durationDecision.timelineRecommendation;
  state.resolvedInput = durationDecision.resolvedInput;

  state.backboneSelection = determineBackboneType(state.resolvedInput, state.goalClassification, state.classification);
  state.planTypeDecision = choosePlanType(state.resolvedInput, state.classification);
  state.phasePlan = buildPhasePlan(state.resolvedInput, state.classification, state.planTypeDecision.planType);

  state.curves = buildBackboneProgression({
    input: state.resolvedInput,
    classification: state.classification,
    goalClassification: state.goalClassification,
    backboneSelection: state.backboneSelection,
    phasePlan: state.phasePlan,
    planType: state.planTypeDecision.planType,
  });
  state.longRunProgression = buildLongRunProgression(state.curves);
  state.weeklyVolumeProgression = buildWeeklyVolumeCurve(state.curves);

  const stepBack = insertStepBackWeeks(state.curves);
  state.curves = stepBack.curves;
  state.stepBackWeeks = stepBack.stepBackWeeks;

  const taper = insertTaper(state.curves);
  state.curves = taper.curves;
  state.taperWeeks = taper.taperWeeks;

  const safety = applySafetyRules({
    input: state.resolvedInput,
    classification: state.classification,
    phasePlan: state.phasePlan,
    curves: state.curves,
  });
  state.curves = safety.curves;
  state.safetyAdjustments = safety.reasons;

  const modifiers = applyRunnerModifiers({
    input: state.resolvedInput,
    classification: state.classification,
    curves: state.curves,
  });
  state.curves = modifiers.curves;
  state.modifierAdjustments = modifiers.reasons;

  const returnMode = applyReturnToRunningCaps({
    input: state.resolvedInput,
    classification: state.classification,
    phasePlan: state.phasePlan,
    curves: state.curves,
  });
  state.curves = returnMode.curves;
  if (returnMode.reasons.length > 0) {
    state.modifierAdjustments = [...(state.modifierAdjustments ?? []), ...returnMode.reasons];
  }

  state.weeklyStructures = buildWeeklyStructure({
    input: state.resolvedInput,
    classification: state.classification,
    phasePlan: state.phasePlan,
    planType: state.planTypeDecision.planType,
    curves: state.curves,
  });
  state.weeklyStructures = placeSessionsOnDays(state.weeklyStructures, state.resolvedInput);
  state.weeks = generateSessions({
    input: state.resolvedInput,
    classification: state.classification,
    planType: state.planTypeDecision.planType,
    curves: state.curves,
    weeklyStructures: state.weeklyStructures,
  });

  const plan: EnginePlan = {
    input,
    resolvedInput: state.resolvedInput,
    classification: state.classification,
    goalClassification: state.goalClassification,
    timelineRecommendation: state.timelineRecommendation,
    backboneSelection: state.backboneSelection,
    planTypeDecision: state.planTypeDecision,
    phasePlan: state.phasePlan,
    curves: state.curves,
    weeks: state.weeks,
    explanation: { planWhy: [], weekWhy: [] },
    returnToRunningState: buildReturnToRunningState({
      input: state.resolvedInput,
      classification: state.classification,
      phasePlan: state.phasePlan,
      curves: state.curves,
    }),
  };

  plan.explanation = buildCoachExplanation(plan);
  if ((state.safetyAdjustments?.length ?? 0) > 0) {
    plan.explanation.planWhy.push(...state.safetyAdjustments!);
  }
  if ((state.modifierAdjustments?.length ?? 0) > 0) {
    plan.explanation.planWhy.push(...state.modifierAdjustments!);
  }
  if (plan.returnToRunningState?.active) {
    plan.explanation.planWhy.push(...plan.returnToRunningState.reasons);
  }

  const issues = validateEnginePlan(plan);
  plan.vNextValidation = validateVNextPlan(plan);
  if (issues.some((issue) => issue.severity === "critical")) {
    plan.explanation.weekWhy.push(`Validation flagged ${issues.length} issue(s), including at least one critical quality concern.`);
  }
  if ((plan.vNextValidation.warningCount ?? 0) > 0 || (plan.vNextValidation.hardFailCount ?? 0) > 0) {
    plan.explanation.weekWhy.push(
      `vNext validation reported ${plan.vNextValidation.hardFailCount} hard fail(s) and ${plan.vNextValidation.warningCount} warning(s).`,
    );
  }
  plan.adaptationHooks = buildAdaptationHooks(plan);
  plan.versionMetadata = buildBasePlanVersionMetadata(plan);
  plan.mutationHistory = [];

  return plan;
}

export function adaptBuiltPlanFromFeedback(plan: EnginePlan, feedback: FeedbackSignal[]) {
  return adaptPlanFromFeedback(plan, feedback);
}

export function updateBuiltPlanAfterFeedback(plan: EnginePlan, feedback: FeedbackSignal[]) {
  return updatePlanAfterFeedback(plan, feedback);
}
