"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateTrainingTrend = evaluateTrainingTrend;
function detectNumericTrend(values) {
    if (values.length < 3)
        return "stable";
    const recent = values.slice(-3);
    if (recent[0] < recent[1] && recent[1] < recent[2])
        return "rising";
    if (recent[0] > recent[1] && recent[1] > recent[2])
        return "falling";
    return "stable";
}
function painScore(pain) {
    if (pain === "high")
        return 3;
    if (pain === "moderate")
        return 2;
    if (pain === "mild")
        return 1;
    return 0;
}
function evaluateTrainingTrend(recentFeedback, recentCapability) {
    if (recentFeedback.length < 3 || recentCapability.length < 3) {
        return {
            fatigueTrend: "stable",
            loadTrend: "stable",
            painTrend: "stable",
        };
    }
    return {
        fatigueTrend: detectNumericTrend(recentCapability.map((entry) => entry.fatigueIndex)),
        loadTrend: detectNumericTrend(recentCapability.map((entry) => entry.weeklyLoad)),
        painTrend: detectNumericTrend(recentFeedback.map((entry) => painScore(entry.pain))),
    };
}
