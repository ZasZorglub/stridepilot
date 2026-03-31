"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInterpretation = createInterpretation;
function makeInterpretationId(feedback) {
    return `interp-${feedback.sessionId}`;
}
function difficultyCopy(feedback) {
    if (feedback.difficulty === "very_hard")
        return "passet så ud til at være meget krævende";
    if (feedback.difficulty === "hard")
        return "passet så ud til at være hårdere end ønsket";
    if (feedback.difficulty === "easy")
        return "passet så ud til at føles let";
    return "passet så ud til at ramme et moderat niveau";
}
function painCopy(feedback) {
    if (feedback.pain === "high")
        return "Du rapporterede høj smerte";
    if (feedback.pain === "moderate")
        return "Du rapporterede moderat smerte";
    if (feedback.pain === "mild")
        return "Du nævnte let ubehag";
    return null;
}
function capabilityReasoning(capability) {
    if (capability.recoveryDebt >= 6) {
        return "Jeg holder lidt ekstra igen, fordi kroppen ser ud til at have brug for mere restitution.";
    }
    if (capability.fatigueIndex >= 6) {
        return "Jeg holder næste skridt lidt roligere, så træthed ikke får lov at bygge sig op.";
    }
    if (capability.weeklyLoad > 0 && capability.consistencyScore >= 6) {
        return "Jeg læner mig mod en stabil progression, fordi din træning ser ud til at være godt på vej ind i rytme.";
    }
    return "Jeg holder planen rolig og forudsigelig, så du kan bygge videre med overskud.";
}
function suggestedAdjustmentSummary(adjustments) {
    const nextAdjustment = adjustments[0];
    if (!nextAdjustment)
        return undefined;
    return nextAdjustment.summary;
}
function buildMessage(feedback, adjustments) {
    const painMessage = painCopy(feedback);
    if (painMessage && adjustments[0]?.summary) {
        return `${painMessage}, så den næste del af planen bliver justeret lidt.`;
    }
    if (feedback.energy === "low" && adjustments[0]?.summary) {
        return "Du rapporterede lav energi, så den næste session bliver justeret lidt.";
    }
    if (adjustments[0]?.summary) {
        return `Jeg vurderer, at ${difficultyCopy(feedback)}, så den næste del af planen bliver justeret lidt.`;
    }
    if (painMessage) {
        return `${painMessage}, så jeg holder progressionen mere rolig lige nu.`;
    }
    if (feedback.energy === "low") {
        return "Du rapporterede lav energi, så jeg holder næste skridt mere roligt.";
    }
    return `Jeg vurderer, at ${difficultyCopy(feedback)}, så planen kan fortsætte i et roligt og realistisk tempo.`;
}
function createInterpretation(capability, feedback, adjustments) {
    return {
        id: makeInterpretationId(feedback),
        message: buildMessage(feedback, adjustments),
        reasoning: capabilityReasoning(capability),
        suggestedAdjustment: suggestedAdjustmentSummary(adjustments),
        createdAt: new Date().toISOString(),
    };
}
