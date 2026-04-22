import { BaseProgramTrack, GoalConfig, PlanPhase, RunnerProfile } from "./types";

/**
 * Coach-policy layer for entry realism, early-week protection, and load smoothing.
 *
 * Product intent:
 * - Beginners should feel safe, but never passive or filler-heavy.
 * - Walking is a tool for confidence and control, not the dominant session experience.
 * - Short sessions still need a visible main set and meaningful running.
 * - Stronger runners should be recognized early with controlled specificity.
 * - Early progression should feel smooth and credible, especially in week 1 -> 2.
 *
 * These helpers are intentionally explicit so future engine changes can preserve
 * the current StridePilot coach feel instead of reintroducing passive openings,
 * weak running ratios, or abrupt early ramps.
 */
export type ContinuityBand = "ultra_zero" | "one_to_two_min" | "five_min" | "established";

export interface EntryRealismPolicy {
  conservativeCapacityFactor: number;
  continuousStartMax: number | null;
  longRunStartMax: number | null;
  nonLongCapMax: number | null;
  longRunCapMax: number | null;
}

export interface CapacityInterpretationPolicy {
  // When true, early sessions should default to run-walk because the runner still
  // needs protection. The surrounding values should still preserve meaningful running.
  preferRunWalkByDefault: boolean;
  firstWorkoutContinuousMaxMin: number | null;
  firstWorkoutTotalRunMaxMin: number | null;
  introductoryContinuousStartMin: number | null;
  introductoryLongRunStartMin: number | null;
  introductoryIntervalRunMin: number | null;
  introductoryRepeats: number | null;
  introductoryWalkBreakMin: number | null;
  introductoryContinuousFloorMin: number | null;
  introductoryLongRunFloorMin: number | null;
  introductoryIntervalFloorMin: number | null;
}

export interface EarlyWeekRealismPolicy {
  // Early-week policy is the main place where we prevent beginner safety from
  // turning into passivity, and where we keep opening weeks readable and coach-like.
  preferRunWalk: boolean;
  maxContinuousRunMin: number | null;
  maxLongRunMin: number | null;
  maxIntervalRunMin: number | null;
  minWalkBreakMin: number | null;
}

export interface ProgressionRealismPolicy {
  continuousMinFactor: number;
  continuousMaxFactor: number;
  longRunMinFactor: number;
  longRunMaxFactor: number;
  intervalMinFactor: number;
  intervalMaxFactor: number;
  loadMinFactor: number;
  loadMaxFactor: number;
}

export interface TrackPosturePolicy {
  // Track posture controls whether the opening block should feel purely protective,
  // steadily supportive, or intentionally quality-oriented for stronger runners.
  preferEasyOnly: boolean;
  preferSteadySupport: boolean;
  preferControlledQualitySignal: boolean;
}

function protectedGettingStartedRunner(profile: RunnerProfile, continuityBand: ContinuityBand, beginnerLike: boolean): boolean {
  return (
    (profile.baseProgramTrack === "getting_started" || profile.baseProgramTrack === "returning") &&
    beginnerLike &&
    (
      continuityBand !== "established" ||
      profile.currentRunsPerWeek <= 1 ||
      profile.currentWeeklyVolumeKm <= 10 ||
      profile.longestRunMinutes <= 15 ||
      profile.injurySensitivity >= 4 ||
      profile.confidence <= 2
    )
  );
}

function lowCapacityGettingStartedRunner(profile: RunnerProfile, continuityBand: ContinuityBand, beginnerLike: boolean): boolean {
  return (
    (profile.baseProgramTrack === "getting_started" || profile.baseProgramTrack === "returning") &&
    beginnerLike &&
    continuityBand === "established" &&
    profile.currentRunsPerWeek <= 2 &&
    profile.currentWeeklyVolumeKm <= 16 &&
    profile.longestRunMinutes <= 30
  );
}

export function buildEntryRealismPolicy(params: {
  profile: RunnerProfile;
  continuityBand: ContinuityBand;
  beginnerLike: boolean;
}): EntryRealismPolicy {
  const protectedGettingStarted = protectedGettingStartedRunner(params.profile, params.continuityBand, params.beginnerLike);
  const lowCapacityGettingStarted = lowCapacityGettingStartedRunner(params.profile, params.continuityBand, params.beginnerLike);

  if (protectedGettingStarted) {
    return {
      conservativeCapacityFactor: 0.86,
      continuousStartMax: 12,
      longRunStartMax: 22,
      nonLongCapMax: 34,
      longRunCapMax: 56,
    };
  }

  if (lowCapacityGettingStarted) {
    return {
      conservativeCapacityFactor: 0.9,
      continuousStartMax: 18,
      longRunStartMax: 34,
      nonLongCapMax: 45,
      longRunCapMax: 72,
    };
  }

  return {
    conservativeCapacityFactor: 1,
    continuousStartMax: null,
    longRunStartMax: null,
    nonLongCapMax: null,
    longRunCapMax: null,
  };
}

export function buildCapacityInterpretationPolicy(params: {
  profile: RunnerProfile;
  continuityBand: ContinuityBand;
  beginnerLike: boolean;
}): CapacityInterpretationPolicy {
  // This policy encodes the beginner philosophy that came out of the hardening work:
  // even the weakest runner should get a session that feels manageable and real.
  // The ultra-protected presets therefore limit passivity while still staying calm.
  const protectedGettingStarted = protectedGettingStartedRunner(params.profile, params.continuityBand, params.beginnerLike);
  const lowCapacityGettingStarted = lowCapacityGettingStartedRunner(params.profile, params.continuityBand, params.beginnerLike);

  if (params.continuityBand === "ultra_zero") {
    return {
      preferRunWalkByDefault: true,
      firstWorkoutContinuousMaxMin: 1,
      firstWorkoutTotalRunMaxMin: 6,
      introductoryContinuousStartMin: 1,
      introductoryLongRunStartMin: 8,
      introductoryIntervalRunMin: 1.5,
      introductoryRepeats: 4,
      introductoryWalkBreakMin: 1.25,
      introductoryContinuousFloorMin: 1,
      introductoryLongRunFloorMin: 8,
      introductoryIntervalFloorMin: 1.5,
    };
  }

  if (params.continuityBand === "one_to_two_min") {
    return {
      preferRunWalkByDefault: true,
      firstWorkoutContinuousMaxMin: 2,
      firstWorkoutTotalRunMaxMin: 5,
      introductoryContinuousStartMin: 2,
      introductoryLongRunStartMin: 10,
      introductoryIntervalRunMin: 1,
      introductoryRepeats: 5,
      introductoryWalkBreakMin: 1.75,
      introductoryContinuousFloorMin: 2,
      introductoryLongRunFloorMin: 10,
      introductoryIntervalFloorMin: 1,
    };
  }

  if (params.continuityBand === "five_min") {
    return {
      preferRunWalkByDefault: true,
      firstWorkoutContinuousMaxMin: 4,
      firstWorkoutTotalRunMaxMin: 6,
      introductoryContinuousStartMin: 4,
      introductoryLongRunStartMin: 14,
      introductoryIntervalRunMin: 1,
      introductoryRepeats: 4,
      introductoryWalkBreakMin: 2,
      introductoryContinuousFloorMin: 4,
      introductoryLongRunFloorMin: 14,
      introductoryIntervalFloorMin: 1,
    };
  }

  if (protectedGettingStarted) {
    return {
      preferRunWalkByDefault: true,
      firstWorkoutContinuousMaxMin: 4,
      firstWorkoutTotalRunMaxMin: 10,
      introductoryContinuousStartMin: 4,
      introductoryLongRunStartMin: 14,
      introductoryIntervalRunMin: 2,
      introductoryRepeats: 5,
      introductoryWalkBreakMin: 1.75,
      introductoryContinuousFloorMin: 4,
      introductoryLongRunFloorMin: 14,
      introductoryIntervalFloorMin: 2,
    };
  }

  if (lowCapacityGettingStarted) {
    return {
      preferRunWalkByDefault: true,
      firstWorkoutContinuousMaxMin: 6,
      firstWorkoutTotalRunMaxMin: 10,
      introductoryContinuousStartMin: 6,
      introductoryLongRunStartMin: 18,
      introductoryIntervalRunMin: 1.5,
      introductoryRepeats: 4,
      introductoryWalkBreakMin: 1.75,
      introductoryContinuousFloorMin: 6,
      introductoryLongRunFloorMin: 18,
      introductoryIntervalFloorMin: 1.5,
    };
  }

  return {
    preferRunWalkByDefault: false,
    firstWorkoutContinuousMaxMin: null,
    firstWorkoutTotalRunMaxMin: null,
    introductoryContinuousStartMin: null,
    introductoryLongRunStartMin: null,
    introductoryIntervalRunMin: null,
    introductoryRepeats: null,
    introductoryWalkBreakMin: null,
    introductoryContinuousFloorMin: null,
    introductoryLongRunFloorMin: null,
    introductoryIntervalFloorMin: null,
  };
}

export function buildEarlyWeekRealismPolicy(params: {
  profile: RunnerProfile;
  continuityBand: ContinuityBand;
  beginnerLike: boolean;
  phase: PlanPhase;
  weekNumberInPhase: number;
}): EarlyWeekRealismPolicy {
  // Early-week realism is where we keep the first block from becoming either
  // too passive for beginners or too generic for runners who already have base.
  const protectedGettingStarted = protectedGettingStartedRunner(params.profile, params.continuityBand, params.beginnerLike);
  const lowCapacityGettingStarted = lowCapacityGettingStartedRunner(params.profile, params.continuityBand, params.beginnerLike);
  const lowCapacityRunWalk = lowCapacityGettingStarted && params.profile.realisticTrainingDaysPerWeek <= 3 && params.profile.currentRunsPerWeek <= 2;

  if (!protectedGettingStarted && !lowCapacityGettingStarted) {
    return {
      preferRunWalk: false,
      maxContinuousRunMin: null,
      maxLongRunMin: null,
      maxIntervalRunMin: null,
      minWalkBreakMin: null,
    };
  }

  if (params.phase === "introduction") {
    return protectedGettingStarted
      ? {
          preferRunWalk: true,
          maxContinuousRunMin: 12 + (params.weekNumberInPhase - 1) * 2,
          maxLongRunMin: 22 + (params.weekNumberInPhase - 1) * 4,
          maxIntervalRunMin: 2,
          minWalkBreakMin: params.continuityBand === "ultra_zero" ? 1.25 : params.continuityBand === "one_to_two_min" ? 1.5 : 1.75,
        }
      : {
          preferRunWalk: lowCapacityRunWalk,
          maxContinuousRunMin: 18 + (params.weekNumberInPhase - 1) * 2,
          maxLongRunMin: 34 + (params.weekNumberInPhase - 1) * 4,
          maxIntervalRunMin: 3,
          minWalkBreakMin: 1.5,
        };
  }

  if (params.phase === "continuous_running" && params.weekNumberInPhase <= 2) {
    return protectedGettingStarted
      ? {
          preferRunWalk: true,
          maxContinuousRunMin: 16 + (params.weekNumberInPhase - 1) * 2,
          maxLongRunMin: 32 + (params.weekNumberInPhase - 1) * 4,
          maxIntervalRunMin: 3,
          minWalkBreakMin: 1.5,
        }
      : {
          preferRunWalk: lowCapacityRunWalk,
          maxContinuousRunMin: 20 + (params.weekNumberInPhase - 1) * 2,
          maxLongRunMin: 40 + (params.weekNumberInPhase - 1) * 4,
          maxIntervalRunMin: 4,
          minWalkBreakMin: 1.25,
        };
  }

  return {
    preferRunWalk: false,
    maxContinuousRunMin: null,
    maxLongRunMin: null,
    maxIntervalRunMin: null,
    minWalkBreakMin: null,
  };
}

export function buildProgressionRealismPolicy(params: {
  profile: RunnerProfile;
  continuityBand: ContinuityBand;
  beginnerLike: boolean;
  goal: GoalConfig;
  phase: PlanPhase;
  isStabilizationWeek: boolean;
  previousWasStabilizationWeek: boolean;
}): ProgressionRealismPolicy {
  // This policy is the main safeguard against early week-to-week trust breaks.
  // It should keep opening progression smooth enough to feel coached, while still
  // allowing stronger runners to see credible forward movement.
  const marathonLike = params.goal.goalDistance === "Halvmaraton" || params.goal.goalDistance === "Marathon";
  const protectedGettingStarted = protectedGettingStartedRunner(params.profile, params.continuityBand, params.beginnerLike);
  const lowCapacityGettingStarted = lowCapacityGettingStartedRunner(params.profile, params.continuityBand, params.beginnerLike);

  let longRunMaxFactor =
    params.phase === "race_preparation"
      ? 1.06
      : params.isStabilizationWeek
        ? 1.01
        : params.previousWasStabilizationWeek
          ? marathonLike ? 1.08 : 1.1
          : marathonLike ? 1.1 : 1.12;
  let longRunMinFactor =
    params.phase === "race_preparation"
      ? 0.84
      : params.isStabilizationWeek
        ? 0.9
        : params.previousWasStabilizationWeek
          ? 0.96
          : 0.94;
  let continuousMaxFactor = params.isStabilizationWeek ? 1.01 : params.previousWasStabilizationWeek ? 1.08 : 1.1;
  let continuousMinFactor = params.phase === "race_preparation" ? 0.86 : params.isStabilizationWeek ? 0.92 : 0.95;
  let intervalMaxFactor = params.isStabilizationWeek ? 1.02 : params.previousWasStabilizationWeek ? 1.08 : 1.12;
  let intervalMinFactor = params.phase === "race_preparation" ? 0.9 : params.isStabilizationWeek ? 0.94 : 0.92;
  let loadMinFactor = params.isStabilizationWeek ? 0.88 : params.phase === "race_preparation" ? 0.84 : 0.94;
  let loadMaxFactor = params.isStabilizationWeek ? 0.97 : params.phase === "race_preparation" ? 1.05 : 1.14;

  if (protectedGettingStarted || lowCapacityGettingStarted) {
    longRunMaxFactor = Math.min(longRunMaxFactor, protectedGettingStarted ? 1.08 : 1.1);
    continuousMaxFactor = Math.min(continuousMaxFactor, protectedGettingStarted ? 1.06 : 1.08);
    intervalMaxFactor = Math.min(intervalMaxFactor, protectedGettingStarted ? 1.04 : 1.06);
    loadMaxFactor = Math.min(loadMaxFactor, protectedGettingStarted ? 1.08 : 1.1);
    longRunMinFactor = Math.max(longRunMinFactor, params.isStabilizationWeek ? 0.92 : 0.95);
    continuousMinFactor = Math.max(continuousMinFactor, params.isStabilizationWeek ? 0.94 : 0.96);
    intervalMinFactor = Math.max(intervalMinFactor, params.isStabilizationWeek ? 0.95 : 0.94);
    loadMinFactor = Math.max(loadMinFactor, params.isStabilizationWeek ? 0.9 : 0.96);
  }

  return {
    continuousMinFactor,
    continuousMaxFactor,
    longRunMinFactor,
    longRunMaxFactor,
    intervalMinFactor,
    intervalMaxFactor,
    loadMinFactor,
    loadMaxFactor,
  };
}

export function buildTrackPosturePolicy(params: {
  profile: RunnerProfile;
  track: BaseProgramTrack;
  continuityBand: ContinuityBand;
  beginnerLike: boolean;
  phase: PlanPhase;
  weekNumberInPhase: number;
  useRunWalk: boolean;
  effectivePerformance: boolean;
}): TrackPosturePolicy {
  // Opening-week training identity lives here: easy-only for protected entries,
  // steady support for calm durability tracks, and a controlled quality signal
  // for stronger goal-focused runners who should be recognized early.
  const earlyWeeks = params.phase === "introduction" || (params.phase === "continuous_running" && params.weekNumberInPhase <= 2);
  const protectedEntry = protectedGettingStartedRunner(params.profile, params.continuityBand, params.beginnerLike);
  const lowCapacityEntry = lowCapacityGettingStartedRunner(params.profile, params.continuityBand, params.beginnerLike);
  return {
    preferEasyOnly: (params.track === "getting_started" || protectedEntry || lowCapacityEntry) && earlyWeeks,
    preferSteadySupport: params.track === "steady_runner" && !params.useRunWalk,
    preferControlledQualitySignal: params.track === "goal_focused" && params.effectivePerformance && !params.useRunWalk && earlyWeeks,
  };
}

export function goalEventMinimumRealismMinutes(params: {
  goal: GoalConfig;
  profile: RunnerProfile;
}): number | null {
  if (params.goal.goalIntent !== "target_time") return null;
  if (params.goal.goalDistance === "Halvmaraton") return params.profile.longestRunMinutes * 0.82;
  if (params.goal.goalDistance === "Marathon") return params.profile.longestRunMinutes * 0.9;
  return null;
}
