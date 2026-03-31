"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chooseLongRunDay = chooseLongRunDay;
exports.adjustPlanByGoalType = adjustPlanByGoalType;
exports.getWeeklyStructure = getWeeklyStructure;
exports.assignSessionRoles = assignSessionRoles;
exports.distributeWeeklyLoad = distributeWeeklyLoad;
exports.buildWeeklyStructure = buildWeeklyStructure;
const selectArchetype_1 = require("../engine-vnext/archetypes/selectArchetype");
const taperStrategies_1 = require("../engine-vnext/phases/taperStrategies");
const selectWeeklyTemplate_1 = require("../engine-vnext/templates/selectWeeklyTemplate");
const DAY_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
function latestDay(days) {
    return [...days].sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b)).at(-1) ?? "sunday";
}
function mapRunnerLevelToVNext(runnerType) {
    switch (runnerType) {
        case "true_beginner":
            return "true_beginner";
        case "return_to_running":
        case "consistency_builder":
            return "beginner";
        case "recreational":
        case "advanced_recreational":
        case "performance_oriented":
        case "low_availability_runner":
            return "recreational";
        case "intermediate":
            return "intermediate";
        default:
            return "beginner_plus";
    }
}
function mapRaceDistanceToVNext(raceDistance) {
    return raceDistance;
}
function selectVNextStructureRoles(params) {
    const phase = params.isRaceWeek ? "race_week" : params.phase;
    const archetype = (0, selectArchetype_1.selectArchetype)({
        runnerLevel: mapRunnerLevelToVNext(params.runnerType),
        goalType: params.goalType,
        raceDistance: mapRaceDistanceToVNext(params.raceDistance ?? "10K"),
        returnToRunning: params.goalType === "return_to_running" || params.runnerType === "return_to_running",
    });
    return (0, selectWeeklyTemplate_1.selectWeeklyTemplate)({
        archetype,
        phase,
        sessionsPerWeek: params.sessionsPerWeek,
        goalType: params.goalType,
        raceDistance: mapRaceDistanceToVNext(params.raceDistance ?? "10K"),
        isStepBackWeek: params.isStepBackWeek,
    }).roles;
}
function chooseLongRunDay(input) {
    const days = input.availableTrainingDays.length > 0 ? input.availableTrainingDays : ["tuesday", "thursday", "sunday"];
    if (input.preferredLongRunDay === "saturday" && days.includes("saturday"))
        return "saturday";
    if (input.preferredLongRunDay === "sunday" && days.includes("sunday"))
        return "sunday";
    if (input.preferredLongRunDay === "weekday") {
        return latestDay(days.filter((day) => day !== "saturday" && day !== "sunday"));
    }
    if (days.includes("sunday"))
        return "sunday";
    if (days.includes("saturday"))
        return "saturday";
    return latestDay(days);
}
function mapPhaseStructureRole(role, sessionsPerWeek) {
    if (role === "long_run")
        return { role: "long_run", qualityBias: "none" };
    if (role === "long_with_segments")
        return { role: "long_run", qualityBias: "specific" };
    if (role === "long_short")
        return { role: "long_run", qualityBias: "short" };
    if (role === "recovery")
        return { role: "recovery", qualityBias: "none" };
    if (role === "strides")
        return { role: "easy", qualityBias: "sharpen" };
    if (role === "easy")
        return { role: "easy", qualityBias: "none" };
    if (role === "support")
        return { role: "aerobic_support", qualityBias: "none" };
    if (role === "steady")
        return { role: "aerobic_support", qualityBias: sessionsPerWeek <= 2 ? "intro" : "none" };
    if (role === "short_quality" || role === "race_pace_short")
        return { role: "quality", qualityBias: "short" };
    if (role === "threshold")
        return { role: "quality", qualityBias: "moderate" };
    if (role === "intervals" || role === "race_pace")
        return { role: "quality", qualityBias: "specific" };
    return { role: "quality", qualityBias: sessionsPerWeek <= 2 ? "moderate" : "intro" };
}
function adjustPlanByGoalType(plan, goalType, runnerType) {
    const finishLike = goalType === "finish" ||
        goalType === "finish_without_walking" ||
        goalType === "build_consistency";
    const returnLike = goalType === "return_to_running" || runnerType === "return_to_running";
    const improveLike = goalType === "improve_time";
    const targetLike = goalType === "target_time";
    const beginnerLike = runnerType === "true_beginner" ||
        runnerType === "beginner_plus" ||
        runnerType === "consistency_builder";
    let sessionRoles = [...plan.sessionRoles];
    let qualityDensity = "moderate";
    let longRunStyle = "easy";
    let intensityDistribution = { easy: 0.8, moderate: 0.15, hard: 0.05 };
    if (returnLike) {
        qualityDensity = "low";
        intensityDistribution = { easy: 0.92, moderate: 0.08, hard: 0 };
        sessionRoles = sessionRoles.map((role) => {
            if (role === "quality" || role === "intervals" || role === "threshold" || role === "race_pace")
                return "support";
            if (role === "race_pace_short" || role === "short_quality" || role === "strides")
                return "easy";
            return role;
        });
        if (sessionRoles.includes("support") && !sessionRoles.includes("recovery") && sessionRoles.length >= 3) {
            sessionRoles.splice(Math.max(1, sessionRoles.length - 1), 0, "recovery");
            sessionRoles = sessionRoles.slice(0, plan.sessionRoles.length);
        }
        return { sessionRoles, qualityDensity, longRunStyle, intensityDistribution };
    }
    if (finishLike) {
        qualityDensity = "low";
        intensityDistribution = { easy: 0.9, moderate: 0.1, hard: 0 };
        if (plan.isRaceWeek) {
            sessionRoles = sessionRoles.map((role) => (role === "strides" ? "easy" : role));
        }
        if (plan.phase === "build" || plan.phase === "specific" || plan.phase === "peak") {
            sessionRoles = sessionRoles.map((role) => {
                if (role === "intervals" || role === "threshold" || role === "short_quality")
                    return beginnerLike ? "support" : "steady";
                if (role === "quality")
                    return beginnerLike ? "support" : "steady";
                if (role === "race_pace")
                    return plan.phase === "specific" ? "steady" : "easy";
                if (role === "race_pace_short")
                    return "easy";
                return role;
            });
        }
        if (sessionRoles.length >= 3) {
            sessionRoles = sessionRoles.map((role, index) => {
                if (index === sessionRoles.length - 1)
                    return role;
                return role === "support" || role === "steady" ? "easy" : role;
            });
        }
        if (plan.phase === "specific" && sessionRoles.includes("long_run")) {
            longRunStyle = "progressive";
        }
        if (plan.phase === "peak" || plan.phase === "taper") {
            longRunStyle = "short";
        }
        return { sessionRoles, qualityDensity, longRunStyle, intensityDistribution };
    }
    if (improveLike) {
        qualityDensity = "moderate";
        intensityDistribution = { easy: 0.8, moderate: 0.15, hard: 0.05 };
        if (plan.phase === "base") {
            sessionRoles = sessionRoles.map((role) => (role === "support" ? "steady" : role));
        }
        if (plan.phase === "build") {
            sessionRoles = sessionRoles.map((role, index) => {
                if (role === "steady" && index === 0)
                    return "threshold";
                if (role === "support")
                    return "steady";
                return role;
            });
        }
        if (plan.phase === "specific") {
            const qualityIndexes = sessionRoles
                .map((role, index) => ({ role, index }))
                .filter((entry) => entry.role === "quality" || entry.role === "race_pace" || entry.role === "steady");
            if (qualityIndexes[0])
                sessionRoles[qualityIndexes[0].index] = "intervals";
            if (qualityIndexes[1])
                sessionRoles[qualityIndexes[1].index] = "threshold";
        }
        if (plan.phase === "specific" && sessionRoles.includes("long_run")) {
            const longRunIndex = sessionRoles.lastIndexOf("long_run");
            sessionRoles[longRunIndex] = "long_with_segments";
            longRunStyle = "progressive";
        }
        if (plan.phase === "peak") {
            sessionRoles = sessionRoles.map((role, index) => {
                if (index === 0 && (role === "race_pace" || role === "short_quality"))
                    return "short_quality";
                if (index === 1 && role === "easy" && sessionRoles.length >= 4)
                    return "easy";
                return role;
            });
            longRunStyle = "short";
        }
        if (plan.isRaceWeek && sessionRoles.length >= 2) {
            sessionRoles = sessionRoles.map((role, index) => {
                if (index === 1)
                    return "race_pace_short";
                if (index === sessionRoles.length - 1)
                    return "strides";
                return "easy";
            });
        }
        return { sessionRoles, qualityDensity, longRunStyle, intensityDistribution };
    }
    if (targetLike) {
        qualityDensity = "high";
        intensityDistribution = { easy: 0.73, moderate: 0.2, hard: 0.07 };
        if (plan.phase === "base") {
            sessionRoles = sessionRoles.map((role, index) => {
                if (role === "support" || role === "steady")
                    return index === 0 ? "threshold" : "race_pace";
                if (role === "quality")
                    return "threshold";
                return role;
            });
        }
        if (plan.phase === "build") {
            sessionRoles = sessionRoles.map((role, index) => {
                if (index === 0 && (role === "threshold" || role === "quality"))
                    return "intervals";
                if ((role === "support" || role === "steady") && sessionRoles.length >= 4)
                    return "race_pace";
                return role;
            });
        }
        sessionRoles = sessionRoles.map((role) => {
            if (role === "support" || role === "steady")
                return "race_pace";
            if (role === "quality" && plan.phase === "base")
                return "threshold";
            return role;
        });
        if ((plan.phase === "specific" || plan.phase === "peak") && sessionRoles.includes("long_run")) {
            const longRunIndex = sessionRoles.lastIndexOf("long_run");
            sessionRoles[longRunIndex] = plan.phase === "peak" ? "long_short" : "long_with_segments";
            longRunStyle = "segmented";
        }
        else if (plan.phase === "peak") {
            longRunStyle = "short";
        }
        if (plan.phase === "specific") {
            const qualityIndexes = sessionRoles
                .map((role, index) => ({ role, index }))
                .filter((entry) => entry.role === "quality" || entry.role === "race_pace" || entry.role === "threshold");
            if (qualityIndexes[0])
                sessionRoles[qualityIndexes[0].index] = "intervals";
            if (qualityIndexes[1])
                sessionRoles[qualityIndexes[1].index] = "race_pace";
        }
        if (plan.phase === "peak") {
            sessionRoles = sessionRoles.map((role, index) => {
                if (index === 0 && role !== "long_short")
                    return "intervals";
                if (index === 1 && role === "easy" && sessionRoles.length >= 4)
                    return "race_pace";
                return role;
            });
        }
        if (plan.isRaceWeek && sessionRoles.length >= 2) {
            sessionRoles = sessionRoles.map((role, index) => {
                if (index === 1)
                    return "race_pace_short";
                if (index === sessionRoles.length - 1)
                    return "strides";
                return "easy";
            });
        }
        return { sessionRoles, qualityDensity, longRunStyle, intensityDistribution };
    }
    return { sessionRoles, qualityDensity, longRunStyle, intensityDistribution };
}
function getWeeklyStructure(params) {
    const { phase, sessionsPerWeek, runnerType, goalType, raceDistance, isRaceWeek, isStepBackWeek } = params;
    const vNextRoles = selectVNextStructureRoles({
        phase,
        sessionsPerWeek,
        runnerType,
        goalType,
        raceDistance,
        isRaceWeek,
        isStepBackWeek,
    });
    if (vNextRoles.length > 0) {
        return vNextRoles;
    }
    const beginnerLike = runnerType === "true_beginner" ||
        runnerType === "beginner_plus" ||
        runnerType === "return_to_running" ||
        runnerType === "consistency_builder";
    const finishLike = goalType === "finish" || goalType === "finish_without_walking" || goalType === "return_to_running" || goalType === "build_consistency";
    const performanceLike = goalType === "target_time" || goalType === "improve_time";
    const buildQuality = performanceLike ? "threshold" : beginnerLike && finishLike ? "steady" : "quality";
    let sessionRoles;
    if (isRaceWeek) {
        sessionRoles =
            goalType === "target_time"
                ? sessionsPerWeek <= 2
                    ? ["race_pace_short", "strides"]
                    : sessionsPerWeek === 3
                        ? ["easy", "race_pace_short", "strides"]
                        : ["easy", "race_pace_short", "recovery", "strides"]
                : goalType === "improve_time"
                    ? sessionsPerWeek <= 2
                        ? ["easy", "race_pace_short"]
                        : sessionsPerWeek === 3
                            ? ["easy", "race_pace_short", "easy"]
                            : ["easy", "race_pace_short", "recovery", "easy"]
                    : sessionsPerWeek <= 2
                        ? ["easy", "strides"]
                        : sessionsPerWeek === 3
                            ? ["easy", "strides", "easy"]
                            : ["easy", "strides", "recovery", "easy"];
    }
    else if (phase === "base") {
        sessionRoles =
            sessionsPerWeek <= 2
                ? ["easy", "long_run"]
                : sessionsPerWeek === 3
                    ? ["easy", beginnerLike || finishLike ? "support" : "easy", "long_run"]
                    : sessionsPerWeek === 4
                        ? ["easy", "easy", "recovery", "long_run"]
                        : ["easy", "support", "easy", "recovery", "long_run"];
    }
    else if (phase === "build") {
        sessionRoles =
            sessionsPerWeek <= 2
                ? [buildQuality, "long_run"]
                : sessionsPerWeek === 3
                    ? ["easy", buildQuality, "long_run"]
                    : sessionsPerWeek === 4
                        ? [buildQuality, "easy", "recovery", "long_run"]
                        : [buildQuality, "easy", "support", "recovery", "long_run"];
    }
    else if (phase === "specific") {
        sessionRoles =
            sessionsPerWeek <= 2
                ? ["race_pace", "long_run"]
                : sessionsPerWeek === 3
                    ? ["race_pace", "easy", "long_run"]
                    : sessionsPerWeek === 4
                        ? [performanceLike ? "quality" : "race_pace", "easy", "recovery", "long_run"]
                        : [performanceLike ? "quality" : "race_pace", "race_pace", "easy", "recovery", "long_run"];
    }
    else if (phase === "peak") {
        sessionRoles =
            sessionsPerWeek <= 2
                ? ["race_pace", "long_short"]
                : sessionsPerWeek === 3
                    ? [performanceLike ? "short_quality" : "race_pace", "easy", "long_short"]
                    : sessionsPerWeek === 4
                        ? [performanceLike ? "short_quality" : "race_pace", "easy", "recovery", "long_short"]
                        : ["race_pace", "easy", "easy", "recovery", "long_short"];
    }
    else if (phase === "taper") {
        sessionRoles = finishLike
            ? sessionsPerWeek <= 2
                ? ["easy", "long_short"]
                : sessionsPerWeek === 3
                    ? ["easy", "race_pace_short", "easy"]
                    : sessionsPerWeek === 4
                        ? ["easy", "easy", "recovery", "long_short"]
                        : ["easy", "race_pace_short", "easy", "recovery", "easy"]
            : sessionsPerWeek <= 2
                ? ["easy", "race_pace_short"]
                : sessionsPerWeek === 3
                    ? ["easy", "race_pace_short", "easy"]
                    : sessionsPerWeek === 4
                        ? ["easy", "race_pace_short", "recovery", "easy"]
                        : ["easy", "race_pace_short", "easy", "recovery", "easy"];
    }
    else {
        sessionRoles = sessionsPerWeek <= 2 ? ["quality", "long_run"] : ["easy", "quality", "long_run"];
    }
    return adjustPlanByGoalType({
        phase,
        sessionRoles,
        isRaceWeek,
    }, goalType, runnerType).sessionRoles;
}
function assignSessionRoles(weeklyStructure, phase, goalType, runnerType, raceDistance, isRaceWeek = false) {
    return getWeeklyStructure({
        phase,
        sessionsPerWeek: weeklyStructure.sessionsPerWeek,
        goalType,
        runnerType,
        raceDistance,
        isRaceWeek,
    });
}
function effectiveTrainingDays(input, classification, planType, phaseWeek, curves) {
    const availableDays = input.availableTrainingDays.length > 0 ? input.availableTrainingDays : ["tuesday", "thursday", "sunday"];
    const continuityLedFinish = curves.backboneType === "continuous_backbone" &&
        (planType === "5k_finish" || planType === "5k_finish_no_walk" || planType === "10k_finish");
    const targetRuns = Math.min(phaseWeek.targetRuns, availableDays.length);
    if (!continuityLedFinish && targetRuns >= availableDays.length)
        return availableDays;
    const longRunDay = chooseLongRunDay(input);
    const supportDays = availableDays.filter((day) => day !== longRunDay).sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
    const curveRuns = curves.sessionsPerWeekCurve[phaseWeek.weekIndex - 1] ?? (phaseWeek.weekIndex <= 2 ? 2 : 3);
    const resolvedRuns = Math.min(targetRuns, curveRuns, availableDays.length);
    if (resolvedRuns >= availableDays.length)
        return availableDays;
    if (resolvedRuns === 2) {
        return [supportDays[0] ?? availableDays[0] ?? "tuesday", longRunDay];
    }
    return [...supportDays.slice(0, 2), longRunDay];
}
function weeklyEmphasis(phase, intensity, isCutback) {
    if (phase === "taper")
        return "taper_freshness";
    if (isCutback)
        return "recovery_absorption";
    if (phase === "base")
        return "base_support";
    if (phase === "build")
        return "durability_build";
    if (phase === "specific")
        return "specific_development";
    return intensity >= 0.5 ? "peak_specificity" : "specific_development";
}
function roundHalf(value) {
    return Math.round(value * 2) / 2;
}
function baseRoleOrderForSessions(sessionsPerWeek) {
    if (sessionsPerWeek <= 2)
        return ["easy", "long_run"];
    if (sessionsPerWeek === 3)
        return ["easy", "aerobic_support", "long_run"];
    if (sessionsPerWeek === 4)
        return ["easy", "aerobic_support", "recovery", "long_run"];
    return ["easy", "aerobic_support", "quality", "recovery", "long_run"];
}
function distributionWeightsForRoles(roles, phase, runnerLevel) {
    const baseWeights = phase === "base"
        ? { easy: 0.34, aerobic_support: 0.26, quality: 0.12, recovery: 0.16, long_run: 0.46 }
        : phase === "build"
            ? { easy: 0.24, aerobic_support: 0.18, quality: 0.24, recovery: 0.14, long_run: 0.4 }
            : phase === "specific"
                ? { easy: 0.22, aerobic_support: 0.12, quality: 0.24, recovery: 0.14, long_run: 0.34 }
                : phase === "peak"
                    ? { easy: 0.26, aerobic_support: 0.1, quality: 0.22, recovery: 0.16, long_run: 0.28 }
                    : { easy: 0.34, aerobic_support: 0.14, quality: 0.16, recovery: 0.18, long_run: 0.18 };
    const adjustedWeights = roles.map((role) => baseWeights[role]);
    if (runnerLevel === "true_beginner" || runnerLevel === "beginner_plus") {
        return adjustedWeights.map((weight, index) => {
            if (roles[index] === "long_run" && phase !== "taper")
                return weight + 0.03;
            if (roles[index] === "quality")
                return Math.max(0.08, weight - 0.04);
            if (roles[index] === "aerobic_support")
                return weight + 0.01;
            return weight;
        });
    }
    return adjustedWeights;
}
function normalizeWeights(weights) {
    const total = weights.reduce((sum, value) => sum + value, 0);
    return total <= 0 ? weights.map(() => 0) : weights.map((value) => value / total);
}
function capLongRunShare(weights, roles, phase, runnerLevel) {
    const longRunIndex = roles.findIndex((role) => role === "long_run");
    if (longRunIndex === -1)
        return weights;
    const cap = phase === "taper" || phase === "peak"
        ? runnerLevel === "advanced"
            ? 0.35
            : 0.3
        : runnerLevel === "true_beginner" || runnerLevel === "beginner_plus"
            ? 0.35
            : runnerLevel === "advanced"
                ? 0.45
                : 0.4;
    const adjusted = [...weights];
    const longRunWeight = adjusted[longRunIndex] ?? 0;
    if (longRunWeight <= cap)
        return adjusted;
    const overflow = longRunWeight - cap;
    adjusted[longRunIndex] = cap;
    const otherIndexes = adjusted.map((_, index) => index).filter((index) => index !== longRunIndex);
    const otherTotal = otherIndexes.reduce((sum, index) => sum + adjusted[index], 0);
    if (otherTotal <= 0)
        return normalizeWeights(adjusted);
    for (const index of otherIndexes) {
        adjusted[index] += overflow * (adjusted[index] / otherTotal);
    }
    return normalizeWeights(adjusted);
}
function distributeWeeklyLoad(params) {
    const { weeklyLoad, sessionsPerWeek, phase, runnerLevel, goalType } = params;
    const roles = params.roles && params.roles.length > 0 ? params.roles : baseRoleOrderForSessions(sessionsPerWeek);
    let weights = normalizeWeights(distributionWeightsForRoles(roles, phase, runnerLevel));
    if (goalType === "finish" || goalType === "finish_without_walking" || goalType === "build_consistency" || goalType === "return_to_running") {
        weights = normalizeWeights(weights.map((weight, index) => {
            const role = roles[index];
            if (role === "quality")
                return weight * 0.65;
            if (role === "aerobic_support" || role === "easy")
                return weight * 1.12;
            if (role === "recovery")
                return weight * 1.08;
            return weight;
        }));
    }
    else if (goalType === "improve_time") {
        weights = normalizeWeights(weights.map((weight, index) => {
            const role = roles[index];
            if (role === "quality")
                return weight * 1.12;
            if (role === "long_run")
                return weight * (phase === "specific" ? 0.95 : 1);
            return weight;
        }));
    }
    else if (goalType === "target_time") {
        weights = normalizeWeights(weights.map((weight, index) => {
            const role = roles[index];
            if (role === "quality")
                return weight * 1.2;
            if (role === "aerobic_support")
                return weight * 0.85;
            if (role === "long_run")
                return weight * (phase === "specific" || phase === "peak" ? 0.98 : 1);
            return weight;
        }));
    }
    weights = capLongRunShare(weights, roles, phase, runnerLevel);
    const rawDurations = roles.map((_, index) => roundHalf(weeklyLoad * (weights[index] ?? 0)));
    const currentTotal = rawDurations.reduce((sum, value) => sum + value, 0);
    const diff = roundHalf(weeklyLoad - currentTotal);
    if (Math.abs(diff) > 0 && rawDurations.length > 0) {
        rawDurations[rawDurations.length - 1] = roundHalf(rawDurations[rawDurations.length - 1] + diff);
    }
    return roles.map((role, index) => ({
        role,
        duration: Math.max(role === "recovery" ? 15 : role === "long_run" ? 20 : 18, rawDurations[index] ?? 0),
    }));
}
function distributeLoadAcrossSlots(slots, weeklyLoad, phase, runnerLevel, goalType) {
    const distribution = distributeWeeklyLoad({
        weeklyLoad,
        sessionsPerWeek: slots.length,
        phase,
        runnerLevel,
        roles: slots.map((slot) => slot.role),
        goalType,
    });
    const availableByRole = new Map();
    distribution.forEach((entry) => {
        availableByRole.set(entry.role, [...(availableByRole.get(entry.role) ?? []), entry.duration]);
    });
    return slots.map((slot) => {
        const exact = availableByRole.get(slot.role);
        const fallbackEasy = slot.role === "aerobic_support" ? availableByRole.get("easy") : undefined;
        const fallbackSupport = slot.role === "easy" ? availableByRole.get("aerobic_support") : undefined;
        const picked = exact && exact.length > 0
            ? exact.shift()
            : fallbackEasy && fallbackEasy.length > 0
                ? fallbackEasy.shift()
                : fallbackSupport && fallbackSupport.length > 0
                    ? fallbackSupport.shift()
                    : undefined;
        return {
            ...slot,
            targetDurationMin: picked ?? (slot.role === "long_run" ? roundHalf(weeklyLoad * 0.4) : roundHalf(weeklyLoad / Math.max(slots.length, 1))),
        };
    });
}
function buildWeeklyStructure(input, classification, phaseWeek, planType, curves) {
    const phase = phaseWeek.phase;
    const weekIndex = phaseWeek.weekIndex;
    const availableDays = effectiveTrainingDays(input, classification, planType, phaseWeek, curves);
    const longRunDay = chooseLongRunDay(input);
    const remainingDays = availableDays.filter((day) => day !== longRunDay).sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
    const isCutback = curves.cutbackWeeks.includes(weekIndex);
    const structureRoles = getWeeklyStructure({
        phase,
        sessionsPerWeek: availableDays.length,
        runnerType: classification.traits.primaryRunnerType,
        goalType: input.goalType,
        raceDistance: input.raceDistance,
        isRaceWeek: phaseWeek.isRaceWeek,
        isStepBackWeek: isCutback,
    });
    const intensity = curves.intensityCurve[weekIndex - 1] ?? 0.2;
    const taperStrategy = phase === "taper" || phaseWeek.isRaceWeek
        ? (0, taperStrategies_1.getTaperStrategy)({
            raceDistance: input.raceDistance,
            goalType: input.goalType,
        })
        : undefined;
    const peakWeeklyVolume = Math.max(...curves.weeklyVolumeCurve.slice(0, weekIndex), curves.weeklyVolumeCurve[weekIndex - 1] ?? 0);
    const peakLongRun = Math.max(...curves.longRunCurve.slice(0, weekIndex), curves.longRunCurve[weekIndex - 1] ?? 0);
    const baseWeeklyVolume = curves.weeklyVolumeCurve[weekIndex - 1] ?? 0;
    const baseLongRun = curves.longRunCurve[weekIndex - 1] ?? 0;
    const weeklyVolumeTargetMin = phaseWeek.isRaceWeek && taperStrategy
        ? roundHalf(Math.min(baseWeeklyVolume, peakWeeklyVolume * taperStrategy.raceWeekVolumeRatio))
        : phase === "taper" && taperStrategy
            ? roundHalf(Math.min(baseWeeklyVolume, peakWeeklyVolume * taperStrategy.taperVolumeRatio))
            : baseWeeklyVolume;
    const longRunTargetMin = phaseWeek.isRaceWeek
        ? 0
        : phase === "taper" && taperStrategy
            ? roundHalf(Math.min(baseLongRun, peakLongRun * (1 - taperStrategy.longRunReduction)))
            : baseLongRun;
    const returnToRunningState = input.goalType === "return_to_running" || classification.traits.primaryRunnerType === "return_to_running"
        ? {
            weekIndex,
            continuityGatePassed: (curves.continuousCurve[weekIndex - 1] ?? input.currentContinuousRunMin) >= 20 && weekIndex > 3,
            qualityEligible: false,
            runWalkPreferred: !((curves.continuousCurve[weekIndex - 1] ?? input.currentContinuousRunMin) >= 20 && weekIndex > 3),
            maxSessionsAllowed: weekIndex <= 4 ? 2 : 3,
        }
        : undefined;
    const baseSlots = structureRoles.map((structureRole, index) => {
        const mapped = mapPhaseStructureRole(structureRole, availableDays.length);
        if (mapped.role === "long_run")
            return { role: mapped.role, day: longRunDay, qualityBias: "none", protected: true };
        const day = remainingDays[index] ?? availableDays[index] ?? longRunDay;
        const qualityBias = mapped.role === "quality"
            ? (mapped.qualityBias ??
                (intensity < 0.22
                    ? "intro"
                    : intensity < 0.42
                        ? "moderate"
                        : "specific"))
            : "none";
        return { role: mapped.role, day, qualityBias, protected: mapped.role === "recovery" };
    });
    const slots = distributeLoadAcrossSlots(baseSlots, weeklyVolumeTargetMin, phase, classification.traits.runnerLevel, input.goalType);
    return {
        weekIndex,
        phase,
        isRaceWeek: phaseWeek.isRaceWeek,
        totalRuns: slots.length,
        weeklyEmphasis: weeklyEmphasis(phase, intensity, isCutback),
        longRunDay,
        qualityDays: slots.filter((slot) => slot.role === "quality").map((slot) => slot.day),
        easyDays: slots.filter((slot) => slot.role === "easy" || slot.role === "aerobic_support").map((slot) => slot.day),
        recoveryDays: slots.filter((slot) => slot.role === "recovery").map((slot) => slot.day),
        longRunTargetMin,
        weeklyVolumeTargetMin,
        intensityTarget: intensity,
        continuousTargetMin: curves.continuousCurve[weekIndex - 1] ?? input.currentContinuousRunMin,
        returnToRunningState,
        slots,
    };
}
