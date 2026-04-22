import assert from "node:assert/strict";

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

console.log("coach-guardrails-test: ok");
