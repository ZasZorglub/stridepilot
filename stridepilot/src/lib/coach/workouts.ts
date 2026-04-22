import { GoalConfig, PlanPhase, RunnerProfile, WorkoutSession, WorkoutStructureSegment, WorkoutTemplate, WorkoutType } from "./types";
import { goalEventMinimumRealismMinutes } from "./realismPolicy";

/**
 * Workout composition policy layer.
 *
 * The core coaching rules encoded below are:
 * - walking should support the workout, not dominate it
 * - short easy sessions still need a visible main set
 * - beginner framing should be gentle, but should still read as running
 * - progression runs should read as clean build-and-finish sessions
 *
 * Keep this file focused on truthful, coach-readable workout structure rather than
 * UI concerns or broad plan progression.
 */
export const WORKOUT_LIBRARY: Record<WorkoutType, WorkoutTemplate> = {
  "run-walk": {
    type: "run-walk",
    purpose: "Bygger løbetolerance og tryghed uden at overbelaste kroppen for tidligt.",
    progressionNotes: ["Længere løbeblokke", "Kortere gangpauser", "Flere samlede løbeminutter"],
  },
  easy: {
    type: "easy",
    purpose: "Skaber kontinuitet og rolig aerob opbygning.",
    progressionNotes: ["Lidt længere varighed", "Mere sammenhængende løb", "Stabil intensitet"],
  },
  long: {
    type: "long",
    purpose: "Udvider den rolige kapacitet og gør 5K mere overkommeligt.",
    progressionNotes: ["Lidt længere samlet tid", "Stabilt roligt tempo", "Kontrolleret belastning"],
  },
  interval: {
    type: "interval",
    purpose: "Gør det lettere at arbejde med fart i små doser.",
    progressionNotes: ["Længere intervaller", "Færre pauser", "Lidt mere samlet kvalitetsarbejde"],
  },
  tempo: {
    type: "tempo",
    purpose: "Træner rytme og jævn belastning omkring 5K-indsats.",
    progressionNotes: ["Længere tempoblokke", "Mindre pause mellem blokke", "Mere stabil indsats"],
  },
  strides: {
    type: "strides",
    purpose: "Skærper teknik og let fart uden at gøre passet tungt.",
    progressionNotes: ["Flere gentagelser", "Lidt længere strides", "Samme rolige ramme"],
  },
  recovery: {
    type: "recovery",
    purpose: "Holder kroppen i gang på en meget let dag.",
    progressionNotes: ["Små justeringer i tid", "Samme rolige intensitet", "Plads til restitution"],
  },
  steady: {
    type: "steady",
    purpose: "Bygger robust aerob rytme i et jævnt, kontrolleret tempo.",
    progressionNotes: ["Længere steady-blok", "Mere sammenhængende arbejde", "Bedre rytmekontrol"],
  },
  fartlek: {
    type: "fartlek",
    purpose: "Giver mere fri kvalitetsvariation uden et tungt intervalpræg.",
    progressionNotes: ["Flere fartskift", "Lidt længere arbejdsblokke", "Samme kontrollerede ramme"],
  },
  "hill-reps": {
    type: "hill-reps",
    purpose: "Bygger styrke og løbeøkonomi via korte kontrollerede bakkeindsatser.",
    progressionNotes: ["Flere bakkeindsatser", "Lidt længere bakker", "Samme kontrollerede teknik"],
  },
  progression: {
    type: "progression",
    purpose: "Træner evnen til at afslutte stærkere uden at åbne for hårdt.",
    progressionNotes: ["Længere progression", "Mere tydelig afslutning", "Bedre tempokontrol"],
  },
  "race-specific": {
    type: "race-specific",
    purpose: "Lægger blokke ind, som ligner kravene i måldistancen mere direkte.",
    progressionNotes: ["Mere målspecifik blok", "Mindre pause", "Større rytmetryghed"],
  },
  benchmark: {
    type: "benchmark",
    purpose: "Giver en rolig status på udviklingen uden at overdramatisere passet.",
    progressionNotes: ["Mere sammenhængende løb", "Tydeligere 5K-følelse", "Bruges sparsomt"],
  },
};

export interface WorkoutBuildContext {
  weekNumber: number;
  phase: PlanPhase;
  profile: RunnerProfile;
  goal: GoalConfig;
  dayOfWeek: WorkoutSession["dayOfWeek"];
  date: string;
  isStabilizationWeek: boolean;
  continuousRunMin: number;
  longRunMin: number;
  intervalRunMin: number;
  walkBreakMin: number;
  repeats: number;
  isGoalSession?: boolean;
}

function runnerCategory(profile: RunnerProfile) {
  return profile.runnerCategory ?? "recreational";
}

function easyJogMinutes(profile: RunnerProfile, fallback = 6): number {
  if (profile.typicalWorkoutMinutes >= 60 || profile.currentWeeklyVolumeKm >= 35) return Math.max(7, fallback);
  if (profile.currentWeeklyVolumeKm >= 18 || profile.longestRunMinutes >= 35) return Math.max(6, fallback);
  return fallback;
}

function warmupSegments(context: WorkoutBuildContext, quality = false): WorkoutStructureSegment[] {
  const category = runnerCategory(context.profile);

  if (category === "true_beginner" || category === "run_walk_beginner") {
    // Beginner easy/long framing should feel like entering a run, not walking around.
    return [
      { type: "walk", label: "Kort gangstart", durationMin: 2 },
      { type: "recovery", label: "Let jog", durationMin: quality ? 2.5 : 1.5 },
    ];
  }

  if (category === "continuous_beginner") {
    if (quality) {
      // Quality sessions should start directly with gentle jogging rather than
      // layering extra walking on top of an already controlled warmup.
      return [{ type: "recovery", label: "Let jog", durationMin: 3 }];
    }
    return [
      { type: "walk", label: "Rolig gang", durationMin: 1 },
      { type: "recovery", label: "Let jog", durationMin: 2.5 },
    ];
  }

  return [{ type: "recovery", label: "Let jog opvarmning", durationMin: easyJogMinutes(context.profile, quality ? 7 : 6) }];
}

function cooldownSegments(context: WorkoutBuildContext): WorkoutStructureSegment[] {
  const category = runnerCategory(context.profile);

  if (category === "true_beginner" || category === "run_walk_beginner") {
    // Cooldown should be a short, confidence-building exit, not a long passive block.
    return [
      { type: "recovery", label: "Let jog ned", durationMin: 1 },
      { type: "walk", label: "Kort gangafslutning", durationMin: 1 },
    ];
  }

  if (category === "continuous_beginner") {
    return [
      { type: "recovery", label: "Let jog", durationMin: 1 },
      { type: "walk", label: "Gang ned", durationMin: 1 },
    ];
  }

  return [
    { type: "recovery", label: "Let jog ned", durationMin: 2 },
    { type: "walk", label: "Rolig afslutning", durationMin: 1.5 },
  ];
}

function runWalkOpeningSegments(context: WorkoutBuildContext): WorkoutStructureSegment[] {
  const category = runnerCategory(context.profile);

  if (category === "true_beginner" || category === "run_walk_beginner") {
    return [{ type: "walk", label: "Kort gangstart", durationMin: 2.5 }];
  }

  return warmupSegments(context);
}

function runWalkCooldownSegments(context: WorkoutBuildContext): WorkoutStructureSegment[] {
  const category = runnerCategory(context.profile);

  if (category === "true_beginner" || category === "run_walk_beginner") {
    return [{ type: "walk", label: "Kort gangafslutning", durationMin: 1 }];
  }

  return cooldownSegments(context);
}

const MAX_WALK_SEGMENT_MIN = 5;
const MIN_SEGMENT_MIN = 0.5;

interface CoachStructureSections {
  opening: WorkoutStructureSegment[];
  main: WorkoutStructureSegment[];
  cooldown: WorkoutStructureSegment[];
}

function cloneSegment(segment: WorkoutStructureSegment): WorkoutStructureSegment {
  return { ...segment };
}

function clampSegmentDuration(segment: WorkoutStructureSegment, durationMin: number): WorkoutStructureSegment | null {
  const normalizedDuration = roundToHalf(durationMin);
  if (normalizedDuration < MIN_SEGMENT_MIN) return null;
  return {
    ...segment,
    durationMin: normalizedDuration,
  };
}

function sumSegmentListDuration(segments: WorkoutStructureSegment[]): number {
  return roundToHalf(segments.reduce((sum, segment) => sum + segment.durationMin, 0));
}

function capWalkSegmentDuration(segments: WorkoutStructureSegment[]): WorkoutStructureSegment[] {
  return segments.map((segment) =>
    segment.type === "walk"
      ? {
          ...segment,
          durationMin: roundToHalf(Math.min(segment.durationMin, MAX_WALK_SEGMENT_MIN)),
        }
      : cloneSegment(segment),
  );
}

function reduceSegmentsByType(
  segments: WorkoutStructureSegment[],
  reducer: (segment: WorkoutStructureSegment) => boolean,
  overageMin: number,
): WorkoutStructureSegment[] {
  let remaining = roundToHalf(overageMin);
  return segments.flatMap((segment) => {
    if (!reducer(segment) || remaining <= 0) return [segment];
    const nextDuration = Math.max(0, segment.durationMin - remaining);
    const reducedBy = segment.durationMin - nextDuration;
    remaining = roundToHalf(Math.max(0, remaining - reducedBy));
    const nextSegment = clampSegmentDuration(segment, nextDuration);
    return nextSegment ? [nextSegment] : [];
  });
}

function trimOpeningSegments(segments: WorkoutStructureSegment[], coreDurationMin: number): WorkoutStructureSegment[] {
  // Trimming protects against passive starts and duplicate walk+jog warmups.
  let next = capWalkSegmentDuration(segments);
  const hasJogWarmup = next.some((segment) => segment.type === "warmup" || segment.type === "recovery");

  if (hasJogWarmup) {
    const walkTotal = sumSegmentListDuration(next.filter((segment) => segment.type === "walk"));
    if (walkTotal > 2) {
      next = reduceSegmentsByType(next, (segment) => segment.type === "walk", walkTotal - 2);
    }
  }

  const openingCap = coreDurationMin <= 16 ? 5 : 6;
  const openingTotal = sumSegmentListDuration(next);
  if (openingTotal > openingCap) {
    next = reduceSegmentsByType(next, (segment) => segment.type === "walk", openingTotal - openingCap);
  }

  const trimmedOpeningTotal = sumSegmentListDuration(next);
  if (trimmedOpeningTotal > openingCap) {
    next = reduceSegmentsByType(next, () => true, trimmedOpeningTotal - openingCap);
  }

  return next;
}

function trimCooldownSegments(segments: WorkoutStructureSegment[], coreDurationMin: number): WorkoutStructureSegment[] {
  // Trim cooldown first by removing extra walking; the finish should stay short and clear.
  let next = capWalkSegmentDuration(segments);
  const cooldownCap = coreDurationMin <= 14 ? 3 : coreDurationMin <= 24 ? 4 : 5;
  const cooldownTotal = sumSegmentListDuration(next);

  if (cooldownTotal > cooldownCap) {
    next = reduceSegmentsByType(next, (segment) => segment.type === "walk", cooldownTotal - cooldownCap);
  }

  const trimmedCooldownTotal = sumSegmentListDuration(next);
  if (trimmedCooldownTotal > cooldownCap) {
    next = reduceSegmentsByType(next, () => true, trimmedCooldownTotal - cooldownCap);
  }

  return next;
}

function enforceMeaningfulWork(
  opening: WorkoutStructureSegment[],
  main: WorkoutStructureSegment[],
  cooldown: WorkoutStructureSegment[],
): CoachStructureSections {
  // Short sessions should still feel like workouts. If setup+finish starts to dominate,
  // trim the framing before touching the main work.
  const mainDurationMin = sumDuration(main);
  const setupAndFinishBudget = Math.min(8, Math.max(4, roundToHalf(mainDurationMin * 0.5)));
  let nextOpening = opening;
  let nextCooldown = cooldown;
  const totalSetupAndFinish = sumSegmentListDuration(nextOpening) + sumSegmentListDuration(nextCooldown);

  if (totalSetupAndFinish <= setupAndFinishBudget) {
    return { opening: nextOpening, main, cooldown: nextCooldown };
  }

  let remainingOverage = roundToHalf(totalSetupAndFinish - setupAndFinishBudget);
  if (sumSegmentListDuration(nextCooldown) > 0) {
    nextCooldown = reduceSegmentsByType(nextCooldown, (segment) => segment.type === "walk", remainingOverage);
    remainingOverage = roundToHalf(
      Math.max(0, sumSegmentListDuration(nextOpening) + sumSegmentListDuration(nextCooldown) - setupAndFinishBudget),
    );
  }

  if (remainingOverage > 0) {
    nextOpening = reduceSegmentsByType(nextOpening, (segment) => segment.type === "walk", remainingOverage);
    remainingOverage = roundToHalf(
      Math.max(0, sumSegmentListDuration(nextOpening) + sumSegmentListDuration(nextCooldown) - setupAndFinishBudget),
    );
  }

  if (remainingOverage > 0) {
    nextCooldown = reduceSegmentsByType(nextCooldown, () => true, remainingOverage);
    remainingOverage = roundToHalf(
      Math.max(0, sumSegmentListDuration(nextOpening) + sumSegmentListDuration(nextCooldown) - setupAndFinishBudget),
    );
  }

  if (remainingOverage > 0) {
    nextOpening = reduceSegmentsByType(nextOpening, () => true, remainingOverage);
  }

  return { opening: nextOpening, main, cooldown: nextCooldown };
}

export function applyCoachStructureGuardrails(sections: CoachStructureSections): WorkoutStructureSegment[] {
  const mainDurationMin = sumDuration(sections.main);
  const opening = trimOpeningSegments(sections.opening, mainDurationMin);
  const cooldown = trimCooldownSegments(sections.cooldown, mainDurationMin);
  const meaningfulWork = enforceMeaningfulWork(opening, sections.main, cooldown);
  return [...meaningfulWork.opening, ...meaningfulWork.main, ...meaningfulWork.cooldown];
}

function buildCoachedStructure(
  context: WorkoutBuildContext,
  main: WorkoutStructureSegment[],
  qualityWarmup = false,
): WorkoutStructureSegment[] {
  return applyCoachStructureGuardrails({
    opening: warmupSegments(context, qualityWarmup),
    main,
    cooldown: cooldownSegments(context),
  });
}

function buildRunWalkStructure(
  context: WorkoutBuildContext,
  main: WorkoutStructureSegment[],
): WorkoutStructureSegment[] {
  return applyCoachStructureGuardrails({
    opening: runWalkOpeningSegments(context),
    main,
    cooldown: runWalkCooldownSegments(context),
  });
}

function earlyBeginnerShortSession(context: WorkoutBuildContext): boolean {
  const category = runnerCategory(context.profile);
  return (
    context.phase === "introduction" &&
    context.weekNumber <= 2 &&
    context.continuousRunMin <= 8 &&
    (category === "true_beginner" || category === "run_walk_beginner" || category === "continuous_beginner")
  );
}

function earlyBeginnerEasyOpening(context: WorkoutBuildContext): WorkoutStructureSegment[] {
  const category = runnerCategory(context.profile);
  if (category === "true_beginner" || category === "run_walk_beginner") {
    return [{ type: "walk", label: "Kort gangstart", durationMin: 2 }];
  }
  return [{ type: "recovery", label: "Let jog start", durationMin: 2 }];
}

function earlyBeginnerEasyFinish(context: WorkoutBuildContext): WorkoutStructureSegment[] {
  const category = runnerCategory(context.profile);
  if (category === "true_beginner" || category === "run_walk_beginner") {
    return [{ type: "walk", label: "Kort afslutning", durationMin: 1 }];
  }
  return [{ type: "recovery", label: "Let jog ned", durationMin: 1 }];
}

function buildEarlyBeginnerSimpleSession(
  context: WorkoutBuildContext,
  mainType: WorkoutStructureSegment["type"],
  label: string,
  minimumMainMin: number,
): WorkoutStructureSegment[] {
  return applyCoachStructureGuardrails({
    opening: earlyBeginnerEasyOpening(context),
    main: [{ type: mainType, label, durationMin: roundToHalf(Math.max(minimumMainMin, context.continuousRunMin)) }],
    cooldown: earlyBeginnerEasyFinish(context),
  });
}

function distanceLabel(goal: GoalConfig): string {
  return goal.goalDistance === "5K" ? "5K" : goal.goalDistance === "10K" ? "10 km" : goal.goalDistance === "Halvmaraton" ? "halvmaraton" : "maraton";
}

function readinessBand(profile: RunnerProfile): "low" | "moderate" | "high" {
  if (profile.currentWeeklyVolumeKm >= 35 || (profile.currentRunsPerWeek >= 4 && profile.longestRunMinutes >= 60)) return "high";
  if (profile.currentWeeklyVolumeKm >= 18 || (profile.currentRunsPerWeek >= 3 && profile.longestRunMinutes >= 35)) return "moderate";
  return "low";
}

function isConservativeGoalDayProfile(context: WorkoutBuildContext): boolean {
  const category = runnerCategory(context.profile);
  const readiness = readinessBand(context.profile);
  return (
    readiness === "low" ||
    category === "true_beginner" ||
    category === "run_walk_beginner" ||
    category === "continuous_beginner" ||
    context.profile.archetype === "nervous_beginner" ||
    context.profile.archetype === "returning_runner" ||
    context.profile.currentRunsPerWeek <= 2 ||
    context.profile.injurySensitivity >= 4
  );
}

function isExperiencedPerformanceMarathonGoalDayProfile(context: WorkoutBuildContext): boolean {
  return (
    context.goal.goalDistance === "Marathon" &&
    (context.goal.goalIntent === "improve" || context.goal.goalIntent === "target_time") &&
    readinessBand(context.profile) === "high" &&
    context.profile.currentRunsPerWeek >= 4 &&
    (context.profile.currentWeeklyVolumeKm >= 50 || context.profile.longestRunMinutes >= 120)
  );
}

function intervalRunCap(context: WorkoutBuildContext): number {
  const readiness = readinessBand(context.profile);
  if (context.goal.goalDistance === "5K") return readiness === "high" ? 32 : readiness === "moderate" ? 26 : 20;
  if (context.goal.goalDistance === "10K") return readiness === "high" ? 36 : readiness === "moderate" ? 30 : 22;
  if (context.goal.goalDistance === "Halvmaraton") return readiness === "high" ? 38 : readiness === "moderate" ? 30 : 20;
  return readiness === "high" ? 34 : readiness === "moderate" ? 28 : 18;
}

function tempoRunCap(context: WorkoutBuildContext): number {
  const readiness = readinessBand(context.profile);
  if (context.goal.goalDistance === "5K") return readiness === "high" ? 30 : readiness === "moderate" ? 24 : 18;
  if (context.goal.goalDistance === "10K") return readiness === "high" ? 38 : readiness === "moderate" ? 30 : 22;
  if (context.goal.goalDistance === "Halvmaraton") return readiness === "high" ? 44 : readiness === "moderate" ? 34 : 24;
  return readiness === "high" ? 48 : readiness === "moderate" ? 36 : 24;
}

function benchmarkRunCap(context: WorkoutBuildContext): number {
  if (context.goal.goalDistance === "5K") return 24;
  if (context.goal.goalDistance === "10K") return 35;
  if (context.goal.goalDistance === "Halvmaraton") return 45;
  return 60;
}

function parseTargetTimeToMinutes(value?: string): number | null {
  if (!value) return null;
  const parts = value.split(":").map((part) => Number(part));
  if (parts.some((part) => !Number.isFinite(part) || part < 0)) return null;
  if (parts.length === 2) return parts[0] + parts[1] / 60;
  if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60;
  return null;
}

function goalDistanceKm(goal: GoalConfig): number {
  if (goal.goalDistance === "5K") return 5;
  if (goal.goalDistance === "10K") return 10;
  if (goal.goalDistance === "Halvmaraton") return 21.1;
  return 42.2;
}

function explicitGoalEventDurationMin(context: WorkoutBuildContext): number | null {
  const targetTimeMin = parseTargetTimeToMinutes(context.goal.targetTime);
  if (targetTimeMin) {
    const explicitTarget = roundToHalf(targetTimeMin);
    const realismFloor = goalEventMinimumRealismMinutes({ goal: context.goal, profile: context.profile });
    if (realismFloor != null) return roundToHalf(Math.max(explicitTarget, realismFloor));
    return explicitTarget;
  }
  if (typeof context.goal.targetPaceSecPerKm === "number" && Number.isFinite(context.goal.targetPaceSecPerKm)) {
    const explicitTarget = roundToHalf((context.goal.targetPaceSecPerKm * goalDistanceKm(context.goal)) / 60);
    const realismFloor = goalEventMinimumRealismMinutes({ goal: context.goal, profile: context.profile });
    if (realismFloor != null) return roundToHalf(Math.max(explicitTarget, realismFloor));
    return explicitTarget;
  }
  return null;
}

function goalEventDurationTarget(context: WorkoutBuildContext): number {
  const explicitDurationMin = explicitGoalEventDurationMin(context);
  if (explicitDurationMin) return explicitDurationMin;

  const longRunBase = context.longRunMin;
  const continuousBase = context.continuousRunMin;
  const performanceLike = context.goal.goalIntent === "improve" || context.goal.goalIntent === "target_time";

  if (context.goal.goalDistance === "5K") {
    return roundToHalf(
      performanceLike
        ? Math.max(20, Math.min(38, Math.max(continuousBase * 0.95, longRunBase * 0.7)))
        : Math.max(24, Math.min(42, Math.max(continuousBase * 1.08, longRunBase * 0.82))),
    );
  }
  if (context.goal.goalDistance === "10K") {
    return roundToHalf(
      performanceLike
        ? Math.max(42, Math.min(70, Math.max(continuousBase * 1.05, longRunBase * 0.88)))
        : Math.max(52, Math.min(85, Math.max(continuousBase * 1.2, longRunBase))),
    );
  }
  if (context.goal.goalDistance === "Halvmaraton") {
    return roundToHalf(
      performanceLike
        ? Math.max(100, Math.min(155, Math.max(continuousBase * 1.5, longRunBase * 1.12)))
        : Math.max(115, Math.min(180, Math.max(continuousBase * 1.7, longRunBase * 1.24))),
    );
  }
  return roundToHalf(
    performanceLike
      ? Math.max(210, Math.min(330, Math.max(continuousBase * 2.3, longRunBase * 1.4)))
      : Math.max(240, Math.min(390, Math.max(continuousBase * 2.55, longRunBase * 1.62))),
  );
}

function goalDayRunTarget(context: WorkoutBuildContext): number {
  const longRunBase = context.longRunMin;
  const continuousBase = context.continuousRunMin;
  const conservative5k10k = isConservativeGoalDayProfile(context);

  if (context.goal.goalDistance === "5K") {
    if (conservative5k10k) {
      return roundToHalf(Math.max(25, Math.min(40, Math.max(continuousBase * 1.02, longRunBase * 0.74))));
    }
    return roundToHalf(Math.max(20, Math.min(38, Math.max(continuousBase * 0.92, longRunBase * 0.68))));
  }
  if (context.goal.goalDistance === "10K") {
    if (conservative5k10k) {
      return roundToHalf(Math.max(42, Math.min(78, Math.max(continuousBase * 1.08, longRunBase * 0.9))));
    }
    if (context.goal.goalIntent === "finish" || context.goal.goalIntent === "finish_comfortably") {
      return roundToHalf(Math.max(39, Math.min(74, Math.max(continuousBase * 1.02, longRunBase * 0.86))));
    }
    return roundToHalf(Math.max(38, Math.min(72, Math.max(continuousBase, longRunBase * 0.84))));
  }
  if (context.goal.goalDistance === "Halvmaraton") {
    return goalEventDurationTarget(context);
  }
  if (isExperiencedPerformanceMarathonGoalDayProfile(context)) {
    return goalEventDurationTarget(context);
  }
  return goalEventDurationTarget(context);
}

function roundToHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

export function estimateSessionLoad(durationMin: number, type: WorkoutType, profile: RunnerProfile): number {
  const intensity =
    type === "recovery"
      ? 0.65
      : type === "easy" || type === "run-walk"
        ? 0.8
        : type === "long"
          ? 0.95
          : type === "strides"
            ? 0.9
            : type === "interval"
              ? 1.15
              : type === "tempo" || type === "benchmark"
                ? 1.08
                : 1;

  const sensitivityModifier = profile.injurySensitivity >= 4 ? 0.96 : 1;
  return roundToHalf(durationMin * intensity * sensitivityModifier);
}

export function sumDuration(structure: WorkoutStructureSegment[]): number {
  return structure.reduce((sum, segment) => {
    const repeats = segment.repeats ?? 1;
    const recover = segment.recoverMin ?? 0;
    return sum + segment.durationMin * repeats + recover * Math.max(repeats - 1, 0);
  }, 0);
}

function baseSession(
  context: WorkoutBuildContext,
  type: WorkoutType,
  title: string,
  description: string,
  intent: string,
  effortGuidance: string,
  structure: WorkoutStructureSegment[],
): WorkoutSession {
  const durationMin = roundToHalf(sumDuration(structure));

  return {
    id: `${context.weekNumber}-${context.dayOfWeek}-${type}`,
    week: context.weekNumber,
    dayOfWeek: context.dayOfWeek,
    date: context.date,
    type,
    title,
    description,
    durationMin,
    structure,
    intent,
    effortGuidance,
    estimatedLoad: estimateSessionLoad(durationMin, type, context.profile),
  };
}

function buildGoalDayWorkout(context: WorkoutBuildContext, type: WorkoutType): WorkoutSession {
  const targetRun = goalDayRunTarget(context);
  const structure = buildCoachedStructure(context, [{ type: "run", label: `${distanceLabel(context.goal)} måldag`, durationMin: targetRun }], false);

  return baseSession(
    context,
    type,
    `${distanceLabel(context.goal)} måldag`,
    "Selve måldagen, hvor planen kulminerer i en samlet indsats, der matcher distancen og den opbygning du har lavet.",
    `Lade måldagen være en troværdig kulmination mod ${distanceLabel(context.goal)} frem for bare endnu et kort taper-pas.`,
    "Start kontrolleret, find rytmen tidligt, og lad indsatsen udvikle sig roligt gennem dagen.",
    structure,
  );
}

export function buildRunWalkWorkout(context: WorkoutBuildContext): WorkoutSession {
  const structure = buildRunWalkStructure(context, [
    {
      type: "run",
      label: "Løb/gang blok",
      durationMin: context.intervalRunMin,
      repeats: context.repeats,
      recoverMin: context.walkBreakMin,
    },
  ]);

  return baseSession(
    context,
    "run-walk",
    "Run-walk",
    "Et roligt pas hvor løb og gang skiftes, så du bygger tolerance uden at forcere.",
    "Skabe tryg rytme og løbetolerance.",
    "Løb roligt. Du skal hele tiden kunne falde til ro i pauserne.",
    structure,
  );
}

export function buildEasyWorkout(context: WorkoutBuildContext): WorkoutSession {
  const structure = earlyBeginnerShortSession(context)
    ? buildEarlyBeginnerSimpleSession(context, "steady", "Roligt hovedsæt", 6)
    : buildCoachedStructure(context, [{ type: "steady", label: "Roligt løb", durationMin: context.continuousRunMin }]);

  return baseSession(
    context,
    "easy",
    "Roligt løb",
    "Et jævnt pas hvor du finder rytme og bygger rolig kapacitet.",
    "Skabe kontinuitet og overskud.",
    "Hold et tempo hvor du stadig kan føre en kort samtale.",
    structure,
  );
}

export function buildLongWorkout(context: WorkoutBuildContext): WorkoutSession {
  const structure = buildCoachedStructure(context, [{ type: "steady", label: "Lang rolig blok", durationMin: context.longRunMin }]);

  return baseSession(
    context,
    "long",
    "Langt roligt pas",
    "Den længste rolige træning i ugen, hvor du samler tid på benene uden jagt på fart.",
    `Udvide den rolige kapacitet frem mod ${distanceLabel(context.goal)}.`,
    "Hold det bevidst roligt. Du skal gerne slutte med lidt overskud.",
    structure,
  );
}

export function buildIntervalWorkout(context: WorkoutBuildContext): WorkoutSession {
  const totalRunCap = intervalRunCap(context);
  const repeats = Math.max(3, Math.min(context.repeats, Math.floor(totalRunCap / Math.max(1, context.intervalRunMin))));
  const intervalDuration = roundToHalf(Math.min(context.intervalRunMin, totalRunCap / repeats));
  const structure = buildCoachedStructure(context, [
    {
      type: "run",
      label: "Interval",
      durationMin: intervalDuration,
      repeats,
      recoverMin: Math.max(1, context.walkBreakMin - 0.5),
    },
  ], true);

  return baseSession(
    context,
    "interval",
    "Intervalpas",
    "Et kontrolleret kvalitetspas med tydelige pauser mellem blokkene.",
    "Arbejde med fart i små doser.",
    "Løb kontrolleret og rytmisk. Du skal ikke sprinte dig gennem blokkene.",
    structure,
  );
}

export function buildTempoWorkout(context: WorkoutBuildContext): WorkoutSession {
  const blockDuration = roundToHalf(Math.min(Math.max(6, context.continuousRunMin * 0.6), tempoRunCap(context) / 2));
  const structure = buildCoachedStructure(context, [{ type: "tempo", label: "Tempoblok", durationMin: blockDuration, repeats: 2, recoverMin: 2 }], true);

  return baseSession(
    context,
    "tempo",
    "Tempopas",
    `Et jævnt pas tættere på den rytme du skal kunne holde mod ${distanceLabel(context.goal)}, men stadig under kontrol.`,
    "Bygge stabil fartkontrol og arbejde omkring tærskel.",
    "Løb fast og fokuseret, men undgå at gå i rødt.",
    structure,
  );
}

export function buildStridesWorkout(context: WorkoutBuildContext): WorkoutSession {
  const structure = buildCoachedStructure(context, [
    { type: "steady", label: "Let løb", durationMin: Math.max(10, context.continuousRunMin * 0.7) },
    { type: "stride", label: "Strides", durationMin: 0.25, repeats: 6, recoverMin: 0.75 },
  ]);

  return baseSession(
    context,
    "strides",
    "Roligt løb med strides",
    "Et let pas hvor du slutter med korte hurtige indslag for rytme og teknik.",
    "Skærpe rytme uden at gøre ugen tungere.",
    "Det meste skal føles let. Strides er korte og kontrollerede.",
    structure,
  );
}

export function buildSteadyWorkout(context: WorkoutBuildContext): WorkoutSession {
  const steadyMinutes = roundToHalf(Math.min(Math.max(16, context.continuousRunMin * 0.85), tempoRunCap(context)));
  const structure = buildCoachedStructure(context, [{ type: "steady", label: "Steady-blok", durationMin: steadyMinutes }], true);

  return baseSession(
    context,
    "steady",
    "Steady-pas",
    "Et kontrolleret pas i jævn rytme, tydeligere end et roligt løb men uden at blive et hårdt tempopas.",
    `Bygge robust 10 km-rytme og aerob styrke frem mod ${distanceLabel(context.goal)}.`,
    "Løb fast og roligt kontrolleret. Du må gerne arbejde, men du skal ikke i rødt.",
    structure,
  );
}

export function buildFartlekWorkout(context: WorkoutBuildContext): WorkoutSession {
  const workMinutes = roundToHalf(Math.min(Math.max(3, context.intervalRunMin), 6));
  const repeats = Math.max(4, Math.min(context.repeats, 6));
  const structure = buildCoachedStructure(
    context,
    [{ type: "run", label: "Fartlek-blok", durationMin: workMinutes, repeats, recoverMin: Math.max(1.5, context.walkBreakMin) }],
    true,
  );

  return baseSession(
    context,
    "fartlek",
    "Fartlek",
    "Et mere legende kvalitetspas med kontrollerede fartskift, så du bygger styrke uden stiv intervalfølelse.",
    "Udvikle rytmeskift og aerob robusthed.",
    "Hold fartskiftene kontrollerede. De skal føles som arbejde, ikke sprint.",
    structure,
  );
}

export function buildHillWorkout(context: WorkoutBuildContext): WorkoutSession {
  const hillMinutes = roundToHalf(Math.min(Math.max(1, context.intervalRunMin * 0.5), 2.5));
  const repeats = Math.max(5, Math.min(context.repeats + 1, 8));
  const structure = buildCoachedStructure(context, [{ type: "run", label: "Bakkedrag", durationMin: hillMinutes, repeats, recoverMin: 1.5 }], true);

  return baseSession(
    context,
    "hill-reps",
    "Bakkepas",
    "Korte bakkedrag med rolig pause imellem for at bygge styrke og teknik.",
    "Styrke, rytme og løbeøkonomi.",
    "Løb kontrolleret opad med god holdning. Hold igen nok til at alle drag bliver ens.",
    structure,
  );
}

export function buildProgressionWorkout(context: WorkoutBuildContext): WorkoutSession {
  // Progression runs should read as: calm opening -> clear build -> purposeful stronger finish.
  // Keep the final block short and distinct so the session does not feel like a long passive tail.
  const totalWork = roundToHalf(Math.max(18, context.continuousRunMin * 0.85));
  const finishBlock = roundToHalf(Math.min(Math.max(6, totalWork * 0.24), tempoRunCap(context) * 0.32));
  const buildBlock = roundToHalf(Math.max(6, totalWork * 0.28));
  const openingBlock = roundToHalf(Math.max(8, totalWork - buildBlock - finishBlock));
  const structure = buildCoachedStructure(context, [
    { type: "steady", label: "Rolig åbning", durationMin: openingBlock },
    { type: "steady", label: "Byggeblok", durationMin: buildBlock },
    { type: "tempo", label: "Stærk slutblok", durationMin: finishBlock },
  ], true);

  return baseSession(
    context,
    "progression",
    "Progressionspas",
    "Et pas med en rolig åbning, et tydeligt midterbyg og en kontrolleret stærkere slutblok.",
    "Bygge tempokontrol og en mere naturlig stærk slutdel.",
    "Hold åbningen rolig, byg jævnt gennem midten, og gør slutblokken fokuseret men kontrolleret.",
    structure,
  );
}

export function buildRaceSpecificWorkout(context: WorkoutBuildContext): WorkoutSession {
  if (context.isGoalSession) return buildGoalDayWorkout(context, "race-specific");
  const blockDuration = roundToHalf(Math.min(Math.max(8, context.intervalRunMin * 1.5), tempoRunCap(context) * 0.6));
  const structure = buildCoachedStructure(context, [{ type: "tempo", label: `${distanceLabel(context.goal)}-blok`, durationMin: blockDuration, repeats: 2, recoverMin: 2 }], true);

  return baseSession(
    context,
    "race-specific",
    `${distanceLabel(context.goal)}-specifikt pas`,
    "Et pas med blokke tættere på selve måldistancens rytme og krav.",
    `Gøre dig mere tryg ved rytmen mod ${distanceLabel(context.goal)}.`,
    "Hold fokus på jævn rytme og kontrol. Du skal føle dig skarp, ikke færdig.",
    structure,
  );
}

export function buildRecoveryWorkout(context: WorkoutBuildContext): WorkoutSession {
  const structure = earlyBeginnerShortSession(context)
    ? buildEarlyBeginnerSimpleSession(context, "recovery", "Let hovedsæt", 6)
    : buildCoachedStructure(context, [{ type: "recovery", label: "Meget let bevægelse", durationMin: Math.max(12, context.continuousRunMin * 0.65) }]);

  return baseSession(
    context,
    "recovery",
    "Recovery-pas",
    "Et meget let pas som holder kroppen i gang uden at fylde meget i den samlede belastning.",
    "Give bevægelse uden at stjæle restitution.",
    "Hold det let fra start til slut.",
    structure,
  );
}

export function buildBenchmarkWorkout(context: WorkoutBuildContext): WorkoutSession {
  if (context.isGoalSession) return buildGoalDayWorkout(context, "race-specific");
  const benchmarkDuration = Math.min(Math.max(12, context.continuousRunMin), benchmarkRunCap(context));
  const structure = buildCoachedStructure(
    context,
    [{ type: "tempo", label: context.phase === "race_preparation" || context.phase === "taper" ? `${distanceLabel(context.goal)}-kontrolblok` : "Benchmark-blok", durationMin: benchmarkDuration }],
    true,
  );

  return baseSession(
    context,
    "benchmark",
    context.phase === "race_preparation" || context.phase === "taper" ? `${distanceLabel(context.goal)}-benchmark` : "Benchmark-pas",
    "Et kontrolleret statuspas, så du kan mærke din udvikling uden at det bliver et alt-eller-intet testløb.",
    "Måle udviklingen roligt og realistisk.",
    "Start kontrolleret og hold igen i første halvdel.",
    structure,
  );
}
