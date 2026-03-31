import assert from "node:assert/strict";

import { evaluateBenchmarkPlan, evaluateBenchmarkRunner, referenceRunnerBenchmarks } from "../src/lib/engine-v2/benchmark";
import type { ReferenceRunnerBenchmark } from "../src/lib/engine-v2/benchmark";
import { generateEngineV2Plan } from "../src/lib/engine-v2/engine";
import type { RunnerInput } from "../src/lib/engine-v2/models";

function fixture(id: string): ReferenceRunnerBenchmark {
  const match = referenceRunnerBenchmarks.find((entry) => entry.id === id);
  assert.ok(match, `Missing fixture ${id}`);
  return match;
}

function targetTime10kReference(): ReferenceRunnerBenchmark {
  const input: RunnerInput = {
    raceDistance: "10K",
    goalType: "target_time",
    startDate: "2026-03-23",
    goalDate: "2026-06-28",
    currentContinuousRunMin: 38,
    currentWeeklyRuns: 4,
    currentWeeklyVolumeKm: 30,
    longestRecentRunMin: 55,
    recentConsistency: 0.8,
    availableTrainingDays: ["monday", "wednesday", "friday", "sunday"],
    typicalAvailableTimeMin: 60,
    trainingStylePreference: "performance",
    experienceLevel: "recreational",
    injuryConcern: "low",
    externalTrainingLoad: "light",
    confidence: 4,
  };

  return {
    ...fixture("recreational_10k_improve"),
    id: "target_time_10k_custom",
    name: "Custom – 10K target time",
    input,
    goalType: "target_time",
    acceptance: {
      ...fixture("recreational_10k_improve").acceptance,
      weeklyStructure: {
        ...fixture("recreational_10k_improve").acceptance.weeklyStructure,
        planFamily: "target_time",
        minDistinctPhaseSkeletons: 2,
        phaseExpectations: [
          { phase: "base", requiredRoleGroups: [["easy", "aerobic_support"], ["recovery", "easy"], ["long_run"]], maxQualitySessionsPerWeek: 1, preferredQualityFamilies: ["steady_run", "tempo_run"] },
          { phase: "build", requiredRoleGroups: [["quality", "aerobic_support"], ["recovery", "easy"], ["long_run"]], maxQualitySessionsPerWeek: 1, preferredQualityFamilies: ["tempo_run", "steady_run", "race_specific", "intervals"] },
          { phase: "specific", requiredRoleGroups: [["quality", "aerobic_support"], ["recovery", "easy"], ["long_run"]], maxQualitySessionsPerWeek: 1, preferredQualityFamilies: ["race_specific", "tempo_run", "progression_run", "steady_run", "intervals"] },
          { phase: "peak", requiredRoleGroups: [["quality", "aerobic_support"], ["long_run"]], maxQualitySessionsPerWeek: 2, preferredQualityFamilies: ["race_specific", "tempo_run", "intervals"] },
        ],
      },
    },
  };
}

function returnToRunningReference(): ReferenceRunnerBenchmark {
  const input: RunnerInput = {
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

  return {
    id: "return_to_running_custom",
    name: "Custom – Return to running",
    input,
    goalType: "return_to_running",
    coachIntent: "Rebuild safe running tolerance with recovery-biased, low-complexity structure.",
    acceptance: {
      acceptablePrimaryTypes: ["return_to_running", "consistency_builder", "true_beginner"],
      acceptableRunnerLevels: ["true_beginner", "beginner_plus"],
      expectedPlanTypes: ["return_to_running"],
      expectedPhaseSequence: ["base", "build", "specific", "peak", "taper"],
      allowedPhaseOmissions: ["peak"],
      longRunStartBand: { min: 10, max: 22, borderlineMin: 8, borderlineMax: 25 },
      longRunPeakBand: { min: 20, max: 40, borderlineMin: 18, borderlineMax: 45 },
      taperReductionBand: { min: 0.1, max: 0.4, borderlineMin: 0.05, borderlineMax: 0.5 },
      weeklyStructure: {
        typicalRoles: ["easy", "long_run"],
        planFamily: "return_to_running",
        requirePhaseVariation: true,
        minDistinctPhaseSkeletons: 2,
        allowProtectedLowComplexity: true,
        allowRunWalk: true,
        phaseExpectations: [
          { phase: "base", requiredRoleGroups: [["easy", "recovery"], ["long_run"]], maxQualitySessionsPerWeek: 0, preferredQualityFamilies: ["run_walk_progression", "easy_run", "development_run"] },
          { phase: "build", requiredRoleGroups: [["easy", "recovery", "aerobic_support"], ["long_run"]], maxQualitySessionsPerWeek: 0, preferredQualityFamilies: ["run_walk_progression", "development_run", "easy_run"] },
          { phase: "specific", requiredRoleGroups: [["easy", "recovery", "aerobic_support"], ["long_run"]], maxQualitySessionsPerWeek: 0, preferredQualityFamilies: ["run_walk_progression", "development_run", "easy_run"] },
        ],
        preferredQualityFamilies: ["run_walk_progression", "easy_run", "development_run"],
        forbiddenFamilies: ["intervals", "hill_reps", "race_specific", "tempo_run"],
        maxQualitySessionsPerWeek: 0,
      },
      earlyIntensityMax: 0.12,
      allowedQualityFamilies: ["run_walk_progression", "easy_run", "development_run"],
      milestoneWindows: [
        { label: "first_20_min_continuous", weekMin: 6, weekMax: 12, targetMin: 20 },
        { label: "taper_start", weekMin: 10, weekMax: 14, targetPhase: "taper" },
      ],
      raceWeek: {
        requireTaper: true,
        maxLongRunFractionOfPeak: 0.8,
        requireGoalSpecificSignal: true,
        acceptableFamilies: ["easy_run", "development_run", "run_walk_progression"],
      },
      failureModes: ["finish_plan_too_complex", "no_real_taper"],
    },
  };
}

{
  const result = evaluateBenchmarkRunner(fixture("beginner_plus_10k_finish"));
  assert.notEqual(result.weeklyStructureFit.status, "out_of_band", "Beginner finish should evaluate under the modernized structure rubric");
}

{
  const finishReference = fixture("beginner_plus_10k_finish");
  const improveReference = fixture("recreational_10k_improve");
  const plan = generateEngineV2Plan(finishReference.input);
  const buildWeek = plan.weeks.find((week) => week.phase === "build");
  assert.ok(buildWeek, "Expected a build week for finish fixture");
  const sessionToUpgrade = buildWeek.sessions.find((session) => session.role === "aerobic_support") ?? buildWeek.sessions[1];
  assert.ok(sessionToUpgrade, "Expected a support session to mutate for rubric differentiation");
  sessionToUpgrade.role = "quality";
  sessionToUpgrade.family = "tempo_run";
  const finishResult = evaluateBenchmarkPlan(finishReference, plan);
  const improveResult = evaluateBenchmarkPlan(improveReference, plan);
  assert.ok(
    finishResult.weeklyStructureFit.status === "out_of_band" && improveResult.weeklyStructureFit.status !== "out_of_band",
    "Improve-time structure should be evaluated with different expectations than finish",
  );
}

{
  const reference = targetTime10kReference();
  const plan = generateEngineV2Plan(reference.input);
  const result = evaluateBenchmarkPlan(reference, plan);
  assert.ok(
    !result.weeklyStructureFit.notes.some((note) => note.includes("does not match preferred set")),
    "Target-time structure should allow race-specific weekly structure under the new rubric",
  );
}

{
  const reference = returnToRunningReference();
  const plan = generateEngineV2Plan(reference.input);
  const result = evaluateBenchmarkPlan(reference, plan);
  assert.notEqual(result.weeklyStructureFit.status, "out_of_band", "Return-to-running should not be penalized for protected low-complexity structure");
}

{
  const result = evaluateBenchmarkRunner(fixture("recreational_10k_improve"));
  assert.ok(
    !result.weeklyStructureFit.notes.some((note) => note.includes("missing expected roles")),
    "Phase-aware structure should reduce legacy missing-role penalties",
  );
}

{
  const results = referenceRunnerBenchmarks.map((entry) => evaluateBenchmarkRunner(entry));
  assert.equal(results.length, referenceRunnerBenchmarks.length, "Benchmark evaluator should still run on canonical generated plans");
}

console.log("engine-vnext benchmark structure tests passed");
