import assert from "node:assert/strict";

import type { Goal, RunnerProfile } from "../src/lib/types";
import { evaluateBenchmarkRunner, referenceRunnerBenchmarks } from "../src/lib/engine-v2/benchmark";
import { InMemoryVNextPlanRepository } from "../src/lib/engine-vnext/persistence/vnextPlanRepository";
import {
  handleVNextAdaptivePassRequest,
  handleVNextCurrentPlanReadRequest,
  handleVNextPlanGenerationRequest,
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

async function main() {
  const repository = new InMemoryVNextPlanRepository();

  {
    const result = await handleVNextPlanGenerationRequest({
      engineVersion: "vnext",
      runnerProfile,
      goal,
      profileId: "profile_route_test",
    }, {
      persist: true,
      userId: "user_route_test",
      repository,
    });
    assert.equal(result.status, 200, "Plan route/controller should return success status for vNext generation");
    assert.equal(result.body.ok, true, "Plan route/controller should use stable adapter response shape");
    if (result.body.ok) {
      assert.equal(typeof result.body.data.validation.passed, "boolean");
      assert.equal(result.body.data.version?.versionNumber, 1);
      assert.equal(typeof result.body.data.status.adaptationReady, "boolean");
      assert.equal(result.body.data.persistence.saved, true);
      assert.equal(typeof result.body.data.persistence.persistedPlanId, "string");
      assert.equal(result.body.data.meta.flow, "plan_generation");
    }
  }

  {
    const lowFrequencyGoal: Goal = {
      distance: "Halvmaraton",
      goalType: "complete",
      weeks: 20,
      startDate: "2026-03-23",
      endDate: "2026-08-10",
      availableTrainingDays: ["Onsdag", "Sondag"],
      preferredLongRunDay: "sunday",
    };
    const result = await handleVNextPlanGenerationRequest({
      engineVersion: "vnext",
      runnerProfile: {
        ...runnerProfile,
        onboardingTrack: "goal_focused",
        currentContinuousDistanceKm: 8,
        currentRunningAbility: "mere_end_tredive_min",
        currentRunsPerWeek: 2,
        currentWeeklyVolumeKm: 18,
        longestCurrentRunMin: 52,
        runningExperience: "let_ovet",
      },
      goal: lowFrequencyGoal,
    });
    assert.equal(result.status, 200, "vNext generation should still build a plan after an explicit low-frequency override path");
    assert.equal(result.body.ok, true);
    if (result.body.ok) {
      assert.equal(
        result.body.data.plan.weeks.every((week) => week.sessions.length <= 2),
        true,
        "generated plans should never silently exceed the user's selected weekly training-day count",
      );
      assert.equal(
        result.body.data.plan.weeks.some((week) => week.sessions.length === 2),
        true,
        "a 2-day selection should remain present in the generated week templates instead of expanding to 3-4 days",
      );
    }
  }

  {
    const result = await handleVNextPlanGenerationRequest({
      engineVersion: "vnext",
      runnerProfile,
      goal,
      recommendationSelection: {
        mode: "standard",
        durationWeeks: 8,
        goalDate: "2026-05-18",
      },
    });
    assert.equal(result.status, 200, "route/controller should still accept an explicitly confirmed duration below the realistic span");
    assert.equal(result.body.ok, true);
    if (result.body.ok) {
      assert.equal(result.body.data.plan.weeks.length, 8);
      assert.equal(result.body.data.plan.resolvedInput.goalDate, "2026-05-18");
    }
  }

  {
    const result = await handleVNextPlanGenerationRequest({
      engineVersion: "vnext",
      runnerProfile,
      goal,
      recommendationSelection: {
        mode: "standard",
        durationWeeks: 12,
        goalDate: "2026-06-15",
      },
    });
    assert.equal(result.status, 200, "route/controller should accept an explicitly chosen duration override");
    assert.equal(result.body.ok, true);
    if (result.body.ok) {
      assert.equal(
        result.body.data.plan.weeks.length,
        12,
        "final plan generation should respect the user's confirmed duration override instead of silently regenerating the recommended length",
      );
      assert.equal(
        result.body.data.plan.resolvedInput.goalDate,
        "2026-06-15",
        "the chosen goal date should flow through with the chosen duration override",
      );
    }
  }

  {
    const result = await handleVNextPlanGenerationRequest({
      engineVersion: "vnext",
      goal,
    });
    assert.equal(result.status, 400, "Missing runner profile should be a machine-readable bad request");
    assert.equal(result.body.ok, false);
    if (!result.body.ok) {
      assert.equal(result.body.error.code, "bad_request");
    }
  }

  {
    const generated = await handleVNextPlanGenerationRequest({
      engineVersion: "vnext",
      runnerProfile,
      goal,
      profileId: "profile_route_test_adapt",
    }, {
      persist: true,
      userId: "user_route_test_adapt",
      repository,
    });
    assert.equal(generated.body.ok, true, "Expected plan generation success before adaptive route test");
    if (!generated.body.ok) throw new Error("Plan generation failed");

    const cutbackWeek = generated.body.data.plan.weeks.find((week) => week.isCutback) ?? generated.body.data.plan.weeks[1];
    const adaptive = await handleVNextAdaptivePassRequest({
      engineVersion: "vnext",
      persistedPlanId: generated.body.data.persistence.persistedPlanId,
      plan: generated.body.data.plan,
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
      userId: "user_route_test_adapt",
      repository,
    });
    assert.equal(adaptive.status, 200, "Adaptive route/controller should return success status for vNext adaptive pass");
    assert.equal(adaptive.body.ok, true, "Adaptive route/controller should use stable adapter response shape");
    if (adaptive.body.ok) {
      assert.equal(typeof adaptive.body.data.status.applied, "boolean");
      assert.equal(typeof adaptive.body.data.validation.passed, "boolean");
      assert.equal(typeof adaptive.body.data.historyEntry.entryId, "string");
      assert.equal(adaptive.body.data.persistence.saved, true);
      assert.equal(adaptive.body.data.meta.flow, "adaptive_pass");
    }
  }

  {
    const generated = await handleVNextPlanGenerationRequest({
      engineVersion: "vnext",
      runnerProfile,
      goal,
      profileId: "profile_route_test_read",
    }, {
      persist: true,
      userId: "user_route_test_read",
      repository,
    });
    if (!generated.body.ok) throw new Error("Plan generation failed for current-read route test");

    const currentRead = await handleVNextCurrentPlanReadRequest({}, {
      userId: "user_route_test_read",
      repository,
    });
    assert.equal(currentRead.status, 200, "Current-plan route should support latest owned vNext read without persistedPlanId");
    assert.equal(currentRead.body.ok, true);
    if (currentRead.body.ok) {
      assert.equal(currentRead.body.data.persistedPlanId, generated.body.data.persistence.persistedPlanId);
      assert.equal(currentRead.body.data.meta.flow, "persisted_plan_read");
    }
  }

  {
    const adaptive = await handleVNextAdaptivePassRequest({
      engineVersion: "vnext",
      feedback: {
        targetWeekIndex: 2,
        sessionsCompleted: 1,
        sessionsPlanned: 3,
        fatigue: "high",
        painFlag: true,
        confidence: "low",
      },
    });
    assert.equal(adaptive.status, 400, "Missing plan should preserve machine-readable error path");
    assert.equal(adaptive.body.ok, false);
    if (!adaptive.body.ok) {
      assert.equal(adaptive.body.error.code, "bad_request");
    }
  }

  {
    const benchmark = evaluateBenchmarkRunner(referenceRunnerBenchmarks[0]);
    assert.ok(benchmark.summaryScore >= 0, "Benchmark flow should still run after route/controller adapter wiring");
  }

  console.log("engine-vnext route integration tests passed");
}

void main();
