import assert from "node:assert/strict";

import { evaluateBenchmarkRunner, referenceRunnerBenchmarks } from "../src/lib/engine-v2/benchmark";
import type { RunnerInput } from "../src/lib/engine-v2/models";
import {
  generatePlanForApp,
  getLatestOwnedVNextPlanForApp,
  renderAdaptationExplanationForApp,
  renderPlanExplanationForApp,
  renderWeekExplanationForApp,
  runAdaptivePassForApp,
} from "../src/lib/engine-vnext/app/engineAdapter";
import { runVNextAdaptivePass } from "../src/lib/engine-vnext/adaptation/runAdaptivePass";
import { InMemoryVNextPlanRepository } from "../src/lib/engine-vnext/persistence/vnextPlanRepository";

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

function fakeClient(outputText: string) {
  return {
    responses: {
      async create() {
        return { output_text: outputText };
      },
    },
  };
}

async function main() {
  {
    const result = generatePlanForApp(beginnerInput);
    assert.equal(result.ok, true, "Plan generation adapter should return stable success shape");
    if (result.ok) {
      assert.equal(result.data.plan.planTypeDecision.planType.length > 0, true);
      assert.equal(typeof result.data.validation.passed, "boolean");
      assert.equal(result.data.version?.versionNumber, 1);
      assert.equal(result.data.meta.flow, "plan_generation");
      assert.equal(result.data.meta.engineVersion, "vnext");
    }
  }

  {
    const generated = generatePlanForApp(beginnerInput);
    assert.equal(generated.ok, true, "Expected generated plan for adaptive pass test");
    if (!generated.ok) throw new Error("Plan generation failed");
    const originalVersion = generated.data.plan.versionMetadata?.versionNumber;
    const originalHistoryLength = generated.data.plan.mutationHistory?.length ?? 0;
    const originalWeekCount = generated.data.plan.weeks.length;
    const originalVolumeTargets = generated.data.plan.weeks.map((week) => week.volumeTargetMin);
    const cutbackWeek = generated.data.plan.weeks.find((week) => week.isCutback);
    assert.ok(cutbackWeek, "Expected cutback week for adaptive pass");
    const result = runAdaptivePassForApp(generated.data.plan, {
      targetWeekIndex: cutbackWeek.weekIndex,
      sessionsCompleted: 1,
      sessionsPlanned: cutbackWeek.sessions.length,
      fatigue: "moderate",
      painFlag: false,
      confidence: "normal",
    });
    assert.equal(result.ok, true, "Adaptive pass adapter should return stable success shape");
    if (result.ok) {
      assert.equal(result.data.decision.action, "repeat_current_week");
      assert.equal(typeof result.data.status.applied, "boolean");
      assert.equal(typeof result.data.historyEntry.entryId, "string");
      assert.equal(result.data.meta.flow, "adaptive_pass");
    }
    assert.equal(generated.data.plan.versionMetadata?.versionNumber, originalVersion, "Adapter layer should not bump version on the original plan");
    assert.equal(generated.data.plan.mutationHistory?.length ?? 0, originalHistoryLength, "Adapter layer should not append mutation history to the original plan");
    assert.equal(generated.data.plan.weeks.length, originalWeekCount, "Adapter layer should not change original plan length");
    assert.deepEqual(
      generated.data.plan.weeks.map((week) => week.volumeTargetMin),
      originalVolumeTargets,
      "Adapter layer should not alter original weekly load targets",
    );
  }

  {
    const repository = new InMemoryVNextPlanRepository();
    const generated = generatePlanForApp(beginnerInput);
    if (!generated.ok) throw new Error("Plan generation failed");
    await repository.saveGeneratedPlan({
      userId: "app_adapter_user",
      profileId: "profile_app_adapter",
      runnerProfile: {
        heightCm: 175,
        weightKg: 72,
        age: 36,
        activityLevel: "lav",
        runningExperience: "nybegynder",
        currentRunningAbility: "ti_femten_min",
      },
      goal: {
        distance: "5K",
        goalType: "complete",
        weeks: 10,
        startDate: "2026-03-23",
      } as never,
      plan: generated.data.plan,
    });
    const latest = await getLatestOwnedVNextPlanForApp("app_adapter_user", repository);
    assert.equal(latest.ok, true, "latest owned current vNext plan should be readable through the app adapter");
    if (latest.ok) {
      assert.equal(latest.data.meta.flow, "persisted_plan_read");
      assert.equal(typeof latest.data.meta.debug.currentVersionNumber, "number");
    }
  }

  {
    const generated = generatePlanForApp(beginnerInput);
    if (!generated.ok) throw new Error("Plan generation failed");
    const result = await renderPlanExplanationForApp(generated.data.plan, {
      client: fakeClient(JSON.stringify({
        title: "Plan overview",
        summary: "This explanation stays grounded in the deterministic plan payload.",
        bullets: ["The plan shape is preserved.", "The adapter only renders explanation text."],
        tone: "analytical",
      })) as never,
      model: "gpt-test",
    });
    assert.equal(result.ok, true, "Plan explanation adapter should return stable success shape");
    if (result.ok) {
      assert.equal(result.data.payloadKind, "plan_summary");
      assert.equal(result.data.source, "openai");
      assert.equal(result.data.explanation.title, "Plan overview");
      assert.equal(result.data.meta.flow, "plan_explanation");
    }
  }

  {
    const generated = generatePlanForApp(beginnerInput);
    if (!generated.ok) throw new Error("Plan generation failed");
    const result = await renderWeekExplanationForApp(generated.data.plan, generated.data.plan.weeks[0].weekIndex, {
      client: fakeClient("{\"bad\":true}") as never,
      model: "gpt-test",
    });
    assert.equal(result.ok, true, "Week explanation adapter should still return stable shape on fallback");
    if (result.ok) {
      assert.equal(result.data.source, "fallback");
      assert.equal(result.data.fallbackReason, "invalid_output");
      assert.equal(result.data.payloadKind, "week_summary");
      assert.equal(result.data.meta.status, "fallback");
    }
  }

  {
    const generated = generatePlanForApp(beginnerInput);
    if (!generated.ok) throw new Error("Plan generation failed");
    const cutbackWeek = generated.data.plan.weeks.find((week) => week.isCutback);
    assert.ok(cutbackWeek, "Expected cutback week");
    const adaptivePass = runVNextAdaptivePass(generated.data.plan, {
      targetWeekIndex: cutbackWeek.weekIndex,
      sessionsCompleted: Math.max(1, cutbackWeek.sessions.length - 1),
      sessionsPlanned: cutbackWeek.sessions.length,
      fatigue: "high",
      painFlag: false,
      confidence: "normal",
    });
    const frozenAdaptivePass = JSON.stringify(adaptivePass);
    const result = await renderAdaptationExplanationForApp(adaptivePass, {
      client: fakeClient(JSON.stringify({
        title: "Recovery adjustment",
        summary: "The adapter explains the local recovery change without altering plan logic.",
        bullets: ["The decision remains deterministic.", "Fallback would be surfaced clearly if needed."],
        tone: "calm",
      })) as never,
      model: "gpt-test",
    });
    assert.equal(result.ok, true, "Adaptation explanation adapter should return stable success shape");
    if (result.ok) {
      assert.equal(result.data.payloadKind, "adaptation_summary");
      assert.equal(result.data.explanation.tone, "calm");
      assert.equal(typeof result.data.meta.debug.explanationFallback, "boolean");
    }
    assert.equal(JSON.stringify(adaptivePass), frozenAdaptivePass, "Explanation adapter should not mutate adaptive pass results");
  }

  {
    const benchmark = evaluateBenchmarkRunner(referenceRunnerBenchmarks[0]);
    assert.ok(benchmark.summaryScore >= 0, "Benchmark flow should still run after app adapter addition");
  }

  console.log("engine-vnext app adapter tests passed");
}

void main();
