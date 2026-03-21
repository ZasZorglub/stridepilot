"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAdaptationPayload = buildAdaptationPayload;
exports.factorFromFeedbackInsights = factorFromFeedbackInsights;
exports.applyAdaptiveGuardrails = applyAdaptiveGuardrails;
const duration_1 = require("./duration");
function avg(values) {
    if (values.length === 0)
        return null;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
}
function buildAdaptationPayload(params) {
    const { goal, runnerProfile, currentWeek, recentFeedback, runnerInsights } = params;
    return {
        goal: {
            distance: goal.distance,
            weeks: goal.weeks,
            startDate: goal.startDate,
            targetTime: goal.targetTime,
            availableTrainingDays: goal.availableTrainingDays,
        },
        runner: {
            experience: runnerProfile.runningExperience,
            activityLevel: runnerProfile.activityLevel,
            currentRunningAbility: runnerProfile.currentRunningAbility,
            firstName: runnerProfile.firstName,
            gender: runnerProfile.gender,
            userTrainingContext: runnerProfile.userTrainingContext,
            age: runnerProfile.age,
            weightKg: runnerProfile.weightKg,
            heightCm: runnerProfile.heightCm,
        },
        runnerInsights,
        progressionState: {
            currentWeek,
            programWeeks: goal.weeks,
            recentCompletionAvg: avg(recentFeedback.map((f) => f.completionPct)),
            recentPainAvg: avg(recentFeedback.map((f) => f.painLevel)),
            recentEnergyAvg: avg(recentFeedback.map((f) => f.energy)),
        },
        recentWorkoutHistory: recentFeedback,
    };
}
function factorFromFeedbackInsights(insights) {
    if (insights.adjustment === "insert_recovery")
        return insights.severity === "strong" ? 0.82 : 0.88;
    if (insights.adjustment === "reduce_load")
        return insights.severity === "strong" ? 0.86 : insights.severity === "moderate" ? 0.92 : 0.96;
    if (insights.adjustment === "increase_load")
        return insights.severity === "mild" ? 1.04 : 1.06;
    return 1;
}
function applyAdaptiveGuardrails(plan, recentFeedback) {
    if (recentFeedback.length === 0)
        return plan;
    const maxPain = Math.max(...recentFeedback.map((f) => f.painLevel));
    const minCompletion = Math.min(...recentFeedback.map((f) => f.completionPct));
    const minEnergy = Math.min(...recentFeedback.map((f) => f.energy));
    const recoveryBias = maxPain >= 7 || minCompletion < 50 || minEnergy <= 2;
    const guardedSessions = plan.sessions.map((session) => {
        const cappedLoad = recoveryBias ? Math.min(session.loadScore, 6) : session.loadScore;
        const steps = session.steps.map((step) => {
            if (!recoveryBias || step.type !== "run")
                return step;
            return {
                ...step,
                durationSec: (0, duration_1.normalizeStepDuration)(step.durationSec * 0.9),
            };
        });
        return {
            ...session,
            loadScore: cappedLoad,
            steps,
        };
    });
    const smoothedSessions = guardedSessions.map((session, index) => {
        if (index === 0)
            return session;
        const prev = guardedSessions[index - 1];
        const maxAllowed = prev.loadScore + 2;
        if (session.loadScore <= maxAllowed)
            return session;
        return {
            ...session,
            loadScore: maxAllowed,
        };
    });
    return {
        ...plan,
        sessions: smoothedSessions,
    };
}
