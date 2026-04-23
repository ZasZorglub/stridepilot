import {
  buildEasyWorkout,
  buildFartlekWorkout,
  buildLongWorkout,
  buildProgressionWorkout,
  buildRaceSpecificWorkout,
  buildRecoveryWorkout,
  buildRunWalkWorkout,
  buildSteadyWorkout,
  buildTempoWorkout,
  WorkoutBuildContext,
} from "./workouts";
import { buildPlanRationale, buildWeekRationales, buildWorkoutRationales, generatePlanExplanation } from "./explanations";
import { GoalConfig, PlanPhase, PlanType, ProgressionCurves, RunnerCategory, RunnerProfile, TrainingPlan, TrainingWeek, WorkoutSession, WorkoutType } from "./types";
import { buildEarlyWeekRealismPolicy, buildEntryRealismPolicy, buildProgressionRealismPolicy, buildTrackPosturePolicy, ContinuityBand } from "./realismPolicy";
import { firstSessionPolicy } from "./beginnerOnboardingPolicy";
import { runnerCategoryReason } from "./classification";
import { cutbackInterval, orderTrainingDaysForLongRun, preferredLongRunDay } from "./week-structure";
import { deriveCalendarWeekCount, planStartWeekMonday } from "../calendar-week";

type TenKDistancePhase = "base" | "build" | "specific" | "peak" | "taper";

type CurveWeek = {
  weekNumber: number;
  phase: TenKDistancePhase;
  weekNumberInPhase: number;
  isCutback: boolean;
  longRunMin: number;
  weeklyVolumeMin: number;
  intensityScore: number;
};

function roundHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

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
  return Math.max(10, deriveCalendarWeekCount(goal.startDate, goal.targetDate) ?? 10);
}

function categoryValue(category: RunnerCategory): number {
  if (category === "true_beginner") return 0;
  if (category === "run_walk_beginner") return 1;
  if (category === "continuous_beginner") return 2;
  if (category === "recreational") return 3;
  if (category === "light_intermediate") return 4;
  if (category === "intermediate") return 5;
  return 6;
}

function continuityBandForCategory(category: RunnerCategory): ContinuityBand {
  if (category === "true_beginner") return "ultra_zero";
  if (category === "run_walk_beginner") return "one_to_two_min";
  if (category === "continuous_beginner") return "five_min";
  return "established";
}

function beginnerLikeTenKDistanceProfile(profile: RunnerProfile, category: RunnerCategory): boolean {
  return categoryValue(category) <= 3 || profile.baseProgramTrack === "getting_started";
}

function longRunStart(profile: RunnerProfile, category: RunnerCategory): number {
  const longest = profile.longestRunMinutes;
  const typical = profile.typicalWorkoutMinutes || 40;
  const entryPolicy = buildEntryRealismPolicy({
    profile,
    continuityBand: continuityBandForCategory(category),
    beginnerLike: beginnerLikeTenKDistanceProfile(profile, category),
  });

  if (categoryValue(category) <= 1) return 20;
  if (category === "continuous_beginner") {
    return roundHalf(clamp(Math.max(24, Math.min(longest, typical * 0.9)) * entryPolicy.conservativeCapacityFactor, 24, entryPolicy.longRunStartMax ?? 36));
  }
  if (category === "recreational") {
    return roundHalf(clamp(Math.max(34, longest * 0.9, typical) * entryPolicy.conservativeCapacityFactor, 32, entryPolicy.longRunStartMax ?? 48));
  }
  if (category === "light_intermediate") return roundHalf(clamp(Math.max(40, longest * 0.9, typical), 38, 58));
  if (category === "intermediate") return roundHalf(clamp(Math.max(50, longest * 0.92, typical), 46, 72));
  return roundHalf(clamp(Math.max(55, longest * 0.94, typical), 52, 80));
}

function weeklyVolumeStart(profile: RunnerProfile, category: RunnerCategory, longRunMin: number): number {
  const volumeFromTraining = profile.currentWeeklyVolumeKm > 0 ? profile.currentWeeklyVolumeKm * 6.2 : 0;
  const frequencyAnchor = profile.currentRunsPerWeek >= 3 ? profile.currentRunsPerWeek * 18 : 0;

  if (category === "recreational") {
    return roundHalf(clamp(Math.max(longRunMin * 2.05, volumeFromTraining, frequencyAnchor, 82), 80, 120));
  }
  if (category === "light_intermediate") {
    return roundHalf(clamp(Math.max(longRunMin * 2.15, volumeFromTraining, frequencyAnchor, 92), 90, 145));
  }
  if (category === "intermediate" || category === "advanced") {
    return roundHalf(clamp(Math.max(longRunMin * 2.2, volumeFromTraining, frequencyAnchor, 110), 105, 180));
  }
  return roundHalf(clamp(Math.max(longRunMin * 1.9, volumeFromTraining, 60), 60, 100));
}

function longRunPeak(profile: RunnerProfile, category: RunnerCategory, start: number): number {
  const upper = 90;
  if (category === "recreational") return roundHalf(clamp(Math.max(start + 18, profile.longestRunMinutes + 15), 55, upper));
  if (category === "light_intermediate") return roundHalf(clamp(Math.max(start + 20, profile.longestRunMinutes + 18), 62, upper));
  return roundHalf(clamp(Math.max(start + 22, profile.longestRunMinutes + 20), 68, upper));
}

function weeklyVolumePeak(profile: RunnerProfile, category: RunnerCategory, start: number): number {
  const upper = category === "advanced" ? 240 : category === "intermediate" ? 210 : 180;
  const growth = category === "recreational" ? 32 : category === "light_intermediate" ? 38 : 46;
  return roundHalf(clamp(start + growth, start + 18, upper));
}

function phaseTimeline(totalWeeks: number): TenKDistancePhase[] {
  const taperWeeks = totalWeeks >= 14 ? 2 : 1;
  const peakWeeks = totalWeeks >= 12 ? 2 : 1;
  const baseWeeks = Math.max(2, Math.round(totalWeeks * 0.22));
  const buildWeeks = Math.max(3, Math.round(totalWeeks * 0.32));
  const specificWeeks = Math.max(2, totalWeeks - taperWeeks - peakWeeks - baseWeeks - buildWeeks);

  const timeline: TenKDistancePhase[] = [];
  for (let i = 0; i < baseWeeks; i += 1) timeline.push("base");
  for (let i = 0; i < buildWeeks; i += 1) timeline.push("build");
  for (let i = 0; i < specificWeeks; i += 1) timeline.push("specific");
  for (let i = 0; i < peakWeeks; i += 1) timeline.push("peak");
  while (timeline.length < totalWeeks) timeline.push("taper");
  return timeline.slice(0, totalWeeks);
}

function phaseProgress(timeline: TenKDistancePhase[], weekNumber: number): number {
  const phase = timeline[weekNumber - 1];
  const phaseWeeks = timeline.filter((entry) => entry === phase);
  let indexInPhase = 0;
  for (let i = 0; i < weekNumber; i += 1) {
    if (timeline[i] === phase) indexInPhase += 1;
  }
  return phaseWeeks.length <= 1 ? 1 : (indexInPhase - 1) / (phaseWeeks.length - 1);
}

function phaseWeekNumber(timeline: TenKDistancePhase[], weekNumber: number): number {
  const phase = timeline[weekNumber - 1];
  let indexInPhase = 0;
  for (let i = 0; i < weekNumber; i += 1) {
    if (timeline[i] === phase) indexInPhase += 1;
  }
  return indexInPhase;
}

function phaseIntensity(phase: TenKDistancePhase, progress: number): number {
  if (phase === "base") return 0.22 + progress * 0.06;
  if (phase === "build") return 0.34 + progress * 0.1;
  if (phase === "specific") return 0.5 + progress * 0.12;
  if (phase === "peak") return 0.68 + progress * 0.08;
  return 0.28 - progress * 0.08;
}

function capWeekLoad(sessions: WorkoutSession[], targetLoad: number, previousLoad: number | null): WorkoutSession[] {
  const maxAllowed = previousLoad ? Math.min(targetLoad, previousLoad * 1.12) : targetLoad;
  const totalLoad = sessions.reduce((sum, session) => sum + session.estimatedLoad, 0);
  if (totalLoad <= maxAllowed) return sessions;

  const ratio = maxAllowed / totalLoad;
  return sessions.map((session) => ({
    ...session,
    estimatedLoad: Math.round(session.estimatedLoad * (session.type === "tempo" ? Math.max(ratio, 0.9) : ratio) * 10) / 10,
  }));
}

function smoothWeeklyLoadTarget(
  targetLoad: number,
  previousLoad: number | null,
  phase: TenKDistancePhase,
  isStabilizationWeek: boolean,
  profile: RunnerProfile,
  goal: GoalConfig,
  continuityBand: ContinuityBand,
  previousWasStabilizationWeek: boolean,
  beginnerLike: boolean,
): number {
  if (!previousLoad) return targetLoad;
  const progressionPolicy = buildProgressionRealismPolicy({
    profile,
    continuityBand,
    beginnerLike,
    goal,
    phase: phase === "base" ? "introduction" : phase === "build" ? "continuous_running" : phase === "taper" ? "race_preparation" : "capacity",
    isStabilizationWeek,
    previousWasStabilizationWeek,
  });
  return Math.round(clamp(targetLoad, previousLoad * progressionPolicy.loadMinFactor, previousLoad * progressionPolicy.loadMaxFactor) * 10) / 10;
}

function curveBetween(start: number, peak: number, phase: TenKDistancePhase, progress: number): number {
  if (phase === "base") return start + (peak - start) * 0.18 * progress;
  if (phase === "build") return start + (peak - start) * (0.18 + 0.38 * progress);
  if (phase === "specific") return start + (peak - start) * (0.56 + 0.22 * progress);
  if (phase === "peak") return start + (peak - start) * (0.8 + 0.18 * progress);
  return peak * (progress >= 1 ? 0.62 : 0.78);
}

function buildCurves(profile: RunnerProfile, goal: GoalConfig, category: RunnerCategory, totalWeeks: number): CurveWeek[] {
  const timeline = phaseTimeline(totalWeeks);
  const longStart = longRunStart(profile, category);
  const volumeStart = weeklyVolumeStart(profile, category, longStart);
  const longPeak = longRunPeak(profile, category, longStart);
  const volumePeak = weeklyVolumePeak(profile, category, volumeStart);
  const cutbackEvery = cutbackInterval(category, goal.trainingDaysPerWeek);

  return timeline.map((phase, index) => {
    const weekNumber = index + 1;
    const progress = phaseProgress(timeline, weekNumber);
    const weekNumberInPhase = phaseWeekNumber(timeline, weekNumber);
    const isCutback = phase !== "taper" && phase !== "peak" && weekNumber > 1 && weekNumber % cutbackEvery === 0;

    let longRunMin = roundHalf(curveBetween(longStart, longPeak, phase, progress));
    let weeklyVolumeMin = roundHalf(curveBetween(volumeStart, volumePeak, phase, progress));
    let intensityScore = phaseIntensity(phase, progress);

    if (isCutback) {
      longRunMin = roundHalf(longRunMin * 0.88);
      weeklyVolumeMin = roundHalf(weeklyVolumeMin * 0.86);
      intensityScore *= 0.82;
    }

    if (phase === "taper") {
      intensityScore = Math.max(0.18, intensityScore);
    }

    return {
      weekNumber,
      phase,
      weekNumberInPhase,
      isCutback,
      longRunMin: roundHalf(clamp(longRunMin, longStart * 0.85, longPeak)),
      weeklyVolumeMin: roundHalf(clamp(weeklyVolumeMin, volumeStart * 0.9, volumePeak)),
      intensityScore: Math.round(intensityScore * 100) / 100,
    };
  });
}

function mapPhaseToPlanPhase(phase: TenKDistancePhase): PlanPhase {
  if (phase === "base") return "base";
  if (phase === "build") return "build";
  if (phase === "specific") return "specific";
  if (phase === "peak") return "peak";
  return "taper";
}

function focusForPhase(phase: TenKDistancePhase, isCutback: boolean): string {
  if (isCutback) {
    return "Ugen er en bevidst stabiliseringsuge, så kroppen kan absorbere opbygningen uden at miste rytmen.";
  }
  if (phase === "base") return "Stabilisere den base du allerede har og gøre planen tryg, men stadig klart over begynderniveau.";
  if (phase === "build") return "Bygge længere rolige ture og mere samlet tid på benene uge for uge.";
  if (phase === "specific") return "Lægge mere 10 km-relevant steady, progression og kontrolleret kvalitet ind.";
  if (phase === "peak") return "Samle de stærkeste distance-uger med den længste langtur og den tydeligste 10 km-identitet.";
  return "Friske kroppen op, bevare rytmen og gå ind i slutugen med mere overskud.";
}

function weeklyTypes(
  trainingDaysPerWeek: GoalConfig["trainingDaysPerWeek"],
  phase: TenKDistancePhase,
  weekNumberInPhase: number,
  intensity: number,
  isCutback: boolean,
  profile: RunnerProfile,
  category: RunnerCategory,
): WorkoutType[] {
  const mappedPhase: PlanPhase =
    phase === "base" ? "introduction" : phase === "build" ? "continuous_running" : phase === "taper" ? "race_preparation" : "capacity";
  const continuityBand = continuityBandForCategory(category);
  const beginnerLike = beginnerLikeTenKDistanceProfile(profile, category);
  const earlyWeekPolicy = buildEarlyWeekRealismPolicy({
    profile,
    continuityBand,
    beginnerLike,
    phase: mappedPhase,
    weekNumberInPhase,
  });
  const trackPosture = buildTrackPosturePolicy({
    profile,
    track: profile.baseProgramTrack,
    continuityBand,
    beginnerLike,
    phase: mappedPhase,
    weekNumberInPhase,
    useRunWalk: earlyWeekPolicy.preferRunWalk,
    effectivePerformance: false,
  });
  const earlySpecificityReady =
    phase === "base" &&
    weekNumberInPhase <= 2 &&
    !earlyWeekPolicy.preferRunWalk &&
    !trackPosture.preferEasyOnly &&
    profile.baseProgramTrack === "goal_focused" &&
    categoryValue(category) >= categoryValue("recreational") &&
    profile.currentRunsPerWeek >= 4 &&
    profile.currentWeeklyVolumeKm >= 20 &&
    profile.longestRunMinutes >= 40;
  const earlySpecificityType: WorkoutType = earlySpecificityReady && weekNumberInPhase === 2 ? "progression" : "steady";

  if (trainingDaysPerWeek === 2) {
    if (earlyWeekPolicy.preferRunWalk) return ["run-walk", "long"];
    if (phase === "specific" || phase === "peak") return [intensity >= 0.56 ? "progression" : "steady", "long"];
    if (phase === "taper") return ["easy", "race-specific"];
    return ["steady", "long"];
  }

  if (trainingDaysPerWeek === 3) {
    if (trackPosture.preferEasyOnly) return [earlyWeekPolicy.preferRunWalk ? "run-walk" : "easy", "easy", "long"];
    if (phase === "base") return ["easy", earlySpecificityType, "long"];
    if (phase === "build") return ["easy", isCutback ? "steady" : intensity >= 0.4 ? "fartlek" : "steady", "long"];
    if (phase === "specific") return ["easy", intensity >= 0.56 ? "progression" : "steady", "long"];
    if (phase === "peak") return ["easy", intensity >= 0.7 ? "race-specific" : "tempo", "long"];
    return ["easy", "steady", "race-specific"];
  }

  if (trackPosture.preferEasyOnly) return [earlyWeekPolicy.preferRunWalk ? "run-walk" : "easy", "recovery", "easy", "long"];
  if (phase === "base") return ["easy", "recovery", earlySpecificityType, "long"];
  if (phase === "build") return ["easy", "recovery", isCutback ? "steady" : "fartlek", "long"];
  if (phase === "specific") return ["easy", "recovery", intensity >= 0.56 ? "progression" : "steady", "long"];
  if (phase === "peak") return ["easy", "recovery", intensity >= 0.7 ? "race-specific" : "tempo", "long"];
  return ["easy", "recovery", "steady", "race-specific"];
}

function buildSessionByType(type: WorkoutType, context: WorkoutBuildContext): WorkoutSession {
  if (type === "run-walk") return buildRunWalkWorkout(context);
  if (type === "easy") return buildEasyWorkout(context);
  if (type === "recovery") return buildRecoveryWorkout(context);
  if (type === "long") return buildLongWorkout(context);
  if (type === "steady") return buildSteadyWorkout(context);
  if (type === "tempo") return buildTempoWorkout(context);
  if (type === "fartlek") return buildFartlekWorkout(context);
  if (type === "progression") return buildProgressionWorkout(context);
  if (type === "race-specific") return buildRaceSpecificWorkout(context);
  return buildEasyWorkout(context);
}

function sessionMinutes(curves: CurveWeek, type: WorkoutType, trainingDaysPerWeek: GoalConfig["trainingDaysPerWeek"]): { continuous: number; quality: number; long: number; repeats: number } {
  const baseEasy = curves.weeklyVolumeMin * (trainingDaysPerWeek === 4 ? 0.22 : 0.26);
  const qualityShare = curves.intensityScore >= 0.68 ? 0.27 : curves.intensityScore >= 0.5 ? 0.24 : 0.2;
  const quality = roundHalf(clamp(curves.weeklyVolumeMin * qualityShare, 24, 52));
  const easy = roundHalf(clamp(baseEasy, 22, 52));
  const long = roundHalf(clamp(curves.longRunMin, 34, 90));
  const repeats = type === "fartlek" ? (curves.intensityScore >= 0.44 ? 6 : 5) : 4;
  return { continuous: type === "recovery" ? Math.max(16, easy * 0.68) : easy, quality, long, repeats };
}

function buildCurvesSummary(curves: CurveWeek[]): ProgressionCurves {
  return {
    longRunCurve: curves.map((week) => week.longRunMin),
    weeklyVolumeCurve: curves.map((week) => week.weeklyVolumeMin),
    intensityCurve: curves.map((week) => week.intensityScore),
  };
}

export function buildTenKDistancePlan(profile: RunnerProfile, goal: GoalConfig): TrainingPlan {
  const totalWeeks = deriveTotalWeeks(goal);
  const category = profile.runnerCategory ?? "recreational";
  const orderedDays = orderTrainingDaysForLongRun(goal);
  const longRunDay = preferredLongRunDay(goal);
  const startMonday = planStartWeekMonday(goal.startDate);
  const startDate = new Date(`${goal.startDate}T00:00:00`);
  const curves = buildCurves(profile, goal, category, totalWeeks);
  const weeks: TrainingWeek[] = [];
  let previousLoad: number | null = null;
  let previousWasStabilizationWeek = false;

  for (const curveWeek of curves) {
    const types = weeklyTypes(goal.trainingDaysPerWeek, curveWeek.phase, curveWeek.weekNumberInPhase, curveWeek.intensityScore, curveWeek.isCutback, profile, category);
    const weekDays = orderedDays.slice(0, types.length).map((day, idx) => (types[idx] === "long" ? longRunDay : day));
    const usedDays = new Set<WorkoutSession["dayOfWeek"]>();
    const normalizedDays = weekDays.map((day) => {
      if (!usedDays.has(day)) {
        usedDays.add(day);
        return day;
      }
      const fallback = orderedDays.find((candidate) => !usedDays.has(candidate)) ?? day;
      usedDays.add(fallback);
      return fallback;
    });

    const weekMonday = addDays(startMonday, (curveWeek.weekNumber - 1) * 7);
    const scheduledEntries = types
      .map((type, index) => {
        const day = normalizedDays[index];
        const date = addDays(weekMonday, dayOffset(day));
        return { type, day, date, index };
      })
      .filter((entry) => !(curveWeek.weekNumber === 1 && entry.date.getTime() < startDate.getTime()));
    const sessions = scheduledEntries.flatMap((entry, scheduledIndex) => {
      const firstSession = firstSessionPolicy({
        profile,
        goal,
        weekNumber: curveWeek.weekNumber,
        phase: mapPhaseToPlanPhase(curveWeek.phase),
        actualSessionNumber: scheduledIndex + 1,
        actualWeekSessionCount: scheduledEntries.length,
        plannedWeekSessionCount: types.length,
        plannedType: entry.type,
        useRunWalk: entry.type === "run-walk",
      });
      const type = firstSession.protectedType;
      const day = entry.day;
      const date = entry.date;

      const minutes = sessionMinutes(curveWeek, type, goal.trainingDaysPerWeek);
      const earlyWeekPolicy = buildEarlyWeekRealismPolicy({
        profile,
        continuityBand: continuityBandForCategory(category),
        beginnerLike: beginnerLikeTenKDistanceProfile(profile, category),
        phase: curveWeek.phase === "base" ? "introduction" : curveWeek.phase === "build" ? "continuous_running" : curveWeek.phase === "taper" ? "race_preparation" : "capacity",
        weekNumberInPhase: curveWeek.weekNumberInPhase,
      });
      const continuousRunMin =
        type === "long"
          ? Math.max(24, Math.round(curveWeek.weeklyVolumeMin * 0.22))
          : type === "recovery"
            ? Math.max(16, minutes.continuous * 0.72)
            : type === "easy"
              ? minutes.continuous
              : Math.max(18, Math.min(minutes.quality, minutes.continuous + 6));
      const resolvedContinuousRunMin = earlyWeekPolicy.maxContinuousRunMin != null ? Math.min(continuousRunMin, earlyWeekPolicy.maxContinuousRunMin) : continuousRunMin;
      const resolvedLongRunMin = earlyWeekPolicy.maxLongRunMin != null ? Math.min(minutes.long, earlyWeekPolicy.maxLongRunMin) : minutes.long;
      const resolvedIntervalRunMin = earlyWeekPolicy.maxIntervalRunMin != null ? Math.min(clamp(minutes.quality * 0.22, 3, 8), earlyWeekPolicy.maxIntervalRunMin) : clamp(minutes.quality * 0.22, 3, 8);

      return [
        buildSessionByType(type, {
          weekNumber: curveWeek.weekNumber,
          phase: mapPhaseToPlanPhase(curveWeek.phase),
          profile,
          goal,
          dayOfWeek: day,
          date: toIsoDate(date),
          isStabilizationWeek: curveWeek.isCutback,
          continuousRunMin: roundHalf(resolvedContinuousRunMin),
          longRunMin: roundHalf(resolvedLongRunMin),
          intervalRunMin: roundHalf(resolvedIntervalRunMin),
          walkBreakMin: earlyWeekPolicy.minWalkBreakMin ?? 2,
          repeats: minutes.repeats,
          isGoalSession: curveWeek.weekNumber === totalWeeks && entry.index === types.length - 1,
        }),
      ];
    });

    const rawEstimatedLoad = Math.round(sessions.reduce((sum, session) => sum + session.estimatedLoad, 0) * 10) / 10;
    const smoothedTargetLoad = smoothWeeklyLoadTarget(
      rawEstimatedLoad,
      previousLoad,
      curveWeek.phase,
      curveWeek.isCutback,
      profile,
      goal,
      continuityBandForCategory(category),
      previousWasStabilizationWeek,
      beginnerLikeTenKDistanceProfile(profile, category),
    );
    const adjustedSessions = capWeekLoad(sessions, smoothedTargetLoad, previousLoad);
    const estimatedLoad = Math.round(adjustedSessions.reduce((sum, session) => sum + session.estimatedLoad, 0) * 10) / 10;
    weeks.push({
      weekNumber: curveWeek.weekNumber,
      phase: mapPhaseToPlanPhase(curveWeek.phase),
      focus: focusForPhase(curveWeek.phase, curveWeek.isCutback),
      sessions: adjustedSessions,
      estimatedLoad,
      isStabilizationWeek: curveWeek.isCutback,
    });
    previousLoad = estimatedLoad;
    previousWasStabilizationWeek = curveWeek.isCutback;
  }

  const sessions = weeks.flatMap((week) => week.sessions);
  const planSkeleton: TrainingPlan = {
    planType: "TenKDistance" satisfies PlanType,
    goal,
    profile,
    weeks,
    sessions,
    adjustments: [],
    explanationSummary: [],
    curves: buildCurvesSummary(curves),
  };

  const rationale = {
    plan: buildPlanRationale({ profile, plan: planSkeleton }),
    weeks: buildWeekRationales(planSkeleton),
    workouts: buildWorkoutRationales(planSkeleton),
  };

  rationale.plan.profileSummary = [runnerCategoryReason(profile, category), ...rationale.plan.profileSummary].slice(0, 2);
  rationale.plan.structureSummary = [
    `Planen er valgt som TenKDistance, fordi du allerede kan løbe sammenhængende og nu har brug for længere rolige ture, mere samlet volumen og kontrolleret 10 km-specifik udvikling frem for begynder-run-walk.`,
    `Langturen ligger på ${longRunDay === "sunday" ? "søndag" : longRunDay === "saturday" ? "lørdag" : "ugens seneste træningsdag"}, så ugeprofilen passer bedre til den dag de fleste løbere har bedst plads til den længste tur.`,
  ];

  return {
    ...planSkeleton,
    rationale,
    explanationSummary: generatePlanExplanation(profile, { ...planSkeleton, rationale }).slice(0, 4),
  };
}
