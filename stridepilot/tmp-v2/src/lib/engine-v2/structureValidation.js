"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateProgressionCurves = validateProgressionCurves;
exports.validateWeeklyStructures = validateWeeklyStructures;
const DAY_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
function maxIncrease(values) {
    let max = 0;
    for (let i = 1; i < values.length; i += 1) {
        max = Math.max(max, values[i] - values[i - 1]);
    }
    return max;
}
function maxIncreaseRatio(values) {
    let max = 0;
    for (let i = 1; i < values.length; i += 1) {
        const previous = values[i - 1];
        if (previous <= 0)
            continue;
        max = Math.max(max, (values[i] - previous) / previous);
    }
    return max;
}
function validateProgressionCurves(curves, classification) {
    const issues = [];
    if (curves.longRunCurve.length >= 10 && curves.cutbackWeeks.length === 0) {
        issues.push({ severity: "important", area: "progression", message: "Longer plan has no cutback in the curve layer." });
    }
    if (curves.taperWeeks.length > 0) {
        const taperStart = curves.taperWeeks[0] - 1;
        const preTaperVolume = taperStart > 0 ? curves.weeklyVolumeCurve[taperStart - 1] : curves.weeklyVolumeCurve[taperStart];
        const taperVolume = curves.weeklyVolumeCurve.at(-1) ?? 0;
        if (taperVolume >= preTaperVolume * 0.9) {
            issues.push({ severity: "important", area: "progression", message: "Taper does not reduce weekly volume enough." });
        }
    }
    if (classification.traits.runnerLevel === "true_beginner" || classification.traits.runnerLevel === "beginner_plus") {
        const earlyIntensity = Math.max(...curves.intensityCurve.slice(0, Math.min(4, curves.intensityCurve.length)));
        if (earlyIntensity > 0.32) {
            issues.push({ severity: "critical", area: "safety", message: "Beginner intensity rises too high too early." });
        }
    }
    if (maxIncrease(curves.longRunCurve) > 18) {
        issues.push({ severity: "important", area: "progression", message: "Long run curve jumps too aggressively between weeks." });
    }
    if (maxIncreaseRatio(curves.weeklyVolumeCurve) > 0.085) {
        issues.push({ severity: "important", area: "progression", message: "Weekly volume curve jumps more than the engine's safe progression band." });
    }
    return issues;
}
function validateWeeklyStructures(structures, classification) {
    const issues = [];
    for (const structure of structures) {
        const longRunSlots = structure.slots.filter((slot) => slot.role === "long_run");
        if (longRunSlots.length !== 1) {
            issues.push({ severity: "critical", area: "structure", message: `Week ${structure.weekIndex} does not have exactly one long-run slot.` });
        }
        if (structure.totalRuns <= 2 && structure.qualityDays.length > 1) {
            issues.push({ severity: "important", area: "structure", message: `Low-frequency week ${structure.weekIndex} is overloaded with quality.` });
        }
        if ((classification.traits.runnerLevel === "true_beginner" || classification.traits.runnerLevel === "beginner_plus") && structure.intensityTarget > 0.35 && structure.phase === "base") {
            issues.push({ severity: "important", area: "safety", message: `Beginner-oriented week ${structure.weekIndex} carries too much early intensity.` });
        }
        const recoverySlot = structure.slots.find((slot) => slot.role === "recovery");
        const longRunSlot = structure.slots.find((slot) => slot.role === "long_run");
        if (recoverySlot && longRunSlot) {
            const recoveryDay = DAY_ORDER.indexOf(recoverySlot.day);
            const longRunDay = DAY_ORDER.indexOf(longRunSlot.day);
            if (recoveryDay > longRunDay) {
                issues.push({ severity: "important", area: "structure", message: `Week ${structure.weekIndex} places recovery after the long run instead of before it.` });
            }
        }
        if (structure.longRunTargetMin >= structure.weeklyVolumeTargetMin * 0.72) {
            issues.push({ severity: "minor", area: "structure", message: `Week ${structure.weekIndex} is too dominated by the long run relative to total weekly volume.` });
        }
    }
    return issues;
}
