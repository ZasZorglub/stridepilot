import assert from "node:assert/strict";

import { evaluateBenchmarkRunner, referenceRunnerBenchmarks } from "../src/lib/engine-v2/benchmark";
import { generateEngineV2Plan } from "../src/lib/engine-v2/engine";
import { runVNextAdaptivePass } from "../src/lib/engine-v2/engine/adaptation";
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
  const result = runVNextAdaptivePass(plan, {
    targetWeekIndex: buildWeek.weekIndex,
    sessionsCompleted: buildWeek.sessions.length,
    sessionsPlanned: buildWeek.sessions.length,
    fatigue: "low",
    painFlag: false,
    confidence: "normal",
  });
  assert.equal(result.decision.action, "keep_current_progression", "Compliant low-fatigue case should keep progression");
  assert.equal(result.applied, false, "Keep-progression path should not mutate plan");
  assert.equal(result.mutation.mutationType, "noop");
  assert.equal(result.fallback, true);
}

{
  const plan = generateEngineV2Plan(beginnerInput);
  const cutbackWeek = plan.weeks.find((week) => week.isCutback);
  assert.ok(cutbackWeek, "Expected a cutback week");
  const result = runVNextAdaptivePass(plan, {
    targetWeekIndex: cutbackWeek.weekIndex,
    sessionsCompleted: 1,
    sessionsPlanned: cutbackWeek.sessions.length,
    fatigue: "moderate",
    painFlag: false,
    confidence: "normal",
  });
  assert.equal(result.decision.action, "repeat_current_week", "Low compliance should produce repeat decision");
  assert.equal(result.mutation.mutationType, "repeat_current_week", "Repeat decision should flow into repeat mutation");
  assert.equal(result.applied, true, "Repeat path should mutate when safe");
}

{
  const plan = generateEngineV2Plan(beginnerInput);
  const cutbackWeek = plan.weeks.find((week) => week.isCutback);
  assert.ok(cutbackWeek, "Expected a cutback week");
  const result = runVNextAdaptivePass(plan, {
    targetWeekIndex: cutbackWeek.weekIndex,
    sessionsCompleted: Math.max(1, cutbackWeek.sessions.length - 1),
    sessionsPlanned: cutbackWeek.sessions.length,
    fatigue: "high",
    painFlag: false,
    confidence: "normal",
  });
  assert.equal(result.decision.action, "insert_recovery_microcycle", "High fatigue on recovery candidate should prefer recovery microcycle");
  assert.equal(result.mutation.mutationType, "insert_recovery_microcycle");
  assert.equal(result.applied, true);
}

{
  const plan = generateEngineV2Plan(returnInput);
  const buildWeek = plan.weeks.find((week) => week.phase === "build");
  assert.ok(buildWeek, "Expected a protected-runner build week");
  const result = runVNextAdaptivePass(plan, {
    targetWeekIndex: buildWeek.weekIndex,
    sessionsCompleted: 1,
    sessionsPlanned: buildWeek.sessions.length,
    fatigue: "moderate",
    painFlag: true,
    confidence: "low",
  });
  assert.equal(result.originalPlanMeta.protectedRunner, true, "Protected runner metadata should be surfaced");
  assert.equal(result.decision.conservativeBias, true, "Protected runner should preserve conservative bias through orchestration");
  if (result.applied) {
    assert.equal(result.mutation.conservativeBiasApplied, true, "Applied protected-runner mutation should reflect conservative bias");
  } else {
    assert.equal(result.fallback, true, "Protected runner no-op should still be surfaced as a safe fallback");
  }
}

{
  const plan = generateEngineV2Plan(beginnerInput);
  const week = plan.weeks.find((entry) => entry.phase === "build") ?? plan.weeks[0];
  const result = runVNextAdaptivePass(plan, {
    targetWeekIndex: week.weekIndex,
    sessionsCompleted: week.sessions.length,
    sessionsPlanned: week.sessions.length,
    fatigue: "low",
    painFlag: false,
    confidence: "normal",
  });
  assert.equal(typeof result.originalPlanMeta.totalWeeks, "number", "Plan metadata should be machine-readable");
  assert.equal(typeof result.finalValidation.passed, "boolean", "Validation summary should be machine-readable");
  assert.ok(Array.isArray(result.decision.reasonCodes), "Decision reason codes should remain machine-readable");
}

{
  const plan = generateEngineV2Plan(referenceRunnerBenchmarks[0].input);
  const week = plan.weeks.find((entry) => entry.phase === "build") ?? plan.weeks[0];
  const result = runVNextAdaptivePass(plan, {
    targetWeekIndex: week.weekIndex,
    sessionsCompleted: week.sessions.length,
    sessionsPlanned: week.sessions.length,
    fatigue: "low",
    painFlag: false,
    confidence: "normal",
  });
  assert.ok(result.finalValidation.vNextHardFailCount >= 0, "Validator summary should be available after orchestration");
  const benchmark = evaluateBenchmarkRunner(referenceRunnerBenchmarks[0]);
  assert.ok(benchmark.summaryScore >= 0, "Benchmark flow should still run after adaptive orchestrator addition");
}

console.log("engine-vnext adaptive pass tests passed");
