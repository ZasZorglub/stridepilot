import { CurrentRunningAbility, Goal, GoalDistance, GoalType, OnboardingTrack, PlanRecommendationOption, RecentRaceTime, WorkoutSession } from "@/lib/types";
import { SiteLocale } from "./site-variant";
import { resolveStubWeekPolicy } from "./late-week-start";

export interface RecentRaceDraft {
  distance: GoalDistance | "";
  time: string;
}

export interface RecentRaceTimeParts {
  hours: number;
  minutes: number;
  seconds: number;
}

export type OnboardingStepId =
  | "intro"
  | "track"
  | "running_level"
  | "target_distance"
  | "goal_type"
  | "weekly_structure"
  | "plan_style"
  | "constraints"
  | "extra_profile";

export interface OnboardingStepDefinition {
  index: number;
  id: OnboardingStepId;
  title: string;
  subtitle: string;
  nextLabel: string;
  optional?: boolean;
}

export const ONBOARDING_TRACK_OPTIONS: Array<{ value: OnboardingTrack; label: string }> = [
  { value: "getting_started", label: "Jeg vil i gang med løb" },
  { value: "returning", label: "Jeg er på vej tilbage" },
  { value: "running_consistently", label: "Jeg løber allerede lidt" },
  { value: "goal_focused", label: "Jeg træner mod et konkret mål" },
];

const ONBOARDING_TRACK_OPTIONS_EN: Array<{ value: OnboardingTrack; label: string }> = [
  { value: "getting_started", label: "I’m new to running" },
  { value: "returning", label: "I’m getting back into it" },
  { value: "running_consistently", label: "I run regularly" },
  { value: "goal_focused", label: "I train with a goal" },
];

export const CURRENT_CAPACITY_DISTANCE_QUICK_OPTIONS = [0.5, 1, 3, 5, 8, 10, 15] as const;

const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  complete: "Gennemføre",
  run_without_walking: "Løbe uden gangpauser",
  target_time: "Løbe i et bestemt tempo",
  pr: "Sæt PR",
};

const GOAL_TYPE_LABELS_EN: Record<GoalType, string> = {
  complete: "Complete the distance",
  run_without_walking: "Run it without walking",
  target_time: "Run to a target pace",
  pr: "Set a PR",
};

const ABILITY_RANK: Record<CurrentRunningAbility, number> = {
  helt_ny: 0,
  fem_min: 1,
  ti_femten_min: 2,
  tyve_tredive_min: 3,
  mere_end_tredive_min: 4,
};

export const ONBOARDING_STEPS: OnboardingStepDefinition[] = [
  {
    index: 1,
    id: "track",
    title: "Hvad passer bedst på dig lige nu?",
    subtitle: "Det hjælper mig med at lægge tonen rigtigt fra start.",
    nextLabel: "Fortsæt",
  },
  {
    index: 2,
    id: "intro",
    title: "Lad os starte roligt",
    subtitle: "Kun det vigtigste først.",
    nextLabel: "Fortsæt",
  },
  {
    index: 3,
    id: "running_level",
    title: "Hvor langt kan du realistisk løbe nu uden stop?",
    subtitle: "Et roligt og ærligt bud er nok.",
    nextLabel: "Fortsæt",
  },
  {
    index: 4,
    id: "target_distance",
    title: "Hvad træner du frem mod?",
    subtitle: "Vælg den distance, du gerne vil bygge op til.",
    nextLabel: "Fortsæt",
  },
  {
    index: 5,
    id: "goal_type",
    title: "Hvad vil du gerne kunne?",
    subtitle: "Jeg viser kun de mål, der passer til dit udgangspunkt.",
    nextLabel: "Fortsæt",
  },
  {
    index: 6,
    id: "weekly_structure",
    title: "Hvordan skal ugen passe ind?",
    subtitle: "Kun de rammer, der betyder mest i hverdagen.",
    nextLabel: "Fortsæt",
  },
  {
    index: 7,
    id: "plan_style",
    title: "Hvordan skal planen bygges?",
    subtitle: "Vælg tempoet i planen og tag højde for resten af din hverdag.",
    nextLabel: "Fortsæt",
  },
  {
    index: 8,
    id: "constraints",
    title: "Noget jeg skal tage hensyn til?",
    subtitle: "Valgfrit. Et par korte noter er nok.",
    nextLabel: "Fortsæt",
  },
  {
    index: 9,
    id: "extra_profile",
    title: "Ekstra detaljer",
    subtitle: "Valgfrit. Kun hvis du vil finjustere anbefalingen.",
    nextLabel: "Se min plan",
    optional: true,
  },
];

const ONBOARDING_STEPS_EN: OnboardingStepDefinition[] = [
  {
    index: 1,
    id: "track",
    title: "Which best describes you?",
    subtitle: "",
    nextLabel: "Continue",
  },
  {
    index: 2,
    id: "intro",
    title: "What should we call you?",
    subtitle: "",
    nextLabel: "Continue",
  },
  {
    index: 3,
    id: "running_level",
    title: "How far can you realistically run right now without stopping?",
    subtitle: "",
    nextLabel: "Continue",
  },
  {
    index: 4,
    id: "target_distance",
    title: "Which distance?",
    subtitle: "",
    nextLabel: "Continue",
  },
  {
    index: 5,
    id: "goal_type",
    title: "Which days can you train?",
    subtitle: "",
    nextLabel: "Continue",
  },
  {
    index: 6,
    id: "weekly_structure",
    title: "What is your goal?",
    subtitle: "",
    nextLabel: "Continue",
  },
  {
    index: 7,
    id: "plan_style",
    title: "How should the plan feel?",
    subtitle: "",
    nextLabel: "Continue",
  },
  {
    index: 8,
    id: "constraints",
    title: "Anything I should take into account?",
    subtitle: "",
    nextLabel: "Continue",
  },
  {
    index: 9,
    id: "extra_profile",
    title: "Extra details",
    subtitle: "",
    nextLabel: "Show my plan",
    optional: true,
  },
];

export const ONBOARDING_STEP_COUNT = ONBOARDING_STEPS.length;

export function getSuggestedPlanStartDate(referenceDate = new Date()): string {
  const localDate = new Date(referenceDate.getTime() - referenceDate.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

export function resolvePlanStartDateForWeekRhythm(params: {
  startDateIso: string;
  availableTrainingDays?: WorkoutSession["dayOfWeek"][] | null;
  minimumOpeningWeekSessions?: number;
}): {
  startDateIso: string;
  shiftedToNextWeek: boolean;
  remainingPlannedSessions: number;
} {
  const policy = resolveStubWeekPolicy({
    selectedStartDateIso: params.startDateIso,
    availableTrainingDays: params.availableTrainingDays,
    minimumOpeningWeekSessions: params.minimumOpeningWeekSessions,
  });
  return {
    startDateIso: policy.effectiveStartDateIso,
    shiftedToNextWeek: policy.shiftedToNextWeek,
    remainingPlannedSessions: policy.remainingPlannedSessions,
  };
}

export function getOnboardingTrackOptions(locale: SiteLocale = "da"): Array<{ value: OnboardingTrack; label: string }> {
  return locale === "en" ? ONBOARDING_TRACK_OPTIONS_EN : ONBOARDING_TRACK_OPTIONS;
}

export function buildPlanStartDateHelpText(
  startDateIso: string,
  todayDateIso: string,
  locale: SiteLocale = "da",
  availableTrainingDays?: WorkoutSession["dayOfWeek"][] | null,
): string {
  if (!startDateIso) {
    return locale === "en"
      ? "Choose the day you would like week 1 to begin."
      : "Vælg den dag, du helst vil begynde med uge 1.";
  }

  const weekRhythm = resolvePlanStartDateForWeekRhythm({
    startDateIso,
    availableTrainingDays,
  });
  if (weekRhythm.shiftedToNextWeek) {
    return locale === "en"
      ? "Your plan will start on Monday so week 1 gets a better rhythm."
      : "Din plan starter mandag for at give en god rytme.";
  }

  if (startDateIso === todayDateIso) {
    return locale === "en"
      ? "I will start week 1 from today, so you can begin calmly right away."
      : "Jeg lægger uge 1 fra i dag, så du kan komme roligt i gang med det samme.";
  }

  return locale === "en"
    ? "I will start week 1 from that date, so the plan begins when it fits you best."
    : "Jeg lægger uge 1 fra den dato, så planen starter, når det passer dig bedst.";
}

export function buildRecommendationLeadCopy(summary: string, planLevelExplanation?: string): string {
  const trimmedSummary = summary.trim();
  const trimmedExplanation = planLevelExplanation?.trim();

  if (!trimmedExplanation) {
    return trimmedSummary;
  }

  if (!trimmedSummary) {
    return trimmedExplanation;
  }

  const normalizedSummary = trimmedSummary.toLowerCase();
  const normalizedExplanation = trimmedExplanation.toLowerCase();
  if (
    normalizedSummary.includes(normalizedExplanation) ||
    normalizedExplanation.includes(normalizedSummary)
  ) {
    return trimmedSummary.length >= trimmedExplanation.length ? trimmedSummary : trimmedExplanation;
  }

  if (trimmedSummary.length >= 70) {
    return trimmedSummary;
  }

  return `${trimmedSummary} ${trimmedExplanation}`;
}

export function buildTrackRecommendationContext(track?: OnboardingTrack, locale: SiteLocale = "da"): string | null {
  if (locale === "en") {
    if (track === "getting_started") return "We start simply and calmly so you can build a real rhythm.";
    if (track === "returning") return "We build back calmly from what you can handle now.";
    if (track === "running_consistently") return "I am starting from the fact that you already have some running stability.";
    if (track === "goal_focused") return "The plan is shaped with a clear line toward your goal.";
    return null;
  }
  if (track === "getting_started") return "Vi starter enkelt og roligt, så du får rytmen ind.";
  if (track === "returning") return "Vi bygger roligt tilbage fra det, du kan nu.";
  if (track === "running_consistently") return "Jeg tager udgangspunkt i, at du allerede har lidt stabilitet.";
  if (track === "goal_focused") return "Planen er lagt med tydelig retning mod dit mål.";
  return null;
}

function goalTypeRequiresPace(goalType?: GoalType): boolean {
  return goalType === "target_time" || goalType === "pr";
}

export function buildDurationEditBounds(params: {
  recommendedWeeks: number;
  realisticMinWeeks: number;
  realisticMaxWeeks: number;
}): { editableMinWeeks: number; editableMaxWeeks: number } {
  return {
    editableMinWeeks: Math.max(4, Math.min(params.recommendedWeeks, params.realisticMinWeeks) - 8),
    editableMaxWeeks: Math.min(52, Math.max(params.recommendedWeeks, params.realisticMaxWeeks) + 8),
  };
}

export function shouldInitializeOnboardingProfileStage(previousStage: string | null, nextStage: string): boolean {
  return nextStage === "profile" && previousStage !== "profile";
}

export function isOnboardingStepReady(params: {
  onboardingStep: number;
  selections: {
    track: boolean;
    runningAbility: boolean;
    recentRunningState?: boolean;
    goalDistance: boolean;
    goalType: boolean;
    activityLevel: boolean;
    ambition: boolean;
  };
  firstName?: string;
  trainingContext?: string;
  goalType?: GoalType;
  targetPaceSecPerKm?: number;
  typicalWorkoutMinutes?: number;
  availableTrainingDaysCount?: number;
  preferredLongRunDay?: string;
  hasValidStartDate?: boolean;
}): boolean {
  if (params.onboardingStep === 1) return params.selections.track;
  if (params.onboardingStep === 2) return Boolean(params.firstName?.trim());
  if (params.onboardingStep === 3) return params.selections.runningAbility && Boolean(params.selections.recentRunningState);
  if (params.onboardingStep === 4) return params.selections.goalDistance;
  if (params.onboardingStep === 5) {
    return (
      Boolean(params.typicalWorkoutMinutes) &&
      Boolean(params.availableTrainingDaysCount) &&
      Boolean(params.preferredLongRunDay) &&
      Boolean(params.hasValidStartDate)
    );
  }
  if (params.onboardingStep === 6) {
    return params.selections.goalType && (!goalTypeRequiresPace(params.goalType) || Boolean(params.targetPaceSecPerKm));
  }
  if (params.onboardingStep === 7) return params.selections.activityLevel && params.selections.ambition;
  return true;
}

export function addWeeksToIsoDate(startDate: string, weeks: number): string {
  const date = new Date(`${startDate}T12:00:00`);
  date.setDate(date.getDate() + weeks * 7);
  return date.toISOString().slice(0, 10);
}

function weekLabel(count: number, locale: SiteLocale = "da"): string {
  if (locale === "en") return count === 1 ? "week" : "weeks";
  return count === 1 ? "uge" : "uger";
}

function durationPlanLevelLabel(selectedWeeks: number, recommendedWeeks: number, locale: SiteLocale = "da"): PlanRecommendationOption["planLevelLabel"] {
  const diff = selectedWeeks - recommendedWeeks;
  if (locale === "en") {
    if (diff >= 2) return "Calmer";
    if (diff === 1) return "Slightly calmer";
    if (diff <= -2) return "Ambitious";
    if (diff === -1) return "Slightly ambitious";
    return "Realistic";
  }
  if (diff >= 2) return "Roligere";
  if (diff === 1) return "Lidt roligere";
  if (diff <= -2) return "Ambitiøs";
  if (diff === -1) return "Lidt ambitiøs";
  return "Realistisk";
}

function durationPlanLevel(selectedWeeks: number, recommendedWeeks: number): PlanRecommendationOption["planLevel"] {
  const diff = selectedWeeks - recommendedWeeks;
  if (diff >= 2) return "easy";
  if (diff === 1) return "very_easy";
  if (diff <= -2) return "ambitious";
  if (diff === -1) return "slightly_ambitious";
  return "realistic";
}

function durationPlanLevelExplanation(selectedWeeks: number, recommendedWeeks: number, locale: SiteLocale = "da"): string {
  const diff = selectedWeeks - recommendedWeeks;
  if (locale === "en") {
    if (diff >= 2) return "The plan gets a little more room, so progression can build more calmly.";
    if (diff === 1) return "The plan gets a little extra room without changing direction much.";
    if (diff <= -2) return "The plan becomes clearly more compressed and needs steadier training week by week.";
    if (diff === -1) return "The plan becomes a little more compressed than recommended.";
    return "The plan follows the duration StridePilot considers the most realistic.";
  }
  if (diff >= 2) return "Planen får lidt mere luft, så progressionen kan bygges roligere op.";
  if (diff === 1) return "Planen får lidt ekstra luft uden at ændre retningen nævneværdigt.";
  if (diff <= -2) return "Planen bliver tydeligt mere komprimeret og kræver mere stabil træning uge for uge.";
  if (diff === -1) return "Planen bliver lidt mere komprimeret end anbefalingen.";
  return "Planen følger den varighed, StridePilot vurderer som mest realistisk.";
}

export function buildDurationAdjustmentState(params: {
  goal: Goal;
  recommendedWeeks: number;
  selectedWeeks: number;
  realisticMinWeeks?: number;
  realisticMaxWeeks?: number;
  locale?: SiteLocale;
}): {
  isRecommended: boolean;
  note: string | null;
  overridePrompt: {
    overrideKey: string;
    title: string;
    body: string;
    confirmLabel: string;
  } | null;
} {
  const locale = params.locale ?? "da";
  const diff = params.selectedWeeks - params.recommendedWeeks;
  const outsideRealisticSpan =
    (typeof params.realisticMinWeeks === "number" && params.selectedWeeks < params.realisticMinWeeks) ||
    (typeof params.realisticMaxWeeks === "number" && params.selectedWeeks > params.realisticMaxWeeks);
  if (diff === 0) {
    return {
      isRecommended: true,
      note: null,
      overridePrompt: null,
    };
  }

  if (diff < 0) {
    const weeksShorter = Math.abs(diff);
    return {
      isRecommended: false,
      note:
        weeksShorter === 1
          ? locale === "en"
            ? "That makes the plan a little more compressed and leaves less room for adjustments along the way."
            : "Det gør planen lidt mere komprimeret og giver lidt mindre plads til tilpasninger undervejs."
          : locale === "en"
            ? `That gives you ${weeksShorter} ${weekLabel(weeksShorter, locale)} less time to build safely and less room for adjustments along the way.`
            : `Det giver ${weeksShorter} ${weekLabel(weeksShorter, locale)} mindre tid til at bygge sikkert op og mindre plads til justeringer undervejs.`,
      overridePrompt:
        weeksShorter >= 2 || outsideRealisticSpan
          ? {
              overrideKey: `${params.goal.distance}|${params.recommendedWeeks}|${params.selectedWeeks}`,
              title: locale === "en" ? `${params.selectedWeeks} weeks is shorter than my recommendation` : `${params.selectedWeeks} uger er kortere end min anbefaling`,
              body: locale === "en"
                ? `StridePilot recommends ${params.recommendedWeeks} weeks here because a shorter timeline leaves less room for safe buildup, less robustness, and less space to adapt the plan along the way. You can still choose the shorter path if that is the constraint you want to keep.`
                : `StridePilot anbefaler ${params.recommendedWeeks} uger her, fordi en kortere tidslinje giver mindre plads til sikker opbygning, mindre robusthed og mindre rum til at tilpasse planen undervejs. Du kan stadig vælge den kortere vej, hvis det er den ramme, du vil holde fast i.`,
              confirmLabel: locale === "en" ? `Use ${params.selectedWeeks} weeks anyway` : `Brug ${params.selectedWeeks} uger alligevel`,
            }
          : null,
    };
  }

  return {
    isRecommended: false,
    note:
      diff === 1
        ? locale === "en"
          ? "That gives the plan a little more room and a calmer buildup than recommended."
          : "Det giver lidt mere luft i planen og en roligere opbygning end anbefalingen."
        : locale === "en"
          ? `That gives the plan ${diff} ${weekLabel(diff, locale)} of extra room and a calmer buildup than recommended.`
          : `Det giver ${diff} ${weekLabel(diff, locale)} mere luft i planen og en roligere opbygning end anbefalingen.`,
    overridePrompt:
      diff >= 2 || outsideRealisticSpan
        ? {
            overrideKey: `${params.goal.distance}|${params.recommendedWeeks}|${params.selectedWeeks}`,
            title: locale === "en" ? `${params.selectedWeeks} weeks is longer than my recommendation` : `${params.selectedWeeks} uger er længere end min anbefaling`,
            body: locale === "en"
              ? `StridePilot recommends ${params.recommendedWeeks} weeks here because it is the most precise and realistic path from your current level. A longer timeline can still work, but it changes the rhythm and makes the plan calmer than I actually consider necessary.`
              : `StridePilot anbefaler ${params.recommendedWeeks} uger her, fordi det er den mest præcise og realistiske vej fra dit nuværende niveau. En længere tidslinje kan stadig fungere, men den ændrer rytmen og gør planen roligere end det, jeg egentlig vurderer som nødvendigt.`,
            confirmLabel: locale === "en" ? `Use ${params.selectedWeeks} weeks anyway` : `Brug ${params.selectedWeeks} uger alligevel`,
          }
        : null,
  };
}

export function applyDurationToRecommendationOption(params: {
  goal: Goal;
  option: PlanRecommendationOption;
  recommendedWeeks: number;
  selectedWeeks: number;
  realisticMinWeeks?: number;
  realisticMaxWeeks?: number;
  locale?: SiteLocale;
}): PlanRecommendationOption {
  const adjustmentState = buildDurationAdjustmentState({
    goal: params.goal,
    recommendedWeeks: params.recommendedWeeks,
    selectedWeeks: params.selectedWeeks,
    realisticMinWeeks: params.realisticMinWeeks,
    realisticMaxWeeks: params.realisticMaxWeeks,
    locale: params.locale,
  });
  const locale = params.locale ?? "da";
  const diff = params.selectedWeeks - params.recommendedWeeks;
  const summary =
    diff === 0
      ? params.option.summary
      : diff < 0
        ? locale === "en"
          ? `You chose ${params.selectedWeeks} weeks instead of the recommended ${params.recommendedWeeks}. That makes the plan more compressed and leaves less room for adjustments along the way.`
          : `Du har valgt ${params.selectedWeeks} uger i stedet for de anbefalede ${params.recommendedWeeks}. Det gør planen mere komprimeret og kræver mindre plads til tilpasninger undervejs.`
        : locale === "en"
          ? `You chose ${params.selectedWeeks} weeks instead of the recommended ${params.recommendedWeeks}. That gives the plan a little more room and a calmer buildup.`
          : `Du har valgt ${params.selectedWeeks} uger i stedet for de anbefalede ${params.recommendedWeeks}. Det giver planen lidt mere luft og en roligere opbygning.`;
  return {
    ...params.option,
    durationWeeks: params.selectedWeeks,
    goalDate: addWeeksToIsoDate(params.goal.startDate, params.selectedWeeks),
    summary,
    warnings: adjustmentState.overridePrompt && diff < 0 ? [adjustmentState.overridePrompt.body] : [],
    planLevel: durationPlanLevel(params.selectedWeeks, params.recommendedWeeks),
    planLevelLabel: durationPlanLevelLabel(params.selectedWeeks, params.recommendedWeeks, locale),
    planLevelExplanation: durationPlanLevelExplanation(params.selectedWeeks, params.recommendedWeeks, locale),
    wasAdjusted: diff !== 0,
    adjustmentMessage: adjustmentState.note ?? undefined,
  };
}

export function getOnboardingStepDefinition(stepIndex: number, locale: SiteLocale = "da"): OnboardingStepDefinition {
  const steps = locale === "en" ? ONBOARDING_STEPS_EN : ONBOARDING_STEPS;
  return steps.find((step) => step.index === stepIndex) ?? steps[0];
}

export function inferOnboardingTrackFromProfile(params: {
  currentRunsPerWeek?: number;
  runningExperience?: "nybegynder" | "let_ovet" | "ovet";
  currentRunningAbility?: CurrentRunningAbility;
  contextText?: string;
}): OnboardingTrack {
  const context = params.contextText?.toLowerCase() ?? "";
  if (/tilbage|comeback|igen|efter pause/.test(context)) return "returning";
  if (params.runningExperience === "ovet" || (params.currentRunsPerWeek ?? 0) >= 3) return "goal_focused";
  if (params.currentRunningAbility === "tyve_tredive_min" || params.currentRunningAbility === "mere_end_tredive_min") {
    return "running_consistently";
  }
  return "getting_started";
}

export function trackCapacityHint(track?: OnboardingTrack, locale: SiteLocale = "da"): string {
  if (locale === "en") {
    if (track === "returning") return "Start from what feels realistic after the break, not from your old peak level.";
    if (track === "running_consistently") return "Use the distance you can run in an ordinary week right now.";
    if (track === "goal_focused") return "Use your current stable distance so the plan does not start far below your level.";
    return "An estimate is enough. I use it to set a calm and credible starting point.";
  }
  if (track === "returning") return "Tag udgangspunkt i det, der føles realistisk efter pausen, ikke dit gamle topniveau.";
  if (track === "running_consistently") return "Brug den distance, du kan løbe på en almindelig uge lige nu.";
  if (track === "goal_focused") return "Brug din nuværende stabile distance, så planen ikke starter langt under dit niveau.";
  return "Et skøn er fint. Jeg bruger det til at ramme en rolig og troværdig start.";
}

export function parseCurrentCapacityDistanceKm(value?: string): number | null {
  if (!value) return null;
  const normalized = value.trim().replace(",", ".");
  if (!/^\d{1,2}(\.\d)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0.5 || parsed > 30) return null;
  return Number(parsed.toFixed(1));
}

export function inferAbilityFromCapacityDistance(distanceKm: number): CurrentRunningAbility {
  if (distanceKm < 0.8) return "fem_min";
  if (distanceKm < 2.5) return "ti_femten_min";
  if (distanceKm < 5) return "tyve_tredive_min";
  return "mere_end_tredive_min";
}

function continuousMinutesFromDistance(distanceKm: number): number {
  return Math.round(distanceKm * 6.25);
}

export function deriveBaselineLoadFromCapacity(distanceKm: number, currentRunsPerWeek: number): {
  currentRunningAbility: CurrentRunningAbility;
  runningExperience: "nybegynder" | "let_ovet" | "ovet";
  currentWeeklyVolumeKm: number;
  currentRunsPerWeek: number;
  longestCurrentRunMin: number;
} {
  const safeRuns = Math.max(0, Math.min(5, Math.round(currentRunsPerWeek)));
  const ability = inferAbilityFromCapacityDistance(distanceKm);
  const longestCurrentRunMin = Math.max(5, continuousMinutesFromDistance(distanceKm));
  const weeklyVolumeKm =
    safeRuns <= 0
      ? Math.max(1, Number((distanceKm * 1.4).toFixed(1)))
      : Number((Math.max(distanceKm, distanceKm * safeRuns * 0.82)).toFixed(1));

  return {
    currentRunningAbility: ability,
    runningExperience: mapAbilityToRunningExperience(ability),
    currentWeeklyVolumeKm: weeklyVolumeKm,
    currentRunsPerWeek: safeRuns,
    longestCurrentRunMin,
  };
}

export function shouldRequireLowFrequencyOverride(goal: Goal): boolean {
  const selectedDays = goal.availableTrainingDays?.length ?? 0;
  if (selectedDays > 2) return false;
  return goal.distance === "Halvmaraton" || goal.distance === "Marathon";
}

export function buildLowFrequencyOverridePrompt(goal: Goal, locale: SiteLocale = "da"): {
  overrideKey: string;
  title: string;
  body: string;
  confirmLabel: string;
} | null {
  if (!shouldRequireLowFrequencyOverride(goal)) return null;
  const goalLabel = locale === "en"
    ? goal.distance === "Halvmaraton"
      ? "half marathon"
      : "marathon"
    : goal.distance === "Halvmaraton"
      ? "halvmaraton"
      : "maraton";
  return {
    overrideKey: `${goal.distance}|${goal.goalType ?? "complete"}|${goal.availableTrainingDays?.length ?? 0}`,
    title: locale === "en" ? `Two runs per week is low for a ${goalLabel}` : `To pas om ugen er lavt til ${goalLabel}`,
    body: locale === "en"
      ? `StridePilot normally recommends more rhythm for a ${goalLabel}, because two weekly runs give less robustness, less training quality, and a greater risk that the goal will feel unrealistic. You can still continue if that is the structure you want to keep.`
      : `StridePilot anbefaler normalt mere rytme til ${goalLabel}, fordi to ugentlige pas giver mindre robusthed, mindre træningskvalitet og en større risiko for at målet føles urealistisk. Du kan stadig fortsætte, hvis det er de rammer, du vil holde fast i.`,
    confirmLabel: locale === "en" ? "Continue with 2 runs per week" : "Fortsæt med 2 pas om ugen",
  };
}

export function getGoalTypeOptions(
  distance: GoalDistance,
  ability: CurrentRunningAbility,
  locale: SiteLocale = "da",
): Array<{ value: GoalType; label: string }> {
  const abilityRank = ABILITY_RANK[ability];
  const options: GoalType[] = ["complete"];

  if ((distance === "5K" || distance === "10K") && abilityRank < 4) {
    options.push("run_without_walking");
  }

  const targetTimeThreshold: Record<GoalDistance, number> = {
    "5K": 1,
    "10K": 2,
    Halvmaraton: 3,
    Marathon: 4,
  };

  const prThreshold: Record<GoalDistance, number> = {
    "5K": 2,
    "10K": 3,
    Halvmaraton: 4,
    Marathon: 4,
  };

  if (abilityRank >= targetTimeThreshold[distance]) {
    options.push("target_time");
  }

  if (abilityRank >= prThreshold[distance]) {
    options.push("pr");
  }

  const labels = locale === "en" ? GOAL_TYPE_LABELS_EN : GOAL_TYPE_LABELS;
  return options.map((value) => ({ value, label: labels[value] }));
}

export function isGoalTypeAllowed(distance: GoalDistance, ability: CurrentRunningAbility, goalType?: GoalType): boolean {
  if (!goalType) return false;
  return getGoalTypeOptions(distance, ability).some((option) => option.value === goalType);
}

export function mapAbilityToRunningExperience(ability: CurrentRunningAbility): "nybegynder" | "let_ovet" | "ovet" {
  if (ability === "mere_end_tredive_min") return "ovet";
  if (ability === "tyve_tredive_min" || ability === "ti_femten_min") return "let_ovet";
  return "nybegynder";
}

export function deriveBaselineLoadFromAbility(ability: CurrentRunningAbility): {
  currentWeeklyVolumeKm: number;
  currentRunsPerWeek: number;
  longestCurrentRunMin: number;
} {
  switch (ability) {
    case "helt_ny":
      return { currentWeeklyVolumeKm: 0, currentRunsPerWeek: 0, longestCurrentRunMin: 0 };
    case "fem_min":
      return { currentWeeklyVolumeKm: 4, currentRunsPerWeek: 2, longestCurrentRunMin: 8 };
    case "ti_femten_min":
      return { currentWeeklyVolumeKm: 8, currentRunsPerWeek: 2, longestCurrentRunMin: 15 };
    case "tyve_tredive_min":
      return { currentWeeklyVolumeKm: 14, currentRunsPerWeek: 3, longestCurrentRunMin: 30 };
    case "mere_end_tredive_min":
      return { currentWeeklyVolumeKm: 22, currentRunsPerWeek: 3, longestCurrentRunMin: 45 };
  }
}

export function hasRecentRaceEntry(recentRaceTimes?: RecentRaceTime[]): boolean {
  return Boolean(recentRaceTimes?.[0]?.distance && recentRaceTimes?.[0]?.time);
}

export function recentRaceDraftFromEntries(recentRaceTimes?: RecentRaceTime[]): RecentRaceDraft {
  const firstEntry = recentRaceTimes?.[0];
  return firstEntry
    ? { distance: firstEntry.distance, time: firstEntry.time }
    : { distance: "", time: "" };
}

function clampPickerPart(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(value)));
}

export function isCompleteRecentRaceTime(value: string): boolean {
  return /^\d{1,2}:\d{2}(?::\d{2})?$/.test(value.trim());
}

export function recentRaceTimePartsFromString(value?: string): RecentRaceTimeParts {
  if (!value || !isCompleteRecentRaceTime(value)) {
    return { hours: 0, minutes: 0, seconds: 0 };
  }

  const parts = value.split(":").map((part) => Number(part));
  if (parts.length === 2) {
    return {
      hours: 0,
      minutes: clampPickerPart(parts[0] ?? 0, 0, 59),
      seconds: clampPickerPart(parts[1] ?? 0, 0, 59),
    };
  }

  return {
    hours: clampPickerPart(parts[0] ?? 0, 0, 9),
    minutes: clampPickerPart(parts[1] ?? 0, 0, 59),
    seconds: clampPickerPart(parts[2] ?? 0, 0, 59),
  };
}

export function buildRecentRaceTimeFromParts(parts: RecentRaceTimeParts): string {
  const hours = clampPickerPart(parts.hours, 0, 9);
  const minutes = clampPickerPart(parts.minutes, 0, 59);
  const seconds = clampPickerPart(parts.seconds, 0, 59);

  if (hours === 0 && minutes === 0 && seconds === 0) return "";
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function buildRecentRaceTimes(distance: GoalDistance | "", time: string): RecentRaceTime[] {
  const normalizedTime = buildRecentRaceTimeFromParts(recentRaceTimePartsFromString(time));
  return distance && isCompleteRecentRaceTime(normalizedTime) ? [{ distance, time: normalizedTime }] : [];
}

export function recentRaceSummaryLabel(recentRaceTimes?: RecentRaceTime[], locale: SiteLocale = "da"): string | null {
  const firstEntry = recentRaceTimes?.[0];
  if (!firstEntry?.distance || !firstEntry.time) return null;
  const distanceLabel =
    firstEntry.distance === "Halvmaraton"
      ? locale === "en"
        ? "Half marathon"
        : "Halvmaraton"
      : firstEntry.distance === "Marathon"
        ? locale === "en"
          ? "Marathon"
          : "Maraton"
        : firstEntry.distance;
  return `${distanceLabel} · ${firstEntry.time}`;
}

export function recentRaceDraftSummaryLabel(draft: RecentRaceDraft, locale: SiteLocale = "da"): string | null {
  return recentRaceSummaryLabel(buildRecentRaceTimes(draft.distance, draft.time), locale);
}
