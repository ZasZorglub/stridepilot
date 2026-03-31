import { PlanHistorySummary, SavedPlanAdaptation, SavedWorkoutSessionFeedback, TrainingPlan, WorkoutSession } from "@/lib/types";

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
}): string {
  const datePart = params.goalDateLabel ? ` · ${params.goalDateLabel}` : "";
  return `${params.distance}${datePart} · uge ${params.displayWeek} af ${params.totalWeeks}`;
}

export function buildNextWorkoutState(params: {
  nextSession?: WorkoutSession | null;
  dateLabel?: string | null;
  durationMin?: number | null;
}): {
  visible: boolean;
  title: string;
  meta?: string;
} {
  if (!params.nextSession) {
    return {
      visible: false,
      title: "Ingen kommende pas endnu",
    };
  }

  const durationPart = params.durationMin ? `${params.durationMin} min` : null;
  const datePart = params.dateLabel ?? null;

  return {
    visible: true,
    title: params.nextSession.title,
    meta: [durationPart, datePart].filter(Boolean).join(" · "),
  };
}

export function buildTodayActionState(params: {
  todaySession?: WorkoutSession | null;
  nextSession?: WorkoutSession | null;
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
      label: "Dagens træning",
      description: "Det er det vigtigste pas i dag.",
      support: "Du behøver ikke mere lige nu end at møde op og tage første del roligt.",
      ctaLabel: "Start pas",
    };
  }

  if (params.nextSession) {
    return {
      mode: "rest_day_with_next",
      label: "I dag",
      emptyTitle: "Rolig dag",
      description: "Ingen løbetur i dag.",
      support: "Lad dagen være let, og kig kun frem mod næste planlagte pas, hvis du har brug for overblikket.",
      ctaLabel: "Se ugeplan",
    };
  }

  return {
    mode: "rest_day_empty",
    label: "I dag",
    emptyTitle: "Rolig dag",
    description: "Ingen løbetur i dag.",
    support: "Brug dagen til ro og få et hurtigt overblik over ugen, hvis du vil.",
    ctaLabel: "Se denne uge",
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

function summarizeAdaptationMode(mode: SavedPlanAdaptation["mode"]): { kind: ProgramAdjustmentStateKind; label: string; summary: string } {
  if (mode === "hold") {
    return {
      kind: "holding",
      label: "Holdt rolig",
      summary: "Jeg lod planen blive rolig med vilje, så du kan holde rytmen uden at presse noget frem.",
    };
  }
  if (mode === "down_shift" || mode === "recovery_microcycle") {
    return {
      kind: "conservative",
      label: "Ekstra luft",
      summary: "Jeg gjorde den næste del lidt lettere, så planen stadig føles realistisk og nemmere at lande godt i.",
    };
  }
  return {
    kind: "meaningful",
    label: "Tilpasset",
    summary: "Jeg har justeret næste skridt ud fra din træning, så planen passer bedre til det, du viser lige nu.",
  };
}

export function buildProgramAdjustmentHighlights(params: {
  planWarnings: string[];
  safetyAdjustments: string[];
  savedAdaptations: SavedPlanAdaptation[];
}): {
  kind: ProgramAdjustmentStateKind;
  toneLabel: string;
  headline: string;
  summary: string;
  highlights: string[];
  hasAdjustments: boolean;
} {
  const highlights: string[] = [];
  const seen = new Set<string>();
  const latestAdaptation = params.savedAdaptations[0];

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
      toneLabel: "På sporet",
      headline: "Planen kører roligt videre",
      summary: "Der er ikke noget lige nu, der kalder på en større ændring. Det vigtigste er bare at holde rytmen.",
      highlights: [],
      hasAdjustments: false,
    };
  }

  if (latestAdaptation) {
    const adaptationSummary = summarizeAdaptationMode(latestAdaptation.mode);
    return {
      kind: adaptationSummary.kind,
      toneLabel: adaptationSummary.label,
      headline: latestAdaptation.mode === "hold" ? "Jeg holdt planen lidt mere rolig" : "Planen er justeret",
      summary: adaptationSummary.summary,
      highlights,
      hasAdjustments: true,
    };
  }

  return {
    kind: "conservative",
    toneLabel: "Ekstra ro",
    headline: "Små justeringer holder kursen rolig",
    summary: "Jeg har lavet et par små justeringer for at holde planen stabil og lettere at bygge videre på.",
    highlights,
    hasAdjustments: true,
  };
}

export function buildProgramInsightState(learnedInsights: string[]): {
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
      title: "Det har jeg lært om din træning",
      summary: "Dine seneste pas begynder at vise et mønster, som jeg kan bruge i næste del af planen.",
      body: "",
      cta: undefined,
      bullets: learnedInsights,
    };
  }

  return {
    readiness: "early",
    isEmpty: true,
    title: "Indsigter kommer, når jeg har lidt mere at læse på",
    summary: "Efter nogle flere loggede pas begynder jeg at vise de mønstre, der faktisk går igen.",
    body: "Lige nu er det nok bare at logge træningen roligt og ærligt. Resten kommer senere.",
    cta: "Log et par pas mere, så bliver de første mønstre tydelige.",
    bullets: [],
  };
}

export function buildProgressOverviewSummary(params: {
  plan: TrainingPlan | null;
  historySummary: PlanHistorySummary | null;
  displayWeek: number;
  currentWeekLoad: { load: number } | null;
}): Array<{ label: string; value: string }> {
  if (!params.plan) return [];

  return [
    {
      label: "Aktuel uge",
      value: `Uge ${params.displayWeek} af ${params.plan.weeks}`,
    },
    {
      label: "Fremdrift",
      value: params.historySummary ? `${params.historySummary.progressPct}%` : "—",
    },
    {
      label: "Ugens load",
      value: params.currentWeekLoad ? params.currentWeekLoad.load.toFixed(1).replace(".", ",") : "0,0",
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
