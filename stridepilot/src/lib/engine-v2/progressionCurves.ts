import type { LoadDimension, Phase, PhasePlan, PlanType, ProgressionCurves, RunnerClassification, RunnerInput } from "./models";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roundHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

function roundHundred(value: number): number {
  return Math.round(value * 100) / 100;
}

function cutbackEvery(planType: PlanType, runnerLevel: RunnerClassification["traits"]["runnerLevel"]): number {
  if (runnerLevel === "true_beginner" || runnerLevel === "beginner_plus") return 3;
  if (planType.includes("marathon")) return 4;
  return 3;
}

function longRunStart(input: RunnerInput, classification: RunnerClassification, planType: PlanType): number {
  const longest = input.longestRecentRunMin;
  const typical = input.typicalAvailableTimeMin;
  const conservative = classification.traits.trainingStyle === "conservative";
  if (classification.traits.runnerLevel === "true_beginner") return conservative ? 10 : 12;
  if (classification.traits.runnerLevel === "beginner_plus") {
    return roundHalf(clamp(Math.max(conservative ? 16 : 18, longest * 0.72, input.currentContinuousRunMin * 1.15), 16, 35));
  }
  if (planType === "10k_finish") {
    return roundHalf(clamp(Math.max(longest * 0.88, typical * 0.68, 30), 28, 52));
  }
  if (planType === "10k_improve" || planType === "5k_improve") {
    return roundHalf(clamp(Math.max(longest * 0.92, typical * 0.75, 38), 35, 65));
  }
  if (planType.includes("hm")) {
    return roundHalf(clamp(Math.max(longest * 0.95, typical * 0.9, 55), 50, 95));
  }
  if (planType.includes("marathon")) {
    return roundHalf(clamp(Math.max(longest * 0.96, typical, 75), 70, 135));
  }
  return roundHalf(clamp(Math.max(longest * 0.82, 26), 24, 48));
}

function longRunPeak(start: number, input: RunnerInput): number {
  if (input.raceDistance === "5K") return roundHalf(clamp(start + 12, 30, 75));
  if (input.raceDistance === "10K") return roundHalf(clamp(start + 24, 55, 95));
  if (input.raceDistance === "HalfMarathon") return roundHalf(clamp(start + 34, 85, 145));
  return roundHalf(clamp(start + 55, 120, 190));
}

function weeklyVolumeStart(input: RunnerInput, longRunStartMin: number): number {
  const fromKm = input.currentWeeklyVolumeKm * 6;
  const fromFrequency = input.currentWeeklyRuns * Math.max(18, input.typicalAvailableTimeMin * 0.55);
  return roundHalf(clamp(Math.max(fromKm, fromFrequency, longRunStartMin * 2.2), 40, 260));
}

function weeklyVolumePeak(start: number, input: RunnerInput, classification: RunnerClassification): number {
  const styleModifier =
    classification.traits.trainingStyle === "performance" ? 1.18 : classification.traits.trainingStyle === "conservative" ? 1.06 : 1.12;
  const distanceGrowth = input.raceDistance === "5K" ? 18 : input.raceDistance === "10K" ? 28 : input.raceDistance === "HalfMarathon" ? 40 : 58;
  return roundHalf(clamp(start + distanceGrowth * styleModifier, start + 10, 320));
}

function intensityForPhase(phase: Phase, planType: PlanType, classification: RunnerClassification): number {
  const base =
    phase === "base" ? 0.12 : phase === "build" ? 0.22 : phase === "specific" ? 0.36 : phase === "peak" ? 0.46 : 0.24;
  const performanceBonus = planType.includes("improve") ? 0.08 : planType.includes("target_time") ? 0.12 : 0;
  const beginnerPenalty = classification.traits.runnerLevel === "true_beginner" ? 0.16 : classification.traits.runnerLevel === "beginner_plus" ? 0.08 : 0;
  const styleBonus =
    classification.traits.trainingStyle === "performance" ? 0.06 : classification.traits.trainingStyle === "conservative" ? -0.04 : 0;
  return clamp(base + performanceBonus + styleBonus - beginnerPenalty, 0.06, 0.78);
}

function continuousRunTarget(input: RunnerInput, phase: Phase, weekIndex: number, totalWeeks: number): number {
  const current = input.currentContinuousRunMin;
  if (current >= 25 && input.goalType !== "return_to_running") return current;
  const peak =
    input.goalType === "return_to_running"
      ? Math.max(18, current + 10)
      : input.raceDistance === "5K"
        ? 30
        : input.raceDistance === "10K"
          ? 45
          : 55;
  const progress = totalWeeks <= 1 ? 1 : (weekIndex - 1) / (totalWeeks - 1);
  if (phase === "taper") return roundHalf(Math.max(current, peak * 0.84));
  return roundHalf(clamp(current + (peak - current) * progress, current, peak));
}

function specificityForPhase(phase: Phase, planType: PlanType): number {
  const base = phase === "base" ? 0.08 : phase === "build" ? 0.22 : phase === "specific" ? 0.52 : phase === "peak" ? 0.78 : 0.46;
  const performanceBonus = planType.includes("improve") || planType.includes("target_time") ? 0.08 : 0;
  return clamp(base + performanceBonus, 0.05, 0.92);
}

function densityForPhase(phase: Phase, classification: RunnerClassification): number {
  const base = phase === "base" ? 0.62 : phase === "build" ? 0.72 : phase === "specific" ? 0.78 : phase === "peak" ? 0.82 : 0.66;
  const recoveryPenalty = classification.traits.recoveryNeed * 0.2;
  return clamp(base - recoveryPenalty, 0.45, 0.9);
}

function primaryDimension(phase: Phase, weekIndex: number, isCutback: boolean, intensity: number, classification: RunnerClassification): LoadDimension {
  if (isCutback) return "stabilize";
  if (classification.traits.runnerLevel === "true_beginner" || classification.traits.runnerLevel === "beginner_plus") {
    if (phase === "base") return "continuous_running";
    if (phase === "build") return "weekly_volume";
  }
  if (phase === "base") return "weekly_volume";
  if (phase === "build") return weekIndex % 2 === 0 ? "long_run" : "weekly_volume";
  if (phase === "specific" || phase === "peak") return intensity >= 0.42 ? "intensity" : "long_run";
  return "stabilize";
}

function growthCap(primary: LoadDimension, previous: number, proposed: number): number {
  const factor =
    primary === "long_run"
      ? 1.1
      : primary === "weekly_volume"
        ? 1.1
        : primary === "intensity"
          ? 1.08
          : primary === "continuous_running"
            ? 1.15
            : 1.04;
  return Math.min(proposed, previous * factor);
}

export function buildProgressionCurves(
  input: RunnerInput,
  classification: RunnerClassification,
  phasePlan: PhasePlan,
  planType: PlanType,
): ProgressionCurves {
  const longStart = longRunStart(input, classification, planType);
  const longPeak = longRunPeak(longStart, input);
  const volumeStart = weeklyVolumeStart(input, longStart);
  const volumePeak = weeklyVolumePeak(volumeStart, input, classification);
  const interval = cutbackEvery(planType, classification.traits.runnerLevel);

  const longRunCurve: number[] = [];
  const weeklyVolumeCurve: number[] = [];
  const intensityCurve: number[] = [];
  const continuousCurve: number[] = [];
  const specificityCurve: number[] = [];
  const densityCurve: number[] = [];
  const primaryLoadDimension: LoadDimension[] = [];
  const cutbackWeeks: number[] = [];
  const taperWeeks: number[] = [];

  let previousLongRun = longStart;
  let previousVolume = volumeStart;
  let previousIntensity = intensityForPhase(phasePlan.weeks[0]?.phase ?? "base", planType, classification);
  let previousContinuous = Math.max(input.currentContinuousRunMin, 1);

  for (const week of phasePlan.weeks) {
    const phaseBase =
      week.phase === "base"
        ? 0.12 + week.phaseProgress * 0.12
        : week.phase === "build"
          ? 0.28 + week.phaseProgress * 0.28
          : week.phase === "specific"
            ? 0.58 + week.phaseProgress * 0.16
            : week.phase === "peak"
              ? 0.72 + week.phaseProgress * 0.12
              : 0.4 - week.phaseProgress * 0.24;
    const isCutback = week.phase !== "taper" && week.phase !== "peak" && week.weekIndex > 1 && week.weekIndex % interval === 0;
    const baseLongRun = roundHalf(longStart + (longPeak - longStart) * phaseBase);
    const baseVolume = roundHalf(volumeStart + (volumePeak - volumeStart) * phaseBase);
    const baseIntensity = roundHundred(intensityForPhase(week.phase, planType, classification) * (isCutback ? 0.82 : 1));
    const baseContinuous = continuousRunTarget(input, week.phase, week.weekIndex, phasePlan.totalWeeks);
    const primary = primaryDimension(week.phase, week.weekIndex, isCutback, baseIntensity, classification);

    let proposedLongRun = week.phase === "taper" ? previousLongRun * 0.82 : baseLongRun * (isCutback ? 0.88 : 1);
    let proposedVolume = week.phase === "taper" ? previousVolume * 0.78 : baseVolume * (isCutback ? 0.86 : 1);
    let proposedIntensity = week.phase === "taper" ? Math.max(baseIntensity, previousIntensity * 0.88) : baseIntensity;
    let proposedContinuous = week.phase === "taper" ? Math.max(input.currentContinuousRunMin, previousContinuous * 0.95) : baseContinuous;

    proposedLongRun = growthCap(primary === "long_run" ? "long_run" : "stabilize", previousLongRun, proposedLongRun);
    proposedVolume = growthCap(primary === "weekly_volume" ? "weekly_volume" : "stabilize", previousVolume, proposedVolume);
    proposedIntensity = Math.min(proposedIntensity, previousIntensity * (primary === "intensity" ? 1.08 : 1.03));
    proposedContinuous = growthCap(primary === "continuous_running" ? "continuous_running" : "stabilize", previousContinuous, proposedContinuous);

    const longRun = roundHalf(clamp(proposedLongRun, 10, longPeak));
    const weeklyVolume = roundHalf(clamp(Math.max(longRun * 1.7, proposedVolume), 30, volumePeak));
    const intensity = roundHundred(clamp(proposedIntensity, 0.06, 0.82));
    const continuous = roundHalf(clamp(proposedContinuous, input.currentContinuousRunMin, Math.max(input.currentContinuousRunMin, 60)));
    const specificity = roundHundred(specificityForPhase(week.phase, planType) * (isCutback ? 0.88 : 1));
    const density = roundHundred(densityForPhase(week.phase, classification) * (isCutback ? 0.92 : 1));

    week.isCutback = isCutback;
    if (isCutback) cutbackWeeks.push(week.weekIndex);
    if (week.phase === "taper") taperWeeks.push(week.weekIndex);
    longRunCurve.push(longRun);
    weeklyVolumeCurve.push(weeklyVolume);
    intensityCurve.push(intensity);
    continuousCurve.push(continuous);
    specificityCurve.push(specificity);
    densityCurve.push(density);
    primaryLoadDimension.push(primary);

    previousLongRun = longRun;
    previousVolume = weeklyVolume;
    previousIntensity = intensity;
    previousContinuous = continuous;
  }

  return { longRunCurve, weeklyVolumeCurve, intensityCurve, continuousCurve, specificityCurve, densityCurve, primaryLoadDimension, cutbackWeeks, taperWeeks };
}
