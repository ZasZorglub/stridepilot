"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildTimelineRecommendation = buildTimelineRecommendation;
exports.applyTimelineRecommendation = applyTimelineRecommendation;
const calendar_week_1 = require("../calendar-week");
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
function roundWeeks(value) {
    return Math.max(4, Math.round(value));
}
function addWeeksToIsoDate(startDate, weeks) {
    const date = (0, calendar_week_1.parseIsoDateLocal)(startDate);
    date.setDate(date.getDate() + Math.max(0, weeks) * 7);
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
}
function currentDurationWeeks(input) {
    if (typeof input.requestedDurationWeeks === "number" && Number.isFinite(input.requestedDurationWeeks)) {
        return Math.max(4, Math.round(input.requestedDurationWeeks));
    }
    if (input.goalDate)
        return (0, calendar_week_1.deriveCalendarWeekCount)(input.startDate, input.goalDate) ?? undefined;
    return undefined;
}
function baselineWeeks(input) {
    if (input.goalType === "return_to_running")
        return 10;
    if (input.goalType === "build_consistency")
        return 10;
    if (input.goalType === "finish_without_walking")
        return input.raceDistance === "5K" ? 8 : 16;
    if (input.goalType === "target_time") {
        if (input.raceDistance === "5K")
            return 10;
        if (input.raceDistance === "10K")
            return 13;
        if (input.raceDistance === "HalfMarathon")
            return 16;
        return 20;
    }
    if (input.goalType === "improve_time") {
        if (input.raceDistance === "5K")
            return 10;
        if (input.raceDistance === "10K")
            return 13;
        if (input.raceDistance === "HalfMarathon")
            return 16;
        return 20;
    }
    if (input.raceDistance === "5K")
        return 10;
    if (input.raceDistance === "10K")
        return 15;
    if (input.raceDistance === "HalfMarathon")
        return 17;
    return 20;
}
function safeMinimumWeeks(input, classification) {
    const beginner = classification.traits.runnerLevel === "true_beginner";
    const beginnerPlus = classification.traits.runnerLevel === "beginner_plus";
    if (input.goalType === "finish_without_walking")
        return beginner ? 10 : beginnerPlus ? 9 : 8;
    if (input.goalType === "return_to_running")
        return 8;
    if (input.goalType === "build_consistency")
        return 8;
    if (input.raceDistance === "5K")
        return beginner ? 8 : beginnerPlus ? 7 : 6;
    if (input.raceDistance === "10K")
        return beginner ? 12 : beginnerPlus ? 10 : 8;
    if (input.raceDistance === "HalfMarathon")
        return beginner ? 16 : 12;
    return beginner ? 20 : 16;
}
function maximumReasonableWeeks(input, classification) {
    if (input.goalType === "finish_without_walking") {
        if (input.raceDistance === "5K" && classification.traits.runnerLevel === "true_beginner")
            return 14;
        return 16;
    }
    if (input.goalType === "build_consistency")
        return 16;
    if (input.raceDistance === "5K")
        return 14;
    if (input.raceDistance === "10K")
        return 18;
    if (input.raceDistance === "HalfMarathon")
        return 20;
    return 24;
}
function classifyGoal(input) {
    const reasons = [];
    if (input.goalType === "return_to_running") {
        reasons.push("Goal is a return after time off, so re-entry and durability matter more than race sharpness.");
        return { demand: "reentry", specificityNeed: 0.18, finishBias: 0.92, recommendedComplexity: "simple", reasons };
    }
    if (input.goalType === "build_consistency") {
        reasons.push("Goal is consistency, so the plan should privilege habit and repeatability over specificity.");
        return { demand: "consistency_first", specificityNeed: 0.14, finishBias: 0.96, recommendedComplexity: "simple", reasons };
    }
    if (input.goalType === "finish_without_walking") {
        reasons.push("Goal is completion without walking, so continuity progression is the main training demand.");
        return { demand: "continuity_first", specificityNeed: 0.24, finishBias: 0.94, recommendedComplexity: "simple", reasons };
    }
    if (input.goalType === "finish") {
        if (input.raceDistance === "5K" || input.raceDistance === "10K") {
            reasons.push("Completion goal is short enough to stay simple, but still needs a real durability build.");
            return { demand: "completion_foundation", specificityNeed: 0.22, finishBias: 0.9, recommendedComplexity: "simple", reasons };
        }
        reasons.push("Longer finish goal needs more endurance structure, but should still stay simpler than an improve plan.");
        return { demand: "completion_endurance", specificityNeed: 0.34, finishBias: 0.86, recommendedComplexity: "moderate", reasons };
    }
    if (input.goalType === "improve_time") {
        reasons.push("Improve goal needs a structured build with a real quality role and clearer specific phase.");
        return {
            demand: input.raceDistance === "5K" || input.raceDistance === "10K" ? "performance_development" : "performance_specific",
            specificityNeed: input.raceDistance === "5K" || input.raceDistance === "10K" ? 0.58 : 0.68,
            finishBias: 0.34,
            recommendedComplexity: "structured",
            reasons,
        };
    }
    reasons.push("Target-time goal needs the strongest specificity and the tightest realism guardrails.");
    return { demand: "performance_specific", specificityNeed: 0.78, finishBias: 0.22, recommendedComplexity: "structured", reasons };
}
function abilityAdjustment(input, classification) {
    const level = classification.traits.runnerLevel;
    let adjustment = 0;
    if (level === "true_beginner")
        adjustment += 2;
    if (level === "beginner_plus")
        adjustment += 1;
    if (level === "intermediate")
        adjustment -= 1;
    if (level === "advanced")
        adjustment -= 2;
    if (input.currentContinuousRunMin <= 5)
        adjustment += 1;
    else if (input.currentContinuousRunMin <= 12)
        adjustment += 1;
    else if (input.currentContinuousRunMin >= 45)
        adjustment -= 1;
    if (input.longestRecentRunMin >= 75)
        adjustment -= 1;
    return adjustment;
}
function consistencyRiskAdjustment(input, classification) {
    let adjustment = 0;
    if (classification.traits.consistencyProfile === "sporadic")
        adjustment += 1;
    else if (classification.traits.consistencyProfile === "developing")
        adjustment += 1;
    else if (classification.traits.consistencyProfile === "high")
        adjustment -= 1;
    if (classification.traits.injuryRiskScore >= 55)
        adjustment += 2;
    else if (classification.traits.injuryRiskScore >= 40)
        adjustment += 1;
    if (classification.traits.recoveryNeed >= 0.65)
        adjustment += 1;
    if (input.externalTrainingLoad === "high")
        adjustment += 1;
    return adjustment;
}
function availabilityAdjustment(input, goal) {
    const days = input.availableTrainingDays.length;
    let adjustment = 0;
    if (days <= 2)
        adjustment += 2;
    else if (days === 3)
        adjustment += goal.demand === "performance_specific" ? 1 : 0;
    else if (days >= 5)
        adjustment -= 1;
    if (input.typicalAvailableTimeMin < 35 && (input.raceDistance === "HalfMarathon" || input.raceDistance === "Marathon")) {
        adjustment += 2;
    }
    else if (input.typicalAvailableTimeMin < 45 && input.raceDistance === "10K") {
        adjustment += 1;
    }
    return adjustment;
}
function rangeWindow(input, classification) {
    if (input.goalType === "finish_without_walking" && input.raceDistance === "5K") {
        return classification.traits.runnerLevel === "true_beginner" ? { aggressive: 2, gentle: 2 } : { aggressive: 1, gentle: 2 };
    }
    if (input.raceDistance === "10K") {
        return input.goalType === "finish" ? { aggressive: 2, gentle: 3 } : { aggressive: 2, gentle: 2 };
    }
    if (input.raceDistance === "HalfMarathon") {
        return { aggressive: 2, gentle: 3 };
    }
    if (input.raceDistance === "Marathon") {
        return { aggressive: 2, gentle: 3 };
    }
    return { aggressive: 1, gentle: 2 };
}
function progressionMode(input, classification) {
    const warnings = [];
    const ambition = input.ambitionPreference ?? "standard";
    if (ambition === "gentle") {
        return { mode: "conservative", warnings, durationShift: 2 };
    }
    if (ambition === "ambitious") {
        const beginnerStretchSupported = input.goalType === "finish_without_walking" &&
            input.raceDistance === "5K" &&
            classification.traits.runnerLevel === "true_beginner" &&
            classification.traits.injuryRiskScore < 40 &&
            input.availableTrainingDays.length >= 3;
        if (beginnerStretchSupported) {
            warnings.push("Den ambitiøse vej er kortere end standardanbefalingen og kræver mere stabil gennemførelse uge for uge.");
            return { mode: "ambitious", warnings, durationShift: -2 };
        }
        const supported = classification.traits.runnerLevel !== "true_beginner" &&
            classification.traits.progressionTolerance >= 0.55 &&
            classification.traits.injuryRiskScore < 40 &&
            input.availableTrainingDays.length >= 3;
        if (!supported) {
            warnings.push("Den ambitiøse vej blev justeret, fordi dit nuværende niveau ikke understøtter en kortere tidslinje på en sikker måde.");
            return { mode: "standard", warnings, durationShift: 0 };
        }
        return { mode: "ambitious", warnings, durationShift: -1 };
    }
    if (classification.traits.trainingStyle === "conservative" || classification.traits.injuryRiskScore >= 45) {
        return { mode: "conservative", warnings, durationShift: 0 };
    }
    return { mode: "standard", warnings, durationShift: 0 };
}
function recommendedFrequency(input, classification, goal) {
    const available = Math.max(2, input.availableTrainingDays.length || 3);
    if (classification.traits.runnerLevel === "true_beginner") {
        return { start: 2, recommended: Math.min(3, available), peak: Math.min(3, available) };
    }
    if (goal.demand === "completion_foundation" || goal.demand === "continuity_first") {
        const target = Math.min(3, available);
        return { start: Math.max(2, target - 1), recommended: target, peak: target };
    }
    if (goal.demand === "completion_endurance") {
        const target = Math.min(Math.max(3, available), 4);
        return { start: Math.max(3, target - 1), recommended: target, peak: target };
    }
    const target = Math.min(Math.max(4, available), 5);
    return { start: Math.max(3, target - 1), recommended: target, peak: target };
}
function realismBand(finalWeeks, recommendedWeeks, minimumWeeks, requestedWeeks) {
    if (typeof requestedWeeks !== "number")
        return "high_confidence";
    if (requestedWeeks < minimumWeeks)
        return "capped";
    if (requestedWeeks < recommendedWeeks)
        return "stretch";
    if (requestedWeeks <= recommendedWeeks + 2)
        return "realistic";
    return "high_confidence";
}
function buildTimelineRecommendation(input, classification) {
    const goalClassification = classifyGoal(input);
    const baseWeeks = baselineWeeks(input);
    const safeMin = safeMinimumWeeks(input, classification);
    const safeMax = maximumReasonableWeeks(input, classification);
    const ability = abilityAdjustment(input, classification);
    const consistencyRisk = consistencyRiskAdjustment(input, classification);
    const availability = availabilityAdjustment(input, goalClassification);
    const posture = progressionMode(input, classification);
    const requestedWeeks = currentDurationWeeks(input);
    const rawRecommended = baseWeeks + ability + consistencyRisk + availability + posture.durationShift;
    const unconstrainedRecommended = roundWeeks(rawRecommended);
    const recommendedWeeks = clamp(unconstrainedRecommended, safeMin, safeMax);
    const range = rangeWindow(input, classification);
    const minWeeks = clamp(recommendedWeeks - range.aggressive, safeMin, recommendedWeeks);
    const maxWeeks = clamp(recommendedWeeks + range.gentle, recommendedWeeks, safeMax);
    const chosenWeeks = typeof requestedWeeks === "number"
        ? clamp(requestedWeeks, minWeeks, maxWeeks)
        : recommendedWeeks;
    const frequency = recommendedFrequency(input, classification, goalClassification);
    const warnings = [...posture.warnings];
    if (typeof requestedWeeks === "number" && requestedWeeks < recommendedWeeks) {
        warnings.push("Den valgte tidslinje er kortere end StridePilots anbefalede vej og kan føles mere komprimeret end ideelt.");
    }
    if (typeof requestedWeeks === "number" && requestedWeeks < minWeeks) {
        warnings.push(`StridePilot justerede forløbet til ${minWeeks} uger, fordi en kortere tidslinje ville være for aggressiv ud fra dit nuværende udgangspunkt.`);
    }
    const rationaleTags = [
        goalClassification.demand,
        classification.traits.runnerLevel,
        classification.traits.consistencyProfile,
        classification.traits.scheduleConstraintLevel,
        posture.mode,
    ];
    const recommendation = {
        feasibleDurationRangeWeeks: {
            minimum: minWeeks,
            recommended: recommendedWeeks,
            maximum: maxWeeks,
        },
        recommendedDurationWeeks: recommendedWeeks,
        recommendedGoalDate: addWeeksToIsoDate(input.startDate, recommendedWeeks),
        requestedDurationWeeks: requestedWeeks,
        finalDurationWeeks: chosenWeeks,
        finalGoalDate: addWeeksToIsoDate(input.startDate, chosenWeeks),
        recommendedSessionsPerWeek: frequency.recommended,
        startingSessionsPerWeek: frequency.start,
        peakSessionsPerWeek: frequency.peak,
        recommendedProgressionMode: posture.mode,
        realism: realismBand(chosenWeeks, recommendedWeeks, minWeeks, requestedWeeks),
        warnings,
        rationaleTags,
        explanation: {
            headline: `StridePilot anbefaler et forløb på ${recommendedWeeks} uger.`,
            summary: `Baseret på dit nuværende niveau og dit mål er ${recommendedWeeks} uger den mest realistiske vej. Forløbet starter omkring ${frequency.start} pas om ugen og bygger gradvist op til ${frequency.peak}.`,
            adjustmentNote: typeof requestedWeeks === "number" && chosenWeeks !== requestedWeeks
                ? `Din valgte tidslinje blev justeret til ${chosenWeeks} uger for at holde sig inden for et mere sikkert og realistisk spænd.`
                : undefined,
        },
    };
    return { goalClassification, recommendation };
}
function applyTimelineRecommendation(input, recommendation) {
    return {
        ...input,
        goalDate: input.goalDate ?? recommendation.finalGoalDate,
        requestedDurationWeeks: recommendation.finalDurationWeeks,
    };
}
