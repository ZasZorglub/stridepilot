import assert from "node:assert/strict";

import { buildBenchmarkReports } from "../src/lib/coach/benchmarkReports";
import { buildGoalPlan } from "../src/lib/coach/build5kPlan";
import { GoalConfig, RunnerProfile } from "../src/lib/coach/types";

const reports = buildBenchmarkReports();

function reportById(profileId: string) {
  const report = reports.find((entry) => entry.profileId === profileId);
  assert.ok(report, `benchmark profile ${profileId} should exist`);
  return report;
}

function maxRunBlockMinutesForSession(report: ReturnType<typeof reportById>, weekIndex: number, sessionIndex: number): number {
  return Math.max(
    ...report.weeks[weekIndex]!.sessions[sessionIndex]!.steps
      .filter((step) => step.type === "run")
      .map((step) => step.durationSec / 60),
  );
}

function weekHasQualityType(report: ReturnType<typeof reportById>, weekIndex = 0): boolean {
  return report.weeks[weekIndex]!.sessions.some((session) =>
    ["steady", "progression", "tempo", "interval", "race-specific"].includes(session.sessionType),
  );
}

const cautiousTwoDayStarter = reportById("profile-45");
assert.equal(
  cautiousTwoDayStarter.weeks[0]?.sessions[0]?.sessionType,
  "run-walk",
  "fragile 2-day getting-started runners should still open with run-walk instead of a fully continuous opening session",
);
assert.ok(
  maxRunBlockMinutesForSession(cautiousTwoDayStarter, 0, 0) <= 4,
  "fragile 2-day starters should keep week-1 run blocks clearly below a demanding continuous effort",
);

const nervousTenKStarter = reportById("profile-41");
assert.equal(
  weekHasQualityType(nervousTenKStarter),
  false,
  "nervous getting-started runners should not surface quality-looking workouts in week 1",
);
assert.ok(
  maxRunBlockMinutesForSession(nervousTenKStarter, 0, 0) <= 2,
  "nervous getting-started runners should keep week-1 run blocks inside a conservative entry range",
);

const beginnerTenK = reportById("profile-04");
assert.equal(
  weekHasQualityType(beginnerTenK),
  false,
  "novice 10K getting-started profiles should keep the opening week clearly easy-first",
);
assert.ok(
  maxRunBlockMinutesForSession(beginnerTenK, 1, 0) <= 2,
  "the first two weeks for low-capacity getting-started runners should still stay inside a controlled continuous cap",
);

const goalFocusedTenK = reportById("profile-06");
assert.deepEqual(
  goalFocusedTenK.weeks[0]?.sessions.map((session) => session.sessionType),
  ["easy", "recovery", "steady", "long"],
  "stronger goal-focused runners should keep their existing differentiated week-1 posture",
);

function buildProfile(overrides: Partial<RunnerProfile>): RunnerProfile {
  return {
    baseProgramTrack: "getting_started",
    archetype: "nervous_beginner",
    runnerCategory: "true_beginner",
    aerobicBase: 1,
    runningSpecificity: 1,
    confidence: 2,
    injurySensitivity: 4,
    progressionStyle: "conservative",
    currentRunsPerWeek: 1,
    currentWeeklyVolumeKm: 1,
    longestRunMinutes: 1,
    typicalWorkoutMinutes: 30,
    realisticTrainingDaysPerWeek: 3,
    ...overrides,
  };
}

function buildGoal(goalDistance: GoalConfig["goalDistance"] = "5K"): GoalConfig {
  return {
    goalDistance,
    goalIntent: "finish",
    targetDate: "2026-07-01",
    trainingDaysPerWeek: 3,
    startDate: "2026-04-13",
    preferredTrainingDays: ["tuesday", "thursday", "sunday"],
  };
}

function firstSession(plan: ReturnType<typeof buildGoalPlan>) {
  const session = plan.weeks[0]?.sessions[0];
  assert.ok(session, "week 1 should have an opening session");
  return session;
}

function maxRunBlockInStructure(session: ReturnType<typeof firstSession>): number {
  return Math.max(...session.structure.filter((segment) => segment.type === "run").map((segment) => segment.durationMin));
}

function totalRunFromStructure(session: ReturnType<typeof firstSession>): number {
  return session.structure
    .filter((segment) => segment.type === "run")
    .reduce((sum, segment) => sum + segment.durationMin * (segment.repeats ?? 1), 0);
}

const halfKilometerBeginner = buildGoalPlan(
  buildProfile({
    currentRunsPerWeek: 0,
    currentWeeklyVolumeKm: 0,
    longestRunMinutes: 0,
    realisticTrainingDaysPerWeek: 3,
  }),
  buildGoal(),
);
assert.equal(firstSession(halfKilometerBeginner).type, "run-walk");
assert.ok(
  maxRunBlockInStructure(firstSession(halfKilometerBeginner)) <= 1,
  "a near-zero-capacity beginner should open with very short run blocks",
);
assert.ok(totalRunFromStructure(firstSession(halfKilometerBeginner)) <= 2.5);

const oneToTwoMinuteBeginner = buildGoalPlan(
  buildProfile({
    runnerCategory: "run_walk_beginner",
    longestRunMinutes: 2,
    currentRunsPerWeek: 1,
    currentWeeklyVolumeKm: 2,
  }),
  buildGoal(),
);
assert.equal(firstSession(oneToTwoMinuteBeginner).type, "run-walk");
assert.ok(
  maxRunBlockInStructure(firstSession(oneToTwoMinuteBeginner)) <= 2,
  "a 1-2 minute beginner should still stay inside a conservative opening run-block cap",
);
assert.ok(totalRunFromStructure(firstSession(oneToTwoMinuteBeginner)) <= 5);

const fiveMinuteBeginner = buildGoalPlan(
  buildProfile({
    runnerCategory: "continuous_beginner",
    longestRunMinutes: 5,
    currentRunsPerWeek: 1,
    currentWeeklyVolumeKm: 4,
  }),
  buildGoal(),
);
assert.equal(firstSession(fiveMinuteBeginner).type, "run-walk");
assert.ok(
  maxRunBlockInStructure(firstSession(fiveMinuteBeginner)) <= 4,
  "a 3-5 minute beginner should no longer be opened with a near-target continuous block",
);
assert.ok(
  totalRunFromStructure(firstSession(fiveMinuteBeginner)) <= 6,
  "a 3-5 minute beginner should keep total opening run time inside a modest run-walk intro range",
);

console.log("beginner realism policy tests passed");
