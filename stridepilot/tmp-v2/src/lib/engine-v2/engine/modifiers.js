"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyRunnerModifiers = applyRunnerModifiers;
function roundHundred(value) {
    return Math.round(value * 100) / 100;
}
function roundHalf(value) {
    return Math.round(value * 2) / 2;
}
function applyRunnerModifiers(params) {
    const reasons = [];
    let intensityFactor = 1;
    let volumeFactor = 1;
    let longRunFactor = 1;
    if (params.classification.traits.modifiers.includes("injury_sensitive") || params.classification.traits.modifiers.includes("conservative_bias")) {
        intensityFactor *= 0.95;
        volumeFactor *= 0.98;
        longRunFactor *= 0.98;
        reasons.push("Kurverne blev gjort en smule mere konservative på grund af skadehensyn eller en forsigtig træningsprofil.");
    }
    if (params.classification.traits.modifiers.includes("performance_bias") &&
        (params.input.goalType === "improve_time" || params.input.goalType === "target_time")) {
        intensityFactor *= 1.03;
        reasons.push("Intensitetskurven blev løftet en anelse for at matche et mere performance-orienteret mål.");
    }
    return {
        curves: {
            ...params.curves,
            intensityCurve: params.curves.intensityCurve.map((value) => roundHundred(Math.min(0.82, value * intensityFactor))),
            weeklyVolumeCurve: params.curves.weeklyVolumeCurve.map((value) => roundHalf(value * volumeFactor)),
            longRunCurve: params.curves.longRunCurve.map((value) => roundHalf(value * longRunFactor)),
        },
        reasons,
    };
}
