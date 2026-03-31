"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const engine_1 = require("../src/lib/engine-v2/engine");
const benchmarkFixtures_1 = require("../src/lib/engine-v2/benchmark/benchmarkFixtures");
const validatePlan_1 = require("../src/lib/engine-vnext/validators/validatePlan");
function fixturePlan(id) {
    const fixture = benchmarkFixtures_1.referenceRunnerBenchmarks.find((entry) => entry.id === id);
    strict_1.default.ok(fixture, `Missing benchmark fixture: ${id}`);
    return (0, engine_1.generateEngineV2Plan)(fixture.input);
}
function target10kPlan() {
    const input = {
        raceDistance: "10K",
        goalType: "target_time",
        startDate: "2026-01-05",
        goalDate: "2026-04-05",
        requestedDurationWeeks: 12,
        ambitionPreference: "standard",
        currentContinuousRunMin: 42,
        currentWeeklyRuns: 4,
        currentWeeklyVolumeKm: 28,
        longestRecentRunMin: 70,
        recentConsistency: 0.78,
        availableTrainingDays: ["tuesday", "thursday", "saturday", "sunday"],
        preferredLongRunDay: "sunday",
        typicalAvailableTimeMin: 70,
        trainingStylePreference: "balanced",
        externalTrainingLoad: "light",
        injuryConcern: "low",
        confidence: 0.7,
        experienceLevel: "recreational",
    };
    return (0, engine_1.generateEngineV2Plan)(input);
}
function complexity(week) {
    return week.sessions.reduce((score, session) => {
        if (session.isRaceEvent)
            return score;
        if (session.family === "intervals" || session.family === "hill_reps")
            return score + 3;
        if (session.family === "tempo_run" || session.family === "race_specific" || session.family === "progression_run")
            return score + 2;
        if (session.family === "strides_session" || session.family === "steady_run")
            return score + 1;
        return score;
    }, 0);
}
function families(week) {
    return week.sessions.map((session) => session.family);
}
function taperWeeks(plan) {
    return plan.weeks.filter((week) => week.phase === "taper" && !week.isRaceWeek);
}
function buildLikeWeeks(plan) {
    return plan.weeks.filter((week) => week.phase === "build" || week.phase === "specific" || week.phase === "peak");
}
{
    const plan = fixturePlan("true_beginner_5k_no_walk");
    const buildWeek = buildLikeWeeks(plan)[0];
    const taperWeek = taperWeeks(plan)[0];
    const raceWeek = plan.weeks.find((week) => week.isRaceWeek);
    strict_1.default.ok(buildWeek && taperWeek && raceWeek, "Expected build, taper and race week");
    strict_1.default.ok(complexity(taperWeek) <= complexity(buildWeek), "5K finish taper should be simpler than build");
    strict_1.default.ok(complexity(raceWeek) <= complexity(buildWeek), "5K finish race week should be simpler than build");
}
{
    const plan = target10kPlan();
    const raceWeek = plan.weeks.find((week) => week.isRaceWeek);
    strict_1.default.ok(raceWeek, "Expected 10K target-time race week");
    const sharpeningCount = raceWeek.sessions.filter((session) => !session.isRaceEvent && (session.family === "race_specific" || session.family === "strides_session" || session.family === "tempo_run")).length;
    strict_1.default.ok(sharpeningCount <= 1, "10K target-time race week should keep sharpening limited");
    strict_1.default.ok(!families(raceWeek).includes("long_run"), "10K target-time race week should not include a standard long run");
}
{
    const plan = fixturePlan("half_marathon_finish");
    const taperWeek = taperWeeks(plan)[0];
    const comparison = buildLikeWeeks(plan).at(-1);
    strict_1.default.ok(taperWeek && comparison, "Expected half-marathon taper week and comparison week");
    strict_1.default.ok(complexity(taperWeek) < complexity(comparison) || taperWeek.longRunTargetMin < comparison.longRunTargetMin, "Half taper should be visibly different from normal build/specific weeks");
}
{
    const plan = fixturePlan("marathon_finish");
    const raceWeek = plan.weeks.find((week) => week.isRaceWeek);
    const peakVolume = Math.max(...buildLikeWeeks(plan).map((week) => week.volumeTargetMin));
    strict_1.default.ok(raceWeek, "Expected marathon race week");
    strict_1.default.ok(raceWeek.volumeTargetMin < peakVolume * 0.6, "Marathon race week should be materially lighter than peak/build");
    strict_1.default.ok(taperWeeks(plan).every((week) => week.volumeTargetMin < peakVolume), "Marathon taper weeks should be lighter than peak/build");
}
{
    const plans = [fixturePlan("true_beginner_5k_no_walk"), target10kPlan(), fixturePlan("half_marathon_finish"), fixturePlan("marathon_finish")];
    for (const plan of plans) {
        const raceWeek = plan.weeks.find((week) => week.isRaceWeek);
        strict_1.default.ok(raceWeek, "Expected race week");
        strict_1.default.ok(!families(raceWeek).includes("long_run"), "Race week should contain no standard long run");
    }
}
{
    const plan = fixturePlan("marathon_finish");
    const raceWeek = plan.weeks.find((week) => week.isRaceWeek);
    strict_1.default.ok(raceWeek, "Expected finish race week");
    const illegal = raceWeek.sessions.filter((session) => !session.isRaceEvent && (session.family === "tempo_run" || session.family === "intervals" || session.family === "race_specific"));
    strict_1.default.equal(illegal.length, 0, "Finish race week should not contain illegal quality");
}
{
    const plan = fixturePlan("half_marathon_improve");
    const report = (0, validatePlan_1.validateVNextPlan)(plan);
    strict_1.default.ok(Array.isArray(report.results), "Validator should still run on generated benchmark plans");
}
{
    const plans = [fixturePlan("true_beginner_5k_no_walk"), target10kPlan(), fixturePlan("half_marathon_finish"), fixturePlan("marathon_finish")];
    for (const plan of plans) {
        const raceWeek = plan.weeks.find((week) => week.isRaceWeek);
        strict_1.default.ok(raceWeek?.sessions.some((session) => session.isRaceEvent), "Race week should contain an explicit race-event session");
    }
}
console.log("engine-vnext endgame tests passed");
