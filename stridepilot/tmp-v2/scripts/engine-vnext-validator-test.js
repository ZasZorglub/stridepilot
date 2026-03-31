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
function clonePlan(plan) {
    return structuredClone(plan);
}
function findWeek(plan, weekIndex) {
    const week = plan.weeks.find((entry) => entry.weekIndex === weekIndex);
    strict_1.default.ok(week, `Missing week ${weekIndex}`);
    return week;
}
function setSession(session, patch) {
    return { ...session, ...patch };
}
{
    const plan = clonePlan(fixturePlan("recreational_10k_improve"));
    const week = findWeek(plan, 1);
    const qualitySession = week.sessions.find((session) => session.family === "tempo_run" || session.family === "intervals") ?? week.sessions[0];
    const longRunSession = week.sessions.find((session) => session.role === "long_run") ?? week.sessions.at(-1);
    week.sessions = week.sessions.map((session) => {
        if (session.id === qualitySession.id)
            return setSession(session, { day: "saturday", family: "tempo_run" });
        if (session.id === longRunSession.id)
            return setSession(session, { day: "sunday", role: "long_run" });
        return session;
    });
    const report = (0, validatePlan_1.validateVNextPlan)(plan);
    strict_1.default.ok(report.results.some((result) => result.ruleId === "SP-001"), "Expected hard-before-long-run rule to trigger");
}
{
    const plan = clonePlan(fixturePlan("recreational_10k_improve"));
    const week = findWeek(plan, 1);
    week.sessions = week.sessions.map((session, index) => {
        if (index === 0)
            return setSession(session, { day: "monday", family: "tempo_run" });
        if (index === 1)
            return setSession(session, { day: "wednesday", family: "race_specific" });
        return session;
    });
    const report = (0, validatePlan_1.validateVNextPlan)(plan);
    strict_1.default.ok(report.results.some((result) => result.ruleId === "SP-002"), "Expected back-to-back quality rule to trigger");
}
{
    const plan = clonePlan(fixturePlan("half_marathon_finish"));
    const week = findWeek(plan, 1);
    week.longRunTargetMin = 90;
    week.volumeTargetMin = 180;
    const report = (0, validatePlan_1.validateVNextPlan)(plan);
    strict_1.default.ok(report.results.some((result) => result.ruleId === "ST-001"), "Expected long-run share rule to trigger");
}
{
    const plan = clonePlan(fixturePlan("true_beginner_5k_no_walk"));
    const week = findWeek(plan, 1);
    week.sessions[0] = setSession(week.sessions[0], { family: "intervals" });
    const report = (0, validatePlan_1.validateVNextPlan)(plan);
    strict_1.default.ok(report.results.some((result) => result.ruleId === "ST-002"), "Expected protected-runner intensity lock to trigger");
}
{
    const plan = clonePlan(fixturePlan("half_marathon_improve"));
    const raceWeek = plan.weeks.find((week) => week.isRaceWeek);
    strict_1.default.ok(raceWeek, "Expected race week");
    const previousWeek = plan.weeks[raceWeek.weekIndex - 2];
    raceWeek.sessions = raceWeek.sessions.map((session, index) => setSession(session, {
        family: index === 1 ? "easy_run" : session.family === "race_specific" ? "easy_run" : session.family,
    }));
    raceWeek.volumeTargetMin = previousWeek.volumeTargetMin;
    const report = (0, validatePlan_1.validateVNextPlan)(plan);
    strict_1.default.ok(report.results.some((result) => result.ruleId === "ST-003"), "Expected race-week distinctness rule to trigger");
}
{
    const plan = fixturePlan("recreational_10k_improve");
    const report = (0, validatePlan_1.validateVNextPlan)(plan);
    strict_1.default.ok(Array.isArray(report.results), "Validator should return machine-readable results");
    strict_1.default.equal(typeof report.passed, "boolean");
}
console.log("engine-vnext validator tests passed");
