import { OnboardingInterpretationInput, ProgressionStyle, RunnerArchetype, RunnerProfile } from "./types";

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
  const text = normalizeText(input.onboardingText);
  const currentAbility = normalizeText(input.currentAbility);
  const activityLevel = normalizeText(input.activityLevel);
  const confident = input.confidence ? input.confidence >= 4 : hasAnyKeyword(text, ["klar", "motiveret", "ambitiøs", "vil virkelig", "jeg kan godt", "stærk"]);

  if (hasAnyKeyword(text, ["tilbage", "igen", "comeback", "returning", "har løbet før", "kommer tilbage"])) {
    return "returning_runner";
  }

  if (hasAnyKeyword(text, ["nervøs", "bange", "forsigtig", "usikker", "ange", "scared"])) {
    return "nervous_beginner";
  }

  if (
    confident &&
    hasAnyKeyword(text, ["hurtigt", "så hurtigt som muligt", "presse", "mere", "kan godt klare", "gå all-in"]) &&
    hasAnyKeyword(currentAbility, ["helt_ny", "fem_min", "ti_femten"])
  ) {
    return "overeager_runner";
  }

  if (hasAnyKeyword(activityLevel, ["høj", "meget_høj"]) && hasAnyKeyword(currentAbility, ["helt_ny", "fem_min", "ti_femten"])) {
    return "fit_but_inexperienced";
  }

  if (confident || hasAnyKeyword(text, ["glæder mig", "motiveret", "klar til at bygge op", "goal"])) {
    return "motivated_novice";
  }

  return "nervous_beginner";
}

function inferInjurySensitivity(text: string, archetype: RunnerArchetype): 1 | 2 | 3 | 4 | 5 {
  if (hasAnyKeyword(text, ["skade", "ondt", "knæ", "achilles", "shin splint", "smerte", "pain", "injury"])) return 5;
  if (archetype === "returning_runner") return 4;
  if (archetype === "nervous_beginner") return 4;
  if (archetype === "overeager_runner") return 3;
  return 2;
}

function inferProgressionStyle(archetype: RunnerArchetype, injurySensitivity: number, confidence: number): ProgressionStyle {
  if (injurySensitivity >= 4 || confidence <= 2) return "conservative";
  if (archetype === "fit_but_inexperienced" || archetype === "motivated_novice") return "balanced";
  return "steady";
}

export function interpretRunnerProfile(input: OnboardingInterpretationInput): RunnerProfile {
  const text = normalizeText(input.onboardingText);
  const archetype = inferArchetype(input);
  const base = inferBaseFromAbility(input.currentAbility);

  const confidence = clampScale(
    input.confidence ??
      (archetype === "nervous_beginner"
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
      (archetype === "fit_but_inexperienced" ? 1 : 0) +
      (normalizeText(input.activityLevel) === "meget_høj" ? 1 : 0),
  );

  const runningSpecificity = clampScale(
    base.runningSpecificity +
      (archetype === "returning_runner" ? 1 : 0) -
      (archetype === "fit_but_inexperienced" ? 1 : 0),
  );

  return {
    archetype,
    aerobicBase,
    runningSpecificity,
    confidence,
    injurySensitivity,
    progressionStyle: inferProgressionStyle(archetype, injurySensitivity, confidence),
  };
}
