import { BaseProgramTrack, OnboardingInterpretationInput, ProgressionStyle, RunnerArchetype, RunnerProfile } from "./types";
import { classifyRunnerCategory } from "./classification";

function clampScale(value: number): 1 | 2 | 3 | 4 | 5 {
  const rounded = Math.max(1, Math.min(5, Math.round(value)));
  return rounded as 1 | 2 | 3 | 4 | 5;
}

function normalizeText(value?: string): string {
  return (value ?? "").trim().toLowerCase();
}

function hasAnyKeyword(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function resolveBaseProgramTrack(track?: OnboardingInterpretationInput["onboardingTrack"]): BaseProgramTrack {
  if (track === "returning") return "returning";
  if (track === "running_consistently") return "steady_runner";
  if (track === "goal_focused") return "goal_focused";
  return "getting_started";
}

function hasStrongStructuredExperience(input: OnboardingInterpretationInput): boolean {
  const currentRunsPerWeek = input.currentRunsPerWeek ?? 0;
  const weeklyVolume = input.currentWeeklyVolumeKm ?? 0;
  const longestRunMinutes = input.longestRunMinutes ?? 0;
  const currentAbility = normalizeText(input.currentAbility);

  return (
    input.goalDistance === "Marathon" && weeklyVolume >= 35 && longestRunMinutes >= 75 ||
    input.goalDistance === "Halvmaraton" && weeklyVolume >= 25 && longestRunMinutes >= 60 ||
    input.goalDistance === "10K" && currentRunsPerWeek >= 3 && longestRunMinutes >= 35 ||
    input.goalDistance === "5K" && currentRunsPerWeek >= 3 && longestRunMinutes >= 35 ||
    weeklyVolume >= 35 ||
    weeklyVolume >= 20
  ) || (
    currentRunsPerWeek >= 3 && longestRunMinutes >= 35
  ) || (
    currentRunsPerWeek >= 4
  ) || (
    currentAbility === "mere_end_tredive_min" && currentRunsPerWeek >= 3
  );
}

function hasInjuryConcernText(text: string): boolean {
  const normalized = normalizeText(text);
  if (!normalized) return false;

  const explicitNoInjuryPhrases = [
    "ingen skader",
    "ingen skade",
    "ingen sårbare områder",
    "ingen sårbarheder",
    "ingen problemer",
    "ingen smerter",
    "ikke skadet",
    "ikke nogen skader",
    "ingen udfordringer",
  ];

  if (explicitNoInjuryPhrases.some((phrase) => normalized.includes(phrase))) {
    return false;
  }

  return hasAnyKeyword(normalized, ["skade", "ondt", "knæ", "achilles", "shin splint", "smerte", "pain", "injury"]);
}

function inferBaseFromAbility(currentAbility?: string): { aerobicBase: 1 | 2 | 3 | 4 | 5; runningSpecificity: 1 | 2 | 3 | 4 | 5 } {
  const normalized = normalizeText(currentAbility);

  if (hasAnyKeyword(normalized, ["mere_end_tredive", "more than 30", "30 plus", "30+"])) {
    return { aerobicBase: 4, runningSpecificity: 3 };
  }
  if (hasAnyKeyword(normalized, ["tyve_tredive", "20-30", "20–30"])) {
    return { aerobicBase: 3, runningSpecificity: 3 };
  }
  if (hasAnyKeyword(normalized, ["ti_femten", "10-15", "10–15"])) {
    return { aerobicBase: 2, runningSpecificity: 2 };
  }
  if (hasAnyKeyword(normalized, ["fem_min", "5 minutter", "5 minute"])) {
    return { aerobicBase: 1, runningSpecificity: 1 };
  }

  return { aerobicBase: 1, runningSpecificity: 1 };
}

function inferArchetype(input: OnboardingInterpretationInput): RunnerArchetype {
  const baseProgramTrack = resolveBaseProgramTrack(input.onboardingTrack);
  const recentRunningState = input.recentRunningState;
  const text = [input.onboardingText, input.injuryHistory, input.weakPoints, input.otherTraining].map(normalizeText).join(" ");
  const currentAbility = normalizeText(input.currentAbility);
  const activityLevel = normalizeText(input.activityLevel);
  const currentRunsPerWeek = input.currentRunsPerWeek ?? 0;
  const weeklyVolume = input.currentWeeklyVolumeKm ?? 0;
  const longestRunMinutes = input.longestRunMinutes ?? 0;
  const confident = input.confidence ? input.confidence >= 4 : hasAnyKeyword(text, ["klar", "motiveret", "ambitiøs", "vil virkelig", "jeg kan godt", "stærk"]);
  const explicitBeginner = hasAnyKeyword(text, ["helt ny", "aldrig løbet", "never run", "har aldrig løbet", "ingen løbeerfaring", "start fra nul"]);
  const strongStructuredExperience = hasStrongStructuredExperience(input);

  if (baseProgramTrack === "returning" || recentRunningState === "returning") return "returning_runner";
  if (strongStructuredExperience) {
    if (hasAnyKeyword(text, ["tilbage", "igen", "comeback", "returning", "har løbet før", "kommer tilbage"])) {
      return "returning_runner";
    }
    if (
      confident &&
      (input.goalType === "pr" || input.goalType === "target_time" || hasAnyKeyword(text, ["hurtigt", "så hurtigt som muligt", "presse", "mere", "gå all-in"])) &&
      weeklyVolume < 30
    ) {
      return "overeager_runner";
    }
    return "motivated_novice";
  }

  if (baseProgramTrack === "goal_focused" && input.goalType && (input.goalType === "pr" || input.goalType === "target_time") && !strongStructuredExperience) {
    return "overeager_runner";
  }
  if (baseProgramTrack === "steady_runner" && !explicitBeginner) {
    return "fit_but_inexperienced";
  }
  if (explicitBeginner) {
    return "nervous_beginner";
  }

  if (recentRunningState === "long_break_or_new" && currentRunsPerWeek <= 1 && longestRunMinutes <= 20) {
    return "nervous_beginner";
  }

  if (hasAnyKeyword(text, ["tilbage", "igen", "comeback", "returning", "har løbet før", "kommer tilbage"])) {
    return "returning_runner";
  }

  if (hasAnyKeyword(text, ["nervøs", "bange", "forsigtig", "usikker", "ange", "scared"])) {
    return "nervous_beginner";
  }

  if (
    confident &&
    (input.goalType === "pr" || input.goalType === "target_time" || hasAnyKeyword(text, ["hurtigt", "så hurtigt som muligt", "presse", "mere", "kan godt klare", "gå all-in"])) &&
    (hasAnyKeyword(currentAbility, ["helt_ny", "fem_min", "ti_femten"]) || currentRunsPerWeek <= 2)
  ) {
    return "overeager_runner";
  }

  if (
    (hasAnyKeyword(activityLevel, ["høj", "meget_høj"]) || weeklyVolume >= 15) &&
    (hasAnyKeyword(currentAbility, ["helt_ny", "fem_min", "ti_femten"]) || longestRunMinutes <= 30)
  ) {
    return "fit_but_inexperienced";
  }

  if (confident || hasAnyKeyword(text, ["glæder mig", "motiveret", "klar til at bygge op", "goal"])) {
    return "motivated_novice";
  }

  return "nervous_beginner";
}

function inferInjurySensitivity(text: string, archetype: RunnerArchetype): 1 | 2 | 3 | 4 | 5 {
  if (hasInjuryConcernText(text)) return 5;
  if (archetype === "returning_runner") return 4;
  if (archetype === "nervous_beginner") return 4;
  if (archetype === "overeager_runner") return 3;
  return 2;
}

function inferProgressionStyle(baseProgramTrack: BaseProgramTrack, archetype: RunnerArchetype, injurySensitivity: number, confidence: number): ProgressionStyle {
  if (baseProgramTrack === "getting_started") return "conservative";
  if (baseProgramTrack === "returning") return "conservative";
  if (baseProgramTrack === "goal_focused" && injurySensitivity <= 3 && confidence >= 4) return "steady";
  if (baseProgramTrack === "steady_runner") return "balanced";
  if (injurySensitivity >= 4 || confidence <= 2) return "conservative";
  if (archetype === "fit_but_inexperienced" || archetype === "motivated_novice") return "balanced";
  return "steady";
}

export function interpretRunnerProfile(input: OnboardingInterpretationInput): RunnerProfile {
  const baseProgramTrack = resolveBaseProgramTrack(input.onboardingTrack);
  const text = [input.onboardingText, input.injuryHistory, input.weakPoints, input.otherTraining].map(normalizeText).join(" ");
  const archetype = inferArchetype(input);
  const base = inferBaseFromAbility(input.currentAbility);
  const currentRunsPerWeek = input.currentRunsPerWeek ?? 0;
  const weeklyVolume = input.currentWeeklyVolumeKm ?? 0;
  const realisticDays = input.realisticTrainingDaysPerWeek ?? 3;

  const confidence = clampScale(
    input.confidence ??
      (baseProgramTrack === "getting_started"
        ? 2
        : baseProgramTrack === "goal_focused"
          ? 4
          : archetype === "nervous_beginner"
            ? 2
            : archetype === "overeager_runner"
              ? 4
              : archetype === "returning_runner"
                ? 3
                : hasAnyKeyword(text, ["usikker", "nervøs", "bange"])
                  ? 2
                  : 3),
  );

  const injurySensitivity = inferInjurySensitivity(text, archetype);

  const aerobicBase = clampScale(
    base.aerobicBase +
      (baseProgramTrack === "goal_focused" ? 1 : 0) +
      (archetype === "fit_but_inexperienced" ? 1 : 0) +
      (normalizeText(input.activityLevel) === "meget_høj" ? 1 : 0) +
      (weeklyVolume >= 20 ? 1 : 0),
  );

  const runningSpecificity = clampScale(
    base.runningSpecificity +
      (baseProgramTrack === "steady_runner" ? 1 : 0) +
      (baseProgramTrack === "goal_focused" && currentRunsPerWeek >= 3 ? 1 : 0) +
      (archetype === "returning_runner" ? 1 : 0) -
      (archetype === "fit_but_inexperienced" ? 1 : 0) +
      (currentRunsPerWeek >= 3 ? 1 : 0),
  );

  const adjustedConfidence = clampScale(
    confidence +
      (baseProgramTrack === "goal_focused" ? 1 : 0) +
      (baseProgramTrack === "getting_started" ? -1 : 0) +
      (hasAnyKeyword(text, ["usikker", "nervøs", "bange", "bekymret"]) ? -1 : 0) +
      (input.goalType === "pr" && realisticDays >= 3 ? 1 : 0) +
      (hasStrongStructuredExperience(input) ? 1 : 0),
  );

  const runnerCategory = classifyRunnerCategory({
    baseProgramTrack,
    archetype,
    aerobicBase,
    runningSpecificity,
    confidence: adjustedConfidence,
    injurySensitivity,
    progressionStyle: inferProgressionStyle(baseProgramTrack, archetype, injurySensitivity, adjustedConfidence),
    currentRunsPerWeek,
    currentWeeklyVolumeKm: weeklyVolume,
    longestRunMinutes: input.longestRunMinutes ?? 0,
    typicalWorkoutMinutes: input.typicalWorkoutMinutes ?? 45,
    realisticTrainingDaysPerWeek: realisticDays,
  });

  return {
    baseProgramTrack,
    archetype,
    runnerCategory,
    aerobicBase,
    runningSpecificity,
    confidence: adjustedConfidence,
    injurySensitivity,
    progressionStyle: inferProgressionStyle(baseProgramTrack, archetype, injurySensitivity, adjustedConfidence),
    currentRunsPerWeek,
    currentWeeklyVolumeKm: weeklyVolume,
    longestRunMinutes: input.longestRunMinutes ?? 0,
    typicalWorkoutMinutes: input.typicalWorkoutMinutes ?? 45,
    realisticTrainingDaysPerWeek: realisticDays,
  };
}
