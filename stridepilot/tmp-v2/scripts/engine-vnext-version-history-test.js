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
{
    const plan = (0, engine_1.generateEngineV2Plan)(beginnerInput);
    strict_1.default.ok(plan.versionMetadata, "Generated plan should expose base version metadata");
    strict_1.default.equal(plan.versionMetadata?.versionNumber, 1, "Base generated plan should start at version 1");
    strict_1.default.equal(plan.versionMetadata?.isAdaptiveDerivative, false, "Base generated plan should not be marked as derivative");
    strict_1.default.ok(plan.versionMetadata?.planId, "Generated plan should carry a stable plan id");
    strict_1.default.deepEqual(plan.mutationHistory, [], "Generated plan should start with empty mutation history");
}
{
    const plan = (0, engine_1.generateEngineV2Plan)(beginnerInput);
    const cutbackWeek = plan.weeks.find((week) => week.isCutback);
    strict_1.default.ok(cutbackWeek, "Expected cutback week for applied mutation case");
    const result = (0, adaptation_1.runVNextAdaptivePass)(plan, {
        targetWeekIndex: cutbackWeek.weekIndex,
        sessionsCompleted: 1,
        sessionsPlanned: cutbackWeek.sessions.length,
        fatigue: "moderate",
        painFlag: false,
        confidence: "normal",
    });
    strict_1.default.equal(result.applied, true, "Expected applied adaptive pass");
    strict_1.default.equal(result.finalPlan.versionMetadata?.versionNumber, 2, "Applied mutation should increment plan version");
    strict_1.default.equal(result.finalPlan.versionMetadata?.derivedFromVersionNumber, 1, "Applied mutation should record source version");
    strict_1.default.equal(result.finalPlan.versionMetadata?.isAdaptiveDerivative, true, "Applied mutation should mark plan as adaptive derivative");
    strict_1.default.equal(result.finalPlan.mutationHistory?.length, 1, "Applied mutation should append history entry");
}
{
    const plan = (0, engine_1.generateEngineV2Plan)(beginnerInput);
    const buildWeek = plan.weeks.find((week) => week.phase === "build" && week.adaptationHooks?.progressionGate === "open");
    strict_1.default.ok(buildWeek, "Expected open build week for no-op path");
    const result = (0, adaptation_1.runVNextAdaptivePass)(plan, {
        targetWeekIndex: buildWeek.weekIndex,
        sessionsCompleted: buildWeek.sessions.length,
        sessionsPlanned: buildWeek.sessions.length,
        fatigue: "low",
        painFlag: false,
        confidence: "normal",
    });
    strict_1.default.equal(result.applied, false, "Keep-progression path should remain a no-op");
    strict_1.default.equal(result.finalPlan.versionMetadata?.versionNumber, 1, "No-op adaptive pass should preserve plan version");
    strict_1.default.equal(result.historyEntry.applied, false, "History should record no-op clearly");
    strict_1.default.equal(result.finalPlan.mutationHistory?.length, 1, "No-op adaptive pass should still append a history event");
}
{
    const plan = (0, engine_1.generateEngineV2Plan)(beginnerInput);
    const taperSource = plan.weeks.find((week) => !week.isRaceWeek &&
        week.phase !== "taper" &&
        plan.weeks.some((candidate) => candidate.weekIndex === week.weekIndex + 1 && candidate.phase === "taper"));
    strict_1.default.ok(taperSource, "Expected source week that would mutate into taper");
    const result = (0, adaptation_1.runVNextAdaptivePass)(plan, {
        targetWeekIndex: taperSource.weekIndex,
        sessionsCompleted: 0,
        sessionsPlanned: taperSource.sessions.length,
        fatigue: "moderate",
        painFlag: false,
        confidence: "normal",
    });
    strict_1.default.equal(result.decision.action, "repeat_current_week", "Low compliance should still request a local mutation");
    strict_1.default.equal(result.applied, false, "Unsafe mutation target should not be applied");
    strict_1.default.equal(result.fallback, true, "Unsafe mutation attempt should be surfaced as fallback");
    strict_1.default.equal(result.historyEntry.fallback, true, "History should distinguish fallback from success");
}
{
    const plan = (0, engine_1.generateEngineV2Plan)(beginnerInput);
    const cutbackWeek = plan.weeks.find((week) => week.isCutback);
    strict_1.default.ok(cutbackWeek, "Expected cutback week for history completeness");
    const result = (0, adaptation_1.runVNextAdaptivePass)(plan, {
        targetWeekIndex: cutbackWeek.weekIndex,
        sessionsCompleted: 1,
        sessionsPlanned: cutbackWeek.sessions.length,
        fatigue: "high",
        painFlag: false,
        confidence: "normal",
    });
    strict_1.default.equal(typeof result.historyEntry.entryId, "string", "History entry should have stable id");
    strict_1.default.equal(typeof result.historyEntry.sourceVersionNumber, "number", "History entry should capture source version");
    strict_1.default.equal(typeof result.historyEntry.resultingVersionNumber, "number", "History entry should capture resulting version");
    strict_1.default.ok(Array.isArray(result.historyEntry.decision.reasonCodes), "History should preserve decision details");
    strict_1.default.equal(typeof result.historyEntry.validation.passed, "boolean", "History should preserve validation summary");
}
{
    const plan = (0, engine_1.generateEngineV2Plan)(benchmark_1.referenceRunnerBenchmarks[0].input);
    strict_1.default.ok(plan.versionMetadata?.versionNumber === 1, "Benchmark-generated plans should carry base version metadata");
    const benchmark = (0, benchmark_1.evaluateBenchmarkRunner)(benchmark_1.referenceRunnerBenchmarks[0]);
    strict_1.default.ok(benchmark.summaryScore >= 0, "Benchmark flow should still run after version/history addition");
}
console.log("engine-vnext version history tests passed");
