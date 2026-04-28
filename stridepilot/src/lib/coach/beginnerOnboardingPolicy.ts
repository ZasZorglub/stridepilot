import type { GoalConfig, PlanPhase, RunnerProfile, WorkoutStructureSegment, WorkoutType } from "./types";
import {
  beginnerRunWalkProtectionPosture,
  buildCapacityInterpretationPolicy,
  buildEarlyWeekRealismPolicy,
  type BeginnerRunWalkProtectionPosture,
  type ContinuityBand,
} from "./realismPolicy";

export interface FirstSessionPolicyResult {
  applies: boolean;
  protectedType: WorkoutType;
}

export interface FirstSessionRunWalkOpeningPolicyResult {
  applies: boolean;
  opening: WorkoutStructureSegment[];
}

export interface BeginnerWeekOneVariationResult {
  runMinutesBoostMin: number;
  repeatBoost: number;
  walkBreakReductionMin: number;
}

export interface RunWalkMeaningfulRunningResult {
  intervalRunMin: number;
  repeats: number;
  walkBreakMin: number;
}

export interface EarlyBeginnerBlockPolicyResult {
  runMinutesBoostMin: number;
  repeatBoost: number;
  walkBreakReductionMin: number;
  minTotalRunningMin: number;
  maxPauseRatio: number;
}

export interface BeginnerProgressionPolicy {
  protectionPosture: BeginnerRunWalkProtectionPosture;
  continuityBand: ContinuityBand;
  runWalkExitReadiness: "protected" | "ready_to_exit";
  earliestContinuousWeek: number | null;
  exitReason: string | null;
  protectionReason: string | null;
  shouldPreferRunWalk: boolean;
  firstSessionProtection: FirstSessionPolicyResult | null;
  runWalkDensityFloor: EarlyBeginnerBlockPolicyResult | null;
  easySessionCredibilityFloor: { applies: boolean; minSessionDurationMin: number; minRunningMin: number } | null;
  isWeakBeginner: boolean;
  isCapableRecentOrReturning: boolean;
  isCautiousLongBreak: boolean;
}

export interface BeginnerProgressionPolicyContext extends BeginnerOnboardingBaseContext {
  weekNumberInPhase: number;
  plannedType?: WorkoutType;
  plannedTypes?: WorkoutType[];
  useRunWalk?: boolean;
  continuityBand?: ContinuityBand;
  intervalRunMin?: number;
  repeats?: number;
  walkBreakMin?: number;
  continuousRunMin?: number;
}

interface RunWalkExitPolicy {
  runWalkExitReadiness: BeginnerProgressionPolicy["runWalkExitReadiness"];
  earliestContinuousWeek: number | null;
  exitReason: string | null;
  protectionReason: string | null;
  shouldPreferRunWalk: boolean;
}

function earlyProgressionRunWalkPolicy(
  context: RunWalkMeaningfulRunningPolicyContext,
): EarlyBeginnerBlockPolicyResult | null {
  if (!beginnerOnboardingProfile(context.profile)) return null;
  if (context.weekNumber < 3 || context.weekNumber > 6) return null;
  if (context.phase !== "continuous_running" && context.phase !== "capacity") return null;

  const weakest = weakestBeginnerProfile(context.profile);
  return {
    runMinutesBoostMin: weakest ? 0 : 0.25,
    repeatBoost: 0,
    walkBreakReductionMin: 0.5,
    minTotalRunningMin: weakest ? 8.5 : 10.5,
    maxPauseRatio: weakest ? 0.8 : 0.85,
  };
}

interface BeginnerOnboardingBaseContext {
  profile: RunnerProfile;
  goal: GoalConfig;
  weekNumber: number;
  phase: string;
  actualSessionNumber: number;
  actualWeekSessionCount: number;
  plannedWeekSessionCount: number;
}

interface FirstSessionPolicyContext extends BeginnerOnboardingBaseContext {
  plannedType: WorkoutType;
  useRunWalk: boolean;
}

interface BeginnerWeekOneVariationPolicyContext extends BeginnerOnboardingBaseContext {
  plannedTypes: WorkoutType[];
  useRunWalk: boolean;
}

interface RunWalkMeaningfulRunningPolicyContext extends BeginnerOnboardingBaseContext {
  continuityBand: ContinuityBand;
  intervalRunMin: number;
  repeats: number;
  walkBreakMin: number;
  plannedTypes: WorkoutType[];
}

function continuityBandForBeginnerProgression(profile: RunnerProfile): ContinuityBand {
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

function beginnerSafeForProgression(profile: RunnerProfile): boolean {
  return (
    profile.runningSpecificity <= 2 ||
    profile.currentRunsPerWeek <= 2 ||
    profile.currentWeeklyVolumeKm <= 15 ||
    profile.injurySensitivity >= 4
  );
}

function allowRunWalkForProgression(profile: RunnerProfile, goal: GoalConfig, continuityBand: ContinuityBand): boolean {
  const strongBackground =
    profile.currentWeeklyVolumeKm >= 35 ||
    (profile.currentWeeklyVolumeKm >= 25 && goal.goalDistance !== "5K") ||
    (profile.currentRunsPerWeek >= 3 && profile.longestRunMinutes >= 35) ||
    profile.currentRunsPerWeek >= 4 ||
    ((goal.goalDistance === "Halvmaraton" || goal.goalDistance === "Marathon") && profile.longestRunMinutes >= 60);

  if (continuityBand !== "established") return true;
  if (strongBackground) return false;
  if (goal.goalDistance === "10K" && (profile.currentRunsPerWeek >= 2 || profile.longestRunMinutes >= 30 || profile.currentWeeklyVolumeKm >= 12)) {
    return false;
  }
  if ((goal.goalDistance === "Halvmaraton" || goal.goalDistance === "Marathon") && profile.currentWeeklyVolumeKm >= 15) {
    return false;
  }
  return true;
}

function easySessionCredibilityFloor(context: BeginnerProgressionPolicyContext) {
  const category = beginnerCategory(context.profile);
  const beginnerLike =
    category === "true_beginner" ||
    category === "run_walk_beginner" ||
    category === "continuous_beginner";
  const postOnboardingPhase = context.phase !== "introduction";
  const intervalRunMin = context.intervalRunMin ?? 0;
  const repeats = context.repeats ?? 0;
  const continuousRunMin = context.continuousRunMin ?? 0;

  if (!beginnerLike || !postOnboardingPhase) {
    return null;
  }

  const establishedRunWalkCapacity = roundToQuarter(intervalRunMin * Math.max(repeats, 1));
  if (continuousRunMin >= 6 || establishedRunWalkCapacity < 7) {
    return null;
  }

  return {
    applies: true,
    minSessionDurationMin: 9,
    minRunningMin: 6,
  };
}

function deriveRunWalkExitPolicy(params: {
  profile: RunnerProfile;
  goal: GoalConfig;
  phase: string;
  weekNumberInPhase: number;
  continuityBand: ContinuityBand;
  beginnerLike: boolean;
  protectionPosture: BeginnerRunWalkProtectionPosture;
}): RunWalkExitPolicy {
  const { profile, goal, phase, weekNumberInPhase, continuityBand, beginnerLike, protectionPosture } = params;
  const capacityPolicy = buildCapacityInterpretationPolicy({
    profile,
    continuityBand,
    beginnerLike,
  });
  const earlyWeekPolicy = buildEarlyWeekRealismPolicy({
    profile,
    continuityBand,
    beginnerLike,
    phase: phase as PlanPhase,
    weekNumberInPhase,
  });

  if (!allowRunWalkForProgression(profile, goal, continuityBand)) {
    return {
      runWalkExitReadiness: "ready_to_exit",
      earliestContinuousWeek: 1,
      exitReason: "runner already has enough background that run-walk is not needed",
      protectionReason: null,
      shouldPreferRunWalk: false,
    };
  }

  if (protectionPosture === "capable_recent_or_returning") {
    return {
      runWalkExitReadiness: weekNumberInPhase >= 2 ? "ready_to_exit" : "protected",
      earliestContinuousWeek: 2,
      exitReason: "recent or returning beginner already has meaningful continuous capacity",
      protectionReason: weekNumberInPhase < 2 ? "keep one protected opening week before transitioning out of run-walk" : null,
      shouldPreferRunWalk: phase === "introduction" && weekNumberInPhase === 1,
    };
  }

  if (protectionPosture === "capable_long_break") {
    return {
      runWalkExitReadiness: weekNumberInPhase >= 3 ? "ready_to_exit" : "protected",
      earliestContinuousWeek: 3,
      exitReason: "capacity is present, but long-break posture keeps an extra protected week",
      protectionReason: weekNumberInPhase < 3 ? "keep a calmer two-week run-walk re-entry before transitioning" : null,
      shouldPreferRunWalk: phase === "introduction" && weekNumberInPhase <= 2,
    };
  }

  if (capacityPolicy.preferRunWalkByDefault && (phase === "introduction" || (phase === "continuous_running" && weekNumberInPhase <= 1))) {
    return {
      runWalkExitReadiness: "protected",
      earliestContinuousWeek: continuityBand === "ultra_zero" ? 6 : continuityBand === "one_to_two_min" ? 4 : 3,
      exitReason: null,
      protectionReason: "capacity interpretation still calls for protected run-walk as the default opening family",
      shouldPreferRunWalk: true,
    };
  }

  if (earlyWeekPolicy.preferRunWalk) {
    return {
      runWalkExitReadiness: "protected",
      earliestContinuousWeek: continuityBand === "ultra_zero" ? 6 : continuityBand === "one_to_two_min" ? 4 : continuityBand === "five_min" ? 3 : 2,
      exitReason: null,
      protectionReason: "early-week realism still prefers run-walk to keep the opening block calm and credible",
      shouldPreferRunWalk: true,
    };
  }

  if (continuityBand === "ultra_zero") {
    const shouldPreferRunWalk = phase === "introduction" || (phase === "continuous_running" && weekNumberInPhase === 1);
    return {
      runWalkExitReadiness: shouldPreferRunWalk ? "protected" : "ready_to_exit",
      earliestContinuousWeek: 6,
      exitReason: shouldPreferRunWalk ? null : "the weakest beginner has cleared the protected early block",
      protectionReason: shouldPreferRunWalk ? "true beginners keep the longest run-walk onboarding arc" : null,
      shouldPreferRunWalk,
    };
  }

  if (continuityBand === "one_to_two_min") {
    const shouldPreferRunWalk = phase === "introduction" || (phase === "continuous_running" && weekNumberInPhase <= 1);
    return {
      runWalkExitReadiness: shouldPreferRunWalk ? "protected" : "ready_to_exit",
      earliestContinuousWeek: 4,
      exitReason: shouldPreferRunWalk ? null : "short continuous capacity is established enough to move toward easy running",
      protectionReason: shouldPreferRunWalk ? "short-capacity beginners still need a protected run-walk opening block" : null,
      shouldPreferRunWalk,
    };
  }

  if (continuityBand === "five_min") {
    const shouldPreferRunWalk = phase === "introduction" && weekNumberInPhase <= 2;
    return {
      runWalkExitReadiness: shouldPreferRunWalk ? "protected" : "ready_to_exit",
      earliestContinuousWeek: 3,
      exitReason: shouldPreferRunWalk ? null : "five-minute continuity band can move into early continuous running after the opening weeks",
      protectionReason: shouldPreferRunWalk ? "five-minute beginners still get a short protected run-walk opening" : null,
      shouldPreferRunWalk,
    };
  }

  if (phase === "capacity" || phase === "race_preparation") {
    return {
      runWalkExitReadiness: "ready_to_exit",
      earliestContinuousWeek: 1,
      exitReason: "later phases should not stay in beginner run-walk unless a stronger policy says otherwise",
      protectionReason: null,
      shouldPreferRunWalk: false,
    };
  }

  if (goal.goalDistance === "Marathon" && phase !== "introduction") {
    return {
      runWalkExitReadiness: "ready_to_exit",
      earliestContinuousWeek: 1,
      exitReason: "marathon track outside introduction should move on from beginner run-walk",
      protectionReason: null,
      shouldPreferRunWalk: false,
    };
  }

  if (profile.archetype === "nervous_beginner") {
    const shouldPreferRunWalk = weekNumberInPhase <= 3 || profile.runningSpecificity <= 2;
    return {
      runWalkExitReadiness: shouldPreferRunWalk ? "protected" : "ready_to_exit",
      earliestContinuousWeek: 4,
      exitReason: shouldPreferRunWalk ? null : "nervous beginner has enough specificity to leave repeated run-walk",
      protectionReason: shouldPreferRunWalk ? "nervous beginner posture keeps a longer protected run-walk ramp" : null,
      shouldPreferRunWalk,
    };
  }

  if (profile.archetype === "returning_runner") {
    const shouldPreferRunWalk = phase === "introduction" && weekNumberInPhase <= 2 && profile.runningSpecificity <= 3;
    return {
      runWalkExitReadiness: shouldPreferRunWalk ? "protected" : "ready_to_exit",
      earliestContinuousWeek: 3,
      exitReason: shouldPreferRunWalk ? null : "returning runner has enough current specificity to move back into continuous running",
      protectionReason: shouldPreferRunWalk ? "returning posture keeps a short re-entry buffer" : null,
      shouldPreferRunWalk,
    };
  }

  if (profile.currentRunsPerWeek <= 1 && profile.longestRunMinutes <= 20) {
    const shouldPreferRunWalk = weekNumberInPhase <= 2;
    return {
      runWalkExitReadiness: shouldPreferRunWalk ? "protected" : "ready_to_exit",
      earliestContinuousWeek: 3,
      exitReason: shouldPreferRunWalk ? null : "basic continuity is now enough for calm easy running",
      protectionReason: shouldPreferRunWalk ? "low current frequency still warrants a short run-walk opening block" : null,
      shouldPreferRunWalk,
    };
  }

  const shouldPreferRunWalk = phase === "introduction" && weekNumberInPhase === 1 && profile.runningSpecificity <= 2 && profile.confidence <= 2;
  return {
    runWalkExitReadiness: shouldPreferRunWalk ? "protected" : "ready_to_exit",
    earliestContinuousWeek: shouldPreferRunWalk ? 2 : 1,
    exitReason: shouldPreferRunWalk ? null : "no remaining beginner signal requires repeated run-walk",
    protectionReason: shouldPreferRunWalk ? "low confidence still keeps one protected opening week" : null,
    shouldPreferRunWalk,
  };
}

export function getBeginnerProgressionPolicy(context: BeginnerProgressionPolicyContext): BeginnerProgressionPolicy {
  const continuityBand = context.continuityBand ?? continuityBandForBeginnerProgression(context.profile);
  const beginnerLike = beginnerSafeForProgression(context.profile);
  const protectionPosture = beginnerRunWalkProtectionPosture({
    profile: context.profile,
    continuityBand,
    beginnerLike,
  });
  const runWalkExitPolicy = deriveRunWalkExitPolicy({
    profile: context.profile,
    goal: context.goal,
    phase: context.phase,
    weekNumberInPhase: context.weekNumberInPhase,
    continuityBand,
    beginnerLike,
    protectionPosture,
  });
  const shouldPreferRunWalk = runWalkExitPolicy.shouldPreferRunWalk;

  const firstSessionProtection =
    context.plannedType && context.useRunWalk != null
      ? firstSessionPolicy({
          profile: context.profile,
          goal: context.goal,
          weekNumber: context.weekNumber,
          phase: context.phase,
          actualSessionNumber: context.actualSessionNumber,
          actualWeekSessionCount: context.actualWeekSessionCount,
          plannedWeekSessionCount: context.plannedWeekSessionCount,
          plannedType: context.plannedType,
          useRunWalk: context.useRunWalk,
        })
      : null;

  const runWalkDensityFloor =
    context.intervalRunMin != null &&
    context.repeats != null &&
    context.walkBreakMin != null &&
    context.plannedTypes
      ? (beginnerOnboardingProfile(context.profile) && context.phase === "introduction" && context.weekNumber <= 3
          ? earlyBeginnerBlockPolicy({
              profile: context.profile,
              goal: context.goal,
              weekNumber: context.weekNumber,
              phase: context.phase,
              actualSessionNumber: context.actualSessionNumber,
              actualWeekSessionCount: context.actualWeekSessionCount,
              plannedWeekSessionCount: context.plannedWeekSessionCount,
              plannedTypes: context.plannedTypes,
              useRunWalk: context.useRunWalk ?? shouldPreferRunWalk,
            })
          : earlyProgressionRunWalkPolicy({
              profile: context.profile,
              goal: context.goal,
              weekNumber: context.weekNumber,
              phase: context.phase,
              actualSessionNumber: context.actualSessionNumber,
              actualWeekSessionCount: context.actualWeekSessionCount,
              plannedWeekSessionCount: context.plannedWeekSessionCount,
              continuityBand,
              intervalRunMin: context.intervalRunMin,
              repeats: context.repeats,
              walkBreakMin: context.walkBreakMin,
              plannedTypes: context.plannedTypes,
            }))
      : null;

  return {
    protectionPosture,
    continuityBand,
    runWalkExitReadiness: runWalkExitPolicy.runWalkExitReadiness,
    earliestContinuousWeek: runWalkExitPolicy.earliestContinuousWeek,
    exitReason: runWalkExitPolicy.exitReason,
    protectionReason: runWalkExitPolicy.protectionReason,
    shouldPreferRunWalk,
    firstSessionProtection,
    runWalkDensityFloor,
    easySessionCredibilityFloor: easySessionCredibilityFloor(context),
    isWeakBeginner: weakestBeginnerProfile(context.profile),
    isCapableRecentOrReturning: protectionPosture === "capable_recent_or_returning",
    isCautiousLongBreak: protectionPosture === "capable_long_break",
  };
}

function beginnerCategory(profile: RunnerProfile): RunnerProfile["runnerCategory"] {
  return profile.runnerCategory ?? "recreational";
}

function beginnerOnboardingProfile(profile: RunnerProfile): boolean {
  const category = beginnerCategory(profile);
  return (
    category === "true_beginner" ||
    category === "run_walk_beginner" ||
    category === "continuous_beginner" ||
    ((profile.baseProgramTrack === "getting_started" || profile.baseProgramTrack === "returning") &&
      profile.currentRunsPerWeek <= 2 &&
      profile.longestRunMinutes <= 20)
  );
}

function weakestBeginnerProfile(profile: RunnerProfile): boolean {
  const category = beginnerCategory(profile);
  return (
    category === "true_beginner" ||
    (category === "run_walk_beginner" && profile.confidence <= 2) ||
    (profile.baseProgramTrack === "getting_started" &&
      profile.currentRunsPerWeek === 0 &&
      profile.longestRunMinutes <= 10 &&
      profile.confidence <= 2)
  );
}

function partialOpeningWeek(context: BeginnerOnboardingBaseContext): boolean {
  return context.weekNumber === 1 && context.actualWeekSessionCount > 0 && context.actualWeekSessionCount < context.plannedWeekSessionCount;
}

function roundToQuarter(value: number): number {
  return Math.round(value * 4) / 4;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function firstSessionPolicy(context: FirstSessionPolicyContext): FirstSessionPolicyResult {
  if (context.weekNumber !== 1 || context.actualSessionNumber !== 1) {
    return { applies: false, protectedType: context.plannedType };
  }

  const partialWeek = partialOpeningWeek(context);
  const beginnerOnboarding = beginnerOnboardingProfile(context.profile) && context.phase === "introduction";

  if (!beginnerOnboarding && !partialWeek && context.actualWeekSessionCount > 2) {
    return { applies: false, protectedType: context.plannedType };
  }

  const protectedType = beginnerOnboarding
    ? context.useRunWalk || beginnerCategory(context.profile) === "true_beginner" || beginnerCategory(context.profile) === "run_walk_beginner"
      ? "run-walk"
      : context.plannedType === "recovery"
        ? "recovery"
        : "easy"
    : context.plannedType === "run-walk" || context.plannedType === "easy" || context.plannedType === "recovery"
      ? context.plannedType
      : "easy";

  const shouldProtect = partialWeek || (beginnerOnboarding && (context.actualWeekSessionCount <= 2 || weakestBeginnerProfile(context.profile)));
  return {
    applies: shouldProtect,
    protectedType: shouldProtect ? protectedType : context.plannedType,
  };
}

/**
 * Keep the very first protected beginner run-walk workout coach-like:
 * a runner who has been running recently can start a touch more actively,
 * while a long-break/new runner keeps the gentler walk+jog entry.
 */
export function firstSessionRunWalkOpeningPolicy(
  context: BeginnerOnboardingBaseContext,
): FirstSessionRunWalkOpeningPolicyResult {
  const recentProtectedContinuousBeginner =
    context.weekNumber === 1 &&
    context.phase === "introduction" &&
    context.actualSessionNumber === 1 &&
    beginnerCategory(context.profile) === "continuous_beginner" &&
    context.profile.baseProgramTrack === "getting_started" &&
    context.profile.archetype === "fit_but_inexperienced";

  if (!recentProtectedContinuousBeginner) {
    return { applies: false, opening: [] };
  }

  return {
    applies: true,
    opening: [{ type: "recovery", label: "Let jog", durationMin: 3.5 }],
  };
}

export function beginnerWeekOneVariationPolicy(context: BeginnerWeekOneVariationPolicyContext): BeginnerWeekOneVariationResult {
  if (!beginnerOnboardingProfile(context.profile) || context.phase !== "introduction" || context.weekNumber !== 1 || context.actualWeekSessionCount <= 1) {
    return { runMinutesBoostMin: 0, repeatBoost: 0, walkBreakReductionMin: 0 };
  }

  const repeatedRunWalkWeek = context.plannedTypes.every((type) => type === "run-walk");
  if (!repeatedRunWalkWeek || !context.useRunWalk) {
    return { runMinutesBoostMin: 0, repeatBoost: 0, walkBreakReductionMin: 0 };
  }

  if (context.actualSessionNumber === 1) {
    return weakestBeginnerProfile(context.profile)
      ? { runMinutesBoostMin: 0, repeatBoost: 0, walkBreakReductionMin: 0.25 }
      : { runMinutesBoostMin: 0, repeatBoost: 0, walkBreakReductionMin: 0 };
  }

  if (context.actualSessionNumber === 2) {
    return weakestBeginnerProfile(context.profile)
      ? { runMinutesBoostMin: 0.25, repeatBoost: 0, walkBreakReductionMin: 0.25 }
      : { runMinutesBoostMin: 0.5, repeatBoost: 0, walkBreakReductionMin: 0.25 };
  }

  return weakestBeginnerProfile(context.profile)
    ? { runMinutesBoostMin: 0.5, repeatBoost: 0, walkBreakReductionMin: 0.25 }
    : { runMinutesBoostMin: 0.5, repeatBoost: 1, walkBreakReductionMin: 0.25 };
}

/**
 * earlyBeginnerBlockPolicy:
 * treat the first 2-3 weeks for the weakest beginner runners as one coached
 * opening block rather than isolated week-specific tweaks.
 */
export function earlyBeginnerBlockPolicy(
  context: BeginnerWeekOneVariationPolicyContext,
): EarlyBeginnerBlockPolicyResult {
  if (!beginnerOnboardingProfile(context.profile) || context.phase !== "introduction" || context.weekNumber > 4 || !context.useRunWalk) {
    return {
      runMinutesBoostMin: 0,
      repeatBoost: 0,
      walkBreakReductionMin: 0,
      minTotalRunningMin: 0,
      maxPauseRatio: 1,
    };
  }

  const weakest = weakestBeginnerProfile(context.profile);
  const repeatedRunWalkWeek = context.plannedTypes.every((type) => type === "run-walk");
  const weekOneVariation = beginnerWeekOneVariationPolicy(context);

  if (context.weekNumber === 1) {
    return {
      runMinutesBoostMin: weekOneVariation.runMinutesBoostMin,
      repeatBoost: weekOneVariation.repeatBoost,
      walkBreakReductionMin: weekOneVariation.walkBreakReductionMin,
      minTotalRunningMin:
        beginnerCategory(context.profile) === "true_beginner"
          ? context.actualSessionNumber >= 3
            ? 9
            : context.actualSessionNumber === 2
              ? 8
              : 6
          : context.actualSessionNumber >= 2
            ? 10
            : 8,
      maxPauseRatio: weakest ? 1 : 0.95,
    };
  }

  const perSessionBoost =
    context.actualSessionNumber === 1
      ? 0
      : context.actualSessionNumber === 2
        ? 0.25
        : 0.5;

  if (weakest && repeatedRunWalkWeek) {
    if (context.weekNumber === 4) {
      return {
        runMinutesBoostMin: 0,
        repeatBoost: 0,
        walkBreakReductionMin: 0,
        minTotalRunningMin: 8.75,
        maxPauseRatio: 0.9,
      };
    }

    return {
      runMinutesBoostMin: (context.weekNumber === 2 ? 0.25 : 0.5) + perSessionBoost,
      repeatBoost: context.weekNumber === 2 && context.actualSessionNumber === 3 ? 0 : 0,
      walkBreakReductionMin: context.weekNumber === 2 ? 0.25 : 0.5,
      minTotalRunningMin:
        context.weekNumber === 2
          ? context.actualSessionNumber === 1
            ? 8.5
            : context.actualSessionNumber === 2
              ? 9.5
              : 10.5
          : context.actualSessionNumber === 1
            ? 9.5
            : context.actualSessionNumber === 2
              ? 10.5
              : 11,
      maxPauseRatio: 0.9,
    };
  }

  return {
    runMinutesBoostMin: context.weekNumber === 2 ? 0.25 : 0.5,
    repeatBoost: 0,
    walkBreakReductionMin: 0.25,
    minTotalRunningMin:
      context.weekNumber === 2
        ? 11.25
        : 12,
    maxPauseRatio: 0.9,
  };
}

export function runWalkMeaningfulRunningPolicy(context: RunWalkMeaningfulRunningPolicyContext): RunWalkMeaningfulRunningResult {
  const earlyProgressionPolicy = earlyProgressionRunWalkPolicy(context);
  const onboardingIntroPolicy =
    beginnerOnboardingProfile(context.profile) && context.phase === "introduction" && context.weekNumber <= 3
      ? earlyBeginnerBlockPolicy({
          profile: context.profile,
          goal: context.goal,
          weekNumber: context.weekNumber,
          phase: context.phase,
          actualSessionNumber: context.actualSessionNumber,
          actualWeekSessionCount: context.actualWeekSessionCount,
          plannedWeekSessionCount: context.plannedWeekSessionCount,
          plannedTypes: context.plannedTypes,
          useRunWalk: true,
        })
      : null;

  const blockPolicy = earlyProgressionPolicy ?? onboardingIntroPolicy;
  if (!blockPolicy) {
    return {
      intervalRunMin: context.intervalRunMin,
      repeats: context.repeats,
      walkBreakMin: context.walkBreakMin,
    };
  }

  let intervalRunMin = roundToQuarter(context.intervalRunMin + blockPolicy.runMinutesBoostMin);
  let repeats = context.repeats + blockPolicy.repeatBoost;
  let walkBreakMin = roundToQuarter(Math.max(1, context.walkBreakMin - blockPolicy.walkBreakReductionMin));

  const weakest = weakestBeginnerProfile(context.profile);
  walkBreakMin = roundToQuarter(Math.min(walkBreakMin, Math.max(1, intervalRunMin * blockPolicy.maxPauseRatio)));

  while (intervalRunMin * repeats < blockPolicy.minTotalRunningMin) {
    if (intervalRunMin < (weakest ? 2 : 2.5)) {
      intervalRunMin = roundToQuarter(intervalRunMin + 0.25);
    } else {
      repeats += 1;
    }
    if (repeats > 6) {
      break;
    }
  }

  if (context.continuityBand === "ultra_zero") {
    repeats = clamp(repeats, 4, 5);
  }

  return {
    intervalRunMin: roundToQuarter(intervalRunMin),
    repeats,
    walkBreakMin: roundToQuarter(walkBreakMin),
  };
}
