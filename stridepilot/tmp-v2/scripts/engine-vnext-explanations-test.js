"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const benchmark_1 = require("../src/lib/engine-v2/benchmark");
const engine_1 = require("../src/lib/engine-v2/engine");
const adaptation_1 = require("../src/lib/engine-v2/engine/adaptation");
const buildExplanationPayload_1 = require("../src/lib/engine-vnext/explanations/buildExplanationPayload");
const promptContracts_1 = require("../src/lib/engine-vnext/explanations/promptContracts");
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
    const payload = (0, buildExplanationPayload_1.buildPlanExplanationPayload)(plan);
    strict_1.default.equal(payload.kind, "plan_summary");
    strict_1.default.equal(payload.runnerContext.planType, plan.planTypeDecision.planType, "Plan payload should stay grounded in deterministic plan fields");
    strict_1.default.equal(payload.progressionSummary.totalWeeks, plan.weeks.length);
    strict_1.default.ok(payload.groundingFacts.length > 0, "Plan payload should include explicit grounding facts");
}
{
    const plan = (0, engine_1.generateEngineV2Plan)(beginnerInput);
    const week = plan.weeks.find((entry) => entry.phase === "build") ?? plan.weeks[0];
    const payload = (0, buildExplanationPayload_1.buildWeekExplanationPayload)(plan, week.weekIndex);
    strict_1.default.equal(payload.kind, "week_summary");
    strict_1.default.equal(payload.weekContext.weekIndex, week.weekIndex);
    strict_1.default.equal(payload.structureSummary.sessionCount, week.sessions.length);
    strict_1.default.deepEqual(payload.structureSummary.sessionSummaries.map((session) => session.family), week.sessions.map((session) => session.family), "Week payload should reflect the actual week structure");
}
{
    const plan = (0, engine_1.generateEngineV2Plan)(beginnerInput);
    const openBuildWeek = plan.weeks.find((week) => week.phase === "build" && week.adaptationHooks?.progressionGate === "open");
    const cutbackWeek = plan.weeks.find((week) => week.isCutback);
    strict_1.default.ok(openBuildWeek && cutbackWeek, "Expected deterministic weeks for adaptive explanation coverage");
    const noOp = (0, adaptation_1.runVNextAdaptivePass)(plan, {
        targetWeekIndex: openBuildWeek.weekIndex,
        sessionsCompleted: openBuildWeek.sessions.length,
        sessionsPlanned: openBuildWeek.sessions.length,
        fatigue: "low",
        painFlag: false,
        confidence: "normal",
    });
    const repeat = (0, adaptation_1.runVNextAdaptivePass)(plan, {
        targetWeekIndex: cutbackWeek.weekIndex,
        sessionsCompleted: 1,
        sessionsPlanned: cutbackWeek.sessions.length,
        fatigue: "moderate",
        painFlag: false,
        confidence: "normal",
    });
    const recovery = (0, adaptation_1.runVNextAdaptivePass)(plan, {
        targetWeekIndex: cutbackWeek.weekIndex,
        sessionsCompleted: Math.max(1, cutbackWeek.sessions.length - 1),
        sessionsPlanned: cutbackWeek.sessions.length,
        fatigue: "high",
        painFlag: false,
        confidence: "normal",
    });
    const noOpPayload = (0, buildExplanationPayload_1.buildAdaptationExplanationPayload)(noOp);
    const repeatPayload = (0, buildExplanationPayload_1.buildAdaptationExplanationPayload)(repeat);
    const recoveryPayload = (0, buildExplanationPayload_1.buildAdaptationExplanationPayload)(recovery);
    strict_1.default.equal(noOpPayload.adaptationContext.action, "keep_current_progression");
    strict_1.default.equal(noOpPayload.adaptationContext.applied, false);
    strict_1.default.equal(repeatPayload.adaptationContext.action, "repeat_current_week");
    strict_1.default.equal(repeatPayload.adaptationContext.applied, true);
    strict_1.default.equal(recoveryPayload.adaptationContext.action, "insert_recovery_microcycle");
    strict_1.default.equal(recoveryPayload.adaptationContext.mutationType, "insert_recovery_microcycle");
}
{
    const plan = (0, engine_1.generateEngineV2Plan)(returnInput);
    const buildWeek = plan.weeks.find((week) => week.phase === "build");
    strict_1.default.ok(buildWeek, "Expected protected-runner build week");
    const result = (0, adaptation_1.runVNextAdaptivePass)(plan, {
        targetWeekIndex: buildWeek.weekIndex,
        sessionsCompleted: 1,
        sessionsPlanned: buildWeek.sessions.length,
        fatigue: "moderate",
        painFlag: true,
        confidence: "low",
    });
    const payload = (0, buildExplanationPayload_1.buildAdaptationExplanationPayload)(result);
    strict_1.default.equal(payload.runnerContext.protectedRunner, true, "Protected-runner explanation payload should surface conservative context");
    strict_1.default.equal(payload.adaptationContext.conservativeBias, true, "Protected-runner explanation payload should include conservative rationale");
}
{
    const plan = (0, engine_1.generateEngineV2Plan)(beginnerInput);
    const planContract = (0, promptContracts_1.buildPlanExplanationPromptContract)((0, buildExplanationPayload_1.buildPlanExplanationPayload)(plan));
    const weekContract = (0, promptContracts_1.buildWeekExplanationPromptContract)((0, buildExplanationPayload_1.buildWeekExplanationPayload)(plan, plan.weeks[0].weekIndex));
    const adaptiveResult = (0, adaptation_1.runVNextAdaptivePass)(plan, {
        targetWeekIndex: plan.weeks[0].weekIndex,
        sessionsCompleted: plan.weeks[0].sessions.length,
        sessionsPlanned: plan.weeks[0].sessions.length,
        fatigue: "low",
        painFlag: false,
        confidence: "normal",
    });
    const adaptationContract = (0, promptContracts_1.buildAdaptationExplanationPromptContract)((0, buildExplanationPayload_1.buildAdaptationExplanationPayload)(adaptiveResult));
    for (const contract of [planContract, weekContract, adaptationContract]) {
        const joined = `${contract.systemInstruction} ${contract.immutabilityRules.join(" ")}`;
        strict_1.default.ok(joined.includes("Do not invent or change session counts"), "Prompt contract should forbid changing plan structure or numbers");
        strict_1.default.ok(joined.includes("immutable"), "Prompt contract should treat the canonical plan as immutable");
    }
    strict_1.default.ok(promptContracts_1.EXPLANATION_IMMUTABILITY_RULES.length >= 4, "Immutability rules should be explicit and non-trivial");
}
{
    const benchmark = (0, benchmark_1.evaluateBenchmarkRunner)(benchmark_1.referenceRunnerBenchmarks[0]);
    strict_1.default.ok(benchmark.summaryScore >= 0, "Benchmark flow should still run after explanation layer addition");
}
console.log("engine-vnext explanations tests passed");
