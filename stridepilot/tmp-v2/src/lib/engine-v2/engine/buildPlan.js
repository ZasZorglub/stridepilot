"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildFullPlan = buildFullPlan;
exports.adaptBuiltPlanFromFeedback = adaptBuiltPlanFromFeedback;
exports.updateBuiltPlanAfterFeedback = updateBuiltPlanAfterFeedback;
const explanationEngine_1 = require("../explanationEngine");
const buildAdaptationHooks_1 = require("../../engine-vnext/adaptation/buildAdaptationHooks");
const buildMutationHistory_1 = require("../../engine-vnext/adaptation/buildMutationHistory");
const returnToRunning_1 = require("../../engine-vnext/eligibility/returnToRunning");
const returnModeCaps_1 = require("../../engine-vnext/progression/returnModeCaps");
const validatePlan_1 = require("../../engine-vnext/validators/validatePlan");
const phaseEngine_1 = require("../phaseEngine");
const planTypes_1 = require("../planTypes");
const validation_1 = require("../validation");
const adaptation_1 = require("./adaptation");
const backbone_1 = require("./backbone");
const modifiers_1 = require("./modifiers");
const planDuration_1 = require("./planDuration");
const runnerLevel_1 = require("./runnerLevel");
const safety_1 = require("./safety");
const sessionGenerator_1 = require("./sessionGenerator");
const sessionPlacement_1 = require("./sessionPlacement");
const stepBack_1 = require("./stepBack");
const taper_1 = require("./taper");
const volumeCurve_1 = require("./volumeCurve");
const longRunProgression_1 = require("./longRunProgression");
const weekStructure_1 = require("./weekStructure");
function buildFullPlan(input) {
    const state = { input };
    state.classification = (0, runnerLevel_1.determineRunnerLevel)(input);
    const durationDecision = (0, planDuration_1.determinePlanDuration)(input, { raceDistance: input.raceDistance, goalType: input.goalType }, state.classification);
    state.goalClassification = durationDecision.goalClassification;
    state.timelineRecommendation = durationDecision.timelineRecommendation;
    state.resolvedInput = durationDecision.resolvedInput;
    state.backboneSelection = (0, backbone_1.determineBackboneType)(state.resolvedInput, state.goalClassification, state.classification);
    state.planTypeDecision = (0, planTypes_1.choosePlanType)(state.resolvedInput, state.classification);
    state.phasePlan = (0, phaseEngine_1.buildPhasePlan)(state.resolvedInput, state.classification, state.planTypeDecision.planType);
    state.curves = (0, backbone_1.buildBackboneProgression)({
        input: state.resolvedInput,
        classification: state.classification,
        goalClassification: state.goalClassification,
        backboneSelection: state.backboneSelection,
        phasePlan: state.phasePlan,
        planType: state.planTypeDecision.planType,
    });
    state.longRunProgression = (0, longRunProgression_1.buildLongRunProgression)(state.curves);
    state.weeklyVolumeProgression = (0, volumeCurve_1.buildWeeklyVolumeCurve)(state.curves);
    const stepBack = (0, stepBack_1.insertStepBackWeeks)(state.curves);
    state.curves = stepBack.curves;
    state.stepBackWeeks = stepBack.stepBackWeeks;
    const taper = (0, taper_1.insertTaper)(state.curves);
    state.curves = taper.curves;
    state.taperWeeks = taper.taperWeeks;
    const safety = (0, safety_1.applySafetyRules)({
        input: state.resolvedInput,
        classification: state.classification,
        phasePlan: state.phasePlan,
        curves: state.curves,
    });
    state.curves = safety.curves;
    state.safetyAdjustments = safety.reasons;
    const modifiers = (0, modifiers_1.applyRunnerModifiers)({
        input: state.resolvedInput,
        classification: state.classification,
        curves: state.curves,
    });
    state.curves = modifiers.curves;
    state.modifierAdjustments = modifiers.reasons;
    const returnMode = (0, returnModeCaps_1.applyReturnToRunningCaps)({
        input: state.resolvedInput,
        classification: state.classification,
        phasePlan: state.phasePlan,
        curves: state.curves,
    });
    state.curves = returnMode.curves;
    if (returnMode.reasons.length > 0) {
        state.modifierAdjustments = [...(state.modifierAdjustments ?? []), ...returnMode.reasons];
    }
    state.weeklyStructures = (0, weekStructure_1.buildWeeklyStructure)({
        input: state.resolvedInput,
        classification: state.classification,
        phasePlan: state.phasePlan,
        planType: state.planTypeDecision.planType,
        curves: state.curves,
    });
    state.weeklyStructures = (0, sessionPlacement_1.placeSessionsOnDays)(state.weeklyStructures, state.resolvedInput);
    state.weeks = (0, sessionGenerator_1.generateSessions)({
        input: state.resolvedInput,
        classification: state.classification,
        planType: state.planTypeDecision.planType,
        curves: state.curves,
        weeklyStructures: state.weeklyStructures,
    });
    const plan = {
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
        returnToRunningState: (0, returnToRunning_1.buildReturnToRunningState)({
            input: state.resolvedInput,
            classification: state.classification,
            phasePlan: state.phasePlan,
            curves: state.curves,
        }),
    };
    plan.explanation = (0, explanationEngine_1.buildCoachExplanation)(plan);
    if ((state.safetyAdjustments?.length ?? 0) > 0) {
        plan.explanation.planWhy.push(...state.safetyAdjustments);
    }
    if ((state.modifierAdjustments?.length ?? 0) > 0) {
        plan.explanation.planWhy.push(...state.modifierAdjustments);
    }
    if (plan.returnToRunningState?.active) {
        plan.explanation.planWhy.push(...plan.returnToRunningState.reasons);
    }
    const issues = (0, validation_1.validateEnginePlan)(plan);
    plan.vNextValidation = (0, validatePlan_1.validateVNextPlan)(plan);
    if (issues.some((issue) => issue.severity === "critical")) {
        plan.explanation.weekWhy.push(`Validation flagged ${issues.length} issue(s), including at least one critical quality concern.`);
    }
    if ((plan.vNextValidation.warningCount ?? 0) > 0 || (plan.vNextValidation.hardFailCount ?? 0) > 0) {
        plan.explanation.weekWhy.push(`vNext validation reported ${plan.vNextValidation.hardFailCount} hard fail(s) and ${plan.vNextValidation.warningCount} warning(s).`);
    }
    plan.adaptationHooks = (0, buildAdaptationHooks_1.buildAdaptationHooks)(plan);
    plan.versionMetadata = (0, buildMutationHistory_1.buildBasePlanVersionMetadata)(plan);
    plan.mutationHistory = [];
    return plan;
}
function adaptBuiltPlanFromFeedback(plan, feedback) {
    return (0, adaptation_1.adaptPlanFromFeedback)(plan, feedback);
}
function updateBuiltPlanAfterFeedback(plan, feedback) {
    return (0, adaptation_1.updatePlanAfterFeedback)(plan, feedback);
}
