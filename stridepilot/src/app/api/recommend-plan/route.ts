import { NextResponse } from "next/server";
import { buildEngineV2RunnerInput } from "@/lib/engine-v2/appAdapter";
import { buildTimelineRecommendation, classifyRunner } from "@/lib/engine-v2";
import type { Goal, PlanAmbition, PlanRecommendation, PlanRecommendationOption, RecommendationPlanLevel, RunnerProfile } from "@/lib/types";

function addWeeksToIsoDate(startDate: string, weeks: number): string {
  const date = new Date(startDate);
  date.setDate(date.getDate() + weeks * 7);
  return date.toISOString().slice(0, 10);
}

function optionLabel(mode: PlanAmbition): string {
  if (mode === "gentle") return "Rolig vej";
  if (mode === "ambitious") return "Ambitiøs vej";
  return "Anbefalet vej";
}

function goalSummaryText(goal: Goal): string {
  if (goal.goalType === "run_without_walking") return `løbe ${goal.distance.toLowerCase()} uden stop`;
  if (goal.goalType === "target_time" || goal.goalType === "pr") return `forbedre dig på ${goal.distance.toLowerCase()}`;
  return `gennemføre ${goal.distance.toLowerCase()}`;
}

function planLevelForOption(option: PlanRecommendationOption, recommendedOption: PlanRecommendationOption): RecommendationPlanLevel {
  if (option.durationWeeks >= recommendedOption.durationWeeks + 2) {
    return option.durationWeeks >= recommendedOption.durationWeeks + 2 ? "very_easy" : "easy";
  }
  if (option.durationWeeks > recommendedOption.durationWeeks) return "easy";
  if (option.durationWeeks <= recommendedOption.durationWeeks - 2) {
    return "ambitious";
  }
  if (option.durationWeeks < recommendedOption.durationWeeks) return "slightly_ambitious";
  return "realistic";
}

function planLevelLabel(level: RecommendationPlanLevel): string {
  if (level === "very_easy") return "Meget rolig";
  if (level === "easy") return "Rolig";
  if (level === "slightly_ambitious") return "Lidt ambitiøs";
  if (level === "ambitious") return "Ambitiøs";
  return "Realistisk";
}

function planLevelExplanation(level: RecommendationPlanLevel): string {
  if (level === "very_easy") return "Planen er lagt ekstra roligt op, så du får mere plads til vaneopbygning, stabilitet og restitution.";
  if (level === "easy") return "Planen er lidt roligere end standardvejen og giver lidt mere plads til at bygge sikkert og stabilt op.";
  if (level === "slightly_ambitious") return "Planen er lidt mere ambitiøs end anbefalingen og kræver, at træningen glider forholdsvis stabilt uge for uge.";
  if (level === "ambitious") return "Planen er tydeligt mere ambitiøs end anbefalingen og kræver en stabil gennemførelse uge for uge.";
  return "Planen er realistisk i forhold til dit nuværende niveau og din træningsrytme.";
}

function optionWasAdjusted(option: PlanRecommendationOption, recommendedOption: PlanRecommendationOption): boolean {
  if (option.mode === "ambitious") return option.durationWeeks >= recommendedOption.durationWeeks;
  if (option.mode === "gentle") return option.durationWeeks <= recommendedOption.durationWeeks;
  return false;
}

function buildAdjustmentMessage(option: PlanRecommendationOption, recommendedOption: PlanRecommendationOption): string | undefined {
  if (!optionWasAdjusted(option, recommendedOption)) return undefined;
  if (option.mode === "ambitious") {
    return "StridePilot har justeret den ambitiøse vej, så den holder sig inden for et realistisk og forsvarligt niveau.";
  }
  if (option.mode === "gentle") {
    return "StridePilot har justeret den rolige vej, så den stadig passer til dine nuværende rammer.";
  }
  return "StridePilot har justeret planen, så den holder sig inden for et realistisk og forsvarligt niveau.";
}

function optionHeadline(mode: PlanAmbition): string {
  if (mode === "gentle") return "Du ser den rolige vej";
  if (mode === "ambitious") return "Du ser den ambitiøse vej";
  return "StridePilot anbefaler denne vej";
}

function effectiveSessionsPerWeek(goal: Goal, value: number): number {
  const selectedDays = goal.availableTrainingDays?.length ?? value;
  return Math.max(1, Math.min(value, selectedDays));
}

function optionSummary(goal: Goal, option: PlanRecommendationOption, recommendedOption: PlanRecommendationOption): string {
  const selectedDays = goal.availableTrainingDays?.length ?? option.sessionsPerWeek;
  const startSessions = Math.min(selectedDays, Math.max(1, option.sessionsPerWeek - 1));
  const frequencyText =
    startSessions === option.sessionsPerWeek
      ? `Forløbet holder sig til ${option.sessionsPerWeek} pas om ugen, fordi det er den rytme du har valgt.`
      : `Forløbet starter med ${startSessions} pas om ugen og bygger roligt op til ${option.sessionsPerWeek}.`;
  const base = `Baseret på dit nuværende niveau anbefaler StridePilot ${option.durationWeeks} uger for at hjælpe dig med at ${goalSummaryText(goal)}. ${frequencyText}`;
  if (option.mode === "gentle") {
    return `${base} Det giver lidt mere plads til ro, vaneopbygning og stabil progression end den anbefalede standardvej.`;
  }
  if (option.mode === "ambitious") {
    if (option.durationWeeks < recommendedOption.durationWeeks) {
      return `${base} Det er en kortere og mere ambitiøs vej end standardanbefalingen, så StridePilot holder ekstra øje med realismen.`;
    }
    return `${base} Det er den mest ambitiøse vej, StridePilot vurderer som forsvarlig ud fra dit niveau lige nu.`;
  }
  return `${base} Det er den vej, StridePilot vurderer som den mest realistiske og bæredygtige start.`;
}

function optionRealism(option: PlanRecommendationOption, recommendedOption: PlanRecommendationOption): PlanRecommendationOption["realism"] {
  if (optionWasAdjusted(option, recommendedOption)) return "capped";
  if (option.durationWeeks < recommendedOption.durationWeeks) return "stretch";
  if (option.durationWeeks > recommendedOption.durationWeeks) return "realistic";
  return "high_confidence";
}

function optionWarnings(option: PlanRecommendationOption, recommendedOption: PlanRecommendationOption): string[] {
  if (option.mode === "ambitious" && option.durationWeeks < recommendedOption.durationWeeks) {
    return ["Den valgte tidslinje er kortere end StridePilots anbefalede vej og kan føles mere komprimeret end ideelt."];
  }
  return [];
}

function optionProgressionMode(mode: PlanAmbition, recommendedMode: PlanRecommendation["progressionMode"]): PlanRecommendationOption["progressionMode"] {
  if (mode === "gentle") return "conservative";
  if (mode === "ambitious") return "ambitious";
  return recommendedMode;
}

function buildResolvedOption(params: {
  mode: PlanAmbition;
  durationWeeks: number;
  goal: Goal;
  recommendedOption: PlanRecommendationOption;
  sessionsPerWeek: number;
  progressionMode: PlanRecommendation["progressionMode"];
}): PlanRecommendationOption {
  const { mode, durationWeeks, goal, recommendedOption, sessionsPerWeek, progressionMode } = params;
  const goalDate = addWeeksToIsoDate(goal.startDate, durationWeeks);
  const baseOption: PlanRecommendationOption = {
    mode,
    label: optionLabel(mode),
    durationWeeks,
    goalDate,
    sessionsPerWeek,
    progressionMode: optionProgressionMode(mode, progressionMode),
    realism: "high_confidence",
    warnings: [],
    headline: "",
    summary: "",
    planLevel: "realistic",
    planLevelLabel: "",
    planLevelExplanation: "",
    wasAdjusted: false,
  };
  const warnings = optionWarnings(baseOption, recommendedOption);
  const realism = optionRealism({ ...baseOption, warnings }, recommendedOption);
  const planLevel = planLevelForOption(baseOption, recommendedOption);
  const wasAdjusted = optionWasAdjusted(baseOption, recommendedOption);
  return {
    ...baseOption,
    realism,
    warnings,
    headline: optionHeadline(mode),
    summary: optionSummary(goal, { ...baseOption, warnings }, recommendedOption),
    planLevel,
    planLevelLabel: planLevelLabel(planLevel),
    planLevelExplanation: planLevelExplanation(planLevel),
    wasAdjusted,
    adjustmentMessage: buildAdjustmentMessage(baseOption, recommendedOption),
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      runnerProfile: RunnerProfile;
      goal: Goal;
      ambition?: PlanAmbition;
    };
    const { runnerProfile, goal } = body;
    const selectedAmbition = body.ambition ?? "standard";
    const standardInput = buildEngineV2RunnerInput({ runnerProfile, goal, ambition: "standard" });
    const classification = classifyRunner(standardInput);
    const { recommendation } = buildTimelineRecommendation(standardInput, classification);
    const coachRecommendedWeeks = recommendation.recommendedDurationWeeks;
    const minimumWeeks = recommendation.feasibleDurationRangeWeeks.minimum;
    const maximumWeeks = recommendation.feasibleDurationRangeWeeks.maximum;
    const sessionsPerWeek = effectiveSessionsPerWeek(goal, recommendation.recommendedSessionsPerWeek);
    const startingSessionsPerWeek = effectiveSessionsPerWeek(goal, recommendation.startingSessionsPerWeek);
    const peakSessionsPerWeek = effectiveSessionsPerWeek(goal, recommendation.peakSessionsPerWeek);
    const standardProgressionMode = recommendation.recommendedProgressionMode;

    const recommendedOption: PlanRecommendationOption = {
      mode: "standard",
      label: optionLabel("standard"),
      durationWeeks: coachRecommendedWeeks,
      goalDate: recommendation.recommendedGoalDate,
      sessionsPerWeek,
      progressionMode: standardProgressionMode,
      realism: "high_confidence",
      warnings: [],
      headline: "",
      summary: "",
      planLevel: "realistic",
      planLevelLabel: "",
      planLevelExplanation: "",
      wasAdjusted: false,
    };

    const options: PlanRecommendationOption[] = [
      buildResolvedOption({
        mode: "gentle",
        durationWeeks: maximumWeeks,
        goal,
        recommendedOption,
        sessionsPerWeek,
        progressionMode: standardProgressionMode,
      }),
      buildResolvedOption({
        mode: "standard",
        durationWeeks: coachRecommendedWeeks,
        goal,
        recommendedOption,
        sessionsPerWeek,
        progressionMode: standardProgressionMode,
      }),
      buildResolvedOption({
        mode: "ambitious",
        durationWeeks: minimumWeeks,
        goal,
        recommendedOption,
        sessionsPerWeek,
        progressionMode: standardProgressionMode,
      }),
    ];

    const selectedOption = options.find((option) => option.mode === selectedAmbition) ?? options[1];

    const response: PlanRecommendation = {
      recommendedDurationWeeks: coachRecommendedWeeks,
      minDurationWeeks: minimumWeeks,
      maxDurationWeeks: maximumWeeks,
      recommendedSessionsPerWeek: sessionsPerWeek,
      startingSessionsPerWeek,
      peakSessionsPerWeek,
      progressionMode: selectedOption.progressionMode,
      realism: selectedOption.realism,
      warnings: selectedOption.warnings,
      headline: selectedOption.headline,
      summary: selectedOption.summary,
      rationaleTags: [
        runnerProfile.currentRunningAbility,
        goal.distance,
        goal.goalType ?? "complete",
        selectedOption.progressionMode,
      ],
      recommendedOption: options[1],
      selectedPathVariant: selectedOption.mode,
      selectedOption,
      options,
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ message: "Kunne ikke bygge en anbefaling lige nu." }, { status: 400 });
  }
}
