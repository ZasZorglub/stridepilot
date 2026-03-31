import fs from "fs";
import path from "path";

import { generateEngineV2Plan } from "../src/lib/engine-v2";
import type { BuiltSession, DayOfWeek, EnginePlan, GoalType, Phase, RunnerInput } from "../src/lib/engine-v2";

interface BenchmarkFixture {
  id: string;
  fileStem: string;
  name: string;
  runnerTypeLabel: string;
  levelLabel: string;
  goalLabel: string;
  ambitionLabel: string;
  runnerSummary: string[];
  input: RunnerInput;
}

interface WeeklyExportRow {
  weekNumber: number;
  phase: string;
  sessions: number;
  totalWeeklyTimeMin: number;
  longRunDurationMin: number;
  intervalType: string | null;
  intervalTotalTimeMin: number;
  easyRunTotalTimeMin: number;
}

const START_DATE = "2026-03-30";
const OUTPUT_DIR = process.env.BENCHMARK_EXPORT_DIR
  ? path.resolve(process.cwd(), process.env.BENCHMARK_EXPORT_DIR)
  : path.join(process.cwd(), "exports", "stridepilot-5k-benchmark-set-1");

const dayLabels: Record<DayOfWeek, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

const phaseLabels: Record<Phase, string> = {
  base: "Base",
  build: "Build",
  specific: "Specific",
  peak: "Peak",
  taper: "Taper",
};

const goalTypeLabels: Record<GoalType, string> = {
  finish: "finish",
  finish_without_walking: "finish_without_walking",
  return_to_running: "return_to_running",
  improve_time: "improve_time",
  target_time: "target_time",
  build_consistency: "build_consistency",
};

function createFixture(params: {
  id: string;
  runnerTypeLabel: string;
  levelLabel: string;
  goalLabel: string;
  ambitionLabel: string;
  input: RunnerInput;
  runnerSummary: string[];
}): BenchmarkFixture {
  const sessions = params.input.availableTrainingDays.length;
  const ambition = params.input.ambitionPreference === "gentle" ? "relaxed" : params.input.ambitionPreference;
  const goal = goalTypeLabels[params.input.goalType];
  return {
    id: params.id,
    fileStem: `stridepilot_5k_${params.runnerTypeLabel}_${goal}_${sessions}sessions_${ambition}`,
    name: params.id.replace(/-/g, " "),
    runnerTypeLabel: params.runnerTypeLabel,
    levelLabel: params.levelLabel,
    goalLabel: params.goalLabel,
    ambitionLabel: params.ambitionLabel,
    input: params.input,
    runnerSummary: params.runnerSummary,
  };
}

const fixtures: BenchmarkFixture[] = [
  createFixture({
    id: "benchmark-01-true-beginner-5k-finish",
    runnerTypeLabel: "true_beginner",
    levelLabel: "true_beginner",
    goalLabel: "5K finish without walking",
    ambitionLabel: "standard",
    runnerSummary: [
      "Current continuous ability: 1 min",
      "Longest recent run: 12 min",
      "Available days: Tuesday, Thursday, Sunday",
      "Preferred long run day: Sunday",
    ],
    input: {
      raceDistance: "5K",
      goalType: "finish_without_walking",
      startDate: START_DATE,
      ambitionPreference: "standard",
      currentContinuousRunMin: 1,
      currentWeeklyRuns: 1,
      currentWeeklyVolumeKm: 3,
      longestRecentRunMin: 12,
      recentConsistency: 0.2,
      availableTrainingDays: ["tuesday", "thursday", "sunday"],
      preferredLongRunDay: "sunday",
      typicalAvailableTimeMin: 35,
      trainingStylePreference: "conservative",
      externalTrainingLoad: "light",
      injuryConcern: "low",
      confidence: 2,
      age: 38,
      sex: "female",
      experienceLevel: "new",
    },
  }),
  createFixture({
    id: "benchmark-02-true-beginner-5k-finish-relaxed",
    runnerTypeLabel: "true_beginner",
    levelLabel: "true_beginner",
    goalLabel: "5K finish without walking",
    ambitionLabel: "relaxed",
    runnerSummary: [
      "Current continuous ability: 1 min",
      "Longest recent run: 12 min",
      "Available days: Tuesday, Thursday, Sunday",
      "Preferred long run day: Sunday",
    ],
    input: {
      raceDistance: "5K",
      goalType: "finish_without_walking",
      startDate: START_DATE,
      ambitionPreference: "gentle",
      currentContinuousRunMin: 1,
      currentWeeklyRuns: 1,
      currentWeeklyVolumeKm: 3,
      longestRecentRunMin: 12,
      recentConsistency: 0.2,
      availableTrainingDays: ["tuesday", "thursday", "sunday"],
      preferredLongRunDay: "sunday",
      typicalAvailableTimeMin: 35,
      trainingStylePreference: "conservative",
      externalTrainingLoad: "light",
      injuryConcern: "low",
      confidence: 2,
      age: 38,
      sex: "female",
      experienceLevel: "new",
    },
  }),
  createFixture({
    id: "benchmark-03-true-beginner-5k-finish-two-days",
    runnerTypeLabel: "true_beginner",
    levelLabel: "true_beginner",
    goalLabel: "5K finish without walking",
    ambitionLabel: "standard",
    runnerSummary: [
      "Current continuous ability: 2 min",
      "Longest recent run: 14 min",
      "Available days: Wednesday, Sunday",
      "Preferred long run day: Sunday",
    ],
    input: {
      raceDistance: "5K",
      goalType: "finish_without_walking",
      startDate: START_DATE,
      ambitionPreference: "standard",
      currentContinuousRunMin: 2,
      currentWeeklyRuns: 1,
      currentWeeklyVolumeKm: 4,
      longestRecentRunMin: 14,
      recentConsistency: 0.24,
      availableTrainingDays: ["wednesday", "sunday"],
      preferredLongRunDay: "sunday",
      typicalAvailableTimeMin: 30,
      trainingStylePreference: "conservative",
      externalTrainingLoad: "light",
      injuryConcern: "low",
      confidence: 2,
      age: 42,
      sex: "male",
      experienceLevel: "new",
    },
  }),
  createFixture({
    id: "benchmark-04-beginner-5k-finish",
    runnerTypeLabel: "beginner",
    levelLabel: "beginner",
    goalLabel: "5K finish",
    ambitionLabel: "standard",
    runnerSummary: [
      "Current continuous ability: 9 min",
      "Longest recent run: 20 min",
      "Available days: Tuesday, Thursday, Sunday",
      "Preferred long run day: Sunday",
    ],
    input: {
      raceDistance: "5K",
      goalType: "finish",
      startDate: START_DATE,
      ambitionPreference: "standard",
      currentContinuousRunMin: 9,
      currentWeeklyRuns: 2,
      currentWeeklyVolumeKm: 8,
      longestRecentRunMin: 20,
      recentConsistency: 0.42,
      availableTrainingDays: ["tuesday", "thursday", "sunday"],
      preferredLongRunDay: "sunday",
      typicalAvailableTimeMin: 40,
      trainingStylePreference: "balanced",
      externalTrainingLoad: "light",
      injuryConcern: "low",
      confidence: 3,
      age: 34,
      sex: "male",
      experienceLevel: "new",
    },
  }),
  createFixture({
    id: "benchmark-05-beginner-5k-finish-relaxed",
    runnerTypeLabel: "beginner",
    levelLabel: "beginner",
    goalLabel: "5K finish",
    ambitionLabel: "relaxed",
    runnerSummary: [
      "Current continuous ability: 8 min",
      "Longest recent run: 18 min",
      "Available days: Tuesday, Thursday, Sunday",
      "Preferred long run day: Sunday",
    ],
    input: {
      raceDistance: "5K",
      goalType: "finish",
      startDate: START_DATE,
      ambitionPreference: "gentle",
      currentContinuousRunMin: 8,
      currentWeeklyRuns: 2,
      currentWeeklyVolumeKm: 7,
      longestRecentRunMin: 18,
      recentConsistency: 0.38,
      availableTrainingDays: ["tuesday", "thursday", "sunday"],
      preferredLongRunDay: "sunday",
      typicalAvailableTimeMin: 40,
      trainingStylePreference: "conservative",
      externalTrainingLoad: "light",
      injuryConcern: "low",
      confidence: 3,
      age: 37,
      sex: "female",
      experienceLevel: "new",
    },
  }),
  createFixture({
    id: "benchmark-06-beginner-5k-improve",
    runnerTypeLabel: "beginner",
    levelLabel: "beginner",
    goalLabel: "5K improve",
    ambitionLabel: "standard",
    runnerSummary: [
      "Current continuous ability: 15 min",
      "Longest recent run: 24 min",
      "Available days: Tuesday, Thursday, Sunday",
      "Preferred long run day: Sunday",
    ],
    input: {
      raceDistance: "5K",
      goalType: "improve_time",
      startDate: START_DATE,
      ambitionPreference: "standard",
      currentContinuousRunMin: 15,
      currentWeeklyRuns: 2,
      currentWeeklyVolumeKm: 12,
      longestRecentRunMin: 24,
      recentConsistency: 0.48,
      availableTrainingDays: ["tuesday", "thursday", "sunday"],
      preferredLongRunDay: "sunday",
      typicalAvailableTimeMin: 45,
      trainingStylePreference: "balanced",
      externalTrainingLoad: "light",
      injuryConcern: "low",
      confidence: 3,
      age: 31,
      sex: "male",
      experienceLevel: "recreational",
    },
  }),
  createFixture({
    id: "benchmark-07-beginner-5k-improve-ambitious",
    runnerTypeLabel: "beginner",
    levelLabel: "beginner",
    goalLabel: "5K improve",
    ambitionLabel: "ambitious",
    runnerSummary: [
      "Current continuous ability: 18 min",
      "Longest recent run: 25 min",
      "Available days: Monday, Wednesday, Sunday",
      "Preferred long run day: Sunday",
    ],
    input: {
      raceDistance: "5K",
      goalType: "improve_time",
      startDate: START_DATE,
      ambitionPreference: "ambitious",
      currentContinuousRunMin: 18,
      currentWeeklyRuns: 3,
      currentWeeklyVolumeKm: 14,
      longestRecentRunMin: 25,
      recentConsistency: 0.52,
      availableTrainingDays: ["monday", "wednesday", "sunday"],
      preferredLongRunDay: "sunday",
      typicalAvailableTimeMin: 45,
      trainingStylePreference: "performance",
      externalTrainingLoad: "light",
      injuryConcern: "low",
      confidence: 3,
      age: 28,
      sex: "female",
      experienceLevel: "recreational",
    },
  }),
  createFixture({
    id: "benchmark-08-beginner-plus-5k-improve",
    runnerTypeLabel: "beginner_plus",
    levelLabel: "beginner_plus",
    goalLabel: "5K improve",
    ambitionLabel: "standard",
    runnerSummary: [
      "Current continuous ability: 25 min",
      "Longest recent run: 35 min",
      "Available days: Tuesday, Thursday, Sunday",
      "Preferred long run day: Sunday",
    ],
    input: {
      raceDistance: "5K",
      goalType: "improve_time",
      startDate: START_DATE,
      ambitionPreference: "standard",
      currentContinuousRunMin: 25,
      currentWeeklyRuns: 3,
      currentWeeklyVolumeKm: 18,
      longestRecentRunMin: 35,
      recentConsistency: 0.62,
      availableTrainingDays: ["tuesday", "thursday", "sunday"],
      preferredLongRunDay: "sunday",
      typicalAvailableTimeMin: 45,
      trainingStylePreference: "balanced",
      externalTrainingLoad: "light",
      injuryConcern: "low",
      confidence: 3,
      age: 29,
      sex: "female",
      experienceLevel: "recreational",
    },
  }),
  createFixture({
    id: "benchmark-09-beginner-plus-5k-improve-relaxed",
    runnerTypeLabel: "beginner_plus",
    levelLabel: "beginner_plus",
    goalLabel: "5K improve",
    ambitionLabel: "relaxed",
    runnerSummary: [
      "Current continuous ability: 24 min",
      "Longest recent run: 34 min",
      "Available days: Monday, Wednesday, Saturday",
      "Preferred long run day: Saturday",
    ],
    input: {
      raceDistance: "5K",
      goalType: "improve_time",
      startDate: START_DATE,
      ambitionPreference: "gentle",
      currentContinuousRunMin: 24,
      currentWeeklyRuns: 3,
      currentWeeklyVolumeKm: 17,
      longestRecentRunMin: 34,
      recentConsistency: 0.58,
      availableTrainingDays: ["monday", "wednesday", "saturday"],
      preferredLongRunDay: "saturday",
      typicalAvailableTimeMin: 45,
      trainingStylePreference: "balanced",
      externalTrainingLoad: "light",
      injuryConcern: "low",
      confidence: 3,
      age: 35,
      sex: "male",
      experienceLevel: "recreational",
    },
  }),
  createFixture({
    id: "benchmark-10-return-to-running-5k-finish",
    runnerTypeLabel: "return_to_running",
    levelLabel: "beginner",
    goalLabel: "5K finish",
    ambitionLabel: "relaxed",
    runnerSummary: [
      "Current continuous ability: 5 min",
      "Longest recent run: 15 min",
      "Available days: Monday, Wednesday, Saturday",
      "Preferred long run day: Saturday",
    ],
    input: {
      raceDistance: "5K",
      goalType: "return_to_running",
      startDate: START_DATE,
      ambitionPreference: "gentle",
      currentContinuousRunMin: 5,
      currentWeeklyRuns: 1,
      currentWeeklyVolumeKm: 6,
      longestRecentRunMin: 15,
      recentConsistency: 0.28,
      availableTrainingDays: ["monday", "wednesday", "saturday"],
      preferredLongRunDay: "saturday",
      typicalAvailableTimeMin: 35,
      trainingStylePreference: "conservative",
      externalTrainingLoad: "light",
      injuryConcern: "moderate",
      confidence: 2,
      age: 46,
      sex: "male",
      experienceLevel: "recreational",
      freeTextFlags: ["return after break"],
    },
  }),
  createFixture({
    id: "benchmark-11-return-to-running-5k-finish-standard",
    runnerTypeLabel: "return_to_running",
    levelLabel: "beginner",
    goalLabel: "5K finish",
    ambitionLabel: "standard",
    runnerSummary: [
      "Current continuous ability: 7 min",
      "Longest recent run: 18 min",
      "Available days: Monday, Wednesday, Saturday",
      "Preferred long run day: Saturday",
    ],
    input: {
      raceDistance: "5K",
      goalType: "return_to_running",
      startDate: START_DATE,
      ambitionPreference: "standard",
      currentContinuousRunMin: 7,
      currentWeeklyRuns: 2,
      currentWeeklyVolumeKm: 8,
      longestRecentRunMin: 18,
      recentConsistency: 0.34,
      availableTrainingDays: ["monday", "wednesday", "saturday"],
      preferredLongRunDay: "saturday",
      typicalAvailableTimeMin: 40,
      trainingStylePreference: "conservative",
      externalTrainingLoad: "light",
      injuryConcern: "moderate",
      confidence: 3,
      age: 44,
      sex: "female",
      experienceLevel: "recreational",
      freeTextFlags: ["return after break"],
    },
  }),
  createFixture({
    id: "benchmark-12-recreational-5k-improve",
    runnerTypeLabel: "recreational",
    levelLabel: "recreational",
    goalLabel: "5K improve",
    ambitionLabel: "standard",
    runnerSummary: [
      "Current continuous ability: 40 min",
      "Longest recent run: 55 min",
      "Available days: Monday, Wednesday, Friday, Sunday",
      "Preferred long run day: Sunday",
    ],
    input: {
      raceDistance: "5K",
      goalType: "improve_time",
      startDate: START_DATE,
      ambitionPreference: "standard",
      currentContinuousRunMin: 40,
      currentWeeklyRuns: 4,
      currentWeeklyVolumeKm: 28,
      longestRecentRunMin: 55,
      recentConsistency: 0.76,
      availableTrainingDays: ["monday", "wednesday", "friday", "sunday"],
      preferredLongRunDay: "sunday",
      typicalAvailableTimeMin: 55,
      trainingStylePreference: "balanced",
      externalTrainingLoad: "light",
      injuryConcern: "low",
      confidence: 4,
      age: 32,
      sex: "female",
      experienceLevel: "recreational",
    },
  }),
  createFixture({
    id: "benchmark-13-recreational-5k-goal-pace",
    runnerTypeLabel: "recreational",
    levelLabel: "recreational",
    goalLabel: "5K goal pace",
    ambitionLabel: "standard",
    runnerSummary: [
      "Current continuous ability: 35 min",
      "Longest recent run: 50 min",
      "Available days: Monday, Wednesday, Friday, Sunday",
      "Preferred long run day: Sunday",
    ],
    input: {
      raceDistance: "5K",
      goalType: "target_time",
      startDate: START_DATE,
      ambitionPreference: "standard",
      currentContinuousRunMin: 35,
      currentWeeklyRuns: 4,
      currentWeeklyVolumeKm: 26,
      longestRecentRunMin: 50,
      recentConsistency: 0.78,
      availableTrainingDays: ["monday", "wednesday", "friday", "sunday"],
      preferredLongRunDay: "sunday",
      typicalAvailableTimeMin: 55,
      trainingStylePreference: "performance",
      externalTrainingLoad: "light",
      injuryConcern: "low",
      confidence: 4,
      age: 32,
      sex: "male",
      experienceLevel: "recreational",
    },
  }),
  createFixture({
    id: "benchmark-14-recreational-5k-goal-pace-ambitious",
    runnerTypeLabel: "recreational",
    levelLabel: "recreational",
    goalLabel: "5K goal pace",
    ambitionLabel: "ambitious",
    runnerSummary: [
      "Current continuous ability: 42 min",
      "Longest recent run: 58 min",
      "Available days: Monday, Wednesday, Friday, Sunday",
      "Preferred long run day: Sunday",
    ],
    input: {
      raceDistance: "5K",
      goalType: "target_time",
      startDate: START_DATE,
      ambitionPreference: "ambitious",
      currentContinuousRunMin: 42,
      currentWeeklyRuns: 4,
      currentWeeklyVolumeKm: 30,
      longestRecentRunMin: 58,
      recentConsistency: 0.82,
      availableTrainingDays: ["monday", "wednesday", "friday", "sunday"],
      preferredLongRunDay: "sunday",
      typicalAvailableTimeMin: 60,
      trainingStylePreference: "performance",
      externalTrainingLoad: "light",
      injuryConcern: "low",
      confidence: 4,
      age: 30,
      sex: "female",
      experienceLevel: "recreational",
    },
  }),
  createFixture({
    id: "benchmark-15-intermediate-5k-goal-time",
    runnerTypeLabel: "intermediate",
    levelLabel: "intermediate",
    goalLabel: "5K goal time",
    ambitionLabel: "standard",
    runnerSummary: [
      "Current continuous ability: 55 min",
      "Longest recent run: 70 min",
      "Available days: Monday, Wednesday, Friday, Sunday",
      "Preferred long run day: Sunday",
    ],
    input: {
      raceDistance: "5K",
      goalType: "target_time",
      startDate: START_DATE,
      ambitionPreference: "standard",
      currentContinuousRunMin: 55,
      currentWeeklyRuns: 4,
      currentWeeklyVolumeKm: 38,
      longestRecentRunMin: 70,
      recentConsistency: 0.84,
      availableTrainingDays: ["monday", "wednesday", "friday", "sunday"],
      preferredLongRunDay: "sunday",
      typicalAvailableTimeMin: 60,
      trainingStylePreference: "performance",
      externalTrainingLoad: "light",
      injuryConcern: "low",
      confidence: 4,
      age: 33,
      sex: "male",
      experienceLevel: "intermediate",
    },
  }),
  createFixture({
    id: "benchmark-16-intermediate-5k-goal-time-ambitious",
    runnerTypeLabel: "intermediate",
    levelLabel: "intermediate",
    goalLabel: "5K goal time",
    ambitionLabel: "ambitious",
    runnerSummary: [
      "Current continuous ability: 60 min",
      "Longest recent run: 75 min",
      "Available days: Monday, Wednesday, Friday, Sunday",
      "Preferred long run day: Sunday",
    ],
    input: {
      raceDistance: "5K",
      goalType: "target_time",
      startDate: START_DATE,
      ambitionPreference: "ambitious",
      currentContinuousRunMin: 60,
      currentWeeklyRuns: 4,
      currentWeeklyVolumeKm: 42,
      longestRecentRunMin: 75,
      recentConsistency: 0.86,
      availableTrainingDays: ["monday", "wednesday", "friday", "sunday"],
      preferredLongRunDay: "sunday",
      typicalAvailableTimeMin: 65,
      trainingStylePreference: "performance",
      externalTrainingLoad: "light",
      injuryConcern: "low",
      confidence: 4,
      age: 29,
      sex: "female",
      experienceLevel: "intermediate",
    },
  }),
  createFixture({
    id: "benchmark-17-advanced-5k-goal-time",
    runnerTypeLabel: "advanced",
    levelLabel: "advanced",
    goalLabel: "5K goal time",
    ambitionLabel: "standard",
    runnerSummary: [
      "Current continuous ability: 85 min",
      "Longest recent run: 95 min",
      "Available days: Monday, Tuesday, Thursday, Saturday, Sunday",
      "Preferred long run day: Sunday",
    ],
    input: {
      raceDistance: "5K",
      goalType: "target_time",
      startDate: START_DATE,
      ambitionPreference: "standard",
      currentContinuousRunMin: 85,
      currentWeeklyRuns: 5,
      currentWeeklyVolumeKm: 60,
      longestRecentRunMin: 95,
      recentConsistency: 0.9,
      availableTrainingDays: ["monday", "tuesday", "thursday", "saturday", "sunday"],
      preferredLongRunDay: "sunday",
      typicalAvailableTimeMin: 70,
      trainingStylePreference: "performance",
      externalTrainingLoad: "light",
      injuryConcern: "low",
      confidence: 5,
      age: 31,
      sex: "male",
      experienceLevel: "advanced",
    },
  }),
  createFixture({
    id: "benchmark-18-advanced-5k-goal-time-ambitious",
    runnerTypeLabel: "advanced",
    levelLabel: "advanced",
    goalLabel: "5K goal time",
    ambitionLabel: "ambitious",
    runnerSummary: [
      "Current continuous ability: 90 min",
      "Longest recent run: 100 min",
      "Available days: Monday, Tuesday, Thursday, Saturday, Sunday",
      "Preferred long run day: Sunday",
    ],
    input: {
      raceDistance: "5K",
      goalType: "target_time",
      startDate: START_DATE,
      ambitionPreference: "ambitious",
      currentContinuousRunMin: 90,
      currentWeeklyRuns: 5,
      currentWeeklyVolumeKm: 64,
      longestRecentRunMin: 100,
      recentConsistency: 0.92,
      availableTrainingDays: ["monday", "tuesday", "thursday", "saturday", "sunday"],
      preferredLongRunDay: "sunday",
      typicalAvailableTimeMin: 70,
      trainingStylePreference: "performance",
      externalTrainingLoad: "light",
      injuryConcern: "low",
      confidence: 5,
      age: 28,
      sex: "female",
      experienceLevel: "advanced",
    },
  }),
  createFixture({
    id: "benchmark-19-recreational-5k-finish-relaxed",
    runnerTypeLabel: "recreational",
    levelLabel: "recreational",
    goalLabel: "5K finish",
    ambitionLabel: "relaxed",
    runnerSummary: [
      "Current continuous ability: 30 min",
      "Longest recent run: 42 min",
      "Available days: Tuesday, Thursday, Sunday",
      "Preferred long run day: Sunday",
    ],
    input: {
      raceDistance: "5K",
      goalType: "finish",
      startDate: START_DATE,
      ambitionPreference: "gentle",
      currentContinuousRunMin: 30,
      currentWeeklyRuns: 3,
      currentWeeklyVolumeKm: 20,
      longestRecentRunMin: 42,
      recentConsistency: 0.64,
      availableTrainingDays: ["tuesday", "thursday", "sunday"],
      preferredLongRunDay: "sunday",
      typicalAvailableTimeMin: 45,
      trainingStylePreference: "conservative",
      externalTrainingLoad: "moderate",
      injuryConcern: "low",
      confidence: 3,
      age: 40,
      sex: "male",
      experienceLevel: "recreational",
    },
  }),
  createFixture({
    id: "benchmark-20-beginner-plus-5k-goal-pace",
    runnerTypeLabel: "beginner_plus",
    levelLabel: "beginner_plus",
    goalLabel: "5K goal pace",
    ambitionLabel: "standard",
    runnerSummary: [
      "Current continuous ability: 28 min",
      "Longest recent run: 36 min",
      "Available days: Tuesday, Thursday, Sunday",
      "Preferred long run day: Sunday",
    ],
    input: {
      raceDistance: "5K",
      goalType: "target_time",
      startDate: START_DATE,
      ambitionPreference: "standard",
      currentContinuousRunMin: 28,
      currentWeeklyRuns: 3,
      currentWeeklyVolumeKm: 19,
      longestRecentRunMin: 36,
      recentConsistency: 0.6,
      availableTrainingDays: ["tuesday", "thursday", "sunday"],
      preferredLongRunDay: "sunday",
      typicalAvailableTimeMin: 45,
      trainingStylePreference: "balanced",
      externalTrainingLoad: "light",
      injuryConcern: "low",
      confidence: 3,
      age: 27,
      sex: "female",
      experienceLevel: "recreational",
    },
  }),
];

function formatMinutes(value: number): string {
  return `${String(Math.round(value * 10) / 10).replace(".", ",")} min`;
}

function formatPercent(value: number): string {
  return `${(Math.round(value * 10) / 10).toString().replace(".", ",")}%`;
}

function phaseName(plan: EnginePlan["weeks"][number]): string {
  return plan.timelinePhase === "race" ? "Race week" : phaseLabels[plan.phase];
}

function getIntervalType(session: BuiltSession): string | null {
  if (session.family === "intervals" || session.family === "fartlek" || session.family === "hill_reps") return session.family;
  if (session.family === "tempo_run" || session.family === "race_specific") return session.family;
  return null;
}

function getIntervalTotalTime(session: BuiltSession): number {
  return session.structure
    .filter((segment) => segment.kind === "main" && /interval|tempo|race|fart|bakke/i.test(segment.label))
    .reduce((sum, segment) => sum + segment.durationMin * (segment.repeats ?? 1), 0);
}

function buildWeeklyRows(plan: EnginePlan): WeeklyExportRow[] {
  return plan.weeks.map((week) => {
    const intervalSession = week.sessions.find((session) => getIntervalType(session) !== null) ?? null;
    const intervalType = intervalSession ? getIntervalType(intervalSession) : null;
    const intervalTotalTimeMin = week.sessions.reduce((sum, session) => sum + getIntervalTotalTime(session), 0);
    const easyRunTotalTimeMin = week.sessions
      .filter((session) => session.role === "easy" || session.role === "recovery" || session.role === "aerobic_support")
      .reduce((sum, session) => sum + session.durationMin, 0);

    return {
      weekNumber: week.weekIndex,
      phase: phaseName(week),
      sessions: week.sessions.length,
      totalWeeklyTimeMin: week.sessions.reduce((sum, session) => sum + session.durationMin, 0),
      longRunDurationMin: week.sessions
        .filter((session) => session.role === "long_run")
        .reduce((sum, session) => sum + session.durationMin, 0),
      intervalType,
      intervalTotalTimeMin,
      easyRunTotalTimeMin,
    };
  });
}

function biggestIncrease(values: number[]): number {
  let maxIncrease = 0;
  for (let index = 1; index < values.length; index += 1) {
    const previous = values[index - 1];
    const current = values[index];
    if (previous <= 0) continue;
    const change = ((current - previous) / previous) * 100;
    if (change > maxIncrease) maxIncrease = change;
  }
  return maxIncrease;
}

function buildJsonExport(fixture: BenchmarkFixture, plan: EnginePlan) {
  const weeklyRows = buildWeeklyRows(plan);
  const peakLoad = Math.max(...plan.curves.weeklyVolumeCurve);
  const startLoad = plan.curves.weeklyVolumeCurve[0] ?? 0;

  return {
    benchmarkId: fixture.id,
    fileStem: fixture.fileStem,
    runnerProfile: {
      runnerType: fixture.runnerTypeLabel,
      currentLevel: fixture.levelLabel,
      sessionsPerWeek: plan.curves.sessionsPerWeekCurve,
      goal: fixture.goalLabel,
      goalType: plan.input.goalType,
      ambition: fixture.ambitionLabel,
      timelineWeeks: plan.timelineRecommendation.finalDurationWeeks,
      profileSummary: fixture.runnerSummary,
    },
    programStructure: {
      numberOfWeeks: plan.weeks.length,
      phases: plan.phasePlan.blocks.map((block) => ({
        phase: block.timelinePhase === "race" ? "Race week" : phaseLabels[block.phase],
        startWeek: block.startWeekIndex,
        endWeek: block.endWeekIndex,
      })),
      stepBackWeeks: plan.curves.cutbackWeeks,
      taperWeeks: plan.curves.taperWeeks,
      raceWeek: plan.weeks.find((week) => week.isRaceWeek)?.weekIndex ?? null,
    },
    weeklyProgression: weeklyRows,
    progressionMetrics: {
      longestContinuousRunProgressionMin: plan.curves.continuousCurve,
      longRunProgressionMin: plan.curves.longRunCurve,
      weeklyVolumeProgressionMin: plan.curves.weeklyVolumeCurve,
      intervalProgressionMin: plan.curves.intervalDurationCurve,
    },
    safetyMetrics: {
      biggestWeeklyVolumeIncreasePct: biggestIncrease(plan.curves.weeklyVolumeCurve),
      biggestLongRunIncreasePct: biggestIncrease(plan.curves.longRunCurve),
      numberOfStepBackWeeks: plan.curves.cutbackWeeks.length,
      taperLengthWeeks: plan.curves.taperWeeks.length,
      startingLoadMin: startLoad,
      peakLoadMin: peakLoad,
    },
  };
}

function buildTextSummary(fixture: BenchmarkFixture, plan: EnginePlan): string {
  const json = buildJsonExport(fixture, plan);
  const lines: string[] = [];

  lines.push(`StridePilot 5K Benchmark Export`);
  lines.push("");
  lines.push(`Case: ${fixture.name}`);
  lines.push("");
  lines.push("Runner profile");
  lines.push(`- runner type: ${json.runnerProfile.runnerType}`);
  lines.push(`- current level: ${json.runnerProfile.currentLevel}`);
  lines.push(`- sessions per week: ${json.runnerProfile.sessionsPerWeek.join(" -> ")}`);
  lines.push(`- goal: ${json.runnerProfile.goal}`);
  lines.push(`- ambition: ${json.runnerProfile.ambition}`);
  lines.push(`- timeline weeks: ${json.runnerProfile.timelineWeeks}`);
  json.runnerProfile.profileSummary.forEach((line) => lines.push(`- ${line}`));
  lines.push("");
  lines.push("Program structure");
  lines.push(`- number of weeks: ${json.programStructure.numberOfWeeks}`);
  lines.push(`- phases: ${json.programStructure.phases.map((phase) => `W${phase.startWeek}-${phase.endWeek} ${phase.phase}`).join(" | ")}`);
  lines.push(`- step-back weeks: ${json.programStructure.stepBackWeeks.join(", ") || "none"}`);
  lines.push(`- taper weeks: ${json.programStructure.taperWeeks.join(", ") || "none"}`);
  lines.push(`- race week: ${json.programStructure.raceWeek ?? "none"}`);
  lines.push("");
  lines.push("Weekly progression");
  json.weeklyProgression.forEach((week) => {
    lines.push(
      `- week ${week.weekNumber}: phase=${week.phase}, sessions=${week.sessions}, total=${formatMinutes(week.totalWeeklyTimeMin)}, long_run=${formatMinutes(week.longRunDurationMin)}, interval_type=${week.intervalType ?? "none"}, interval_total=${formatMinutes(week.intervalTotalTimeMin)}, easy_total=${formatMinutes(week.easyRunTotalTimeMin)}`,
    );
  });
  lines.push("");
  lines.push("Progression metrics");
  lines.push(`- longest continuous run progression: ${json.progressionMetrics.longestContinuousRunProgressionMin.join(", ")}`);
  lines.push(`- long run progression: ${json.progressionMetrics.longRunProgressionMin.join(", ")}`);
  lines.push(`- weekly volume progression: ${json.progressionMetrics.weeklyVolumeProgressionMin.join(", ")}`);
  lines.push(`- interval progression: ${json.progressionMetrics.intervalProgressionMin.join(", ")}`);
  lines.push("");
  lines.push("Safety metrics");
  lines.push(`- biggest weekly volume increase: ${formatPercent(json.safetyMetrics.biggestWeeklyVolumeIncreasePct)}`);
  lines.push(`- biggest long run increase: ${formatPercent(json.safetyMetrics.biggestLongRunIncreasePct)}`);
  lines.push(`- number of step-back weeks: ${json.safetyMetrics.numberOfStepBackWeeks}`);
  lines.push(`- taper length: ${json.safetyMetrics.taperLengthWeeks} weeks`);
  lines.push(`- starting load vs peak load: ${formatMinutes(json.safetyMetrics.startingLoadMin)} -> ${formatMinutes(json.safetyMetrics.peakLoadMin)}`);
  lines.push("");
  lines.push("Full program");
  plan.weeks.forEach((week) => {
    lines.push(``);
    lines.push(`Week ${week.weekIndex} · ${phaseName(week)}`);
    week.sessions.forEach((session) => {
      lines.push(`- ${dayLabels[session.day]} · ${session.title} · ${formatMinutes(session.durationMin)} · role=${session.role} · family=${session.family}`);
    });
  });

  return lines.join("\n");
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const manifest: string[] = [];

for (const fixture of fixtures) {
  const plan = generateEngineV2Plan(fixture.input);
  const jsonExport = buildJsonExport(fixture, plan);
  const textExport = buildTextSummary(fixture, plan);
  const jsonPath = path.join(OUTPUT_DIR, `${fixture.fileStem}.json`);
  const textPath = path.join(OUTPUT_DIR, `${fixture.fileStem}.txt`);
  fs.writeFileSync(jsonPath, `${JSON.stringify(jsonExport, null, 2)}\n`, "utf8");
  fs.writeFileSync(textPath, textExport, "utf8");
  manifest.push(`${fixture.name}\nTXT: ${textPath}\nJSON: ${jsonPath}\n`);
  console.log(`${fixture.name} -> ${textPath}`);
}

fs.writeFileSync(path.join(OUTPUT_DIR, "README.txt"), manifest.join("\n"), "utf8");
