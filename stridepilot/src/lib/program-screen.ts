import { PlanHistorySummary, SavedPlanAdaptation, SavedWorkoutSessionFeedback, TrainingPlan, WorkoutSession } from "@/lib/types";
import { formatReadableDurationFromSeconds } from "./duration";
import { SiteLocale } from "./site-variant";

export type ProgramSectionId =
  | "today_action"
  | "next_workout"
  | "progression_overview"
  | "more_details";

export const PROGRAM_SCREEN_SECTION_ORDER: ProgramSectionId[] = [
  "today_action",
  "next_workout",
  "progression_overview",
  "more_details",
];

export type ProgramDayVisualState = "rest" | "planned" | "completed";

export type ProgramAdjustmentStateKind = "none" | "holding" | "conservative" | "meaningful";
export type ProgramInsightReadiness = "early" | "building" | "ready";
export type ProgramAdjustmentToneAppearance = "neutral" | "steady" | "protective" | "adaptive";
export type TodayActionMode = "training_day" | "rest_day_with_next" | "rest_day_empty";

export function buildWeekOverviewAction(params: {
  displayWeek: number;
  nextSessionWeek?: number | null;
  showProgramMore: boolean;
}): {
  targetWeek: number;
  shouldExpand: boolean;
  shouldFocusNextWorkout: boolean;
} {
  return {
    targetWeek: params.nextSessionWeek ?? params.displayWeek,
    shouldExpand: !params.showProgramMore,
    shouldFocusNextWorkout: Boolean(params.nextSessionWeek),
  };
}

export function buildProgramStatusLine(params: {
  distance: string;
  goalDateLabel?: string | null;
  displayWeek: number;
  totalWeeks: number;
  locale?: SiteLocale;
}): string {
  const datePart = params.goalDateLabel ? ` · ${params.goalDateLabel}` : "";
  return params.locale === "en"
    ? `${params.distance}${datePart} · week ${params.displayWeek} of ${params.totalWeeks}`
    : `${params.distance}${datePart} · uge ${params.displayWeek} af ${params.totalWeeks}`;
}

export function buildNextWorkoutState(params: {
  nextSession?: WorkoutSession | null;
  dateLabel?: string | null;
  durationMin?: number | null;
  locale?: SiteLocale;
}): {
  visible: boolean;
  title: string;
  meta?: string;
} {
  if (!params.nextSession) {
    return {
      visible: false,
      title: params.locale === "en" ? "No upcoming workouts yet" : "Ingen kommende pas endnu",
    };
  }

  const durationPart = params.durationMin ? formatReadableDurationFromSeconds(params.durationMin * 60) : null;
  const datePart = params.dateLabel ?? null;

  return {
    visible: true,
    title: translateVisibleSessionTitle(params.nextSession.title, params.locale),
    meta: [durationPart, datePart].filter(Boolean).join(" · "),
  };
}

export function isGoalEventSession(session?: Pick<WorkoutSession, "title" | "notes"> | null): boolean {
  if (!session) return false;
  return /måldag/i.test(`${session.title} ${session.notes ?? ""}`);
}

export function goalEventDistanceLabel(distance: string, locale: SiteLocale = "da"): string {
  if (distance === "5K") return "5 km";
  if (distance === "10K") return "10 km";
  if (distance === "Halvmaraton") return locale === "en" ? "21.1 km" : "21,1 km";
  if (distance === "Marathon") return locale === "en" ? "42.2 km" : "42,2 km";
  return distance;
}

export function buildGoalEventSessionLabel(session: Pick<WorkoutSession, "title" | "notes"> | null | undefined, goalDistance: string, locale: SiteLocale = "da"): string {
  if (!isGoalEventSession(session)) return session?.title ?? "";
  return `${goalEventDistanceLabel(goalDistance, locale)} ${locale === "en" ? "race day" : "måldag"}`;
}

export function translateVisibleSessionTitle(title: string, locale: SiteLocale = "da"): string {
  const base = title.replace(/^Uge \d+\s*-\s*/i, "").trim();
  if (locale !== "en") return base;
  const map: Record<string, string> = {
    "Kom roligt i gang": "Ease in",
    "Roligt løb": "Easy run",
    "Rolig tur": "Easy run",
    "Recovery-pas": "Recovery run",
    "Langt roligt pas": "Long easy run",
    "Progressionspas": "Progression run",
    "Steady-pas": "Steady run",
    "Tempopas": "Tempo run",
    "Intervalpas": "Intervals",
    "Lang tur": "Long run",
    "Ro": "Rest",
  };
  return map[base] ?? base
    .replace(/^Halvmaraton måldag$/i, "21.1 km race day")
    .replace(/^Maraton måldag$/i, "42.2 km race day")
    .replace(/^5 km måldag$/i, "5 km race day")
    .replace(/^10 km måldag$/i, "10 km race day");
}

export function findRelevantNextSession(params: {
  sessions: Array<{ session: WorkoutSession; date: Date }>;
  activeWeek?: number | null;
  today?: Date;
}): WorkoutSession | null {
  const today = new Date(params.today ?? new Date());
  today.setHours(0, 0, 0, 0);
  const sorted = [...params.sessions].sort((a, b) => a.date.getTime() - b.date.getTime());
  if (sorted.length === 0) return null;

  const minimumRelevantWeek = Math.max(params.activeWeek ?? 1, 1);
  const relevantSessions = sorted.filter((entry) => entry.session.week >= minimumRelevantWeek);
  const relevantUpcoming = relevantSessions.find((entry) => entry.date.getTime() >= today.getTime());
  if (relevantUpcoming) return relevantUpcoming.session;

  if (relevantSessions.length > 0) return relevantSessions[0]?.session ?? null;
  return sorted.find((entry) => entry.date.getTime() >= today.getTime())?.session ?? null;
}

export function buildTodayActionState(params: {
  todaySession?: WorkoutSession | null;
  nextSession?: WorkoutSession | null;
  locale?: SiteLocale;
}): {
  mode: TodayActionMode;
  label: string;
  emptyTitle?: string;
  description?: string;
  support?: string;
  ctaLabel?: string;
} {
  if (params.todaySession) {
    return {
      mode: "training_day",
      label: params.locale === "en" ? "Today's workout" : "Dagens træning",
      description: params.locale === "en" ? "This is the main session that matters today." : "Det er det vigtigste pas i dag.",
      support: params.locale === "en"
        ? "You do not need more right now than showing up and taking the first part calmly."
        : "Du behøver ikke mere lige nu end at møde op og tage første del roligt.",
      ctaLabel: params.locale === "en" ? "Start workout" : "Start pas",
    };
  }

  if (params.nextSession) {
    return {
      mode: "rest_day_with_next",
      label: params.locale === "en" ? "Today" : "I dag",
      emptyTitle: params.locale === "en" ? "Calm day" : "Rolig dag",
      description: params.locale === "en" ? "No run today." : "Ingen løbetur i dag.",
      support: params.locale === "en"
        ? "Let the day stay light, and only look ahead to the next planned session if you want the overview."
        : "Lad dagen være let, og kig kun frem mod næste planlagte pas, hvis du har brug for overblikket.",
      ctaLabel: params.locale === "en" ? "See week plan" : "Se ugeplan",
    };
  }

  return {
    mode: "rest_day_empty",
    label: params.locale === "en" ? "Today" : "I dag",
    emptyTitle: params.locale === "en" ? "Calm day" : "Rolig dag",
    description: params.locale === "en" ? "No run today." : "Ingen løbetur i dag.",
    support: params.locale === "en"
      ? "Use the day for recovery and get a quick overview of the week if you want."
      : "Brug dagen til ro og få et hurtigt overblik over ugen, hvis du vil.",
    ctaLabel: params.locale === "en" ? "See this week" : "Se denne uge",
  };
}

export function getProgramDayVisualState(session: WorkoutSession | undefined, feedback: SavedWorkoutSessionFeedback | null): ProgramDayVisualState {
  if (!session) return "rest";
  return feedback ? "completed" : "planned";
}

export function shouldHighlightNextWorkout(session: WorkoutSession | undefined, nextSessionId: string | null): boolean {
  if (!session || !nextSessionId) return false;
  return session.id === nextSessionId;
}

export function getAdjustmentToneAppearance(kind: ProgramAdjustmentStateKind): ProgramAdjustmentToneAppearance {
  switch (kind) {
    case "holding":
      return "steady";
    case "conservative":
      return "protective";
    case "meaningful":
      return "adaptive";
    case "none":
    default:
      return "neutral";
  }
}

function normalizeHighlight(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,:;!?]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function pushUniqueHighlight(target: string[], seen: Set<string>, value: string) {
  const cleaned = value.trim();
  if (!cleaned) return;
  const key = normalizeHighlight(cleaned);
  if (seen.has(key)) return;
  seen.add(key);
  target.push(cleaned);
}

function summarizeAdaptationMode(mode: SavedPlanAdaptation["mode"], locale: SiteLocale = "da"): {
  kind: ProgramAdjustmentStateKind;
  label: string;
  headline: string;
  summary: string;
  practicalConsequence: string;
} {
  if (mode === "hold") {
    return {
      kind: "holding",
      label: locale === "en" ? "Holding steady" : "Gentager roligt",
      headline: locale === "en" ? "I am repeating this week" : "Jeg gentager denne uge",
      summary: locale === "en" ? "Your recent signals suggest the rhythm will benefit from settling a little better before progression continues." : "De seneste signaler peger på, at rytmen har bedst af at lande lidt bedre, før progressionen fortsætter.",
      practicalConsequence: locale === "en" ? "You keep the same overall structure for one more week." : "Du fortsætter med samme struktur én uge mere.",
    };
  }
  if (mode === "down_shift") {
    return {
      kind: "conservative",
      label: locale === "en" ? "A little lighter" : "Lidt lettere",
      headline: locale === "en" ? "Next week gets lighter" : "Næste uge bliver lettere",
      summary: locale === "en" ? "Your recent signals suggest the load should come down a notch so the plan stays realistic and robust." : "De seneste signaler tyder på, at belastningen skal ned et trin, så planen forbliver realistisk og robust.",
      practicalConsequence: locale === "en" ? "Next week gets lighter before we build again." : "Næste uge bliver lettere, før vi bygger videre igen.",
    };
  }
  if (mode === "recovery_microcycle") {
    return {
      kind: "conservative",
      label: locale === "en" ? "Recovery week" : "Recovery-uge",
      headline: locale === "en" ? "I am placing a short recovery week here" : "Jeg lægger en kort recovery-uge ind",
      summary: locale === "en" ? "Your recent signals call for a little more room so the body can absorb the work without losing direction." : "De seneste signaler kalder på lidt mere luft, så kroppen kan absorbere arbejdet uden at miste retningen.",
      practicalConsequence: locale === "en" ? "I am holding progression back a little so the plan stays robust." : "Jeg holder progressionen lidt tilbage, så planen forbliver robust.",
    };
  }
  if (mode === "resume_build") {
    return {
      kind: "meaningful",
      label: locale === "en" ? "Building again" : "Bygger videre",
      headline: locale === "en" ? "The plan is building calmly again" : "Planen bygger roligt videre",
      summary: locale === "en" ? "Your recent signals look stable enough for a return to normal progression." : "De seneste signaler ser stabile nok ud til, at vi kan vende tilbage til normal progression.",
      practicalConsequence: locale === "en" ? "You move into the next block without having to catch anything up first." : "Du går videre til næste blok uden at skulle indhente noget først.",
    };
  }
  return {
    kind: "meaningful",
    label: locale === "en" ? "Adjusted" : "Tilpasset",
    headline: locale === "en" ? "The plan continues calmly as intended" : "Planen fortsætter roligt som planlagt",
    summary: locale === "en" ? "Your recent signals do not call for a bigger change right now." : "De seneste signaler kalder ikke på en større ændring lige nu.",
    practicalConsequence: locale === "en" ? "You follow the next part as planned and let progression keep doing its work." : "Du følger næste del som planlagt og lader progressionen arbejde videre.",
  };
}

function formatTimelineDate(value: string, locale: SiteLocale = "da"): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString(locale === "en" ? "en-GB" : "da-DK", {
    day: "numeric",
    month: "short",
  });
}

function buildTimelineNote(params: {
  previousGoalDate?: string | null;
  currentGoalDate?: string | null;
  previousTotalWeeks?: number | null;
  currentTotalWeeks?: number | null;
  locale?: SiteLocale;
}): string {
  const locale = params.locale ?? "da";
  if (
    params.previousGoalDate &&
    params.currentGoalDate &&
    params.previousGoalDate !== params.currentGoalDate
  ) {
    return locale === "en"
      ? `Your goal date moved to ${formatTimelineDate(params.currentGoalDate, locale)}.`
      : `Måldatoen er flyttet til ${formatTimelineDate(params.currentGoalDate, locale)}.`;
  }

  const previousWeeks = params.previousTotalWeeks ?? null;
  const currentWeeks = params.currentTotalWeeks ?? null;
  if (previousWeeks && currentWeeks && previousWeeks !== currentWeeks) {
    const delta = currentWeeks - previousWeeks;
    const weekLabel = locale === "en" ? (Math.abs(delta) === 1 ? "week" : "weeks") : Math.abs(delta) === 1 ? "uge" : "uger";
    if (delta > 0) {
      return locale === "en" ? `The plan has been extended by ${delta} ${weekLabel}.` : `Planen er forlænget med ${delta} ${weekLabel}.`;
    }
    return locale === "en" ? `The plan has been shortened by ${Math.abs(delta)} ${weekLabel}.` : `Planen er forkortet med ${Math.abs(delta)} ${weekLabel}.`;
  }

  if (params.currentGoalDate || params.previousGoalDate) {
    return locale === "en" ? "Your goal date is unchanged." : "Måldatoen er uændret.";
  }

  return locale === "en" ? "The plan end date is unchanged." : "Planens slutdato er uændret.";
}

export function buildProgramAdjustmentHighlights(params: {
  planWarnings: string[];
  safetyAdjustments: string[];
  savedAdaptations: SavedPlanAdaptation[];
  previousGoalDate?: string | null;
  currentGoalDate?: string | null;
  previousTotalWeeks?: number | null;
  currentTotalWeeks?: number | null;
  locale?: SiteLocale;
}): {
  kind: ProgramAdjustmentStateKind;
  toneLabel: string;
  headline: string;
  summary: string;
  practicalConsequence: string;
  timelineNote: string;
  highlights: string[];
  hasAdjustments: boolean;
} {
  const highlights: string[] = [];
  const seen = new Set<string>();
  const latestAdaptation = params.savedAdaptations[0];
  const timelineNote = buildTimelineNote({
    previousGoalDate: params.previousGoalDate,
    currentGoalDate: params.currentGoalDate,
    previousTotalWeeks: params.previousTotalWeeks,
    currentTotalWeeks: params.currentTotalWeeks,
    locale: params.locale,
  });

  if (latestAdaptation) {
    pushUniqueHighlight(
      highlights,
      seen,
      latestAdaptation.runnerFocus ? `${latestAdaptation.reason}. Fokus nu: ${latestAdaptation.runnerFocus}.` : latestAdaptation.reason,
    );
    (latestAdaptation.changeSummary ?? []).slice(0, 2).forEach((entry) => pushUniqueHighlight(highlights, seen, entry));
  }

  params.safetyAdjustments.slice(0, 2).forEach((entry) => {
    pushUniqueHighlight(highlights, seen, entry);
  });

  params.planWarnings.slice(0, 2).forEach((entry) => {
    pushUniqueHighlight(highlights, seen, entry);
  });

  if (!latestAdaptation && params.safetyAdjustments.length === 0 && params.planWarnings.length === 0) {
    return {
      kind: "none",
      toneLabel: params.locale === "en" ? "On track" : "På sporet",
      headline: params.locale === "en" ? "The plan continues calmly as intended" : "Planen fortsætter roligt som planlagt",
      summary: params.locale === "en" ? "Nothing right now calls for a larger change. The main thing is simply to keep the rhythm." : "Der er ikke noget lige nu, der kalder på en større ændring. Det vigtigste er bare at holde rytmen.",
      practicalConsequence: params.locale === "en" ? "You follow next week as planned." : "Du følger næste uge som planlagt.",
      timelineNote,
      highlights: [],
      hasAdjustments: false,
    };
  }

  if (latestAdaptation) {
    const adaptationSummary = summarizeAdaptationMode(latestAdaptation.mode, params.locale);
    return {
      kind: adaptationSummary.kind,
      toneLabel: adaptationSummary.label,
      headline: adaptationSummary.headline,
      summary: latestAdaptation.reason || adaptationSummary.summary,
      practicalConsequence: latestAdaptation.runnerFocus || adaptationSummary.practicalConsequence,
      timelineNote,
      highlights,
      hasAdjustments: true,
    };
  }

  return {
    kind: "conservative",
    toneLabel: params.locale === "en" ? "Extra room" : "Ekstra ro",
    headline: params.locale === "en" ? "The plan has been adjusted calmly" : "Planen er justeret roligt",
    summary: params.locale === "en" ? "I made a few small adjustments to keep the plan stable and easier to build on." : "Jeg har lavet et par små justeringer for at holde planen stabil og lettere at bygge videre på.",
    practicalConsequence: params.locale === "en" ? "The next part holds a little extra room so progression does not become too heavy." : "Næste del holder lidt ekstra luft, så progressionen ikke bliver for tung.",
    timelineNote,
    highlights,
    hasAdjustments: true,
  };
}

export function buildProgramInsightState(learnedInsights: string[], locale: SiteLocale = "da"): {
  readiness: ProgramInsightReadiness;
  isEmpty: boolean;
  title: string;
  summary: string;
  body: string;
  cta?: string;
  bullets: string[];
} {
  if (learnedInsights.length > 0) {
    return {
      readiness: "ready",
      isEmpty: false,
      title: locale === "en" ? "What I have learned about your training" : "Det har jeg lært om din træning",
      summary: locale === "en"
        ? "Your recent workouts are starting to show a pattern I can use in the next part of the plan."
        : "Dine seneste pas begynder at vise et mønster, som jeg kan bruge i næste del af planen.",
      body: "",
      cta: undefined,
      bullets: learnedInsights,
    };
  }

  return {
    readiness: "early",
    isEmpty: true,
    title: locale === "en" ? "Insights appear once I have a little more to work from" : "Indsigter kommer, når jeg har lidt mere at læse på",
    summary: locale === "en"
      ? "After a few more logged workouts, I start showing the patterns that are actually repeating."
      : "Efter nogle flere loggede pas begynder jeg at vise de mønstre, der faktisk går igen.",
    body: locale === "en"
      ? "For now, it is enough to log training calmly and honestly. The rest comes later."
      : "Lige nu er det nok bare at logge træningen roligt og ærligt. Resten kommer senere.",
    cta: locale === "en"
      ? "Log a few more workouts and the first patterns will become clearer."
      : "Log et par pas mere, så bliver de første mønstre tydelige.",
    bullets: [],
  };
}

export function buildProgressOverviewSummary(params: {
  plan: TrainingPlan | null;
  historySummary: PlanHistorySummary | null;
  displayWeek: number;
  currentWeekLoad: { load: number } | null;
  locale?: SiteLocale;
}): Array<{ label: string; value: string }> {
  if (!params.plan) return [];

  return [
    {
      label: params.locale === "en" ? "Current week" : "Aktuel uge",
      value: params.locale === "en" ? `Week ${params.displayWeek} of ${params.plan.weeks}` : `Uge ${params.displayWeek} af ${params.plan.weeks}`,
    },
    {
      label: params.locale === "en" ? "Progress" : "Fremdrift",
      value: params.historySummary ? `${params.historySummary.progressPct}%` : "—",
    },
    {
      label: params.locale === "en" ? "Weekly load" : "Ugens load",
      value: params.currentWeekLoad ? params.currentWeekLoad.load.toFixed(1).replace(".", params.locale === "en" ? "." : ",") : params.locale === "en" ? "0.0" : "0,0",
    },
  ];
}

export function buildProgressGraphState(params: {
  weeklyLoads: Array<{ week: number; load: number }>;
  baselineWeeklyLoads?: Array<{ week: number; load: number }>;
  displayWeek: number;
  visibleWeekCount?: number;
}): {
  visible: boolean;
  path: string;
  baselinePath: string;
  showBaselineSeries: boolean;
  points: Array<{ week: number; x: number; y: number; isCurrent: boolean }>;
  bars: Array<{ week: number; label: string; heightPct: number; isCurrent: boolean }>;
  windowStartWeek: number;
  windowEndWeek: number;
  hasHiddenBefore: boolean;
  hasHiddenAfter: boolean;
} {
  const allLoads = params.weeklyLoads.filter((point) => Number.isFinite(point.load));
  const requestedVisibleWeekCount = Math.max(4, Math.floor(params.visibleWeekCount ?? allLoads.length));
  const currentIndex = Math.max(
    0,
    allLoads.findIndex((point) => point.week === params.displayWeek),
  );
  const windowSize = Math.min(requestedVisibleWeekCount, allLoads.length);
  const halfWindow = Math.floor(windowSize / 2);
  const windowStartIndex = Math.max(0, Math.min(currentIndex - halfWindow, allLoads.length - windowSize));
  const windowEndIndex = windowStartIndex + windowSize;
  const loads = allLoads.slice(windowStartIndex, windowEndIndex);

  if (loads.length < 2) {
    return {
      visible: false,
      path: "",
      baselinePath: "",
      showBaselineSeries: false,
      points: [],
      bars: [],
      windowStartWeek: 0,
      windowEndWeek: 0,
      hasHiddenBefore: false,
      hasHiddenAfter: false,
    };
  }

  const minLoad = Math.min(...loads.map((point) => point.load));
  const maxLoad = Math.max(...loads.map((point) => point.load));
  const alignedBaselineLoads = (params.baselineWeeklyLoads ?? []).filter((point) =>
    loads.some((entry) => entry.week === point.week),
  );
  const baselineValues = alignedBaselineLoads.map((point) => point.load);
  const combinedMinLoad = Math.min(minLoad, ...(baselineValues.length > 0 ? baselineValues : [minLoad]));
  const combinedMaxLoad = Math.max(maxLoad, ...(baselineValues.length > 0 ? baselineValues : [maxLoad]));
  const loadRange = Math.max(1, combinedMaxLoad - combinedMinLoad);
  const width = 120;
  const height = 44;
  const chartTop = 4;
  const chartBottom = 26;
  const chartHeight = chartBottom - chartTop;

  const points = loads.map((point, index) => {
    const x = loads.length === 1 ? width / 2 : (index / (loads.length - 1)) * width;
    const normalizedLoad = (point.load - combinedMinLoad) / loadRange;
    const y = chartBottom - normalizedLoad * chartHeight;

    return {
      week: point.week,
      x: Number(x.toFixed(2)),
      y: Number(y.toFixed(2)),
      isCurrent: point.week === params.displayWeek,
    };
  });

  const bars = loads.map((point, index) => {
    const normalizedLoad = (point.load - combinedMinLoad) / loadRange;
    return {
      week: point.week,
      label: `U${point.week}`,
      heightPct: Number((32 + normalizedLoad * 68).toFixed(2)),
      isCurrent: point.week === params.displayWeek,
    };
  });

  const baselinePoints = loads
    .map((point, index) => {
      const baselineMatch = alignedBaselineLoads.find((entry) => entry.week === point.week);
      if (!baselineMatch) return null;
      const x = loads.length === 1 ? width / 2 : (index / (loads.length - 1)) * width;
      const normalizedLoad = (baselineMatch.load - combinedMinLoad) / loadRange;
      const y = chartBottom - normalizedLoad * chartHeight;
      return {
        week: point.week,
        x: Number(x.toFixed(2)),
        y: Number(y.toFixed(2)),
      };
    })
    .filter((point): point is { week: number; x: number; y: number } => Boolean(point));

  const baselinePath = baselinePoints.length >= 2 ? baselinePoints.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ") : "";

  return {
    visible: true,
    path: points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" "),
    baselinePath,
    showBaselineSeries: baselinePath.length > 0,
    points,
    bars,
    windowStartWeek: loads[0]?.week ?? 0,
    windowEndWeek: loads[loads.length - 1]?.week ?? 0,
    hasHiddenBefore: windowStartIndex > 0,
    hasHiddenAfter: windowEndIndex < allLoads.length,
  };
}

export function buildProgressGraphWeekAction(week: number): {
  targetWeek: number;
  scrollIntoView: true;
} {
  return {
    targetWeek: week,
    scrollIntoView: true,
  };
}
