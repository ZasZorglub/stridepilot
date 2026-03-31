"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPlanExplanationPayload = buildPlanExplanationPayload;
exports.buildWeekExplanationPayload = buildWeekExplanationPayload;
exports.buildAdaptationExplanationPayload = buildAdaptationExplanationPayload;
function summarizeSessions(week) {
    return week.sessions.map((session) => ({
        day: session.day,
        role: session.role,
        family: session.family,
        durationMin: session.durationMin,
        isRaceEvent: session.isRaceEvent === true,
    }));
}
function buildPlanFacts(plan) {
    return [
        `Plan type: ${plan.planTypeDecision.planType}`,
        `Goal: ${plan.resolvedInput.goalType} for ${plan.resolvedInput.raceDistance}`,
        `Runner level: ${plan.classification.traits.runnerLevel}`,
        `Total weeks: ${plan.weeks.length}`,
        `Protected runner: ${Boolean(plan.adaptationHooks?.protectedRunner)}`,
        `Long run progression: ${plan.curves.longRunCurve[0]} -> ${Math.max(...plan.curves.longRunCurve)}`,
    ];
}
function buildWeekFacts(plan, week) {
    return [
        `Week ${week.weekIndex} is in phase ${week.phase}`,
        `Week focus: ${week.focus}`,
        `Session count: ${week.sessions.length}`,
        `Quality sessions: ${week.sessions.filter((session) => session.role === "quality").length}`,
        `Long run target: ${week.longRunTargetMin}`,
        `Protected runner: ${Boolean(plan.adaptationHooks?.protectedRunner)}`,
    ];
}
function buildAdaptationFacts(result) {
    return [
        `Decision action: ${result.decision.action}`,
        `Mutation type: ${result.mutation.mutationType}`,
        `Applied: ${result.applied}`,
        `Fallback: ${result.fallback}`,
        `Protected runner: ${result.originalPlanMeta.protectedRunner}`,
        `Version transition: ${result.historyEntry.sourceVersionNumber} -> ${result.historyEntry.resultingVersionNumber}`,
    ];
}
function buildPlanExplanationPayload(plan) {
    return {
        kind: "plan_summary",
        runnerContext: {
            raceDistance: plan.resolvedInput.raceDistance,
            goalType: plan.resolvedInput.goalType,
            planType: plan.planTypeDecision.planType,
            runnerLevel: plan.classification.traits.runnerLevel,
            protectedRunner: Boolean(plan.adaptationHooks?.protectedRunner),
            versionNumber: plan.versionMetadata?.versionNumber ?? 1,
        },
        progressionSummary: {
            totalWeeks: plan.weeks.length,
            sessionsPerWeekStart: plan.curves.sessionsPerWeekCurve[0] ?? plan.weeks[0]?.sessions.length ?? 0,
            sessionsPerWeekPeak: Math.max(...plan.curves.sessionsPerWeekCurve),
            longRunStartMin: plan.curves.longRunCurve[0] ?? 0,
            longRunPeakMin: Math.max(...plan.curves.longRunCurve),
            phaseSequence: [...new Set(plan.weeks.map((week) => week.phase))],
        },
        safetySummary: {
            returnToRunningActive: Boolean(plan.returnToRunningState?.active),
            validationWarnings: plan.vNextValidation?.warningCount ?? 0,
            validationHardFails: plan.vNextValidation?.hardFailCount ?? 0,
        },
        groundingFacts: buildPlanFacts(plan),
    };
}
function buildWeekExplanationPayload(plan, weekIndex) {
    const week = plan.weeks.find((entry) => entry.weekIndex === weekIndex);
    if (!week) {
        throw new Error(`Week ${weekIndex} was not found in plan.`);
    }
    return {
        kind: "week_summary",
        runnerContext: {
            planType: plan.planTypeDecision.planType,
            protectedRunner: Boolean(plan.adaptationHooks?.protectedRunner),
            versionNumber: plan.versionMetadata?.versionNumber ?? 1,
        },
        weekContext: {
            weekIndex: week.weekIndex,
            phase: week.phase,
            isCutback: week.isCutback,
            isRaceWeek: week.isRaceWeek,
            focus: week.focus,
            volumeTargetMin: week.volumeTargetMin,
            longRunTargetMin: week.longRunTargetMin,
            intensityTarget: week.intensityTarget,
            progressionGate: week.adaptationHooks?.progressionGate,
        },
        structureSummary: {
            sessionCount: week.sessions.length,
            qualityCount: week.sessions.filter((session) => session.role === "quality").length,
            sessionSummaries: summarizeSessions(week),
        },
        groundingFacts: buildWeekFacts(plan, week),
    };
}
function buildAdaptationExplanationPayload(result) {
    return {
        kind: "adaptation_summary",
        runnerContext: {
            planType: result.finalPlan.planTypeDecision.planType,
            protectedRunner: result.originalPlanMeta.protectedRunner,
            versionNumber: result.finalPlan.versionMetadata?.versionNumber ?? 1,
            isAdaptiveDerivative: result.finalPlan.versionMetadata?.isAdaptiveDerivative ?? false,
        },
        adaptationContext: {
            targetWeekIndex: result.feedback.targetWeekIndex,
            action: result.decision.action,
            applied: result.applied,
            fallback: result.fallback,
            mutationType: result.mutation.mutationType,
            conservativeBias: result.decision.conservativeBias,
            reasonCodes: result.decision.reasonCodes,
        },
        mutationSummary: {
            sourceVersionNumber: result.historyEntry.sourceVersionNumber,
            resultingVersionNumber: result.historyEntry.resultingVersionNumber,
            sourceWeekIndex: result.mutation.sourceWeekIndex,
            targetWeekIndex: result.mutation.targetWeekIndex,
            recoveryCandidateUsed: result.mutation.recoveryCandidateUsed,
        },
        validationSummary: {
            passed: result.finalValidation.passed,
            vNextWarningCount: result.finalValidation.vNextWarningCount,
            vNextHardFailCount: result.finalValidation.vNextHardFailCount,
            criticalIssueCount: result.finalValidation.criticalIssueCount,
        },
        groundingFacts: buildAdaptationFacts(result),
    };
}
