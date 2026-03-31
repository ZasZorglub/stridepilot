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
const renderExplanation_1 = require("../src/lib/engine-vnext/explanations/renderExplanation");
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
function fakeClient(outputText) {
    return {
        responses: {
            async create(params) {
                return {
                    output_text: outputText,
                    params,
                };
            },
        },
    };
}
async function main() {
    {
        const plan = (0, engine_1.generateEngineV2Plan)(beginnerInput);
        const payload = (0, buildExplanationPayload_1.buildPlanExplanationPayload)(plan);
        const request = (0, renderExplanation_1.buildExplanationRequest)(payload, "gpt-test");
        const requestText = JSON.stringify(request);
        strict_1.default.ok(requestText.includes(plan.planTypeDecision.planType), "Plan explanation request should be grounded in deterministic plan fields");
        strict_1.default.ok(requestText.includes(String(plan.weeks.length)), "Plan explanation request should include actual plan duration");
    }
    {
        const plan = (0, engine_1.generateEngineV2Plan)(beginnerInput);
        const week = plan.weeks.find((entry) => entry.phase === "build") ?? plan.weeks[0];
        const payload = (0, buildExplanationPayload_1.buildWeekExplanationPayload)(plan, week.weekIndex);
        const request = (0, renderExplanation_1.buildExplanationRequest)(payload, "gpt-test");
        const requestText = JSON.stringify(request);
        strict_1.default.ok(requestText.includes(week.focus), "Week explanation request should be grounded in actual week data");
        strict_1.default.ok(requestText.includes(week.sessions[0].family), "Week explanation request should contain actual session families");
    }
    {
        const plan = (0, engine_1.generateEngineV2Plan)(beginnerInput);
        const openBuildWeek = plan.weeks.find((week) => week.phase === "build" && week.adaptationHooks?.progressionGate === "open");
        const cutbackWeek = plan.weeks.find((week) => week.isCutback);
        strict_1.default.ok(openBuildWeek && cutbackWeek, "Expected deterministic weeks for adaptive coverage");
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
        strict_1.default.equal((0, buildExplanationPayload_1.buildAdaptationExplanationPayload)(noOp).adaptationContext.action, "keep_current_progression");
        strict_1.default.equal((0, buildExplanationPayload_1.buildAdaptationExplanationPayload)(repeat).adaptationContext.action, "repeat_current_week");
        strict_1.default.equal((0, buildExplanationPayload_1.buildAdaptationExplanationPayload)(recovery).adaptationContext.action, "insert_recovery_microcycle");
    }
    {
        const plan = (0, engine_1.generateEngineV2Plan)(beginnerInput);
        const payload = (0, buildExplanationPayload_1.buildPlanExplanationPayload)(plan);
        const result = await (0, renderExplanation_1.renderPlanExplanation)(payload, {
            client: fakeClient("{\"bad\":true}"),
            model: "gpt-test",
        });
        strict_1.default.equal(result.source, "fallback", "Invalid model output should trigger safe fallback");
        strict_1.default.equal(result.fallbackReason, "invalid_output");
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
        const frozenPayload = JSON.parse(JSON.stringify(payload));
        const rendered = await (0, renderExplanation_1.renderAdaptationExplanation)(payload, {
            client: fakeClient(JSON.stringify({
                title: "Conservative adjustment",
                summary: "The plan stayed protective because feedback suggested caution.",
                bullets: ["A conservative bias was active.", "The action stayed grounded in the deterministic decision."],
                tone: "calm",
            })),
            model: "gpt-test",
        });
        strict_1.default.equal(rendered.source, "openai");
        strict_1.default.deepEqual(payload, frozenPayload, "Adapter must not mutate canonical explanation payloads");
    }
    {
        const plan = (0, engine_1.generateEngineV2Plan)(beginnerInput);
        const weekPayload = (0, buildExplanationPayload_1.buildWeekExplanationPayload)(plan, plan.weeks[0].weekIndex);
        const weekRendered = await (0, renderExplanation_1.renderWeekExplanation)(weekPayload, {
            client: fakeClient(JSON.stringify({
                title: "Week focus",
                summary: "This week stays simple and grounded in the actual structure.",
                bullets: ["The session count matches the payload.", "The focus stays tied to the real week data."],
                tone: "encouraging",
            })),
            model: "gpt-test",
        });
        strict_1.default.equal(weekRendered.explanation.bullets.length, 2);
        const benchmark = (0, benchmark_1.evaluateBenchmarkRunner)(benchmark_1.referenceRunnerBenchmarks[0]);
        strict_1.default.ok(benchmark.summaryScore >= 0, "Existing benchmark flow should still run after explanation adapter addition");
    }
    console.log("engine-vnext openai explanations tests passed");
}
void main();
