import fs from "fs";
import path from "path";

import { generateEngineV2Plan } from "../src/lib/engine-v2";
import type { BackboneType, BuiltSession, DayOfWeek, EnginePlan, Phase, RecommendationProgressionMode, RunnerInput } from "../src/lib/engine-v2";

interface BenchmarkFixture {
  id: string;
  name: string;
  goalLabel: string;
  runnerSummary: string[];
  input: RunnerInput;
}

const START_DATE = "2026-03-30";
const OUTPUT_DIR = process.env.BENCHMARK_EXPORT_DIR
  ? path.resolve(process.cwd(), process.env.BENCHMARK_EXPORT_DIR)
  : path.join(process.cwd(), "exports", "benchmark-programmer-saet-4");

const dayLabels: Record<DayOfWeek, string> = {
  monday: "Mandag",
  tuesday: "Tirsdag",
  wednesday: "Onsdag",
  thursday: "Torsdag",
  friday: "Fredag",
  saturday: "Lørdag",
  sunday: "Søndag",
};

const phaseLabels: Record<Phase, string> = {
  base: "Base",
  build: "Build",
  specific: "Specifik",
  peak: "Peak",
  taper: "Taper",
};

const backboneLabels: Record<BackboneType, string> = {
  continuous_backbone: "Kontinuitets-backbone",
  long_run_backbone: "Langturs-backbone",
};

const progressionLabels: Record<RecommendationProgressionMode, string> = {
  conservative: "Roligt",
  standard: "Standard",
  ambitious: "Ambitiøst",
};

const roleLabels: Record<string, string> = {
  quality: "Kvalitet",
  aerobic_support: "Støttepas",
  easy: "Roligt pas",
  recovery: "Recovery",
  long_run: "Lang tur",
};

const familyLabels: Record<string, string> = {
  run_walk_progression: "Run/walk-progression",
  easy_run: "Roligt løb",
  recovery_run: "Recovery-løb",
  steady_run: "Steady-pas",
  development_run: "Udviklingspas",
  tempo_run: "Tempopas",
  intervals: "Intervaller",
  fartlek: "Fartlek",
  hill_reps: "Bakkepas",
  progression_run: "Progressionspas",
  strides_session: "Roligt løb med strides",
  race_specific: "Målspecifikt pas",
  long_run: "Lang tur",
};

const fixtures: BenchmarkFixture[] = [
  {
    id: "benchmark-01-true-beginner-5k-uden-stop",
    name: "Benchmark 01 – True beginner – 5K uden stop",
    goalLabel: "5 km uden stop",
    runnerSummary: [
      "Kan løbe ca. 1 minut sammenhængende",
      "Længste nylige tur: 10-12 min",
      "Træner nu: 1 gang om ugen",
      "Tilgængelige dage: Tirsdag, Torsdag, Søndag",
      "Foretrukken dag til lang tur: Søndag",
      "Ambition: Standard",
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
      recentConsistency: 0.22,
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
  },
  {
    id: "benchmark-02-true-beginner-5k-uden-stop-rolig",
    name: "Benchmark 02 – True beginner – 5K uden stop – rolig",
    goalLabel: "5 km uden stop",
    runnerSummary: [
      "Kan løbe ca. 1 minut sammenhængende",
      "Længste nylige tur: 10-12 min",
      "Træner nu: 1 gang om ugen",
      "Tilgængelige dage: Tirsdag, Torsdag, Søndag",
      "Foretrukken dag til lang tur: Søndag",
      "Ambition: Rolig",
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
      recentConsistency: 0.22,
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
  },
  {
    id: "benchmark-03-beginner-5k-finish",
    name: "Benchmark 03 – Beginner – 5K finish",
    goalLabel: "Gennemføre 5 km",
    runnerSummary: [
      "Kan løbe ca. 8-10 minutter sammenhængende",
      "Længste nylige tur: 20 min",
      "Træner nu: 2 gange om ugen",
      "Tilgængelige dage: Tirsdag, Torsdag, Søndag",
      "Foretrukken dag til lang tur: Søndag",
      "Ambition: Standard",
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
  },
  {
    id: "benchmark-04-beginner-10k-uden-stop",
    name: "Benchmark 04 – Beginner – 10K uden stop",
    goalLabel: "10 km uden stop",
    runnerSummary: [
      "Kan løbe ca. 10 minutter sammenhængende",
      "Længste nylige tur: 20-25 min",
      "Træner nu: 2 gange om ugen",
      "Tilgængelige dage: Tirsdag, Torsdag, Søndag",
      "Foretrukken dag til lang tur: Søndag",
      "Ambition: Standard",
    ],
    input: {
      raceDistance: "10K",
      goalType: "finish",
      startDate: START_DATE,
      ambitionPreference: "standard",
      currentContinuousRunMin: 10,
      currentWeeklyRuns: 2,
      currentWeeklyVolumeKm: 10,
      longestRecentRunMin: 24,
      recentConsistency: 0.4,
      availableTrainingDays: ["tuesday", "thursday", "sunday"],
      preferredLongRunDay: "sunday",
      typicalAvailableTimeMin: 45,
      trainingStylePreference: "conservative",
      externalTrainingLoad: "light",
      injuryConcern: "low",
      confidence: 3,
      age: 41,
      sex: "female",
      experienceLevel: "new",
    },
  },
  {
    id: "benchmark-05-return-to-running-5k-finish",
    name: "Benchmark 05 – Return to running – 5K finish",
    goalLabel: "Gennemføre 5 km",
    runnerSummary: [
      "Kan løbe ca. 5 minutter sammenhængende",
      "Længste nylige tur: 15 min",
      "Træner nu: 1-2 gange om ugen",
      "Tilgængelige dage: Mandag, Onsdag, Lørdag",
      "Foretrukken dag til lang tur: Lørdag",
      "Ambition: Rolig",
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
  },
  {
    id: "benchmark-06-beginner-plus-10k-finish",
    name: "Benchmark 06 – Beginner+ – 10K finish",
    goalLabel: "Gennemføre 10 km",
    runnerSummary: [
      "Kan løbe 20 minutter sammenhængende",
      "Længste nylige tur: 35 min",
      "Træner nu: 2-3 gange om ugen",
      "Tilgængelige dage: Tirsdag, Torsdag, Søndag",
      "Foretrukken dag til lang tur: Søndag",
      "Ambition: Standard",
    ],
    input: {
      raceDistance: "10K",
      goalType: "finish",
      startDate: START_DATE,
      ambitionPreference: "standard",
      currentContinuousRunMin: 20,
      currentWeeklyRuns: 3,
      currentWeeklyVolumeKm: 16,
      longestRecentRunMin: 35,
      recentConsistency: 0.58,
      availableTrainingDays: ["tuesday", "thursday", "sunday"],
      preferredLongRunDay: "sunday",
      typicalAvailableTimeMin: 45,
      trainingStylePreference: "balanced",
      externalTrainingLoad: "light",
      injuryConcern: "low",
      confidence: 3,
      age: 33,
      sex: "female",
      experienceLevel: "recreational",
    },
  },
  {
    id: "benchmark-07-recreational-10k-improve",
    name: "Benchmark 07 – Recreational – 10K improve",
    goalLabel: "Forbedre tid på 10 km",
    runnerSummary: [
      "Kan løbe 45 minutter sammenhængende",
      "Længste nylige tur: 60 min",
      "Træner nu: 3-4 gange om ugen",
      "Tilgængelige dage: Mandag, Onsdag, Fredag, Søndag",
      "Foretrukken dag til lang tur: Søndag",
      "Ambition: Standard",
    ],
    input: {
      raceDistance: "10K",
      goalType: "improve_time",
      startDate: START_DATE,
      ambitionPreference: "standard",
      currentContinuousRunMin: 45,
      currentWeeklyRuns: 4,
      currentWeeklyVolumeKm: 30,
      longestRecentRunMin: 60,
      recentConsistency: 0.8,
      availableTrainingDays: ["monday", "wednesday", "friday", "sunday"],
      preferredLongRunDay: "sunday",
      typicalAvailableTimeMin: 60,
      trainingStylePreference: "balanced",
      externalTrainingLoad: "light",
      injuryConcern: "low",
      confidence: 4,
      age: 36,
      sex: "male",
      experienceLevel: "recreational",
    },
  },
  {
    id: "benchmark-08-recreational-10k-goal-pace",
    name: "Benchmark 08 – Recreational – 10K goal pace",
    goalLabel: "10 km i måltempo",
    runnerSummary: [
      "Kan løbe 45 minutter sammenhængende",
      "Længste nylige tur: 60 min",
      "Træner nu: 4 gange om ugen",
      "Tilgængelige dage: Mandag, Onsdag, Fredag, Søndag",
      "Foretrukken dag til lang tur: Søndag",
      "Ambition: Standard",
    ],
    input: {
      raceDistance: "10K",
      goalType: "target_time",
      startDate: START_DATE,
      ambitionPreference: "standard",
      currentContinuousRunMin: 45,
      currentWeeklyRuns: 4,
      currentWeeklyVolumeKm: 32,
      longestRecentRunMin: 60,
      recentConsistency: 0.82,
      availableTrainingDays: ["monday", "wednesday", "friday", "sunday"],
      preferredLongRunDay: "sunday",
      typicalAvailableTimeMin: 60,
      trainingStylePreference: "performance",
      externalTrainingLoad: "light",
      injuryConcern: "low",
      confidence: 4,
      age: 31,
      sex: "female",
      experienceLevel: "recreational",
    },
  },
  {
    id: "benchmark-09-recreational-half-marathon-finish",
    name: "Benchmark 09 – Recreational – Half marathon finish",
    goalLabel: "Gennemføre halvmaraton",
    runnerSummary: [
      "Kan løbe 60 minutter sammenhængende",
      "Længste nylige tur: 75 min",
      "Træner nu: 3 gange om ugen",
      "Tilgængelige dage: Tirsdag, Torsdag, Søndag",
      "Foretrukken dag til lang tur: Søndag",
      "Ambition: Standard",
    ],
    input: {
      raceDistance: "HalfMarathon",
      goalType: "finish",
      startDate: START_DATE,
      ambitionPreference: "standard",
      currentContinuousRunMin: 60,
      currentWeeklyRuns: 3,
      currentWeeklyVolumeKm: 28,
      longestRecentRunMin: 75,
      recentConsistency: 0.64,
      availableTrainingDays: ["tuesday", "thursday", "sunday"],
      preferredLongRunDay: "sunday",
      typicalAvailableTimeMin: 70,
      trainingStylePreference: "balanced",
      externalTrainingLoad: "moderate",
      injuryConcern: "low",
      confidence: 3,
      age: 39,
      sex: "male",
      experienceLevel: "recreational",
    },
  },
  {
    id: "benchmark-10-recreational-half-marathon-improve",
    name: "Benchmark 10 – Recreational – Half marathon improve",
    goalLabel: "Forbedre tid på halvmaraton",
    runnerSummary: [
      "Kan løbe 75 minutter sammenhængende",
      "Længste nylige tur: 90 min",
      "Træner nu: 4 gange om ugen",
      "Tilgængelige dage: Mandag, Onsdag, Fredag, Søndag",
      "Foretrukken dag til lang tur: Søndag",
      "Ambition: Standard",
    ],
    input: {
      raceDistance: "HalfMarathon",
      goalType: "improve_time",
      startDate: START_DATE,
      ambitionPreference: "standard",
      currentContinuousRunMin: 75,
      currentWeeklyRuns: 4,
      currentWeeklyVolumeKm: 42,
      longestRecentRunMin: 90,
      recentConsistency: 0.8,
      availableTrainingDays: ["monday", "wednesday", "friday", "sunday"],
      preferredLongRunDay: "sunday",
      typicalAvailableTimeMin: 75,
      trainingStylePreference: "performance",
      externalTrainingLoad: "light",
      injuryConcern: "low",
      confidence: 4,
      age: 35,
      sex: "female",
      experienceLevel: "intermediate",
    },
  },
  {
    id: "benchmark-11-experienced-marathon-finish",
    name: "Benchmark 11 – Experienced – Marathon finish",
    goalLabel: "Gennemføre marathon",
    runnerSummary: [
      "Kan løbe 90 minutter sammenhængende",
      "Længste nylige tur: 100-110 min",
      "Træner nu: 4 gange om ugen",
      "Tilgængelige dage: Tirsdag, Torsdag, Lørdag, Søndag",
      "Foretrukken dag til lang tur: Søndag",
      "Ambition: Standard",
    ],
    input: {
      raceDistance: "Marathon",
      goalType: "finish",
      startDate: START_DATE,
      ambitionPreference: "standard",
      currentContinuousRunMin: 90,
      currentWeeklyRuns: 4,
      currentWeeklyVolumeKm: 45,
      longestRecentRunMin: 105,
      recentConsistency: 0.74,
      availableTrainingDays: ["tuesday", "thursday", "saturday", "sunday"],
      preferredLongRunDay: "sunday",
      typicalAvailableTimeMin: 90,
      trainingStylePreference: "balanced",
      externalTrainingLoad: "light",
      injuryConcern: "low",
      confidence: 4,
      age: 42,
      sex: "male",
      experienceLevel: "intermediate",
    },
  },
  {
    id: "benchmark-12-experienced-marathon-improve",
    name: "Benchmark 12 – Experienced – Marathon improve",
    goalLabel: "Forbedre tid på marathon",
    runnerSummary: [
      "Kan løbe 100 minutter sammenhængende",
      "Længste nylige tur: 120 min",
      "Træner nu: 5 gange om ugen",
      "Tilgængelige dage: Mandag, Tirsdag, Torsdag, Lørdag, Søndag",
      "Foretrukken dag til lang tur: Søndag",
      "Ambition: Standard",
    ],
    input: {
      raceDistance: "Marathon",
      goalType: "improve_time",
      startDate: START_DATE,
      ambitionPreference: "standard",
      currentContinuousRunMin: 100,
      currentWeeklyRuns: 5,
      currentWeeklyVolumeKm: 60,
      longestRecentRunMin: 120,
      recentConsistency: 0.84,
      availableTrainingDays: ["monday", "tuesday", "thursday", "saturday", "sunday"],
      preferredLongRunDay: "sunday",
      typicalAvailableTimeMin: 95,
      trainingStylePreference: "performance",
      externalTrainingLoad: "light",
      injuryConcern: "low",
      confidence: 4,
      age: 37,
      sex: "female",
      experienceLevel: "advanced",
    },
  },
  {
    id: "benchmark-13-true-beginner-10k-uden-stop-rolig",
    name: "Benchmark 13 – True beginner – 10K uden stop – rolig",
    goalLabel: "10 km uden stop",
    runnerSummary: [
      "Kan løbe ca. 2 minutter sammenhængende",
      "Længste nylige tur: 12-15 min",
      "Træner nu: 1 gang om ugen",
      "Tilgængelige dage: Tirsdag, Torsdag, Søndag",
      "Foretrukken dag til lang tur: Søndag",
      "Ambition: Rolig",
    ],
    input: {
      raceDistance: "10K",
      goalType: "finish_without_walking",
      startDate: START_DATE,
      ambitionPreference: "gentle",
      currentContinuousRunMin: 2,
      currentWeeklyRuns: 1,
      currentWeeklyVolumeKm: 4,
      longestRecentRunMin: 14,
      recentConsistency: 0.2,
      availableTrainingDays: ["tuesday", "thursday", "sunday"],
      preferredLongRunDay: "sunday",
      typicalAvailableTimeMin: 40,
      trainingStylePreference: "conservative",
      externalTrainingLoad: "light",
      injuryConcern: "low",
      confidence: 2,
      age: 40,
      sex: "female",
      experienceLevel: "new",
    },
  },
  {
    id: "benchmark-14-return-to-running-10k-finish",
    name: "Benchmark 14 – Return to running – 10K finish",
    goalLabel: "Gennemføre 10 km",
    runnerSummary: [
      "Kan løbe ca. 12 minutter sammenhængende",
      "Længste nylige tur: 25 min",
      "Træner nu: 1-2 gange om ugen",
      "Tilgængelige dage: Mandag, Onsdag, Lørdag",
      "Foretrukken dag til lang tur: Lørdag",
      "Ambition: Rolig",
    ],
    input: {
      raceDistance: "10K",
      goalType: "return_to_running",
      startDate: START_DATE,
      ambitionPreference: "gentle",
      currentContinuousRunMin: 12,
      currentWeeklyRuns: 2,
      currentWeeklyVolumeKm: 12,
      longestRecentRunMin: 25,
      recentConsistency: 0.34,
      availableTrainingDays: ["monday", "wednesday", "saturday"],
      preferredLongRunDay: "saturday",
      typicalAvailableTimeMin: 45,
      trainingStylePreference: "conservative",
      externalTrainingLoad: "light",
      injuryConcern: "moderate",
      confidence: 2,
      age: 48,
      sex: "male",
      experienceLevel: "recreational",
      freeTextFlags: ["return after break"],
    },
  },
  {
    id: "benchmark-15-beginner-plus-5k-improve",
    name: "Benchmark 15 – Beginner+ – 5K improve",
    goalLabel: "Forbedre tid på 5 km",
    runnerSummary: [
      "Kan løbe 25 minutter sammenhængende",
      "Længste nylige tur: 35 min",
      "Træner nu: 3 gange om ugen",
      "Tilgængelige dage: Tirsdag, Torsdag, Søndag",
      "Foretrukken dag til lang tur: Søndag",
      "Ambition: Standard",
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
  },
  {
    id: "benchmark-16-recreational-5k-goal-pace",
    name: "Benchmark 16 – Recreational – 5K goal pace",
    goalLabel: "5 km i måltempo",
    runnerSummary: [
      "Kan løbe 35 minutter sammenhængende",
      "Længste nylige tur: 50 min",
      "Træner nu: 4 gange om ugen",
      "Tilgængelige dage: Mandag, Onsdag, Fredag, Søndag",
      "Foretrukken dag til lang tur: Søndag",
      "Ambition: Standard",
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
  },
  {
    id: "benchmark-17-recreational-half-marathon-finish-rolig",
    name: "Benchmark 17 – Recreational – Half marathon finish – rolig",
    goalLabel: "Gennemføre halvmaraton",
    runnerSummary: [
      "Kan løbe 50 minutter sammenhængende",
      "Længste nylige tur: 70 min",
      "Træner nu: 3 gange om ugen",
      "Tilgængelige dage: Tirsdag, Torsdag, Søndag",
      "Foretrukken dag til lang tur: Søndag",
      "Ambition: Rolig",
    ],
    input: {
      raceDistance: "HalfMarathon",
      goalType: "finish",
      startDate: START_DATE,
      ambitionPreference: "gentle",
      currentContinuousRunMin: 50,
      currentWeeklyRuns: 3,
      currentWeeklyVolumeKm: 24,
      longestRecentRunMin: 70,
      recentConsistency: 0.58,
      availableTrainingDays: ["tuesday", "thursday", "sunday"],
      preferredLongRunDay: "sunday",
      typicalAvailableTimeMin: 70,
      trainingStylePreference: "conservative",
      externalTrainingLoad: "moderate",
      injuryConcern: "low",
      confidence: 3,
      age: 44,
      sex: "female",
      experienceLevel: "recreational",
    },
  },
  {
    id: "benchmark-18-intermediate-half-marathon-target-time",
    name: "Benchmark 18 – Intermediate – Half marathon target time",
    goalLabel: "Halvmaraton i måltempo",
    runnerSummary: [
      "Kan løbe 80 minutter sammenhængende",
      "Længste nylige tur: 95 min",
      "Træner nu: 4 gange om ugen",
      "Tilgængelige dage: Mandag, Onsdag, Fredag, Søndag",
      "Foretrukken dag til lang tur: Søndag",
      "Ambition: Standard",
    ],
    input: {
      raceDistance: "HalfMarathon",
      goalType: "target_time",
      startDate: START_DATE,
      ambitionPreference: "standard",
      currentContinuousRunMin: 80,
      currentWeeklyRuns: 4,
      currentWeeklyVolumeKm: 46,
      longestRecentRunMin: 95,
      recentConsistency: 0.82,
      availableTrainingDays: ["monday", "wednesday", "friday", "sunday"],
      preferredLongRunDay: "sunday",
      typicalAvailableTimeMin: 80,
      trainingStylePreference: "performance",
      externalTrainingLoad: "light",
      injuryConcern: "low",
      confidence: 4,
      age: 34,
      sex: "male",
      experienceLevel: "intermediate",
    },
  },
  {
    id: "benchmark-19-experienced-marathon-finish-rolig",
    name: "Benchmark 19 – Experienced – Marathon finish – rolig",
    goalLabel: "Gennemføre marathon",
    runnerSummary: [
      "Kan løbe 85 minutter sammenhængende",
      "Længste nylige tur: 100 min",
      "Træner nu: 4 gange om ugen",
      "Tilgængelige dage: Tirsdag, Torsdag, Lørdag, Søndag",
      "Foretrukken dag til lang tur: Søndag",
      "Ambition: Rolig",
    ],
    input: {
      raceDistance: "Marathon",
      goalType: "finish",
      startDate: START_DATE,
      ambitionPreference: "gentle",
      currentContinuousRunMin: 85,
      currentWeeklyRuns: 4,
      currentWeeklyVolumeKm: 42,
      longestRecentRunMin: 100,
      recentConsistency: 0.7,
      availableTrainingDays: ["tuesday", "thursday", "saturday", "sunday"],
      preferredLongRunDay: "sunday",
      typicalAvailableTimeMin: 90,
      trainingStylePreference: "conservative",
      externalTrainingLoad: "moderate",
      injuryConcern: "low",
      confidence: 3,
      age: 45,
      sex: "female",
      experienceLevel: "intermediate",
    },
  },
  {
    id: "benchmark-20-advanced-10k-target-time",
    name: "Benchmark 20 – Advanced – 10K target time",
    goalLabel: "10 km i måltempo",
    runnerSummary: [
      "Kan løbe 60 minutter sammenhængende",
      "Længste nylige tur: 80 min",
      "Træner nu: 5 gange om ugen",
      "Tilgængelige dage: Mandag, Tirsdag, Torsdag, Lørdag, Søndag",
      "Foretrukken dag til lang tur: Søndag",
      "Ambition: Standard",
    ],
    input: {
      raceDistance: "10K",
      goalType: "target_time",
      startDate: START_DATE,
      ambitionPreference: "standard",
      currentContinuousRunMin: 60,
      currentWeeklyRuns: 5,
      currentWeeklyVolumeKm: 48,
      longestRecentRunMin: 80,
      recentConsistency: 0.88,
      availableTrainingDays: ["monday", "tuesday", "thursday", "saturday", "sunday"],
      preferredLongRunDay: "sunday",
      typicalAvailableTimeMin: 70,
      trainingStylePreference: "performance",
      externalTrainingLoad: "light",
      injuryConcern: "low",
      confidence: 4,
      age: 33,
      sex: "female",
      experienceLevel: "advanced",
    },
  },
];

function formatMinutes(value: number): string {
  return `${String(Math.round(value * 10) / 10).replace(".", ",")} min`;
}

function formatDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("da-DK", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function segmentText(segment: BuiltSession["structure"][number]): string {
  const repeats = segment.repeats ? `${segment.repeats} x ` : "";
  const recover = segment.recoverMin ? ` / ${formatMinutes(segment.recoverMin)} pause` : "";
  return `${repeats}${segment.label} (${formatMinutes(segment.durationMin)}${recover})`;
}

function yesNo(value: boolean): string {
  return value ? "Ja" : "Nej";
}

function percent(value: number): string {
  return `${Math.round(value)}%`;
}

function sessionCountProgression(plan: EnginePlan): string {
  const values = plan.curves.sessionsPerWeekCurve;
  return values.length > 0 ? values.join(" -> ") : "Ukendt";
}

function phaseLine(plan: EnginePlan): string[] {
  return plan.phasePlan.blocks.map((block) => {
    const start = block.startWeekIndex;
    const end = block.endWeekIndex;
    const label = block.timelinePhase === "race" ? "Race week" : phaseLabels[block.phase];
    return `Uge ${start}${start === end ? "" : `-${end}`}: ${label}`;
  });
}

function roleMinutesByWeek(week: EnginePlan["weeks"][number]): Record<string, number> {
  return week.sessions.reduce<Record<string, number>>((acc, session) => {
    acc[session.role] = (acc[session.role] ?? 0) + session.durationMin;
    return acc;
  }, {});
}

function roleDistribution(plan: EnginePlan): Record<string, number> {
  return plan.weeks.reduce<Record<string, number>>((acc, week) => {
    for (const session of week.sessions) {
      acc[session.role] = (acc[session.role] ?? 0) + 1;
    }
    return acc;
  }, {});
}

function buildExportText(fixture: BenchmarkFixture, plan: EnginePlan): string {
  const lines: string[] = [];
  const totalSessions = plan.weeks.reduce((sum, week) => sum + week.sessions.length, 0);
  const totalTrainingMinutes = plan.weeks.reduce((sum, week) => sum + week.sessions.reduce((inner, session) => inner + session.durationMin, 0), 0);
  const peakLongRun = Math.max(...plan.curves.longRunCurve);
  const peakWeeklyVolume = Math.max(...plan.curves.weeklyVolumeCurve);
  const raceWeek = plan.weeks.find((week) => week.isRaceWeek);
  const distribution = roleDistribution(plan);

  lines.push("StridePilot programeksport");
  lines.push("");
  lines.push(fixture.name);
  lines.push("");
  lines.push("Løberprofil");
  lines.push(...fixture.runnerSummary.map((line) => `- ${line}`));
  lines.push(`- Klassifikation: ${plan.classification.traits.runnerLevel}`);
  lines.push(`- Primær løbertype: ${plan.classification.traits.primaryRunnerType}`);
  if (plan.classification.traits.modifiers.length > 0) {
    lines.push(`- Modifiers: ${plan.classification.traits.modifiers.join(", ")}`);
  }
  lines.push("");
  lines.push("Mål");
  lines.push(`- ${fixture.goalLabel}`);
  lines.push(`- Goal type: ${plan.input.goalType}`);
  lines.push("");
  lines.push("Tidslinje");
  lines.push(`- Anbefalet varighed: ${plan.timelineRecommendation.recommendedDurationWeeks} uger`);
  lines.push(`- Valgt varighed: ${plan.timelineRecommendation.finalDurationWeeks} uger`);
  lines.push(
    `- Realistisk spænd: ${plan.timelineRecommendation.feasibleDurationRangeWeeks.minimum}-${plan.timelineRecommendation.feasibleDurationRangeWeeks.maximum} uger`,
  );
  lines.push(`- Progressionstempo: ${progressionLabels[plan.timelineRecommendation.recommendedProgressionMode]}`);
  lines.push(
    `- Pas pr. uge: ${plan.timelineRecommendation.startingSessionsPerWeek} -> ${plan.timelineRecommendation.peakSessionsPerWeek}`,
  );
  if (plan.timelineRecommendation.warnings.length > 0) {
    lines.push(`- Bemærkninger: ${plan.timelineRecommendation.warnings.join(" / ")}`);
  }
  lines.push("");
  lines.push("Engine-resume");
  lines.push(`- Backbone-type: ${backboneLabels[plan.backboneSelection.type]}`);
  lines.push(`- Planvarighed: ${plan.timelineRecommendation.finalDurationWeeks} uger`);
  lines.push(`- Pas pr. uge progression: ${sessionCountProgression(plan)}`);
  lines.push(`- Peak lang tur: ${formatMinutes(peakLongRun)}`);
  lines.push(`- Peak ugentlig volumen: ${formatMinutes(peakWeeklyVolume)}`);
  lines.push(`- Antal step-back-uger: ${plan.curves.cutbackWeeks.length}`);
  lines.push(`- Antal taper-uger: ${plan.curves.taperWeeks.length}`);
  lines.push(`- Race week: ${raceWeek ? `Uge ${raceWeek.weekIndex}` : "Ingen"}`);
  lines.push(`- Antal pas i alt: ${totalSessions}`);
  lines.push(`- Samlet træningstid: ${formatMinutes(totalTrainingMinutes)}`);
  lines.push("");
  lines.push("Progression curves");
  lines.push("");
  lines.push("Continuous running progression (minutes per week)");
  plan.curves.continuousCurve.forEach((value, index) => lines.push(`Uge ${index + 1}: ${formatMinutes(value)}`));
  lines.push("");
  lines.push("Long run progression (minutes per week)");
  plan.curves.longRunCurve.forEach((value, index) => lines.push(`Uge ${index + 1}: ${formatMinutes(value)}`));
  lines.push("");
  lines.push("Weekly volume progression (total minutes per week)");
  plan.curves.weeklyVolumeCurve.forEach((value, index) => lines.push(`Uge ${index + 1}: ${formatMinutes(value)}`));
  lines.push("");
  lines.push("Sessions per week progression");
  plan.curves.sessionsPerWeekCurve.forEach((value, index) => lines.push(`Uge ${index + 1}: ${value}`));
  lines.push("");
  lines.push("Phase overview");
  lines.push(...phaseLine(plan));
  lines.push("");
  lines.push("Weekly load overview");
  for (const week of plan.weeks) {
    const roleMinutes = roleMinutesByWeek(week);
    const longRunShare = week.volumeTargetMin > 0 ? (week.longRunTargetMin / week.volumeTargetMin) * 100 : 0;
    lines.push("");
    lines.push(`Week ${week.weekIndex}`);
    lines.push(`Phase: ${week.timelinePhase === "race" ? "Race week" : phaseLabels[week.phase]}`);
    lines.push(`Sessions: ${week.sessions.length}`);
    lines.push(`Weekly volume: ${formatMinutes(week.volumeTargetMin)}`);
    lines.push(`Long run: ${formatMinutes(week.longRunTargetMin)}`);
    lines.push(`Continuous run: ${formatMinutes(plan.curves.continuousCurve[week.weekIndex - 1] ?? 0)}`);
    lines.push(`Easy minutes: ${formatMinutes(roleMinutes.easy ?? 0)}`);
    lines.push(`Support minutes: ${formatMinutes(roleMinutes.aerobic_support ?? 0)}`);
    lines.push(`Quality minutes: ${formatMinutes(roleMinutes.quality ?? 0)}`);
    lines.push(`Recovery minutes: ${formatMinutes(roleMinutes.recovery ?? 0)}`);
    lines.push(`Long run minutes: ${formatMinutes(roleMinutes.long_run ?? 0)}`);
    lines.push(`Long run % of volume: ${percent(longRunShare)}`);
    lines.push(`Step-back week: ${yesNo(week.isCutback)}`);
    lines.push(`Taper week: ${yesNo(week.phase === "taper" && !week.isRaceWeek)}`);
  }
  lines.push("");
  lines.push("Weekly structure overview");
  plan.weeks.forEach((week) => {
    const roles = week.sessions.map((session) => roleLabels[session.role] ?? session.role).join(" / ");
    lines.push(`Week ${week.weekIndex}: ${roles}`);
  });
  lines.push("");
  lines.push("Session role distribution");
  lines.push(`Easy runs: ${distribution.easy ?? 0}`);
  lines.push(`Support runs: ${distribution.aerobic_support ?? 0}`);
  lines.push(`Quality sessions: ${distribution.quality ?? 0}`);
  lines.push(`Recovery runs: ${distribution.recovery ?? 0}`);
  lines.push(`Long runs: ${distribution.long_run ?? 0}`);
  lines.push("");
  lines.push("Fuldt program");
  lines.push("");
  for (const week of plan.weeks) {
    lines.push(`Uge ${week.weekIndex} · ${week.timelinePhase === "race" ? "Race week" : phaseLabels[week.phase]}${week.isCutback ? " · Step-back-uge" : ""}`);
    lines.push(`Fokus: ${week.focus}`);
    lines.push(
      `Ugens mål: lang tur ${formatMinutes(week.longRunTargetMin)} · kontinuitet ${formatMinutes(plan.curves.continuousCurve[week.weekIndex - 1] ?? 0)} · volumen ${formatMinutes(week.volumeTargetMin)}`,
    );
    for (const session of week.sessions) {
      lines.push(`- ${dayLabels[session.day]} (${formatDate(session.date)}) – ${session.title} – ${formatMinutes(session.durationMin)}`);
      lines.push(`  Fase: ${week.timelinePhase === "race" ? "Race week" : phaseLabels[week.phase]}`);
      lines.push(`  Rolle: ${roleLabels[session.role] ?? session.role}`);
      lines.push(`  Pas-type: ${familyLabels[session.family] ?? session.family}`);
      lines.push(`  Formål: ${session.purpose}`);
      lines.push(`  Resume: ${session.summary}`);
      lines.push(`  Struktur: ${session.structure.map(segmentText).join(" | ")}`);
      if (session.coachingCues.length > 0) lines.push(`  Coaching cues: ${session.coachingCues.join(" / ")}`);
      if (session.notes && session.notes.length > 0) lines.push(`  Noter: ${session.notes.join(" / ")}`);
    }
    if (week.validationIssues && week.validationIssues.length > 0) {
      lines.push(`  Validering: ${week.validationIssues.map((issue) => issue.message).join(" ; ")}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const manifest: string[] = [];

for (const fixture of fixtures) {
  const plan = generateEngineV2Plan(fixture.input);
  const content = buildExportText(fixture, plan);
  const filePath = path.join(OUTPUT_DIR, `${fixture.id}.txt`);
  fs.writeFileSync(filePath, content, "utf8");
  manifest.push(`${fixture.name}: ${filePath}`);
  console.log(`${fixture.name} -> ${filePath}`);
}

fs.writeFileSync(path.join(OUTPUT_DIR, "README.txt"), manifest.join("\n"), "utf8");
