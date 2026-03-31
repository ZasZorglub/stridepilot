import fs from "fs";
import path from "path";

import { buildTrainingPlan } from "../src/lib/engine-v2-calibrated";
import type { EngineV2PhaseBlock, EngineV2Plan, EngineV2Profile, EngineV2WorkoutType } from "../src/lib/engine-v2-calibrated";

interface BenchmarkFixture {
  id: string;
  name: string;
  profile: EngineV2Profile;
}

const OUTPUT_DIR = process.env.BENCHMARK_EXPORT_DIR
  ? path.resolve(process.cwd(), process.env.BENCHMARK_EXPORT_DIR)
  : path.join(process.cwd(), "exports", "engine-v2-calibrated-benchmark-set-1");

const fixtures: BenchmarkFixture[] = [
  {
    id: "engine-v2-01-true-beginner-5k-finish",
    name: "Engine V2 01 – True beginner – 5K finish without walking",
    profile: {
      runnerLevel: "true_beginner",
      goalDistance: "5k",
      goalType: "finish_without_walking",
      timelineWeeks: 12,
      sessionsPerWeek: 3,
      currentContinuousMin: 1,
      longestRecentRunMin: 12,
      availableTrainingDays: ["tuesday", "thursday", "sunday"],
      preferredLongRunDay: "sunday",
    },
  },
  {
    id: "engine-v2-02-beginner-5k-finish",
    name: "Engine V2 02 – Beginner – 5K finish",
    profile: {
      runnerLevel: "beginner",
      goalDistance: "5k",
      goalType: "finish",
      timelineWeeks: 12,
      sessionsPerWeek: 3,
      currentContinuousMin: 10,
      longestRecentRunMin: 20,
      availableTrainingDays: ["tuesday", "thursday", "sunday"],
      preferredLongRunDay: "sunday",
    },
  },
  {
    id: "engine-v2-03-beginner-plus-5k-improve",
    name: "Engine V2 03 – Beginner plus – 5K improve",
    profile: {
      runnerLevel: "beginner_plus",
      goalDistance: "5k",
      goalType: "improve_time",
      timelineWeeks: 10,
      sessionsPerWeek: 3,
      currentContinuousMin: 24,
      longestRecentRunMin: 34,
      availableTrainingDays: ["tuesday", "thursday", "sunday"],
      preferredLongRunDay: "sunday",
    },
  },
  {
    id: "engine-v2-04-recreational-5k-target-time",
    name: "Engine V2 04 – Recreational – 5K target time",
    profile: {
      runnerLevel: "recreational",
      goalDistance: "5k",
      goalType: "target_time",
      timelineWeeks: 10,
      sessionsPerWeek: 4,
      currentContinuousMin: 40,
      longestRecentRunMin: 55,
      availableTrainingDays: ["monday", "wednesday", "friday", "sunday"],
      preferredLongRunDay: "sunday",
    },
  },
  {
    id: "engine-v2-05-intermediate-10k-finish",
    name: "Engine V2 05 – Intermediate – 10K finish",
    profile: {
      runnerLevel: "intermediate",
      goalDistance: "10k",
      goalType: "finish",
      timelineWeeks: 14,
      sessionsPerWeek: 4,
      currentContinuousMin: 50,
      longestRecentRunMin: 65,
      availableTrainingDays: ["monday", "wednesday", "friday", "sunday"],
      preferredLongRunDay: "sunday",
    },
  },
  {
    id: "engine-v2-06-recreational-10k-improve",
    name: "Engine V2 06 – Recreational – 10K improve",
    profile: {
      runnerLevel: "recreational",
      goalDistance: "10k",
      goalType: "improve_time",
      timelineWeeks: 12,
      sessionsPerWeek: 4,
      currentContinuousMin: 42,
      longestRecentRunMin: 60,
      availableTrainingDays: ["monday", "wednesday", "friday", "sunday"],
      preferredLongRunDay: "sunday",
    },
  },
  {
    id: "engine-v2-07-return-to-running-5k",
    name: "Engine V2 07 – Return to running – 5K finish",
    profile: {
      runnerLevel: "beginner",
      goalDistance: "5k",
      goalType: "return_to_running",
      timelineWeeks: 11,
      sessionsPerWeek: 3,
      currentContinuousMin: 5,
      longestRecentRunMin: 15,
      availableTrainingDays: ["monday", "wednesday", "saturday"],
      preferredLongRunDay: "saturday",
    },
  },
  {
    id: "engine-v2-08-recreational-half-finish",
    name: "Engine V2 08 – Recreational – Half marathon finish",
    profile: {
      runnerLevel: "recreational",
      goalDistance: "half_marathon",
      goalType: "finish",
      timelineWeeks: 16,
      sessionsPerWeek: 4,
      currentContinuousMin: 60,
      longestRecentRunMin: 80,
      availableTrainingDays: ["tuesday", "thursday", "friday", "sunday"],
      preferredLongRunDay: "sunday",
    },
  },
  {
    id: "engine-v2-09-intermediate-half-target",
    name: "Engine V2 09 – Intermediate – Half marathon target time",
    profile: {
      runnerLevel: "intermediate",
      goalDistance: "half_marathon",
      goalType: "target_time",
      timelineWeeks: 16,
      sessionsPerWeek: 4,
      currentContinuousMin: 75,
      longestRecentRunMin: 95,
      availableTrainingDays: ["monday", "wednesday", "friday", "sunday"],
      preferredLongRunDay: "sunday",
    },
  },
  {
    id: "engine-v2-10-advanced-marathon-finish",
    name: "Engine V2 10 – Advanced – Marathon finish",
    profile: {
      runnerLevel: "advanced",
      goalDistance: "marathon",
      goalType: "finish",
      timelineWeeks: 20,
      sessionsPerWeek: 5,
      currentContinuousMin: 90,
      longestRecentRunMin: 110,
      availableTrainingDays: ["monday", "tuesday", "thursday", "saturday", "sunday"],
      preferredLongRunDay: "sunday",
    },
  },
  {
    id: "engine-v2-11-advanced-marathon-target",
    name: "Engine V2 11 – Advanced – Marathon target time",
    profile: {
      runnerLevel: "advanced",
      goalDistance: "marathon",
      goalType: "target_time",
      timelineWeeks: 20,
      sessionsPerWeek: 5,
      currentContinuousMin: 100,
      longestRecentRunMin: 120,
      availableTrainingDays: ["monday", "tuesday", "thursday", "saturday", "sunday"],
      preferredLongRunDay: "sunday",
    },
  },
  {
    id: "engine-v2-12-beginner-10k-finish",
    name: "Engine V2 12 – Beginner – 10K finish",
    profile: {
      runnerLevel: "beginner",
      goalDistance: "10k",
      goalType: "finish",
      timelineWeeks: 15,
      sessionsPerWeek: 3,
      currentContinuousMin: 12,
      longestRecentRunMin: 25,
      availableTrainingDays: ["tuesday", "thursday", "sunday"],
      preferredLongRunDay: "sunday",
    },
  },
];

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function phaseText(phases: EngineV2PhaseBlock[]): string {
  return phases.map((phase) => `${phase.phase}[${phase.startWeek}-${phase.endWeek}]`).join(" | ");
}

function countWorkoutType(plan: EngineV2Plan, type: EngineV2WorkoutType): number {
  return plan.weeks.reduce((sum, week) => sum + week.workouts.filter((workout) => workout.workoutType === type).length, 0);
}

function maxIncreasePct(values: number[]): number {
  let max = 0;
  for (let index = 1; index < values.length; index += 1) {
    const previous = values[index - 1];
    const current = values[index];
    if (previous <= 0) continue;
    max = Math.max(max, ((current - previous) / previous) * 100);
  }
  return round(max);
}

function buildAnalysis(plan: EngineV2Plan, fixture: BenchmarkFixture) {
  return {
    caseId: fixture.id,
    name: fixture.name,
    profile: fixture.profile,
    summary: {
      backboneType: plan.backboneType,
      totalWeeks: plan.weeks.length,
      phases: plan.phases,
      stepBackWeeks: plan.stepBackWeeks,
      taperWeeks: plan.taperWeeks,
      peakWeeklyVolume: plan.progressionMetrics.peakWeeklyVolume,
      peakLongRun: plan.progressionMetrics.peakLongRun,
      peakContinuousRun: plan.progressionMetrics.peakContinuousRun,
      maxWeeklyVolumeIncreasePct: maxIncreasePct(plan.weeklyVolumeCurve),
      maxLongRunIncreasePct: maxIncreasePct(plan.longRunCurve),
      workoutTypeCounts: {
        easy: countWorkoutType(plan, "easy"),
        long: countWorkoutType(plan, "long"),
        recovery: countWorkoutType(plan, "recovery"),
        intervals: countWorkoutType(plan, "intervals"),
        tempo: countWorkoutType(plan, "tempo"),
        racePace: countWorkoutType(plan, "race_pace"),
        runWalk: countWorkoutType(plan, "run_walk"),
      },
    },
    curves: {
      continuousCurve: plan.continuousCurve,
      longRunCurve: plan.longRunCurve,
      weeklyVolumeCurve: plan.weeklyVolumeCurve,
      intervalVolumeCurve: plan.intervalVolumeCurve,
    },
    weeklyMetrics: plan.weeks.map((week) => ({
      weekNumber: week.weekNumber,
      phase: week.phase,
      weeklyVolume: week.weeklyVolume,
      longRun: week.longRun,
      intervalVolume: week.intervalVolume,
      continuousTarget: week.continuousTarget,
      sessionsPerWeek: week.progressionMetrics.sessionsPerWeek,
      isStepBackWeek: week.progressionMetrics.isStepBackWeek,
      isTaperWeek: week.progressionMetrics.isTaperWeek,
      isRaceWeek: week.progressionMetrics.isRaceWeek,
      workoutTypes: week.workouts.map((workout) => workout.workoutType),
      workoutDurations: week.workouts.map((workout) => workout.durationMin),
    })),
  };
}

function buildTextReport(plan: EngineV2Plan, fixture: BenchmarkFixture): string {
  const lines: string[] = [];
  lines.push("StridePilot Engine V2 Calibrated Benchmark Export");
  lines.push("");
  lines.push(fixture.name);
  lines.push("");
  lines.push("Profile");
  lines.push(`- runnerLevel: ${fixture.profile.runnerLevel}`);
  lines.push(`- goalDistance: ${fixture.profile.goalDistance}`);
  lines.push(`- goalType: ${fixture.profile.goalType}`);
  lines.push(`- timelineWeeks: ${fixture.profile.timelineWeeks}`);
  lines.push(`- sessionsPerWeek: ${fixture.profile.sessionsPerWeek}`);
  lines.push(`- currentContinuousMin: ${fixture.profile.currentContinuousMin}`);
  lines.push(`- longestRecentRunMin: ${fixture.profile.longestRecentRunMin}`);
  lines.push(`- preferredLongRunDay: ${fixture.profile.preferredLongRunDay ?? "none"}`);
  lines.push("");
  lines.push("Engine summary");
  lines.push(`- backboneType: ${plan.backboneType}`);
  lines.push(`- phases: ${phaseText(plan.phases)}`);
  lines.push(`- stepBackWeeks: ${plan.stepBackWeeks.join(", ") || "none"}`);
  lines.push(`- taperWeeks: ${plan.taperWeeks.join(", ") || "none"}`);
  lines.push(`- peakWeeklyVolume: ${round(plan.progressionMetrics.peakWeeklyVolume)} min`);
  lines.push(`- peakLongRun: ${round(plan.progressionMetrics.peakLongRun)} min`);
  lines.push(`- peakContinuousRun: ${round(plan.progressionMetrics.peakContinuousRun)} min`);
  lines.push(`- maxWeeklyVolumeIncreasePct: ${maxIncreasePct(plan.weeklyVolumeCurve)}%`);
  lines.push(`- maxLongRunIncreasePct: ${maxIncreasePct(plan.longRunCurve)}%`);
  lines.push("");
  lines.push("Weekly progression metrics");
  for (const week of plan.weeks) {
    lines.push(
      `- W${week.weekNumber}: phase=${week.phase}, volume=${round(week.weeklyVolume)} min, longRun=${round(week.longRun)} min, intervalVolume=${round(week.intervalVolume)} min, continuous=${round(week.continuousTarget)} min, sessions=${week.progressionMetrics.sessionsPerWeek}, stepBack=${week.progressionMetrics.isStepBackWeek}, taper=${week.progressionMetrics.isTaperWeek}, race=${week.progressionMetrics.isRaceWeek}, workouts=${week.workouts.map((workout) => `${workout.workoutType}:${round(workout.durationMin)}`).join(" | ")}`
    );
  }
  return lines.join("\n");
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const manifest: string[] = [];

for (const fixture of fixtures) {
  const plan = buildTrainingPlan(fixture.profile);
  const analysis = buildAnalysis(plan, fixture);
  const text = buildTextReport(plan, fixture);
  const jsonPath = path.join(OUTPUT_DIR, `${fixture.id}.json`);
  const txtPath = path.join(OUTPUT_DIR, `${fixture.id}.txt`);
  fs.writeFileSync(jsonPath, `${JSON.stringify(analysis, null, 2)}\n`, "utf8");
  fs.writeFileSync(txtPath, text, "utf8");
  manifest.push(`${fixture.name}: ${jsonPath}`);
  console.log(`${fixture.name} -> ${jsonPath}`);
}

fs.writeFileSync(path.join(OUTPUT_DIR, "README.txt"), `${manifest.join("\n")}\n`, "utf8");
