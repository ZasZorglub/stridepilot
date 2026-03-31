"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyReturnToRunningCaps = applyReturnToRunningCaps;
function roundHalf(value) {
    return Math.round(value * 2) / 2;
}
function capGrowth(curve, maxRatio, protectedWeeks) {
    if (curve.length === 0)
        return curve;
    const adjusted = [...curve];
    for (let index = 1; index < adjusted.length; index += 1) {
        const weekIndex = index + 1;
        if (protectedWeeks.has(weekIndex))
            continue;
        const previous = adjusted[index - 1];
        const maxAllowed = roundHalf(previous * (1 + maxRatio));
        if (adjusted[index] > maxAllowed)
            adjusted[index] = maxAllowed;
    }
    return adjusted;
}
function applyReturnToRunningCaps(params) {
    const active = params.input.goalType === "return_to_running" ||
        params.classification.traits.primaryRunnerType === "return_to_running";
    if (!active) {
        return { curves: params.curves, reasons: [] };
    }
    const protectedWeeks = new Set(params.phasePlan.weeks
        .filter((week) => week.isCutback || week.phase === "taper" || week.isRaceWeek)
        .map((week) => week.weekIndex));
    const weeklyVolumeCurve = capGrowth(params.curves.weeklyVolumeCurve, 0.06, protectedWeeks);
    const longRunCurve = capGrowth(params.curves.longRunCurve, 0.08, protectedWeeks).map((value, index) => {
        const weeklyVolume = weeklyVolumeCurve[index] ?? value;
        return roundHalf(Math.min(value, weeklyVolume * 0.32));
    });
    const continuousCurve = params.curves.continuousCurve.map((value, index, curve) => {
        if (index === 0)
            return value;
        const previous = curve[index - 1];
        return roundHalf(Math.min(value, previous + 2));
    });
    const sessionsPerWeekCurve = params.curves.sessionsPerWeekCurve.map((value, index) => {
        const weekIndex = index + 1;
        if (weekIndex <= 4)
            return Math.min(value, 2);
        return Math.min(value, 3);
    });
    const reasons = [
        "Return-to-running caps holder ugevolumen, langtur og frekvens nede, indtil runneren har bygget stabilitet igen.",
    ];
    return {
        curves: {
            ...params.curves,
            weeklyVolumeCurve,
            longRunCurve,
            continuousCurve,
            sessionsPerWeekCurve,
        },
        reasons,
    };
}
