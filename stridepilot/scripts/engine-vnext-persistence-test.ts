import assert from "node:assert/strict";

import type { Goal, RunnerProfile } from "../src/lib/types";
import { InMemoryVNextPlanRepository } from "../src/lib/engine-vnext/persistence/vnextPlanRepository";
import {
  handleVNextAdaptivePassRequest,
  handleVNextPlanGenerationRequest,
  type VNextGeneratePlanRouteBody,
} from "../src/lib/engine-vnext/app/routeHandlers";

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

const beginnerInputBody: VNextGeneratePlanRouteBody = {
  engineVersion: "vnext" as const,
  profileId: "profile_persist_test",
  runnerProfile,
  goal,
};

async function main() {
  const repository = new InMemoryVNextPlanRepository();

  const generated = await handleVNextPlanGenerationRequest(beginnerInputBody, {
    persist: true,
    userId: "user_persist_test",
    repository,
  });
  assert.equal(generated.body.ok, true, "Generated vNext plan should persist successfully");
  if (!generated.body.ok) throw new Error("Plan generation failed");
  assert.equal(generated.body.data.persistence.saved, true);
  assert.equal(generated.body.data.persistence.currentVersionNumber, 1);
  assert.ok(generated.body.data.persistence.persistedPlanId);

  const persistedAfterGenerate = await repository.getPlanState(generated.body.data.persistence.persistedPlanId!);
  assert.ok(persistedAfterGenerate, "Persisted plan should be queryable after generation");
  assert.equal(persistedAfterGenerate?.currentVersionNumber, 1);

  const cutbackWeek = generated.body.data.plan.weeks.find((week) => week.isCutback) ?? generated.body.data.plan.weeks[1];
  const appliedAdaptive = await handleVNextAdaptivePassRequest({
    engineVersion: "vnext",
    persistedPlanId: generated.body.data.persistence.persistedPlanId,
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
    userId: "user_persist_test",
    repository,
  });
  assert.equal(appliedAdaptive.body.ok, true, "Adaptive mutation should persist successfully");
  if (!appliedAdaptive.body.ok) throw new Error("Adaptive mutation failed");
  assert.equal(appliedAdaptive.body.data.persistence.saved, true);
  assert.ok((appliedAdaptive.body.data.persistence.currentVersionNumber ?? 0) >= 1);

  const persistedAfterAdaptive = await repository.getPlanState(generated.body.data.persistence.persistedPlanId!);
  assert.ok(persistedAfterAdaptive, "Persisted plan should still be queryable after adaptation");
  assert.equal(
    persistedAfterAdaptive?.latestHistoryEntryId,
    appliedAdaptive.body.data.historyEntry.entryId,
    "Applied adaptive pass should persist the latest history entry",
  );

  const foreignAdaptive = await handleVNextAdaptivePassRequest({
    engineVersion: "vnext",
    persistedPlanId: generated.body.data.persistence.persistedPlanId,
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
    userId: "other_user",
    repository,
  });
  assert.equal(foreignAdaptive.body.ok, false, "Non-owner should not mutate another user's persisted vNext plan");
  if (!foreignAdaptive.body.ok) {
    assert.equal(foreignAdaptive.body.error.code, "persisted_plan_not_found");
  }

  const noOpAdaptive = await handleVNextAdaptivePassRequest({
    engineVersion: "vnext",
    persistedPlanId: generated.body.data.persistence.persistedPlanId,
    plan: generated.body.data.plan,
    feedback: {
      targetWeekIndex: generated.body.data.plan.weeks.at(-1)?.weekIndex ?? generated.body.data.plan.weeks.length,
      sessionsCompleted: generated.body.data.plan.weeks.at(-1)?.sessions.length ?? 1,
      sessionsPlanned: generated.body.data.plan.weeks.at(-1)?.sessions.length ?? 1,
      fatigue: "low",
      painFlag: false,
      confidence: "high",
    },
  }, {
    persist: true,
    userId: "user_persist_test",
    repository,
  });
  assert.equal(noOpAdaptive.body.ok, true, "No-op adaptive pass should still persist history");
  if (!noOpAdaptive.body.ok) throw new Error("No-op adaptive pass failed");
  assert.equal(noOpAdaptive.body.data.persistence.saved, true);
  assert.equal(typeof noOpAdaptive.body.data.historyEntry.entryId, "string");

  const unauthorizedGenerate = await handleVNextPlanGenerationRequest(beginnerInputBody, {
    persist: true,
    repository,
  });
  assert.equal(unauthorizedGenerate.body.ok, false, "Persisted generation should require authentication");
  if (!unauthorizedGenerate.body.ok) {
    assert.equal(unauthorizedGenerate.body.error.code, "unauthorized");
  }

  console.log("engine-vnext persistence tests passed");
}

void main();
