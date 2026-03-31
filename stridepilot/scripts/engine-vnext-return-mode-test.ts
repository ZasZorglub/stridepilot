import assert from "node:assert/strict";

import { generateEngineV2Plan } from "../src/lib/engine-v2/engine";
import { getWeeklyStructure } from "../src/lib/engine-v2/weeklyStructure";
import { validateVNextPlan } from "../src/lib/engine-vnext/validators/validatePlan";
import type { RunnerInput } from "../src/lib/engine-v2/models";

function maxGrowth(curve: number[]): number {
  let max = 0;
  for (let index = 1; index < curve.length; index += 1) {
    const previous = curve[index - 1];
    if (previous <= 0) continue;
    max = Math.max(max, (curve[index] - previous) / previous);
  }
  return max;
}

const returnProfile: RunnerInput = {
  raceDistance: "5K",
  goalType: "return_to_running",
  startDate: "2026-03-30",
  goalDate: "2026-06-21",
  currentContinuousRunMin: 8,
  currentWeeklyRuns: 1,
  currentWeeklyVolumeKm: 6,
  longestRecentRunMin: 16,
  recentConsistency: 0.35,
  availableTrainingDays: ["monday", "wednesday", "saturday"],
  preferredLongRunDay: "saturday",
  typicalAvailableTimeMin: 35,
  trainingStylePreference: "conservative",
  experienceLevel: "recreational",
  injuryConcern: "moderate",
  externalTrainingLoad: "light",
  confidence: 3,
  freeTextFlags: ["return after break"],
};

const beginnerProfile: RunnerInput = {
  ...returnProfile,
  goalType: "finish",
  injuryConcern: "low",
  freeTextFlags: [],
};

const returnPlan = generateEngineV2Plan(returnProfile);
const beginnerPlan = generateEngineV2Plan(beginnerProfile);

assert.ok(returnPlan.returnToRunningState?.active, "Return plan should expose protected return mode state");

assert.ok(
  maxGrowth(returnPlan.curves.weeklyVolumeCurve) <= maxGrowth(beginnerPlan.curves.weeklyVolumeCurve),
  "Return mode weekly volume should be capped at least as tightly as beginner equivalent",
);
assert.ok(
  maxGrowth(returnPlan.curves.longRunCurve) <= maxGrowth(beginnerPlan.curves.longRunCurve),
  "Return mode long-run growth should be capped at least as tightly as beginner equivalent",
);

assert.ok(
  Math.max(...returnPlan.curves.sessionsPerWeekCurve) <= 3,
  "Return mode should not ramp beyond 3 sessions/week in this slice",
);
assert.ok(
  returnPlan.curves.sessionsPerWeekCurve.slice(0, 4).every((value) => value <= 2),
  "Return mode should restrain session-count growth in early weeks",
);

const illegalIntensity = returnPlan.weeks.some((week) =>
  week.sessions.some((session) => ["intervals", "tempo_run", "race_specific", "hill_reps"].includes(session.family)),
);
assert.equal(illegalIntensity, false, "Return mode must not unlock illegal intensity families");

const returnBaseTemplate = getWeeklyStructure({
  phase: "base",
  sessionsPerWeek: 3,
  runnerType: "return_to_running",
  goalType: "return_to_running",
  raceDistance: "5K",
});
const beginnerBaseTemplate = getWeeklyStructure({
  phase: "base",
  sessionsPerWeek: 3,
  runnerType: "beginner_plus",
  goalType: "finish",
  raceDistance: "5K",
});
assert.notDeepEqual(returnBaseTemplate, beginnerBaseTemplate, "Return-to-running templates should remain distinct from beginner finish");

const weekOneState = returnPlan.returnToRunningState?.weeklyStates[0];
const laterState = returnPlan.returnToRunningState?.weeklyStates.find((state) => state.weekIndex >= 5);
assert.ok(weekOneState && !weekOneState.continuityGatePassed, "Early return weeks should start behind the continuity gate");
assert.ok(weekOneState?.runWalkPreferred, "Early return weeks should prefer run/walk");
assert.ok(laterState, "Later return week state should exist");

const compliantReturnProfile: RunnerInput = {
  ...returnProfile,
  currentContinuousRunMin: 22,
  currentWeeklyRuns: 3,
  currentWeeklyVolumeKm: 18,
  longestRecentRunMin: 38,
  recentConsistency: 0.72,
  injuryConcern: "low",
};
const compliantReturnPlan = generateEngineV2Plan(compliantReturnProfile);
assert.equal(
  compliantReturnPlan.returnToRunningState?.graduationEligible,
  true,
  "Compliant comeback runner should be marked as graduation-eligible",
);

const validationReport = validateVNextPlan(returnPlan);
assert.equal(typeof validationReport.passed, "boolean");
assert.ok(Array.isArray(validationReport.results), "Validator should still run on return-to-running plans");

console.log("engine-vnext return mode tests passed");
