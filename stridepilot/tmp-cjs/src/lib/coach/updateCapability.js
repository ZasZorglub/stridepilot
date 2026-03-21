"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateCapability = updateCapability;
const capability_1 = require("./capability");
function clampScale(value) {
    return Math.max(0, Math.min(10, Math.round(value * 10) / 10));
}
function roundMetric(value) {
    return Math.max(0, Math.round(value * 10) / 10);
}
function updateCapability(capability, feedback) {
    let weeklyLoad = capability.weeklyLoad;
    let fatigueIndex = capability.fatigueIndex;
    let recoveryDebt = capability.recoveryDebt;
    let intervalTolerance = capability.intervalTolerance;
    let consistencyScore = capability.consistencyScore;
    if (feedback.difficulty === "easy")
        recoveryDebt -= 1;
    if (feedback.difficulty === "hard")
        recoveryDebt += 1;
    if (feedback.difficulty === "very_hard")
        recoveryDebt += 2;
    if (feedback.pain === "moderate")
        recoveryDebt += 2;
    if (feedback.pain === "high")
        recoveryDebt += 4;
    if (feedback.energy === "high")
        fatigueIndex -= 1;
    if (feedback.energy === "low")
        fatigueIndex += 1;
    if (feedback.completed)
        consistencyScore += 0.6;
    if (!feedback.completed)
        consistencyScore -= 1.4;
    if (feedback.difficulty === "easy" && feedback.completed)
        intervalTolerance += 0.4;
    if (feedback.difficulty === "hard")
        intervalTolerance -= 0.3;
    if (feedback.difficulty === "very_hard")
        intervalTolerance -= 0.6;
    if (feedback.pain === "moderate")
        intervalTolerance -= 0.5;
    if (feedback.pain === "high")
        intervalTolerance -= 1;
    if ((feedback.completionPct ?? 100) < 70)
        weeklyLoad *= 0.96;
    if ((feedback.adaptationFactor ?? 1) < 1)
        weeklyLoad *= feedback.adaptationFactor ?? 1;
    if ((feedback.adaptationFactor ?? 1) > 1 && feedback.completed && feedback.energy === "high") {
        weeklyLoad *= Math.min(1.03, feedback.adaptationFactor ?? 1);
    }
    recoveryDebt = clampScale(recoveryDebt);
    fatigueIndex = clampScale(fatigueIndex);
    intervalTolerance = clampScale(intervalTolerance);
    consistencyScore = clampScale(consistencyScore);
    if (recoveryDebt > 7) {
        weeklyLoad *= 0.8;
    }
    else if (recoveryDebt > 5) {
        weeklyLoad *= 0.9;
    }
    const recentFeedback = [
        ...capability.recentFeedback,
        {
            sessionId: feedback.sessionId,
            sessionKind: feedback.sessionKind ?? "other",
            runMinutes: Math.max(0, Math.round(feedback.runMinutes ?? 0)),
            completed: feedback.completed,
            difficulty: feedback.difficulty,
            energy: feedback.energy,
            pain: feedback.pain,
            completionPct: Math.max(0, Math.min(100, Math.round(feedback.completionPct ?? (feedback.completed ? 100 : 0)))),
            effort: Math.max(1, Math.min(10, Math.round(feedback.effort ?? (feedback.difficulty === "easy" ? 3 : feedback.difficulty === "moderate" ? 6 : feedback.difficulty === "hard" ? 8 : 9)))),
            adaptationFactor: feedback.adaptationFactor ?? 1,
            progressionPauseWeeks: Math.max(0, Math.round(feedback.progressionPauseWeeks ?? 0)),
            noteCaution: Boolean(feedback.noteCaution),
        },
    ].slice(-12);
    return {
        continuousRunMinutes: roundMetric(capability.continuousRunMinutes),
        longestRunMinutes: roundMetric(capability.longestRunMinutes),
        weeklyLoad: roundMetric(weeklyLoad),
        fatigueIndex,
        recoveryDebt,
        intervalTolerance: roundMetric(intervalTolerance),
        consistencyScore: roundMetric(consistencyScore),
        recentFeedback,
        traits: (0, capability_1.deriveRunnerTraits)(recentFeedback),
        lastAdaptationMode: capability.lastAdaptationMode,
        lastAdaptationReason: capability.lastAdaptationReason,
    };
}
