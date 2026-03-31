"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const selectArchetype_1 = require("../src/lib/engine-vnext/archetypes/selectArchetype");
const selectWeeklyTemplate_1 = require("../src/lib/engine-vnext/templates/selectWeeklyTemplate");
const engine_1 = require("../src/lib/engine-v2/engine");
const weeklyStructure_1 = require("../src/lib/engine-v2/weeklyStructure");
const benchmarkFixtures_1 = require("../src/lib/engine-v2/benchmark/benchmarkFixtures");
function rolesKey(roles) {
    return roles.join(" / ");
}
function expectArchetype(params, expected) {
    const archetype = (0, selectArchetype_1.selectArchetype)(params);
    strict_1.default.equal(archetype.id, expected);
}
expectArchetype({ runnerLevel: "true_beginner", goalType: "finish_without_walking", raceDistance: "5K" }, "true_beginner_5k_finish");
expectArchetype({ runnerLevel: "beginner_plus", goalType: "finish", raceDistance: "10K" }, "beginner_finish");
expectArchetype({ runnerLevel: "beginner_plus", goalType: "improve_time", raceDistance: "5K" }, "beginner_plus_improve");
expectArchetype({ runnerLevel: "recreational", goalType: "target_time", raceDistance: "10K" }, "recreational_target_time");
expectArchetype({ runnerLevel: "intermediate", goalType: "finish", raceDistance: "10K" }, "intermediate_finish");
expectArchetype({ runnerLevel: "recreational", goalType: "finish", raceDistance: "HalfMarathon" }, "half_marathon_finish");
expectArchetype({ runnerLevel: "intermediate", goalType: "target_time", raceDistance: "HalfMarathon" }, "half_marathon_target");
expectArchetype({ runnerLevel: "advanced", goalType: "finish", raceDistance: "Marathon" }, "marathon_finish");
expectArchetype({ runnerLevel: "beginner", goalType: "return_to_running", raceDistance: "5K", returnToRunning: true }, "return_to_running");
const beginnerFinishBase = (0, weeklyStructure_1.getWeeklyStructure)({
    phase: "base",
    sessionsPerWeek: 3,
    runnerType: "beginner_plus",
    goalType: "finish",
    raceDistance: "5K",
});
const beginnerFinishSpecific = (0, weeklyStructure_1.getWeeklyStructure)({
    phase: "specific",
    sessionsPerWeek: 3,
    runnerType: "beginner_plus",
    goalType: "finish",
    raceDistance: "5K",
});
const beginnerFinishRaceWeek = (0, weeklyStructure_1.getWeeklyStructure)({
    phase: "taper",
    sessionsPerWeek: 3,
    runnerType: "beginner_plus",
    goalType: "finish",
    raceDistance: "5K",
    isRaceWeek: true,
});
const fiveKImproveBuild = (0, weeklyStructure_1.getWeeklyStructure)({
    phase: "build",
    sessionsPerWeek: 3,
    runnerType: "beginner_plus",
    goalType: "improve_time",
    raceDistance: "5K",
});
const tenKTargetSpecific = (0, weeklyStructure_1.getWeeklyStructure)({
    phase: "specific",
    sessionsPerWeek: 4,
    runnerType: "recreational",
    goalType: "target_time",
    raceDistance: "10K",
});
const halfFinishBuild = (0, weeklyStructure_1.getWeeklyStructure)({
    phase: "build",
    sessionsPerWeek: 4,
    runnerType: "recreational",
    goalType: "finish",
    raceDistance: "HalfMarathon",
});
const marathonFinishPeak = (0, weeklyStructure_1.getWeeklyStructure)({
    phase: "peak",
    sessionsPerWeek: 5,
    runnerType: "advanced_recreational",
    goalType: "finish",
    raceDistance: "Marathon",
});
const returnToRunningBase = (0, weeklyStructure_1.getWeeklyStructure)({
    phase: "base",
    sessionsPerWeek: 3,
    runnerType: "return_to_running",
    goalType: "return_to_running",
    raceDistance: "5K",
});
strict_1.default.notEqual(rolesKey(beginnerFinishBase), rolesKey(beginnerFinishSpecific));
strict_1.default.notEqual(rolesKey(beginnerFinishSpecific), rolesKey(beginnerFinishRaceWeek));
strict_1.default.notEqual(rolesKey(beginnerFinishBase), rolesKey(returnToRunningBase));
strict_1.default.equal(rolesKey(beginnerFinishBase), "easy / support / long_run");
strict_1.default.equal(rolesKey(fiveKImproveBuild), "easy / quality / long_run");
strict_1.default.equal(rolesKey(tenKTargetSpecific), "easy / race_pace / recovery / long_with_segments");
strict_1.default.equal(rolesKey(halfFinishBuild), "easy / steady / recovery / long_run");
strict_1.default.equal(rolesKey(marathonFinishPeak), "easy / support / easy / recovery / long_short");
strict_1.default.equal(rolesKey(returnToRunningBase), "easy / recovery / long_short");
const vNextSpecificTemplate = (0, selectWeeklyTemplate_1.selectWeeklyTemplate)({
    archetype: (0, selectArchetype_1.selectArchetype)({
        runnerLevel: "recreational",
        goalType: "target_time",
        raceDistance: "10K",
    }),
    phase: "specific",
    sessionsPerWeek: 4,
});
strict_1.default.equal(rolesKey(vNextSpecificTemplate.roles), "easy / race_pace / recovery / long_with_segments");
const vNextBaseTemplate = (0, selectWeeklyTemplate_1.selectWeeklyTemplate)({
    archetype: (0, selectArchetype_1.selectArchetype)({
        runnerLevel: "recreational",
        goalType: "target_time",
        raceDistance: "10K",
    }),
    phase: "base",
    sessionsPerWeek: 4,
});
strict_1.default.notEqual(rolesKey(vNextSpecificTemplate.roles), rolesKey(vNextBaseTemplate.roles));
const integrationFixture = benchmarkFixtures_1.referenceRunnerBenchmarks.find((fixture) => fixture.id === "recreational_10k_improve");
strict_1.default.ok(integrationFixture, "Expected recreational_10k_improve fixture to exist");
const generatedPlan = (0, engine_1.generateEngineV2Plan)(integrationFixture.input);
strict_1.default.ok(generatedPlan.weeks.length > 0, "Legacy generation should still produce weeks");
strict_1.default.ok(generatedPlan.weeks[0]?.workoutSelections?.length, "Legacy generation should still produce workout selections");
console.log("engine-vnext weekly template tests passed");
