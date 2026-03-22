import type {
  ConfidenceProfile,
  ConsistencyProfile,
  PrimaryRunnerType,
  RunnerClassification,
  RunnerInput,
  RunnerLevel,
  RunnerModifier,
  RunnerTraits,
  ScheduleConstraintLevel,
} from "./models";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function hasReturnFlag(input: RunnerInput): boolean {
  return (
    input.goalType === "return_to_running" ||
    (input.freeTextFlags ?? []).some((flag) => /return|comeback|break|restart|back/i.test(flag))
  );
}

function capabilityScore(input: RunnerInput): number {
  const continuous = clamp(input.currentContinuousRunMin / 60, 0, 1);
  const longest = clamp(input.longestRecentRunMin / 120, 0, 1);
  const frequency = clamp(input.currentWeeklyRuns / 5, 0, 1);
  const volume = clamp(input.currentWeeklyVolumeKm / 55, 0, 1);
  const base = average([continuous, longest, frequency, volume]);
  return clamp(base, 0, 1);
}

function consistencyScore(input: RunnerInput): number {
  const explicitConsistency = clamp(input.recentConsistency, 0, 1);
  const frequencyStability = clamp(input.currentWeeklyRuns / 4, 0, 1);
  return clamp(explicitConsistency * 0.7 + frequencyStability * 0.3, 0, 1);
}

function consistencyProfile(score: number): ConsistencyProfile {
  if (score < 0.3) return "sporadic";
  if (score < 0.55) return "developing";
  if (score < 0.8) return "stable";
  return "high";
}

function confidenceProfile(input: RunnerInput, consistency: number, injuryRiskScore: number): ConfidenceProfile {
  const confidenceValue = clamp((input.confidence ?? 3) / 5, 0, 1);
  if (input.currentContinuousRunMin < 5 || consistency < 0.3) return "fragile";
  if (confidenceValue < 0.45 || injuryRiskScore > 0.55) return "cautious";
  if (confidenceValue > 0.75 && consistency > 0.7) return "confident";
  return "stable";
}

function scheduleConstraintLevel(input: RunnerInput): ScheduleConstraintLevel {
  const availability = input.availableTrainingDays.length;
  if (availability <= 2 || input.typicalAvailableTimeMin <= 35) return "high";
  if (availability === 3 || input.typicalAvailableTimeMin <= 50) return "moderate";
  return "low";
}

function injuryRiskScore(input: RunnerInput, consistency: number): number {
  const injury =
    input.injuryConcern === "high" ? 0.8 : input.injuryConcern === "moderate" ? 0.58 : input.injuryConcern === "low" ? 0.3 : 0.1;
  const externalLoad =
    input.externalTrainingLoad === "high" ? 0.65 : input.externalTrainingLoad === "moderate" ? 0.4 : input.externalTrainingLoad === "light" ? 0.2 : 0;
  const agePenalty = input.age && input.age >= 55 ? 0.18 : input.age && input.age >= 45 ? 0.08 : 0;
  const inconsistencyPenalty = consistency < 0.3 ? 0.18 : consistency < 0.5 ? 0.1 : 0;
  const hardFeedbackPenalty = (input.recentFeedbackTendencies ?? []).includes("needs_caution") || (input.recentFeedbackTendencies ?? []).includes("struggles_to_finish") ? 0.12 : 0;
  return clamp(injury * 0.55 + externalLoad * 0.18 + agePenalty + inconsistencyPenalty + hardFeedbackPenalty, 0, 1);
}

function deriveRunnerLevel(input: RunnerInput, capability: number, consistency: number): RunnerLevel {
  if (
    input.currentContinuousRunMin < 1 &&
    input.currentWeeklyRuns === 0 &&
    input.currentWeeklyVolumeKm === 0 &&
    input.longestRecentRunMin === 0
  ) {
    return "true_beginner";
  }
  if (capability < 0.22 || input.currentContinuousRunMin < 12 || input.longestRecentRunMin < 20 || input.currentWeeklyRuns <= 1) {
    return "beginner_plus";
  }
  if (capability < 0.5 || input.currentWeeklyRuns < 4 || consistency < 0.72) {
    return "recreational";
  }
  if (capability < 0.8 || input.currentWeeklyVolumeKm < 50) {
    return "intermediate";
  }
  return "advanced";
}

function primaryRunnerType(input: RunnerInput, runnerLevel: RunnerLevel, capability: number, consistency: number, injury: number, schedule: ScheduleConstraintLevel): PrimaryRunnerType {
  const returnFlag = hasReturnFlag(input);
  const performanceBias =
    input.trainingStylePreference === "performance" &&
    (input.goalType === "improve_time" || input.goalType === "target_time") &&
    capability >= 0.58 &&
    consistency >= 0.62;
  const consistencyGoal = input.goalType === "build_consistency" || (input.goalType === "finish" && input.trainingStylePreference === "conservative" && consistency < 0.5);

  if (returnFlag && input.experienceLevel !== "none" && runnerLevel !== "advanced") return "return_to_running";
  if (runnerLevel === "true_beginner") return "true_beginner";
  if (runnerLevel === "beginner_plus") return "beginner_plus";
  if (injury >= 0.6) return "injury_sensitive";
  if (schedule === "high") return "low_availability_runner";
  if (consistencyGoal) return "consistency_builder";
  if (performanceBias && runnerLevel === "advanced") return "advanced_recreational";
  if (performanceBias) return "performance_oriented";
  if (runnerLevel === "advanced") return "advanced_recreational";
  if (runnerLevel === "intermediate") return "intermediate";
  return "recreational";
}

function modifiers(
  input: RunnerInput,
  consistency: number,
  injury: number,
  schedule: ScheduleConstraintLevel,
  confidence: ConfidenceProfile,
  primaryType: PrimaryRunnerType,
): RunnerModifier[] {
  const result = new Set<RunnerModifier>();
  if (injury >= 0.45) result.add("injury_sensitive");
  if (confidence === "fragile" || confidence === "cautious") result.add("low_confidence");
  if (consistency >= 0.78) result.add("high_consistency");
  if (schedule === "high") result.add("low_availability");
  if (input.externalTrainingLoad === "high" || input.externalTrainingLoad === "moderate") result.add("high_external_load");
  if (input.trainingStylePreference === "performance") result.add("performance_bias");
  if (input.trainingStylePreference === "conservative") result.add("conservative_bias");
  if (hasReturnFlag(input)) result.add("return_from_break");
  if (input.goalType === "build_consistency" || primaryType === "consistency_builder") result.add("consistency_first");
  return [...result];
}

function deriveTraitScores(
  input: RunnerInput,
  runnerLevel: RunnerLevel,
  capability: number,
  consistency: number,
  injury: number,
  schedule: ScheduleConstraintLevel,
): Pick<
  RunnerTraits,
  | "durabilityScore"
  | "progressionTolerance"
  | "intensityReadiness"
  | "longRunReadiness"
  | "recoveryNeed"
  | "injuryRiskScore"
  | "injuryRiskFlag"
  | "scheduleConstraintLevel"
> {
  const schedulePenalty = schedule === "high" ? 0.16 : schedule === "moderate" ? 0.08 : 0;
  const conservativePenalty = input.trainingStylePreference === "conservative" ? 0.05 : 0;
  const performanceBonus = input.trainingStylePreference === "performance" ? 0.06 : 0;
  const durabilityScore = clamp(
    average([
      capability,
      clamp(input.longestRecentRunMin / 100, 0, 1),
      clamp(input.currentWeeklyRuns / 5, 0, 1),
      consistency,
    ]) -
      injury * 0.25 -
      schedulePenalty * 0.25,
    0,
    1,
  );
  const progressionTolerance = clamp(
    durabilityScore * 0.45 +
      consistency * 0.25 +
      clamp(input.currentContinuousRunMin / 50, 0, 1) * 0.18 +
      performanceBonus -
      injury * 0.22 -
      conservativePenalty -
      schedulePenalty,
    0,
    1,
  );
  const intensityReadiness = clamp(
    average([
      clamp(input.currentContinuousRunMin / 45, 0, 1),
      clamp(input.currentWeeklyRuns / 4, 0, 1),
      clamp(input.typicalAvailableTimeMin / 70, 0, 1),
      consistency,
    ]) +
      performanceBonus -
      injury * 0.25 -
      schedulePenalty * 0.55 -
      (runnerLevel === "true_beginner" ? 0.35 : runnerLevel === "beginner_plus" ? 0.16 : 0),
    0,
    1,
  );
  const longRunReadiness = clamp(
    average([
      clamp(input.longestRecentRunMin / 90, 0, 1),
      clamp(input.typicalAvailableTimeMin / 90, 0, 1),
      consistency,
      clamp(input.currentContinuousRunMin / 50, 0, 1),
    ]) -
      injury * 0.18 -
      schedulePenalty * 0.3,
    0,
    1,
  );
  const recoveryNeed = clamp(
    0.22 +
      injury * 0.45 +
      (input.externalTrainingLoad === "high" ? 0.16 : input.externalTrainingLoad === "moderate" ? 0.09 : 0) +
      (input.age && input.age >= 55 ? 0.1 : input.age && input.age >= 45 ? 0.05 : 0) +
      (runnerLevel === "true_beginner" ? 0.05 : 0),
    0.16,
    0.82,
  );

  return {
    durabilityScore,
    progressionTolerance,
    intensityReadiness,
    longRunReadiness,
    recoveryNeed,
    injuryRiskScore: injury,
    injuryRiskFlag: injury >= 0.45,
    scheduleConstraintLevel: schedule,
  };
}

function capabilitySummary(input: RunnerInput, runnerLevel: RunnerLevel, capability: number): string {
  return `Capability points to ${runnerLevel}: ${input.currentContinuousRunMin} min continuous running, ${input.currentWeeklyRuns} runs/week, ${input.currentWeeklyVolumeKm} km/week, longest run ${input.longestRecentRunMin} min, combined capability ${Math.round(capability * 100)}.`;
}

function riskSummary(input: RunnerInput, injury: number, schedule: ScheduleConstraintLevel): string {
  return `Risk profile reflects injury concern ${input.injuryConcern ?? "none"}, external load ${input.externalTrainingLoad ?? "none"}, and schedule constraint ${schedule}; combined injury-risk score ${Math.round(injury * 100)}.`;
}

function intentSummary(input: RunnerInput): string {
  return `Intent is shaped by goal ${input.goalType}, distance ${input.raceDistance}, and training style ${input.trainingStylePreference}.`;
}

function classificationSummary(primaryType: PrimaryRunnerType, modifierList: RunnerModifier[]): string {
  return modifierList.length > 0
    ? `Primary runner type is ${primaryType} with modifiers ${modifierList.join(", ")}.`
    : `Primary runner type is ${primaryType} with no extra modifiers.`;
}

export function classifyRunner(input: RunnerInput): RunnerClassification {
  const capability = capabilityScore(input);
  const consistency = consistencyScore(input);
  const consistencyProfileValue = consistencyProfile(consistency);
  const injury = injuryRiskScore(input, consistency);
  const runnerLevel = deriveRunnerLevel(input, capability, consistency);
  const confidence = confidenceProfile(input, consistency, injury);
  const schedule = scheduleConstraintLevel(input);
  const primaryType = primaryRunnerType(input, runnerLevel, capability, consistency, injury, schedule);
  const modifierList = modifiers(input, consistency, injury, schedule, confidence, primaryType);
  const traitScores = deriveTraitScores(input, runnerLevel, capability, consistency, injury, schedule);

  const traits: RunnerTraits = {
    runnerLevel,
    primaryRunnerType: primaryType,
    modifiers: modifierList,
    durabilityScore: traitScores.durabilityScore,
    progressionTolerance: traitScores.progressionTolerance,
    intensityReadiness: traitScores.intensityReadiness,
    longRunReadiness: traitScores.longRunReadiness,
    injuryRiskFlag: traitScores.injuryRiskFlag,
    injuryRiskScore: traitScores.injuryRiskScore,
    recoveryNeed: traitScores.recoveryNeed,
    consistencyProfile: consistencyProfileValue,
    confidenceProfile: confidence,
    scheduleConstraintLevel: traitScores.scheduleConstraintLevel,
    trainingStyle: input.trainingStylePreference,
    consistencyScore: consistency,
  };

  const explanation = {
    capabilitySummary: capabilitySummary(input, runnerLevel, capability),
    riskSummary: riskSummary(input, injury, schedule),
    intentSummary: intentSummary(input),
    classificationSummary: classificationSummary(primaryType, modifierList),
  };

  return {
    traits,
    reasons: [explanation.capabilitySummary, explanation.riskSummary, explanation.intentSummary, explanation.classificationSummary],
    explanation,
  };
}
