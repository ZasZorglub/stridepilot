"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const benchmark_1 = require("../src/lib/engine-v2/benchmark");
const engine_1 = require("../src/lib/engine-v2/engine");
const adaptation_1 = require("../src/lib/engine-v2/engine/adaptation");
const beginnerInput = {
    raceDistance: "5K",
    goalType: "finish",
    startDate: "2026-03-23",
    goalDate: "2026-06-28",
    currentContinuousRunMin: 18,
    currentWeeklyRuns: 3,
    currentWeeklyVolumeKm: 14,
    longestRecentRunMin: 24,
    recentConsistency: 0.6,
    availableTrainingDays: ["tuesday", "thursday", "sunday"],
    typicalAvailableTimeMin: 40,
    trainingStylePreference: "balanced",
    experienceLevel: "new",
    injuryConcern: "low",
    externalTrainingLoad: "light",
    confidence: 3,
};
const returnInput = {
    raceDistance: "5K",
    goalType: "return_to_running",
    startDate: "2026-03-23",
    goalDate: "2026-06-28",
    currentContinuousRunMin: 8,
    currentWeeklyRuns: 2,
    currentWeeklyVolumeKm: 8,
    longestRecentRunMin: 15,
    recentConsistency: 0.42,
    availableTrainingDays: ["tuesday", "thursday", "sunday"],
    typicalAvailableTimeMin: 35,
    trainingStylePreference: "conservative",
    experienceLevel: "new",
    injuryConcern: "moderate",
    externalTrainingLoad: "light",
    confidence: 2,
};
{
    const plan = (0, engine_1.generateEngineV2Plan)(beginnerInput);
    const buildWeek = plan.weeks.find((week) => week.phase === "build" && week.adaptationHooks?.progressionGate === "open");
    strict_1.default.ok(buildWeek, "Expected an open build week");
    const decision = (0, adaptation_1.decideVNextAdaptation)(plan, {
        targetWeekIndex: buildWeek.weekIndex,
        sessionsCompleted: buildWeek.sessions.length,
        sessionsPlanned: buildWeek.sessions.length,
        fatigue: "low",
        painFlag: false,
        confidence: "normal",
    });
    strict_1.default.equal(decision.action, "keep_current_progression", "Compliant low-fatigue case should keep progression");
}
{
    const plan = (0, engine_1.generateEngineV2Plan)(beginnerInput);
    const cutbackWeek = plan.weeks.find((week) => week.isCutback);
    strict_1.default.ok(cutbackWeek, "Expected a cutback week");
    const decision = (0, adaptation_1.decideVNextAdaptation)(plan, {
        targetWeekIndex: cutbackWeek.weekIndex,
        sessionsCompleted: 1,
        sessionsPlanned: cutbackWeek.sessions.length,
        fatigue: "moderate",
        painFlag: false,
        confidence: "normal",
    });
    strict_1.default.equal(decision.action, "repeat_current_week", "Low compliance should be able to repeat the current week");
}
{
    const plan = (0, engine_1.generateEngineV2Plan)(returnInput);
    const buildWeek = plan.weeks.find((week) => week.phase === "build");
    strict_1.default.ok(buildWeek, "Expected a return-mode build week");
    const decision = (0, adaptation_1.decideVNextAdaptation)(plan, {
        targetWeekIndex: buildWeek.weekIndex,
        sessionsCompleted: 1,
        sessionsPlanned: buildWeek.sessions.length,
        fatigue: "moderate",
        painFlag: true,
        confidence: "low",
    });
    strict_1.default.ok(decision.action === "insert_recovery_microcycle" || decision.action === "downshift_next_week", "Protected runner with pain should get a conservative decision");
    strict_1.default.equal(decision.conservativeBias, true, "Protected runner decision should expose conservative bias");
}
{
    const plan = (0, engine_1.generateEngineV2Plan)(beginnerInput);
    const cutbackWeek = plan.weeks.find((week) => week.isCutback);
    strict_1.default.ok(cutbackWeek, "Expected a cutback week");
    const decision = (0, adaptation_1.decideVNextAdaptation)(plan, {
        targetWeekIndex: cutbackWeek.weekIndex,
        sessionsCompleted: Math.max(1, cutbackWeek.sessions.length - 1),
        sessionsPlanned: cutbackWeek.sessions.length,
        fatigue: "high",
        painFlag: false,
        confidence: "normal",
    });
    strict_1.default.equal(decision.action, "insert_recovery_microcycle", "Recovery candidate with high fatigue should insert recovery microcycle");
}
{
    const plan = (0, engine_1.generateEngineV2Plan)(beginnerInput);
    const taperWeek = plan.weeks.find((week) => week.phase === "taper");
    strict_1.default.ok(taperWeek, "Expected a taper week");
    const decision = (0, adaptation_1.decideVNextAdaptation)(plan, {
        targetWeekIndex: taperWeek.weekIndex,
        sessionsCompleted: taperWeek.sessions.length,
        sessionsPlanned: taperWeek.sessions.length,
        fatigue: "low",
        painFlag: false,
        confidence: "high",
    });
    strict_1.default.equal(decision.action, "keep_current_progression", "Taper/race week should resist inappropriate adaptation");
    strict_1.default.ok(decision.reasonCodes.includes("restricted_phase"), "Restricted endgame weeks should explain the restriction");
}
{
    const plan = (0, engine_1.generateEngineV2Plan)(benchmark_1.referenceRunnerBenchmarks[0].input);
    const week = plan.weeks.find((entry) => entry.phase === "build") ?? plan.weeks[0];
    const decision = (0, adaptation_1.decideVNextAdaptation)(plan, {
        targetWeekIndex: week.weekIndex,
        sessionsCompleted: week.sessions.length,
        sessionsPlanned: week.sessions.length,
        fatigue: "low",
        painFlag: false,
        confidence: "normal",
    });
    strict_1.default.ok(decision.action.length > 0, "Decision function should run on real generated plans");
    const benchmark = (0, benchmark_1.evaluateBenchmarkRunner)(benchmark_1.referenceRunnerBenchmarks[0]);
    strict_1.default.ok(benchmark.summaryScore >= 0, "Benchmark flow should still run after adaptation decision addition");
}
console.log("engine-vnext adaptation decision tests passed");
