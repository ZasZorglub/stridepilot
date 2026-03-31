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
  buildAdaptationExplanationPromptContract,
  buildPlanExplanationPromptContract,
  buildWeekExplanationPromptContract,
  EXPLANATION_IMMUTABILITY_RULES,
} from "../src/lib/engine-vnext/explanations/promptContracts";

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
  const payload = buildPlanExplanationPayload(plan);
  assert.equal(payload.kind, "plan_summary");
  assert.equal(payload.runnerContext.planType, plan.planTypeDecision.planType, "Plan payload should stay grounded in deterministic plan fields");
  assert.equal(payload.progressionSummary.totalWeeks, plan.weeks.length);
  assert.ok(payload.groundingFacts.length > 0, "Plan payload should include explicit grounding facts");
}

{
  const plan = generateEngineV2Plan(beginnerInput);
  const week = plan.weeks.find((entry) => entry.phase === "build") ?? plan.weeks[0];
  const payload = buildWeekExplanationPayload(plan, week.weekIndex);
  assert.equal(payload.kind, "week_summary");
  assert.equal(payload.weekContext.weekIndex, week.weekIndex);
  assert.equal(payload.structureSummary.sessionCount, week.sessions.length);
  assert.deepEqual(
    payload.structureSummary.sessionSummaries.map((session) => session.family),
    week.sessions.map((session) => session.family),
    "Week payload should reflect the actual week structure",
  );
}

{
  const plan = generateEngineV2Plan(beginnerInput);
  const openBuildWeek = plan.weeks.find((week) => week.phase === "build" && week.adaptationHooks?.progressionGate === "open");
  const cutbackWeek = plan.weeks.find((week) => week.isCutback);
  assert.ok(openBuildWeek && cutbackWeek, "Expected deterministic weeks for adaptive explanation coverage");

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

  const noOpPayload = buildAdaptationExplanationPayload(noOp);
  const repeatPayload = buildAdaptationExplanationPayload(repeat);
  const recoveryPayload = buildAdaptationExplanationPayload(recovery);

  assert.equal(noOpPayload.adaptationContext.action, "keep_current_progression");
  assert.equal(noOpPayload.adaptationContext.applied, false);
  assert.equal(repeatPayload.adaptationContext.action, "repeat_current_week");
  assert.equal(repeatPayload.adaptationContext.applied, true);
  assert.equal(recoveryPayload.adaptationContext.action, "insert_recovery_microcycle");
  assert.equal(recoveryPayload.adaptationContext.mutationType, "insert_recovery_microcycle");
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
  assert.equal(payload.runnerContext.protectedRunner, true, "Protected-runner explanation payload should surface conservative context");
  assert.equal(payload.adaptationContext.conservativeBias, true, "Protected-runner explanation payload should include conservative rationale");
}

{
  const plan = generateEngineV2Plan(beginnerInput);
  const planContract = buildPlanExplanationPromptContract(buildPlanExplanationPayload(plan));
  const weekContract = buildWeekExplanationPromptContract(buildWeekExplanationPayload(plan, plan.weeks[0].weekIndex));
  const adaptiveResult = runVNextAdaptivePass(plan, {
    targetWeekIndex: plan.weeks[0].weekIndex,
    sessionsCompleted: plan.weeks[0].sessions.length,
    sessionsPlanned: plan.weeks[0].sessions.length,
    fatigue: "low",
    painFlag: false,
    confidence: "normal",
  });
  const adaptationContract = buildAdaptationExplanationPromptContract(buildAdaptationExplanationPayload(adaptiveResult));

  for (const contract of [planContract, weekContract, adaptationContract]) {
    const joined = `${contract.systemInstruction} ${contract.immutabilityRules.join(" ")}`;
    assert.ok(joined.includes("Do not invent or change session counts"), "Prompt contract should forbid changing plan structure or numbers");
    assert.ok(joined.includes("immutable"), "Prompt contract should treat the canonical plan as immutable");
  }
  assert.ok(EXPLANATION_IMMUTABILITY_RULES.length >= 4, "Immutability rules should be explicit and non-trivial");
}

{
  const benchmark = evaluateBenchmarkRunner(referenceRunnerBenchmarks[0]);
  assert.ok(benchmark.summaryScore >= 0, "Benchmark flow should still run after explanation layer addition");
}

console.log("engine-vnext explanations tests passed");
