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

{
  const plan = generateEngineV2Plan(beginnerInput);
  assert.ok(plan.versionMetadata, "Generated plan should expose base version metadata");
  assert.equal(plan.versionMetadata?.versionNumber, 1, "Base generated plan should start at version 1");
  assert.equal(plan.versionMetadata?.isAdaptiveDerivative, false, "Base generated plan should not be marked as derivative");
  assert.ok(plan.versionMetadata?.planId, "Generated plan should carry a stable plan id");
  assert.deepEqual(plan.mutationHistory, [], "Generated plan should start with empty mutation history");
}

{
  const plan = generateEngineV2Plan(beginnerInput);
  const cutbackWeek = plan.weeks.find((week) => week.isCutback);
  assert.ok(cutbackWeek, "Expected cutback week for applied mutation case");
  const result = runVNextAdaptivePass(plan, {
    targetWeekIndex: cutbackWeek.weekIndex,
    sessionsCompleted: 1,
    sessionsPlanned: cutbackWeek.sessions.length,
    fatigue: "moderate",
    painFlag: false,
    confidence: "normal",
  });
  assert.equal(result.applied, true, "Expected applied adaptive pass");
  assert.equal(result.finalPlan.versionMetadata?.versionNumber, 2, "Applied mutation should increment plan version");
  assert.equal(result.finalPlan.versionMetadata?.derivedFromVersionNumber, 1, "Applied mutation should record source version");
  assert.equal(result.finalPlan.versionMetadata?.isAdaptiveDerivative, true, "Applied mutation should mark plan as adaptive derivative");
  assert.equal(result.finalPlan.mutationHistory?.length, 1, "Applied mutation should append history entry");
}

{
  const plan = generateEngineV2Plan(beginnerInput);
  const buildWeek = plan.weeks.find((week) => week.phase === "build" && week.adaptationHooks?.progressionGate === "open");
  assert.ok(buildWeek, "Expected open build week for no-op path");
  const result = runVNextAdaptivePass(plan, {
    targetWeekIndex: buildWeek.weekIndex,
    sessionsCompleted: buildWeek.sessions.length,
    sessionsPlanned: buildWeek.sessions.length,
    fatigue: "low",
    painFlag: false,
    confidence: "normal",
  });
  assert.equal(result.applied, false, "Keep-progression path should remain a no-op");
  assert.equal(result.finalPlan.versionMetadata?.versionNumber, 1, "No-op adaptive pass should preserve plan version");
  assert.equal(result.historyEntry.applied, false, "History should record no-op clearly");
  assert.equal(result.finalPlan.mutationHistory?.length, 1, "No-op adaptive pass should still append a history event");
}

{
  const plan = generateEngineV2Plan(beginnerInput);
  const taperSource = plan.weeks.find(
    (week) =>
      !week.isRaceWeek &&
      week.phase !== "taper" &&
      plan.weeks.some((candidate) => candidate.weekIndex === week.weekIndex + 1 && candidate.phase === "taper"),
  );
  assert.ok(taperSource, "Expected source week that would mutate into taper");
  const result = runVNextAdaptivePass(plan, {
    targetWeekIndex: taperSource.weekIndex,
    sessionsCompleted: 0,
    sessionsPlanned: taperSource.sessions.length,
    fatigue: "moderate",
    painFlag: false,
    confidence: "normal",
  });
  assert.equal(result.decision.action, "repeat_current_week", "Low compliance should still request a local mutation");
  assert.equal(result.applied, false, "Unsafe mutation target should not be applied");
  assert.equal(result.fallback, true, "Unsafe mutation attempt should be surfaced as fallback");
  assert.equal(result.historyEntry.fallback, true, "History should distinguish fallback from success");
}

{
  const plan = generateEngineV2Plan(beginnerInput);
  const cutbackWeek = plan.weeks.find((week) => week.isCutback);
  assert.ok(cutbackWeek, "Expected cutback week for history completeness");
  const result = runVNextAdaptivePass(plan, {
    targetWeekIndex: cutbackWeek.weekIndex,
    sessionsCompleted: 1,
    sessionsPlanned: cutbackWeek.sessions.length,
    fatigue: "high",
    painFlag: false,
    confidence: "normal",
  });
  assert.equal(typeof result.historyEntry.entryId, "string", "History entry should have stable id");
  assert.equal(typeof result.historyEntry.sourceVersionNumber, "number", "History entry should capture source version");
  assert.equal(typeof result.historyEntry.resultingVersionNumber, "number", "History entry should capture resulting version");
  assert.ok(Array.isArray(result.historyEntry.decision.reasonCodes), "History should preserve decision details");
  assert.equal(typeof result.historyEntry.validation.passed, "boolean", "History should preserve validation summary");
}

{
  const plan = generateEngineV2Plan(referenceRunnerBenchmarks[0].input);
  assert.ok(plan.versionMetadata?.versionNumber === 1, "Benchmark-generated plans should carry base version metadata");
  const benchmark = evaluateBenchmarkRunner(referenceRunnerBenchmarks[0]);
  assert.ok(benchmark.summaryScore >= 0, "Benchmark flow should still run after version/history addition");
}

console.log("engine-vnext version history tests passed");
