import assert from "node:assert/strict";

import { generateEngineV2Plan } from "../src/lib/engine-v2/engine";
import { referenceRunnerBenchmarks } from "../src/lib/engine-v2/benchmark/benchmarkFixtures";
import type { BuiltWeek, EnginePlan, RunnerInput, WorkoutFamily } from "../src/lib/engine-v2/models";
import { validateVNextPlan } from "../src/lib/engine-vnext/validators/validatePlan";

function fixturePlan(id: string): EnginePlan {
  const fixture = referenceRunnerBenchmarks.find((entry) => entry.id === id);
  assert.ok(fixture, `Missing benchmark fixture: ${id}`);
  return generateEngineV2Plan(fixture.input);
}

function target10kPlan(): EnginePlan {
  const input: RunnerInput = {
    raceDistance: "10K",
    goalType: "target_time",
    startDate: "2026-01-05",
    goalDate: "2026-04-05",
    requestedDurationWeeks: 12,
    ambitionPreference: "standard",
    currentContinuousRunMin: 42,
    currentWeeklyRuns: 4,
    currentWeeklyVolumeKm: 28,
    longestRecentRunMin: 70,
    recentConsistency: 0.78,
    availableTrainingDays: ["tuesday", "thursday", "saturday", "sunday"],
    preferredLongRunDay: "sunday",
    typicalAvailableTimeMin: 70,
    trainingStylePreference: "balanced",
    externalTrainingLoad: "light",
    injuryConcern: "low",
    confidence: 0.7,
    experienceLevel: "recreational",
  };
  return generateEngineV2Plan(input);
}

function complexity(week: BuiltWeek): number {
  return week.sessions.reduce((score, session) => {
    if (session.isRaceEvent) return score;
    if (session.family === "intervals" || session.family === "hill_reps") return score + 3;
    if (session.family === "tempo_run" || session.family === "race_specific" || session.family === "progression_run") return score + 2;
    if (session.family === "strides_session" || session.family === "steady_run") return score + 1;
    return score;
  }, 0);
}

function families(week: BuiltWeek): WorkoutFamily[] {
  return week.sessions.map((session) => session.family);
}

function taperWeeks(plan: EnginePlan): BuiltWeek[] {
  return plan.weeks.filter((week) => week.phase === "taper" && !week.isRaceWeek);
}

function buildLikeWeeks(plan: EnginePlan): BuiltWeek[] {
  return plan.weeks.filter((week) => week.phase === "build" || week.phase === "specific" || week.phase === "peak");
}

{
  const plan = fixturePlan("true_beginner_5k_no_walk");
  const buildWeek = buildLikeWeeks(plan)[0];
  const taperWeek = taperWeeks(plan)[0];
  const raceWeek = plan.weeks.find((week) => week.isRaceWeek);
  assert.ok(buildWeek && taperWeek && raceWeek, "Expected build, taper and race week");
  assert.ok(complexity(taperWeek) <= complexity(buildWeek), "5K finish taper should be simpler than build");
  assert.ok(complexity(raceWeek) <= complexity(buildWeek), "5K finish race week should be simpler than build");
}

{
  const plan = target10kPlan();
  const raceWeek = plan.weeks.find((week) => week.isRaceWeek);
  assert.ok(raceWeek, "Expected 10K target-time race week");
  const sharpeningCount = raceWeek.sessions.filter((session) => !session.isRaceEvent && (session.family === "race_specific" || session.family === "strides_session" || session.family === "tempo_run")).length;
  assert.ok(sharpeningCount <= 1, "10K target-time race week should keep sharpening limited");
  assert.ok(!families(raceWeek).includes("long_run"), "10K target-time race week should not include a standard long run");
}

{
  const plan = fixturePlan("half_marathon_finish");
  const taperWeek = taperWeeks(plan)[0];
  const comparison = buildLikeWeeks(plan).at(-1);
  assert.ok(taperWeek && comparison, "Expected half-marathon taper week and comparison week");
  assert.ok(complexity(taperWeek) < complexity(comparison) || taperWeek.longRunTargetMin < comparison.longRunTargetMin, "Half taper should be visibly different from normal build/specific weeks");
}

{
  const plan = fixturePlan("marathon_finish");
  const raceWeek = plan.weeks.find((week) => week.isRaceWeek);
  const peakVolume = Math.max(...buildLikeWeeks(plan).map((week) => week.volumeTargetMin));
  assert.ok(raceWeek, "Expected marathon race week");
  assert.ok(raceWeek.volumeTargetMin < peakVolume * 0.6, "Marathon race week should be materially lighter than peak/build");
  assert.ok(taperWeeks(plan).every((week) => week.volumeTargetMin < peakVolume), "Marathon taper weeks should be lighter than peak/build");
}

{
  const plans = [fixturePlan("true_beginner_5k_no_walk"), target10kPlan(), fixturePlan("half_marathon_finish"), fixturePlan("marathon_finish")];
  for (const plan of plans) {
    const raceWeek = plan.weeks.find((week) => week.isRaceWeek);
    assert.ok(raceWeek, "Expected race week");
    assert.ok(!families(raceWeek).includes("long_run"), "Race week should contain no standard long run");
  }
}

{
  const plan = fixturePlan("marathon_finish");
  const raceWeek = plan.weeks.find((week) => week.isRaceWeek);
  assert.ok(raceWeek, "Expected finish race week");
  const illegal = raceWeek.sessions.filter((session) => !session.isRaceEvent && (session.family === "tempo_run" || session.family === "intervals" || session.family === "race_specific"));
  assert.equal(illegal.length, 0, "Finish race week should not contain illegal quality");
}

{
  const plan = fixturePlan("half_marathon_improve");
  const report = validateVNextPlan(plan);
  assert.ok(Array.isArray(report.results), "Validator should still run on generated benchmark plans");
}

{
  const plans = [fixturePlan("true_beginner_5k_no_walk"), target10kPlan(), fixturePlan("half_marathon_finish"), fixturePlan("marathon_finish")];
  for (const plan of plans) {
    const raceWeek = plan.weeks.find((week) => week.isRaceWeek);
    assert.ok(raceWeek?.sessions.some((session) => session.isRaceEvent), "Race week should contain an explicit race-event session");
  }
}

console.log("engine-vnext endgame tests passed");
