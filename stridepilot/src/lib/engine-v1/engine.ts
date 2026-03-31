import type {
  EngineV1BackboneType,
  EngineV1GoalDistance,
  EngineV1GoalType,
  EngineV1Phase,
  EngineV1PhaseBlock,
  EngineV1Plan,
  EngineV1Profile,
  EngineV1Week,
  EngineV1Workout,
  EngineV1WorkoutBlock,
  EngineV1WorkoutType,
} from "./types";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roundHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

function isPerformanceGoal(goalType: EngineV1GoalType): boolean {
  return goalType === "improve_time" || goalType === "target_time";
}

function isBeginnerStyleGoal(goalType: EngineV1GoalType): boolean {
  return goalType === "finish_without_walking" || goalType === "return_to_running";
}

function chooseBackboneType(profile: EngineV1Profile): EngineV1BackboneType {
  if (profile.goalType === "return_to_running") return "hybrid";
  if (profile.runnerLevel === "true_beginner" || profile.runnerLevel === "beginner" || profile.goalType === "finish_without_walking") {
    return "continuous";
  }
  if (profile.goalDistance === "5k" && profile.runnerLevel === "beginner_plus" && profile.goalType === "finish") return "hybrid";
  return "long_run";
}

export function buildPhases(timelineWeeks: number): EngineV1PhaseBlock[] {
  const totalWeeks = Math.max(4, timelineWeeks);
  const raceWeeks = 1;
  const taperWeeks = totalWeeks >= 14 ? 2 : 1;
  const developmentWeeks = Math.max(totalWeeks - raceWeeks - taperWeeks, 2);

  let baseCount = Math.max(1, Math.round(developmentWeeks * 0.3));
  let buildCount = Math.max(1, Math.round(developmentWeeks * 0.3));
  let specificCount = Math.max(1, Math.round(developmentWeeks * 0.25));
  let peakCount = Math.max(1, developmentWeeks - baseCount - buildCount - specificCount);

  while (baseCount + buildCount + specificCount + peakCount > developmentWeeks) {
    if (peakCount > 1) peakCount -= 1;
    else if (specificCount > 1) specificCount -= 1;
    else if (buildCount > 1) buildCount -= 1;
    else baseCount -= 1;
  }

  while (baseCount + buildCount + specificCount + peakCount < developmentWeeks) {
    buildCount += 1;
  }

  const blocks: Array<{ phase: EngineV1Phase; length: number }> = [
    { phase: "base", length: baseCount },
    { phase: "build", length: buildCount },
    { phase: "specific", length: specificCount },
    { phase: "peak", length: peakCount },
    { phase: "taper", length: taperWeeks },
    { phase: "race_week", length: raceWeeks },
  ];

  let cursor = 1;
  return blocks
    .filter((block) => block.length > 0)
    .map((block) => {
      const startWeek = cursor;
      const endWeek = cursor + block.length - 1;
      cursor = endWeek + 1;
      return { phase: block.phase, startWeek, endWeek };
    });
}

export function buildStepBackWeeks(timelineWeeks: number): number[] {
  const totalWeeks = Math.max(4, timelineWeeks);
  const taperWeeks = buildTaperWeeks(totalWeeks);
  const protectedWeeks = new Set([...taperWeeks, totalWeeks]);
  const weeks: number[] = [];

  for (let week = 4; week < totalWeeks; week += 3) {
    if (!protectedWeeks.has(week)) weeks.push(week);
  }

  return weeks;
}

export function buildTaperWeeks(timelineWeeks: number): number[] {
  const totalWeeks = Math.max(4, timelineWeeks);
  const taperCount = totalWeeks >= 14 ? 2 : 1;
  return Array.from({ length: taperCount }, (_, index) => totalWeeks - 1 - index).sort((a, b) => a - b);
}

function phaseForWeek(weekNumber: number, phases: EngineV1PhaseBlock[]): EngineV1Phase {
  return phases.find((phase) => weekNumber >= phase.startWeek && weekNumber <= phase.endWeek)?.phase ?? "base";
}

function continuousTargetForDistance(goalDistance: EngineV1GoalDistance, goalType: EngineV1GoalType): number {
  if (goalType === "finish_without_walking") return goalDistance === "10k" ? 60 : 30;
  if (goalDistance === "5k") return isPerformanceGoal(goalType) ? 40 : 30;
  if (goalDistance === "10k") return 60;
  if (goalDistance === "half_marathon") return 90;
  return 120;
}

function longRunPeakForDistance(goalDistance: EngineV1GoalDistance): number {
  if (goalDistance === "5k") return 45;
  if (goalDistance === "10k") return 70;
  if (goalDistance === "half_marathon") return 105;
  return 165;
}

export function buildContinuousCurve(startContinuous: number, targetContinuous: number, weeks: number): number[] {
  const totalWeeks = Math.max(4, weeks);
  const taperWeeks = new Set(buildTaperWeeks(totalWeeks));
  const stepBackWeeks = new Set(buildStepBackWeeks(totalWeeks));
  const curve: number[] = [];
  let current = Math.max(1, roundHalf(startContinuous));
  let previousPeak = current;

  for (let week = 1; week <= totalWeeks; week += 1) {
    if (week === totalWeeks) {
      curve.push(roundHalf(Math.max(startContinuous, previousPeak * 0.7)));
      continue;
    }

    if (taperWeeks.has(week)) {
      current = roundHalf(Math.max(startContinuous, previousPeak * (week === Math.min(...taperWeeks) ? 0.85 : 0.7)));
      curve.push(current);
      continue;
    }

    if (stepBackWeeks.has(week)) {
      current = roundHalf(Math.max(startContinuous, previousPeak - 2));
      curve.push(current);
      continue;
    }

    const remainingBuildWeeks = Math.max(totalWeeks - week - taperWeeks.size, 1);
    const remaining = Math.max(targetContinuous - current, 0);
    const increase = Math.min(3, Math.max(1, remaining / remainingBuildWeeks));
    current = roundHalf(Math.min(targetContinuous, current + increase));
    previousPeak = Math.max(previousPeak, current);
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
      curve.push(roundHalf(previousPeak * 0.55));
      continue;
    }

    if (tapers.has(week)) {
      const taperFactor = taperWeeks.length === 2 && week === taperWeeks[0] ? 0.7 : 0.55;
      current = roundHalf(Math.max(startLongRun * 0.9, previousPeak * taperFactor));
      curve.push(current);
      continue;
    }

    if (stepBacks.has(week)) {
      current = roundHalf(Math.max(startLongRun, previousPeak * 0.88));
      curve.push(current);
      continue;
    }

    const remainingBuildWeeks = Math.max(totalWeeks - week - taperWeeks.length, 1);
    const remaining = Math.max(peakLongRun - current, 0);
    const uncapped = Math.max(2, remaining / remainingBuildWeeks);
    const proposed = current + uncapped;
    const maxIncrease = current * 0.1;
    current = roundHalf(Math.min(peakLongRun, current + Math.min(maxIncrease, uncapped)));
    if (proposed < current) current = roundHalf(proposed);
    previousPeak = Math.max(previousPeak, current);
    curve.push(current);
  }

  return curve;
}

export function buildWeeklyVolumeCurve(longRunCurve: number[]): number[] {
  return longRunCurve.map((longRun, index) => {
    const ratio = index < 4 ? 3.2 : index < 8 ? 3 : 2.8;
    return roundHalf(longRun * ratio);
  });
}

export function buildIntervalCurve(phases: EngineV1Phase[], weeklyVolumeCurve: number[]): number[] {
  return phases.map((phase, index) => {
    const weeklyVolume = weeklyVolumeCurve[index] ?? 0;
    const ratio =
      phase === "base"
        ? 0.05
        : phase === "build"
          ? 0.1
          : phase === "specific"
            ? 0.16
            : phase === "peak"
              ? 0.14
              : phase === "taper"
                ? 0.08
                : 0;
    return roundHalf(weeklyVolume * ratio);
  });
}

export function distributeVolumeAcrossWeek(
  weeklyVolume: number,
  longRun: number,
  intervalVolume: number,
  sessionsPerWeek: number,
): Array<{ workoutType: EngineV1WorkoutType; durationMin: number }> {
  const sessions = clamp(sessionsPerWeek, 2, 5);
  const cappedLongRun = roundHalf(Math.min(longRun, weeklyVolume * 0.35));
  const cappedIntervals = roundHalf(Math.min(intervalVolume, weeklyVolume * 0.25));
  const remaining = Math.max(0, weeklyVolume - cappedLongRun - cappedIntervals);

  if (sessions === 2) {
    return [
      { workoutType: cappedIntervals > 0 ? "tempo" : "easy", durationMin: roundHalf(weeklyVolume - cappedLongRun) },
      { workoutType: "long", durationMin: cappedLongRun },
    ];
  }

  if (sessions === 3) {
    return [
      { workoutType: cappedIntervals > 0 ? "intervals" : "easy", durationMin: roundHalf(cappedIntervals > 0 ? cappedIntervals : remaining * 0.45) },
      { workoutType: "easy", durationMin: roundHalf(remaining - (cappedIntervals > 0 ? cappedIntervals : remaining * 0.45)) },
      { workoutType: "long", durationMin: cappedLongRun },
    ];
  }

  if (sessions === 4) {
    const quality = roundHalf(cappedIntervals > 0 ? cappedIntervals : remaining * 0.18);
    const recovery = roundHalf(remaining * 0.2);
    const support = roundHalf((remaining - quality - recovery) / 2);
    return [
      { workoutType: quality > 0 ? "intervals" : "easy", durationMin: quality },
      { workoutType: "easy", durationMin: support },
      { workoutType: "recovery", durationMin: recovery },
      { workoutType: "long", durationMin: cappedLongRun + Math.max(0, weeklyVolume - cappedLongRun - quality - support - recovery) },
    ];
  }

  const firstQuality = roundHalf(cappedIntervals * 0.55);
  const secondQuality = roundHalf(cappedIntervals - firstQuality);
  const recovery = roundHalf(remaining * 0.18);
  const easy = roundHalf((remaining - recovery) / 2);
  return [
    { workoutType: firstQuality > 0 ? "intervals" : "easy", durationMin: firstQuality || easy },
    { workoutType: "easy", durationMin: easy },
    { workoutType: secondQuality > 0 ? "tempo" : "easy", durationMin: secondQuality || easy },
    { workoutType: "recovery", durationMin: recovery },
    { workoutType: "long", durationMin: roundHalf(weeklyVolume - (firstQuality || easy) - easy - (secondQuality || easy) - recovery) },
  ];
}

export function generateWorkout(workoutType: EngineV1WorkoutType, duration: number): EngineV1Workout {
  const total = Math.max(12, roundHalf(duration));

  const blocksFor = (): EngineV1WorkoutBlock[] => {
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
      const main = total >= 42 ? 2 : 1;
      const block = total >= 42 ? 10 : 8;
      return [
        { type: "warmup", durationMin: 8 },
        { type: "race_pace", durationMin: block, repeats: main, restMin: main > 1 ? 3 : undefined },
        { type: "cooldown", durationMin: Math.max(5, roundHalf(total - 8 - block * main - (main > 1 ? 3 : 0))) },
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

function assignDays(workouts: EngineV1Workout[], profile: EngineV1Profile): EngineV1Workout[] {
  const availableDays = profile.availableTrainingDays && profile.availableTrainingDays.length >= workouts.length
    ? [...profile.availableTrainingDays]
    : ["tuesday", "thursday", "sunday", "monday", "wednesday"];

  const longRunDay = profile.preferredLongRunDay && availableDays.includes(profile.preferredLongRunDay)
    ? profile.preferredLongRunDay
    : availableDays[availableDays.length - 1];

  const ordered = [...workouts].sort((a, b) => {
    if (a.workoutType === "long") return 1;
    if (b.workoutType === "long") return -1;
    if (a.workoutType === "recovery" && b.workoutType !== "recovery") return 1;
    if (b.workoutType === "recovery" && a.workoutType !== "recovery") return -1;
    return 0;
  });

  const dayPool = [...availableDays];
  const longIndex = ordered.findIndex((workout) => workout.workoutType === "long");
  if (longIndex >= 0) {
    ordered[longIndex].day = longRunDay;
    dayPool.splice(dayPool.indexOf(longRunDay), 1);
  }

  for (const workout of ordered) {
    if (workout.day) continue;
    workout.day = dayPool.shift();
  }

  return ordered;
}

export function applySafetyRules(trainingPlan: EngineV1Plan): EngineV1Plan {
  const weeks = trainingPlan.weeks.map((week) => ({ ...week, workouts: week.workouts.map((workout) => ({ ...workout, blocks: workout.blocks.map((block) => ({ ...block })) })) }));

  for (let index = 0; index < weeks.length; index += 1) {
    const week = weeks[index];
    const previous = weeks[index - 1];

    if (previous) {
      const maxVolume = roundHalf(previous.weeklyVolume * 1.1);
      if (week.weeklyVolume > maxVolume && !week.progressionMetrics.isTaperWeek && !week.progressionMetrics.isRaceWeek) {
        week.weeklyVolume = maxVolume;
      }

      const maxLongRun = roundHalf(previous.longRun * 1.1);
      if (week.longRun > maxLongRun && !week.progressionMetrics.isTaperWeek && !week.progressionMetrics.isRaceWeek) {
        week.longRun = maxLongRun;
      }
    }

    const longRunShare = week.weeklyVolume > 0 ? week.longRun / week.weeklyVolume : 0;
    if (longRunShare > 0.35) {
      week.longRun = roundHalf(week.weeklyVolume * 0.35);
    }
    if (longRunShare < 0.2) {
      week.longRun = roundHalf(week.weeklyVolume * 0.2);
    }

    if (week.intervalVolume > week.weeklyVolume * 0.25) {
      week.intervalVolume = roundHalf(week.weeklyVolume * 0.25);
    }

    const qualityWorkouts = week.workouts.filter((workout) => workout.workoutType === "intervals" || workout.workoutType === "tempo" || workout.workoutType === "race_pace");
    if (qualityWorkouts.length > 2) {
      for (const workout of qualityWorkouts.slice(2)) {
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

  return {
    ...trainingPlan,
    weeks,
  };
}

export function buildTrainingPlan(profile: EngineV1Profile): EngineV1Plan {
  const phases = buildPhases(profile.timelineWeeks);
  const stepBackWeeks = buildStepBackWeeks(profile.timelineWeeks);
  const taperWeeks = buildTaperWeeks(profile.timelineWeeks);
  const backboneType = chooseBackboneType(profile);
  const phaseTimeline = Array.from({ length: profile.timelineWeeks }, (_, index) => phaseForWeek(index + 1, phases));

  const targetContinuous = continuousTargetForDistance(profile.goalDistance, profile.goalType);
  const continuousCurve = buildContinuousCurve(profile.currentContinuousMin, targetContinuous, profile.timelineWeeks);

  const startLongRun = roundHalf(
    clamp(
      Math.max(profile.longestRecentRunMin * 0.9, profile.currentContinuousMin * 1.2),
      profile.goalDistance === "5k" ? 15 : 20,
      profile.longestRecentRunMin * 1.1,
    ),
  );
  const peakLongRun = longRunPeakForDistance(profile.goalDistance);
  const longRunCurve = buildLongRunCurve(startLongRun, peakLongRun, profile.timelineWeeks, stepBackWeeks, taperWeeks);
  const weeklyVolumeCurve = buildWeeklyVolumeCurve(longRunCurve);
  const rawIntervalCurve = buildIntervalCurve(phaseTimeline, weeklyVolumeCurve);
  const intervalVolumeCurve = rawIntervalCurve.map((value) => {
    if (profile.goalType === "finish" || profile.goalType === "finish_without_walking" || profile.goalType === "return_to_running") {
      return roundHalf(value * 0.5);
    }
    if (profile.goalType === "target_time") {
      return roundHalf(value * 1.1);
    }
    return value;
  });

  const weeks: EngineV1Week[] = Array.from({ length: profile.timelineWeeks }, (_, index) => {
    const weekNumber = index + 1;
    const phase = phaseTimeline[index];
    const sessionsPerWeek = phase === "race_week" ? Math.min(profile.sessionsPerWeek, 3) : profile.sessionsPerWeek;
    const weeklyVolume = weeklyVolumeCurve[index];
    const longRun = longRunCurve[index];
    const intervalVolume = intervalVolumeCurve[index];

    let distribution = distributeVolumeAcrossWeek(weeklyVolume, longRun, intervalVolume, sessionsPerWeek);
    if (phase === "base" && !isPerformanceGoal(profile.goalType)) {
      distribution = distribution.map((item, itemIndex) =>
        item.workoutType === "intervals" || item.workoutType === "tempo"
          ? { workoutType: itemIndex === 0 && isBeginnerStyleGoal(profile.goalType) ? "run_walk" : "easy", durationMin: item.durationMin }
          : item,
      );
    }
    if (phase === "race_week") {
      distribution = distribution.slice(0, Math.min(distribution.length, 3)).map((item, itemIndex) => {
        if (itemIndex === distribution.length - 1) return { workoutType: "race_pace", durationMin: Math.max(16, item.durationMin * 0.7) };
        return { workoutType: itemIndex === 0 ? "easy" : "recovery", durationMin: Math.max(16, item.durationMin * 0.6) };
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
