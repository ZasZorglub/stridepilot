import { GoalConfig, PlanType, RunnerCategory, RunnerProfile } from "./types";

function continuousCapacityMinutes(profile: RunnerProfile): number {
  const fromLongest = Math.max(0, profile.longestRunMinutes);
  const fromVolume = profile.currentWeeklyVolumeKm > 0 ? profile.currentWeeklyVolumeKm * 1.4 : 0;
  const fromSpecificity =
    profile.runningSpecificity >= 5
      ? 45
      : profile.runningSpecificity === 4
        ? 35
        : profile.runningSpecificity === 3
          ? 25
          : profile.runningSpecificity === 2
            ? 12
            : 5;
  return Math.max(fromLongest, fromVolume, fromSpecificity);
}

export function classifyRunnerCategory(profile: RunnerProfile): RunnerCategory {
  const runs = profile.currentRunsPerWeek;
  const volume = profile.currentWeeklyVolumeKm;
  const longest = profile.longestRunMinutes;
  const workoutMinutes = profile.typicalWorkoutMinutes;
  const trainingDays = profile.realisticTrainingDaysPerWeek;
  const continuousMinutes = continuousCapacityMinutes(profile);

  const zeroBase = runs === 0 && volume === 0 && longest === 0 && profile.runningSpecificity <= 1 && profile.aerobicBase <= 1;
  if (zeroBase) return "true_beginner";

  if (
    continuousMinutes < 10 &&
    runs <= 2 &&
    volume <= 8 &&
    longest <= 12
  ) {
    return "run_walk_beginner";
  }

  if (
    continuousMinutes < 25 &&
    runs <= 3 &&
    volume <= 16 &&
    longest <= 25
  ) {
    return "continuous_beginner";
  }

  if (
    continuousMinutes >= 25 &&
    runs <= 3 &&
    volume <= 20 &&
    longest <= 45 &&
    workoutMinutes <= 50
  ) {
    return "recreational";
  }

  if (
    continuousMinutes >= 30 &&
    runs >= 3 &&
    volume >= 18 &&
    longest >= 35 &&
    (volume < 30 || trainingDays <= 3)
  ) {
    return "light_intermediate";
  }

  if (
    continuousMinutes >= 40 &&
    runs >= 4 &&
    volume >= 28 &&
    longest >= 55 &&
    (volume < 45 || workoutMinutes < 80)
  ) {
    return "intermediate";
  }

  return "advanced";
}

export function runnerCategoryReason(profile: RunnerProfile, category: RunnerCategory): string {
  const continuousMinutes = continuousCapacityMinutes(profile);

  if (category === "true_beginner") {
    return "Du starter reelt fra nul, så planen skal først bygge tryghed og helt grundlæggende løbetolerance.";
  }
  if (category === "run_walk_beginner") {
    return "Du har kun kort sammenhængende løbekapacitet lige nu, så en run-walk-opbygning er den mest realistiske åbning.";
  }
  if (category === "continuous_beginner") {
    return "Du kan løbe lidt sammenhængende, men endnu ikke langt nok til at en egentlig distanceplan skal starte for aggressivt.";
  }
  if (category === "recreational") {
    return `Du tåler allerede omkring ${Math.round(continuousMinutes)} minutters sammenhængende løb, så planen kan starte som et rigtigt kontinuerligt løbeprogram frem for som begynder-run-walk.`;
  }
  if (category === "light_intermediate") {
    return `Du løber allerede ${profile.currentRunsPerWeek} gange om ugen og tåler ture omkring ${profile.longestRunMinutes} minutter, så planen skal ligne rigtig træning og ikke begynderniveau.`;
  }
  if (category === "intermediate") {
    return "Dit nuværende volumen- og kontinuitetsniveau peger på, at du kan håndtere en mere tydelig mellem-niveau struktur med mere målrettet kvalitet.";
  }
  return "Dit nuværende niveau peger på, at planen kan bygges som et klart avanceret forløb med stærk specifikitet.";
}

export function choosePlanType(profile: RunnerProfile, goal: GoalConfig): PlanType {
  const category = profile.runnerCategory ?? classifyRunnerCategory(profile);
  const continuousMinutes = continuousCapacityMinutes(profile);

  if (goal.goalDistance === "5K") {
    if (goal.goalIntent === "improve" || goal.goalIntent === "target_time") return "FiveKImprove";
    if (category === "true_beginner" || category === "run_walk_beginner") return "RunWalk5K";
    return "Continuous5K";
  }

  if (goal.goalDistance === "10K") {
    if (
      (goal.goalIntent === "finish" || goal.goalIntent === "finish_comfortably") &&
      continuousMinutes >= 20 &&
      category !== "true_beginner" &&
      category !== "run_walk_beginner"
    ) {
      return "TenKDistance";
    }
    return goal.goalIntent === "improve" || goal.goalIntent === "target_time" ? "TenKPerformance" : "TenKDistance";
  }

  if (goal.goalDistance === "Halvmaraton") return "HalfMarathon";
  return "Marathon";
}
