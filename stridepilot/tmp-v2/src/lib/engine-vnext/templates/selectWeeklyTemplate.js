"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.selectWeeklyTemplate = selectWeeklyTemplate;
const taperStrategies_1 = require("../phases/taperStrategies");
const raceWeekTemplates_1 = require("./raceWeekTemplates");
const weeklyTemplates_1 = require("./weeklyTemplates");
function simplifyForStepBack(roles) {
    let qualityRemoved = false;
    return roles.map((role) => {
        if (role === "long_with_segments")
            return "long_short";
        if (role === "race_pace" || role === "intervals" || role === "threshold" || role === "short_quality") {
            if (!qualityRemoved) {
                qualityRemoved = true;
                return "steady";
            }
            return "easy";
        }
        if (role === "race_pace_short")
            return "easy";
        return role;
    });
}
function candidateSessionCounts(sessionsPerWeek) {
    const unique = new Set([
        sessionsPerWeek,
        Math.max(2, sessionsPerWeek - 1),
        Math.min(5, sessionsPerWeek + 1),
        3,
        4,
        5,
        2,
    ]);
    return [...unique];
}
function selectWeeklyTemplate(input) {
    const phase = input.phase;
    const raceDistance = input.raceDistance ?? "10K";
    const goalType = input.goalType ?? input.archetype.goalType;
    if (phase === "race_week") {
        return {
            archetypeId: input.archetype.id,
            phase,
            sessionsPerWeek: input.sessionsPerWeek,
            roles: (0, raceWeekTemplates_1.buildRaceWeekRoles)({
                goalType,
                raceDistance,
                sessionsPerWeek: input.sessionsPerWeek,
            }),
        };
    }
    const candidates = candidateSessionCounts(input.sessionsPerWeek);
    const match = candidates
        .map((count) => weeklyTemplates_1.weeklyTemplates.find((template) => template.archetypeId === input.archetype.id &&
        template.phase === phase &&
        template.sessionsPerWeek === count))
        .find(Boolean) ??
        weeklyTemplates_1.weeklyTemplates.find((template) => template.archetypeId === "beginner_finish" && template.phase === phase && template.sessionsPerWeek === 3);
    if (!match) {
        return {
            archetypeId: input.archetype.id,
            phase,
            sessionsPerWeek: input.sessionsPerWeek,
            roles: input.sessionsPerWeek <= 2 ? ["easy", "long_run"] : ["easy", "support", "long_run"],
        };
    }
    let roles = input.isStepBackWeek ? simplifyForStepBack(match.roles) : match.roles;
    if (phase === "taper") {
        const strategy = (0, taperStrategies_1.getTaperStrategy)({ goalType, raceDistance });
        roles = roles
            .map((role, index) => {
            if (role === "long_with_segments" || role === "long_run")
                return "long_short";
            if (role === "intervals" || role === "threshold" || role === "short_quality") {
                return strategy.allowSharpening && index === 1 && strategy.sharpeningFamily !== "none" ? strategy.sharpeningFamily : "easy";
            }
            if (role === "race_pace")
                return strategy.allowSharpening && strategy.sharpeningFamily !== "none" ? strategy.sharpeningFamily : "easy";
            return role;
        })
            .map((role, index, current) => {
            if (role === "race_pace_short" && !strategy.allowSharpening)
                return "easy";
            if (strategy.simplifyToSessionCount && current.length > strategy.simplifyToSessionCount && index < current.length - strategy.simplifyToSessionCount) {
                return "easy";
            }
            return role;
        });
    }
    return {
        ...match,
        sessionsPerWeek: input.sessionsPerWeek,
        roles,
    };
}
