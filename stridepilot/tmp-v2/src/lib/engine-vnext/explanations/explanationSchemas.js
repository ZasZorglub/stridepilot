"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.explanationJsonSchema = void 0;
exports.parseRenderedExplanation = parseRenderedExplanation;
function isTone(value) {
    return value === "calm" || value === "encouraging" || value === "analytical";
}
exports.explanationJsonSchema = {
    name: "stridepilot_explanation",
    schema: {
        type: "object",
        additionalProperties: false,
        required: ["title", "summary", "bullets", "tone"],
        properties: {
            title: { type: "string", minLength: 1, maxLength: 120 },
            summary: { type: "string", minLength: 1, maxLength: 600 },
            bullets: {
                type: "array",
                minItems: 2,
                maxItems: 4,
                items: { type: "string", minLength: 1, maxLength: 220 },
            },
            tone: { type: "string", enum: ["calm", "encouraging", "analytical"] },
            warnings: {
                type: "array",
                maxItems: 3,
                items: { type: "string", minLength: 1, maxLength: 220 },
            },
        },
    },
    strict: true,
};
function parseRenderedExplanation(value) {
    if (!value || typeof value !== "object")
        return null;
    const candidate = value;
    if (typeof candidate.title !== "string" || candidate.title.trim().length === 0)
        return null;
    if (typeof candidate.summary !== "string" || candidate.summary.trim().length === 0)
        return null;
    if (!Array.isArray(candidate.bullets) || candidate.bullets.length < 2 || candidate.bullets.length > 4)
        return null;
    if (!candidate.bullets.every((entry) => typeof entry === "string" && entry.trim().length > 0))
        return null;
    if (!isTone(candidate.tone))
        return null;
    if (candidate.warnings !== undefined &&
        (!Array.isArray(candidate.warnings) ||
            !candidate.warnings.every((entry) => typeof entry === "string" && entry.trim().length > 0))) {
        return null;
    }
    return {
        title: candidate.title,
        summary: candidate.summary,
        bullets: candidate.bullets,
        tone: candidate.tone,
        warnings: candidate.warnings,
    };
}
