import type { Goal, GoalDistance, GoalType, GuidancePreference, OnboardingTrack, PlanAmbition, RunnerProfile, WorkoutSession } from "@/lib/types";
import type { BaseProgramTrack, DayOfWeek, ExperienceLevel, GoalType as EngineGoalType, RaceDistance, RunnerInput, TrainingStyle } from "./models";

function mapDistance(distance: GoalDistance): RaceDistance {
  if (distance === "Halvmaraton") return "HalfMarathon";
  return distance;
}

function mapGoalType(goalType?: GoalType): EngineGoalType {
  if (goalType === "run_without_walking") return "finish_without_walking";
  if (goalType === "target_time") return "target_time";
  if (goalType === "pr") return "improve_time";
  return "finish";
}

function mapDay(day: WorkoutSession["dayOfWeek"]): DayOfWeek {
  if (day === "Mandag") return "monday";
  if (day === "Tirsdag") return "tuesday";
  if (day === "Onsdag") return "wednesday";
  if (day === "Torsdag") return "thursday";
  if (day === "Fredag") return "friday";
  if (day === "Lordag") return "saturday";
  return "sunday";
}

function runningAbilityMinutes(value: RunnerProfile["currentRunningAbility"]): number {
  if (value === "helt_ny") return 0;
  if (value === "fem_min") return 5;
  if (value === "ti_femten_min") return 12;
  if (value === "tyve_tredive_min") return 25;
  return 40;
}

function capacityDistanceMinutes(distanceKm?: RunnerProfile["currentContinuousDistanceKm"]): number | null {
  if (!distanceKm || distanceKm <= 0) return null;
  return Math.max(5, Math.min(180, Math.round(distanceKm * 6.25)));
}

function mapExperienceLevel(value: RunnerProfile["runningExperience"]): ExperienceLevel {
  if (value === "nybegynder") return "new";
  if (value === "let_ovet") return "recreational";
  return "intermediate";
}

function mapTrainingStyle(value?: GuidancePreference): TrainingStyle {
  if (value === "simple") return "conservative";
  if (value === "performance_oriented") return "performance";
  return "balanced";
}

function resolveBaseProgramTrack(track: OnboardingTrack | undefined): BaseProgramTrack {
  if (track === "returning") return "returning";
  if (track === "running_consistently") return "steady_runner";
  if (track === "goal_focused") return "goal_focused";
  return "getting_started";
}

function trackTrainingStyle(track: BaseProgramTrack, preferredGuidance: GuidancePreference | undefined, goalType?: GoalType): TrainingStyle {
  if (preferredGuidance) return mapTrainingStyle(preferredGuidance);
  if (track === "getting_started") return "conservative";
  if (track === "returning") return "conservative";
  if (track === "goal_focused" && (goalType === "target_time" || goalType === "pr")) return "performance";
  return "balanced";
}

function mapExternalTrainingLoad(activityLevel: RunnerProfile["activityLevel"]): RunnerInput["externalTrainingLoad"] {
  if (activityLevel === "meget_lav") return "none";
  if (activityLevel === "lav") return "light";
  if (activityLevel === "moderat") return "moderate";
  return "high";
}

function mapInjuryConcern(profile: RunnerProfile): RunnerInput["injuryConcern"] {
  const text = `${profile.injuryHistory ?? ""} ${profile.weakPoints ?? ""}`.toLowerCase();
  if (!text.trim()) return "low";
  if (/(stress|akilles|knæ|kne|hofte|skade|smerte|pain|injury)/.test(text)) return "moderate";
  return "low";
}

function mapConfidence(profile: RunnerProfile): number {
  if (profile.currentRunningAbility === "helt_ny") return 2;
  if (profile.currentRunningAbility === "fem_min") return 2;
  if (profile.currentRunningAbility === "ti_femten_min") return 3;
  if (profile.currentRunningAbility === "tyve_tredive_min") return 4;
  return 4;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function baseRecentConsistency(currentRunsPerWeek: number): number {
  if (currentRunsPerWeek >= 4) return 0.8;
  if (currentRunsPerWeek >= 3) return 0.65;
  if (currentRunsPerWeek >= 2) return 0.45;
  if (currentRunsPerWeek >= 1) return 0.25;
  return 0.05;
}

function trackRecentConsistency(profile: RunnerProfile, currentContinuousRunMin: number, baseTrack: BaseProgramTrack): number {
  const currentRunsPerWeek = profile.currentRunsPerWeek ?? 0;
  const base = baseRecentConsistency(currentRunsPerWeek);
  if (baseTrack === "getting_started") {
    return clamp(Math.min(base, 0.42), 0.05, 1);
  }
  if (baseTrack === "returning") {
    return clamp(Math.max(base, currentRunsPerWeek >= 2 ? 0.38 : 0.22), 0.05, 1);
  }
  if (baseTrack === "steady_runner") {
    return clamp(Math.max(base, currentRunsPerWeek >= 3 || currentContinuousRunMin >= 28 ? 0.68 : 0.56), 0.05, 1);
  }
  if (baseTrack === "goal_focused") {
    return clamp(Math.max(base, currentRunsPerWeek >= 3 || currentContinuousRunMin >= 30 ? 0.74 : 0.6), 0.05, 1);
  }
  return base;
}

function trackConfidence(profile: RunnerProfile, currentContinuousRunMin: number, baseTrack: BaseProgramTrack): number {
  const base = mapConfidence(profile);
  if (baseTrack === "getting_started") {
    return clamp(Math.min(base, 2), 1, 5);
  }
  if (baseTrack === "returning") {
    return clamp(Math.min(base, 3), 1, 5);
  }
  if (baseTrack === "steady_runner") {
    return clamp(Math.max(base, currentContinuousRunMin >= 28 ? 4 : 3), 1, 5);
  }
  if (baseTrack === "goal_focused") {
    return clamp(Math.max(base, currentContinuousRunMin >= 30 || (profile.currentRunsPerWeek ?? 0) >= 3 ? 4 : 3), 1, 5);
  }
  return base;
}

function trackFlags(profile: RunnerProfile, baseTrack: BaseProgramTrack): string[] {
  const flags = [`track:${profile.onboardingTrack ?? "getting_started"}`, `base_track:${baseTrack}`];
  if (baseTrack === "returning") {
    flags.push("returning_runner", "back_into_rhythm");
  } else if (baseTrack === "getting_started") {
    flags.push("confidence_building");
  } else if (baseTrack === "goal_focused") {
    flags.push("goal_focused_runner");
  } else if (baseTrack === "steady_runner") {
    flags.push("steady_runner");
  }
  return flags;
}

export function buildEngineV2RunnerInput(params: {
  runnerProfile: RunnerProfile;
  goal: Goal;
  ambition?: PlanAmbition;
  resolvedGoalDate?: string;
  resolvedDurationWeeks?: number;
}): RunnerInput {
  const { runnerProfile, goal, ambition, resolvedGoalDate, resolvedDurationWeeks } = params;
  const startDate = goal.startDate;
  const fallbackEndDate = goal.endDate ?? startDate;
  const baseProgramTrack = resolveBaseProgramTrack(runnerProfile.onboardingTrack);
  const currentContinuousRunMin =
    capacityDistanceMinutes(runnerProfile.currentContinuousDistanceKm) ?? runningAbilityMinutes(runnerProfile.currentRunningAbility);
  const currentWeeklyRuns = runnerProfile.currentRunsPerWeek ?? 0;

  return {
    raceDistance: mapDistance(goal.distance),
    goalType: mapGoalType(goal.goalType),
    startDate,
    goalDate: resolvedGoalDate ?? fallbackEndDate,
    requestedDurationWeeks: resolvedDurationWeeks,
    ambitionPreference: ambition,
    currentContinuousRunMin,
    currentWeeklyRuns,
    currentWeeklyVolumeKm: runnerProfile.currentWeeklyVolumeKm ?? 0,
    longestRecentRunMin: runnerProfile.longestCurrentRunMin ?? 0,
    recentConsistency: trackRecentConsistency(runnerProfile, currentContinuousRunMin, baseProgramTrack),
    availableTrainingDays: (goal.availableTrainingDays ?? ["Tirsdag", "Torsdag", "Lordag"]).map(mapDay),
    preferredLongRunDay:
      goal.preferredLongRunDay === "both" || goal.preferredLongRunDay === "flexible" || !goal.preferredLongRunDay
        ? "flexible"
        : goal.preferredLongRunDay,
    typicalAvailableTimeMin: runnerProfile.typicalWorkoutMinutes ?? 45,
    trainingStylePreference: trackTrainingStyle(baseProgramTrack, runnerProfile.preferredGuidance, goal.goalType),
    baseProgramTrack,
    externalTrainingLoad: mapExternalTrainingLoad(runnerProfile.activityLevel),
    injuryConcern: mapInjuryConcern(runnerProfile),
    confidence: trackConfidence(runnerProfile, currentContinuousRunMin, baseProgramTrack),
    age: runnerProfile.age,
    weightKg: runnerProfile.weightKg,
    sex:
      runnerProfile.gender === "kvinde"
        ? "female"
        : runnerProfile.gender === "mand"
          ? "male"
          : runnerProfile.gender === "andet"
            ? "other"
            : runnerProfile.gender === "vil_ikke_oplyse"
              ? "prefer_not_to_say"
              : undefined,
    experienceLevel: mapExperienceLevel(runnerProfile.runningExperience),
    freeTextFlags: trackFlags(runnerProfile, baseProgramTrack),
  };
}
