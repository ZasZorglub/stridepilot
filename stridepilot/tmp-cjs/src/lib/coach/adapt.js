"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.explainPlanAdjustment = void 0;
exports.adaptPlanFromFeedback = adaptPlanFromFeedback;
exports.createAdjustment = createAdjustment;
const explanations_1 = require("./explanations");
Object.defineProperty(exports, "explainPlanAdjustment", { enumerable: true, get: function () { return explanations_1.explainPlanAdjustment; } });
const explanations_2 = require("./explanations");
const adaptationMode_1 = require("./adaptationMode");
const adaptUpcomingSessions_1 = require("./adaptUpcomingSessions");
const capability_1 = require("./capability");
const updateCapability_1 = require("./updateCapability");
function hydrateCapabilityState(plan, capability) {
    const seed = capability ?? (0, capability_1.createInitialCapabilityState)(plan);
    return {
        ...seed,
        recentFeedback: seed.recentFeedback ?? [],
        traits: seed.traits ?? (0, capability_1.defaultRunnerTraits)(),
        lastAdaptationMode: seed.lastAdaptationMode ?? "hold",
        lastAdaptationReason: seed.lastAdaptationReason,
    };
}
function sessionKind(session) {
    if (!session)
        return "other";
    const text = `${session.title} ${session.notes ?? ""}`.toLowerCase();
    if (text.includes("interval") || text.includes("tempo"))
        return "quality";
    if (text.includes("lang") || text.includes("udholdenhed") || text.includes("long"))
        return "long";
    if (text.includes("easy") || text.includes("roligt") || text.includes("recovery") || text.includes("strides") || text.includes("run-walk"))
        return "easy";
    return "other";
}
function sessionRunMinutes(session) {
    if (!session)
        return 0;
    return Math.round(session.steps.filter((step) => step.type === "run").reduce((sum, step) => sum + step.durationSec, 0) / 60);
}
function adaptPlanFromFeedback(plan, feedback, capability) {
    const currentCapability = hydrateCapabilityState(plan, capability);
    const matchedSession = plan.sessions.find((session) => session.id === feedback.sessionId);
    const enrichedFeedback = {
        ...feedback,
        sessionKind: feedback.sessionKind ?? sessionKind(matchedSession),
        runMinutes: feedback.runMinutes ?? sessionRunMinutes(matchedSession),
    };
    const nextCapability = (0, updateCapability_1.updateCapability)(currentCapability, enrichedFeedback);
    const adaptationDecision = (0, adaptationMode_1.decideAdaptationMode)(nextCapability);
    const updatedPlan = (0, adaptUpcomingSessions_1.adaptUpcomingSessions)(plan, nextCapability, adaptationDecision);
    const nextWeek = Math.min(...plan.sessions.map((session) => session.week));
    const summarizeSession = (session) => ({
        title: session.title,
        loadScore: session.loadScore,
        runMinutes: Math.round(session.steps.filter((step) => step.type === "run").reduce((sum, step) => sum + step.durationSec, 0) / 60),
    });
    const rationale = (0, explanations_2.buildAdaptationRationale)({
        mode: adaptationDecision.mode,
        reason: adaptationDecision.reason,
        nextWeekBefore: plan.sessions.filter((session) => session.week === nextWeek).map(summarizeSession),
        nextWeekAfter: updatedPlan.sessions.filter((session) => session.week === nextWeek).map(summarizeSession),
        traits: nextCapability.traits,
    });
    return {
        capability: {
            ...nextCapability,
            lastAdaptationMode: adaptationDecision.mode,
            lastAdaptationReason: adaptationDecision.reason,
        },
        plan: updatedPlan,
        rationale,
    };
}
function createAdjustment(params) {
    return {
        id: `${params.weekNumber}-${params.sessionId ?? "week"}`,
        weekNumber: params.weekNumber,
        sessionId: params.sessionId,
        reason: params.reason,
        effect: params.effect,
        summary: (0, explanations_1.explainPlanAdjustment)({
            id: `${params.weekNumber}-${params.sessionId ?? "week"}`,
            weekNumber: params.weekNumber,
            sessionId: params.sessionId,
            reason: params.reason,
            effect: params.effect,
            summary: "",
        }),
    };
}
