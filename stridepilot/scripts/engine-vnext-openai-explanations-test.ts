import assert from "node:assert/strict";

import { evaluateBenchmarkRunner, referenceRunnerBenchmarks } from "../src/lib/engine-v2/benchmark";
import { generateEngineV2Plan } from "../src/lib/engine-v2/engine";
import { runVNextAdaptivePass } from "../src/lib/engine-v2/engine/adaptation";
import type { RunnerInput } from "../src/lib/engine-v2/models";
import {
  buildAdaptationExplanationPayload,
  buildPlanExplanationPayload,
  buildWeekExplanationPayload,
} from "../src/lib/engine-vnext/explanations/buildExplanationPayload";
import {
  buildExplanationRequest,
  renderAdaptationExplanation,
  renderPlanExplanation,
  renderWeekExplanation,
} from "../src/lib/engine-vnext/explanations/renderExplanation";

const beginnerInput: RunnerInput = {
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

const returnInput: RunnerInput = {
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

function fakeClient(outputText: string) {
  return {
    responses: {
      async create(params: unknown) {
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
    const plan = generateEngineV2Plan(beginnerInput);
    const payload = buildPlanExplanationPayload(plan);
    const request = buildExplanationRequest(payload, "gpt-test");
    const requestText = JSON.stringify(request);
    assert.ok(requestText.includes(plan.planTypeDecision.planType), "Plan explanation request should be grounded in deterministic plan fields");
    assert.ok(requestText.includes(String(plan.weeks.length)), "Plan explanation request should include actual plan duration");
  }

  {
    const plan = generateEngineV2Plan(beginnerInput);
    const week = plan.weeks.find((entry) => entry.phase === "build") ?? plan.weeks[0];
    const payload = buildWeekExplanationPayload(plan, week.weekIndex);
    const request = buildExplanationRequest(payload, "gpt-test");
    const requestText = JSON.stringify(request);
    assert.ok(requestText.includes(week.focus), "Week explanation request should be grounded in actual week data");
    assert.ok(requestText.includes(week.sessions[0].family), "Week explanation request should contain actual session families");
  }

  {
    const plan = generateEngineV2Plan(beginnerInput);
    const openBuildWeek = plan.weeks.find((week) => week.phase === "build" && week.adaptationHooks?.progressionGate === "open");
    const cutbackWeek = plan.weeks.find((week) => week.isCutback);
    assert.ok(openBuildWeek && cutbackWeek, "Expected deterministic weeks for adaptive coverage");

    const noOp = runVNextAdaptivePass(plan, {
      targetWeekIndex: openBuildWeek.weekIndex,
      sessionsCompleted: openBuildWeek.sessions.length,
      sessionsPlanned: openBuildWeek.sessions.length,
      fatigue: "low",
      painFlag: false,
      confidence: "normal",
    });
    const repeat = runVNextAdaptivePass(plan, {
      targetWeekIndex: cutbackWeek.weekIndex,
      sessionsCompleted: 1,
      sessionsPlanned: cutbackWeek.sessions.length,
      fatigue: "moderate",
      painFlag: false,
      confidence: "normal",
    });
    const recovery = runVNextAdaptivePass(plan, {
      targetWeekIndex: cutbackWeek.weekIndex,
      sessionsCompleted: Math.max(1, cutbackWeek.sessions.length - 1),
      sessionsPlanned: cutbackWeek.sessions.length,
      fatigue: "high",
      painFlag: false,
      confidence: "normal",
    });

    assert.equal(buildAdaptationExplanationPayload(noOp).adaptationContext.action, "keep_current_progression");
    assert.equal(buildAdaptationExplanationPayload(repeat).adaptationContext.action, "repeat_current_week");
    assert.equal(buildAdaptationExplanationPayload(recovery).adaptationContext.action, "insert_recovery_microcycle");
  }

  {
    const plan = generateEngineV2Plan(beginnerInput);
    const payload = buildPlanExplanationPayload(plan);
    const result = await renderPlanExplanation(payload, {
      client: fakeClient("{\"bad\":true}") as never,
      model: "gpt-test",
    });
    assert.equal(result.source, "fallback", "Invalid model output should trigger safe fallback");
    assert.equal(result.fallbackReason, "invalid_output");
  }

  {
    const plan = generateEngineV2Plan(returnInput);
    const buildWeek = plan.weeks.find((week) => week.phase === "build");
    assert.ok(buildWeek, "Expected protected-runner build week");
    const result = runVNextAdaptivePass(plan, {
      targetWeekIndex: buildWeek.weekIndex,
      sessionsCompleted: 1,
      sessionsPlanned: buildWeek.sessions.length,
      fatigue: "moderate",
      painFlag: true,
      confidence: "low",
    });
    const payload = buildAdaptationExplanationPayload(result);
    const frozenPayload = JSON.parse(JSON.stringify(payload));
    const rendered = await renderAdaptationExplanation(payload, {
      client: fakeClient(JSON.stringify({
        title: "Conservative adjustment",
        summary: "The plan stayed protective because feedback suggested caution.",
        bullets: ["A conservative bias was active.", "The action stayed grounded in the deterministic decision."],
        tone: "calm",
      })) as never,
      model: "gpt-test",
    });
    assert.equal(rendered.source, "openai");
    assert.deepEqual(payload, frozenPayload, "Adapter must not mutate canonical explanation payloads");
  }

  {
    const plan = generateEngineV2Plan(beginnerInput);
    const weekPayload = buildWeekExplanationPayload(plan, plan.weeks[0].weekIndex);
    const weekRendered = await renderWeekExplanation(weekPayload, {
      client: fakeClient(JSON.stringify({
        title: "Week focus",
        summary: "This week stays simple and grounded in the actual structure.",
        bullets: ["The session count matches the payload.", "The focus stays tied to the real week data."],
        tone: "encouraging",
      })) as never,
      model: "gpt-test",
    });
    assert.equal(weekRendered.explanation.bullets.length, 2);
    const benchmark = evaluateBenchmarkRunner(referenceRunnerBenchmarks[0]);
    assert.ok(benchmark.summaryScore >= 0, "Existing benchmark flow should still run after explanation adapter addition");
  }

  console.log("engine-vnext openai explanations tests passed");
}

void main();
