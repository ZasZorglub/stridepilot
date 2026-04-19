import fs from "fs";
import path from "path";

import type { Goal, RunnerProfile as AppRunnerProfile, WorkoutSession as AppWorkoutSession, WorkoutStep } from "../types";
import { applyPlanSafety } from "../plan-safety";
import { sumWorkoutStepDurationSec, summarizeWorkoutSteps } from "../plan-safety";
import { buildWeeklyLoad, DAYS, enforceAvailableTrainingDays } from "../plan";
import { buildGoalPlan } from "./build5kPlan";
import { interpretRunnerProfile } from "./interpreter";
import { mapCoachPlanToAppPlan } from "./mapToAppPlan";
import type { GoalConfig as CoachGoalConfig, GoalIntent as CoachGoalIntent, TrainingPlan as CoachTrainingPlan, WorkoutSession as CoachWorkoutSession } from "./types";

export type PlanQualityWarningType =
  | "missing_destination_session"
  | "race_day_too_short"
  | "late_plan_collapse"
  | "taper_too_aggressive"
  | "goal_week_shape_mismatch"
  | "session_shape_mismatch"
  | "front_loaded_distribution"
  | "silent_frequency_override"
  | "race_day_label_bug"
  | "mid_block_too_flat"
  | "aggressive_progression_jump"
  | "experienced_runner_underdosed"
  | "overcautious_goal_focused_plan"
  | "track_signal_not_reflected_enough";

export interface BenchmarkReportFixture {
  profileId: string;
  profileName: string;
  runnerProfile: AppRunnerProfile;
  goal: Goal;
  benchmarkSettings?: {
    durationScenario?: "recommended" | "shorter_override" | "longer_override";
    lowFrequencyOverrideAccepted?: boolean;
  };
}

export interface BenchmarkSessionReport {
  sessionIndex: number;
  sessionType: string;
  sessionLabel: string;
  durationMin: number;
  isKeyWorkout: boolean;
  structureSummary: string;
  steps: Array<{
    type: WorkoutStep["type"];
    label: string;
    durationSec: number;
    cue: string;
    heartRateGuidance?: WorkoutStep["heartRateGuidance"];
  }>;
  intervalAnalysis: {
    isIntervalSession: boolean;
    workBlocks: Array<{ label: string; durationSec: number; zoneLabel?: string }>;
    recoveryBlocks: Array<{ label: string; durationSec: number; zoneLabel?: string }>;
    hasCoachingMismatch: boolean;
    notes: string[];
  };
}

export function hasMaterialSessionShapeMismatch(params: {
  durationMin: number;
  structureSummary: string;
  steps: Array<Pick<WorkoutStep, "type" | "durationSec">>;
  toleranceMin?: number;
}): boolean {
  const toleranceMin = params.toleranceMin ?? 0.5;
  const totalDurationMin = roundTenth(params.steps.reduce((sum, step) => sum + step.durationSec, 0) / 60);
  const derivedSummary = summarizeWorkoutSteps(params.steps as WorkoutStep[]);
  return Math.abs(params.durationMin - totalDurationMin) > toleranceMin || params.structureSummary !== derivedSummary;
}

export interface BenchmarkQualityDiagnostics {
  goalWeek: number;
  destinationSessionSummary: string | null;
  finalWeekSessionSummaries: string[];
  longestPriorRunMin: number;
  longestPriorKeyRunMin: number;
  goalDayRunMin: number;
  goalDaySessionType: string | null;
  coachCredibilityScore: number;
  realismScore: number;
  safetyScore: number;
  progressionScore: number;
  distributionScore: number;
  labelTrustScore: number;
  verdict: "pass" | "borderline" | "fail";
}

export interface BenchmarkReport {
  profileId: string;
  profileName: string;
  profileSummary: {
    goalDistance: Goal["distance"];
    goalType: NonNullable<Goal["goalType"]>;
    daysPerWeek: number;
    currentLevel: string;
    archetype: string;
    onboardingTrack: AppRunnerProfile["onboardingTrack"] | null;
    currentContinuousDistanceKm: number | null;
    durationScenario: "recommended" | "shorter_override" | "longer_override";
    lowFrequencyOverrideAccepted: boolean;
    notes: string;
  };
  planSummary: {
    totalWeeks: number;
    phaseSequence: string[];
    weeklySessionCounts: number[];
    longestWorkoutMin: number;
    hasIntervals: boolean;
    verdict: "pass" | "borderline" | "fail";
  };
  qualityDiagnostics: BenchmarkQualityDiagnostics;
  warnings: PlanQualityWarningType[];
  findings: Array<{
    code: PlanQualityWarningType | "duration_override_respected" | "low_frequency_ambitious_but_respected";
    level: "info" | "warning";
    message: string;
    whyItMatters: string;
  }>;
  weeks: Array<{
    weekIndex: number;
    phase: string;
    sessions: BenchmarkSessionReport[];
  }>;
  flags: {
    hasOddAdjacentIdenticalBlocks: boolean;
    hasVeryShortWorkIntervals: boolean;
    hasVeryShortRecoveries: boolean;
    hasCoachingMismatch: boolean;
    hasSuspiciousSessionShapes: boolean;
    hasFrontLoadedWeek: boolean;
    hasSilentFrequencyOverride: boolean;
    hasRaceDayLabelBug: boolean;
    hasSuspiciousFlatBlock: boolean;
    hasAggressiveProgressionJump: boolean;
    hasUnderdosedExperiencedRunner: boolean;
    hasOvercautiousGoalFocusedPlan: boolean;
    hasCoachCredibilityConcern: boolean;
  };
}

export interface PlanQualitySummaryReport {
  profilesTested: number;
  profilesWithWarnings: number;
  verdictCounts: {
    pass: number;
    borderline: number;
    fail: number;
  };
  warningTypes: Record<PlanQualityWarningType, number>;
  averageScores: {
    coachCredibilityScore: number;
    realismScore: number;
    safetyScore: number;
    progressionScore: number;
    distributionScore: number;
    labelTrustScore: number;
  };
  recurringIssueCategories: Array<{ code: string; count: number }>;
  worstProfiles: Array<{ profileId: string; profileName: string; coachCredibilityScore: number; warnings: PlanQualityWarningType[] }>;
  profilesForReviewFirst: Array<{ profileId: string; profileName: string; verdict: "pass" | "borderline" | "fail"; warnings: PlanQualityWarningType[] }>;
  profiles: Array<{
    profileId: string;
    profileName: string;
    goalDistance: Goal["distance"];
    goalType: NonNullable<Goal["goalType"]>;
    daysPerWeek: number;
    archetype: string;
    warnings: PlanQualityWarningType[];
    planSummary: {
      totalWeeks: number;
      goalWeek: number;
      longestPriorRunMin: number;
      longestPriorKeyRunMin: number;
      goalDayRunMin: number;
      coachCredibilityScore: number;
      verdict: "pass" | "borderline" | "fail";
    };
    destinationSessionSummary: string | null;
    finalWeekSessionSummaries: string[];
  }>;
}

const DEFAULT_START_DATE = "2026-03-31";
const WARNING_TYPES: PlanQualityWarningType[] = [
  "missing_destination_session",
  "race_day_too_short",
  "late_plan_collapse",
  "taper_too_aggressive",
  "goal_week_shape_mismatch",
  "session_shape_mismatch",
  "front_loaded_distribution",
  "silent_frequency_override",
  "race_day_label_bug",
  "mid_block_too_flat",
  "aggressive_progression_jump",
  "experienced_runner_underdosed",
  "overcautious_goal_focused_plan",
  "track_signal_not_reflected_enough",
];

function profileFixture(
  profileId: string,
  profileName: string,
  runnerProfile: Partial<AppRunnerProfile>,
  goal: Partial<Goal>,
  benchmarkSettings?: BenchmarkReportFixture["benchmarkSettings"],
): BenchmarkReportFixture {
  return {
    profileId,
    profileName,
    runnerProfile: {
      heightCm: 172,
      weightKg: 68,
      age: 36,
      activityLevel: "moderat",
      runningExperience: "let_ovet",
      currentRunningAbility: "tyve_tredive_min",
      userTrainingContext: "",
      currentWeeklyVolumeKm: 18,
      currentRunsPerWeek: 3,
      longestCurrentRunMin: 35,
      recentRaceTimes: [],
      injuryHistory: "",
      weakPoints: "",
      realisticTrainingDaysPerWeek: 3,
      typicalWorkoutMinutes: 45,
      otherTraining: "",
      preferredGuidance: "flexible",
      ...runnerProfile,
    },
    goal: {
      distance: "10K",
      goalType: "complete",
      weeks: 14,
      startDate: DEFAULT_START_DATE,
      availableTrainingDays: ["Tirsdag", "Torsdag", "Sondag"],
      ...goal,
    },
    benchmarkSettings,
  };
}

const foundationalFixtures: BenchmarkReportFixture[] = [
  profileFixture("profile-01", "Returning beginner, 2x/week", { onboardingTrack: "returning", currentContinuousDistanceKm: 1, runningExperience: "nybegynder", currentRunningAbility: "fem_min", currentRunsPerWeek: 2, currentWeeklyVolumeKm: 6, longestCurrentRunMin: 12, realisticTrainingDaysPerWeek: 2, typicalWorkoutMinutes: 35, userTrainingContext: "Tilbage efter pause og vil bygge roligt op." }, { distance: "5K", goalType: "run_without_walking", availableTrainingDays: ["Tirsdag", "Lordag"] }),
  profileFixture("profile-02", "Beginner, 3x/week, first 5K", { onboardingTrack: "getting_started", currentContinuousDistanceKm: 2, runningExperience: "nybegynder", currentRunningAbility: "ti_femten_min", currentWeeklyVolumeKm: 10, longestCurrentRunMin: 18, userTrainingContext: "Vil frem mod min forste 5 km." }, { distance: "5K", goalType: "complete", weeks: 12 }),
  profileFixture("profile-03", "Cautious beginner, 3x/week", { runningExperience: "nybegynder", currentRunningAbility: "fem_min", currentRunsPerWeek: 2, currentWeeklyVolumeKm: 7, longestCurrentRunMin: 14, activityLevel: "lav", injuryHistory: "Tidligere skinnebensirritation.", userTrainingContext: "Har brug for ekstra rolig progression." }, { distance: "5K", goalType: "run_without_walking", weeks: 12 }),
  profileFixture("profile-04", "Novice 10K, 3x/week", { currentRunningAbility: "tyve_tredive_min", currentWeeklyVolumeKm: 18, longestCurrentRunMin: 35, userTrainingContext: "Vil bygge mod 10 km uden at det bliver for hardt." }, { distance: "10K", goalType: "complete", weeks: 14 }),
  profileFixture("profile-05", "Beginner 10K, 2x/week", { currentRunningAbility: "ti_femten_min", currentRunsPerWeek: 2, currentWeeklyVolumeKm: 11, longestCurrentRunMin: 24, realisticTrainingDaysPerWeek: 2, typicalWorkoutMinutes: 40 }, { distance: "10K", goalType: "complete", weeks: 16, availableTrainingDays: ["Onsdag", "Sondag"] }),
  profileFixture("profile-06", "Recreational 10K PR, 4x/week", { onboardingTrack: "goal_focused", currentContinuousDistanceKm: 10, runningExperience: "ovet", currentRunningAbility: "mere_end_tredive_min", currentRunsPerWeek: 4, currentWeeklyVolumeKm: 32, longestCurrentRunMin: 60, realisticTrainingDaysPerWeek: 4, typicalWorkoutMinutes: 60, recentRaceTimes: [{ distance: "10K", time: "48:30" }], preferredGuidance: "performance_oriented" }, { distance: "10K", goalType: "pr", weeks: 14, availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"] }),
  profileFixture("profile-07", "Recreational 10K target time", { onboardingTrack: "running_consistently", currentContinuousDistanceKm: 8, runningExperience: "ovet", currentRunningAbility: "mere_end_tredive_min", currentRunsPerWeek: 4, currentWeeklyVolumeKm: 30, longestCurrentRunMin: 55, realisticTrainingDaysPerWeek: 4, typicalWorkoutMinutes: 60 }, { distance: "10K", goalType: "target_time", targetTime: "47:30", weeks: 14, availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"] }, { durationScenario: "shorter_override" }),
  profileFixture("profile-08", "Comeback 5K, 3x/week", { runningExperience: "let_ovet", currentRunningAbility: "fem_min", currentRunsPerWeek: 2, currentWeeklyVolumeKm: 8, longestCurrentRunMin: 15, injuryHistory: "Tidligere knairritation.", activityLevel: "lav", userTrainingContext: "Pa vej tilbage og vil have meget rolig progression." }, { distance: "5K", goalType: "run_without_walking", weeks: 12 }),
  profileFixture("profile-09", "Half marathon finish, 4x/week", { runningExperience: "ovet", currentRunningAbility: "mere_end_tredive_min", currentRunsPerWeek: 4, currentWeeklyVolumeKm: 28, longestCurrentRunMin: 75, realisticTrainingDaysPerWeek: 4, typicalWorkoutMinutes: 65, recentRaceTimes: [{ distance: "10K", time: "52:10" }] }, { distance: "Halvmaraton", goalType: "complete", weeks: 18, availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"] }),
  profileFixture("profile-10", "Half marathon improve, 4x/week", { runningExperience: "ovet", currentRunningAbility: "mere_end_tredive_min", currentRunsPerWeek: 4, currentWeeklyVolumeKm: 36, longestCurrentRunMin: 85, realisticTrainingDaysPerWeek: 4, typicalWorkoutMinutes: 70, recentRaceTimes: [{ distance: "Halvmaraton", time: "1:49:00" }], preferredGuidance: "performance_oriented" }, { distance: "Halvmaraton", goalType: "pr", weeks: 18, availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"] }),
  profileFixture("profile-11", "Half marathon cautious, 3x/week", { runningExperience: "let_ovet", currentRunningAbility: "tyve_tredive_min", currentRunsPerWeek: 3, currentWeeklyVolumeKm: 22, longestCurrentRunMin: 55, realisticTrainingDaysPerWeek: 3, typicalWorkoutMinutes: 55, injuryHistory: "Har brug for stabil progression." }, { distance: "Halvmaraton", goalType: "complete", weeks: 18 }),
  profileFixture("profile-12", "Fit but inexperienced half, 4x/week", { runningExperience: "let_ovet", currentRunningAbility: "tyve_tredive_min", currentRunsPerWeek: 4, currentWeeklyVolumeKm: 24, longestCurrentRunMin: 50, realisticTrainingDaysPerWeek: 4, otherTraining: "Lidt cykling og styrke." }, { distance: "Halvmaraton", goalType: "complete", weeks: 18, availableTrainingDays: ["Mandag", "Tirsdag", "Torsdag", "Sondag"] }),
  profileFixture("profile-13", "Marathon finish, 4x/week", { onboardingTrack: "running_consistently", currentContinuousDistanceKm: 14, runningExperience: "ovet", currentRunningAbility: "mere_end_tredive_min", currentRunsPerWeek: 4, currentWeeklyVolumeKm: 40, longestCurrentRunMin: 100, realisticTrainingDaysPerWeek: 4, typicalWorkoutMinutes: 75 }, { distance: "Marathon", goalType: "complete", weeks: 20, availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"] }),
  profileFixture("profile-14", "Marathon improve, 4x/week", { onboardingTrack: "goal_focused", currentContinuousDistanceKm: 18, runningExperience: "ovet", currentRunningAbility: "mere_end_tredive_min", currentRunsPerWeek: 4, currentWeeklyVolumeKm: 52, longestCurrentRunMin: 125, realisticTrainingDaysPerWeek: 4, typicalWorkoutMinutes: 80, recentRaceTimes: [{ distance: "Marathon", time: "3:42:00" }], preferredGuidance: "performance_oriented" }, { distance: "Marathon", goalType: "pr", weeks: 20, availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"] }, { durationScenario: "longer_override" }),
  profileFixture("profile-15", "Experienced 5K target time", { runningExperience: "ovet", currentRunningAbility: "mere_end_tredive_min", currentRunsPerWeek: 4, currentWeeklyVolumeKm: 34, longestCurrentRunMin: 55, realisticTrainingDaysPerWeek: 4, typicalWorkoutMinutes: 55, recentRaceTimes: [{ distance: "5K", time: "23:15" }] }, { distance: "5K", goalType: "target_time", targetTime: "22:15", weeks: 12, availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"] }),
  profileFixture("profile-16", "Recreational 5K PR, 3x/week", { runningExperience: "let_ovet", currentRunningAbility: "tyve_tredive_min", currentRunsPerWeek: 3, currentWeeklyVolumeKm: 19, longestCurrentRunMin: 38, recentRaceTimes: [{ distance: "5K", time: "27:40" }] }, { distance: "5K", goalType: "pr", weeks: 12 }),
  profileFixture("profile-17", "Older cautious 10K, 3x/week", { age: 54, runningExperience: "let_ovet", currentRunningAbility: "tyve_tredive_min", currentRunsPerWeek: 3, currentWeeklyVolumeKm: 16, longestCurrentRunMin: 32, injuryHistory: "Achilles og laeg vil have konservativ progression.", activityLevel: "lav" }, { distance: "10K", goalType: "complete", weeks: 14 }),
  profileFixture("profile-18", "Return to running 10K, 2x/week", { runningExperience: "let_ovet", currentRunningAbility: "fem_min", currentRunsPerWeek: 2, currentWeeklyVolumeKm: 7, longestCurrentRunMin: 14, realisticTrainingDaysPerWeek: 2, activityLevel: "lav", injuryHistory: "Lang pause fra lob." }, { distance: "10K", goalType: "complete", weeks: 16, availableTrainingDays: ["Tirsdag", "Sondag"] }),
  profileFixture("profile-19", "Intermediate 10K improve, 4x/week", { runningExperience: "ovet", currentRunningAbility: "mere_end_tredive_min", currentRunsPerWeek: 4, currentWeeklyVolumeKm: 36, longestCurrentRunMin: 65, realisticTrainingDaysPerWeek: 4, typicalWorkoutMinutes: 65 }, { distance: "10K", goalType: "pr", weeks: 14, availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"] }),
  profileFixture("profile-20", "Advanced marathon target time", { runningExperience: "ovet", currentRunningAbility: "mere_end_tredive_min", currentRunsPerWeek: 4, currentWeeklyVolumeKm: 58, longestCurrentRunMin: 135, realisticTrainingDaysPerWeek: 4, typicalWorkoutMinutes: 85, recentRaceTimes: [{ distance: "Marathon", time: "3:28:00" }], preferredGuidance: "performance_oriented" }, { distance: "Marathon", goalType: "target_time", targetTime: "3:20:00", weeks: 20, availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"] }),
];

const expandedFixtures: BenchmarkReportFixture[] = [
  profileFixture("profile-21", "Nervous 5K complete, 2x/week", { runningExperience: "nybegynder", currentRunningAbility: "fem_min", currentRunsPerWeek: 2, currentWeeklyVolumeKm: 5, longestCurrentRunMin: 10, realisticTrainingDaysPerWeek: 2, activityLevel: "lav", userTrainingContext: "Har brug for meget tryg og enkel progression." }, { distance: "5K", goalType: "complete", weeks: 12, availableTrainingDays: ["Onsdag", "Sondag"] }),
  profileFixture("profile-22", "Beginner 5K target time, 4x/week", { runningExperience: "let_ovet", currentRunningAbility: "tyve_tredive_min", currentRunsPerWeek: 4, currentWeeklyVolumeKm: 20, longestCurrentRunMin: 38, realisticTrainingDaysPerWeek: 4 }, { distance: "5K", goalType: "target_time", targetTime: "26:30", weeks: 12, availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"] }),
  profileFixture("profile-23", "Motivated 5K PR, 4x/week", { runningExperience: "ovet", currentRunningAbility: "mere_end_tredive_min", currentRunsPerWeek: 4, currentWeeklyVolumeKm: 30, longestCurrentRunMin: 48, realisticTrainingDaysPerWeek: 4, preferredGuidance: "performance_oriented" }, { distance: "5K", goalType: "pr", weeks: 12, availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"] }),
  profileFixture("profile-24", "Comeback 5K complete, 3x/week", { runningExperience: "let_ovet", currentRunningAbility: "ti_femten_min", currentRunsPerWeek: 3, currentWeeklyVolumeKm: 12, longestCurrentRunMin: 20, injuryHistory: "Tilbage efter mindre skadespause." }, { distance: "5K", goalType: "complete", weeks: 12 }),
  profileFixture("profile-25", "Cautious 10K complete, 3x/week", { runningExperience: "nybegynder", currentRunningAbility: "ti_femten_min", currentRunsPerWeek: 3, currentWeeklyVolumeKm: 12, longestCurrentRunMin: 22, injuryHistory: "Vil holde progressionen meget rolig." }, { distance: "10K", goalType: "complete", weeks: 16 }),
  profileFixture("profile-26", "Steady 10K complete, 4x/week", { runningExperience: "let_ovet", currentRunningAbility: "tyve_tredive_min", currentRunsPerWeek: 4, currentWeeklyVolumeKm: 24, longestCurrentRunMin: 42, realisticTrainingDaysPerWeek: 4 }, { distance: "10K", goalType: "complete", weeks: 14, availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"] }),
  profileFixture("profile-27", "Balanced 10K target time, 3x/week", { runningExperience: "ovet", currentRunningAbility: "mere_end_tredive_min", currentRunsPerWeek: 3, currentWeeklyVolumeKm: 26, longestCurrentRunMin: 50, realisticTrainingDaysPerWeek: 3 }, { distance: "10K", goalType: "target_time", targetTime: "49:00", weeks: 14 }),
  profileFixture("profile-28", "Older 10K PR, 4x/week", { age: 57, runningExperience: "ovet", currentRunningAbility: "mere_end_tredive_min", currentRunsPerWeek: 4, currentWeeklyVolumeKm: 34, longestCurrentRunMin: 58, realisticTrainingDaysPerWeek: 4, userTrainingContext: "Vil gerne forbedre mig uden at forcere." }, { distance: "10K", goalType: "pr", weeks: 14, availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"] }),
  profileFixture("profile-29", "Comeback 10K complete, 2x/week", { runningExperience: "let_ovet", currentRunningAbility: "ti_femten_min", currentRunsPerWeek: 2, currentWeeklyVolumeKm: 10, longestCurrentRunMin: 20, realisticTrainingDaysPerWeek: 2, injuryHistory: "Tilbage efter lang pause." }, { distance: "10K", goalType: "complete", weeks: 16, availableTrainingDays: ["Tirsdag", "Sondag"] }),
  profileFixture("profile-30", "Stronger 10K target time, 4x/week", { runningExperience: "ovet", currentRunningAbility: "mere_end_tredive_min", currentRunsPerWeek: 4, currentWeeklyVolumeKm: 40, longestCurrentRunMin: 72, realisticTrainingDaysPerWeek: 4, preferredGuidance: "performance_oriented" }, { distance: "10K", goalType: "target_time", targetTime: "43:30", weeks: 14, availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"] }),
  profileFixture("profile-31", "Half finish cautious, 3x/week", { runningExperience: "let_ovet", currentRunningAbility: "tyve_tredive_min", currentRunsPerWeek: 3, currentWeeklyVolumeKm: 20, longestCurrentRunMin: 48, injuryHistory: "Fungerer bedst med lidt ekstra margin." }, { distance: "Halvmaraton", goalType: "complete", weeks: 18 }),
  profileFixture("profile-32", "Half target time, 4x/week", { runningExperience: "ovet", currentRunningAbility: "mere_end_tredive_min", currentRunsPerWeek: 4, currentWeeklyVolumeKm: 38, longestCurrentRunMin: 88, realisticTrainingDaysPerWeek: 4, preferredGuidance: "performance_oriented" }, { distance: "Halvmaraton", goalType: "target_time", targetTime: "1:42:00", weeks: 18, availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"] }),
  profileFixture("profile-33", "Half complete durable, 2x/week", { onboardingTrack: "goal_focused", currentContinuousDistanceKm: 7, runningExperience: "let_ovet", currentRunningAbility: "tyve_tredive_min", currentRunsPerWeek: 2, currentWeeklyVolumeKm: 18, longestCurrentRunMin: 50, realisticTrainingDaysPerWeek: 2, typicalWorkoutMinutes: 60 }, { distance: "Halvmaraton", goalType: "complete", weeks: 20, availableTrainingDays: ["Onsdag", "Sondag"] }, { lowFrequencyOverrideAccepted: true, durationScenario: "shorter_override" }),
  profileFixture("profile-34", "Half PR strong, 4x/week", { runningExperience: "ovet", currentRunningAbility: "mere_end_tredive_min", currentRunsPerWeek: 4, currentWeeklyVolumeKm: 44, longestCurrentRunMin: 95, realisticTrainingDaysPerWeek: 4, preferredGuidance: "performance_oriented" }, { distance: "Halvmaraton", goalType: "pr", weeks: 18, availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"] }),
  profileFixture("profile-35", "Half comeback finish, 4x/week", { runningExperience: "let_ovet", currentRunningAbility: "ti_femten_min", currentRunsPerWeek: 3, currentWeeklyVolumeKm: 16, longestCurrentRunMin: 30, realisticTrainingDaysPerWeek: 4, userTrainingContext: "Vil tilbage til stabile længere ture." }, { distance: "Halvmaraton", goalType: "complete", weeks: 20, availableTrainingDays: ["Mandag", "Tirsdag", "Torsdag", "Sondag"] }),
  profileFixture("profile-36", "Marathon durable finish, 3x/week", { runningExperience: "ovet", currentRunningAbility: "mere_end_tredive_min", currentRunsPerWeek: 3, currentWeeklyVolumeKm: 34, longestCurrentRunMin: 90, realisticTrainingDaysPerWeek: 3, typicalWorkoutMinutes: 75 }, { distance: "Marathon", goalType: "complete", weeks: 20 }),
  profileFixture("profile-37", "Marathon cautious complete, 2x/week", { onboardingTrack: "returning", currentContinuousDistanceKm: 8, runningExperience: "let_ovet", currentRunningAbility: "tyve_tredive_min", currentRunsPerWeek: 2, currentWeeklyVolumeKm: 24, longestCurrentRunMin: 70, realisticTrainingDaysPerWeek: 2, typicalWorkoutMinutes: 75, injuryHistory: "Vil hellere underbygge end forcere." }, { distance: "Marathon", goalType: "complete", weeks: 22, availableTrainingDays: ["Onsdag", "Sondag"] }, { lowFrequencyOverrideAccepted: true }),
  profileFixture("profile-38", "Ambitious marathon target pace, 4x/week", { runningExperience: "ovet", currentRunningAbility: "mere_end_tredive_min", currentRunsPerWeek: 4, currentWeeklyVolumeKm: 56, longestCurrentRunMin: 130, realisticTrainingDaysPerWeek: 4, typicalWorkoutMinutes: 85, preferredGuidance: "performance_oriented" }, { distance: "Marathon", goalType: "target_time", targetTime: "2:48:40", targetPaceSecPerKm: 240, weeks: 20, availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"] }),
  profileFixture("profile-39", "Marathon PR experienced, 4x/week", { runningExperience: "ovet", currentRunningAbility: "mere_end_tredive_min", currentRunsPerWeek: 4, currentWeeklyVolumeKm: 60, longestCurrentRunMin: 140, realisticTrainingDaysPerWeek: 4, typicalWorkoutMinutes: 90, preferredGuidance: "performance_oriented" }, { distance: "Marathon", goalType: "pr", weeks: 20, availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"] }),
  profileFixture("profile-40", "Older 5K PR, 3x/week", { age: 59, runningExperience: "let_ovet", currentRunningAbility: "tyve_tredive_min", currentRunsPerWeek: 3, currentWeeklyVolumeKm: 18, longestCurrentRunMin: 34 }, { distance: "5K", goalType: "pr", weeks: 12 }),
  profileFixture("profile-41", "Nervous 10K beginner, 3x/week", { runningExperience: "nybegynder", currentRunningAbility: "fem_min", currentRunsPerWeek: 2, currentWeeklyVolumeKm: 6, longestCurrentRunMin: 12, activityLevel: "lav", userTrainingContext: "Vil frem mod en tryg 10 km progression." }, { distance: "10K", goalType: "complete", weeks: 16 }),
  profileFixture("profile-42", "Fit but inexperienced half, 4x/week (extended)", { onboardingTrack: "running_consistently", currentContinuousDistanceKm: 9, runningExperience: "let_ovet", currentRunningAbility: "tyve_tredive_min", currentRunsPerWeek: 4, currentWeeklyVolumeKm: 26, longestCurrentRunMin: 55, otherTraining: "Cykler lidt ved siden af." }, { distance: "Halvmaraton", goalType: "complete", weeks: 20, availableTrainingDays: ["Mandag", "Tirsdag", "Torsdag", "Sondag"] }, { durationScenario: "longer_override" }),
  profileFixture("profile-43", "Advanced marathon complete, 4x/week", { runningExperience: "ovet", currentRunningAbility: "mere_end_tredive_min", currentRunsPerWeek: 4, currentWeeklyVolumeKm: 62, longestCurrentRunMin: 145, realisticTrainingDaysPerWeek: 4, typicalWorkoutMinutes: 90 }, { distance: "Marathon", goalType: "complete", weeks: 22, availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"] }),
  profileFixture("profile-44", "5K target time comeback, 3x/week", { runningExperience: "let_ovet", currentRunningAbility: "ti_femten_min", currentRunsPerWeek: 3, currentWeeklyVolumeKm: 14, longestCurrentRunMin: 24, injuryHistory: "Tilbage efter vinterpause." }, { distance: "5K", goalType: "target_time", targetTime: "27:30", weeks: 12 }),
  profileFixture("profile-45", "Cautious 5K run without walking, 2x/week", { runningExperience: "nybegynder", currentRunningAbility: "fem_min", currentRunsPerWeek: 2, currentWeeklyVolumeKm: 5, longestCurrentRunMin: 11, realisticTrainingDaysPerWeek: 2, activityLevel: "lav", injuryHistory: "Har brug for en meget rolig tilbagevenden.", userTrainingContext: "Vil gerne kunne lobe 5 km uden walk breaks i et trygt tempo." }, { distance: "5K", goalType: "run_without_walking", weeks: 12, availableTrainingDays: ["Onsdag", "Sondag"] }),
  profileFixture("profile-46", "Low-frequency 10K finish, 2x/week", { onboardingTrack: "goal_focused", currentContinuousDistanceKm: 3, runningExperience: "let_ovet", currentRunningAbility: "ti_femten_min", currentRunsPerWeek: 2, currentWeeklyVolumeKm: 9, longestCurrentRunMin: 18, realisticTrainingDaysPerWeek: 2, typicalWorkoutMinutes: 42, userTrainingContext: "Har kun plads til to stabile pas om ugen, men vil na frem til en rolig 10 km." }, { distance: "10K", goalType: "complete", weeks: 18, availableTrainingDays: ["Tirsdag", "Sondag"] }, { durationScenario: "recommended" }),
  profileFixture("profile-47", "Novice 10K target time, 4x/week", { runningExperience: "ovet", currentRunningAbility: "mere_end_tredive_min", currentRunsPerWeek: 4, currentWeeklyVolumeKm: 34, longestCurrentRunMin: 60, realisticTrainingDaysPerWeek: 4, typicalWorkoutMinutes: 60, recentRaceTimes: [{ distance: "10K", time: "50:15" }], preferredGuidance: "performance_oriented", userTrainingContext: "Vil gerne lobet mere struktureret mod en skarpere 10 km tid." }, { distance: "10K", goalType: "target_time", targetTime: "46:45", weeks: 14, availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"] }),
  profileFixture("profile-48", "Comeback half complete, 3x/week", { runningExperience: "let_ovet", currentRunningAbility: "ti_femten_min", currentRunsPerWeek: 3, currentWeeklyVolumeKm: 17, longestCurrentRunMin: 34, realisticTrainingDaysPerWeek: 3, injuryHistory: "Tilbage efter laengere sygdomspause.", userTrainingContext: "Vil bygge sikkert op til et halvmaraton igen uden at forcere." }, { distance: "Halvmaraton", goalType: "complete", weeks: 20 }),
  profileFixture("profile-49", "Ambitious half target pace, 4x/week", { runningExperience: "ovet", currentRunningAbility: "mere_end_tredive_min", currentRunsPerWeek: 4, currentWeeklyVolumeKm: 52, longestCurrentRunMin: 108, realisticTrainingDaysPerWeek: 4, typicalWorkoutMinutes: 76, recentRaceTimes: [{ distance: "Halvmaraton", time: "1:29:40" }], preferredGuidance: "performance_oriented", userTrainingContext: "Vil presse forsigtigt pa mod et hurtigt halvmaraton omkring 4:00 pr km." }, { distance: "Halvmaraton", goalType: "target_time", targetTime: "1:24:24", targetPaceSecPerKm: 240, weeks: 18, availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"] }),
  profileFixture("profile-50", "Experienced marathon PR, 4x/week (high volume)", { onboardingTrack: "goal_focused", currentContinuousDistanceKm: 22, runningExperience: "ovet", currentRunningAbility: "mere_end_tredive_min", currentRunsPerWeek: 4, currentWeeklyVolumeKm: 66, longestCurrentRunMin: 150, realisticTrainingDaysPerWeek: 4, typicalWorkoutMinutes: 92, recentRaceTimes: [{ distance: "Marathon", time: "3:18:00" }], preferredGuidance: "performance_oriented", userTrainingContext: "Stabil erfaren lobertype med fokus pa en ny maraton-PR." }, { distance: "Marathon", goalType: "pr", weeks: 22, availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"] }, { durationScenario: "longer_override" }),
];

export const benchmarkReportFixtures: BenchmarkReportFixture[] = [...foundationalFixtures, ...expandedFixtures];

function addDaysToIsoDate(dateIso: string, days: number): string {
  const date = new Date(`${dateIso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function goalIntent(goal: Goal): CoachGoalIntent {
  if (goal.goalType === "target_time") return "target_time";
  if (goal.goalType === "pr") return "improve";
  if (goal.goalType === "run_without_walking") return "finish_comfortably";
  return "finish";
}

function toCoachGoalConfig(goal: Goal, profile: AppRunnerProfile): CoachGoalConfig {
  const requestedRuns = goal.availableTrainingDays?.length || profile.realisticTrainingDaysPerWeek || profile.currentRunsPerWeek || 3;
  const preferredTrainingDays = goal.availableTrainingDays?.map((day) => {
    if (day === "Mandag") return "monday";
    if (day === "Tirsdag") return "tuesday";
    if (day === "Onsdag") return "wednesday";
    if (day === "Torsdag") return "thursday";
    if (day === "Fredag") return "friday";
    if (day === "Lordag") return "saturday";
    return "sunday";
  });

  return {
    goalDistance: goal.distance,
    goalIntent: goalIntent(goal),
    targetDate: goal.endDate ?? addDaysToIsoDate(goal.startDate, Math.max(1, goal.weeks - 1) * 7),
    trainingDaysPerWeek: Math.max(2, Math.min(4, requestedRuns)) as 2 | 3 | 4,
    startDate: goal.startDate,
    targetTime: goal.targetTime,
    targetPaceSecPerKm: goal.targetPaceSecPerKm,
    preferredTrainingDays,
    preferredLongRunDay: goal.preferredLongRunDay === "saturday" || goal.preferredLongRunDay === "sunday" ? goal.preferredLongRunDay : "flexible",
  };
}

function buildCoachPlan(fixture: BenchmarkReportFixture): { coachPlan: CoachTrainingPlan; appPlan: ReturnType<typeof mapCoachPlanToAppPlan>; coachProfile: ReturnType<typeof interpretRunnerProfile> } {
  const coachProfile = interpretRunnerProfile({
    onboardingTrack: fixture.runnerProfile.onboardingTrack,
    onboardingText: fixture.runnerProfile.userTrainingContext,
    injuryHistory: fixture.runnerProfile.injuryHistory,
    weakPoints: fixture.runnerProfile.weakPoints,
    otherTraining: fixture.runnerProfile.otherTraining,
    currentAbility: fixture.runnerProfile.currentRunningAbility,
    goalDistance: fixture.goal.distance,
    goalTime: fixture.goal.targetTime,
    goalType: fixture.goal.goalType,
    activityLevel: fixture.runnerProfile.activityLevel,
    currentRunsPerWeek: fixture.runnerProfile.currentRunsPerWeek,
    currentWeeklyVolumeKm: fixture.runnerProfile.currentWeeklyVolumeKm,
    longestRunMinutes: fixture.runnerProfile.longestCurrentRunMin,
    realisticTrainingDaysPerWeek: fixture.runnerProfile.realisticTrainingDaysPerWeek,
    typicalWorkoutMinutes: fixture.runnerProfile.typicalWorkoutMinutes,
    preferredGuidance: fixture.runnerProfile.preferredGuidance,
  });
  const coachPlan = buildGoalPlan(coachProfile, toCoachGoalConfig(fixture.goal, fixture.runnerProfile));
  const mappedPlan = mapCoachPlanToAppPlan(coachPlan, coachPlan.goal);
  const alignedPlan = enforceAvailableTrainingDays(mappedPlan, fixture.goal.availableTrainingDays).plan;
  const appPlan = applyPlanSafety({ plan: alignedPlan, goal: fixture.goal, recentFeedback: [] }).plan;
  return {
    coachPlan,
    appPlan,
    coachProfile,
  };
}

function structureSummary(session: AppWorkoutSession): string {
  return summarizeWorkoutSteps(session.steps);
}

function isIntervalType(type: CoachWorkoutSession["type"]): boolean {
  return ["interval", "tempo", "strides", "fartlek", "hill-reps", "benchmark", "race-specific"].includes(type);
}

function shouldFlagShortWork(type: CoachWorkoutSession["type"]): boolean {
  return ["interval", "tempo", "fartlek", "hill-reps", "benchmark", "race-specific"].includes(type);
}

function aggressiveHeartRateZone(zoneLabel?: string): boolean {
  if (!zoneLabel) return false;
  return zoneLabel.includes("Zone 4") || zoneLabel.includes("Zone 5");
}

function hasOddAdjacentIdenticalBlocks(steps: WorkoutStep[]): boolean {
  for (let index = 1; index < steps.length; index += 1) {
    const prev = steps[index - 1];
    const current = steps[index];
    if (prev.type === current.type && prev.cue === current.cue && prev.type === "run") return true;
  }
  return false;
}

function analyzeSessionShape(
  appSession: AppWorkoutSession,
  coachSession: CoachWorkoutSession,
  renderedSession: Pick<BenchmarkSessionReport, "durationMin" | "structureSummary" | "steps">,
) {
  const isIntervalSession = isIntervalType(coachSession.type);
  const workBlocks = appSession.steps.filter((step) => step.type === "run").map((step) => ({
    label: step.label,
    durationSec: step.durationSec,
    zoneLabel: step.heartRateGuidance?.zoneLabel,
  }));
  const recoveryBlocks = appSession.steps.filter((step) => step.type === "walk").map((step) => ({
    label: step.label,
    durationSec: step.durationSec,
    zoneLabel: step.heartRateGuidance?.zoneLabel,
  }));
  const notes: string[] = [];
  const hasCoachingMismatch =
    (coachSession.type === "run-walk" && workBlocks.some((block) => aggressiveHeartRateZone(block.zoneLabel))) ||
    (!isIntervalSession && coachSession.type !== "run-walk" && workBlocks.some((block) => aggressiveHeartRateZone(block.zoneLabel)));

  if (shouldFlagShortWork(coachSession.type) && workBlocks.every((block) => block.durationSec <= 90)) {
    notes.push("Arbejdsblokkene er meget korte.");
  }
  if (shouldFlagShortWork(coachSession.type) && recoveryBlocks.some((block) => block.durationSec < 45)) {
    notes.push("Recovery-blokkene er meget korte.");
  }
  if (!isIntervalSession && hasOddAdjacentIdenticalBlocks(appSession.steps)) notes.push("Sammenhaengende loeb er delt op pa en unaturlig made.");
  if (hasCoachingMismatch) notes.push("Puls-guidance matcher ikke sessionens rolige intention.");
  if (hasMaterialSessionShapeMismatch(renderedSession)) {
    notes.push("Sessionens metadata og faktiske step-varighed driver fra hinanden.");
  }
  return {
    isIntervalSession,
    workBlocks,
    recoveryBlocks,
    hasCoachingMismatch,
    notes,
  };
}

function currentLevelLabel(ability: AppRunnerProfile["currentRunningAbility"]): string {
  if (ability === "helt_ny") return "Helt ny";
  if (ability === "fem_min") return "Ca. 5 min sammenhaengende";
  if (ability === "ti_femten_min") return "Ca. 10-15 min sammenhaengende";
  if (ability === "tyve_tredive_min") return "Ca. 20-30 min sammenhaengende";
  return "30+ min sammenhaengende";
}

function roundTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function runningMinutes(steps: WorkoutStep[]): number {
  return roundTenth(steps.filter((step) => step.type !== "walk").reduce((sum, step) => sum + step.durationSec / 60, 0));
}

function totalWeekRunningMinutes(sessions: SessionBundle[]): number {
  return roundTenth(sessions.reduce((sum, session) => sum + session.runMinutes, 0));
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function dayIndex(day: AppWorkoutSession["dayOfWeek"]): number {
  return DAYS.indexOf(day);
}

function distanceSignal(distance: Goal["distance"]): string {
  if (distance === "5K") return "5 km";
  if (distance === "10K") return "10 km";
  if (distance === "Halvmaraton") return "halvmaraton";
  return "marathon";
}

function hasExplicitDestinationSemantics(session: SessionBundle, distance: Goal["distance"]): boolean {
  const title = session.coachSession.title.toLowerCase();
  return (
    session.coachSession.type === "benchmark" ||
    session.coachSession.type === "race-specific" ||
    title.includes("benchmark") ||
    title.includes("specifikt") ||
    title.includes(distanceSignal(distance))
  );
}

function isKeyWorkout(type: CoachWorkoutSession["type"]): boolean {
  return type === "long" || isIntervalType(type) || type === "progression" || type === "steady";
}

function destinationSessionRatio(distance: Goal["distance"]): number {
  if (distance === "5K") return 0.58;
  if (distance === "10K") return 0.65;
  if (distance === "Halvmaraton") return 0.72;
  return 0.8;
}

function taperWeekRatio(distance: Goal["distance"]): number {
  if (distance === "5K") return 0.28;
  if (distance === "10K") return 0.32;
  if (distance === "Halvmaraton") return 0.38;
  return 0.42;
}

interface SessionBundle {
  weekIndex: number;
  coachSession: CoachWorkoutSession;
  appSession: AppWorkoutSession;
  report: BenchmarkSessionReport;
  runMinutes: number;
}

interface BaseBenchmarkQualityDiagnostics {
  goalWeek: number;
  destinationSessionSummary: string | null;
  finalWeekSessionSummaries: string[];
  longestPriorRunMin: number;
  longestPriorKeyRunMin: number;
  goalDayRunMin: number;
  goalDaySessionType: string | null;
}

function isGoalEventLabel(session: SessionBundle): boolean {
  return /måldag/i.test(`${session.appSession.title} ${session.appSession.notes ?? ""}`);
}

function hasFrontLoadedDistribution(week: SessionBundle[], availableDays?: Goal["availableTrainingDays"]): boolean {
  if (!availableDays || availableDays.length < 5 || week.length < 3) return false;
  const used = [...new Set(week.map((session) => dayIndex(session.appSession.dayOfWeek)))].sort((a, b) => a - b);
  return used.length >= 3 && used.every((index) => index <= 3);
}

function hasWeekendAvailable(availableDays?: Goal["availableTrainingDays"]): boolean {
  return Boolean(availableDays?.includes("Lordag") || availableDays?.includes("Sondag"));
}

function scoreOutOfTen(base: number, deductions: number[]): number {
  return Math.max(1, Math.min(10, Math.round((base - deductions.reduce((sum, item) => sum + item, 0)) * 10) / 10));
}

function warningPenalty(warning: PlanQualityWarningType): number {
  if (warning === "race_day_label_bug" || warning === "silent_frequency_override") return 5;
  if (warning === "race_day_too_short") return 3.5;
  if (warning === "experienced_runner_underdosed") return 3;
  if (warning === "aggressive_progression_jump") return 2.5;
  if (warning === "mid_block_too_flat") return 2.5;
  if (warning === "track_signal_not_reflected_enough") return 2;
  if (warning === "front_loaded_distribution") return 1.75;
  if (warning === "taper_too_aggressive" || warning === "late_plan_collapse") return 2;
  return 1.5;
}

function isHardFailWarning(warning: PlanQualityWarningType): boolean {
  return warning === "race_day_label_bug" || warning === "silent_frequency_override" || warning === "race_day_too_short";
}

function verdictFromScores(params: {
  warnings: PlanQualityWarningType[];
  coachCredibilityScore: number;
  realismScore: number;
  safetyScore: number;
  labelTrustScore: number;
}): "pass" | "borderline" | "fail" {
  if (params.warnings.some(isHardFailWarning)) return "fail";
  if (params.labelTrustScore <= 5 || params.safetyScore <= 4.5) return "fail";
  if (params.coachCredibilityScore <= 5.5 || params.realismScore <= 5.5) return "fail";
  if (params.warnings.length >= 3) return "borderline";
  if (params.coachCredibilityScore < 7.5 || params.realismScore < 7 || params.safetyScore < 7) return "borderline";
  return "pass";
}

function inferTrackSignalGap(fixture: BenchmarkReportFixture, reports: BenchmarkSessionReport[]): boolean {
  const earlySessions = reports.filter((session) => session.sessionIndex >= 1).slice(0, 6);
  const hasRunWalk = earlySessions.some((session) => session.sessionType === "run-walk");
  const hasSteadyOrProgression = earlySessions.some((session) => session.sessionType === "steady" || session.sessionType === "progression");
  if (fixture.runnerProfile.onboardingTrack === "getting_started") return !hasRunWalk && !fixture.runnerProfile.injuryHistory;
  if (fixture.runnerProfile.onboardingTrack === "returning") return !hasRunWalk && !earlySessions.some((session) => /recovery/i.test(session.sessionLabel));
  if (fixture.runnerProfile.onboardingTrack === "running_consistently") return hasRunWalk && (fixture.runnerProfile.currentContinuousDistanceKm ?? 0) >= 5;
  if (fixture.runnerProfile.onboardingTrack === "goal_focused") return !hasSteadyOrProgression && fixture.goal.goalType !== "complete";
  return false;
}

function buildProgressionSignals(plan: ReturnType<typeof mapCoachPlanToAppPlan>, startDate: string) {
  const weeklyLoad = buildWeeklyLoad(plan, startDate);
  const buildWindow = weeklyLoad.filter((week) => week.week >= Math.max(2, Math.floor(plan.weeks * 0.25)) && week.week <= Math.max(3, Math.ceil(plan.weeks * 0.7)));
  const longRuns = buildWindow.map((week) => Math.round(week.longestContinuousRunSec / 60));
  const uniqueLongRuns = new Set(longRuns).size;
  const longRunRange = longRuns.length > 0 ? Math.max(...longRuns) - Math.min(...longRuns) : 0;
  const lighterWeekFound = buildWindow.some((week, index) => index > 0 && week.load < buildWindow[index - 1]!.load * 0.96);
  const aggressiveJumpFound = buildWindow.some((week, index) => {
    if (index === 0) return false;
    const previous = buildWindow[index - 1]!;
    const loadJumpPct = previous.load >= 18 ? (week.load - previous.load) / previous.load : 0;
    const longRunJumpMin = (week.longestContinuousRunSec - previous.longestContinuousRunSec) / 60;
    return loadJumpPct > 0.38 || (longRunJumpMin > 32 && loadJumpPct > 0.18);
  });
  const flat = buildWindow.length >= 4 && uniqueLongRuns < Math.min(4, buildWindow.length - 1) && longRunRange < 18 && !lighterWeekFound;
  return { weeklyLoad, buildWindow, flat, aggressiveJumpFound, longRunRange, uniqueLongRuns, lighterWeekFound };
}

function evaluatePlanWarnings(
  fixture: BenchmarkReportFixture,
  finalWeekSessions: SessionBundle[],
  priorSessions: SessionBundle[],
): { warnings: PlanQualityWarningType[]; diagnostics: BaseBenchmarkQualityDiagnostics } {
  const explicitDestination = [...finalWeekSessions].reverse().find((session) => hasExplicitDestinationSemantics(session, fixture.goal.distance)) ?? null;
  const destinationSession = explicitDestination ?? finalWeekSessions[finalWeekSessions.length - 1] ?? null;
  const longestPriorRunMin = roundTenth(Math.max(0, ...priorSessions.map((session) => session.runMinutes)));
  const longestPriorKeyRunMin = roundTenth(Math.max(0, ...priorSessions.filter((session) => session.report.isKeyWorkout).map((session) => session.runMinutes)));
  const goalDayRunMin = destinationSession ? destinationSession.runMinutes : 0;
  const priorWeekTotals = new Map<number, number>();

  priorSessions.forEach((session) => {
    const existing = priorWeekTotals.get(session.weekIndex) ?? 0;
    priorWeekTotals.set(session.weekIndex, existing + session.runMinutes);
  });

  const peakPriorWeekRunMin = roundTenth(Math.max(0, ...priorWeekTotals.values()));
  const goalWeekRunMin = totalWeekRunningMinutes(finalWeekSessions);
  const lateWindow = [...priorWeekTotals.entries()].filter(([weekIndex]) => weekIndex >= Math.max(1, finalWeekSessions[0]?.weekIndex - 2));
  const lateWindowPeak = roundTenth(Math.max(0, ...lateWindow.map(([, total]) => total)));
  const warnings = new Set<PlanQualityWarningType>();

  if (!explicitDestination) warnings.add("missing_destination_session");

  const comparisonRunMin = Math.max(longestPriorRunMin, longestPriorKeyRunMin);
  if (comparisonRunMin >= 20 && goalDayRunMin > 0 && goalDayRunMin < comparisonRunMin * destinationSessionRatio(fixture.goal.distance)) {
    warnings.add("race_day_too_short");
  }

  if (peakPriorWeekRunMin >= 40 && goalWeekRunMin < peakPriorWeekRunMin * taperWeekRatio(fixture.goal.distance)) {
    warnings.add("taper_too_aggressive");
  }

  if (peakPriorWeekRunMin >= 35 && lateWindowPeak < peakPriorWeekRunMin * 0.72) {
    warnings.add("late_plan_collapse");
  }

  const finalWeekKeySessions = finalWeekSessions.filter((session) => session.report.isKeyWorkout);
  if (
    finalWeekKeySessions.length > 2 ||
    (destinationSession && finalWeekKeySessions.some((session) => session !== destinationSession && isIntervalType(session.coachSession.type)))
  ) {
    warnings.add("goal_week_shape_mismatch");
  }

  if (
    finalWeekSessions.some((session) => session.report.intervalAnalysis.notes.length > 0) ||
    (destinationSession?.report.intervalAnalysis.notes.length ?? 0) > 0
  ) {
    warnings.add("session_shape_mismatch");
  }

  return {
    warnings: [...warnings],
    diagnostics: {
      goalWeek: finalWeekSessions[0]?.weekIndex ?? 0,
      destinationSessionSummary: destinationSession ? `${destinationSession.report.sessionLabel} — ${destinationSession.report.structureSummary}` : null,
      finalWeekSessionSummaries: finalWeekSessions.map((session) => `${session.report.sessionLabel} (${session.coachSession.type}) — ${session.report.structureSummary}`),
      longestPriorRunMin,
      longestPriorKeyRunMin,
      goalDayRunMin,
      goalDaySessionType: destinationSession?.coachSession.type ?? null,
    },
  };
}

export function buildBenchmarkReport(fixture: BenchmarkReportFixture): BenchmarkReport {
  const { coachPlan, appPlan, coachProfile } = buildCoachPlan(fixture);
  const sessionMap = new Map(appPlan.sessions.map((session) => [session.id, session]));
  const phaseSequence = coachPlan.weeks.map((week) => week.phase).filter((phase, index, phases) => index === 0 || phases[index - 1] !== phase);
  const weeklySessionCounts = coachPlan.weeks.map((week) => week.sessions.length);
  const longestWorkoutMin = Math.max(...coachPlan.sessions.map((session) => session.durationMin));
  const weekBundles = coachPlan.weeks.map((week) => ({
    weekIndex: week.weekNumber,
    phase: week.phase,
    sessions: week.sessions.map((coachSession, sessionIndex) => {
      const appSession = sessionMap.get(coachSession.id);
      if (!appSession) throw new Error(`Missing mapped app session for ${fixture.profileId}:${coachSession.id}`);
      const actualDurationMin = roundTenth(sumWorkoutStepDurationSec(appSession.steps) / 60);
      const report: BenchmarkSessionReport = {
        sessionIndex: sessionIndex + 1,
        sessionType: coachSession.type,
        sessionLabel: appSession.title.replace(/^Uge \d+ - /, ""),
        durationMin: actualDurationMin,
        isKeyWorkout: isKeyWorkout(coachSession.type),
        structureSummary: structureSummary(appSession),
        steps: appSession.steps.map((step) => ({
          type: step.type,
          label: step.label,
          durationSec: step.durationSec,
          cue: step.cue,
          heartRateGuidance: step.heartRateGuidance,
        })),
        intervalAnalysis: {
          isIntervalSession: false,
          workBlocks: [],
          recoveryBlocks: [],
          hasCoachingMismatch: false,
          notes: [],
        },
      };
      report.intervalAnalysis = analyzeSessionShape(appSession, coachSession, report);
      return {
        weekIndex: week.weekNumber,
        coachSession,
        appSession,
        report,
        runMinutes: runningMinutes(appSession.steps),
      } satisfies SessionBundle;
    }),
  }));

  const weeks = weekBundles.map((week) => ({
    weekIndex: week.weekIndex,
    phase: week.phase,
    sessions: week.sessions.map((session) => session.report),
  }));
  const allSessions = weekBundles.flatMap((week) => week.sessions);
  const allSessionReports = allSessions.map((session) => session.report);
  const finalWeekSessions = weekBundles[weekBundles.length - 1]?.sessions ?? [];
  const priorSessions = allSessions.filter((session) => session.weekIndex < (finalWeekSessions[0]?.weekIndex ?? 0));
  const { warnings: baseWarnings, diagnostics: baseDiagnostics } = evaluatePlanWarnings(fixture, finalWeekSessions, priorSessions);
  const warnings = new Set<PlanQualityWarningType>(baseWarnings);
  const findings: BenchmarkReport["findings"] = [];
  const selectedDaysPerWeek = fixture.goal.availableTrainingDays?.length ?? fixture.runnerProfile.realisticTrainingDaysPerWeek ?? fixture.runnerProfile.currentRunsPerWeek ?? 3;
  const hasSilentFrequencyOverride = weekBundles.some((week) => week.sessions.length > selectedDaysPerWeek);
  const hasFrontLoadedWeek = weekBundles.some((week) => hasFrontLoadedDistribution(week.sessions, fixture.goal.availableTrainingDays));
  const hasRaceDayLabelBug = allSessions.some((session) => isGoalEventLabel(session) && !hasExplicitDestinationSemantics(session, fixture.goal.distance));
  const progressionSignals = buildProgressionSignals(appPlan, fixture.goal.startDate);
  const hasUnderdosedExperiencedRunner =
    (fixture.runnerProfile.onboardingTrack === "running_consistently" || fixture.runnerProfile.onboardingTrack === "goal_focused" || fixture.runnerProfile.runningExperience === "ovet") &&
    ((fixture.runnerProfile.currentContinuousDistanceKm ?? 0) >= 8 || (fixture.runnerProfile.longestCurrentRunMin ?? 0) >= 60) &&
    (progressionSignals.weeklyLoad[0]?.longestContinuousRunSec ?? 0) / 60 < Math.max(25, (fixture.runnerProfile.longestCurrentRunMin ?? 0) * 0.45);
  const hasOvercautiousGoalFocusedPlan =
    fixture.runnerProfile.onboardingTrack === "goal_focused" &&
    (fixture.goal.goalType === "target_time" || fixture.goal.goalType === "pr") &&
    !coachPlan.sessions.some((session) => session.type === "steady" || session.type === "progression" || session.type === "tempo" || session.type === "interval");
  const hasTrackSignalGap = inferTrackSignalGap(fixture, allSessionReports);

  if (hasFrontLoadedWeek) warnings.add("front_loaded_distribution");
  if (hasSilentFrequencyOverride) warnings.add("silent_frequency_override");
  if (hasRaceDayLabelBug) warnings.add("race_day_label_bug");
  if (progressionSignals.flat) warnings.add("mid_block_too_flat");
  if (progressionSignals.aggressiveJumpFound) warnings.add("aggressive_progression_jump");
  if (hasUnderdosedExperiencedRunner) warnings.add("experienced_runner_underdosed");
  if (hasOvercautiousGoalFocusedPlan) warnings.add("overcautious_goal_focused_plan");
  if (hasTrackSignalGap) warnings.add("track_signal_not_reflected_enough");

  if (hasFrontLoadedWeek) findings.push({ code: "front_loaded_distribution", level: "warning", message: "Mindst en uge klumper passene tidligt i ugen trods bred availability.", whyItMatters: "Planen føles mindre naturlig og mindre coach-troværdig, når senere ugedage står ubrugt uden god grund." });
  if (hasSilentFrequencyOverride) findings.push({ code: "silent_frequency_override", level: "warning", message: "Planen bruger flere ugentlige pas end brugeren har valgt.", whyItMatters: "Det bryder tillid og gør guardrails omkring frekvens utroværdige." });
  if (hasRaceDayLabelBug) findings.push({ code: "race_day_label_bug", level: "warning", message: "En almindelig træningssession er mærket som måldag.", whyItMatters: "Det er en direkte trust-breaker, fordi sessionens identitet bliver åbenlyst forkert." });
  if (progressionSignals.flat) findings.push({ code: "mid_block_too_flat", level: "warning", message: "Midtblokken udvikler sig for lidt i load, langtur eller struktur.", whyItMatters: "Rolige planer må gerne være sikre, men de skal stadig føles levende og fremadgående." });
  if (progressionSignals.aggressiveJumpFound) findings.push({ code: "aggressive_progression_jump", level: "warning", message: "Der er mindst ét progressionstrin, som hopper for brat.", whyItMatters: "Store hop gør planen mindre robust og mindre fysiologisk troværdig." });
  if (hasUnderdosedExperiencedRunner) findings.push({ code: "experienced_runner_underdosed", level: "warning", message: "En erfaren eller stærk løber starter tydeligt under sit plausible niveau.", whyItMatters: "For lav dosering gør planen mindre troværdig og kan føles patroniserende." });
  if (hasOvercautiousGoalFocusedPlan) findings.push({ code: "overcautious_goal_focused_plan", level: "warning", message: "En målrettet profil får for lidt tydelig retning mod målet.", whyItMatters: "Goal-focused løbere bør stadig mærke struktur og retning, selv i en sikker plan." });
  if (hasTrackSignalGap) findings.push({ code: "track_signal_not_reflected_enough", level: "warning", message: "Planens tidlige posture afspejler ikke onboarding-track stærkt nok.", whyItMatters: "Track-valget mister produktværdi, hvis det ikke kan ses i planens start og tone." });
  if (!hasSilentFrequencyOverride && selectedDaysPerWeek === 2 && (fixture.goal.distance === "Halvmaraton" || fixture.goal.distance === "Marathon") && fixture.benchmarkSettings?.lowFrequencyOverrideAccepted) {
    findings.push({ code: "low_frequency_ambitious_but_respected", level: "info", message: "Ambitiøst lav frekvensvalg er respekteret uden skjult frekvensinflation.", whyItMatters: "Det viser, at guardrails advarer tydeligt uden at overrule brugerens eksplicitte valg." });
  }
  if ((fixture.benchmarkSettings?.durationScenario ?? "recommended") !== "recommended" && coachPlan.weeks.length === fixture.goal.weeks) {
    findings.push({ code: "duration_override_respected", level: "info", message: `Den valgte ${fixture.benchmarkSettings?.durationScenario === "shorter_override" ? "kortere" : "længere"} varighed er faktisk brugt i planen.`, whyItMatters: "Det er vigtigt, at anbefalet varighed og faktisk genereret varighed ikke driver fra hinanden." });
  }

  const warningList = [...warnings];
  const totalWarningPenalty = roundTenth(warningList.reduce((sum, warning) => sum + warningPenalty(warning), 0));
  const labelTrustScore = scoreOutOfTen(10, [
    hasRaceDayLabelBug ? 6 : 0,
    warnings.has("missing_destination_session") ? 2 : 0,
    warnings.has("race_day_too_short") ? 4 : 0,
  ]);
  const distributionScore = scoreOutOfTen(10, [hasFrontLoadedWeek ? 3.5 : 0, hasSilentFrequencyOverride ? 6 : 0, totalWarningPenalty * 0.1]);
  const progressionScore = scoreOutOfTen(10, [progressionSignals.flat ? 3.5 : 0, progressionSignals.aggressiveJumpFound ? 3 : 0, totalWarningPenalty * 0.08]);
  const realismScore = scoreOutOfTen(10, [hasUnderdosedExperiencedRunner ? 3.5 : 0, hasTrackSignalGap ? 2.5 : 0, warnings.has("goal_week_shape_mismatch") ? 2 : 0, warnings.has("taper_too_aggressive") ? 2 : 0, warnings.has("race_day_too_short") ? 3 : 0, totalWarningPenalty * 0.12]);
  const safetyScore = scoreOutOfTen(10, [progressionSignals.aggressiveJumpFound ? 3 : 0, warnings.has("late_plan_collapse") ? 2.5 : 0, warnings.has("session_shape_mismatch") ? 2 : 0, warnings.has("taper_too_aggressive") ? 2 : 0, totalWarningPenalty * 0.1]);
  const coachCredibilityScore = scoreOutOfTen(10, [
    hasFrontLoadedWeek ? 2 : 0,
    progressionSignals.flat ? 2.5 : 0,
    hasRaceDayLabelBug ? 6 : 0,
    hasUnderdosedExperiencedRunner ? 3 : 0,
    hasTrackSignalGap ? 2.5 : 0,
    warnings.has("race_day_too_short") ? 4 : 0,
    warnings.has("silent_frequency_override") ? 6 : 0,
    totalWarningPenalty * 0.18,
  ]);
  const verdict = verdictFromScores({
    warnings: warningList,
    coachCredibilityScore,
    realismScore,
    safetyScore,
    labelTrustScore,
  });
  const diagnostics: BenchmarkQualityDiagnostics = {
    ...baseDiagnostics,
    coachCredibilityScore,
    realismScore,
    safetyScore,
    progressionScore,
    distributionScore,
    labelTrustScore,
    verdict,
  };

  return {
    profileId: fixture.profileId,
    profileName: fixture.profileName,
    profileSummary: {
      goalDistance: fixture.goal.distance,
      goalType: fixture.goal.goalType ?? "complete",
      daysPerWeek: fixture.goal.availableTrainingDays?.length ?? fixture.runnerProfile.realisticTrainingDaysPerWeek ?? fixture.runnerProfile.currentRunsPerWeek ?? 3,
      currentLevel: currentLevelLabel(fixture.runnerProfile.currentRunningAbility),
      archetype: coachProfile.archetype,
      onboardingTrack: fixture.runnerProfile.onboardingTrack ?? null,
      currentContinuousDistanceKm: fixture.runnerProfile.currentContinuousDistanceKm ?? null,
      durationScenario: fixture.benchmarkSettings?.durationScenario ?? "recommended",
      lowFrequencyOverrideAccepted: fixture.benchmarkSettings?.lowFrequencyOverrideAccepted ?? false,
      notes: fixture.runnerProfile.userTrainingContext || "Ingen ekstra noter.",
    },
    planSummary: {
      totalWeeks: coachPlan.weeks.length,
      phaseSequence,
      weeklySessionCounts,
      longestWorkoutMin,
      hasIntervals: coachPlan.sessions.some((session) => isIntervalType(session.type)),
      verdict,
    },
    qualityDiagnostics: diagnostics,
    warnings: [...warnings],
    findings,
    weeks,
    flags: {
      hasOddAdjacentIdenticalBlocks: allSessions.some((session) => session.report.intervalAnalysis.notes.includes("Sammenhaengende loeb er delt op pa en unaturlig made.")),
      hasVeryShortWorkIntervals: allSessions.some((session) => shouldFlagShortWork(session.coachSession.type) && session.report.intervalAnalysis.workBlocks.some((block) => block.durationSec < 60)),
      hasVeryShortRecoveries: allSessions.some((session) => shouldFlagShortWork(session.coachSession.type) && session.report.intervalAnalysis.recoveryBlocks.some((block) => block.durationSec < 45)),
      hasCoachingMismatch: allSessions.some((session) => session.report.intervalAnalysis.hasCoachingMismatch),
      hasSuspiciousSessionShapes: allSessions.some((session) => session.report.intervalAnalysis.notes.length > 0),
      hasFrontLoadedWeek,
      hasSilentFrequencyOverride,
      hasRaceDayLabelBug,
      hasSuspiciousFlatBlock: progressionSignals.flat,
      hasAggressiveProgressionJump: progressionSignals.aggressiveJumpFound,
      hasUnderdosedExperiencedRunner,
      hasOvercautiousGoalFocusedPlan,
      hasCoachCredibilityConcern: verdict !== "pass",
    },
  };
}

export function buildBenchmarkReports(fixtures: BenchmarkReportFixture[] = benchmarkReportFixtures): BenchmarkReport[] {
  return fixtures.map(buildBenchmarkReport);
}

export function buildPlanQualitySummary(reports: BenchmarkReport[]): PlanQualitySummaryReport {
  const warningTypes = Object.fromEntries(WARNING_TYPES.map((type) => [type, 0])) as Record<PlanQualityWarningType, number>;
  const recurringIssueCounts = new Map<string, number>();
  const verdictCounts = { pass: 0, borderline: 0, fail: 0 };

  reports.forEach((report) => {
    report.warnings.forEach((warning) => {
      warningTypes[warning] += 1;
    });
    report.findings.forEach((finding) => {
      recurringIssueCounts.set(finding.code, (recurringIssueCounts.get(finding.code) ?? 0) + 1);
    });
    verdictCounts[report.qualityDiagnostics.verdict] += 1;
  });

  const averageScores = {
    coachCredibilityScore: roundTenth(reports.reduce((sum, report) => sum + report.qualityDiagnostics.coachCredibilityScore, 0) / reports.length),
    realismScore: roundTenth(reports.reduce((sum, report) => sum + report.qualityDiagnostics.realismScore, 0) / reports.length),
    safetyScore: roundTenth(reports.reduce((sum, report) => sum + report.qualityDiagnostics.safetyScore, 0) / reports.length),
    progressionScore: roundTenth(reports.reduce((sum, report) => sum + report.qualityDiagnostics.progressionScore, 0) / reports.length),
    distributionScore: roundTenth(reports.reduce((sum, report) => sum + report.qualityDiagnostics.distributionScore, 0) / reports.length),
    labelTrustScore: roundTenth(reports.reduce((sum, report) => sum + report.qualityDiagnostics.labelTrustScore, 0) / reports.length),
  };

  return {
    profilesTested: reports.length,
    profilesWithWarnings: reports.filter((report) => report.warnings.length > 0).length,
    verdictCounts,
    warningTypes,
    averageScores,
    recurringIssueCategories: [...recurringIssueCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([code, count]) => ({ code, count })),
    worstProfiles: [...reports]
      .sort((left, right) => left.qualityDiagnostics.coachCredibilityScore - right.qualityDiagnostics.coachCredibilityScore)
      .slice(0, 5)
      .map((report) => ({
        profileId: report.profileId,
        profileName: report.profileName,
        coachCredibilityScore: report.qualityDiagnostics.coachCredibilityScore,
        warnings: report.warnings,
      })),
    profilesForReviewFirst: [...reports]
      .filter((report) => report.qualityDiagnostics.verdict !== "pass")
      .sort((left, right) => left.qualityDiagnostics.coachCredibilityScore - right.qualityDiagnostics.coachCredibilityScore)
      .slice(0, 8)
      .map((report) => ({
        profileId: report.profileId,
        profileName: report.profileName,
        verdict: report.qualityDiagnostics.verdict,
        warnings: report.warnings,
      })),
    profiles: reports.map((report) => ({
      profileId: report.profileId,
      profileName: report.profileName,
      goalDistance: report.profileSummary.goalDistance,
      goalType: report.profileSummary.goalType,
      daysPerWeek: report.profileSummary.daysPerWeek,
      archetype: report.profileSummary.archetype,
      warnings: report.warnings,
      planSummary: {
        totalWeeks: report.planSummary.totalWeeks,
        goalWeek: report.qualityDiagnostics.goalWeek,
        longestPriorRunMin: report.qualityDiagnostics.longestPriorRunMin,
        longestPriorKeyRunMin: report.qualityDiagnostics.longestPriorKeyRunMin,
        goalDayRunMin: report.qualityDiagnostics.goalDayRunMin,
        coachCredibilityScore: report.qualityDiagnostics.coachCredibilityScore,
        verdict: report.qualityDiagnostics.verdict,
      },
      destinationSessionSummary: report.qualityDiagnostics.destinationSessionSummary,
      finalWeekSessionSummaries: report.qualityDiagnostics.finalWeekSessionSummaries,
    })),
  };
}

function padTimestampPart(value: number): string {
  return `${value}`.padStart(2, "0");
}

export function formatBenchmarkRunTimestamp(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = padTimestampPart(date.getMonth() + 1);
  const day = padTimestampPart(date.getDate());
  const hours = padTimestampPart(date.getHours());
  const minutes = padTimestampPart(date.getMinutes());
  const seconds = padTimestampPart(date.getSeconds());
  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}

export function createTimestampedBenchmarkOutputDir(rootDir: string, date: Date = new Date()): string {
  fs.mkdirSync(rootDir, { recursive: true });
  let attempt = 0;
  let outputDir = path.join(rootDir, formatBenchmarkRunTimestamp(date));
  while (fs.existsSync(outputDir)) {
    attempt += 1;
    outputDir = path.join(rootDir, `${formatBenchmarkRunTimestamp(date)}_${String(attempt).padStart(2, "0")}`);
  }
  fs.mkdirSync(outputDir, { recursive: true });
  return outputDir;
}

export function writeBenchmarkReports(outputDir: string, fixtures: BenchmarkReportFixture[] = benchmarkReportFixtures): BenchmarkReport[] {
  const reports = buildBenchmarkReports(fixtures);
  const summary = buildPlanQualitySummary(reports);
  fs.mkdirSync(outputDir, { recursive: true });

  const index = reports.map((report, index) => ({
    profileId: report.profileId,
    profileName: report.profileName,
    file: `profile-${String(index + 1).padStart(2, "0")}-${slugify(report.profileName)}.json`,
    hasIntervals: report.planSummary.hasIntervals,
    warnings: report.warnings,
    flags: report.flags,
  }));

  index.forEach((entry, reportIndex) => {
    fs.writeFileSync(path.join(outputDir, entry.file), `${JSON.stringify(reports[reportIndex], null, 2)}\n`, "utf8");
  });
  fs.writeFileSync(path.join(outputDir, "index.json"), `${JSON.stringify(index, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(outputDir, "plan-quality-summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  return reports;
}
