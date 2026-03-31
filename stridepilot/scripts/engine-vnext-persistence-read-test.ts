import assert from "node:assert/strict";

import type { Goal, RunnerProfile } from "../src/lib/types";
import { evaluateBenchmarkRunner, referenceRunnerBenchmarks } from "../src/lib/engine-v2/benchmark";
import { getLatestOwnedVNextPlanForApp, getPersistedPlanForApp } from "../src/lib/engine-vnext/app/engineAdapter";
import {
  handleVNextAdaptivePassRequest,
  handleVNextPlanGenerationRequest,
  type VNextGeneratePlanRouteBody,
} from "../src/lib/engine-vnext/app/routeHandlers";
import { InMemoryVNextPlanRepository } from "../src/lib/engine-vnext/persistence/vnextPlanRepository";

const runnerProfile: RunnerProfile = {
  heightCm: 175,
  weightKg: 72,
  age: 36,
  activityLevel: "lav",
  runningExperience: "nybegynder",
  currentRunningAbility: "ti_femten_min",
  currentWeeklyVolumeKm: 12,
  currentRunsPerWeek: 3,
  longestCurrentRunMin: 22,
  typicalWorkoutMinutes: 40,
  preferredGuidance: "flexible",
};

const goal: Goal = {
  distance: "5K",
  goalType: "complete",
  weeks: 10,
  startDate: "2026-03-23",
  endDate: "2026-06-01",
  availableTrainingDays: ["Tirsdag", "Torsdag", "Sondag"],
  preferredLongRunDay: "sunday",
};

const body: VNextGeneratePlanRouteBody = {
  engineVersion: "vnext",
  profileId: "profile_read_test",
  runnerProfile,
  goal,
};

async function main() {
  const repository = new InMemoryVNextPlanRepository();

  const generated = await handleVNextPlanGenerationRequest(body, {
    persist: true,
    userId: "user_read_test",
    repository,
  });
  assert.equal(generated.body.ok, true, "Persisted vNext plan should be created for read-path test");
  if (!generated.body.ok) throw new Error("Generation failed");

  const persistedPlanId = generated.body.data.persistence.persistedPlanId;
  assert.ok(persistedPlanId, "Generated plan should expose persistedPlanId");

  const readInitial = await getPersistedPlanForApp(persistedPlanId!, "user_read_test", repository);
  assert.equal(readInitial.ok, true, "Persisted plan should be readable");
  if (!readInitial.ok) throw new Error("Initial read failed");
  assert.equal(readInitial.data.currentVersionNumber, 1);
  assert.equal(readInitial.data.versionMetadata?.versionNumber, 1);
  assert.equal(Array.isArray(readInitial.data.historySummary), true);
  assert.equal(readInitial.data.meta.flow, "persisted_plan_read");

  const latestOwnedInitial = await getLatestOwnedVNextPlanForApp("user_read_test", repository);
  assert.equal(latestOwnedInitial.ok, true, "Latest owned plan path should work without a persistedPlanId");
  if (!latestOwnedInitial.ok) throw new Error("Latest owned read failed");
  assert.equal(latestOwnedInitial.data.persistedPlanId, persistedPlanId);

  const cutbackWeek = generated.body.data.plan.weeks.find((week) => week.isCutback) ?? generated.body.data.plan.weeks[1];
  const adaptive = await handleVNextAdaptivePassRequest({
    engineVersion: "vnext",
    persistedPlanId,
    plan: generated.body.data.plan,
    feedback: {
      targetWeekIndex: cutbackWeek.weekIndex,
      sessionsCompleted: 1,
      sessionsPlanned: cutbackWeek.sessions.length,
      fatigue: "moderate",
      painFlag: false,
      confidence: "normal",
    },
  }, {
    persist: true,
    userId: "user_read_test",
    repository,
  });
  assert.equal(adaptive.body.ok, true, "Adaptive pass should persist for read-path test");
  if (!adaptive.body.ok) throw new Error("Adaptive pass failed");

  const readAfterAdaptive = await getPersistedPlanForApp(persistedPlanId!, "user_read_test", repository);
  assert.equal(readAfterAdaptive.ok, true, "Updated persisted plan should remain readable");
  if (!readAfterAdaptive.ok) throw new Error("Post-adaptation read failed");
  assert.equal(
    readAfterAdaptive.data.currentVersionNumber,
    adaptive.body.data.persistence.currentVersionNumber,
    "Read path should expose the current active version number",
  );
  assert.equal(
    readAfterAdaptive.data.historySummary.length >= 1,
    true,
    "Read path should expose recent adaptive history summary",
  );
  assert.equal(readAfterAdaptive.data.meta.debug.persistedPlanId, persistedPlanId);

  const latestOwnedAfterAdaptive = await getLatestOwnedVNextPlanForApp("user_read_test", repository);
  assert.equal(latestOwnedAfterAdaptive.ok, true, "Latest owned read should still work after adaptation");
  if (!latestOwnedAfterAdaptive.ok) throw new Error("Latest owned read after adaptation failed");
  assert.equal(latestOwnedAfterAdaptive.data.currentVersionNumber, readAfterAdaptive.data.currentVersionNumber);

  const notFound = await getPersistedPlanForApp("missing_plan_id", "user_read_test", repository);
  assert.equal(notFound.ok, false, "Missing persisted plan should be machine-readable");
  if (!notFound.ok) {
    assert.equal(notFound.error.code, "persisted_plan_not_found");
  }

  const foreignRead = await getPersistedPlanForApp(persistedPlanId!, "other_user", repository);
  assert.equal(foreignRead.ok, false, "Non-owner should not read another user's persisted vNext plan");
  if (!foreignRead.ok) {
    assert.equal(foreignRead.error.code, "persisted_plan_not_found");
  }

  const noCurrentPlan = await getLatestOwnedVNextPlanForApp("no_plan_user", repository);
  assert.equal(noCurrentPlan.ok, false, "No-plan latest read should be machine-readable");
  if (!noCurrentPlan.ok) {
    assert.equal(noCurrentPlan.error.code, "vnext_current_plan_not_found");
  }

  const benchmark = evaluateBenchmarkRunner(referenceRunnerBenchmarks[0]);
  assert.ok(benchmark.summaryScore >= 0, "Benchmark flow should still run after vNext persisted read support");

  console.log("engine-vnext persistence read tests passed");
}

void main();
