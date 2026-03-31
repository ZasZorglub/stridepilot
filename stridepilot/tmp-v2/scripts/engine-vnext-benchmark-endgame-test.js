"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const benchmark_1 = require("../src/lib/engine-v2/benchmark");
const engine_1 = require("../src/lib/engine-v2/engine");
function benchmarkById(id) {
    const fixture = benchmark_1.referenceRunnerBenchmarks.find((entry) => entry.id === id);
    strict_1.default.ok(fixture, `Missing benchmark fixture: ${id}`);
    return fixture;
}
function target10kInput() {
    return {
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
}
function clone(value) {
    return structuredClone(value);
}
function evaluateInlinePlan(plan) {
    const fixture = benchmarkById("half_marathon_finish");
    return (0, benchmark_1.evaluateBenchmarkPlan)({ ...fixture, input: plan.resolvedInput }, plan);
}
{
    const plan = (0, engine_1.generateEngineV2Plan)(benchmarkById("true_beginner_5k_no_walk").input);
    const raceWeek = plan.weeks.find((week) => week.isRaceWeek);
    strict_1.default.ok(raceWeek?.sessions.some((session) => session.isRaceEvent), "Expected explicit race event");
    strict_1.default.equal(raceWeek?.longRunTargetMin, 0, "Expected no normal long run in race week");
    const result = (0, benchmark_1.evaluateBenchmarkRunner)(benchmarkById("true_beginner_5k_no_walk"));
    strict_1.default.ok(!result.raceWeekFit.notes.some((note) => note.includes("above allowed")), "Race week with race event and zero long run should not be penalized as invalid long run");
}
{
    const result = (0, benchmark_1.evaluateBenchmarkRunner)(benchmarkById("true_beginner_5k_no_walk"));
    strict_1.default.notEqual(result.raceWeekFit.status, "out_of_band", "5K finish endgame should be accepted under new rubric");
}
{
    const plan = (0, engine_1.generateEngineV2Plan)(target10kInput());
    const raceWeek = plan.weeks.find((week) => week.isRaceWeek);
    strict_1.default.ok(raceWeek, "Expected race week");
    const sharpening = raceWeek.sessions.filter((session) => !session.isRaceEvent && (session.family === "race_specific" || session.family === "tempo_run" || session.family === "intervals" || session.family === "strides_session"));
    strict_1.default.ok(sharpening.length <= 1, "10K target-time race week should allow only limited sharpening");
}
{
    const half = (0, benchmark_1.evaluateBenchmarkRunner)(benchmarkById("half_marathon_finish"));
    const fiveK = (0, benchmark_1.evaluateBenchmarkRunner)(benchmarkById("true_beginner_5k_no_walk"));
    strict_1.default.ok(half.longRunFit.notes.some((note) => note.includes("Pre-race taper reduction")) ||
        fiveK.longRunFit.notes.some((note) => note.includes("Pre-race taper reduction")) ||
        half.longRunFit.status !== fiveK.longRunFit.status, "Half marathon taper should now be interpreted separately from 5K taper");
}
{
    const result = (0, benchmark_1.evaluateBenchmarkRunner)(benchmarkById("marathon_finish"));
    strict_1.default.ok(!result.raceWeekFit.notes.some((note) => note.includes("above allowed 70%")), "Marathon race week should no longer be judged by expecting a leftover long run fraction");
}
{
    const plan = clone((0, engine_1.generateEngineV2Plan)(benchmarkById("half_marathon_finish").input));
    const raceWeek = plan.weeks.find((week) => week.isRaceWeek);
    strict_1.default.ok(raceWeek, "Expected finish race week");
    raceWeek.sessions = raceWeek.sessions.map((session, index) => session.isRaceEvent
        ? session
        : index === 0
            ? { ...session, family: "tempo_run" }
            : { ...session, family: "easy_run" });
    const result = evaluateInlinePlan(plan);
    strict_1.default.ok(result.raceWeekFit.notes.some((note) => note.includes("Finish race week still contains non-race performance work.")) ||
        result.raceWeekFit.status !== "within_band", "Finish race week with tempo/interval non-race work should still be penalized");
}
{
    const result = (0, benchmark_1.evaluateBenchmarkRunner)(benchmarkById("marathon_improve"));
    strict_1.default.equal(typeof result.raceWeekFit.status, "string");
    strict_1.default.equal(typeof result.longRunFit.status, "string");
}
{
    const plan = (0, engine_1.generateEngineV2Plan)(benchmarkById("beginner_plus_10k_finish").input);
    const raceWeek = plan.weeks.find((week) => week.isRaceWeek);
    strict_1.default.ok(raceWeek, "Expected 10K race week");
    const raceEvent = raceWeek.sessions.find((session) => session.isRaceEvent);
    const priorLongest = Math.max(0, ...plan.weeks.flatMap((week) => week.sessions).filter((session) => !session.isRaceEvent).map((session) => session.durationMin));
    strict_1.default.ok(raceEvent, "Expected explicit 10K race event");
    strict_1.default.ok(raceEvent.durationMin >= priorLongest * 0.6, "10K race event should remain materially representative of prior preparation instead of collapsing into a short taper jog");
}
{
    const plan = (0, engine_1.generateEngineV2Plan)(benchmarkById("half_marathon_finish").input);
    const raceWeek = plan.weeks.find((week) => week.isRaceWeek);
    strict_1.default.ok(raceWeek, "Expected half marathon race week");
    const raceEvent = raceWeek.sessions.find((session) => session.isRaceEvent);
    const priorLongest = Math.max(0, ...plan.weeks.flatMap((week) => week.sessions).filter((session) => !session.isRaceEvent).map((session) => session.durationMin));
    strict_1.default.ok(raceEvent, "Expected explicit half marathon race event");
    strict_1.default.ok(raceEvent.durationMin >= priorLongest * 0.7, "Half marathon race event should stay credibly close to prior long-run durability");
}
{
    const plan = (0, engine_1.generateEngineV2Plan)(benchmarkById("marathon_improve").input);
    const raceWeek = plan.weeks.find((week) => week.isRaceWeek);
    strict_1.default.ok(raceWeek, "Expected marathon race week");
    const raceEvent = raceWeek.sessions.find((session) => session.isRaceEvent);
    const priorLongest = Math.max(0, ...plan.weeks.flatMap((week) => week.sessions).filter((session) => !session.isRaceEvent).map((session) => session.durationMin));
    strict_1.default.ok(raceEvent, "Expected explicit marathon race event");
    strict_1.default.ok(raceEvent.durationMin >= priorLongest * 0.72, "Marathon race event should remain a credible culmination of the plan while still tapering overall load");
}
console.log("engine-vnext benchmark endgame tests passed");
