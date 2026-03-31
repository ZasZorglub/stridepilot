"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.selectArchetype = selectArchetype;
const catalog_1 = require("./catalog");
function selectArchetype(input) {
    const { runnerLevel, goalType, raceDistance, returnToRunning } = input;
    if (returnToRunning || goalType === "return_to_running") {
        return (0, catalog_1.getArchetypeById)("return_to_running");
    }
    if (raceDistance === "5K" && goalType === "finish_without_walking" && runnerLevel === "true_beginner") {
        return (0, catalog_1.getArchetypeById)("true_beginner_5k_finish");
    }
    if (goalType === "improve_time" && raceDistance === "5K" && (runnerLevel === "beginner_plus" || runnerLevel === "beginner")) {
        return (0, catalog_1.getArchetypeById)("beginner_plus_improve");
    }
    if (goalType === "target_time" && raceDistance === "HalfMarathon") {
        return (0, catalog_1.getArchetypeById)("half_marathon_target");
    }
    if (goalType === "target_time") {
        return (0, catalog_1.getArchetypeById)("recreational_target_time");
    }
    if (raceDistance === "HalfMarathon" && goalType === "finish") {
        return (0, catalog_1.getArchetypeById)("half_marathon_finish");
    }
    if (raceDistance === "Marathon" && goalType === "finish") {
        return (0, catalog_1.getArchetypeById)("marathon_finish");
    }
    if (raceDistance === "10K" && goalType === "finish" && runnerLevel === "intermediate") {
        return (0, catalog_1.getArchetypeById)("intermediate_finish");
    }
    return (0, catalog_1.getArchetypeById)("beginner_finish");
}
