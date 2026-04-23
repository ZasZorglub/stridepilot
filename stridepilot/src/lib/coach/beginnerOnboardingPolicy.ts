import type { GoalConfig, RunnerProfile, WorkoutStructureSegment, WorkoutType } from "./types";
import type { ContinuityBand } from "./realismPolicy";

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
  if (!beginnerOnboardingProfile(context.profile) || context.phase !== "introduction" || context.weekNumber > 3 || !context.useRunWalk) {
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
            ? 8
            : context.actualSessionNumber === 2
              ? 7
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
  if (!beginnerOnboardingProfile(context.profile) || context.phase !== "introduction" || context.weekNumber > 3) {
    return {
      intervalRunMin: context.intervalRunMin,
      repeats: context.repeats,
      walkBreakMin: context.walkBreakMin,
    };
  }

  const blockPolicy = earlyBeginnerBlockPolicy({
    profile: context.profile,
    goal: context.goal,
    weekNumber: context.weekNumber,
    phase: context.phase,
    actualSessionNumber: context.actualSessionNumber,
    actualWeekSessionCount: context.actualWeekSessionCount,
    plannedWeekSessionCount: context.plannedWeekSessionCount,
    plannedTypes: context.plannedTypes,
    useRunWalk: true,
  });

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
