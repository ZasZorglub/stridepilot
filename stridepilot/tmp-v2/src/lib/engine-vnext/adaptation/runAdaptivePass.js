"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runVNextAdaptivePass = runVNextAdaptivePass;
const validation_1 = require("../../engine-v2/validation");
const applyAdaptationDecision_1 = require("./applyAdaptationDecision");
const buildMutationHistory_1 = require("./buildMutationHistory");
const decideAdaptation_1 = require("./decideAdaptation");
const validatePlan_1 = require("../validators/validatePlan");
function buildPlanMeta(plan, targetWeekIndex) {
    return {
        totalWeeks: plan.weeks.length,
        protectedRunner: Boolean(plan.adaptationHooks?.protectedRunner),
        planType: plan.planTypeDecision.planType,
        targetWeekIndex,
    };
}
function summarizeValidation(plan) {
    const vNextValidation = plan.vNextValidation ?? (0, validatePlan_1.validateVNextPlan)(plan);
    const engineIssues = (0, validation_1.validateEnginePlan)(plan);
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
function runVNextAdaptivePass(plan, feedback) {
    const decision = (0, decideAdaptation_1.decideVNextAdaptation)(plan, feedback);
    const mutationResult = (0, applyAdaptationDecision_1.applyVNextAdaptationDecision)(plan, decision);
    const preliminaryPlan = mutationResult.plan;
    const finalValidation = summarizeValidation(preliminaryPlan);
    const historyEntry = (0, buildMutationHistory_1.buildAdaptiveHistoryEntry)({
        plan,
        feedback,
        decision,
        mutation: mutationResult.mutation,
        validation: finalValidation,
    });
    const finalPlan = (0, buildMutationHistory_1.applyAdaptiveVersioning)({
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
