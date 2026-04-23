import {
  buildBenchmarkWorkout,
  buildEasyWorkout,
  buildFartlekWorkout,
  buildHillWorkout,
  buildIntervalWorkout,
  buildLongWorkout,
  buildProgressionWorkout,
  buildRaceSpecificWorkout,
  buildRecoveryWorkout,
  buildRunWalkWorkout,
  buildSteadyWorkout,
  buildStridesWorkout,
  buildTempoWorkout,
  WorkoutBuildContext,
} from "./workouts";
import { buildPlanRationale, buildWeekRationales, buildWorkoutRationales, generatePlanExplanation } from "./explanations";
import { AmbitionAdjustmentRationale, GoalConfig, GoalDistance, GoalIntent, PlanAdjustment, RunnerProfile, TrainingPlan, TrainingWeek, WorkoutSession, WorkoutType } from "./types";
import { choosePlanType, classifyRunnerCategory } from "./classification";
import { buildTenKDistancePlan } from "./buildTenKDistancePlan";
import { deriveCalendarWeekCount, planStartWeekMonday } from "../calendar-week";
import { orderTrainingDaysForLongRun } from "./week-structure";
import { buildCapacityInterpretationPolicy, buildEarlyWeekRealismPolicy, buildEntryRealismPolicy, buildProgressionRealismPolicy, buildTrackPosturePolicy, ContinuityBand } from "./realismPolicy";
import { firstSessionPolicy, runWalkMeaningfulRunningPolicy } from "./beginnerOnboardingPolicy";

type LegacyPlanPhase = "introduction" | "continuous_running" | "capacity" | "race_preparation";

const DISTANCE_PROFILE: Record<
  GoalDistance,
  {
    minWeeks: number;
    phaseShares: (totalWeeks: number) => Record<LegacyPlanPhase, number>;
    continuousPeak: { min: number; max: number };
    longRunPeak: { min: number; max: number };
    intervalPeak: { min: number; max: number };
    repeatsPeak: { min: number; max: number };
    taperFactorFinal: number;
  }
> = {
  "5K": {
    minWeeks: 6,
    phaseShares: (totalWeeks) =>
      totalWeeks <= 8
        ? { introduction: 0.25, continuous_running: 0.3, capacity: 0.25, race_preparation: 0.2 }
        : { introduction: 0.22, continuous_running: 0.33, capacity: 0.28, race_preparation: 0.17 },
    continuousPeak: { min: 30, max: 55 },
    longRunPeak: { min: 45, max: 80 },
    intervalPeak: { min: 4, max: 8 },
    repeatsPeak: { min: 5, max: 8 },
    taperFactorFinal: 0.72,
  },
  "10K": {
    minWeeks: 8,
    phaseShares: (totalWeeks) =>
      totalWeeks <= 10
        ? { introduction: 0.2, continuous_running: 0.32, capacity: 0.28, race_preparation: 0.2 }
        : { introduction: 0.18, continuous_running: 0.34, capacity: 0.3, race_preparation: 0.18 },
    continuousPeak: { min: 40, max: 75 },
    longRunPeak: { min: 60, max: 105 },
    intervalPeak: { min: 5, max: 10 },
    repeatsPeak: { min: 5, max: 9 },
    taperFactorFinal: 0.74,
  },
  Halvmaraton: {
    minWeeks: 10,
    phaseShares: (totalWeeks) =>
      totalWeeks <= 12
        ? { introduction: 0.18, continuous_running: 0.34, capacity: 0.3, race_preparation: 0.18 }
        : { introduction: 0.16, continuous_running: 0.36, capacity: 0.3, race_preparation: 0.18 },
    continuousPeak: { min: 50, max: 90 },
    longRunPeak: { min: 80, max: 150 },
    intervalPeak: { min: 6, max: 12 },
    repeatsPeak: { min: 5, max: 10 },
    taperFactorFinal: 0.76,
  },
  Marathon: {
    minWeeks: 12,
    phaseShares: () => ({ introduction: 0.16, continuous_running: 0.38, capacity: 0.3, race_preparation: 0.16 }),
    continuousPeak: { min: 60, max: 105 },
    longRunPeak: { min: 110, max: 200 },
    intervalPeak: { min: 6, max: 14 },
    repeatsPeak: { min: 4, max: 8 },
    taperFactorFinal: 0.78,
  },
};

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dayOffset(day: WorkoutSession["dayOfWeek"]): number {
  if (day === "monday") return 0;
  if (day === "tuesday") return 1;
  if (day === "wednesday") return 2;
  if (day === "thursday") return 3;
  if (day === "friday") return 4;
  if (day === "saturday") return 5;
  return 6;
}

function deriveTotalWeeks(goal: GoalConfig): number {
  const distanceMinWeeks = DISTANCE_PROFILE[goal.goalDistance].minWeeks;
  return Math.max(distanceMinWeeks, deriveCalendarWeekCount(goal.startDate, goal.targetDate) ?? distanceMinWeeks);
}

function roundHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function intentAggressiveness(intent: GoalIntent): number {
  if (intent === "finish") return 0.15;
  if (intent === "finish_comfortably") return 0.32;
  if (intent === "improve") return 0.68;
  return 1;
}

function phaseTargetShares(goal: GoalConfig, totalWeeks: number): Record<LegacyPlanPhase, number> {
  return DISTANCE_PROFILE[goal.goalDistance].phaseShares(totalWeeks);
}

function allocatePhases(goal: GoalConfig, totalWeeks: number): Record<LegacyPlanPhase, number> {
  const shares = phaseTargetShares(goal, totalWeeks);
  const minByPhase: Record<LegacyPlanPhase, number> = {
    introduction: totalWeeks <= 6 ? 1 : 2,
    continuous_running: totalWeeks <= 6 ? 2 : 2,
    capacity: goal.goalIntent === "finish" && totalWeeks <= 8 ? 1 : 2,
    race_preparation: 1,
  };

  const allocation: Record<LegacyPlanPhase, number> = {
    introduction: 0,
    continuous_running: 0,
    capacity: 0,
    race_preparation: 0,
  };

  let remaining = totalWeeks;

  (Object.keys(minByPhase) as LegacyPlanPhase[]).forEach((phase) => {
    allocation[phase] = minByPhase[phase];
    remaining -= minByPhase[phase];
  });

  if (remaining < 0) {
    const ordered: LegacyPlanPhase[] = ["introduction", "continuous_running", "capacity", "race_preparation"];
    while (remaining < 0) {
      const phase = ordered.find((entry) => allocation[entry] > 1);
      if (!phase) break;
      allocation[phase] -= 1;
      remaining += 1;
    }
    return allocation;
  }

  const fractions: Array<{ phase: LegacyPlanPhase; fraction: number }> = [];
  (Object.keys(shares) as LegacyPlanPhase[]).forEach((phase) => {
    const desired = totalWeeks * shares[phase];
    const extra = Math.max(0, desired - allocation[phase]);
    const whole = Math.floor(extra);
    allocation[phase] += whole;
    remaining -= whole;
    fractions.push({ phase, fraction: extra - whole });
  });

  fractions.sort((a, b) => b.fraction - a.fraction);
  for (const entry of fractions) {
    if (remaining <= 0) break;
    allocation[entry.phase] += 1;
    remaining -= 1;
  }

  return allocation;
}

function buildPhaseTimeline(goal: GoalConfig, totalWeeks: number): LegacyPlanPhase[] {
  const allocation = allocatePhases(goal, totalWeeks);
  const timeline: LegacyPlanPhase[] = [];

  (["introduction", "continuous_running", "capacity", "race_preparation"] as LegacyPlanPhase[]).forEach((phase) => {
    for (let count = 0; count < allocation[phase]; count += 1) {
      timeline.push(phase);
    }
  });

  return timeline.slice(0, totalWeeks);
}

function countPhaseWeeks(timeline: LegacyPlanPhase[], phase: LegacyPlanPhase): number {
  return timeline.filter((entry) => entry === phase).length;
}

function phaseWeekIndex(timeline: LegacyPlanPhase[], weekNumber: number): number {
  const phase = timeline[weekNumber - 1];
  let count = 0;
  for (let index = 0; index < weekNumber; index += 1) {
    if (timeline[index] === phase) count += 1;
  }
  return count;
}

function progressRatio(weekNumber: number, totalWeeks: number): number {
  if (totalWeeks <= 1) return 1;
  return (weekNumber - 1) / (totalWeeks - 1);
}

function beginnerSafe(profile: RunnerProfile): boolean {
  return (
    profile.runningSpecificity <= 2 ||
    profile.currentRunsPerWeek <= 2 ||
    profile.currentWeeklyVolumeKm <= 15 ||
    profile.injurySensitivity >= 4
  );
}

function beginnerContinuityBand(profile: RunnerProfile): ContinuityBand {
  const zeroBase =
    profile.currentRunsPerWeek === 0 &&
    profile.currentWeeklyVolumeKm === 0 &&
    profile.longestRunMinutes === 0 &&
    profile.runningSpecificity <= 1 &&
    profile.aerobicBase <= 1;

  if (zeroBase) return "ultra_zero";

  if (
    profile.currentRunsPerWeek <= 1 &&
    profile.currentWeeklyVolumeKm <= 2 &&
    profile.longestRunMinutes <= 2 &&
    profile.runningSpecificity <= 1
  ) {
    return "one_to_two_min";
  }

  if (
    profile.currentRunsPerWeek <= 1 &&
    profile.currentWeeklyVolumeKm <= 5 &&
    profile.longestRunMinutes <= 5 &&
    profile.runningSpecificity <= 2
  ) {
    return "five_min";
  }

  return "established";
}

function strongBackground(profile: RunnerProfile, goal: GoalConfig): boolean {
  return (
    profile.currentWeeklyVolumeKm >= 35 ||
    profile.currentWeeklyVolumeKm >= 25 && goal.goalDistance !== "5K" ||
    profile.currentRunsPerWeek >= 3 && profile.longestRunMinutes >= 35 ||
    profile.currentRunsPerWeek >= 4 ||
    (goal.goalDistance === "Halvmaraton" || goal.goalDistance === "Marathon") && profile.longestRunMinutes >= 60
  );
}

function allowRunWalk(profile: RunnerProfile, goal: GoalConfig): boolean {
  if (beginnerContinuityBand(profile) !== "established") return true;
  if (strongBackground(profile, goal)) return false;
  if (goal.goalDistance === "10K" && (profile.currentRunsPerWeek >= 2 || profile.longestRunMinutes >= 30 || profile.currentWeeklyVolumeKm >= 12)) {
    return false;
  }
  if ((goal.goalDistance === "Halvmaraton" || goal.goalDistance === "Marathon") && profile.currentWeeklyVolumeKm >= 15) {
    return false;
  }
  return true;
}

function shouldUseRunWalk(profile: RunnerProfile, phase: LegacyPlanPhase, weekNumberInPhase: number, goal: GoalConfig): boolean {
  if (!allowRunWalk(profile, goal)) return false;
  const continuityBand = beginnerContinuityBand(profile);
  const capacityPolicy = buildCapacityInterpretationPolicy({
    profile,
    continuityBand,
    beginnerLike: beginnerSafe(profile),
  });
  const earlyWeekPolicy = buildEarlyWeekRealismPolicy({
    profile,
    continuityBand,
    beginnerLike: beginnerSafe(profile),
    phase,
    weekNumberInPhase,
  });
  if (capacityPolicy.preferRunWalkByDefault && (phase === "introduction" || (phase === "continuous_running" && weekNumberInPhase <= 1))) {
    return true;
  }
  if (earlyWeekPolicy.preferRunWalk) return true;
  if (continuityBand === "ultra_zero") {
    return phase === "introduction" || (phase === "continuous_running" && weekNumberInPhase === 1);
  }
  if (continuityBand === "one_to_two_min") {
    return phase === "introduction" || (phase === "continuous_running" && weekNumberInPhase <= 1);
  }
  if (continuityBand === "five_min") {
    return phase === "introduction" && weekNumberInPhase <= 2;
  }
  if (phase === "capacity" || phase === "race_preparation") return false;
  if (goal.goalDistance === "Marathon" && phase !== "introduction") return false;
  if (profile.archetype === "nervous_beginner") return weekNumberInPhase <= 3 || profile.runningSpecificity <= 2;
  if (profile.archetype === "returning_runner") return phase === "introduction" && weekNumberInPhase <= 2 && profile.runningSpecificity <= 3;
  if (profile.currentRunsPerWeek <= 1 && profile.longestRunMinutes <= 20) return weekNumberInPhase <= 2;
  return phase === "introduction" && weekNumberInPhase === 1 && profile.runningSpecificity <= 2 && profile.confidence <= 2;
}

type PerformanceMode = "non_performance" | "finish_like" | "conservative_performance" | "full_performance";

function goalDistanceKm(goal: GoalConfig): number {
  if (goal.goalDistance === "5K") return 5;
  if (goal.goalDistance === "10K") return 10;
  if (goal.goalDistance === "Halvmaraton") return 21.0975;
  return 42.195;
}

function parseTargetTimeToSeconds(value?: string): number | null {
  if (!value) return null;
  const parts = value.split(":").map((part) => Number(part));
  if (parts.length < 2 || parts.some((part) => !Number.isFinite(part))) return null;
  if (parts.length === 2) return parts[0]! * 60 + parts[1]!;
  return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
}

function targetPaceSecPerKm(goal: GoalConfig): number | null {
  if (typeof goal.targetPaceSecPerKm === "number" && Number.isFinite(goal.targetPaceSecPerKm)) return goal.targetPaceSecPerKm;
  const targetTimeSec = parseTargetTimeToSeconds(goal.targetTime);
  if (!targetTimeSec) return null;
  return targetTimeSec / goalDistanceKm(goal);
}

function hasAmbitiousLongDistanceTarget(goal: GoalConfig): boolean {
  const pace = targetPaceSecPerKm(goal);
  if (!pace) return false;
  return (goal.goalDistance === "Halvmaraton" || goal.goalDistance === "Marathon") && pace <= 240;
}

function performanceReadinessScore(profile: RunnerProfile): number {
  return (
    profile.currentWeeklyVolumeKm * 0.6 +
    profile.currentRunsPerWeek * 4 +
    Math.min(profile.longestRunMinutes, 120) * 0.18 +
    profile.runningSpecificity * 3 +
    profile.aerobicBase * 2 -
    profile.injurySensitivity * 2
  );
}

function resolvePerformanceMode(profile: RunnerProfile, goal: GoalConfig, totalWeeks: number): PerformanceMode {
  if (goal.goalIntent !== "improve" && goal.goalIntent !== "target_time") return "non_performance";

  const volume = profile.currentWeeklyVolumeKm;
  const runs = profile.currentRunsPerWeek;
  const longest = profile.longestRunMinutes;
  const readinessScore = performanceReadinessScore(profile);
  const shortBuild = totalWeeks <= DISTANCE_PROFILE[goal.goalDistance].minWeeks + (goal.goalDistance === "5K" ? 1 : 2);
  const ambitiousLongDistanceTarget = hasAmbitiousLongDistanceTarget(goal);

  const fullReady =
    goal.goalDistance === "5K"
      ? volume >= 20 || (runs >= 3 && longest >= 35)
      : goal.goalDistance === "10K"
        ? volume >= 22 && runs >= 3 && longest >= 45
        : goal.goalDistance === "Halvmaraton"
          ? volume >= 24 && runs >= 3 && longest >= 60
          : volume >= 35 && runs >= 4 && longest >= 90;

  const clearlyUnderReady =
    goal.goalDistance === "5K"
      ? volume < 10 && runs < 3 && longest < 30
      : goal.goalDistance === "10K"
        ? volume < 14 || runs < 2 || longest < 35
        : goal.goalDistance === "Halvmaraton"
          ? volume < 18 || runs < 3 || longest < 50
          : volume < 28 || runs < 3 || longest < 80;

  const ambitiousLongDistanceReady =
    ambitiousLongDistanceTarget &&
    (goal.goalDistance === "Halvmaraton"
      ? volume >= 40 && runs >= 4 && longest >= 90
      : volume >= 52 && runs >= 4 && longest >= 120);

  if (ambitiousLongDistanceReady && readinessScore >= (goal.goalDistance === "Marathon" ? 74 : 66) && !shortBuild) {
    return "full_performance";
  }
  if (ambitiousLongDistanceReady && !clearlyUnderReady) {
    return "conservative_performance";
  }

  if (fullReady && !shortBuild) return "full_performance";
  if (fullReady) return goal.goalDistance === "5K" ? "full_performance" : "conservative_performance";

  if (goal.goalIntent === "target_time" && (clearlyUnderReady || (shortBuild && readinessScore < 42))) {
    return "finish_like";
  }

  if (goal.goalDistance === "Marathon" && (clearlyUnderReady || readinessScore < 50)) {
    return "finish_like";
  }

  if (goal.goalDistance === "Halvmaraton" && clearlyUnderReady && shortBuild) {
    return "finish_like";
  }

  return "conservative_performance";
}

function ambitionAdjustmentRationale(profile: RunnerProfile, goal: GoalConfig, totalWeeks: number): AmbitionAdjustmentRationale | undefined {
  const mode = resolvePerformanceMode(profile, goal, totalWeeks);
  if (goal.goalIntent !== "improve" && goal.goalIntent !== "target_time") return undefined;
  if (mode === "full_performance") return undefined;

  return {
    applied: true,
    originalIntent: goal.goalIntent,
    effectiveIntent: mode === "finish_like" ? "finish" : "conservative_improve",
    reason:
      mode === "finish_like"
        ? "Målet er stadig ambitiøst, men din nuværende readiness og tidsramme peger på, at planen foreløbigt skal bygges mere som et sikkert forløb end som et fuldt aggressivt præstationsforløb."
        : "Målet forbliver præstationsrettet, men planen bygger lidt mere forsigtigt op lige nu, fordi dit nuværende udgangspunkt ikke kalder på maksimal aggressivitet fra uge 1.",
  };
}

function runnerStartingPoint(profile: RunnerProfile, goal: GoalConfig, totalWeeks: number) {
  const distanceProfile = DISTANCE_PROFILE[goal.goalDistance];
  const cautious = profile.injurySensitivity >= 4 || profile.confidence <= 2;
  const continuityBand = beginnerContinuityBand(profile);
  const entryPolicy = buildEntryRealismPolicy({
    profile,
    continuityBand,
    beginnerLike: beginnerSafe(profile),
  });
  const capacityPolicy = buildCapacityInterpretationPolicy({
    profile,
    continuityBand,
    beginnerLike: beginnerSafe(profile),
  });
  const intentWeight = intentAggressiveness(goal.goalIntent);
  const experienceWeight = clamp(
    (profile.aerobicBase * 0.2 + profile.runningSpecificity * 0.2 + Math.min(profile.currentRunsPerWeek, 5) * 0.12 + Math.min(profile.currentWeeklyVolumeKm, 60) * 0.01) /
      2.2,
    0,
    1,
  );
  const baseWorkoutBudget = clamp(profile.typicalWorkoutMinutes || 45, 25, 90);
  const currentLongest = Math.max(profile.longestRunMinutes || 0, 0);
  const baseContinuous = profile.aerobicBase * 5 + 8;
  const baseLongRun = profile.aerobicBase * 7 + 15;
  const targetContinuousPeak = roundHalf(
    clamp(
      (distanceProfile.continuousPeak.min + (distanceProfile.continuousPeak.max - distanceProfile.continuousPeak.min) * ((experienceWeight + intentWeight) / 2)) *
        entryPolicy.conservativeCapacityFactor,
      distanceProfile.continuousPeak.min,
      distanceProfile.continuousPeak.max,
    ),
  );
  const targetLongRunPeak = roundHalf(
    clamp(
      (distanceProfile.longRunPeak.min + (distanceProfile.longRunPeak.max - distanceProfile.longRunPeak.min) * ((experienceWeight * 0.55) + (intentWeight * 0.45))) *
        entryPolicy.conservativeCapacityFactor,
      distanceProfile.longRunPeak.min,
      distanceProfile.longRunPeak.max,
    ),
  );
  const startContinuous = clamp(
    Math.max(baseContinuous, currentLongest > 0 ? currentLongest * 0.6 : 0, profile.currentWeeklyVolumeKm > 0 ? profile.currentWeeklyVolumeKm * 0.8 : 0) *
      entryPolicy.conservativeCapacityFactor,
    10,
    Math.max(18, baseWorkoutBudget - 8),
  );
  const startLongRun = clamp(
    Math.max(baseLongRun, currentLongest > 0 ? currentLongest * 0.82 : 0) * entryPolicy.conservativeCapacityFactor,
    18,
    Math.max(30, targetLongRunPeak * 0.9),
  );
  const nonLongCap = Math.max(baseWorkoutBudget + (goal.goalIntent === "target_time" ? 8 : 5), startContinuous);
  const longRunCap = Math.max(baseWorkoutBudget * (goal.goalDistance === "Marathon" ? 1.9 : goal.goalDistance === "Halvmaraton" ? 1.7 : 1.5), nonLongCap + 10);
  const progressionRate =
    profile.progressionStyle === "conservative"
      ? 0.92
      : profile.progressionStyle === "steady"
        ? 1.05
        : 1;
  const qualityBase = beginnerSafe(profile) ? distanceProfile.intervalPeak.min : distanceProfile.intervalPeak.min + 1;

  if (continuityBand === "ultra_zero") {
    return {
      continuousStart: capacityPolicy.introductoryContinuousStartMin ?? 1,
      continuousPeak: roundHalf(clamp(goal.goalDistance === "5K" ? 18 : 22, 12, Math.min(distanceProfile.continuousPeak.max, 24))),
      longRunStart: capacityPolicy.introductoryLongRunStartMin ?? 8,
      longRunPeak: roundHalf(clamp(goal.goalDistance === "5K" ? 28 : goal.goalDistance === "10K" ? 36 : 42, 24, Math.min(distanceProfile.longRunPeak.max, 48))),
      intervalStart: capacityPolicy.introductoryIntervalRunMin ?? 0.5,
      intervalPeak: 1.5,
      repeatsStart: capacityPolicy.introductoryRepeats ?? 4,
      repeatsPeak: 6,
      walkBreakStart: capacityPolicy.introductoryWalkBreakMin ?? 2.5,
      nonLongCap: 24,
      longRunCap: 48,
      conservativeIntensity: true,
      canHandleDoubleQuality: false,
    };
  }

  if (continuityBand === "one_to_two_min") {
    return {
      continuousStart: capacityPolicy.introductoryContinuousStartMin ?? 2,
      continuousPeak: roundHalf(clamp(goal.goalDistance === "5K" ? 22 : 28, 14, Math.min(distanceProfile.continuousPeak.max, 30))),
      longRunStart: capacityPolicy.introductoryLongRunStartMin ?? 10,
      longRunPeak: roundHalf(clamp(goal.goalDistance === "5K" ? 34 : goal.goalDistance === "10K" ? 44 : 52, 28, Math.min(distanceProfile.longRunPeak.max, 58))),
      intervalStart: capacityPolicy.introductoryIntervalRunMin ?? 0.75,
      intervalPeak: 2,
      repeatsStart: capacityPolicy.introductoryRepeats ?? 4,
      repeatsPeak: 6,
      walkBreakStart: capacityPolicy.introductoryWalkBreakMin ?? 2.25,
      nonLongCap: 30,
      longRunCap: 58,
      conservativeIntensity: true,
      canHandleDoubleQuality: false,
    };
  }

  if (continuityBand === "five_min") {
    return {
      continuousStart: capacityPolicy.introductoryContinuousStartMin ?? 4,
      continuousPeak: roundHalf(clamp(goal.goalDistance === "5K" ? 28 : 34, 18, Math.min(distanceProfile.continuousPeak.max, 40))),
      longRunStart: capacityPolicy.introductoryLongRunStartMin ?? 14,
      longRunPeak: roundHalf(clamp(goal.goalDistance === "5K" ? 38 : goal.goalDistance === "10K" ? 50 : 60, 32, Math.min(distanceProfile.longRunPeak.max, 66))),
      intervalStart: capacityPolicy.introductoryIntervalRunMin ?? 1,
      intervalPeak: 3,
      repeatsStart: capacityPolicy.introductoryRepeats ?? 4,
      repeatsPeak: 6,
      walkBreakStart: capacityPolicy.introductoryWalkBreakMin ?? 2,
      nonLongCap: 40,
      longRunCap: 68,
      conservativeIntensity: true,
      canHandleDoubleQuality: false,
    };
  }

  return {
    continuousStart: roundHalf(
      clamp(
        cautious ? startContinuous * 0.92 : startContinuous,
        10,
        Math.min(entryPolicy.continuousStartMax ?? Number.POSITIVE_INFINITY, Math.max(20, nonLongCap)),
      ),
    ),
    continuousPeak: roundHalf(
      clamp(
        targetContinuousPeak * progressionRate,
        20,
        Math.min(distanceProfile.continuousPeak.max, entryPolicy.nonLongCapMax ?? nonLongCap, nonLongCap),
      ),
    ),
    longRunStart: roundHalf(
      clamp(
        cautious ? startLongRun * 0.94 : startLongRun,
        18,
        Math.min(entryPolicy.longRunStartMax ?? Number.POSITIVE_INFINITY, Math.max(35, longRunCap)),
      ),
    ),
    longRunPeak: roundHalf(
      clamp(
        targetLongRunPeak * progressionRate,
        35,
        Math.min(distanceProfile.longRunPeak.max, entryPolicy.longRunCapMax ?? longRunCap, longRunCap),
      ),
    ),
    intervalStart: clamp(qualityBase, distanceProfile.intervalPeak.min, distanceProfile.intervalPeak.max),
    intervalPeak: clamp(
      roundHalf(distanceProfile.intervalPeak.min + (distanceProfile.intervalPeak.max - distanceProfile.intervalPeak.min) * ((intentWeight + experienceWeight) / 2)),
      distanceProfile.intervalPeak.min,
      distanceProfile.intervalPeak.max,
    ),
    repeatsStart: beginnerSafe(profile) ? distanceProfile.repeatsPeak.min : distanceProfile.repeatsPeak.min + 1,
    repeatsPeak: clamp(
      Math.round(distanceProfile.repeatsPeak.min + (distanceProfile.repeatsPeak.max - distanceProfile.repeatsPeak.min) * ((experienceWeight + intentWeight) / 2)),
      distanceProfile.repeatsPeak.min,
      distanceProfile.repeatsPeak.max,
    ),
    walkBreakStart: cautious ? 2 : beginnerSafe(profile) ? 1.5 : 1,
    nonLongCap: Math.min(nonLongCap, entryPolicy.nonLongCapMax ?? nonLongCap),
    longRunCap: Math.min(longRunCap, entryPolicy.longRunCapMax ?? longRunCap),
    conservativeIntensity: beginnerSafe(profile),
    canHandleDoubleQuality:
      profile.currentRunsPerWeek >= 4 &&
      profile.currentWeeklyVolumeKm >= 35 &&
      profile.runningSpecificity >= 3 &&
      profile.injurySensitivity <= 3 &&
      goal.goalIntent !== "finish" &&
      totalWeeks >= 10,
  };
}

function shouldStabilizeWeek(weekNumber: number, totalWeeks: number, phase: LegacyPlanPhase, goal: GoalConfig): boolean {
  if (phase === "race_preparation") return false;
  if (totalWeeks <= DISTANCE_PROFILE[goal.goalDistance].minWeeks) return false;
  if (weekNumber === totalWeeks - 1 || weekNumber === totalWeeks) return false;
  const frequency = goal.trainingDaysPerWeek;
  return weekNumber % (frequency >= 4 ? 4 : 3) === 0;
}

function buildWaveFactors(
  phase: LegacyPlanPhase,
  weekNumberInPhase: number,
  phaseLength: number,
): { loadFactor: number; longRunFactor: number; continuousFactor: number } {
  if (phase === "introduction" || phase === "race_preparation" || phaseLength <= 1) {
    return { loadFactor: 1, longRunFactor: 1, continuousFactor: 1 };
  }

  const waveIndex = phaseLength <= 2 ? weekNumberInPhase - 1 : (weekNumberInPhase - 1) % 3;
  if (phase === "continuous_running") {
    if (waveIndex === 0) return { loadFactor: 0.99, longRunFactor: 0.99, continuousFactor: 0.995 };
    if (waveIndex === 1) return { loadFactor: 1.01, longRunFactor: 1.025, continuousFactor: 1.01 };
    return { loadFactor: 1.035, longRunFactor: 1.055, continuousFactor: 1.02 };
  }

  if (waveIndex === 0) return { loadFactor: 0.995, longRunFactor: 0.99, continuousFactor: 1 };
  if (waveIndex === 1) return { loadFactor: 1.02, longRunFactor: 1.04, continuousFactor: 1.015 };
  return { loadFactor: 1.045, longRunFactor: 1.07, continuousFactor: 1.025 };
}

function clampRelative(value: number, previous: number, minFactor: number, maxFactor: number): number {
  return clamp(value, previous * minFactor, previous * maxFactor);
}

function smoothWeekTargets(params: {
  current: {
    continuousRunMin: number;
    longRunMin: number;
    intervalRunMin: number;
    repeats: number;
  };
  previous: {
    continuousRunMin: number;
    longRunMin: number;
    intervalRunMin: number;
    repeats: number;
  } | null;
  phase: LegacyPlanPhase;
  goal: GoalConfig;
  profile: RunnerProfile;
  continuityBand: ContinuityBand;
  isStabilizationWeek: boolean;
  previousWasStabilizationWeek: boolean;
}): {
  continuousRunMin: number;
  longRunMin: number;
  intervalRunMin: number;
  repeats: number;
} {
  if (!params.previous) return params.current;

  const progressionPolicy = buildProgressionRealismPolicy({
    profile: params.profile,
    continuityBand: params.continuityBand,
    beginnerLike: beginnerSafe(params.profile),
    goal: params.goal,
    phase: params.phase,
    isStabilizationWeek: params.isStabilizationWeek,
    previousWasStabilizationWeek: params.previousWasStabilizationWeek,
  });

  return {
    continuousRunMin: roundHalf(clampRelative(params.current.continuousRunMin, params.previous.continuousRunMin, progressionPolicy.continuousMinFactor, progressionPolicy.continuousMaxFactor)),
    longRunMin: roundHalf(clampRelative(params.current.longRunMin, params.previous.longRunMin, progressionPolicy.longRunMinFactor, progressionPolicy.longRunMaxFactor)),
    intervalRunMin: roundHalf(clampRelative(params.current.intervalRunMin, params.previous.intervalRunMin, progressionPolicy.intervalMinFactor, progressionPolicy.intervalMaxFactor)),
    repeats: clamp(params.current.repeats, Math.max(4, params.previous.repeats - 1), params.previous.repeats + 1),
  };
}

function taperFactor(goal: GoalConfig, phase: LegacyPlanPhase, weekNumberInPhase: number, phaseLength: number): number {
  if (phase !== "race_preparation") return 1;
  if (phaseLength <= 1) return DISTANCE_PROFILE[goal.goalDistance].taperFactorFinal;
  if (weekNumberInPhase === phaseLength) return DISTANCE_PROFILE[goal.goalDistance].taperFactorFinal;
  return goal.goalDistance === "Marathon" || goal.goalDistance === "Halvmaraton" ? 0.88 : 0.86;
}

function focusForWeek(goal: GoalConfig, phase: LegacyPlanPhase, weekNumberInPhase: number, phaseLength: number, isStabilizationWeek: boolean): string {
  if (isStabilizationWeek) return "En roligere uge hvor kroppen får plads til at absorbere træningen.";
  if (phase === "introduction") {
    return weekNumberInPhase === 1
      ? "Få rytme i træningen og lande sikkert i programmet."
      : "Bygge en stabil uge, hvor kroppen lærer træningen bedre at kende.";
  }
  if (phase === "continuous_running") {
    return goal.goalDistance === "5K"
      ? "Forlænge de rolige blokke og gøre løbet mere sammenhængende uge for uge."
      : "Bygge mere aerob kontinuitet og gøre de rolige pas mere robuste.";
  }
  if (phase === "capacity") {
    return goal.goalIntent === "finish" || goal.goalIntent === "finish_comfortably"
      ? "Bygge kapacitet med kontrolleret belastning og god restitution."
      : "Bygge specifik kapacitet med mere målrettet kvalitet uden at forcere.";
  }
  return weekNumberInPhase === phaseLength
    ? `Friske ben og rolig selvtillid frem mod ${goal.goalDistance}-målet.`
    : `Skærpe rytmen og holde kroppen frisk frem mod ${goal.goalDistance}-måldagen.`;
}

function sessionMix(
  goal: GoalConfig,
  profile: RunnerProfile,
  totalWeeks: number,
  phase: LegacyPlanPhase,
  weekNumberInPhase: number,
  phaseLength: number,
  useRunWalk: boolean,
  isStabilizationWeek: boolean,
  canHandleDoubleQuality: boolean,
): WorkoutType[] {
  const finalPhaseWeek = phase === "race_preparation" && weekNumberInPhase === phaseLength;
  const performanceIntent = goal.goalIntent === "improve" || goal.goalIntent === "target_time";
  const onboardingTrack = profile.baseProgramTrack;
  const continuityBand = beginnerContinuityBand(profile);
  const performanceMode = resolvePerformanceMode(profile, goal, totalWeeks);
  const fullPerformance = performanceMode === "full_performance";
  const conservativePerformance = performanceMode === "conservative_performance";
  const downgradedPerformance = performanceMode === "finish_like";
  const conservative = beginnerSafe(profile) || goal.goalIntent === "finish";
  const progressionSupport: WorkoutType = weekNumberInPhase % 3 === 0 ? "progression" : weekNumberInPhase % 2 === 0 ? "steady" : "easy";
  const endurancePrimary: WorkoutType = weekNumberInPhase % 2 === 0 ? "progression" : "steady";
  const endurancePerformance = (fullPerformance || conservativePerformance) && (goal.goalDistance === "Halvmaraton" || goal.goalDistance === "Marathon");
  const strong5kPerformance = goal.goalDistance === "5K" && fullPerformance && strongBackground(profile, goal);
  const strongMarathonBackground = goal.goalDistance === "Marathon" && strongBackground(profile, goal) && !beginnerSafe(profile);
  const ambitiousLongDistancePerformance =
    hasAmbitiousLongDistanceTarget(goal) &&
    (goal.goalDistance === "Halvmaraton" || goal.goalDistance === "Marathon") &&
    (fullPerformance || conservativePerformance);
  const effectivePerformance = performanceIntent && !downgradedPerformance;
  const trackPosture = buildTrackPosturePolicy({
    profile,
    track: onboardingTrack,
    continuityBand,
    beginnerLike: beginnerSafe(profile),
    phase,
    weekNumberInPhase,
    useRunWalk,
    effectivePerformance,
  });
  const trackDrivenQuality = trackPosture.preferControlledQualitySignal;
  const earlyPerformanceSpecificity =
    !useRunWalk &&
    weekNumberInPhase <= 2 &&
    effectivePerformance &&
    (trackDrivenQuality || strongBackground(profile, goal) || profile.currentRunsPerWeek >= 4 || profile.currentWeeklyVolumeKm >= 22);
  const earlyQualityType: WorkoutType =
    weekNumberInPhase <= 1
      ? goal.goalDistance === "5K"
        ? earlyPerformanceSpecificity
          ? "strides"
          : "steady"
        : goal.goalDistance === "10K"
          ? earlyPerformanceSpecificity
            ? "strides"
            : "steady"
          : earlyPerformanceSpecificity
            ? "tempo"
            : "steady"
      : goal.goalDistance === "5K"
        ? "strides"
        : goal.goalDistance === "10K"
          ? "progression"
          : "tempo";
  if (goal.trainingDaysPerWeek === 2) {
    if (continuityBand === "ultra_zero" && phase === "introduction") return ["run-walk", "run-walk"];
    if (continuityBand === "one_to_two_min" && phase === "introduction") return ["run-walk", "easy"];
    if (finalPhaseWeek) return ["easy", "benchmark"];
    if (phase === "capacity") return [strong5kPerformance ? "interval" : effectivePerformance ? "tempo" : useRunWalk ? "run-walk" : "easy", "long"];
    if (phase === "race_preparation") return [strong5kPerformance ? "tempo" : effectivePerformance ? "tempo" : "easy", "long"];
    return [useRunWalk ? "run-walk" : "easy", "long"];
  }

  if (goal.trainingDaysPerWeek === 3) {
    if (continuityBand === "ultra_zero" && phase === "introduction") return ["run-walk", "run-walk", "run-walk"];
    if (continuityBand === "one_to_two_min" && phase === "introduction") return ["run-walk", "run-walk", "run-walk"];
    if (continuityBand === "five_min" && phase === "introduction") return ["run-walk", "run-walk", "run-walk"];
    if (finalPhaseWeek) return ["easy", "easy", "benchmark"];
    if (isStabilizationWeek) return [useRunWalk ? "run-walk" : "easy", "recovery", "long"];
    if (phase === "introduction") {
      if (trackPosture.preferEasyOnly) return [useRunWalk ? "run-walk" : "easy", "easy", "long"];
      if (trackDrivenQuality) return ["easy", earlyQualityType, "long"];
      if (trackPosture.preferSteadySupport) return ["easy", "steady", "long"];
      if (onboardingTrack === "returning") return [useRunWalk ? "run-walk" : "easy", "easy", "long"];
      return [useRunWalk ? "run-walk" : "easy", strong5kPerformance ? "strides" : conservative ? "easy" : "strides", "long"];
    }
    if (phase === "continuous_running") {
      if (trackPosture.preferEasyOnly) return [useRunWalk ? "run-walk" : "easy", "easy", "long"];
      if (trackDrivenQuality) return ["easy", weekNumberInPhase <= 2 ? "progression" : endurancePrimary, "long"];
      if (trackPosture.preferSteadySupport) return ["easy", "steady", "long"];
      if (strong5kPerformance) return ["easy", weekNumberInPhase % 2 === 0 ? "tempo" : "interval", "long"];
      if (strongMarathonBackground) return ["easy", endurancePrimary, "long"];
      return [useRunWalk ? "run-walk" : "easy", endurancePerformance ? endurancePrimary : effectivePerformance ? "strides" : progressionSupport, "long"];
    }
    if (phase === "capacity") {
      if (strong5kPerformance) return ["interval", weekNumberInPhase % 2 === 0 ? "tempo" : "easy", "long"];
      if (ambitiousLongDistancePerformance) return [endurancePrimary, "race-specific", "long"];
      if (strongMarathonBackground) return [endurancePrimary, progressionSupport === "easy" ? "easy" : progressionSupport, "long"];
      return [endurancePerformance ? endurancePrimary : effectivePerformance ? "interval" : progressionSupport, goal.goalDistance === "Marathon" ? "easy" : "recovery", "long"];
    }
    if (strong5kPerformance) return ["tempo", weekNumberInPhase === phaseLength - 1 ? "strides" : "easy", "long"];
    if (strongMarathonBackground) return [endurancePrimary, progressionSupport === "easy" ? "easy" : progressionSupport, "long"];
    return [endurancePerformance || effectivePerformance ? endurancePrimary : progressionSupport, "easy", "long"];
  }

  if (continuityBand === "ultra_zero" && phase === "introduction") return ["run-walk", "recovery", "run-walk", "run-walk"];
  if (continuityBand === "one_to_two_min" && phase === "introduction") return ["run-walk", "recovery", "easy", "run-walk"];
  if (finalPhaseWeek) return ["easy", "recovery", "easy", "benchmark"];
  if (isStabilizationWeek) return [useRunWalk ? "run-walk" : "easy", "recovery", "easy", "long"];
  if (phase === "introduction") {
    if (trackPosture.preferEasyOnly) return [useRunWalk ? "run-walk" : "easy", "recovery", "easy", "long"];
    if (trackDrivenQuality) return ["easy", "recovery", earlyQualityType, "long"];
    if (trackPosture.preferSteadySupport) return ["easy", "recovery", "steady", "long"];
    if (onboardingTrack === "returning") return [useRunWalk ? "run-walk" : "easy", "recovery", "easy", "long"];
    if (strong5kPerformance) return ["easy", "strides", "easy", "long"];
    return [useRunWalk ? "run-walk" : "easy", "recovery", "easy", "long"];
  }
  if (phase === "continuous_running") {
    if (trackPosture.preferEasyOnly) return [useRunWalk ? "run-walk" : "easy", "recovery", "easy", "long"];
    if (trackDrivenQuality) return ["easy", "recovery", weekNumberInPhase <= 2 ? "progression" : endurancePrimary, "long"];
    if (trackPosture.preferSteadySupport) return ["easy", "recovery", "steady", "long"];
    if (strong5kPerformance) return ["easy", weekNumberInPhase % 2 === 0 ? "tempo" : "interval", weekNumberInPhase % 2 === 0 ? "strides" : "easy", "long"];
    if (strongMarathonBackground) return ["easy", endurancePrimary, progressionSupport, "long"];
    return [useRunWalk ? "run-walk" : "easy", endurancePerformance ? endurancePrimary : conservative ? "recovery" : "strides", progressionSupport, "long"];
  }
  if (phase === "capacity") {
    if (strong5kPerformance) return ["interval", "recovery", weekNumberInPhase % 2 === 0 ? "tempo" : "strides", "long"];
    if (ambitiousLongDistancePerformance) return [endurancePrimary, "recovery", "race-specific", "long"];
    if (strongMarathonBackground && fullPerformance) return [endurancePrimary, "recovery", progressionSupport === "easy" ? "steady" : progressionSupport, "long"];
    if (strongMarathonBackground) return [endurancePrimary, "recovery", progressionSupport, "long"];
    if (endurancePerformance && canHandleDoubleQuality) return [endurancePrimary, "recovery", progressionSupport, "long"];
    if (effectivePerformance && canHandleDoubleQuality) return ["interval", "recovery", "tempo", "long"];
    return [endurancePerformance ? endurancePrimary : effectivePerformance ? "interval" : progressionSupport, "recovery", "easy", "long"];
  }
  if (strong5kPerformance) return ["tempo", "recovery", weekNumberInPhase === phaseLength ? "easy" : "strides", "long"];
  if (ambitiousLongDistancePerformance) return [endurancePrimary, "recovery", "race-specific", "long"];
  if (strongMarathonBackground && fullPerformance) return [endurancePrimary, "recovery", progressionSupport === "easy" ? "steady" : progressionSupport, "long"];
  if (strongMarathonBackground) return [endurancePrimary, "recovery", progressionSupport, "long"];
  if (endurancePerformance && canHandleDoubleQuality) return [endurancePrimary, "recovery", progressionSupport === "easy" ? "steady" : progressionSupport, "long"];
  if (effectivePerformance && canHandleDoubleQuality) return ["tempo", "recovery", goal.goalDistance === "5K" ? "strides" : "easy", "long"];
  return [endurancePerformance ? "tempo" : "tempo", "recovery", "easy", "long"];
}

function createWeekState(params: {
  profile: RunnerProfile;
  goal: GoalConfig;
  totalWeeks: number;
  weekNumber: number;
  phase: LegacyPlanPhase;
  phaseTimeline: LegacyPlanPhase[];
  isStabilizationWeek: boolean;
}) {
  const profileStart = runnerStartingPoint(params.profile, params.goal, params.totalWeeks);
  const performanceMode = resolvePerformanceMode(params.profile, params.goal, params.totalWeeks);
  const continuityBand = beginnerContinuityBand(params.profile);
  const strong5kPerformance = params.goal.goalDistance === "5K" && performanceMode === "full_performance" && strongBackground(params.profile, params.goal);
  const strongMarathonBackground = params.goal.goalDistance === "Marathon" && strongBackground(params.profile, params.goal) && !beginnerSafe(params.profile);
  const ambitiousLongDistancePerformance =
    hasAmbitiousLongDistanceTarget(params.goal) &&
    (params.goal.goalDistance === "Halvmaraton" || params.goal.goalDistance === "Marathon") &&
    (performanceMode === "full_performance" || performanceMode === "conservative_performance");
  const phaseLength = countPhaseWeeks(params.phaseTimeline, params.phase);
  const weekNumberInPhase = phaseWeekIndex(params.phaseTimeline, params.weekNumber);
  const earlyWeekPolicy = buildEarlyWeekRealismPolicy({
    profile: params.profile,
    continuityBand,
    beginnerLike: beginnerSafe(params.profile),
    phase: params.phase,
    weekNumberInPhase,
  });
  const capacityPolicy = buildCapacityInterpretationPolicy({
    profile: params.profile,
    continuityBand,
    beginnerLike: beginnerSafe(params.profile),
  });
  const useRunWalk = earlyWeekPolicy.preferRunWalk || shouldUseRunWalk(params.profile, params.phase, weekNumberInPhase, params.goal);
  const introLen = countPhaseWeeks(params.phaseTimeline, "introduction");
  const continuousLen = countPhaseWeeks(params.phaseTimeline, "continuous_running");
  const capacityLen = countPhaseWeeks(params.phaseTimeline, "capacity");
  const introAndBase = Math.max(1, introLen + continuousLen);
  const distanceProfile = DISTANCE_PROFILE[params.goal.goalDistance];
  const wave = buildWaveFactors(params.phase, weekNumberInPhase, phaseLength);

  let phaseProgress = 0;
  if (phaseLength > 1) {
    phaseProgress = (weekNumberInPhase - 1) / (phaseLength - 1);
  }

  let continuousRunMin = profileStart.continuousStart;
  if (params.phase === "introduction") {
    continuousRunMin = profileStart.continuousStart + phaseProgress * (profileStart.continuousPeak * 0.22);
  } else if (params.phase === "continuous_running") {
    continuousRunMin = profileStart.continuousStart + phaseProgress * (profileStart.continuousPeak - profileStart.continuousStart) * 0.78;
  } else if (params.phase === "capacity") {
    continuousRunMin = profileStart.continuousPeak * (params.goal.goalDistance === "Marathon" ? 0.86 : 0.78 + phaseProgress * 0.12);
  } else {
    continuousRunMin = profileStart.continuousPeak * taperFactor(params.goal, params.phase, weekNumberInPhase, phaseLength);
  }

  let longRunMin = profileStart.longRunStart;
  if (params.phase === "introduction") {
    longRunMin = profileStart.longRunStart + phaseProgress * Math.max(6, (profileStart.longRunPeak - profileStart.longRunStart) * 0.18);
  } else if (params.phase === "continuous_running") {
    longRunMin = profileStart.longRunStart + (profileStart.longRunPeak - profileStart.longRunStart) * (0.25 + phaseProgress * 0.45);
  } else if (params.phase === "capacity") {
    longRunMin = profileStart.longRunPeak * (params.goal.goalDistance === "Marathon" ? 0.88 + phaseProgress * 0.08 : 0.82 + phaseProgress * 0.12);
  } else {
    longRunMin = profileStart.longRunPeak * taperFactor(params.goal, params.phase, weekNumberInPhase, phaseLength);
  }

  if (!params.isStabilizationWeek) {
    continuousRunMin *= wave.continuousFactor;
    longRunMin *= wave.longRunFactor;
  }

  const qualityProgress =
    params.phase === "capacity"
      ? capacityLen <= 1
        ? 1
        : phaseProgress
      : params.phase === "race_preparation"
        ? 1
        : clamp((params.weekNumber - introAndBase) / Math.max(1, params.totalWeeks - introAndBase), 0, 1);

  let intervalRunMin = roundHalf(profileStart.intervalStart + qualityProgress * (profileStart.intervalPeak - profileStart.intervalStart));
  let repeats = Math.round(profileStart.repeatsStart + qualityProgress * (profileStart.repeatsPeak - profileStart.repeatsStart));
  let walkBreakMin = roundHalf(Math.max(1, profileStart.walkBreakStart - qualityProgress * 0.75));

  if (params.goal.goalIntent === "finish" || params.goal.goalIntent === "finish_comfortably") {
    intervalRunMin *= params.goal.goalDistance === "5K" ? 0.95 : 0.88;
    repeats = Math.max(distanceProfile.repeatsPeak.min, repeats - 1);
    walkBreakMin += 0.25;
  }

  if (performanceMode === "finish_like") {
    intervalRunMin *= params.goal.goalDistance === "5K" ? 0.92 : 0.84;
    repeats = Math.max(distanceProfile.repeatsPeak.min, repeats - 1);
    walkBreakMin += 0.25;
  } else if (performanceMode === "conservative_performance") {
    intervalRunMin *= params.goal.goalDistance === "Halvmaraton" || params.goal.goalDistance === "Marathon" ? 0.94 : 0.98;
  }

  if (profileStart.conservativeIntensity) {
    intervalRunMin *= 0.9;
    walkBreakMin += 0.25;
  }

  if (params.isStabilizationWeek) {
    continuousRunMin *= 0.92;
    longRunMin *= 0.88;
    intervalRunMin *= 0.94;
  }

  if (params.profile.injurySensitivity >= 4) {
    continuousRunMin *= 0.95;
    longRunMin *= 0.92;
    repeats = Math.max(distanceProfile.repeatsPeak.min, repeats - 1);
  }

  if (strong5kPerformance) {
    longRunMin *= params.phase === "capacity" || params.phase === "race_preparation" ? 0.7 : 0.78;
    continuousRunMin *= params.phase === "capacity" ? 1.02 : params.phase === "race_preparation" ? 0.96 : 1;
    intervalRunMin *= params.phase === "continuous_running" ? 1.05 : params.phase === "capacity" || params.phase === "race_preparation" ? 1.1 : 1;
    repeats = Math.min(distanceProfile.repeatsPeak.max, repeats + (params.phase === "capacity" ? 1 : 0));
  }

  if (strongMarathonBackground) {
    continuousRunMin *= params.phase === "continuous_running" ? 1.06 : params.phase === "capacity" || params.phase === "race_preparation" ? 1.1 : 1;
    if (performanceMode === "full_performance") {
      longRunMin *= params.phase === "race_preparation" ? 0.96 : 1;
    }
  }

  if (ambitiousLongDistancePerformance) {
    continuousRunMin *= params.phase === "capacity" || params.phase === "race_preparation" ? 1.06 : 1.02;
    intervalRunMin *= params.phase === "capacity" || params.phase === "race_preparation" ? 1.08 : 1.02;
    if (params.goal.goalDistance === "Marathon") {
      longRunMin *= params.phase === "race_preparation" ? 1 : 1.03;
    }
  }

  if (continuityBand === "ultra_zero") {
    if (params.phase === "introduction") {
      continuousRunMin = (capacityPolicy.introductoryContinuousStartMin ?? 1) + phaseProgress * 1.5;
      longRunMin = (capacityPolicy.introductoryLongRunStartMin ?? 8) + phaseProgress * 4;
      intervalRunMin = (capacityPolicy.introductoryIntervalRunMin ?? 0.5) + phaseProgress * 0.5;
      repeats = weekNumberInPhase === 1 ? (capacityPolicy.introductoryRepeats ?? 4) : Math.max(capacityPolicy.introductoryRepeats ?? 4, 5);
      walkBreakMin = (capacityPolicy.introductoryWalkBreakMin ?? 2.5) - phaseProgress * 0.25;
    } else if (params.phase === "continuous_running") {
      continuousRunMin = Math.max(4, (capacityPolicy.introductoryContinuousStartMin ?? 1) + 2 + phaseProgress * 4);
      longRunMin = Math.max(12, (capacityPolicy.introductoryLongRunStartMin ?? 8) + 4 + phaseProgress * 6);
      intervalRunMin = Math.max(1, (capacityPolicy.introductoryIntervalRunMin ?? 0.5) + 0.5 + phaseProgress * 0.5);
      repeats = 5;
      walkBreakMin = Math.max(1.75, (capacityPolicy.introductoryWalkBreakMin ?? 2.5) - 0.25 - phaseProgress * 0.5);
    }
  } else if (continuityBand === "one_to_two_min") {
    if (params.phase === "introduction") {
      continuousRunMin = (capacityPolicy.introductoryContinuousStartMin ?? 2) + phaseProgress * 2;
      longRunMin = (capacityPolicy.introductoryLongRunStartMin ?? 10) + phaseProgress * 4;
      intervalRunMin = (capacityPolicy.introductoryIntervalRunMin ?? 0.75) + phaseProgress * 0.5;
      repeats = (capacityPolicy.introductoryRepeats ?? 4) + Math.round(phaseProgress);
      walkBreakMin = (capacityPolicy.introductoryWalkBreakMin ?? 2.25) - phaseProgress * 0.25;
    } else if (params.phase === "continuous_running") {
      continuousRunMin = Math.max(6, (capacityPolicy.introductoryContinuousStartMin ?? 2) + 4 + phaseProgress * 5);
      longRunMin = Math.max(16, (capacityPolicy.introductoryLongRunStartMin ?? 10) + 6 + phaseProgress * 7);
      intervalRunMin = Math.max(1.25, (capacityPolicy.introductoryIntervalRunMin ?? 0.75) + 0.5 + phaseProgress * 0.75);
      repeats = 5;
      walkBreakMin = Math.max(1.5, (capacityPolicy.introductoryWalkBreakMin ?? 2.25) - 0.25 - phaseProgress * 0.5);
    }
  } else if (continuityBand === "five_min" && params.phase === "introduction") {
    continuousRunMin = (capacityPolicy.introductoryContinuousStartMin ?? 4) + phaseProgress * 2;
    longRunMin = (capacityPolicy.introductoryLongRunStartMin ?? 14) + phaseProgress * 4;
    intervalRunMin = (capacityPolicy.introductoryIntervalRunMin ?? 1) + phaseProgress * 0.5;
    repeats = (capacityPolicy.introductoryRepeats ?? 4) + Math.round(phaseProgress);
    walkBreakMin = (capacityPolicy.introductoryWalkBreakMin ?? 2) - phaseProgress * 0.25;
  }

  if (earlyWeekPolicy.maxContinuousRunMin != null) {
    continuousRunMin = Math.min(continuousRunMin, earlyWeekPolicy.maxContinuousRunMin);
  }
  if (earlyWeekPolicy.maxLongRunMin != null) {
    longRunMin = Math.min(longRunMin, earlyWeekPolicy.maxLongRunMin);
  }
  if (earlyWeekPolicy.maxIntervalRunMin != null) {
    intervalRunMin = Math.min(intervalRunMin, earlyWeekPolicy.maxIntervalRunMin);
  }
  if (earlyWeekPolicy.minWalkBreakMin != null) {
    walkBreakMin = Math.max(walkBreakMin, earlyWeekPolicy.minWalkBreakMin);
  }
  if (params.weekNumber === 1) {
    if (capacityPolicy.firstWorkoutContinuousMaxMin != null) {
      continuousRunMin = Math.min(continuousRunMin, capacityPolicy.firstWorkoutContinuousMaxMin);
    }
    if (useRunWalk && capacityPolicy.firstWorkoutTotalRunMaxMin != null) {
      const safeRepeats = Math.max(1, Math.floor(capacityPolicy.firstWorkoutTotalRunMaxMin / Math.max(intervalRunMin, 0.5)));
      repeats = Math.min(repeats, safeRepeats);
      if (intervalRunMin * repeats > capacityPolicy.firstWorkoutTotalRunMaxMin) {
        intervalRunMin = capacityPolicy.firstWorkoutTotalRunMaxMin / Math.max(repeats, 1);
      }
    }
  }

  const resolvedContinuousRunMin = roundHalf(
    clamp(
      continuousRunMin,
      capacityPolicy.introductoryContinuousFloorMin ?? (continuityBand === "ultra_zero" ? 4 : continuityBand === "one_to_two_min" ? 6 : continuityBand === "five_min" ? 9 : 10),
      Math.min(profileStart.continuousPeak, profileStart.nonLongCap),
    ),
  );
  const resolvedLongRunMin = roundHalf(
    clamp(
      longRunMin,
      capacityPolicy.introductoryLongRunFloorMin ?? (continuityBand === "ultra_zero" ? 10 : continuityBand === "one_to_two_min" ? 12 : continuityBand === "five_min" ? 16 : 18),
      Math.min(profileStart.longRunPeak, profileStart.longRunCap),
    ),
  );
  const minimumRepeats = continuityBand === "ultra_zero" ? 4 : distanceProfile.repeatsPeak.min;
  const resolvedRepeats = clamp(repeats, minimumRepeats, distanceProfile.repeatsPeak.max);
  let resolvedIntervalRunMin = roundHalf(
    clamp(
      intervalRunMin,
      capacityPolicy.introductoryIntervalFloorMin ?? (continuityBand === "ultra_zero" ? 0.5 : continuityBand === "one_to_two_min" ? 1 : continuityBand === "five_min" ? 2 : distanceProfile.intervalPeak.min),
      distanceProfile.intervalPeak.max,
    ),
  );

  if (params.weekNumber === 1 && useRunWalk && capacityPolicy.firstWorkoutTotalRunMaxMin != null) {
    resolvedIntervalRunMin = roundHalf(
      Math.min(
        resolvedIntervalRunMin,
        capacityPolicy.firstWorkoutTotalRunMaxMin / Math.max(resolvedRepeats, 1),
      ),
    );
  }

  return {
    continuousRunMin: resolvedContinuousRunMin,
    longRunMin: resolvedLongRunMin,
    intervalRunMin: resolvedIntervalRunMin,
    repeats: resolvedRepeats,
    walkBreakMin,
    useRunWalk,
    phaseLength,
    weekNumberInPhase,
    canHandleDoubleQuality: profileStart.canHandleDoubleQuality,
  };
}

function buildSessionByType(type: WorkoutType, context: WorkoutBuildContext): WorkoutSession {
  if (type === "run-walk") return buildRunWalkWorkout(context);
  if (type === "easy") return buildEasyWorkout(context);
  if (type === "long") return buildLongWorkout(context);
  if (type === "interval") return buildIntervalWorkout(context);
  if (type === "tempo") return buildTempoWorkout(context);
  if (type === "strides") return buildStridesWorkout(context);
  if (type === "recovery") return buildRecoveryWorkout(context);
  if (type === "fartlek") return buildFartlekWorkout(context);
  if (type === "hill-reps") return buildHillWorkout(context);
  if (type === "steady") return buildSteadyWorkout(context);
  if (type === "progression") return buildProgressionWorkout(context);
  if (type === "race-specific") return buildRaceSpecificWorkout(context);
  return buildBenchmarkWorkout(context);
}

function capWeekLoad(sessions: WorkoutSession[], targetLoad: number, previousLoad: number | null): WorkoutSession[] {
  const maxAllowed = previousLoad ? Math.min(targetLoad, previousLoad * 1.12) : targetLoad;
  const totalLoad = sessions.reduce((sum, session) => sum + session.estimatedLoad, 0);
  if (totalLoad <= maxAllowed) return sessions;

  const ratio = maxAllowed / totalLoad;
  return sessions.map((session) => ({
    ...session,
    estimatedLoad: Math.round(session.estimatedLoad * (session.type === "interval" || session.type === "tempo" || session.type === "benchmark" ? Math.max(ratio, 0.9) : ratio) * 10) / 10,
  }));
}

function smoothWeeklyLoadTarget(
  targetLoad: number,
  previousLoad: number | null,
  phase: LegacyPlanPhase,
  isStabilizationWeek: boolean,
  profile: RunnerProfile,
  goal: GoalConfig,
  continuityBand: ContinuityBand,
  previousWasStabilizationWeek: boolean,
): number {
  if (!previousLoad) return targetLoad;
  const progressionPolicy = buildProgressionRealismPolicy({
    profile,
    continuityBand,
    beginnerLike: beginnerSafe(profile),
    goal,
    phase,
    isStabilizationWeek,
    previousWasStabilizationWeek,
  });
  return Math.round(clamp(targetLoad, previousLoad * progressionPolicy.loadMinFactor, previousLoad * progressionPolicy.loadMaxFactor) * 10) / 10;
}

function weeklyLoadTarget(
  profile: RunnerProfile,
  goal: GoalConfig,
  totalWeeks: number,
  weekNumber: number,
  phase: LegacyPlanPhase,
  isStabilizationWeek: boolean,
  weekNumberInPhase: number,
  phaseLength: number,
): number {
  const performanceMode = resolvePerformanceMode(profile, goal, totalWeeks);
  const continuityBand = beginnerContinuityBand(profile);
  const currentLoadBase =
    profile.currentWeeklyVolumeKm > 0
      ? 34 + profile.currentWeeklyVolumeKm * 0.9 + profile.currentRunsPerWeek * 2
      : profile.archetype === "nervous_beginner"
        ? 42
        : profile.archetype === "fit_but_inexperienced"
          ? 60
          : 52;
  const loadBase =
    continuityBand === "ultra_zero"
      ? 24
      : continuityBand === "one_to_two_min"
        ? 30
        : continuityBand === "five_min"
          ? 38
          : currentLoadBase;
  const intentModifier =
    performanceMode === "finish_like"
      ? 0.99
      : goal.goalIntent === "finish"
      ? 0.94
      : goal.goalIntent === "finish_comfortably"
        ? 0.98
        : goal.goalIntent === "improve"
          ? performanceMode === "conservative_performance"
            ? 1.01
            : 1.04
          : 1.08;
  const distanceModifier =
    goal.goalDistance === "5K"
      ? 0.94
      : goal.goalDistance === "10K"
        ? 1
        : goal.goalDistance === "Halvmaraton"
          ? 1.12
          : 1.24;
  const progressionModifier = profile.progressionStyle === "conservative" ? 0.96 : profile.progressionStyle === "steady" ? 1.04 : 1;
  const overallProgress = progressRatio(weekNumber, totalWeeks);
  const phaseModifier =
    phase === "introduction"
      ? continuityBand === "ultra_zero"
        ? 0.72 + overallProgress * 0.05
        : continuityBand === "one_to_two_min"
          ? 0.78 + overallProgress * 0.06
          : 0.92 + overallProgress * 0.08
      : phase === "continuous_running"
        ? continuityBand === "ultra_zero"
          ? 0.84 + overallProgress * 0.08
          : continuityBand === "one_to_two_min"
            ? 0.9 + overallProgress * 0.1
            : 1 + overallProgress * 0.12
        : phase === "capacity"
          ? 1.06 + overallProgress * 0.14
          : 0.94;

  let target = loadBase * intentModifier * distanceModifier * progressionModifier * phaseModifier;
  const wave = buildWaveFactors(phase, weekNumberInPhase, phaseLength);
  if (!isStabilizationWeek) {
    target *= wave.loadFactor;
  }
  if (isStabilizationWeek) target *= 0.9;
  if (phase === "race_preparation") target *= goal.goalDistance === "Marathon" ? 0.9 : 0.86;
  if (profile.injurySensitivity >= 4) target *= 0.94;
  return Math.round(target * 10) / 10;
}

function buildAdjustmentLog(goal: GoalConfig, totalWeeks: number, phaseTimeline: LegacyPlanPhase[]): PlanAdjustment[] {
  const adjustments: PlanAdjustment[] = [];

  for (let weekNumber = 1; weekNumber <= totalWeeks; weekNumber += 1) {
    const phase = phaseTimeline[weekNumber - 1];
    if (shouldStabilizeWeek(weekNumber, totalWeeks, phase, goal)) {
      adjustments.push({
        id: `stabilize-${weekNumber}`,
        weekNumber,
        effect: "hold",
        reason: "stabiliseringsuge",
        summary: "Ugen holdes mere stabil, så kroppen kan absorbere den seneste progression.",
      });
    }

    if (phase === "race_preparation" && weekNumber === totalWeeks) {
      adjustments.push({
        id: `taper-${weekNumber}`,
        weekNumber,
        effect: "reduce_load",
        reason: "afrunding mod måldag",
        summary: "Den sidste uge holdes lidt lettere, så du kan møde måldagen med friskere ben.",
      });
    }
  }

  return adjustments;
}

function buildSharedGoalPlan(profile: RunnerProfile, goalConfig: GoalConfig): TrainingPlan {
  const totalWeeks = deriveTotalWeeks(goalConfig);
  const weekDays = orderTrainingDaysForLongRun(goalConfig);
  const startMonday = planStartWeekMonday(goalConfig.startDate);
  const startDate = new Date(`${goalConfig.startDate}T00:00:00`);
  const phaseTimeline = buildPhaseTimeline(goalConfig, totalWeeks);
  const weeks: TrainingWeek[] = [];
  let previousLoad: number | null = null;
  let previousWeekTargets: { continuousRunMin: number; longRunMin: number; intervalRunMin: number; repeats: number } | null = null;
  let previousWasStabilizationWeek = false;

  for (let weekNumber = 1; weekNumber <= totalWeeks; weekNumber += 1) {
    const phase = phaseTimeline[weekNumber - 1];
    const isStabilizationWeek = shouldStabilizeWeek(weekNumber, totalWeeks, phase, goalConfig);
    const weekState = createWeekState({
      profile,
      goal: goalConfig,
      totalWeeks,
      weekNumber,
      phase,
      phaseTimeline,
      isStabilizationWeek,
    });
    const smoothedWeekTargets = smoothWeekTargets({
      current: {
        continuousRunMin: weekState.continuousRunMin,
        longRunMin: weekState.longRunMin,
        intervalRunMin: weekState.intervalRunMin,
        repeats: weekState.repeats,
      },
      previous: previousWeekTargets,
      phase,
      goal: goalConfig,
      profile,
      continuityBand: beginnerContinuityBand(profile),
      isStabilizationWeek,
      previousWasStabilizationWeek,
    });

    const types = sessionMix(
      goalConfig,
      profile,
      totalWeeks,
      phase,
      weekState.weekNumberInPhase,
      weekState.phaseLength,
      weekState.useRunWalk,
      isStabilizationWeek,
      weekState.canHandleDoubleQuality,
    );

    const isGoalWeek = weekNumber === totalWeeks;
    const scheduledEntries = types
      .map((type, index) => {
        const dayOfWeek = weekDays[index];
        const date = addDays(startMonday, (weekNumber - 1) * 7 + dayOffset(dayOfWeek));
        return { type, dayOfWeek, date, index };
      })
      .filter((entry) => !(weekNumber === 1 && entry.date.getTime() < startDate.getTime()));

    let sessions = scheduledEntries.map((entry, scheduledIndex) => {
      const actualSessionNumber = scheduledIndex + 1;
      const firstSession = firstSessionPolicy({
        profile,
        goal: goalConfig,
        weekNumber,
        phase,
        actualSessionNumber,
        actualWeekSessionCount: scheduledEntries.length,
        plannedWeekSessionCount: types.length,
        plannedType: entry.type,
        useRunWalk: weekState.useRunWalk,
      });
      const resolvedType = firstSession.protectedType;
      const runWalkPolicy =
        resolvedType === "run-walk"
          ? runWalkMeaningfulRunningPolicy({
              profile,
              goal: goalConfig,
              weekNumber,
              phase,
              actualSessionNumber,
              actualWeekSessionCount: scheduledEntries.length,
              plannedWeekSessionCount: types.length,
              continuityBand: beginnerContinuityBand(profile),
              intervalRunMin: smoothedWeekTargets.intervalRunMin,
              repeats: smoothedWeekTargets.repeats,
              walkBreakMin: weekState.walkBreakMin,
              plannedTypes: types,
            })
          : null;

      return buildSessionByType(resolvedType, {
        weekNumber,
        phase,
        profile,
        goal: goalConfig,
        dayOfWeek: entry.dayOfWeek,
        date: toIsoDate(entry.date),
        isStabilizationWeek,
        continuousRunMin: smoothedWeekTargets.continuousRunMin,
        longRunMin: smoothedWeekTargets.longRunMin,
        intervalRunMin: runWalkPolicy?.intervalRunMin ?? smoothedWeekTargets.intervalRunMin,
        walkBreakMin: runWalkPolicy?.walkBreakMin ?? weekState.walkBreakMin,
        repeats: runWalkPolicy?.repeats ?? smoothedWeekTargets.repeats,
        isGoalSession: isGoalWeek && entry.index === types.length - 1,
      });
    });

    const targetLoad = weeklyLoadTarget(
      profile,
      goalConfig,
      totalWeeks,
      weekNumber,
      phase,
      isStabilizationWeek,
      weekState.weekNumberInPhase,
      weekState.phaseLength,
    );
    const smoothedTargetLoad = smoothWeeklyLoadTarget(
      targetLoad,
      previousLoad,
      phase,
      isStabilizationWeek,
      profile,
      goalConfig,
      beginnerContinuityBand(profile),
      previousWasStabilizationWeek,
    );
    sessions = capWeekLoad(sessions, smoothedTargetLoad, previousLoad);
    const estimatedLoad = Math.round(sessions.reduce((sum, session) => sum + session.estimatedLoad, 0) * 10) / 10;

    weeks.push({
      weekNumber,
      phase,
      focus: focusForWeek(goalConfig, phase, weekState.weekNumberInPhase, weekState.phaseLength, isStabilizationWeek),
      sessions,
      estimatedLoad,
      isStabilizationWeek,
    });

    previousLoad = estimatedLoad;
    previousWeekTargets = smoothedWeekTargets;
    previousWasStabilizationWeek = isStabilizationWeek;
  }

  const sessions = weeks.flatMap((week) => week.sessions);
  const adjustments = buildAdjustmentLog(goalConfig, totalWeeks, phaseTimeline);
  const planSkeleton = {
    goal: goalConfig,
    profile,
    weeks,
    sessions,
    adjustments,
    explanationSummary: [],
  };
  const rationale = {
    plan: buildPlanRationale({
      profile,
      plan: planSkeleton,
      ambitionAdjustment: ambitionAdjustmentRationale(profile, goalConfig, totalWeeks),
    }),
    weeks: buildWeekRationales(planSkeleton),
    workouts: buildWorkoutRationales(planSkeleton),
  };
  const explanationSummary = generatePlanExplanation(profile, {
    ...planSkeleton,
    rationale,
  });

  return {
    ...planSkeleton,
    explanationSummary,
    rationale,
  };
}

export function buildGoalPlan(profile: RunnerProfile, goalConfig: GoalConfig): TrainingPlan {
  const profileWithCategory = profile.runnerCategory ? profile : { ...profile, runnerCategory: classifyRunnerCategory(profile) };
  const planType = choosePlanType(profileWithCategory, goalConfig);

  if (planType === "TenKDistance") {
    return buildTenKDistancePlan(profileWithCategory, goalConfig);
  }

  const plan = buildSharedGoalPlan(profileWithCategory, goalConfig);
  return {
    ...plan,
    planType,
  };
}

export function build5kPlan(profile: RunnerProfile, goalConfig: GoalConfig): TrainingPlan {
  return buildGoalPlan(profile, {
    ...goalConfig,
    goalDistance: "5K",
  });
}
