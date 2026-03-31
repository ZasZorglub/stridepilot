import assert from "node:assert/strict";

import type { Goal, RunnerProfile } from "../src/lib/types";
import {
  handleVNextAdaptivePassRequest,
  handleVNextCurrentPlanReadRequest,
  handleVNextPlanGenerationRequest,
} from "../src/lib/engine-vnext/app/routeHandlers";
import { InMemoryVNextPlanRepository } from "../src/lib/engine-vnext/persistence/vnextPlanRepository";

const runnerProfile: RunnerProfile = {
  heightCm: 176,
  weightKg: 73,
  age: 34,
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

async function main() {
  const repository = new InMemoryVNextPlanRepository();
  const userId = "user_beta_smoke";

  const generated = await handleVNextPlanGenerationRequest({
    engineVersion: "vnext",
    runnerProfile,
    goal,
    profileId: "profile_beta_smoke",
  }, {
    persist: true,
    userId,
    repository,
  });
  assert.equal(generated.status, 200, "generate should succeed");
  assert.equal(generated.body.ok, true, "generate should return stable success shape");
  if (!generated.body.ok) throw new Error("Generate failed");
  assert.equal(generated.body.data.meta.flow, "plan_generation");
  assert.equal(generated.body.data.persistence.saved, true);

  const firstRead = await handleVNextCurrentPlanReadRequest({}, {
    userId,
    repository,
  });
  assert.equal(firstRead.status, 200, "latest-owned read should succeed after generation");
  assert.equal(firstRead.body.ok, true);
  if (!firstRead.body.ok) throw new Error("First read failed");
  assert.equal(firstRead.body.data.currentVersionNumber, 1);
  assert.equal(firstRead.body.data.historySummary.length, 0);

  const cutbackWeek = firstRead.body.data.plan.weeks.find((week) => week.isCutback) ?? firstRead.body.data.plan.weeks[1];
  const adaptive = await handleVNextAdaptivePassRequest({
    engineVersion: "vnext",
    persistedPlanId: firstRead.body.data.persistedPlanId,
    plan: firstRead.body.data.plan,
    feedback: {
      targetWeekIndex: cutbackWeek.weekIndex,
      sessionsCompleted: Math.max(1, cutbackWeek.sessions.length - 1),
      sessionsPlanned: cutbackWeek.sessions.length,
      fatigue: "moderate",
      painFlag: false,
      confidence: "normal",
    },
  }, {
    persist: true,
    userId,
    repository,
  });
  assert.equal(adaptive.status, 200, "adaptive pass should succeed");
  assert.equal(adaptive.body.ok, true, "adaptive pass should return stable success shape");
  if (!adaptive.body.ok) throw new Error("Adaptive pass failed");
  assert.equal(adaptive.body.data.meta.flow, "adaptive_pass");
  assert.equal(adaptive.body.data.persistence.saved, true);
  assert.equal(typeof adaptive.body.data.historyEntry.entryId, "string");

  const secondRead = await handleVNextCurrentPlanReadRequest({}, {
    userId,
    repository,
  });
  assert.equal(secondRead.status, 200, "latest-owned read should still succeed after adaptation");
  assert.equal(secondRead.body.ok, true);
  if (!secondRead.body.ok) throw new Error("Second read failed");
  assert.equal(secondRead.body.data.persistedPlanId, firstRead.body.data.persistedPlanId);
  assert.equal(secondRead.body.data.meta.flow, "persisted_plan_read");
  assert.equal(
    secondRead.body.data.currentVersionNumber,
    adaptive.body.data.persistence.currentVersionNumber,
    "current version should reflect the persisted adaptive result",
  );
  assert.equal(
    secondRead.body.data.historySummary[0]?.entryId,
    adaptive.body.data.historyEntry.entryId,
    "recent history summary should include the adaptive pass result",
  );
  assert.equal(typeof secondRead.body.data.meta.debug.currentVersionNumber, "number");

  console.log("engine-vnext beta smoke tests passed");
}

void main();
