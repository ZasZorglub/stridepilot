import type { Goal, GoalDistance, GoalType, GuidancePreference, PlanAmbition, RunnerProfile, WorkoutSession } from "@/lib/types";
import type { DayOfWeek, ExperienceLevel, GoalType as EngineGoalType, RaceDistance, RunnerInput, TrainingStyle } from "./models";

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

  return {
    raceDistance: mapDistance(goal.distance),
    goalType: mapGoalType(goal.goalType),
    startDate,
    goalDate: resolvedGoalDate ?? fallbackEndDate,
    requestedDurationWeeks: resolvedDurationWeeks,
    ambitionPreference: ambition,
    currentContinuousRunMin: runningAbilityMinutes(runnerProfile.currentRunningAbility),
    currentWeeklyRuns: runnerProfile.currentRunsPerWeek ?? 0,
    currentWeeklyVolumeKm: runnerProfile.currentWeeklyVolumeKm ?? 0,
    longestRecentRunMin: runnerProfile.longestCurrentRunMin ?? 0,
    recentConsistency:
      (runnerProfile.currentRunsPerWeek ?? 0) >= 4
        ? 0.8
        : (runnerProfile.currentRunsPerWeek ?? 0) >= 3
          ? 0.65
          : (runnerProfile.currentRunsPerWeek ?? 0) >= 2
            ? 0.45
            : (runnerProfile.currentRunsPerWeek ?? 0) >= 1
              ? 0.25
              : 0.05,
    availableTrainingDays: (goal.availableTrainingDays ?? ["Tirsdag", "Torsdag", "Lordag"]).map(mapDay),
    preferredLongRunDay:
      goal.preferredLongRunDay === "both" || goal.preferredLongRunDay === "flexible" || !goal.preferredLongRunDay
        ? "flexible"
        : goal.preferredLongRunDay,
    typicalAvailableTimeMin: runnerProfile.typicalWorkoutMinutes ?? 45,
    trainingStylePreference: mapTrainingStyle(runnerProfile.preferredGuidance),
    externalTrainingLoad: mapExternalTrainingLoad(runnerProfile.activityLevel),
    injuryConcern: mapInjuryConcern(runnerProfile),
    confidence: mapConfidence(runnerProfile),
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
  };
}
