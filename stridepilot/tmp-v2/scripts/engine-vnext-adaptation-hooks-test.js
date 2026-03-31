"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const benchmark_1 = require("../src/lib/engine-v2/benchmark");
const engine_1 = require("../src/lib/engine-v2/engine");
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
    strict_1.default.ok(plan.adaptationHooks, "Generated plan should include plan-level adaptation hooks");
    strict_1.default.equal(plan.adaptationHooks?.adaptationReady, true, "Plan should be marked adaptation-ready");
    strict_1.default.ok((plan.adaptationHooks?.boundaryWeeks.length ?? 0) > 0, "Plan should expose block/phase boundaries");
}
{
    const plan = (0, engine_1.generateEngineV2Plan)(beginnerInput);
    strict_1.default.ok(plan.weeks.every((week) => week.adaptationHooks), "Every generated week should expose adaptation hooks");
    strict_1.default.ok(plan.weeks.some((week) => week.adaptationHooks?.progressionGate === "open"), "Standard plans should expose at least one open progression week");
}
{
    const beginnerPlan = (0, engine_1.generateEngineV2Plan)(beginnerInput);
    const returnPlan = (0, engine_1.generateEngineV2Plan)(returnInput);
    const beginnerRestricted = beginnerPlan.weeks.filter((week) => week.adaptationHooks?.progressionGate === "restricted").length;
    const returnRestricted = returnPlan.weeks.filter((week) => week.adaptationHooks?.progressionGate === "restricted").length;
    strict_1.default.equal(returnPlan.adaptationHooks?.protectedRunner, true, "Return-to-running plan should be marked as protected");
    strict_1.default.equal(returnPlan.adaptationHooks?.progressionMode, "conservative", "Return-to-running plan should expose conservative progression mode");
    strict_1.default.ok(returnRestricted > beginnerRestricted, "Return-to-running plan should expose more restrictive progression hooks than a beginner finish plan");
}
{
    const plan = (0, engine_1.generateEngineV2Plan)(beginnerInput);
    const restrictiveWeeks = plan.weeks.filter((week) => week.isRaceWeek || week.phase === "taper");
    strict_1.default.ok(restrictiveWeeks.length > 0, "Plan should contain taper or race week");
    strict_1.default.ok(restrictiveWeeks.every((week) => week.adaptationHooks?.progressionGate === "restricted" &&
        week.adaptationHooks?.longRunAdvanceEligible === false &&
        week.adaptationHooks?.sessionCountAdvanceEligible === false), "Taper and race weeks should expose restrictive adaptation hooks");
}
{
    const plan = (0, engine_1.generateEngineV2Plan)(beginnerInput);
    const cutbackWeek = plan.weeks.find((week) => week.isCutback);
    strict_1.default.ok(cutbackWeek, "Plan should contain a cutback week");
    strict_1.default.equal(cutbackWeek?.adaptationHooks?.repeatWeekCandidate, true, "Cutback weeks should be repeat candidates");
    strict_1.default.equal(cutbackWeek?.adaptationHooks?.recoveryMicrocycleCandidate, true, "Cutback weeks should be recovery microcycle candidates");
}
{
    const result = (0, benchmark_1.evaluateBenchmarkRunner)(benchmark_1.referenceRunnerBenchmarks[0]);
    strict_1.default.ok(result.summaryScore >= 0, "Benchmark evaluation should still run after adaptation hook schema extension");
    const plan = (0, engine_1.generateEngineV2Plan)(benchmark_1.referenceRunnerBenchmarks[0].input);
    strict_1.default.ok(plan.vNextValidation, "Validator output should still be present on generated plans");
}
console.log("engine-vnext adaptation hooks tests passed");
