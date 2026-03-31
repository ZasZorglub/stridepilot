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
    const result = (0, adaptation_1.runVNextAdaptivePass)(plan, {
        targetWeekIndex: buildWeek.weekIndex,
        sessionsCompleted: buildWeek.sessions.length,
        sessionsPlanned: buildWeek.sessions.length,
        fatigue: "low",
        painFlag: false,
        confidence: "normal",
    });
    strict_1.default.equal(result.decision.action, "keep_current_progression", "Compliant low-fatigue case should keep progression");
    strict_1.default.equal(result.applied, false, "Keep-progression path should not mutate plan");
    strict_1.default.equal(result.mutation.mutationType, "noop");
    strict_1.default.equal(result.fallback, true);
}
{
    const plan = (0, engine_1.generateEngineV2Plan)(beginnerInput);
    const cutbackWeek = plan.weeks.find((week) => week.isCutback);
    strict_1.default.ok(cutbackWeek, "Expected a cutback week");
    const result = (0, adaptation_1.runVNextAdaptivePass)(plan, {
        targetWeekIndex: cutbackWeek.weekIndex,
        sessionsCompleted: 1,
        sessionsPlanned: cutbackWeek.sessions.length,
        fatigue: "moderate",
        painFlag: false,
        confidence: "normal",
    });
    strict_1.default.equal(result.decision.action, "repeat_current_week", "Low compliance should produce repeat decision");
    strict_1.default.equal(result.mutation.mutationType, "repeat_current_week", "Repeat decision should flow into repeat mutation");
    strict_1.default.equal(result.applied, true, "Repeat path should mutate when safe");
}
{
    const plan = (0, engine_1.generateEngineV2Plan)(beginnerInput);
    const cutbackWeek = plan.weeks.find((week) => week.isCutback);
    strict_1.default.ok(cutbackWeek, "Expected a cutback week");
    const result = (0, adaptation_1.runVNextAdaptivePass)(plan, {
        targetWeekIndex: cutbackWeek.weekIndex,
        sessionsCompleted: Math.max(1, cutbackWeek.sessions.length - 1),
        sessionsPlanned: cutbackWeek.sessions.length,
        fatigue: "high",
        painFlag: false,
        confidence: "normal",
    });
    strict_1.default.equal(result.decision.action, "insert_recovery_microcycle", "High fatigue on recovery candidate should prefer recovery microcycle");
    strict_1.default.equal(result.mutation.mutationType, "insert_recovery_microcycle");
    strict_1.default.equal(result.applied, true);
}
{
    const plan = (0, engine_1.generateEngineV2Plan)(returnInput);
    const buildWeek = plan.weeks.find((week) => week.phase === "build");
    strict_1.default.ok(buildWeek, "Expected a protected-runner build week");
    const result = (0, adaptation_1.runVNextAdaptivePass)(plan, {
        targetWeekIndex: buildWeek.weekIndex,
        sessionsCompleted: 1,
        sessionsPlanned: buildWeek.sessions.length,
        fatigue: "moderate",
        painFlag: true,
        confidence: "low",
    });
    strict_1.default.equal(result.originalPlanMeta.protectedRunner, true, "Protected runner metadata should be surfaced");
    strict_1.default.equal(result.decision.conservativeBias, true, "Protected runner should preserve conservative bias through orchestration");
    if (result.applied) {
        strict_1.default.equal(result.mutation.conservativeBiasApplied, true, "Applied protected-runner mutation should reflect conservative bias");
    }
    else {
        strict_1.default.equal(result.fallback, true, "Protected runner no-op should still be surfaced as a safe fallback");
    }
}
{
    const plan = (0, engine_1.generateEngineV2Plan)(beginnerInput);
    const week = plan.weeks.find((entry) => entry.phase === "build") ?? plan.weeks[0];
    const result = (0, adaptation_1.runVNextAdaptivePass)(plan, {
        targetWeekIndex: week.weekIndex,
        sessionsCompleted: week.sessions.length,
        sessionsPlanned: week.sessions.length,
        fatigue: "low",
        painFlag: false,
        confidence: "normal",
    });
    strict_1.default.equal(typeof result.originalPlanMeta.totalWeeks, "number", "Plan metadata should be machine-readable");
    strict_1.default.equal(typeof result.finalValidation.passed, "boolean", "Validation summary should be machine-readable");
    strict_1.default.ok(Array.isArray(result.decision.reasonCodes), "Decision reason codes should remain machine-readable");
}
{
    const plan = (0, engine_1.generateEngineV2Plan)(benchmark_1.referenceRunnerBenchmarks[0].input);
    const week = plan.weeks.find((entry) => entry.phase === "build") ?? plan.weeks[0];
    const result = (0, adaptation_1.runVNextAdaptivePass)(plan, {
        targetWeekIndex: week.weekIndex,
        sessionsCompleted: week.sessions.length,
        sessionsPlanned: week.sessions.length,
        fatigue: "low",
        painFlag: false,
        confidence: "normal",
    });
    strict_1.default.ok(result.finalValidation.vNextHardFailCount >= 0, "Validator summary should be available after orchestration");
    const benchmark = (0, benchmark_1.evaluateBenchmarkRunner)(benchmark_1.referenceRunnerBenchmarks[0]);
    strict_1.default.ok(benchmark.summaryScore >= 0, "Benchmark flow should still run after adaptive orchestrator addition");
}
console.log("engine-vnext adaptive pass tests passed");
