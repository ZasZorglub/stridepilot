import assert from "node:assert/strict";
import { sessionOccursOnOrAfterStart } from "../src/lib/calendar-week";
import { applyStubWeekToPlan, buildStubWeekSession, resolveStubWeekPolicy } from "../src/lib/late-week-start";
import type { Goal, RunnerProfile, TrainingPlan } from "../src/lib/types";

function baseProfile(overrides: Partial<RunnerProfile> = {}): RunnerProfile {
  return {
    heightCm: 175,
    weightKg: 75,
    age: 30,
    activityLevel: "moderat",
    runningExperience: "nybegynder",
    currentRunningAbility: "helt_ny",
    currentWeeklyVolumeKm: 0,
    currentRunsPerWeek: 0,
    longestCurrentRunMin: 0,
    ...overrides,
  };
}

function baseGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    distance: "5K",
    goalType: "complete",
    weeks: 8,
    startDate: "2026-04-10",
    availableTrainingDays: ["Tirsdag", "Torsdag", "Lordag"],
    ...overrides,
  };
}

const fridayThreeDayPolicy = resolveStubWeekPolicy({
  selectedStartDateIso: "2026-04-10",
  availableTrainingDays: ["Tirsdag", "Torsdag", "Lordag"],
});
assert.equal(fridayThreeDayPolicy.hasStubWeek, true);
assert.equal(fridayThreeDayPolicy.effectiveStartDateIso, "2026-04-13");
assert.equal(fridayThreeDayPolicy.remainingPlannedSessions, 1);

const saturdayTwoDayPolicy = resolveStubWeekPolicy({
  selectedStartDateIso: "2026-04-11",
  availableTrainingDays: ["Onsdag", "Sondag"],
});
assert.equal(saturdayTwoDayPolicy.hasStubWeek, true);
assert.equal(saturdayTwoDayPolicy.effectiveStartDateIso, "2026-04-13");
assert.equal(saturdayTwoDayPolicy.remainingPlannedSessions, 1);

const beginnerStub = buildStubWeekSession({
  policy: fridayThreeDayPolicy,
  runnerProfile: baseProfile({
    onboardingTrack: "getting_started",
    currentContinuousDistanceKm: 1,
    currentRunsPerWeek: 0,
    longestCurrentRunMin: 10,
  }),
  goal: baseGoal(),
});
assert.ok(beginnerStub);
assert.equal(beginnerStub?.week, 0);
assert.equal(beginnerStub?.loadScore, 1);
assert.equal(beginnerStub?.dayOfWeek, "Lordag");
assert.equal(beginnerStub?.steps.filter((step) => step.type === "run").length, 4);
assert.ok((beginnerStub?.steps.find((step) => step.type === "run")?.durationSec ?? 0) <= 90);

const returningStub = buildStubWeekSession({
  policy: fridayThreeDayPolicy,
  runnerProfile: baseProfile({
    onboardingTrack: "returning",
    currentContinuousDistanceKm: 4,
    currentRunsPerWeek: 2,
    currentWeeklyVolumeKm: 16,
    longestCurrentRunMin: 30,
    runningExperience: "let_ovet",
    currentRunningAbility: "ti_femten_min",
  }),
  goal: baseGoal({ distance: "10K" }),
});
assert.ok(returningStub);
assert.equal(returningStub?.week, 0);
assert.ok((returningStub?.steps.filter((step) => step.type === "run").reduce((sum, step) => sum + step.durationSec, 0) ?? 0) <= 12 * 60);

const basePlan: TrainingPlan = {
  summary: "Test",
  weeks: 8,
  sessionsPerWeek: 3,
  sessions: [
    {
      id: "week-1-easy",
      title: "Roligt løb",
      week: 1,
      dayOfWeek: "Tirsdag",
      loadScore: 3,
      steps: [{ type: "run", label: "Roligt løb", durationSec: 1200, cue: "Roligt." }],
    },
  ],
};

const stubPlan = applyStubWeekToPlan(basePlan, beginnerStub ?? null);
assert.equal(stubPlan.sessions[0]?.week, 0);
assert.equal(sessionOccursOnOrAfterStart("2026-04-13", stubPlan.sessions[0]!), true);
assert.equal(stubPlan.sessions[1]?.week, 1);
