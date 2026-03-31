import type {
  EngineV1BackboneType as EngineV2BackboneType,
  EngineV1GoalDistance as EngineV2GoalDistance,
  EngineV1GoalType as EngineV2GoalType,
  EngineV1Phase as EngineV2Phase,
  EngineV1PhaseBlock as EngineV2PhaseBlock,
  EngineV1Plan as EngineV2Plan,
  EngineV1Profile as EngineV2Profile,
  EngineV1Week as EngineV2Week,
  EngineV1Workout as EngineV2Workout,
  EngineV1WorkoutBlock as EngineV2WorkoutBlock,
  EngineV1WorkoutType as EngineV2WorkoutType,
} from "../engine-v1";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roundHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

function isPerformanceGoal(goalType: EngineV2GoalType): boolean {
  return goalType === "improve_time" || goalType === "target_time";
}

function isFinishGoal(goalType: EngineV2GoalType): boolean {
  return goalType === "finish" || goalType === "finish_without_walking" || goalType === "return_to_running";
}

function runnerLevelFactor(profile: EngineV2Profile): number {
  switch (profile.runnerLevel) {
    case "true_beginner":
      return 0.72;
    case "beginner":
      return 0.82;
    case "beginner_plus":
      return 0.9;
    case "recreational":
      return 1;
    case "intermediate":
      return 1.08;
    case "advanced":
      return 1.15;
  }
}

function chooseBackboneType(profile: EngineV2Profile): EngineV2BackboneType {
  if (profile.goalType === "return_to_running") return "hybrid";
  if (profile.runnerLevel === "true_beginner" || profile.runnerLevel === "beginner" || profile.goalType === "finish_without_walking") return "continuous";
  if (profile.runnerLevel === "beginner_plus" && profile.goalDistance !== "marathon" && isFinishGoal(profile.goalType)) return "hybrid";
  return "long_run";
}

export function buildPhases(timelineWeeks: number): EngineV2PhaseBlock[] {
  const totalWeeks = Math.max(4, timelineWeeks);
  const raceWeeks = 1;
  const taperWeeks = totalWeeks >= 18 ? 2 : 1;
  const developmentWeeks = Math.max(totalWeeks - raceWeeks - taperWeeks, 2);

  const baseCount = Math.max(1, Math.round(developmentWeeks * 0.3));
  let buildCount = Math.max(1, Math.round(developmentWeeks * 0.3));
  let specificCount = Math.max(1, Math.round(developmentWeeks * 0.25));
  let peakCount = Math.max(1, developmentWeeks - baseCount - buildCount - specificCount);

  while (baseCount + buildCount + specificCount + peakCount > developmentWeeks) {
    if (peakCount > 1) peakCount -= 1;
    else if (specificCount > 1) specificCount -= 1;
    else buildCount -= 1;
  }

  while (baseCount + buildCount + specificCount + peakCount < developmentWeeks) {
    buildCount += 1;
  }

  const blocks: Array<{ phase: EngineV2Phase; length: number }> = [
    { phase: "base", length: baseCount },
    { phase: "build", length: buildCount },
    { phase: "specific", length: specificCount },
    { phase: "peak", length: peakCount },
    { phase: "taper", length: taperWeeks },
    { phase: "race_week", length: raceWeeks },
  ];

  let cursor = 1;
  return blocks.filter((block) => block.length > 0).map((block) => {
    const startWeek = cursor;
    const endWeek = cursor + block.length - 1;
    cursor = endWeek + 1;
    return { phase: block.phase, startWeek, endWeek };
  });
}

export function buildTaperWeeks(timelineWeeks: number): number[] {
  const totalWeeks = Math.max(4, timelineWeeks);
  const taperCount = totalWeeks >= 18 ? 2 : 1;
  return Array.from({ length: taperCount }, (_, index) => totalWeeks - 1 - index).sort((a, b) => a - b);
}

export function buildStepBackWeeks(timelineWeeks: number): number[] {
  const totalWeeks = Math.max(4, timelineWeeks);
  const taperWeeks = new Set(buildTaperWeeks(totalWeeks));
  const weeks: number[] = [];
  for (let week = 4; week < totalWeeks; week += 3) {
    if (!taperWeeks.has(week) && week !== totalWeeks) weeks.push(week);
  }
  return weeks;
}

function phaseForWeek(weekNumber: number, phases: EngineV2PhaseBlock[]): EngineV2Phase {
  return phases.find((phase) => weekNumber >= phase.startWeek && weekNumber <= phase.endWeek)?.phase ?? "base";
}

function continuousTargetForDistance(goalDistance: EngineV2GoalDistance, goalType: EngineV2GoalType): number {
  if (goalType === "finish_without_walking") return goalDistance === "10k" ? 60 : 30;
  if (goalDistance === "5k") return isPerformanceGoal(goalType) ? 42 : 30;
  if (goalDistance === "10k") return 62;
  if (goalDistance === "half_marathon") return 92;
  return 120;
}

function longRunPeakForDistance(goalDistance: EngineV2GoalDistance, goalType: EngineV2GoalType): number {
  if (goalDistance === "5k") return goalType === "target_time" ? 50 : 45;
  if (goalDistance === "10k") return goalType === "target_time" ? 78 : 72;
  if (goalDistance === "half_marathon") return goalType === "target_time" ? 120 : 105;
  return goalType === "target_time" ? 180 : 165;
}

function levelContinuousStep(runnerLevel: EngineV2Profile["runnerLevel"]): { min: number; max: number; cutback: number } {
  switch (runnerLevel) {
    case "true_beginner":
      return { min: 1.5, max: 3, cutback: 2 };
    case "beginner":
      return { min: 1.5, max: 3, cutback: 2 };
    case "beginner_plus":
      return { min: 1, max: 2.5, cutback: 1.5 };
    case "recreational":
      return { min: 0.5, max: 2, cutback: 1 };
    case "intermediate":
      return { min: 0.5, max: 2, cutback: 1 };
    case "advanced":
      return { min: 0.5, max: 1.5, cutback: 1 };
  }
}

export function buildContinuousCurve(startContinuous: number, targetContinuous: number, weeks: number, runnerLevel: EngineV2Profile["runnerLevel"]): number[] {
  const totalWeeks = Math.max(4, weeks);
  const taperWeeks = new Set(buildTaperWeeks(totalWeeks));
  const stepBackWeeks = new Set(buildStepBackWeeks(totalWeeks));
  const curve: number[] = [];
  const tuning = levelContinuousStep(runnerLevel);
  let current = Math.max(1, roundHalf(startContinuous));
  let peak = current;

  for (let week = 1; week <= totalWeeks; week += 1) {
    if (week === totalWeeks) {
      curve.push(roundHalf(Math.max(startContinuous, peak * 0.72)));
      continue;
    }
    if (taperWeeks.has(week)) {
      const factor = week === Math.min(...taperWeeks) ? 0.9 : 0.78;
      current = roundHalf(Math.max(startContinuous, peak * factor));
      curve.push(current);
      continue;
    }
    if (stepBackWeeks.has(week)) {
      current = roundHalf(Math.max(startContinuous, peak - tuning.cutback));
      curve.push(current);
      continue;
    }

    const remainingBuildWeeks = Math.max(totalWeeks - week - taperWeeks.size, 1);
    const remaining = Math.max(targetContinuous - current, 0);
    const suggested = remaining / remainingBuildWeeks;
    const increase = Math.min(tuning.max, Math.max(tuning.min, suggested));
    current = roundHalf(Math.min(targetContinuous, current + increase));
    peak = Math.max(peak, current);
    curve.push(current);
  }

  return curve;
}

export function buildLongRunCurve(
  startLongRun: number,
  peakLongRun: number,
  weeks: number,
  stepBackWeeks: number[],
  taperWeeks: number[],
): number[] {
  const totalWeeks = Math.max(4, weeks);
  const stepBacks = new Set(stepBackWeeks);
  const tapers = new Set(taperWeeks);
  const curve: number[] = [];
  let current = roundHalf(startLongRun);
  let previousPeak = current;

  for (let week = 1; week <= totalWeeks; week += 1) {
    if (week === totalWeeks) {
      curve.push(roundHalf(previousPeak * 0.45));
      continue;
    }
    if (tapers.has(week)) {
      const factor = taperWeeks.length === 2 && week === taperWeeks[0] ? 0.72 : 0.52;
      current = roundHalf(Math.max(startLongRun * 0.85, previousPeak * factor));
      curve.push(current);
      continue;
    }
    if (stepBacks.has(week)) {
      current = roundHalf(Math.max(startLongRun, previousPeak * 0.9));
      curve.push(current);
      continue;
    }

    const remainingBuildWeeks = Math.max(totalWeeks - week - taperWeeks.length, 1);
    const remaining = Math.max(peakLongRun - current, 0);
    const suggested = remaining / remainingBuildWeeks;
    const maxIncrease = current * 0.08;
    current = roundHalf(Math.min(peakLongRun, current + Math.min(Math.max(2, suggested), maxIncrease)));
    previousPeak = Math.max(previousPeak, current);
    curve.push(current);
  }

  return curve;
}

function intervalPhaseRatio(phase: EngineV2Phase, goalType: EngineV2GoalType): number {
  const performanceBoost = goalType === "target_time" ? 1.15 : goalType === "improve_time" ? 1 : 0.55;
  switch (phase) {
    case "base":
      return 0.02 * performanceBoost;
    case "build":
      return 0.08 * performanceBoost;
    case "specific":
      return 0.14 * performanceBoost;
    case "peak":
      return 0.11 * performanceBoost;
    case "taper":
      return 0.06 * performanceBoost;
    case "race_week":
      return 0.03 * performanceBoost;
  }
}

export function buildIntervalCurve(
  phases: EngineV2Phase[],
  weeklyVolumeCurve: number[],
  runnerLevel: EngineV2Profile["runnerLevel"],
  goalType: EngineV2GoalType,
  stepBackWeeks: number[],
  taperWeeks: number[],
): number[] {
  const stepBacks = new Set(stepBackWeeks);
  const tapers = new Set(taperWeeks);
  const curve: number[] = [];
  let previous = 0;
  const levelFactor =
    runnerLevel === "true_beginner" || runnerLevel === "beginner"
      ? 0.4
      : runnerLevel === "beginner_plus"
        ? 0.7
        : runnerLevel === "recreational"
          ? 1
          : runnerLevel === "intermediate"
            ? 1.1
            : 1.2;

  phases.forEach((phase, index) => {
    const weekNumber = index + 1;
    const target = roundHalf((weeklyVolumeCurve[index] ?? 0) * intervalPhaseRatio(phase, goalType) * levelFactor);
    let current = target;

    if (stepBacks.has(weekNumber)) {
      current = roundHalf(previous * 0.78);
    } else if (tapers.has(weekNumber)) {
      current = roundHalf(previous * 0.6);
    } else if (phase === "race_week") {
      current = roundHalf(Math.max(0, previous * 0.45));
    } else {
      const maxGrowth = previous === 0 ? target : previous * 0.3;
      current = roundHalf(Math.min(target, previous + maxGrowth));
    }

    if (isFinishGoal(goalType)) current = roundHalf(current * 0.6);
    previous = Math.max(0, current);
    curve.push(previous);
  });

  return curve;
}

function easyRecoveryVolumeForWeek(
  weeklyVolume: number,
  longRun: number,
  intervalVolume: number,
  goalType: EngineV2GoalType,
): { easyVolume: number; recoveryVolume: number } {
  const remainder = Math.max(0, weeklyVolume - longRun - intervalVolume);
  if (isFinishGoal(goalType)) {
    return {
      easyVolume: roundHalf(remainder * 0.82),
      recoveryVolume: roundHalf(remainder * 0.18),
    };
  }
  if (goalType === "target_time") {
    return {
      easyVolume: roundHalf(remainder * 0.68),
      recoveryVolume: roundHalf(remainder * 0.32),
    };
  }
  return {
    easyVolume: roundHalf(remainder * 0.74),
    recoveryVolume: roundHalf(remainder * 0.26),
  };
}

export function buildWeeklyVolumeCurve(
  longRunCurve: number[],
  intervalCurve: number[],
  profile: EngineV2Profile,
): number[] {
  const levelFactor = runnerLevelFactor(profile);
  const baseEasyMultiplier = isFinishGoal(profile.goalType) ? 1.4 : profile.goalType === "target_time" ? 1.05 : 1.18;
  const recoveryMultiplier = profile.runnerLevel === "true_beginner" || profile.runnerLevel === "beginner" ? 0.45 : 0.32;

  return longRunCurve.map((longRun, index) => {
    const intervalVolume = intervalCurve[index] ?? 0;
    const easyVolume = longRun * baseEasyMultiplier * levelFactor;
    const recoveryVolume = (easyVolume + intervalVolume) * recoveryMultiplier;
    return roundHalf(longRun + easyVolume + recoveryVolume + intervalVolume);
  });
}

function choosePrimaryQualityType(goalType: EngineV2GoalType, phase: EngineV2Phase): EngineV2WorkoutType {
  if (phase === "race_week") return "race_pace";
  if (goalType === "target_time") return phase === "specific" || phase === "peak" ? "race_pace" : "intervals";
  if (goalType === "improve_time") return phase === "specific" ? "tempo" : "intervals";
  return "easy";
}

export function distributeVolumeAcrossWeek(
  weeklyVolume: number,
  longRun: number,
  intervalVolume: number,
  sessionsPerWeek: number,
  phase: EngineV2Phase,
  goalType: EngineV2GoalType,
): Array<{ workoutType: EngineV2WorkoutType; durationMin: number }> {
  const sessions = clamp(sessionsPerWeek, 2, 5);
  const longRunCap = isFinishGoal(goalType) ? 0.35 : 0.42;
  const cappedLongRun = roundHalf(Math.min(longRun, weeklyVolume * longRunCap));
  const cappedIntervals = roundHalf(Math.min(intervalVolume, weeklyVolume * 0.25));
  const { easyVolume, recoveryVolume } = easyRecoveryVolumeForWeek(weeklyVolume, cappedLongRun, cappedIntervals, goalType);
  const qualityType = choosePrimaryQualityType(goalType, phase);

  if (sessions === 2) {
    return [
      { workoutType: isFinishGoal(goalType) ? "easy" : qualityType, durationMin: roundHalf(weeklyVolume - cappedLongRun) },
      { workoutType: "long", durationMin: cappedLongRun },
    ];
  }

  if (sessions === 3) {
    return [
      { workoutType: "easy", durationMin: roundHalf(easyVolume * 0.52) },
      { workoutType: isFinishGoal(goalType) && phase === "base" ? "easy" : qualityType, durationMin: roundHalf(Math.max(cappedIntervals, easyVolume * 0.2)) },
      { workoutType: "long", durationMin: roundHalf(weeklyVolume - roundHalf(easyVolume * 0.52) - roundHalf(Math.max(cappedIntervals, easyVolume * 0.2))) },
    ];
  }

  if (sessions === 4) {
    const easyOne = roundHalf(easyVolume * 0.45);
    const recovery = roundHalf(Math.max(recoveryVolume, weeklyVolume * 0.12));
    const quality = roundHalf(Math.max(cappedIntervals, weeklyVolume * (isFinishGoal(goalType) ? 0.08 : 0.14)));
    return [
      { workoutType: "easy", durationMin: easyOne },
      { workoutType: isFinishGoal(goalType) && phase === "base" ? "easy" : qualityType, durationMin: quality },
      { workoutType: "recovery", durationMin: recovery },
      { workoutType: "long", durationMin: roundHalf(weeklyVolume - easyOne - quality - recovery) },
    ];
  }

  const easyOne = roundHalf(easyVolume * 0.34);
  const easyTwo = roundHalf(easyVolume * 0.3);
  const recovery = roundHalf(Math.max(recoveryVolume, weeklyVolume * 0.12));
  const primaryQuality = roundHalf(Math.max(cappedIntervals * 0.55, weeklyVolume * 0.1));
  const secondaryQuality = roundHalf(Math.max(cappedIntervals - primaryQuality, weeklyVolume * (goalType === "target_time" ? 0.08 : 0.06)));

  return [
    { workoutType: "easy", durationMin: easyOne },
    { workoutType: qualityType, durationMin: primaryQuality },
    { workoutType: "easy", durationMin: easyTwo },
    { workoutType: goalType === "target_time" ? "tempo" : isFinishGoal(goalType) ? "recovery" : "tempo", durationMin: Math.max(recovery, secondaryQuality) },
    { workoutType: "long", durationMin: roundHalf(weeklyVolume - easyOne - primaryQuality - easyTwo - Math.max(recovery, secondaryQuality)) },
  ];
}

export function generateWorkout(workoutType: EngineV2WorkoutType, duration: number): EngineV2Workout {
  const total = Math.max(12, roundHalf(duration));

  const blocksFor = (): EngineV2WorkoutBlock[] => {
    if (workoutType === "run_walk") {
      const runBlock = total >= 30 ? 4 : total >= 24 ? 3 : 2;
      const repeats = Math.max(4, Math.floor((total - 5) / (runBlock + 1)));
      return [
        { type: "warmup", durationMin: 5 },
        { type: "run", durationMin: runBlock, repeats, restMin: 1 },
        { type: "cooldown", durationMin: 5 },
      ];
    }
    if (workoutType === "intervals") {
      const ladder = total >= 52 ? { reps: 2, work: 10, rest: 2 } : total >= 44 ? { reps: 3, work: 8, rest: 2 } : total >= 36 ? { reps: 4, work: 5, rest: 2 } : { reps: 4, work: 3, rest: 2 };
      return [
        { type: "warmup", durationMin: 10 },
        { type: "interval", durationMin: ladder.work, repeats: ladder.reps, restMin: ladder.rest },
        { type: "cooldown", durationMin: Math.max(5, roundHalf(total - 10 - ladder.reps * ladder.work - (ladder.reps - 1) * ladder.rest)) },
      ];
    }
    if (workoutType === "tempo") {
      const tempoBlock = total >= 48 ? 25 : total >= 40 ? 20 : total >= 32 ? 15 : 10;
      return [
        { type: "warmup", durationMin: 8 },
        { type: "tempo", durationMin: tempoBlock },
        { type: "cooldown", durationMin: Math.max(5, roundHalf(total - 8 - tempoBlock)) },
      ];
    }
    if (workoutType === "race_pace") {
      const reps = total >= 42 ? 2 : 1;
      const block = total >= 42 ? 10 : 8;
      return [
        { type: "warmup", durationMin: 8 },
        { type: "race_pace", durationMin: block, repeats: reps, restMin: reps > 1 ? 3 : undefined },
        { type: "cooldown", durationMin: Math.max(5, roundHalf(total - 8 - block * reps - (reps > 1 ? 3 : 0))) },
      ];
    }
    if (workoutType === "long") {
      return [
        { type: "warmup", durationMin: 5 },
        { type: "easy", durationMin: Math.max(10, roundHalf(total - 10)) },
        { type: "cooldown", durationMin: 5 },
      ];
    }
    if (workoutType === "recovery") {
      return [
        { type: "warmup", durationMin: 4 },
        { type: "easy", durationMin: Math.max(8, roundHalf(total - 8)) },
        { type: "cooldown", durationMin: 4 },
      ];
    }
    return [
      { type: "warmup", durationMin: 5 },
      { type: "easy", durationMin: Math.max(8, roundHalf(total - 10)) },
      { type: "cooldown", durationMin: 5 },
    ];
  };

  return {
    workoutType,
    durationMin: total,
    blocks: blocksFor(),
  };
}

function assignDays(workouts: EngineV2Workout[], profile: EngineV2Profile): EngineV2Workout[] {
  const defaultDays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const availableDays = profile.availableTrainingDays && profile.availableTrainingDays.length >= workouts.length
    ? [...profile.availableTrainingDays]
    : defaultDays.slice(0, Math.max(workouts.length, 5));

  const longRunDay = profile.preferredLongRunDay && availableDays.includes(profile.preferredLongRunDay)
    ? profile.preferredLongRunDay
    : availableDays[availableDays.length - 1];

  const long = workouts.find((workout) => workout.workoutType === "long");
  if (long) long.day = longRunDay;

  const dayIndex = (day?: string) => day ? defaultDays.indexOf(day) : -1;
  const qualityDays = new Set<string>();

  for (const workout of workouts) {
    if (workout.day) continue;
    const isQuality = workout.workoutType === "intervals" || workout.workoutType === "tempo" || workout.workoutType === "race_pace";
    const disallowed = new Set<string>();
    if (isQuality) {
      disallowed.add(longRunDay);
      const longIdx = dayIndex(longRunDay);
      if (longIdx > 0) disallowed.add(defaultDays[longIdx - 1]);
      qualityDays.forEach((day) => {
        const idx = dayIndex(day);
        if (idx >= 0 && idx < defaultDays.length - 1) disallowed.add(defaultDays[idx + 1]);
      });
    }

    const candidate = availableDays.find((day) => !disallowed.has(day) && !workouts.some((existing) => existing.day === day)) ??
      availableDays.find((day) => !workouts.some((existing) => existing.day === day));
    workout.day = candidate;
    if (isQuality && candidate) qualityDays.add(candidate);
  }

  return workouts;
}

export function applySafetyRules(trainingPlan: EngineV2Plan): EngineV2Plan {
  const weeks = trainingPlan.weeks.map((week) => ({
    ...week,
    workouts: week.workouts.map((workout) => ({ ...workout, blocks: workout.blocks.map((block) => ({ ...block })) })),
  }));

  for (let index = 0; index < weeks.length; index += 1) {
    const week = weeks[index];
    const previous = weeks[index - 1];
    if (previous) {
      const maxVolume = roundHalf(previous.weeklyVolume * 1.1);
      if (!week.progressionMetrics.isTaperWeek && !week.progressionMetrics.isRaceWeek && week.weeklyVolume > maxVolume) {
        week.weeklyVolume = maxVolume;
      }

      const maxLongRun = roundHalf(previous.longRun * 1.1);
      if (!week.progressionMetrics.isTaperWeek && !week.progressionMetrics.isRaceWeek && week.longRun > maxLongRun) {
        week.longRun = maxLongRun;
      }
    }

    const longRunCap = trainingPlan.backboneType === "continuous" ? 0.35 : 0.45;
    const longRunFloor = trainingPlan.backboneType === "continuous" ? 0.2 : 0.22;
    const share = week.weeklyVolume > 0 ? week.longRun / week.weeklyVolume : 0;
    if (share > longRunCap) week.longRun = roundHalf(week.weeklyVolume * longRunCap);
    if (share < longRunFloor) week.longRun = roundHalf(week.weeklyVolume * longRunFloor);
    if (week.intervalVolume > week.weeklyVolume * 0.25) week.intervalVolume = roundHalf(week.weeklyVolume * 0.25);

    const quality = week.workouts.filter((workout) => workout.workoutType === "intervals" || workout.workoutType === "tempo" || workout.workoutType === "race_pace");
    if (quality.length > 2) {
      for (const workout of quality.slice(2)) {
        workout.workoutType = "easy";
        workout.blocks = generateWorkout("easy", workout.durationMin).blocks;
      }
    }

    if (trainingPlan.backboneType === "continuous") {
      for (const workout of week.workouts) {
        if (workout.workoutType === "intervals") {
          workout.workoutType = "run_walk";
          workout.blocks = generateWorkout("run_walk", workout.durationMin).blocks;
        }
      }
    }
  }

  return { ...trainingPlan, weeks };
}

export function buildTrainingPlan(profile: EngineV2Profile): EngineV2Plan {
  const phases = buildPhases(profile.timelineWeeks);
  const stepBackWeeks = buildStepBackWeeks(profile.timelineWeeks);
  const taperWeeks = buildTaperWeeks(profile.timelineWeeks);
  const backboneType = chooseBackboneType(profile);
  const phaseTimeline = Array.from({ length: profile.timelineWeeks }, (_, index) => phaseForWeek(index + 1, phases));

  const targetContinuous = continuousTargetForDistance(profile.goalDistance, profile.goalType);
  const continuousCurve = buildContinuousCurve(profile.currentContinuousMin, targetContinuous, profile.timelineWeeks, profile.runnerLevel);

  const startLongRun = roundHalf(
    clamp(
      Math.max(profile.longestRecentRunMin * 0.88, profile.currentContinuousMin * 1.15),
      profile.goalDistance === "5k" ? 15 : 20,
      profile.longestRecentRunMin * 1.05,
    ),
  );
  const peakLongRun = longRunPeakForDistance(profile.goalDistance, profile.goalType);
  const longRunCurve = buildLongRunCurve(startLongRun, peakLongRun, profile.timelineWeeks, stepBackWeeks, taperWeeks);
  const preliminaryIntervalCurve = buildIntervalCurve(phaseTimeline, longRunCurve.map((value) => value * 3), profile.runnerLevel, profile.goalType, stepBackWeeks, taperWeeks);
  const weeklyVolumeCurve = buildWeeklyVolumeCurve(longRunCurve, preliminaryIntervalCurve, profile);
  const intervalVolumeCurve = buildIntervalCurve(phaseTimeline, weeklyVolumeCurve, profile.runnerLevel, profile.goalType, stepBackWeeks, taperWeeks);

  const weeks: EngineV2Week[] = Array.from({ length: profile.timelineWeeks }, (_, index) => {
    const weekNumber = index + 1;
    const phase = phaseTimeline[index];
    const sessionsPerWeek = phase === "race_week" ? Math.min(profile.sessionsPerWeek, 3) : profile.sessionsPerWeek;
    const weeklyVolume = weeklyVolumeCurve[index];
    const longRun = longRunCurve[index];
    const intervalVolume = intervalVolumeCurve[index];

    let distribution = distributeVolumeAcrossWeek(weeklyVolume, longRun, intervalVolume, sessionsPerWeek, phase, profile.goalType);

    if (phase === "base" && isFinishGoal(profile.goalType)) {
      distribution = distribution.map((item) =>
        item.workoutType === "intervals" || item.workoutType === "tempo" || item.workoutType === "race_pace"
          ? { workoutType: backboneType === "continuous" ? "run_walk" : "easy", durationMin: item.durationMin }
          : item,
      );
    }

    if (phase === "race_week") {
      distribution = distribution.slice(0, Math.min(distribution.length, 3)).map((item, itemIndex, items) => {
        if (itemIndex === items.length - 1) return { workoutType: isPerformanceGoal(profile.goalType) ? "race_pace" : "easy", durationMin: Math.max(16, item.durationMin * 0.6) };
        return { workoutType: itemIndex === 0 ? "easy" : "recovery", durationMin: Math.max(16, item.durationMin * 0.55) };
      });
    }

    const workouts = assignDays(distribution.map((item) => generateWorkout(item.workoutType, item.durationMin)), profile);

    return {
      weekNumber,
      phase,
      weeklyVolume,
      longRun,
      intervalVolume,
      continuousTarget: continuousCurve[index],
      workouts,
      progressionMetrics: {
        sessionsPerWeek,
        isStepBackWeek: stepBackWeeks.includes(weekNumber),
        isTaperWeek: taperWeeks.includes(weekNumber),
        isRaceWeek: phase === "race_week",
      },
    };
  });

  return applySafetyRules({
    backboneType,
    phases,
    stepBackWeeks,
    taperWeeks,
    continuousCurve,
    longRunCurve,
    weeklyVolumeCurve,
    intervalVolumeCurve,
    weeks,
    progressionMetrics: {
      peakWeeklyVolume: Math.max(...weeklyVolumeCurve),
      peakLongRun: Math.max(...longRunCurve),
      peakContinuousRun: Math.max(...continuousCurve),
    },
  });
}
