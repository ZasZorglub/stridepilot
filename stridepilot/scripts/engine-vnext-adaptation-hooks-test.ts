import assert from "node:assert/strict";

import { evaluateBenchmarkRunner, referenceRunnerBenchmarks } from "../src/lib/engine-v2/benchmark";
import { generateEngineV2Plan } from "../src/lib/engine-v2/engine";
import type { RunnerInput } from "../src/lib/engine-v2/models";

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

{
  const plan = generateEngineV2Plan(beginnerInput);
  assert.ok(plan.adaptationHooks, "Generated plan should include plan-level adaptation hooks");
  assert.equal(plan.adaptationHooks?.adaptationReady, true, "Plan should be marked adaptation-ready");
  assert.ok((plan.adaptationHooks?.boundaryWeeks.length ?? 0) > 0, "Plan should expose block/phase boundaries");
}

{
  const plan = generateEngineV2Plan(beginnerInput);
  assert.ok(plan.weeks.every((week) => week.adaptationHooks), "Every generated week should expose adaptation hooks");
  assert.ok(
    plan.weeks.some((week) => week.adaptationHooks?.progressionGate === "open"),
    "Standard plans should expose at least one open progression week",
  );
}

{
  const beginnerPlan = generateEngineV2Plan(beginnerInput);
  const returnPlan = generateEngineV2Plan(returnInput);
  const beginnerRestricted = beginnerPlan.weeks.filter((week) => week.adaptationHooks?.progressionGate === "restricted").length;
  const returnRestricted = returnPlan.weeks.filter((week) => week.adaptationHooks?.progressionGate === "restricted").length;
  assert.equal(returnPlan.adaptationHooks?.protectedRunner, true, "Return-to-running plan should be marked as protected");
  assert.equal(returnPlan.adaptationHooks?.progressionMode, "conservative", "Return-to-running plan should expose conservative progression mode");
  assert.ok(returnRestricted > beginnerRestricted, "Return-to-running plan should expose more restrictive progression hooks than a beginner finish plan");
}

{
  const plan = generateEngineV2Plan(beginnerInput);
  const restrictiveWeeks = plan.weeks.filter((week) => week.isRaceWeek || week.phase === "taper");
  assert.ok(restrictiveWeeks.length > 0, "Plan should contain taper or race week");
  assert.ok(
    restrictiveWeeks.every(
      (week) =>
        week.adaptationHooks?.progressionGate === "restricted" &&
        week.adaptationHooks?.longRunAdvanceEligible === false &&
        week.adaptationHooks?.sessionCountAdvanceEligible === false,
    ),
    "Taper and race weeks should expose restrictive adaptation hooks",
  );
}

{
  const plan = generateEngineV2Plan(beginnerInput);
  const cutbackWeek = plan.weeks.find((week) => week.isCutback);
  assert.ok(cutbackWeek, "Plan should contain a cutback week");
  assert.equal(cutbackWeek?.adaptationHooks?.repeatWeekCandidate, true, "Cutback weeks should be repeat candidates");
  assert.equal(cutbackWeek?.adaptationHooks?.recoveryMicrocycleCandidate, true, "Cutback weeks should be recovery microcycle candidates");
}

{
  const result = evaluateBenchmarkRunner(referenceRunnerBenchmarks[0]);
  assert.ok(result.summaryScore >= 0, "Benchmark evaluation should still run after adaptation hook schema extension");
  const plan = generateEngineV2Plan(referenceRunnerBenchmarks[0].input);
  assert.ok(plan.vNextValidation, "Validator output should still be present on generated plans");
}

console.log("engine-vnext adaptation hooks tests passed");
