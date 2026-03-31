"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildWeeklyLoadCurve = buildWeeklyLoadCurve;
exports.buildProgressionCurves = buildProgressionCurves;
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
function roundHalf(value) {
    return Math.round(value * 2) / 2;
}
function roundHundred(value) {
    return Math.round(value * 100) / 100;
}
function cutbackEvery(planType, runnerLevel) {
    if (runnerLevel === "true_beginner")
        return 3;
    if (runnerLevel === "beginner_plus")
        return 3;
    if (runnerLevel === "advanced")
        return 4;
    return 3;
}
function planLongRunMinimum(planType) {
    if (planType === "5k_finish" || planType === "5k_finish_no_walk")
        return 15;
    if (planType === "5k_improve" || planType === "5k_target_time")
        return 22;
    if (planType === "10k_finish")
        return 35;
    if (planType === "10k_improve" || planType === "10k_target_time")
        return 42;
    if (planType === "hm_finish")
        return 62;
    if (planType === "hm_improve" || planType === "hm_target_time")
        return 75;
    if (planType === "marathon_finish")
        return 95;
    if (planType === "marathon_improve" || planType === "marathon_target_time")
        return 105;
    return 20;
}
function baselineLongRunPeak(planType) {
    if (planType === "5k_finish" || planType === "5k_finish_no_walk")
        return 35;
    if (planType === "5k_improve" || planType === "5k_target_time")
        return 45;
    if (planType === "10k_finish")
        return 70;
    if (planType === "10k_improve" || planType === "10k_target_time")
        return 80;
    if (planType === "hm_finish")
        return 110;
    if (planType === "hm_improve" || planType === "hm_target_time")
        return 130;
    if (planType === "marathon_finish")
        return 160;
    if (planType === "marathon_improve" || planType === "marathon_target_time")
        return 175;
    return 60;
}
function isTrueBeginnerNoWalk(classification, planType) {
    return classification.traits.runnerLevel === "true_beginner" && (planType === "5k_finish" || planType === "5k_finish_no_walk");
}
function isContinuityBackboneFinishPlan(backboneSelection, planType) {
    return backboneSelection.type === "continuous_backbone" && (planType === "5k_finish" || planType === "5k_finish_no_walk" || planType === "10k_finish");
}
function longRunPeakAdjustment(input, classification) {
    const runnerLevelAdjustment = classification.traits.runnerLevel === "true_beginner"
        ? -0.08
        : classification.traits.runnerLevel === "beginner_plus"
            ? -0.04
            : classification.traits.runnerLevel === "intermediate"
                ? 0.03
                : classification.traits.runnerLevel === "advanced"
                    ? 0.06
                    : 0;
    const consistencyAdjustment = classification.traits.consistencyProfile === "high"
        ? 0.06
        : classification.traits.consistencyProfile === "stable"
            ? 0.03
            : classification.traits.consistencyProfile === "sporadic"
                ? -0.06
                : -0.02;
    const scheduleAdjustment = input.availableTrainingDays.length >= 5
        ? 0.05
        : input.availableTrainingDays.length >= 4
            ? 0.03
            : input.availableTrainingDays.length <= 2
                ? -0.08
                : 0;
    const styleAdjustment = classification.traits.trainingStyle === "performance"
        ? 0.05
        : classification.traits.trainingStyle === "conservative"
            ? -0.06
            : 0;
    const riskAdjustment = classification.traits.injuryRiskScore >= 55
        ? -0.12
        : classification.traits.injuryRiskScore >= 40
            ? -0.07
            : 0;
    return clamp(runnerLevelAdjustment + consistencyAdjustment + scheduleAdjustment + styleAdjustment + riskAdjustment, -0.15, 0.15);
}
function longRunStart(input, classification, planType) {
    if (classification.traits.runnerLevel === "true_beginner" && (planType === "5k_finish" || planType === "5k_finish_no_walk")) {
        return roundHalf(clamp(Math.max(input.longestRecentRunMin * 0.9, input.currentContinuousRunMin * 1.3, 15), 15, 18));
    }
    const planMinimum = planLongRunMinimum(planType);
    const readinessStart = Math.max(input.longestRecentRunMin * 0.9, input.currentContinuousRunMin * 1.3, planMinimum);
    const consistentBackgroundFloor = classification.traits.consistencyProfile === "high" || classification.traits.consistencyProfile === "stable"
        ? input.longestRecentRunMin * 0.98
        : input.longestRecentRunMin * 0.92;
    const finishFriendlyCap = planType.includes("marathon")
        ? 140
        : planType.includes("hm")
            ? 100
            : planType.includes("10k")
                ? 55
                : 38;
    const cautiousAdjustment = classification.traits.runnerLevel === "true_beginner"
        ? 0.94
        : classification.traits.runnerLevel === "beginner_plus"
            ? 0.98
            : classification.traits.trainingStyle === "conservative"
                ? 0.97
                : 1;
    return roundHalf(clamp(Math.max(readinessStart * cautiousAdjustment, consistentBackgroundFloor, planMinimum), planMinimum, finishFriendlyCap));
}
function longRunPeak(start, input, classification, planType, totalWeeks) {
    if (isTrueBeginnerNoWalk(classification, planType)) {
        const weekAdjustment = totalWeeks >= 14 ? 2 : totalWeeks <= 11 ? -2 : 0;
        return roundHalf(clamp(Math.max(35, start + 16 + weekAdjustment), 35, 40));
    }
    const baseline = baselineLongRunPeak(planType);
    const weekAdjustment = totalWeeks >= 18
        ? 0.05
        : totalWeeks >= 14
            ? 0.02
            : totalWeeks <= 10
                ? -0.08
                : 0;
    const adjustment = longRunPeakAdjustment(input, classification) + weekAdjustment;
    const adjustedBaseline = baseline * (1 + adjustment);
    const finishCap = baseline * 1.1;
    const improveCap = baseline * 1.15;
    const floor = baseline * 0.85;
    return roundHalf(clamp(Math.max(start + baseline * 0.18, adjustedBaseline), floor, planType.includes("improve") || planType.includes("target_time") ? improveCap : finishCap));
}
function beginnerNoWalkCutbackWeeks(totalWeeks, taperWeeks) {
    const activeWeeks = Math.max(totalWeeks - taperWeeks, 1);
    const weeks = [];
    if (activeWeeks >= 4)
        weeks.push(4);
    if (activeWeeks >= 7)
        weeks.push(7);
    if (activeWeeks >= 11)
        weeks.push(10);
    return weeks.filter((week) => week < activeWeeks);
}
function continuityBackboneCutbackWeeks(totalWeeks, taperWeeks, planType) {
    if (planType === "10k_finish") {
        const activeWeeks = Math.max(totalWeeks - taperWeeks, 1);
        const weeks = [];
        if (activeWeeks >= 4)
            weeks.push(4);
        if (activeWeeks >= 8)
            weeks.push(8);
        if (activeWeeks >= 12)
            weeks.push(12);
        return weeks.filter((week) => week < activeWeeks);
    }
    return beginnerNoWalkCutbackWeeks(totalWeeks, taperWeeks);
}
function beginnerSessionsPerWeekCurve(totalWeeks, taperWeeks) {
    const finalTaperStart = Math.max(totalWeeks - taperWeeks + 1, totalWeeks - 1);
    return Array.from({ length: totalWeeks }, (_, index) => {
        const weekIndex = index + 1;
        if (weekIndex <= 2)
            return 2;
        if (weekIndex >= finalTaperStart)
            return 2;
        return 3;
    });
}
function continuityBackboneSessionsPerWeekCurve(totalWeeks, taperWeeks, planType) {
    if (planType === "10k_finish") {
        const finalTaperStart = Math.max(totalWeeks - taperWeeks + 1, totalWeeks - 1);
        return Array.from({ length: totalWeeks }, (_, index) => {
            const weekIndex = index + 1;
            if (weekIndex <= 2)
                return 2;
            if (weekIndex >= finalTaperStart)
                return 2;
            return 3;
        });
    }
    return beginnerSessionsPerWeekCurve(totalWeeks, taperWeeks);
}
function smoothContinuousCurve(params) {
    const { start, peak, totalWeeks, taperWeeks, maxIncrease, cutbackWeeks, raceWeekFloor, taperFloor } = params;
    const activeWeeks = Math.max(totalWeeks - taperWeeks, 1);
    const cutbacks = new Set(cutbackWeeks.filter((week) => week <= activeWeeks));
    const curve = [];
    let current = roundHalf(start);
    let localPeak = current;
    for (let weekIndex = 1; weekIndex <= activeWeeks; weekIndex += 1) {
        if (weekIndex === 1) {
            curve.push(current);
            continue;
        }
        if (cutbacks.has(weekIndex)) {
            current = roundHalf(Math.max(start, localPeak - Math.min(maxIncrease, 2)));
            curve.push(current);
            continue;
        }
        const remainingBuildWeeks = Math.max(activeWeeks - weekIndex + 1, 1);
        const remainingToPeak = Math.max(peak - current, 0);
        const rawIncrease = remainingBuildWeeks <= 2 ? remainingToPeak : Math.max(0, remainingToPeak / remainingBuildWeeks);
        const cappedIncrease = Math.min(maxIncrease, rawIncrease);
        const shouldHold = weekIndex > 2 && (weekIndex + 1) % 4 === 0 && remainingToPeak > maxIncrease;
        current = roundHalf(Math.min(peak, current + (shouldHold ? 0 : cappedIncrease)));
        localPeak = Math.max(localPeak, current);
        curve.push(current);
    }
    if (taperWeeks <= 0)
        return curve;
    const taperCurve = [];
    for (let taperIndex = 0; taperIndex < taperWeeks; taperIndex += 1) {
        const isRaceWeek = taperIndex === taperWeeks - 1;
        const base = isRaceWeek
            ? Math.max(raceWeekFloor, roundHalf(localPeak * 0.72))
            : Math.max(taperFloor, roundHalf(localPeak * (taperIndex === 0 ? 0.88 : 0.78)));
        taperCurve.push(base);
    }
    return [...curve, ...taperCurve].slice(0, totalWeeks);
}
function buildBlockLongRunCurve(params) {
    const { start, peak, totalWeeks, taperWeeks, cutbackWeeks, cutbackFactor, minIncrease, maxIncrease, raceWeekFloor } = params;
    const activeWeeks = Math.max(totalWeeks - taperWeeks, 1);
    const cutbacks = new Set(cutbackWeeks.filter((week) => week <= activeWeeks));
    const curve = [];
    let current = roundHalf(start);
    let previousPeak = current;
    for (let weekIndex = 1; weekIndex <= activeWeeks; weekIndex += 1) {
        if (weekIndex === 1) {
            curve.push(current);
            continue;
        }
        if (cutbacks.has(weekIndex)) {
            current = roundHalf(Math.max(start, previousPeak * cutbackFactor));
            curve.push(current);
            continue;
        }
        const remainingBuildWeeks = Math.max(activeWeeks - weekIndex + 1, 1);
        const remainingToPeak = Math.max(peak - current, 0);
        const guidedIncrease = remainingBuildWeeks <= 2 ? remainingToPeak : remainingToPeak / remainingBuildWeeks;
        const nextIncrease = clamp(guidedIncrease, minIncrease, maxIncrease);
        current = roundHalf(Math.min(peak, current + nextIncrease));
        previousPeak = Math.max(previousPeak, current);
        curve.push(current);
    }
    if (taperWeeks <= 0)
        return curve;
    const taperCurve = [];
    for (let taperIndex = 0; taperIndex < taperWeeks; taperIndex += 1) {
        if (taperIndex === taperWeeks - 1) {
            taperCurve.push(roundHalf(Math.max(raceWeekFloor, previousPeak * 0.55)));
            continue;
        }
        taperCurve.push(roundHalf(Math.max(start, previousPeak * (taperIndex === 0 ? 0.8 : 0.68))));
    }
    return [...curve, ...taperCurve].slice(0, totalWeeks);
}
function buildIntervalDurationCurve(weeks, goalType, runnerLevel) {
    const beginner = runnerLevel === "true_beginner" || runnerLevel === "beginner_plus";
    const targetLike = goalType === "target_time";
    const improveLike = goalType === "improve_time";
    return weeks.map((week) => {
        if (week.isRaceWeek)
            return targetLike ? 2 : 3;
        if (week.phase === "taper")
            return targetLike ? 3 : 2;
        if (week.phase === "base")
            return beginner ? 1 : 2;
        if (week.phase === "build") {
            return week.phaseProgress >= 0.6 ? (improveLike || targetLike ? 5 : 4) : 3;
        }
        if (week.phase === "specific") {
            if (targetLike)
                return week.phaseProgress >= 0.6 ? 10 : 8;
            if (improveLike)
                return week.phaseProgress >= 0.6 ? 8 : 6;
            return 5;
        }
        if (week.phase === "peak") {
            return targetLike ? 8 : improveLike ? 6 : 4;
        }
        return 3;
    });
}
function weeklyVolumeStart(input, longRunStartMin, planType) {
    const fromKm = input.currentWeeklyVolumeKm * 6;
    const fromFrequency = input.currentWeeklyRuns * Math.max(18, input.typicalAvailableTimeMin * 0.55);
    const ratioFloor = planType.includes("improve") || planType.includes("target_time") ? 2.9 : planType.includes("marathon") || planType.includes("hm") ? 2.8 : 2.6;
    return roundHalf(clamp(Math.max(fromKm, fromFrequency, longRunStartMin * ratioFloor), 40, 360));
}
function weeklyVolumePeak(longRunPeakMin, input, classification, planType) {
    const ratio = planType.includes("improve") || planType.includes("target_time")
        ? input.raceDistance === "Marathon"
            ? 3.35
            : input.raceDistance === "HalfMarathon"
                ? 3.2
                : 3
        : input.raceDistance === "Marathon"
            ? 3
            : input.raceDistance === "HalfMarathon"
                ? 2.9
                : 2.7;
    const styleAdjustment = classification.traits.trainingStyle === "performance" ? 1.04 : classification.traits.trainingStyle === "conservative" ? 0.94 : 1;
    return roundHalf(clamp(longRunPeakMin * ratio * styleAdjustment, longRunPeakMin * 2.5, 420));
}
function loadGrowthRange(runnerLevel, goalType) {
    const performanceGoal = goalType === "improve_time" || goalType === "target_time";
    if (runnerLevel === "true_beginner")
        return { minimum: 0.05, maximum: 0.06 };
    if (runnerLevel === "beginner_plus" || runnerLevel === "recreational") {
        return performanceGoal ? { minimum: 0.06, maximum: 0.075 } : { minimum: 0.055, maximum: 0.07 };
    }
    if (runnerLevel === "intermediate")
        return { minimum: 0.06, maximum: 0.08 };
    return { minimum: 0.065, maximum: 0.08 };
}
function loadStepBackFactor(runnerLevel) {
    if (runnerLevel === "true_beginner")
        return 0.82;
    if (runnerLevel === "beginner_plus" || runnerLevel === "recreational")
        return 0.8;
    if (runnerLevel === "intermediate")
        return 0.78;
    return 0.76;
}
function taperLoadFactors(runnerLevel, totalTaperWeeks, taperWeekIndex) {
    if (runnerLevel === "advanced" && totalTaperWeeks >= 3) {
        return [0.84, 0.7, 0.56][Math.min(taperWeekIndex, 2)] ?? 0.56;
    }
    if (totalTaperWeeks <= 1)
        return runnerLevel === "true_beginner" ? 0.64 : 0.68;
    if (totalTaperWeeks === 2) {
        return taperWeekIndex === 0
            ? runnerLevel === "true_beginner"
                ? 0.74
                : 0.78
            : runnerLevel === "true_beginner"
                ? 0.56
                : 0.6;
    }
    return [0.8, 0.68, 0.56][Math.min(taperWeekIndex, 2)] ?? 0.56;
}
function buildWeeklyLoadCurve(params) {
    const { weeks, startLoad, runnerLevel, goalType } = params;
    const { minimum, maximum } = loadGrowthRange(runnerLevel, goalType);
    const stepBackInterval = runnerLevel === "advanced" ? 4 : 3;
    const stepBackFactor = loadStepBackFactor(runnerLevel);
    const totalTaperWeeks = weeks.filter((week) => week.phase === "taper" && !week.isRaceWeek).length;
    const raceWeekFactor = runnerLevel === "true_beginner" ? 0.42 : runnerLevel === "advanced" ? 0.46 : 0.44;
    const loads = [];
    let current = roundHalf(startLoad);
    let preTaperPeak = current;
    let taperWeekCounter = 0;
    for (const week of weeks) {
        if (week.weekIndex === 1) {
            loads.push(current);
            preTaperPeak = Math.max(preTaperPeak, current);
            continue;
        }
        const isStepBack = !week.isRaceWeek && week.phase !== "taper" && week.phase !== "peak" && week.weekIndex > 1 && week.weekIndex % stepBackInterval === 0;
        if (week.isRaceWeek) {
            current = roundHalf(Math.max(startLoad * 0.75, preTaperPeak * raceWeekFactor));
            loads.push(current);
            continue;
        }
        if (week.phase === "taper") {
            const factor = taperLoadFactors(runnerLevel, totalTaperWeeks, taperWeekCounter);
            current = roundHalf(Math.max(startLoad * 0.9, preTaperPeak * factor));
            taperWeekCounter += 1;
            loads.push(current);
            continue;
        }
        if (isStepBack) {
            current = roundHalf(Math.max(startLoad, preTaperPeak * stepBackFactor));
            loads.push(current);
            continue;
        }
        const midpoint = (minimum + maximum) / 2;
        const phaseAdjustment = week.phase === "base"
            ? -0.008
            : week.phase === "build"
                ? 0.004
                : week.phase === "specific"
                    ? -0.003
                    : week.phase === "peak"
                        ? -0.012
                        : 0;
        const progressAdjustment = (week.phaseProgress - 0.5) * 0.01;
        const growth = clamp(midpoint + phaseAdjustment + progressAdjustment, minimum, maximum);
        current = roundHalf(current * (1 + growth));
        preTaperPeak = Math.max(preTaperPeak, current);
        loads.push(current);
    }
    return loads;
}
function intensityForPhase(phase, planType, classification) {
    const base = phase === "base"
        ? 0.1
        : phase === "build"
            ? 0.2
            : phase === "specific"
                ? 0.32
                : phase === "peak"
                    ? 0.4
                    : 0.18;
    const performanceBonus = planType.includes("improve") ? 0.06 : planType.includes("target_time") ? 0.1 : 0;
    const finishPenalty = planType.includes("finish") ? 0.03 : 0;
    const beginnerPenalty = classification.traits.runnerLevel === "true_beginner" ? 0.16 : classification.traits.runnerLevel === "beginner_plus" ? 0.08 : 0;
    const styleBonus = classification.traits.trainingStyle === "performance" ? 0.06 : classification.traits.trainingStyle === "conservative" ? -0.04 : 0;
    return clamp(base + performanceBonus + styleBonus - beginnerPenalty - finishPenalty, 0.06, 0.62);
}
function continuousRunPeak(input, planType) {
    const current = input.currentContinuousRunMin;
    if (input.goalType === "return_to_running")
        return Math.max(18, current + 12);
    if (planType === "5k_finish" || planType === "5k_finish_no_walk")
        return 30;
    if (planType === "10k_finish")
        return 60;
    if (planType === "hm_finish")
        return 80;
    if (planType === "marathon_finish")
        return Math.max(current, 90);
    if (current <= 1)
        return input.raceDistance === "5K" ? 24 : input.raceDistance === "10K" ? 34 : 40;
    if (current <= 5)
        return input.raceDistance === "5K" ? 30 : input.raceDistance === "10K" ? 45 : 55;
    if (current <= 12)
        return input.raceDistance === "5K" ? 30 : input.raceDistance === "10K" ? 50 : 60;
    if (current >= 25)
        return current;
    return input.raceDistance === "5K" ? 30 : input.raceDistance === "10K" ? 50 : 70;
}
function buildContinuousMilestones(current, peak) {
    if (current <= 1 && peak <= 30)
        return [2, 3, 5, 8, 10, 12, 15, 18, 22, 26, 30].filter((value) => value <= peak);
    const standard = [5, 10, 15, 20, 25, 30, 40, 50, 60, 80];
    const milestones = standard.filter((value) => value > current && value <= peak);
    if (milestones.length === 0 && peak > current)
        return [peak];
    if (milestones.at(-1) !== peak)
        milestones.push(peak);
    return milestones;
}
function continuousMilestoneFractions(current, milestoneCount) {
    if (milestoneCount <= 1)
        return [0.72];
    if (current <= 1)
        return [0.08, 0.16, 0.24, 0.38, 0.5, 0.6, 0.7, 0.8, 0.88, 0.94, 0.98].slice(0, milestoneCount);
    if (current <= 5)
        return [0.12, 0.28, 0.44, 0.6, 0.76, 0.88].slice(0, milestoneCount);
    if (current <= 20)
        return [0.08, 0.18, 0.3, 0.42, 0.5, 0.72].slice(0, milestoneCount);
    return [0.12, 0.26, 0.42, 0.58, 0.74, 0.86].slice(0, milestoneCount);
}
function continuousRunTarget(input, planType, phase, weekIndex, totalWeeks, taperWeeks) {
    const current = input.currentContinuousRunMin;
    if (current >= 25 && input.goalType !== "return_to_running")
        return current;
    const peak = continuousRunPeak(input, planType);
    const activeWeeks = Math.max(totalWeeks - taperWeeks, 1);
    const milestones = buildContinuousMilestones(current, peak);
    const fractions = continuousMilestoneFractions(current, milestones.length);
    let target = current;
    milestones.forEach((milestone, index) => {
        const fraction = fractions[index] ?? fractions.at(-1) ?? 0.8;
        const milestoneWeek = Math.max(1, Math.round(1 + (activeWeeks - 1) * fraction));
        if (weekIndex >= milestoneWeek)
            target = milestone;
    });
    if ((planType === "5k_finish" || planType === "5k_finish_no_walk") && current <= 1)
        return roundHalf(clamp(target, current, peak));
    if (phase === "taper")
        return roundHalf(Math.max(current, peak * 0.9, target));
    return roundHalf(clamp(target, current, peak));
}
function specificityForPhase(phase, planType) {
    const base = phase === "base" ? 0.08 : phase === "build" ? 0.22 : phase === "specific" ? 0.52 : phase === "peak" ? 0.78 : 0.46;
    const performanceBonus = planType.includes("improve") || planType.includes("target_time") ? 0.08 : 0;
    return clamp(base + performanceBonus, 0.05, 0.92);
}
function densityForPhase(phase, classification) {
    const base = phase === "base" ? 0.62 : phase === "build" ? 0.72 : phase === "specific" ? 0.78 : phase === "peak" ? 0.82 : 0.66;
    const recoveryPenalty = classification.traits.recoveryNeed * 0.2;
    return clamp(base - recoveryPenalty, 0.45, 0.9);
}
function longRunCutbackFactor(planType) {
    if (planType === "5k_finish" || planType === "5k_finish_no_walk")
        return 0.88;
    if (planType.includes("marathon"))
        return 0.88;
    if (planType.includes("hm"))
        return 0.88;
    if (planType.includes("finish"))
        return 0.9;
    return 0.9;
}
function taperCurve(totalTaperWeeks, taperWeekIndex) {
    if (totalTaperWeeks <= 1) {
        return { volumeFactor: 0.65, longRunFactor: 0.68 };
    }
    if (totalTaperWeeks === 2) {
        return taperWeekIndex === 0 ? { volumeFactor: 0.82, longRunFactor: 0.78 } : { volumeFactor: 0.64, longRunFactor: 0.62 };
    }
    const curve = [
        { volumeFactor: 0.84, longRunFactor: 0.8 },
        { volumeFactor: 0.72, longRunFactor: 0.7 },
        { volumeFactor: 0.6, longRunFactor: 0.62 },
    ];
    return curve[Math.min(taperWeekIndex, curve.length - 1)] ?? curve.at(-1);
}
function raceWeekAdjustments(planType) {
    if (planType === "5k_finish" || planType === "5k_finish_no_walk") {
        return { volumeFactor: 0.58, longRunFactor: 0.66, intensityFactor: 0.58 };
    }
    if (planType.includes("improve") || planType.includes("target_time")) {
        return { volumeFactor: 0.52, longRunFactor: 0.54, intensityFactor: 0.74 };
    }
    return { volumeFactor: 0.56, longRunFactor: 0.58, intensityFactor: 0.62 };
}
function primaryDimension(phase, weekIndex, isCutback, intensity, classification, planType, backboneSelection) {
    if (isCutback)
        return "stabilize";
    if (backboneSelection.type === "continuous_backbone") {
        if (phase === "base")
            return weekIndex % 2 === 0 ? "long_run" : "continuous_running";
        if (phase === "build")
            return weekIndex % 3 === 0 ? "long_run" : "continuous_running";
        if (phase === "specific")
            return "continuous_running";
        return "stabilize";
    }
    if (classification.traits.runnerLevel === "true_beginner" && (planType === "5k_finish" || planType === "5k_finish_no_walk")) {
        if (phase === "base")
            return weekIndex % 2 === 0 ? "long_run" : "continuous_running";
        if (phase === "build" || phase === "specific")
            return "long_run";
        return "stabilize";
    }
    if (planType === "marathon_finish") {
        if (phase === "base")
            return weekIndex <= 2 ? "weekly_volume" : "long_run";
        if (phase === "build" || phase === "specific" || phase === "peak")
            return "long_run";
        return "stabilize";
    }
    if (classification.traits.runnerLevel === "true_beginner" || classification.traits.runnerLevel === "beginner_plus") {
        if (phase === "base")
            return "continuous_running";
        if (phase === "build")
            return weekIndex % 2 === 0 ? "continuous_running" : "long_run";
        if (phase === "specific")
            return "long_run";
    }
    if (phase === "base")
        return "weekly_volume";
    if (phase === "build")
        return weekIndex % 2 === 0 ? "long_run" : "weekly_volume";
    if (phase === "specific" || phase === "peak")
        return intensity >= 0.42 ? "intensity" : "long_run";
    return "stabilize";
}
function growthCap(primary, previous, proposed, planType) {
    if (primary === "continuous_running") {
        const factor = previous < 10 ? 1.75 : previous < 20 ? 1.45 : previous < 30 ? 1.28 : 1.18;
        const minimumIncrease = previous < 10 ? 3 : previous < 20 ? 3.5 : previous < 30 ? 3 : 2;
        if (proposed <= previous)
            return proposed;
        if (proposed - previous >= minimumIncrease) {
            return Math.max(Math.min(proposed, previous * factor), previous + minimumIncrease);
        }
        return Math.min(proposed, previous * factor);
    }
    if (primary === "long_run") {
        if (proposed <= previous)
            return proposed;
        const factor = planType === "5k_finish" || planType === "5k_finish_no_walk"
            ? 1.18
            : planType === "10k_finish"
                ? 1.09
                : planType?.includes("improve") || planType?.includes("target_time")
                    ? 1.08
                    : 1.07;
        const minimumIncrease = planType === "5k_finish" || planType === "5k_finish_no_walk"
            ? previous < 20
                ? 3
                : previous < 30
                    ? 3.5
                    : 3
            : planType === "10k_finish"
                ? previous < 40
                    ? 3
                    : 3.5
                : previous < 30
                    ? 2
                    : previous < 60
                        ? 2.5
                        : 3.5;
        if (proposed - previous >= minimumIncrease) {
            return Math.max(Math.min(proposed, previous * factor), previous + minimumIncrease);
        }
        return Math.min(proposed, previous * factor);
    }
    if (primary === "weekly_volume") {
        if (proposed <= previous)
            return proposed;
        const factor = 1.08;
        const minimumIncrease = previous < 100 ? 8 : previous < 200 ? 10 : 12;
        if (proposed - previous >= minimumIncrease) {
            return Math.max(Math.min(proposed, previous * factor), previous + minimumIncrease);
        }
        return Math.min(proposed, previous * factor);
    }
    const factor = primary === "intensity"
        ? 1.1
        : 1.04;
    return Math.min(proposed, previous * factor);
}
function buildProgressionCurves(input, classification, goalClassification, backboneSelection, phasePlan, planType) {
    const beginnerNoWalk = backboneSelection.type === "continuous_backbone" && isTrueBeginnerNoWalk(classification, planType);
    const continuityBackboneFinish = isContinuityBackboneFinishPlan(backboneSelection, planType);
    const longStart = longRunStart(input, classification, planType);
    const longPeak = longRunPeak(longStart, input, classification, planType, phasePlan.totalWeeks);
    const volumeStart = weeklyVolumeStart(input, longStart, planType);
    const volumePeak = weeklyVolumePeak(longPeak, input, classification, planType);
    const interval = cutbackEvery(planType, classification.traits.runnerLevel);
    const totalTaperWeeks = phasePlan.weeks.filter((week) => week.phase === "taper" && !week.isRaceWeek).length;
    const continuityCutbacks = new Set(continuityBackboneFinish ? continuityBackboneCutbackWeeks(phasePlan.totalWeeks, totalTaperWeeks, planType) : []);
    const continuityLongRunCurve = continuityBackboneFinish
        ? buildBlockLongRunCurve({
            start: longStart,
            peak: longPeak,
            totalWeeks: phasePlan.totalWeeks,
            taperWeeks: totalTaperWeeks,
            cutbackWeeks: continuityBackboneCutbackWeeks(phasePlan.totalWeeks, totalTaperWeeks, planType),
            cutbackFactor: 0.84,
            minIncrease: planType === "10k_finish" ? 3 : 2,
            maxIncrease: planType === "10k_finish" ? 6 : 4,
            raceWeekFloor: planType === "10k_finish" ? 24 : 16,
        })
        : [];
    const continuityContinuousCurve = continuityBackboneFinish
        ? smoothContinuousCurve({
            start: Math.max(1, input.currentContinuousRunMin),
            peak: continuousRunPeak(input, planType),
            totalWeeks: phasePlan.totalWeeks,
            taperWeeks: totalTaperWeeks,
            maxIncrease: planType === "10k_finish" ? 3 : 2.5,
            cutbackWeeks: continuityBackboneCutbackWeeks(phasePlan.totalWeeks, totalTaperWeeks, planType),
            raceWeekFloor: planType === "10k_finish" ? 24 : 14,
            taperFloor: planType === "10k_finish" ? 35 : 18,
        })
        : [];
    const sessionsPerWeekCurve = continuityBackboneFinish
        ? continuityBackboneSessionsPerWeekCurve(phasePlan.totalWeeks, totalTaperWeeks, planType)
        : Array.from({ length: phasePlan.totalWeeks }, () => input.availableTrainingDays.length);
    const targetWeeklyLoadCurve = buildWeeklyLoadCurve({
        weeks: phasePlan.weeks,
        startLoad: volumeStart,
        runnerLevel: classification.traits.runnerLevel,
        goalType: input.goalType,
    });
    const longRunCurve = [];
    const weeklyVolumeCurve = [];
    const intervalDurationCurve = buildIntervalDurationCurve(phasePlan.weeks, input.goalType, classification.traits.runnerLevel);
    const intensityCurve = [];
    const continuousCurve = [];
    const specificityCurve = [];
    const densityCurve = [];
    const primaryLoadDimension = [];
    const cutbackWeeks = [];
    const taperWeeks = [];
    let previousLongRun = longStart;
    let previousVolume = volumeStart;
    let previousIntensity = intensityForPhase(phasePlan.weeks[0]?.phase ?? "base", planType, classification);
    let previousContinuous = Math.max(input.currentContinuousRunMin, beginnerNoWalk ? 0 : 1);
    for (const week of phasePlan.weeks) {
        const phaseBase = week.phase === "base"
            ? 0.12 + week.phaseProgress * 0.18
            : week.phase === "build"
                ? 0.32 + week.phaseProgress * 0.28
                : week.phase === "specific"
                    ? 0.62 + week.phaseProgress * 0.2
                    : week.phase === "peak"
                        ? 0.9 + week.phaseProgress * 0.1
                        : 1;
        const isCutback = week.phase !== "taper" &&
            week.phase !== "peak" &&
            week.weekIndex > 1 &&
            (continuityBackboneFinish ? continuityCutbacks.has(week.weekIndex) : week.weekIndex % interval === 0);
        const baseLongRun = continuityBackboneFinish
            ? continuityLongRunCurve[week.weekIndex - 1] ?? longStart
            : roundHalf(longStart + (longPeak - longStart) * phaseBase);
        const baseVolume = targetWeeklyLoadCurve[week.weekIndex - 1] ?? roundHalf(volumeStart + (volumePeak - volumeStart) * phaseBase);
        const baseIntensity = roundHundred(intensityForPhase(week.phase, planType, classification) * (isCutback ? 0.82 : 1));
        const baseContinuous = continuityBackboneFinish
            ? continuityContinuousCurve[week.weekIndex - 1] ?? input.currentContinuousRunMin
            : continuousRunTarget(input, planType, week.phase, week.weekIndex, phasePlan.totalWeeks, totalTaperWeeks);
        const primary = primaryDimension(week.phase, week.weekIndex, isCutback, baseIntensity, classification, planType, backboneSelection);
        const taperIndex = week.phase === "taper" && !week.isRaceWeek ? taperWeeks.length : -1;
        const taper = week.phase === "taper" && !week.isRaceWeek ? taperCurve(totalTaperWeeks, taperIndex) : undefined;
        const raceWeek = week.isRaceWeek ? raceWeekAdjustments(planType) : undefined;
        let proposedLongRun = week.isRaceWeek
            ? longPeak * raceWeek.longRunFactor
            : week.phase === "taper"
                ? continuityBackboneFinish
                    ? baseLongRun
                    : longPeak * (raceWeek?.longRunFactor ?? taper.longRunFactor)
                : baseLongRun * (isCutback && !continuityBackboneFinish ? longRunCutbackFactor(planType) : 1);
        let proposedVolume = baseVolume;
        let proposedIntensity = week.isRaceWeek
            ? baseIntensity * raceWeek.intensityFactor
            : week.phase === "taper"
                ? baseIntensity * (raceWeek?.intensityFactor ?? (planType.includes("improve") || planType.includes("target_time") ? 0.86 : 0.72))
                : baseIntensity;
        let proposedContinuous = week.isRaceWeek
            ? Math.max(input.currentContinuousRunMin, roundHalf(baseContinuous * 0.78))
            : week.phase === "taper"
                ? continuityBackboneFinish
                    ? Math.max(input.currentContinuousRunMin, roundHalf(baseContinuous * (raceWeek ? 0.82 : 0.9)))
                    : Math.max(input.currentContinuousRunMin, previousContinuous * 0.96, baseContinuous * 0.94)
                : baseContinuous;
        proposedLongRun = backboneSelection.type === "continuous_backbone"
            ? proposedLongRun
            : growthCap(primary === "long_run" ? "long_run" : "stabilize", previousLongRun, proposedLongRun, planType);
        proposedVolume =
            week.phase === "taper" || week.isRaceWeek
                ? proposedVolume
                : growthCap(primary === "weekly_volume" ? "weekly_volume" : "stabilize", previousVolume, proposedVolume, planType);
        proposedIntensity = Math.min(proposedIntensity, previousIntensity * (primary === "intensity" ? 1.12 : week.phase === "specific" || week.phase === "peak" ? 1.08 : 1.04));
        proposedContinuous = continuityBackboneFinish ? proposedContinuous : growthCap(primary === "continuous_running" ? "continuous_running" : "continuous_running", previousContinuous, proposedContinuous, planType);
        const longRun = roundHalf(clamp(proposedLongRun, 10, longPeak));
        const minVolumeRatio = backboneSelection.type === "continuous_backbone" ? 2.4 : planType.includes("improve") || planType.includes("target_time") ? 2.7 : 2.5;
        const maxVolumeRatio = backboneSelection.type === "continuous_backbone" ? 3 : planType.includes("improve") || planType.includes("target_time") ? 3.5 : 3.2;
        const weeklyVolume = roundHalf(clamp(Math.max(longRun * minVolumeRatio, proposedVolume), continuityBackboneFinish ? 25 : 30, Math.max(volumePeak, longRun * maxVolumeRatio)));
        const intensity = roundHundred(clamp(proposedIntensity, 0.06, 0.82));
        const continuous = roundHalf(clamp(proposedContinuous, input.currentContinuousRunMin, Math.max(input.currentContinuousRunMin, continuousRunPeak(input, planType))));
        const specificity = roundHundred(specificityForPhase(week.phase, planType) * (isCutback ? 0.88 : 1));
        const density = roundHundred(densityForPhase(week.phase, classification) * (isCutback ? 0.92 : 1));
        week.isCutback = isCutback;
        if (isCutback)
            cutbackWeeks.push(week.weekIndex);
        if (week.phase === "taper" && !week.isRaceWeek)
            taperWeeks.push(week.weekIndex);
        longRunCurve.push(longRun);
        weeklyVolumeCurve.push(weeklyVolume);
        intensityCurve.push(intensity);
        continuousCurve.push(continuous);
        specificityCurve.push(specificity);
        densityCurve.push(density);
        primaryLoadDimension.push(primary);
        previousLongRun = longRun;
        previousVolume = weeklyVolume;
        previousIntensity = intensity;
        previousContinuous = continuous;
    }
    const backboneTargetCurve = backboneSelection.type === "continuous_backbone" ? continuousCurve : longRunCurve;
    void goalClassification;
    return {
        backboneType: backboneSelection.type,
        backboneTargetCurve,
        sessionsPerWeekCurve,
        longRunCurve,
        weeklyVolumeCurve,
        intervalDurationCurve,
        intensityCurve,
        continuousCurve,
        specificityCurve,
        densityCurve,
        primaryLoadDimension,
        cutbackWeeks,
        taperWeeks,
    };
}
