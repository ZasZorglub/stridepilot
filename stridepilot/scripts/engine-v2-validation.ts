import { generateEngineV2Plan } from "../src/lib/engine-v2";
import type { BuiltWeek, RunnerInput } from "../src/lib/engine-v2";

const fixtures: Array<{ name: string; input: RunnerInput }> = [
  {
    name: "beginner_5k_finish",
    input: {
      raceDistance: "5K",
      goalType: "finish",
      startDate: "2026-03-23",
      goalDate: "2026-06-14",
      currentContinuousRunMin: 5,
      currentWeeklyRuns: 1,
      currentWeeklyVolumeKm: 4,
      longestRecentRunMin: 12,
      recentConsistency: 0.25,
      availableTrainingDays: ["tuesday", "thursday", "sunday"],
      typicalAvailableTimeMin: 30,
      trainingStylePreference: "conservative",
      experienceLevel: "new",
      injuryConcern: "low",
    },
  },
  {
    name: "beginner_plus_10k_finish",
    input: {
      raceDistance: "10K",
      goalType: "finish_without_walking",
      startDate: "2026-03-23",
      goalDate: "2026-07-26",
      currentContinuousRunMin: 20,
      currentWeeklyRuns: 3,
      currentWeeklyVolumeKm: 16,
      longestRecentRunMin: 28,
      recentConsistency: 0.62,
      availableTrainingDays: ["tuesday", "thursday", "sunday"],
      typicalAvailableTimeMin: 45,
      trainingStylePreference: "balanced",
      experienceLevel: "recreational",
      injuryConcern: "low",
    },
  },
  {
    name: "intermediate_10k_improve",
    input: {
      raceDistance: "10K",
      goalType: "improve_time",
      startDate: "2026-03-23",
      goalDate: "2026-06-14",
      currentContinuousRunMin: 40,
      currentWeeklyRuns: 4,
      currentWeeklyVolumeKm: 30,
      longestRecentRunMin: 55,
      recentConsistency: 0.82,
      availableTrainingDays: ["monday", "wednesday", "friday", "sunday"],
      typicalAvailableTimeMin: 60,
      trainingStylePreference: "performance",
      experienceLevel: "intermediate",
      injuryConcern: "low",
    },
  },
  {
    name: "half_marathon_finish",
    input: {
      raceDistance: "HalfMarathon",
      goalType: "finish",
      startDate: "2026-03-23",
      goalDate: "2026-07-12",
      currentContinuousRunMin: 35,
      currentWeeklyRuns: 3,
      currentWeeklyVolumeKm: 22,
      longestRecentRunMin: 45,
      recentConsistency: 0.68,
      availableTrainingDays: ["tuesday", "thursday", "sunday"],
      typicalAvailableTimeMin: 65,
      trainingStylePreference: "balanced",
      experienceLevel: "recreational",
      injuryConcern: "low",
    },
  },
  {
    name: "marathon_improve",
    input: {
      raceDistance: "Marathon",
      goalType: "improve_time",
      startDate: "2026-03-23",
      goalDate: "2026-08-09",
      currentContinuousRunMin: 65,
      currentWeeklyRuns: 5,
      currentWeeklyVolumeKm: 50,
      longestRecentRunMin: 110,
      recentConsistency: 0.84,
      availableTrainingDays: ["monday", "wednesday", "friday", "saturday", "sunday"],
      typicalAvailableTimeMin: 80,
      trainingStylePreference: "performance",
      experienceLevel: "intermediate",
      injuryConcern: "low",
    },
  },
];

function weekPicker(weeks: BuiltWeek[]): number[] {
  const maxWeek = weeks.length;
  const indexes = new Set<number>([1, Math.min(6, maxWeek), Math.min(10, maxWeek), maxWeek]);
  const specificWeek = weeks.find((week) => week.phase === "specific" || week.phase === "peak");
  if (specificWeek) indexes.add(specificWeek.weekIndex);
  return [...indexes].sort((a, b) => a - b);
}

for (const fixture of fixtures) {
  const plan = generateEngineV2Plan(fixture.input);
  const chosenWeeks = weekPicker(plan.weeks)
    .map((weekIndex) => plan.weeks.find((week) => week.weekIndex === weekIndex))
    .filter((week): week is BuiltWeek => Boolean(week));

  console.log(`\n=== ${fixture.name} ===`);
  console.log(
    `classification=level:${plan.classification.traits.runnerLevel}, durability:${Math.round(plan.classification.traits.durabilityScore * 100)}, progression:${Math.round(plan.classification.traits.progressionTolerance * 100)}, intensity:${Math.round(plan.classification.traits.intensityReadiness * 100)}, longRun:${Math.round(plan.classification.traits.longRunReadiness * 100)}, consistency:${plan.classification.traits.consistencyProfile}, confidence:${plan.classification.traits.confidenceProfile}`,
  );
  console.log(`planType=${plan.planTypeDecision.planType}`);
  console.log(
    `phases=${plan.phasePlan.blocks.map((block) => `${block.phase}[${block.startWeekIndex}-${block.endWeekIndex}] ${block.purpose.primaryObjective}`).join(" | ")}`,
  );

  for (const week of chosenWeeks) {
    console.log(
      `U${week.weekIndex} | phase=${week.phase} | emphasis=${week.focus} | volume=${week.volumeTargetMin} | longRun=${week.longRunTargetMin} | intensity=${week.intensityTarget}`,
    );
    for (const session of week.sessions) {
      console.log(
        `  - ${session.day} | ${session.role} | ${session.family} | ${session.summary} | ${session.estimatedTotalMinutes} min | purpose=${session.purpose}`,
      );
    }
    console.log(
      `  issues=${week.validationIssues && week.validationIssues.length > 0 ? week.validationIssues.map((issue) => issue.message).join(" ; ") : "none"}`,
    );
  }
}
