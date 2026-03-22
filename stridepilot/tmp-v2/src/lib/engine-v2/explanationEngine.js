"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCoachExplanation = buildCoachExplanation;
function buildCoachExplanation(plan) {
    const week1 = plan.weeks[0];
    const lastWeek = plan.weeks.at(-1);
    const longRunStart = plan.curves.longRunCurve[0];
    const longRunPeak = Math.max(...plan.curves.longRunCurve);
    return {
        planWhy: [
            ...plan.classification.reasons.slice(0, 1),
            ...plan.planTypeDecision.reasons.slice(0, 1),
            `Long run starts around ${longRunStart} min and peaks around ${longRunPeak} min, with cutbacks and taper built into the curve rather than added afterwards.`,
        ],
        weekWhy: [
            `Week 1 is a ${week1.phase} week with focus on ${week1.focus.toLowerCase()}.`,
            lastWeek ? `Final week is a ${lastWeek.phase} week, so load drops while some specificity stays in place.` : "Final week preserves freshness before goal day.",
        ],
    };
}
