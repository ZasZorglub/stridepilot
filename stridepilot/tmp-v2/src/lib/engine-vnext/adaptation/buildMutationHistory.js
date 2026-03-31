"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildBasePlanVersionMetadata = buildBasePlanVersionMetadata;
exports.buildAdaptiveHistoryEntry = buildAdaptiveHistoryEntry;
exports.applyAdaptiveVersioning = applyAdaptiveVersioning;
function normalizeToken(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
function buildBasePlanVersionMetadata(plan) {
    const goalDate = plan.resolvedInput.goalDate ?? plan.timelineRecommendation.finalGoalDate;
    const planId = normalizeToken([
        "stridepilot",
        plan.planTypeDecision.planType,
        plan.resolvedInput.raceDistance,
        plan.resolvedInput.startDate,
        goalDate,
        `${plan.weeks.length}w`,
    ].join("_"));
    return {
        planId,
        versionNumber: 1,
        isAdaptiveDerivative: false,
    };
}
function buildAdaptiveHistoryEntry(params) {
    const sourceVersionNumber = params.plan.versionMetadata?.versionNumber ?? 1;
    const resultingVersionNumber = params.mutation.applied ? sourceVersionNumber + 1 : sourceVersionNumber;
    return {
        entryId: `${params.plan.versionMetadata?.planId ?? "stridepilot_plan"}_v${sourceVersionNumber}_w${params.feedback.targetWeekIndex}_${params.mutation.mutationType}`,
        sourceVersionNumber,
        resultingVersionNumber,
        feedback: {
            targetWeekIndex: params.feedback.targetWeekIndex,
            sessionsCompleted: params.feedback.sessionsCompleted,
            sessionsPlanned: params.feedback.sessionsPlanned,
            fatigue: params.feedback.fatigue,
            painFlag: params.feedback.painFlag,
            confidence: params.feedback.confidence,
        },
        decision: params.decision,
        mutation: params.mutation,
        validation: params.validation,
        applied: params.mutation.applied,
        fallback: params.mutation.fallback,
    };
}
function applyAdaptiveVersioning(params) {
    const sourceVersion = params.originalPlan.versionMetadata ?? buildBasePlanVersionMetadata(params.originalPlan);
    const versionMetadata = params.historyEntry.applied
        ? {
            ...sourceVersion,
            versionNumber: params.historyEntry.resultingVersionNumber,
            derivedFromVersionNumber: params.historyEntry.sourceVersionNumber,
            lastMutationType: params.historyEntry.mutation.mutationType,
            lastMutationRef: params.historyEntry.entryId,
            isAdaptiveDerivative: true,
        }
        : {
            ...sourceVersion,
            lastMutationType: params.historyEntry.mutation.mutationType,
            lastMutationRef: params.historyEntry.entryId,
        };
    return {
        ...params.finalPlan,
        versionMetadata,
        mutationHistory: [...(params.originalPlan.mutationHistory ?? []), params.historyEntry],
    };
}
