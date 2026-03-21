"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInitialRunnerState = createInitialRunnerState;
exports.updateRunnerState = updateRunnerState;
function clampScale(value) {
    return Math.max(0, Math.min(10, Math.round(value * 10) / 10));
}
function createInitialRunnerState(capability) {
    const fatiguePenalty = capability.fatigueIndex >= 6 ? 1 : 0;
    const recoveryPenalty = capability.recoveryDebt >= 6 ? 1 : 0;
    return {
        capability,
        trainingMomentum: clampScale(capability.weeklyLoad >= 40 && capability.fatigueIndex <= 5 ? 5 : 4),
        consistency: clampScale(capability.consistencyScore),
        injuryRisk: clampScale(2 + recoveryPenalty + fatiguePenalty),
        confidence: clampScale(4 +
            (capability.continuousRunMinutes >= 20 ? 1 : 0) +
            (capability.recoveryDebt <= 2 ? 1 : 0) -
            fatiguePenalty),
    };
}
function updateRunnerState(previousState, feedback, capability) {
    let trainingMomentum = previousState.trainingMomentum;
    let consistency = previousState.consistency;
    let injuryRisk = previousState.injuryRisk;
    let confidence = previousState.confidence;
    if (feedback.completed) {
        consistency += 1;
    }
    else {
        consistency -= 2;
    }
    if (feedback.pain === "moderate")
        injuryRisk += 2;
    if (feedback.pain === "high")
        injuryRisk += 4;
    if (capability.recoveryDebt >= 6)
        injuryRisk += 1;
    if (capability.fatigueIndex >= 6)
        injuryRisk += 1;
    if (feedback.difficulty === "easy")
        confidence += 1;
    if (feedback.difficulty === "very_hard")
        confidence -= 1;
    if (feedback.energy === "high")
        confidence += 1;
    if (feedback.pain === "moderate")
        confidence -= 1;
    if (feedback.pain === "high")
        confidence -= 2;
    if (capability.weeklyLoad > previousState.capability.weeklyLoad && capability.fatigueIndex <= 5) {
        trainingMomentum += 1;
    }
    if (!feedback.completed) {
        trainingMomentum -= 1;
    }
    if (feedback.pain === "moderate") {
        trainingMomentum -= 1;
    }
    if (feedback.pain === "high") {
        trainingMomentum -= 2;
    }
    if (capability.fatigueIndex >= 6) {
        trainingMomentum -= 1;
    }
    return {
        capability,
        trainingMomentum: clampScale(trainingMomentum),
        consistency: clampScale(consistency),
        injuryRisk: clampScale(injuryRisk),
        confidence: clampScale(confidence),
    };
}
