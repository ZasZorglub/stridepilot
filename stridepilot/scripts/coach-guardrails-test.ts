import assert from "node:assert/strict";

import { buildGoalPlan } from "../src/lib/coach/build5kPlan";
import {
  buildEasyWorkout,
  buildIntervalWorkout,
  buildRecoveryWorkout,
  buildRunWalkWorkout,
  sumDuration,
} from "../src/lib/coach/workouts";
import type { GoalConfig, RunnerProfile } from "../src/lib/coach/types";

const beginnerGoal: GoalConfig = {
  goalDistance: "5K",
  goalIntent: "finish",
  targetDate: "2026-08-01",
  trainingDaysPerWeek: 3,
  startDate: "2026-04-21",
};

function makeProfile(overrides: Partial<RunnerProfile> = {}): RunnerProfile {
  return {
    baseProgramTrack: "getting_started",
    archetype: "nervous_beginner",
    runnerCategory: "continuous_beginner",
    aerobicBase: 1,
    runningSpecificity: 1,
    confidence: 2,
    injurySensitivity: 3,
    progressionStyle: "conservative",
    currentRunsPerWeek: 1,
    currentWeeklyVolumeKm: 4,
    longestRunMinutes: 15,
    typicalWorkoutMinutes: 20,
    realisticTrainingDaysPerWeek: 3,
    ...overrides,
  };
}

function makeContext(overrides: Partial<Parameters<typeof buildEasyWorkout>[0]> = {}): Parameters<typeof buildEasyWorkout>[0] {
  return {
    weekNumber: 1,
    phase: "introduction",
    profile: makeProfile(),
    goal: beginnerGoal,
    dayOfWeek: "tuesday",
    date: "2026-04-21",
    isStabilizationWeek: false,
    continuousRunMin: 12,
    longRunMin: 18,
    intervalRunMin: 2,
    walkBreakMin: 2,
    repeats: 4,
    ...overrides,
  };
}

function openingSegments(structure: ReturnType<typeof buildEasyWorkout>["structure"]) {
  const result = [];
  for (const segment of structure) {
    if (segment.type === "walk" || segment.type === "warmup" || segment.label.toLowerCase().includes("opvarm") || segment.label.toLowerCase().includes("jog")) {
      result.push(segment);
      continue;
    }
    break;
  }
  return result;
}

function endingSegments(structure: ReturnType<typeof buildEasyWorkout>["structure"]) {
  const result = [];
  for (let index = structure.length - 1; index >= 0; index -= 1) {
    const segment = structure[index];
    if (segment.type === "walk" || segment.type === "cooldown" || segment.label.toLowerCase().includes("ned") || segment.label.toLowerCase().includes("afslut")) {
      result.unshift(segment);
      continue;
    }
    break;
  }
  return result;
}

function describe(session: ReturnType<typeof buildEasyWorkout>): string {
  return session.structure.map((segment) => `${segment.type}:${segment.durationMin}`).join(" | ");
}

const shortEasy = buildEasyWorkout(makeContext());
assert.equal(
  describe(shortEasy),
  "walk:1 | recovery:2.5 | steady:12 | recovery:1 | walk:1",
  "short continuous beginner sessions should open actively and avoid passive cooldown padding",
);
assert.ok(sumDuration(openingSegments(shortEasy.structure)) <= 5, "opening should stay concise on short easy runs");
assert.ok(sumDuration(endingSegments(shortEasy.structure)) <= 3, "cooldown should stay proportionate on short easy runs");

const beginnerRunWalk = buildRunWalkWorkout(
  makeContext({
    profile: makeProfile({ runnerCategory: "run_walk_beginner" }),
    continuousRunMin: 10,
    intervalRunMin: 2,
    walkBreakMin: 2,
    repeats: 3,
  }),
);
assert.equal(beginnerRunWalk.structure[0]?.type, "walk", "run-walk beginners may still start with walking");
assert.ok(beginnerRunWalk.structure[0]?.durationMin <= 4, "run-walk opening walk should stay under the new passive-start budget");
assert.ok(
  sumDuration(beginnerRunWalk.structure.slice(1, -1)) > sumDuration([beginnerRunWalk.structure[0]!, beginnerRunWalk.structure.at(-1)!]),
  "run-walk sessions should contain more actual workout than setup/finish filler",
);

const shortInterval = buildIntervalWorkout(
  makeContext({
    profile: makeProfile({ runnerCategory: "continuous_beginner", currentRunsPerWeek: 2 }),
    intervalRunMin: 2,
    walkBreakMin: 2,
    repeats: 3,
  }),
);
assert.equal(shortInterval.structure[0]?.type, "recovery", "quality sessions should warm up by jogging rather than opening with extra walking");
assert.equal(shortInterval.structure[1]?.type, "run", "interval main work should remain the central block");
assert.equal(shortInterval.structure[1]?.repeats, 3, "interval guardrails must preserve the planned repeat count");
assert.equal(shortInterval.structure[1]?.recoverMin, 1.5, "interval guardrails should preserve recovery between repeats");
assert.ok(sumDuration(endingSegments(shortInterval.structure)) <= 2, "interval cooldown should stay brief once quality work is done");

const recovery = buildRecoveryWorkout(makeContext({ continuousRunMin: 14 }));
const recoveryCore = recovery.structure.filter((segment) => segment.label === "Meget let bevægelse");
assert.equal(recoveryCore.length, 1, "recovery sessions should stay structurally clean");
assert.ok(sumDuration(openingSegments(recovery.structure)) <= 5, "recovery openings should stay concise");
assert.ok(sumDuration(endingSegments(recovery.structure)) <= 4, "recovery cooldown should stay proportionate");

const onboardingProfile = makeProfile({
  runnerCategory: "true_beginner",
  currentRunsPerWeek: 0,
  currentWeeklyVolumeKm: 0,
  longestRunMinutes: 0,
  confidence: 1,
  injurySensitivity: 4,
  typicalWorkoutMinutes: 25,
});
const onboardingGoal: GoalConfig = {
  ...beginnerGoal,
  targetDate: "2026-07-12",
  trainingDaysPerWeek: 3,
  preferredTrainingDays: ["tuesday", "thursday", "sunday"],
};
const onboardingPlan = buildGoalPlan(onboardingProfile, onboardingGoal);
const onboardingWeekOne = onboardingPlan.weeks[0]!;
assert.equal(onboardingWeekOne.sessions.length, 3, "full opening week should keep all three sessions");
assert.ok(
  onboardingWeekOne.sessions.some((session) => session.type === "run-walk"),
  "opening week should still protect the weakest beginner with run-walk structure",
);
assert.notDeepEqual(
  onboardingWeekOne.sessions.map((session) => session.durationMin),
  Array(onboardingWeekOne.sessions.length).fill(onboardingWeekOne.sessions[0]!.durationMin),
  "opening week should not collapse into three identical beginner session durations",
);
const firstRunWalk = onboardingWeekOne.sessions.find((session) => session.type === "run-walk")!;
const lastRunWalk = [...onboardingWeekOne.sessions].reverse().find((session) => session.type === "run-walk")!;
const firstRunBlock = firstRunWalk.structure.find((segment) => segment.type === "run")!;
const lastRunBlock = lastRunWalk.structure.find((segment) => segment.type === "run")!;
const firstOpening = firstRunWalk.structure[0]!;
const firstFinish = firstRunWalk.structure.at(-1)!;
const firstRecoverTotal = ((firstRunBlock.repeats ?? 1) - 1) * (firstRunBlock.recoverMin ?? 0);
const firstRunningTotal = firstRunBlock.durationMin * (firstRunBlock.repeats ?? 1);
const firstRunWalkTotal = sumDuration(firstRunWalk.structure);
assert.ok(
  (lastRunBlock.durationMin * (lastRunBlock.repeats ?? 1)) >= (firstRunBlock.durationMin * (firstRunBlock.repeats ?? 1)),
  "later onboarding run-walk sessions should preserve or improve meaningful running exposure",
);
assert.ok(
  firstRunWalkTotal > 0 && firstRunningTotal / firstRunWalkTotal >= 0.45,
  "the weakest beginner's first run-walk session should clear the meaningful-running floor",
);
assert.ok(
  firstRecoverTotal <= firstRunningTotal,
  "the weakest beginner's first run-walk session should not be pause-dominant",
);
assert.ok(
  sumDuration([firstOpening, firstFinish]) <= 3.5,
  "the weakest beginner's first run-walk session should keep framing light",
);
const onboardingWeekTwo = onboardingPlan.weeks[1]!;
assert.notDeepEqual(
  onboardingWeekTwo.sessions.map((session) => session.structure.map((segment) => `${segment.type}:${segment.durationMin}:${segment.repeats ?? 1}:${segment.recoverMin ?? 0}`).join("|")),
  Array(onboardingWeekTwo.sessions.length).fill(
    onboardingWeekTwo.sessions[0]!.structure.map((segment) => `${segment.type}:${segment.durationMin}:${segment.repeats ?? 1}:${segment.recoverMin ?? 0}`).join("|"),
  ),
  "week 2 for the weakest beginner should not collapse into repeated identical run-walk structures",
);

const partialGoal: GoalConfig = {
  ...onboardingGoal,
  startDate: "2026-04-22",
};
const partialPlan = buildGoalPlan(onboardingProfile, partialGoal);
const partialWeekOne = partialPlan.weeks[0]!;
assert.equal(partialWeekOne.sessions.length, 2, "partial opening week should only keep the surviving sessions");
assert.equal(partialWeekOne.sessions[0]?.type, "run-walk", "the first actual beginner session in a partial week should stay introductory");

const recentFirstSession = buildRunWalkWorkout(
  makeContext({
    profile: makeProfile({
      archetype: "fit_but_inexperienced",
      runnerCategory: "continuous_beginner",
      aerobicBase: 3,
      runningSpecificity: 1,
      confidence: 2,
      injurySensitivity: 2,
      currentWeeklyVolumeKm: 8,
      longestRunMinutes: 18,
      typicalWorkoutMinutes: 32,
    }),
    intervalRunMin: 2,
    walkBreakMin: 2,
    repeats: 5,
  }),
);

const longBreakFirstSession = buildRunWalkWorkout(
  makeContext({
    profile: makeProfile({
      archetype: "nervous_beginner",
      runnerCategory: "continuous_beginner",
      aerobicBase: 2,
      runningSpecificity: 2,
      confidence: 2,
      injurySensitivity: 4,
      currentWeeklyVolumeKm: 8,
      longestRunMinutes: 18,
      typicalWorkoutMinutes: 32,
    }),
    intervalRunMin: 2,
    walkBreakMin: 2,
    repeats: 5,
  }),
);

assert.equal(recentFirstSession.type, "run-walk", "recent and long-break beginners should stay in the same safe introductory workout family");
assert.equal(longBreakFirstSession.type, "run-walk", "recent and long-break beginners should stay in the same safe introductory workout family");
assert.deepEqual(
  recentFirstSession.structure[0],
  { type: "recovery", label: "Let jog", durationMin: 3.5 },
  "a recently running beginner should get a slightly more active first-session opening",
);
assert.deepEqual(
  longBreakFirstSession.structure.slice(0, 2),
  [
    { type: "walk", label: "Rolig gang", durationMin: 1 },
    { type: "recovery", label: "Let jog", durationMin: 2.5 },
  ],
  "a long-break or new beginner should keep the calmer walk-plus-jog first-session opening",
);

console.log("coach-guardrails-test: ok");
