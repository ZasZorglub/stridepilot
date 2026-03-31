import { generateEngineV2Plan } from "../engine";
import type { BuiltWeek, EnginePlan, Phase, WorkoutFamily } from "../models";
import type {
  BenchmarkBand,
  BenchmarkDimensionResult,
  BenchmarkFailureScan,
  BenchmarkRunnerResult,
  BenchmarkSuiteResult,
  RangeBand,
  ReferenceRunnerBenchmark,
} from "./benchmarkModels";

function statusFromCounts(pass: number, borderline: number, fail: number): BenchmarkBand {
  if (fail > 0) return "out_of_band";
  if (borderline > 0 || pass === 0) return "borderline";
  return "within_band";
}

function noteResult(status: BenchmarkBand, notes: string[]): BenchmarkDimensionResult {
  return { status, notes };
}

function inRange(value: number, band: RangeBand): BenchmarkBand {
  if (value >= band.min && value <= band.max) return "within_band";
  if (
    (band.borderlineMin === undefined || value >= band.borderlineMin) &&
    (band.borderlineMax === undefined || value <= band.borderlineMax)
  ) {
    return "borderline";
  }
  return "out_of_band";
}

function phaseSequence(plan: EnginePlan): Phase[] {
  return plan.phasePlan.blocks.reduce<Phase[]>((sequence, block) => {
    if (sequence.at(-1) !== block.phase) sequence.push(block.phase);
    return sequence;
  }, []);
}

function qualityFamilies(week: BuiltWeek): WorkoutFamily[] {
  return week.sessions.filter((session) => session.role === "quality").map((session) => session.family);
}

function roleSignature(week: BuiltWeek): string {
  return week.sessions.map((session) => session.role).join(">");
}

function firstWeekMatching(plan: EnginePlan, predicate: (week: BuiltWeek) => boolean): BuiltWeek | undefined {
  return plan.weeks.find(predicate);
}

function weeksOfPhase(plan: EnginePlan, phase: Phase): BuiltWeek[] {
  return plan.weeks.filter((week) => week.phase === phase);
}

function adjustedTaperBand(reference: ReferenceRunnerBenchmark, plan: EnginePlan): RangeBand {
  const base = reference.acceptance.taperReductionBand;
  const distance = plan.resolvedInput.raceDistance;
  const goalType = plan.resolvedInput.goalType;
  const finishLike = goalType === "finish" || goalType === "finish_without_walking" || goalType === "build_consistency" || goalType === "return_to_running";
  const targetLike = goalType === "target_time";
  const improveLike = goalType === "improve_time";

  if (distance === "Marathon") {
    return {
      min: Math.min(base.min, 0.22),
      max: finishLike ? 0.62 : targetLike || improveLike ? 0.66 : 0.64,
      borderlineMin: Math.min(base.borderlineMin ?? base.min, 0.18),
      borderlineMax: finishLike ? 0.68 : 0.72,
    };
  }

  if (distance === "HalfMarathon") {
    return {
      min: Math.min(base.min, 0.18),
      max: finishLike ? 0.5 : 0.56,
      borderlineMin: Math.min(base.borderlineMin ?? base.min, 0.14),
      borderlineMax: finishLike ? 0.56 : 0.6,
    };
  }

  if (distance === "10K") {
    return {
      min: Math.min(base.min, 0.16),
      max: finishLike ? 0.44 : 0.5,
      borderlineMin: Math.min(base.borderlineMin ?? base.min, 0.12),
      borderlineMax: finishLike ? 0.5 : 0.56,
    };
  }

  return {
    min: Math.min(base.min, 0.14),
    max: finishLike ? 0.4 : 0.46,
    borderlineMin: Math.min(base.borderlineMin ?? base.min, 0.1),
    borderlineMax: finishLike ? 0.46 : 0.52,
  };
}

function raceWeekOf(plan: EnginePlan): BuiltWeek | undefined {
  return plan.weeks.find((week) => week.isRaceWeek) ?? plan.weeks.at(-1);
}

function taperWeeksExcludingRace(plan: EnginePlan): BuiltWeek[] {
  return plan.weeks.filter((week) => week.phase === "taper" && !week.isRaceWeek);
}

function nonRaceSessions(week: BuiltWeek): BuiltWeek["sessions"] {
  return week.sessions.filter((session) => !session.isRaceEvent);
}

function endgameComplexity(week: BuiltWeek): number {
  return nonRaceSessions(week).reduce((score, session) => {
    if (session.family === "intervals" || session.family === "hill_reps") return score + 3;
    if (session.family === "tempo_run" || session.family === "race_specific" || session.family === "progression_run") return score + 2;
    if (session.family === "strides_session" || session.family === "steady_run") return score + 1;
    return score;
  }, 0);
}

function nearestBuildOrPeakWeek(plan: EnginePlan, raceWeek: BuiltWeek): BuiltWeek | undefined {
  return [...plan.weeks]
    .reverse()
    .find((week) => week.weekIndex < raceWeek.weekIndex && (week.phase === "peak" || week.phase === "specific" || week.phase === "build"));
}

function evaluateClassification(reference: ReferenceRunnerBenchmark, plan: EnginePlan): BenchmarkDimensionResult {
  const notes: string[] = [];
  const primaryStatus = reference.acceptance.acceptablePrimaryTypes.includes(plan.classification.traits.primaryRunnerType) ? "within_band" : "out_of_band";
  const levelStatus = reference.acceptance.acceptableRunnerLevels.includes(plan.classification.traits.runnerLevel) ? "within_band" : "out_of_band";
  if (primaryStatus !== "within_band") {
    notes.push(`Primary type ${plan.classification.traits.primaryRunnerType} is outside accepted types ${reference.acceptance.acceptablePrimaryTypes.join(", ")}.`);
  }
  if (levelStatus !== "within_band") {
    notes.push(`Runner level ${plan.classification.traits.runnerLevel} is outside accepted levels ${reference.acceptance.acceptableRunnerLevels.join(", ")}.`);
  }
  for (const modifier of reference.acceptance.recommendedModifiers ?? []) {
    if (!plan.classification.traits.modifiers.includes(modifier)) {
      notes.push(`Recommended modifier ${modifier} is missing.`);
    }
  }
  const status = primaryStatus === "within_band" && levelStatus === "within_band" ? (notes.length > 0 ? "borderline" : "within_band") : "out_of_band";
  return noteResult(status, notes);
}

function evaluatePhase(reference: ReferenceRunnerBenchmark, plan: EnginePlan): BenchmarkDimensionResult {
  const actual = phaseSequence(plan);
  const expected = reference.acceptance.expectedPhaseSequence;
  const notes: string[] = [];
  const missingRequired = expected.filter(
    (phase) => !actual.includes(phase) && !(reference.acceptance.allowedPhaseOmissions ?? []).includes(phase),
  );
  if (missingRequired.length > 0) {
    notes.push(`Missing required phases: ${missingRequired.join(", ")}.`);
  }
  const wrongOrder = expected.some((phase, index) => {
    const actualIndex = actual.indexOf(phase);
    if (actualIndex === -1) return false;
    const previousExpected = expected.slice(0, index).filter((candidate) => actual.includes(candidate));
    return previousExpected.some((candidate) => actual.indexOf(candidate) > actualIndex);
  });
  if (wrongOrder) {
    notes.push(`Phase ordering does not follow expected sequence ${expected.join(" -> ")}.`);
  }
  if (!reference.acceptance.expectedPlanTypes.includes(plan.planTypeDecision.planType)) {
    notes.push(`Plan type ${plan.planTypeDecision.planType} falls outside accepted plan types ${reference.acceptance.expectedPlanTypes.join(", ")}.`);
  }
  return noteResult(notes.length === 0 ? "within_band" : missingRequired.length > 0 || wrongOrder ? "out_of_band" : "borderline", notes);
}

function evaluateLongRun(reference: ReferenceRunnerBenchmark, plan: EnginePlan): BenchmarkDimensionResult {
  const notes: string[] = [];
  const start = plan.curves.longRunCurve[0] ?? 0;
  const peak = Math.max(...plan.curves.longRunCurve);
  const taperWeeks = taperWeeksExcludingRace(plan);
  const raceWeek = raceWeekOf(plan);
  const finalLongRun =
    taperWeeks.at(-1)?.longRunTargetMin ??
    plan.weeks.filter((week) => !week.isRaceWeek).at(-1)?.longRunTargetMin ??
    (raceWeek?.isRaceWeek ? peak : raceWeek?.longRunTargetMin) ??
    peak;
  const taperReduction = peak > 0 ? 1 - finalLongRun / peak : 0;
  const taperBand = adjustedTaperBand(reference, plan);

  const startStatus = inRange(start, reference.acceptance.longRunStartBand);
  const peakStatus = inRange(peak, reference.acceptance.longRunPeakBand);
  const taperStatus = inRange(taperReduction, taperBand);

  if (startStatus !== "within_band") notes.push(`Long-run start ${start} min is ${startStatus} vs expected ${reference.acceptance.longRunStartBand.min}-${reference.acceptance.longRunStartBand.max}.`);
  if (peakStatus !== "within_band") notes.push(`Long-run peak ${peak} min is ${peakStatus} vs expected ${reference.acceptance.longRunPeakBand.min}-${reference.acceptance.longRunPeakBand.max}.`);
  if (taperStatus !== "within_band") notes.push(`Pre-race taper reduction ${(taperReduction * 100).toFixed(0)}% is ${taperStatus}.`);

  const status = statusFromCounts(
    [startStatus, peakStatus, taperStatus].filter((status) => status === "within_band").length,
    [startStatus, peakStatus, taperStatus].filter((status) => status === "borderline").length,
    [startStatus, peakStatus, taperStatus].filter((status) => status === "out_of_band").length,
  );
  return noteResult(status, notes);
}

function evaluateWeeklyStructure(reference: ReferenceRunnerBenchmark, plan: EnginePlan): BenchmarkDimensionResult {
  const notes: string[] = [];
  const weeklyExpectation = reference.acceptance.weeklyStructure;
  const phaseExpectations = weeklyExpectation.phaseExpectations;
  const sampleWeeks = phaseExpectations && phaseExpectations.length > 0
    ? phaseExpectations
        .map((expectation) => ({
          expectation,
          week: firstWeekMatching(plan, (week) => week.phase === expectation.phase),
        }))
        .filter((entry): entry is { expectation: NonNullable<typeof phaseExpectations>[number]; week: BuiltWeek } => Boolean(entry.week))
    : [plan.weeks[0], firstWeekMatching(plan, (week) => week.phase === "build"), firstWeekMatching(plan, (week) => week.phase === "specific" || week.phase === "peak")]
        .filter((week): week is BuiltWeek => Boolean(week))
        .map((week) => ({ expectation: undefined, week }));
  let borderline = 0;
  let fail = 0;
  let pass = 0;

  for (const { week, expectation } of sampleWeeks) {
    const roles = week.sessions.map((session) => session.role);
    const requiredRoles = expectation
      ? (expectation.requiredRoles ?? [])
      : weeklyExpectation.typicalRoles;
    const missingRoles = requiredRoles.filter((role) => !roles.includes(role));
    if (missingRoles.length > 0 && !weeklyExpectation.allowProtectedLowComplexity) {
      fail += 1;
      notes.push(`U${week.weekIndex} is missing expected roles: ${missingRoles.join(", ")}.`);
    }
    const requiredRoleGroups = expectation?.requiredRoleGroups ?? [];
    for (const group of requiredRoleGroups) {
      if (!group.some((role) => roles.includes(role))) {
        fail += 1;
        notes.push(`U${week.weekIndex} is missing one of the expected role group: ${group.join(" / ")}.`);
      }
    }
    const qualityCount = week.sessions.filter((session) => session.role === "quality").length;
    const maxQuality = expectation?.maxQualitySessionsPerWeek ?? weeklyExpectation.maxQualitySessionsPerWeek ?? 1;
    const minQuality = expectation?.minQualitySessionsPerWeek ?? 0;
    if (qualityCount > maxQuality) {
      fail += 1;
      notes.push(`U${week.weekIndex} has ${qualityCount} quality roles, above expected maximum.`);
    }
    if (qualityCount < minQuality) {
      fail += 1;
      notes.push(`U${week.weekIndex} has ${qualityCount} quality roles, below expected minimum.`);
    }
    for (const session of week.sessions) {
      if ((expectation?.forbiddenFamilies ?? weeklyExpectation.forbiddenFamilies ?? []).includes(session.family)) {
        fail += 1;
        notes.push(`U${week.weekIndex} uses forbidden family ${session.family}.`);
      }
    }
    if (weeklyExpectation.allowRunWalk === false && week.sessions.some((session) => session.family === "run_walk_progression")) {
      fail += 1;
      notes.push(`U${week.weekIndex} still uses run/walk where the benchmark expects continuous running structure.`);
    }
    const qualityWeekFamilies = qualityFamilies(week);
    if (
      qualityWeekFamilies.length > 0 &&
      (expectation?.preferredQualityFamilies ?? weeklyExpectation.preferredQualityFamilies) &&
      !qualityWeekFamilies.some((family) => (expectation?.preferredQualityFamilies ?? weeklyExpectation.preferredQualityFamilies)?.includes(family))
    ) {
      borderline += 1;
      notes.push(`U${week.weekIndex} quality family ${qualityWeekFamilies.join(", ")} does not match preferred set.`);
    } else {
      pass += 1;
    }
  }

  if (weeklyExpectation.requirePhaseVariation) {
    const distinctRoleSignatures = new Set(sampleWeeks.map((entry) => roleSignature(entry.week)));
    const configuredMinimum = weeklyExpectation.minDistinctPhaseSkeletons ?? 2;
    const minimumDistinct = weeklyExpectation.planFamily === "finish"
      ? Math.max(1, configuredMinimum - 1)
      : configuredMinimum;
    if (distinctRoleSignatures.size < minimumDistinct) {
      borderline += 1;
      notes.push(`Weekly structure only shows ${distinctRoleSignatures.size} distinct phase skeletons, below expected ${minimumDistinct}.`);
    }
  }

  return noteResult(statusFromCounts(pass, borderline, fail), notes);
}

function evaluateIntensity(reference: ReferenceRunnerBenchmark, plan: EnginePlan): BenchmarkDimensionResult {
  const notes: string[] = [];
  const firstThree = plan.weeks.slice(0, Math.min(3, plan.weeks.length));
  const earlyMax = Math.max(...firstThree.map((week) => week.intensityTarget));
  const earlyStatus = earlyMax <= reference.acceptance.earlyIntensityMax ? "within_band" : earlyMax <= reference.acceptance.earlyIntensityMax + 0.05 ? "borderline" : "out_of_band";
  if (earlyStatus !== "within_band") {
    notes.push(`Early intensity ${earlyMax.toFixed(2)} exceeds expected max ${reference.acceptance.earlyIntensityMax.toFixed(2)}.`);
  }

  let peakStatus: BenchmarkBand = "within_band";
  if (reference.acceptance.peakIntensityMin !== undefined) {
    const peak = Math.max(...plan.weeks.map((week) => week.intensityTarget));
    peakStatus = peak >= reference.acceptance.peakIntensityMin ? "within_band" : peak >= reference.acceptance.peakIntensityMin - 0.04 ? "borderline" : "out_of_band";
    if (peakStatus !== "within_band") {
      notes.push(`Peak intensity ${peak.toFixed(2)} does not reach expected minimum ${reference.acceptance.peakIntensityMin.toFixed(2)}.`);
    }
  }

  const disallowed = plan.weeks.flatMap((week) => qualityFamilies(week)).filter((family) => !reference.acceptance.allowedQualityFamilies.includes(family));
  if (disallowed.length > 0) {
    notes.push(`Plan uses disallowed quality families: ${[...new Set(disallowed)].join(", ")}.`);
  }
  const familyStatus: BenchmarkBand = disallowed.length === 0 ? "within_band" : disallowed.length <= 2 ? "borderline" : "out_of_band";
  return noteResult(
    statusFromCounts(
      [earlyStatus, peakStatus, familyStatus].filter((status) => status === "within_band").length,
      [earlyStatus, peakStatus, familyStatus].filter((status) => status === "borderline").length,
      [earlyStatus, peakStatus, familyStatus].filter((status) => status === "out_of_band").length,
    ),
    notes,
  );
}

function milestoneWeekForContinuous(plan: EnginePlan, targetMin: number): number | undefined {
  return plan.curves.continuousCurve.findIndex((value) => value >= targetMin) + 1 || undefined;
}

function milestoneWeekForLongRun(plan: EnginePlan, targetMin: number): number | undefined {
  return plan.curves.longRunCurve.findIndex((value) => value >= targetMin) + 1 || undefined;
}

function milestoneWeekForPhase(plan: EnginePlan, targetPhase: Phase): number | undefined {
  return firstWeekMatching(plan, (week) => week.phase === targetPhase)?.weekIndex;
}

function evaluateMilestones(reference: ReferenceRunnerBenchmark, plan: EnginePlan): BenchmarkDimensionResult {
  const notes: string[] = [];
  let borderline = 0;
  let fail = 0;
  let pass = 0;

  for (const milestone of reference.acceptance.milestoneWindows) {
    let observed: number | undefined;
    if (milestone.label.includes("continuous") && milestone.targetMin) observed = milestoneWeekForContinuous(plan, milestone.targetMin);
    else if (milestone.label.includes("long_run") && milestone.targetMin) observed = milestoneWeekForLongRun(plan, milestone.targetMin);
    else if (milestone.targetPhase) observed = milestoneWeekForPhase(plan, milestone.targetPhase);

    if (observed === undefined) {
      fail += 1;
      notes.push(`Milestone ${milestone.label} was not reached.`);
      continue;
    }
    if (observed >= milestone.weekMin && observed <= milestone.weekMax) {
      pass += 1;
      continue;
    }
    if (observed === milestone.weekMin - 1 || observed === milestone.weekMax + 1) {
      borderline += 1;
      notes.push(`Milestone ${milestone.label} landed at week ${observed}, just outside target window ${milestone.weekMin}-${milestone.weekMax}.`);
      continue;
    }
    fail += 1;
    notes.push(`Milestone ${milestone.label} landed at week ${observed}, outside target window ${milestone.weekMin}-${milestone.weekMax}.`);
  }

  return noteResult(statusFromCounts(pass, borderline, fail), notes);
}

function evaluateRaceWeek(reference: ReferenceRunnerBenchmark, plan: EnginePlan): BenchmarkDimensionResult {
  const notes: string[] = [];
  const raceWeek = raceWeekOf(plan);
  if (!raceWeek) return noteResult("out_of_band", ["Plan has no final week."]);
  if (reference.acceptance.raceWeek.requireTaper && raceWeek.phase !== "taper") {
    notes.push(`Final week phase is ${raceWeek.phase}, not taper.`);
  }
  const raceEvent = raceWeek.sessions.find((session) => session.isRaceEvent);
  const peakLongRun = Math.max(...plan.curves.longRunCurve);
  const finalLongRunFraction = peakLongRun > 0 ? raceWeek.longRunTargetMin / peakLongRun : 1;
  if (!raceEvent && finalLongRunFraction > reference.acceptance.raceWeek.maxLongRunFractionOfPeak) {
    notes.push(`Final-week long run is ${(finalLongRunFraction * 100).toFixed(0)}% of peak, above allowed ${Math.round(reference.acceptance.raceWeek.maxLongRunFractionOfPeak * 100)}%.`);
  }
  if (raceEvent && raceWeek.longRunTargetMin === 0) {
    notes.push("Race week uses explicit race-event modeling with no normal long run.");
  }
  const raceWeekFamilies = nonRaceSessions(raceWeek).map((session) => session.family);
  const invalidFamilies = raceWeekFamilies.filter((family) => !reference.acceptance.raceWeek.acceptableFamilies.includes(family));
  if (invalidFamilies.length > 0) {
    notes.push(`Race week uses unaccepted families: ${[...new Set(invalidFamilies)].join(", ")}.`);
  }
  const goalType = plan.resolvedInput.goalType;
  const finishLike = goalType === "finish" || goalType === "finish_without_walking" || goalType === "build_consistency" || goalType === "return_to_running";
  const targetLike = goalType === "target_time";
  const improveLike = goalType === "improve_time";
  const sharpeningSessions = nonRaceSessions(raceWeek).filter((session) => session.family === "race_specific" || session.family === "tempo_run" || session.family === "intervals" || session.family === "strides_session");
  if (sharpeningSessions.length > 1) {
    notes.push(`Race week keeps ${sharpeningSessions.length} sharpening sessions, above the new endgame limit.`);
  }
  if (finishLike && nonRaceSessions(raceWeek).some((session) => session.family === "tempo_run" || session.family === "intervals" || session.family === "race_specific")) {
    notes.push("Finish race week still contains non-race performance work.");
  }
  if (reference.acceptance.raceWeek.requireGoalSpecificSignal) {
    const hasGoalSignal =
      Boolean(raceEvent) ||
      raceWeek.sessions.some((session) => session.family === "race_specific" || session.family === "strides_session" || session.role === "quality") ||
      finishLike;
    if (!hasGoalSignal) {
      notes.push("Race week lacks any goal-specific signal.");
    }
  }
  const comparisonWeek = nearestBuildOrPeakWeek(plan, raceWeek);
  if (comparisonWeek && endgameComplexity(raceWeek) >= endgameComplexity(comparisonWeek)) {
    notes.push("Race week is not simpler than the nearby build/peak structure.");
  }
  if (plan.resolvedInput.raceDistance === "Marathon" && comparisonWeek && raceWeek.volumeTargetMin >= comparisonWeek.volumeTargetMin * 0.6) {
    notes.push("Marathon race week is not materially lighter than the nearby peak/build week.");
  }

  const informationalMessage = "Race week uses explicit race-event modeling with no normal long run.";
  const informationalNotes = notes.filter((note) => note === informationalMessage);
  const scoringNotes = notes.filter((note) => note !== informationalMessage);
  const status = scoringNotes.length === 0 ? "within_band" : scoringNotes.length === 1 ? "borderline" : "out_of_band";
  return noteResult(status, notes);
}

function scanFailureModes(reference: ReferenceRunnerBenchmark, plan: EnginePlan): BenchmarkFailureScan {
  const warnings: string[] = [];
  const failures: string[] = [];
  const sessionIssues = plan.weeks.flatMap((week) => week.validationIssues ?? []).map((issue) => issue.message);
  const engineIssues = new Set(sessionIssues);

  for (const failureMode of reference.acceptance.failureModes) {
    if (failureMode === "beginner_stuck_in_tiny_run_walk") {
      const lateRunWalk = plan.weeks.filter((week) => week.weekIndex >= Math.ceil(plan.weeks.length / 2)).some((week) => week.sessions.filter((session) => session.family === "run_walk_progression").length >= 2);
      if (lateRunWalk) failures.push("Beginner runner stays too locked in run/walk late in the plan.");
    } else if (failureMode === "finish_plan_too_complex" || failureMode === "finish_plan_too_performance_heavy") {
      const heavyFinishWeeks = plan.weeks.filter((week) => week.sessions.filter((session) => session.family === "tempo_run" || session.family === "intervals" || session.family === "race_specific").length >= 2);
      if (heavyFinishWeeks.length > 0) failures.push("Finish plan accumulates too much performance-like complexity.");
    } else if (failureMode === "marathon_too_generic") {
      if (engineIssues.has("One or more weeks make all sessions feel too similar.")) failures.push("Marathon plan still looks too generic.");
    } else if (failureMode === "support_days_blur") {
      if ([...engineIssues].some((issue) => issue.includes("Support sessions blur together"))) warnings.push("Support days still blur together too much.");
    } else if (failureMode === "long_run_underbuilt") {
      const peak = Math.max(...plan.curves.longRunCurve);
      if (peak < reference.acceptance.longRunPeakBand.min) failures.push(`Long-run peak ${peak} min is under the expected benchmark floor.`);
    } else if (failureMode === "no_real_taper" || failureMode === "no_taper") {
      if (!plan.weeks.some((week) => week.phase === "taper")) failures.push("Plan has no taper phase.");
    } else if (failureMode === "race_week_not_goal_representative") {
      const raceWeek = raceWeekOf(plan);
      const nonRace = raceWeek ? nonRaceSessions(raceWeek) : [];
      const hasRaceEvent = raceWeek?.sessions.some((session) => session.isRaceEvent);
      if (raceWeek && !hasRaceEvent && nonRace.every((session) => session.family === "easy_run" || session.family === "recovery_run")) {
        failures.push("Race week does not visibly represent the goal effort.");
      }
    } else if (failureMode === "non_beginner_plan_opens_with_run_walk") {
      if (plan.weeks[0]?.sessions.some((session) => session.family === "run_walk_progression")) failures.push("Non-beginner plan still opens with run/walk.");
    } else if (failureMode === "too_generic") {
      if (engineIssues.has("One or more weeks make all sessions feel too similar.")) warnings.push("Plan still reads as too generic in some weeks.");
    } else if (failureMode === "no_specific_phase" || failureMode === "no_hm_specific_identity") {
      if (!plan.weeks.some((week) => week.phase === "specific" || week.phase === "peak")) failures.push("Plan lacks meaningful specific/peak identity.");
    } else if (failureMode === "race_week_lacks_10k_specificity") {
      const raceWeek = raceWeekOf(plan);
      const hasRaceEvent = raceWeek?.sessions.some((session) => session.isRaceEvent);
      if (raceWeek && !hasRaceEvent && !raceWeek.sessions.some((session) => session.role === "quality" || session.family === "race_specific" || session.family === "tempo_run" || session.family === "strides_session")) {
        warnings.push("Race week lacks a clear 10K-specific session signal.");
      }
    } else if (failureMode === "5k_style_quality_dominates") {
      const sharpWeeks = plan.weeks.filter((week) => week.sessions.some((session) => session.family === "intervals" || session.family === "hill_reps"));
      if (sharpWeeks.length > 1) warnings.push("Marathon improve uses too much sharp short-rep quality.");
    }
  }

  return {
    status: failures.length > 0 ? "fail" : warnings.length > 0 ? "warnings" : "pass",
    warnings,
    failures,
  };
}

function scoreStatus(status: BenchmarkBand): number {
  return status === "within_band" ? 2 : status === "borderline" ? 1 : 0;
}

export function evaluateBenchmarkPlan(reference: ReferenceRunnerBenchmark, plan: EnginePlan): BenchmarkRunnerResult {
  const classificationFit = evaluateClassification(reference, plan);
  const phaseFit = evaluatePhase(reference, plan);
  const longRunFit = evaluateLongRun(reference, plan);
  const weeklyStructureFit = evaluateWeeklyStructure(reference, plan);
  const intensityFit = evaluateIntensity(reference, plan);
  const milestoneFit = evaluateMilestones(reference, plan);
  const raceWeekFit = evaluateRaceWeek(reference, plan);
  const failureScan = scanFailureModes(reference, plan);

  const dimensions = [classificationFit, phaseFit, longRunFit, weeklyStructureFit, intensityFit, milestoneFit, raceWeekFit];
  const summaryScore = dimensions.reduce((sum, dimension) => sum + scoreStatus(dimension.status), 0);
  const majorNotes = [
    ...classificationFit.notes,
    ...phaseFit.notes,
    ...longRunFit.notes,
    ...weeklyStructureFit.notes,
    ...intensityFit.notes,
    ...milestoneFit.notes,
    ...raceWeekFit.notes,
    ...failureScan.failures,
    ...failureScan.warnings,
  ].slice(0, 8);

  return {
    runnerId: reference.id,
    runnerName: reference.name,
    classificationSummary: `${plan.classification.traits.primaryRunnerType} | level ${plan.classification.traits.runnerLevel} | modifiers ${plan.classification.traits.modifiers.join(", ") || "none"}`,
    phaseSummary: phaseSequence(plan).join(" -> "),
    classificationFit,
    phaseFit,
    longRunFit,
    weeklyStructureFit,
    intensityFit,
    milestoneFit,
    raceWeekFit,
    failureScan,
    summaryScore,
    majorNotes,
  };
}

export function evaluateBenchmarkRunner(reference: ReferenceRunnerBenchmark): BenchmarkRunnerResult {
  const plan = generateEngineV2Plan(reference.input);
  return evaluateBenchmarkPlan(reference, plan);
}

export function evaluateBenchmarkSuite(references: ReferenceRunnerBenchmark[]): BenchmarkSuiteResult {
  const results = references.map((reference) => evaluateBenchmarkRunner(reference));
  const overallScore = results.reduce((sum, result) => sum + result.summaryScore, 0);
  const failingRunners = results.filter((result) => result.failureScan.status === "fail" || [result.classificationFit, result.phaseFit, result.longRunFit, result.weeklyStructureFit, result.intensityFit, result.milestoneFit, result.raceWeekFit].some((dimension) => dimension.status === "out_of_band")).map((result) => result.runnerName);
  return { results, overallScore, failingRunners };
}
