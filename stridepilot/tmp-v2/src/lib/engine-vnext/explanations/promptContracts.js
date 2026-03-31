"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXPLANATION_IMMUTABILITY_RULES = void 0;
exports.buildPlanExplanationPromptContract = buildPlanExplanationPromptContract;
exports.buildWeekExplanationPromptContract = buildWeekExplanationPromptContract;
exports.buildAdaptationExplanationPromptContract = buildAdaptationExplanationPromptContract;
exports.EXPLANATION_IMMUTABILITY_RULES = [
    "Explain only the facts present in the payload.",
    "Do not invent or change session counts, workout families, durations, week numbers, or progression.",
    "Do not suggest different workouts, pacing structures, or load changes unless the payload explicitly says they happened.",
    "Treat the canonical plan object as immutable.",
    "If the payload shows a protected or conservative choice, explain why it is protective instead of overriding it.",
];
function baseSystemInstruction(kind) {
    return [
        "You are generating a user-facing coaching explanation for StridePilot.",
        "You are not allowed to plan training or modify the program.",
        `Your task is to explain the ${kind.replace("_", " ")} using only the provided payload.`,
        "If a detail is missing from the payload, leave it out rather than inventing it.",
    ].join(" ");
}
function buildPlanExplanationPromptContract(payload) {
    return {
        promptType: "plan_summary",
        systemInstruction: baseSystemInstruction("plan_summary"),
        outputGoals: [
            "Explain the overall plan shape in plain coaching language.",
            "Reflect any protected or conservative bias if present.",
            "Stay grounded in the provided progression and safety facts.",
        ],
        immutabilityRules: exports.EXPLANATION_IMMUTABILITY_RULES,
        payload,
    };
}
function buildWeekExplanationPromptContract(payload) {
    return {
        promptType: "week_summary",
        systemInstruction: baseSystemInstruction("week_summary"),
        outputGoals: [
            "Explain the purpose of this specific week.",
            "Reflect the actual week structure, including race week or cutback status if present.",
            "Do not add or remove sessions from the explanation.",
        ],
        immutabilityRules: exports.EXPLANATION_IMMUTABILITY_RULES,
        payload,
    };
}
function buildAdaptationExplanationPromptContract(payload) {
    return {
        promptType: "adaptation_summary",
        systemInstruction: baseSystemInstruction("adaptation_summary"),
        outputGoals: [
            "Explain what adaptive decision was made and why.",
            "Make it clear whether the change was applied, blocked, or fell back to a no-op.",
            "Explain protected-runner conservatism when it appears in the payload.",
        ],
        immutabilityRules: exports.EXPLANATION_IMMUTABILITY_RULES,
        payload,
    };
}
