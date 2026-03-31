import assert from "node:assert/strict";

import { evaluateBenchmarkRunner, referenceRunnerBenchmarks } from "../src/lib/engine-v2/benchmark";
import { generateEngineV2Plan } from "../src/lib/engine-v2/engine";
import { decideVNextAdaptation } from "../src/lib/engine-v2/engine/adaptation";
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
  const buildWeek = plan.weeks.find((week) => week.phase === "build" && week.adaptationHooks?.progressionGate === "open");
  assert.ok(buildWeek, "Expected an open build week");
  const decision = decideVNextAdaptation(plan, {
    targetWeekIndex: buildWeek.weekIndex,
    sessionsCompleted: buildWeek.sessions.length,
    sessionsPlanned: buildWeek.sessions.length,
    fatigue: "low",
    painFlag: false,
    confidence: "normal",
  });
  assert.equal(decision.action, "keep_current_progression", "Compliant low-fatigue case should keep progression");
}

{
  const plan = generateEngineV2Plan(beginnerInput);
  const cutbackWeek = plan.weeks.find((week) => week.isCutback);
  assert.ok(cutbackWeek, "Expected a cutback week");
  const decision = decideVNextAdaptation(plan, {
    targetWeekIndex: cutbackWeek.weekIndex,
    sessionsCompleted: 1,
    sessionsPlanned: cutbackWeek.sessions.length,
    fatigue: "moderate",
    painFlag: false,
    confidence: "normal",
  });
  assert.equal(decision.action, "repeat_current_week", "Low compliance should be able to repeat the current week");
}

{
  const plan = generateEngineV2Plan(returnInput);
  const buildWeek = plan.weeks.find((week) => week.phase === "build");
  assert.ok(buildWeek, "Expected a return-mode build week");
  const decision = decideVNextAdaptation(plan, {
    targetWeekIndex: buildWeek.weekIndex,
    sessionsCompleted: 1,
    sessionsPlanned: buildWeek.sessions.length,
    fatigue: "moderate",
    painFlag: true,
    confidence: "low",
  });
  assert.ok(
    decision.action === "insert_recovery_microcycle" || decision.action === "downshift_next_week",
    "Protected runner with pain should get a conservative decision",
  );
  assert.equal(decision.conservativeBias, true, "Protected runner decision should expose conservative bias");
}

{
  const plan = generateEngineV2Plan(beginnerInput);
  const cutbackWeek = plan.weeks.find((week) => week.isCutback);
  assert.ok(cutbackWeek, "Expected a cutback week");
  const decision = decideVNextAdaptation(plan, {
    targetWeekIndex: cutbackWeek.weekIndex,
    sessionsCompleted: Math.max(1, cutbackWeek.sessions.length - 1),
    sessionsPlanned: cutbackWeek.sessions.length,
    fatigue: "high",
    painFlag: false,
    confidence: "normal",
  });
  assert.equal(decision.action, "insert_recovery_microcycle", "Recovery candidate with high fatigue should insert recovery microcycle");
}

{
  const plan = generateEngineV2Plan(beginnerInput);
  const taperWeek = plan.weeks.find((week) => week.phase === "taper");
  assert.ok(taperWeek, "Expected a taper week");
  const decision = decideVNextAdaptation(plan, {
    targetWeekIndex: taperWeek.weekIndex,
    sessionsCompleted: taperWeek.sessions.length,
    sessionsPlanned: taperWeek.sessions.length,
    fatigue: "low",
    painFlag: false,
    confidence: "high",
  });
  assert.equal(decision.action, "keep_current_progression", "Taper/race week should resist inappropriate adaptation");
  assert.ok(decision.reasonCodes.includes("restricted_phase"), "Restricted endgame weeks should explain the restriction");
}

{
  const plan = generateEngineV2Plan(referenceRunnerBenchmarks[0].input);
  const week = plan.weeks.find((entry) => entry.phase === "build") ?? plan.weeks[0];
  const decision = decideVNextAdaptation(plan, {
    targetWeekIndex: week.weekIndex,
    sessionsCompleted: week.sessions.length,
    sessionsPlanned: week.sessions.length,
    fatigue: "low",
    painFlag: false,
    confidence: "normal",
  });
  assert.ok(decision.action.length > 0, "Decision function should run on real generated plans");
  const benchmark = evaluateBenchmarkRunner(referenceRunnerBenchmarks[0]);
  assert.ok(benchmark.summaryScore >= 0, "Benchmark flow should still run after adaptation decision addition");
}

console.log("engine-vnext adaptation decision tests passed");
