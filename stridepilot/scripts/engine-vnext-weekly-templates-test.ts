import assert from "node:assert/strict";

import { selectArchetype } from "../src/lib/engine-vnext/archetypes/selectArchetype";
import { selectWeeklyTemplate } from "../src/lib/engine-vnext/templates/selectWeeklyTemplate";
import { classifyRunner } from "../src/lib/engine-v2";
import { placeSessionsOnDays } from "../src/lib/engine-v2/engine/sessionPlacement";
import { generateEngineV2Plan } from "../src/lib/engine-v2/engine";
import { buildWeeklyStructure, getWeeklyStructure } from "../src/lib/engine-v2/weeklyStructure";
import type { GoalType, ProgressionCurves, RaceDistance, RunnerInput, WeeklyStructure } from "../src/lib/engine-v2/models";
import { referenceRunnerBenchmarks } from "../src/lib/engine-v2/benchmark/benchmarkFixtures";

const DAY_INDEX: Record<string, number> = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
};

function rolesKey(roles: string[]): string {
  return roles.join(" / ");
}

function expectArchetype(params: {
  runnerLevel: "true_beginner" | "beginner" | "beginner_plus" | "recreational" | "intermediate" | "advanced";
  goalType: GoalType;
  raceDistance: RaceDistance;
  returnToRunning?: boolean;
}, expected: string): void {
  const archetype = selectArchetype(params);
  assert.equal(archetype.id, expected);
}

expectArchetype(
  { runnerLevel: "true_beginner", goalType: "finish_without_walking", raceDistance: "5K" },
  "true_beginner_5k_finish",
);
expectArchetype(
  { runnerLevel: "beginner_plus", goalType: "finish", raceDistance: "10K" },
  "beginner_finish",
);
expectArchetype(
  { runnerLevel: "beginner_plus", goalType: "improve_time", raceDistance: "5K" },
  "beginner_plus_improve",
);
expectArchetype(
  { runnerLevel: "recreational", goalType: "target_time", raceDistance: "10K" },
  "recreational_target_time",
);
expectArchetype(
  { runnerLevel: "intermediate", goalType: "finish", raceDistance: "10K" },
  "intermediate_finish",
);
expectArchetype(
  { runnerLevel: "recreational", goalType: "finish", raceDistance: "HalfMarathon" },
  "half_marathon_finish",
);
expectArchetype(
  { runnerLevel: "intermediate", goalType: "target_time", raceDistance: "HalfMarathon" },
  "half_marathon_target",
);
expectArchetype(
  { runnerLevel: "advanced", goalType: "finish", raceDistance: "Marathon" },
  "marathon_finish",
);
expectArchetype(
  { runnerLevel: "beginner", goalType: "return_to_running", raceDistance: "5K", returnToRunning: true },
  "return_to_running",
);

const beginnerFinishBase = getWeeklyStructure({
  phase: "base",
  sessionsPerWeek: 3,
  runnerType: "beginner_plus",
  goalType: "finish",
  raceDistance: "5K",
});
const beginnerFinishSpecific = getWeeklyStructure({
  phase: "specific",
  sessionsPerWeek: 3,
  runnerType: "beginner_plus",
  goalType: "finish",
  raceDistance: "5K",
});
const beginnerFinishRaceWeek = getWeeklyStructure({
  phase: "taper",
  sessionsPerWeek: 3,
  runnerType: "beginner_plus",
  goalType: "finish",
  raceDistance: "5K",
  isRaceWeek: true,
});

const fiveKImproveBuild = getWeeklyStructure({
  phase: "build",
  sessionsPerWeek: 3,
  runnerType: "beginner_plus",
  goalType: "improve_time",
  raceDistance: "5K",
});
const tenKTargetSpecific = getWeeklyStructure({
  phase: "specific",
  sessionsPerWeek: 4,
  runnerType: "recreational",
  goalType: "target_time",
  raceDistance: "10K",
});
const halfFinishBuild = getWeeklyStructure({
  phase: "build",
  sessionsPerWeek: 4,
  runnerType: "recreational",
  goalType: "finish",
  raceDistance: "HalfMarathon",
});
const marathonFinishPeak = getWeeklyStructure({
  phase: "peak",
  sessionsPerWeek: 5,
  runnerType: "advanced_recreational",
  goalType: "finish",
  raceDistance: "Marathon",
});
const returnToRunningBase = getWeeklyStructure({
  phase: "base",
  sessionsPerWeek: 3,
  runnerType: "return_to_running",
  goalType: "return_to_running",
  raceDistance: "5K",
});

assert.notEqual(rolesKey(beginnerFinishBase), rolesKey(beginnerFinishSpecific));
assert.notEqual(rolesKey(beginnerFinishSpecific), rolesKey(beginnerFinishRaceWeek));
assert.notEqual(rolesKey(beginnerFinishBase), rolesKey(returnToRunningBase));

assert.equal(rolesKey(beginnerFinishBase), "easy / support / long_run");
assert.equal(rolesKey(fiveKImproveBuild), "easy / quality / long_run");
assert.equal(rolesKey(tenKTargetSpecific), "easy / race_pace / recovery / long_with_segments");
assert.equal(rolesKey(halfFinishBuild), "easy / steady / recovery / long_run");
assert.equal(rolesKey(marathonFinishPeak), "easy / support / easy / recovery / long_short");
assert.equal(rolesKey(returnToRunningBase), "easy / recovery / long_short");

const vNextSpecificTemplate = selectWeeklyTemplate({
  archetype: selectArchetype({
    runnerLevel: "recreational",
    goalType: "target_time",
    raceDistance: "10K",
  }),
  phase: "specific",
  sessionsPerWeek: 4,
});
assert.equal(rolesKey(vNextSpecificTemplate.roles), "easy / race_pace / recovery / long_with_segments");

const vNextBaseTemplate = selectWeeklyTemplate({
  archetype: selectArchetype({
    runnerLevel: "recreational",
    goalType: "target_time",
    raceDistance: "10K",
  }),
  phase: "base",
  sessionsPerWeek: 4,
});
assert.notEqual(rolesKey(vNextSpecificTemplate.roles), rolesKey(vNextBaseTemplate.roles));

const integrationFixture = referenceRunnerBenchmarks.find((fixture) => fixture.id === "recreational_10k_improve");
assert.ok(integrationFixture, "Expected recreational_10k_improve fixture to exist");
const generatedPlan = generateEngineV2Plan(integrationFixture!.input);
assert.ok(generatedPlan.weeks.length > 0, "Legacy generation should still produce weeks");
assert.ok(generatedPlan.weeks[0]?.workoutSelections?.length, "Legacy generation should still produce workout selections");

const wideAvailabilityInput: RunnerInput = {
  raceDistance: "10K",
  goalType: "finish",
  startDate: "2026-03-23",
  goalDate: "2026-06-28",
  currentContinuousRunMin: 32,
  currentWeeklyRuns: 3,
  currentWeeklyVolumeKm: 24,
  longestRecentRunMin: 48,
  recentConsistency: 0.68,
  availableTrainingDays: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
  preferredLongRunDay: "sunday",
  typicalAvailableTimeMin: 55,
  trainingStylePreference: "balanced",
  experienceLevel: "recreational",
  injuryConcern: "low",
  externalTrainingLoad: "light",
  confidence: 3,
};

const wideAvailabilityCurves: ProgressionCurves = {
  backboneType: "long_run_backbone",
  backboneTargetCurve: [0.45],
  sessionsPerWeekCurve: [3],
  longRunCurve: [62],
  weeklyVolumeCurve: [150],
  intervalDurationCurve: [10],
  intensityCurve: [0.26],
  continuousCurve: [34],
  specificityCurve: [0.35],
  densityCurve: [0.3],
  primaryLoadDimension: ["weekly_volume"],
  cutbackWeeks: [],
  taperWeeks: [],
};

const wideAvailabilityClassification = classifyRunner(wideAvailabilityInput);
const evenlySpacedStructure = buildWeeklyStructure(
  wideAvailabilityInput,
  wideAvailabilityClassification,
  {
    weekIndex: 1,
    phase: "build",
    timelinePhase: "build",
    phaseProgress: 0.4,
    isCutback: false,
    isRaceWeek: false,
    targetRuns: 3,
    targetQualitySessions: 1,
    notes: [],
  },
  "10k_finish",
  wideAvailabilityCurves,
);
const evenlySpacedDays = evenlySpacedStructure.slots.map((slot) => slot.day);
assert.equal(
  evenlySpacedDays.includes("monday") && evenlySpacedDays.includes("thursday") && evenlySpacedDays.includes("sunday"),
  true,
  "when many training days are available, three sessions should be spread across the week instead of clustering early",
);
assert.equal(
  evenlySpacedStructure.longRunDay,
  "sunday",
  "the longest/key session should still land on the later weekend day when it is available",
);

const fourRunStructure = buildWeeklyStructure(
  wideAvailabilityInput,
  wideAvailabilityClassification,
  {
    weekIndex: 1,
    phase: "specific",
    timelinePhase: "specific",
    phaseProgress: 0.55,
    isCutback: false,
    isRaceWeek: false,
    targetRuns: 4,
    targetQualitySessions: 1,
    notes: [],
  },
  "10k_finish",
  {
    ...wideAvailabilityCurves,
    sessionsPerWeekCurve: [4],
    longRunCurve: [70],
    weeklyVolumeCurve: [180],
    intervalDurationCurve: [12],
    intensityCurve: [0.3],
    specificityCurve: [0.5],
    densityCurve: [0.4],
    primaryLoadDimension: ["long_run"],
  },
);
const fourRunDays = fourRunStructure.slots.map((slot) => slot.day);
const orderedFourRunDays = [...new Set(fourRunDays)].sort((left, right) => DAY_INDEX[left] - DAY_INDEX[right]);
assert.equal(
  orderedFourRunDays.join(" / "),
  "monday / wednesday / friday / sunday",
  "with all 7 days available, four sessions should be distributed across the full week rather than stacked at the start",
);
assert.equal(
  fourRunDays.filter((day) => day === "monday" || day === "tuesday" || day === "wednesday" || day === "thursday").length < 4,
  true,
  "plans should not default to a full Mon-Thu cluster when later days are available",
);
assert.equal(
  fourRunDays.includes("friday") || fourRunDays.includes("saturday") || fourRunDays.includes("sunday"),
  true,
  "at least one non-long-run session should still land later in the week when a broader spread is available",
);
assert.equal(fourRunStructure.totalRuns, 4, "selected training-day count should still be respected");

const limitedAvailabilityInput: RunnerInput = {
  ...wideAvailabilityInput,
  availableTrainingDays: ["monday", "wednesday", "friday"],
};
const limitedAvailabilityClassification = classifyRunner(limitedAvailabilityInput);
const limitedAvailabilityStructure = buildWeeklyStructure(
  limitedAvailabilityInput,
  limitedAvailabilityClassification,
  {
    weekIndex: 1,
    phase: "build",
    timelinePhase: "build",
    phaseProgress: 0.4,
    isCutback: false,
    isRaceWeek: false,
    targetRuns: 3,
    targetQualitySessions: 1,
    notes: [],
  },
  "10k_finish",
  wideAvailabilityCurves,
);
assert.deepEqual(
  [...new Set(limitedAvailabilityStructure.slots.map((slot) => slot.day))].sort((left, right) => DAY_INDEX[left] - DAY_INDEX[right]),
  ["monday", "wednesday", "friday"],
  "when user availability is limited, the engine should still respect the chosen training days exactly",
);

const clusteredWeek: WeeklyStructure = {
  weekIndex: 1,
  phase: "build",
  totalRuns: 4,
  weeklyEmphasis: "durability_build",
  longRunDay: "tuesday",
  qualityDays: [],
  easyDays: ["monday", "wednesday"],
  recoveryDays: ["thursday"],
  longRunTargetMin: 70,
  weeklyVolumeTargetMin: 180,
  intensityTarget: 0.2,
  continuousTargetMin: 35,
  slots: [
    { role: "easy", day: "monday", targetDurationMin: 42 },
    { role: "long_run", day: "tuesday", targetDurationMin: 76, protected: true },
    { role: "easy", day: "wednesday", targetDurationMin: 38 },
    { role: "recovery", day: "thursday", targetDurationMin: 28, protected: true },
  ],
};
const redistributedClusteredWeek = placeSessionsOnDays([clusteredWeek], wideAvailabilityInput)[0]!;
const redistributedDays = redistributedClusteredWeek.slots.map((slot) => slot.day);
assert.equal(
  [...new Set(redistributedDays)].sort((left, right) => DAY_INDEX[left] - DAY_INDEX[right]).join(" / "),
  "monday / wednesday / friday / sunday",
  "with all 7 days available and 4 sessions, the final day-placement pass should avoid a Mon-Thu cluster",
);
assert.equal(
  redistributedClusteredWeek.slots.find((slot) => slot.role === "long_run")?.day === "sunday",
  true,
  "the long run should land on Sunday when it is available",
);

const clusteredThreeRunWeek: WeeklyStructure = {
  weekIndex: 1,
  phase: "build",
  totalRuns: 3,
  weeklyEmphasis: "durability_build",
  longRunDay: "tuesday",
  qualityDays: [],
  easyDays: ["monday", "wednesday"],
  recoveryDays: [],
  longRunTargetMin: 60,
  weeklyVolumeTargetMin: 150,
  intensityTarget: 0.18,
  continuousTargetMin: 32,
  slots: [
    { role: "easy", day: "monday", targetDurationMin: 40 },
    { role: "aerobic_support", day: "tuesday", targetDurationMin: 44 },
    { role: "long_run", day: "wednesday", targetDurationMin: 66, protected: true },
  ],
};
const redistributedThreeRunWeek = placeSessionsOnDays([clusteredThreeRunWeek], wideAvailabilityInput)[0]!;
assert.deepEqual(
  [...new Set(redistributedThreeRunWeek.slots.map((slot) => slot.day))].sort((left, right) => DAY_INDEX[left] - DAY_INDEX[right]),
  ["tuesday", "thursday", "sunday"],
  "with 3 sessions and all 7 days available, the final day-placement pass should create meaningful spacing across the week",
);

const limitedPlacementWeek = placeSessionsOnDays([clusteredThreeRunWeek], limitedAvailabilityInput)[0]!;
assert.deepEqual(
  [...new Set(limitedPlacementWeek.slots.map((slot) => slot.day))].sort((left, right) => DAY_INDEX[left] - DAY_INDEX[right]),
  ["monday", "wednesday", "friday"],
  "the final day-placement pass should still respect restricted availability exactly",
);

console.log("engine-vnext weekly template tests passed");
