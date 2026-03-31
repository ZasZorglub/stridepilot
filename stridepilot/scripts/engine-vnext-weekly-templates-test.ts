import assert from "node:assert/strict";

import { selectArchetype } from "../src/lib/engine-vnext/archetypes/selectArchetype";
import { selectWeeklyTemplate } from "../src/lib/engine-vnext/templates/selectWeeklyTemplate";
import { generateEngineV2Plan } from "../src/lib/engine-v2/engine";
import { getWeeklyStructure } from "../src/lib/engine-v2/weeklyStructure";
import type { GoalType, RaceDistance } from "../src/lib/engine-v2/models";
import { referenceRunnerBenchmarks } from "../src/lib/engine-v2/benchmark/benchmarkFixtures";

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

console.log("engine-vnext weekly template tests passed");
