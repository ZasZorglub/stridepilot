"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";
import { CurrentRunningAbility, FeedbackInsights, Goal, GuidancePreference, GoalType, RunnerProfile, RunnerProfileInsights, SavedWorkoutSessionFeedback, TrainingPlan, WorkoutFeedbackInput, WorkoutSession, WorkoutStep } from "@/lib/types";
import { APP_NAME } from "@/lib/app-config";
import { cancelCue, initSpeech, isSpeechSupported, speakCue } from "@/lib/speech-coach";
import { buildWeeklyLoad } from "@/lib/plan";
import {
  calendarWeekDatesForIndex,
  calendarWeekIndexFromDate,
  deriveCalendarWeekCount,
  sessionDateFromCalendarWeek,
  visiblePlanSessions,
} from "@/lib/calendar-week";
import {
  adaptPlanFromFeedback,
  CapabilityState,
  capabilityStorageKey,
  createInitialCapabilityState,
  createInitialRunnerState,
  createInitialSessionHistory,
  createInitialTrainingBlock,
  getWorkoutPurpose,
  evaluateRunnerState,
  evaluateTrainingTrend,
  SessionHistory,
  TrainingBlock,
  RunnerState,
  updateCapability,
  updateRunnerState,
  updateSessionHistory,
  updateTrainingBlock,
} from "@/lib/coach";
import { WorkoutFeedback as CoachWorkoutFeedback } from "@/lib/coach/capability";
import { buildFeedbackResponseCopy } from "@/lib/coach/explanations";
import { buildProfileExplanationSummary, interpretProfileSignals, recommendTrainingDays } from "@/lib/profile-interpretation";

type Stage = "welcome" | "auth" | "intro" | "profile" | "intermezzo" | "program" | "workout";
type AuthMode = "signup" | "login";
type AudioMode = "off" | "short" | "coach";
type ThemePref = "system" | "dark" | "light";
type InfoField = "targetPace" | "runningExperience" | "activityLevel" | "availableTrainingDays" | "currentRunningAbility" | "graph" | null;
type OnboardingSelectionState = {
  runningAbility: boolean;
  goalDistance: boolean;
  goalType: boolean;
  activityLevel: boolean;
};

type QuickFeedbackOption = NonNullable<WorkoutFeedbackInput["quickFeedback"]>;
type CoachReply = {
  replyType: "agree" | "disagree" | "clarify";
  text?: string;
};

type CoachInterpretationState = {
  title: string;
  updatedLabel?: string;
  interpretation: string;
  adjustment: string;
  progressionPreview?: string;
  focus?: string;
  learnedInsights?: string[];
  reply?: CoachReply;
  resolution?: string;
};

type SessionFeedbackMap = Record<string, SavedWorkoutSessionFeedback>;

interface AuthUser {
  id: string;
  email: string;
  isDemo?: boolean;
}

const WEEK_DAY_NAMES: WorkoutSession["dayOfWeek"][] = [
  "Mandag",
  "Tirsdag",
  "Onsdag",
  "Torsdag",
  "Fredag",
  "Lordag",
  "Sondag",
];

const DAY_LABEL: Record<WorkoutSession["dayOfWeek"], string> = {
  Mandag: "Mandag",
  Tirsdag: "Tirsdag",
  Onsdag: "Onsdag",
  Torsdag: "Torsdag",
  Fredag: "Fredag",
  Lordag: "Lørdag",
  Sondag: "Søndag",
};

const ACTIVITY_LEVEL_INFO: Record<RunnerProfile["activityLevel"], string> = {
  meget_lav: "Næsten ingen anden træning ud over det mest nødvendige i hverdagen.",
  lav: "Lidt anden træning eller bevægelse, fx 1-2 lette pas om ugen.",
  moderat: "Regelmæssig anden træning, typisk 2-4 pas eller en aktiv hverdag.",
  høj: "En del anden træning eller sport i løbet af ugen.",
  meget_høj: "Meget høj samlet træningsmængde med hyppige pas ud over løb.",
};

const CURRENT_RUNNING_ABILITY_OPTIONS: Array<{ value: CurrentRunningAbility; label: string }> = [
  { value: "helt_ny", label: "Jeg er helt ny og kan ikke løbe sammenhængende endnu" },
  { value: "fem_min", label: "Jeg kan løbe 5 minutter" },
  { value: "ti_femten_min", label: "Jeg kan løbe 10–15 minutter" },
  { value: "tyve_tredive_min", label: "Jeg kan løbe 20–30 minutter" },
  { value: "mere_end_tredive_min", label: "Jeg kan løbe mere end 30 minutter" },
];

const GOAL_DISTANCE_OPTIONS: Array<{ value: Goal["distance"]; label: string }> = [
  { value: "5K", label: "5 km" },
  { value: "10K", label: "10 km" },
  { value: "Halvmaraton", label: "Halvmaraton" },
  { value: "Marathon", label: "Maraton" },
];

const GOAL_TYPE_OPTIONS: Array<{ value: GoalType; label: string }> = [
  { value: "complete", label: "Gennemføre" },
  { value: "run_without_walking", label: "Løbe uden gangpauser" },
  { value: "target_time", label: "Løbe med et bestemt tempo" },
  { value: "pr", label: "Sæt PR" },
];

const ACTIVITY_LEVEL_OPTIONS: Array<{ value: RunnerProfile["activityLevel"]; label: string }> = [
  { value: "meget_lav", label: "Næsten ingen anden træning" },
  { value: "lav", label: "Lidt anden træning" },
  { value: "moderat", label: "Regelmæssig anden træning" },
  { value: "høj", label: "En del anden træning" },
  { value: "meget_høj", label: "Meget høj samlet træning" },
];

const GENDER_OPTIONS: Array<{ value: NonNullable<RunnerProfile["gender"]>; label: string }> = [
  { value: "kvinde", label: "Kvinde" },
  { value: "mand", label: "Mand" },
  { value: "andet", label: "Andet" },
  { value: "vil_ikke_oplyse", label: "Ønsker ikke at oplyse" },
];

const GUIDANCE_OPTIONS: Array<{ value: GuidancePreference; label: string; help: string }> = [
  { value: "simple", label: "Enkel og overskuelig", help: "Få tydelige pas uden for mange nuancer." },
  { value: "flexible", label: "Fleksibel og tilpasningsdygtig", help: "Gør planen lettere at få til at passe ind i hverdagen." },
  { value: "performance_oriented", label: "Mere præstationsorienteret", help: "Læg lidt mere vægt på fremgang og målretning." },
];

const PACE_MINUTE_OPTIONS = Array.from({ length: 8 }, (_, index) => 3 + index);
const PACE_SECOND_OPTIONS = Array.from({ length: 12 }, (_, index) => index * 5);
const RECENT_RACE_TIME_OPTIONS = Array.from({ length: 691 }, (_, index) => 15 * 60 + index * 30);
const TRAINING_TIME_OPTIONS = [
  "05:00",
  "06:00",
  "07:00",
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
];

const QUICK_FEEDBACK_OPTIONS: Array<{ value: QuickFeedbackOption; label: string }> = [
  { value: "very_easy", label: "For let" },
  { value: "good", label: "Passende" },
  { value: "hard", label: "Lidt for hårdt" },
  { value: "too_hard", label: "For hårdt" },
];

const COMPLETION_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 100, label: "Gennemført" },
  { value: 75, label: "Afkortet" },
  { value: 0, label: "Missede" },
];

const ENERGY_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 2, label: "Lav energi" },
  { value: 3, label: "Okay energi" },
  { value: 5, label: "God energi" },
];

const PAIN_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1, label: "Ingen smerte" },
  { value: 3, label: "Lidt ømhed" },
  { value: 6, label: "Smerte" },
];

const INFO_TEXT: Record<Exclude<InfoField, null>, string> = {
  targetPace: "Vælg det tempo du gerne vil kunne holde i gennemsnit pr. kilometer.",
  runningExperience: "Vælg det niveau der bedst matcher din løbeerfaring lige nu.",
  activityLevel: "Det her handler om din øvrige træning og daglige belastning uden for selve løbepassene.",
  availableTrainingDays: "Vælg de dage hvor du realistisk kan træne fast.",
  currentRunningAbility: "Dette hjælper med at placere dit første niveau og gøre planen realistisk fra dag 1.",
  graph: "Den grå kurve viser planen fra start. Den blå kurve viser, hvordan jeg har tilpasset den undervejs.",
};

function requiredRunsPerWeek(distance: Goal["distance"]): number {
  if (distance === "5K") return 2;
  if (distance === "10K") return 3;
  return 3;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysToIso(value: string, days: number): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  const nextYear = date.getFullYear();
  const nextMonth = String(date.getMonth() + 1).padStart(2, "0");
  const nextDay = String(date.getDate()).padStart(2, "0");
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

function derivePlanWeeks(startDate: string, endDate?: string): number | null {
  if (!isValidIsoDate(startDate) || !endDate || !isValidIsoDate(endDate)) return null;
  return deriveCalendarWeekCount(startDate, endDate);
}

function shouldShowGoalPaceInput(goalType?: GoalType): boolean {
  return goalType === "target_time" || goalType === "pr";
}

function formatPace(secPerKm?: number): string | null {
  if (!secPerKm || secPerKm <= 0) return null;
  const minutes = Math.floor(secPerKm / 60);
  const seconds = secPerKm % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")} min/km`;
}

function pacePickerValues(goal: Goal): { minute: string; second: string } {
  if (!goal.targetPaceSecPerKm) return { minute: "", second: "" };
  return {
    minute: String(Math.floor(goal.targetPaceSecPerKm / 60)),
    second: String(goal.targetPaceSecPerKm % 60).padStart(2, "0"),
  };
}

function formatDurationOption(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function pacePickerValuesFromSeconds(targetPaceSecPerKm?: number): { minute: string; second: string } {
  if (!targetPaceSecPerKm) return { minute: "", second: "" };
  return {
    minute: String(Math.floor(targetPaceSecPerKm / 60)),
    second: String(targetPaceSecPerKm % 60).padStart(2, "0"),
  };
}

function updateGoalPace(goal: Goal, part: "minute" | "second", value: string, currentValues?: { minute: string; second: string }): Goal {
  const current = currentValues ?? pacePickerValues(goal);
  const minute = part === "minute" ? value : current.minute;
  const second = part === "second" ? value : current.second;

  if (!minute || !second) {
    return { ...goal, targetPaceSecPerKm: undefined, targetTime: "" };
  }

  const secPerKm = Number(minute) * 60 + Number(second);
  return {
    ...goal,
    targetPaceSecPerKm: secPerKm,
    targetTime: targetTimeFromPace(goal.distance, secPerKm),
  };
}

function targetTimeFromPace(distance: Goal["distance"], targetPaceSecPerKm?: number): string {
  if (!targetPaceSecPerKm) return "";
  const distanceKm = distance === "5K" ? 5 : distance === "10K" ? 10 : distance === "Halvmaraton" ? 21.0975 : 42.195;
  const totalSec = Math.round(distanceKm * targetPaceSecPerKm);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function goalPaceFieldHint(goal: Goal): string {
  if (goal.goalType === "pr") {
    return `Vælg det tempo du gerne vil kunne holde for at sætte PR på ${goal.distance}.`;
  }
  return `Vælg det tempo du går efter på ${goal.distance}.`;
}

function goalPerformanceLabel(goal: Goal): string {
  const paceLabel = formatPace(goal.targetPaceSecPerKm);
  if (goal.goalType === "run_without_walking") return `${goal.distance} uden gangpauser`;
  if (paceLabel) return `${goal.distance} omkring ${paceLabel}`;
  return goal.distance;
}

function formatClock(totalSec: number): string {
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function sessionDateFromPlan(startDateIso: string, session: WorkoutSession): Date {
  return sessionDateFromCalendarWeek(startDateIso, session);
}

function formatDanishDateWithWeekday(date: Date): string {
  const datePart = date.toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" });
  const weekDay = date.toLocaleDateString("da-DK", { weekday: "long" }).toLowerCase();
  return `${datePart}: ${weekDay}`;
}

function isValidIsoDate(value: string): boolean {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function formatStepDuration(step: WorkoutStep): string {
  if (step.durationSec % 60 === 0) {
    const min = step.durationSec / 60;
    return `${min} ${min === 1 ? "minut" : "minutter"}`;
  }
  return `${step.durationSec} sekunder`;
}

function stepCueText(step: WorkoutStep): string {
  if (step.type === "warmup") return `Rask gang i ${formatStepDuration(step)}`;
  if (step.type === "run") return `Løb i ${formatStepDuration(step)}`;
  if (step.type === "walk") return `Gå i ${formatStepDuration(step)}`;
  return `Nedkøling i ${formatStepDuration(step)}`;
}

function shortSessionTitle(title: string): string {
  return title.replace(/^Uge \d+\s*-\s*/i, "").trim();
}

function phaseName(step: WorkoutStep): string {
  if (step.type === "run") return "Løb";
  if (step.type === "walk") return "Gang";
  if (step.type === "warmup") return "Rask gang";
  return "Nedkøling";
}

function intensityFromLoad(loadScore: number): string {
  if (loadScore <= 3) return "Let intensitet";
  if (loadScore <= 6) return "Moderat intensitet";
  return "Høj intensitet";
}

function coachingHint(step: WorkoutStep): string {
  if (step.type === "warmup") return "Gå i rask tempo og bliv varm i kroppen.";
  if (step.type === "run") return "Løb i kontrolleret tempo. Du skal kunne tale i korte sætninger.";
  if (step.type === "walk") return "Sænk tempoet og træk vejret roligt.";
  return "Lad pulsen falde roligt og hold kroppen i bevægelse.";
}

function buildCue(step: WorkoutStep, mode: AudioMode): string {
  const shortCue = stepCueText(step);
  if (mode === "coach") {
    return `${shortCue}. ${coachingHint(step)}`;
  }
  return shortCue;
}

function introSeenKey(userId: string): string {
  return `stridepilotIntroSeen:${userId}`;
}

function programSeenKey(userId: string): string {
  return `stridepilotProgramSeen:${userId}`;
}

function firstNameKey(userId: string): string {
  return `stridepilotFirstName:${userId}`;
}

function setupKey(userId: string): string {
  return `runnerCoachHasSetup:${userId}`;
}

function profileKey(userId: string): string {
  return `runnerCoachProfileId:${userId}`;
}

function sessionFeedbackStorageKey(currentProfileId: string): string {
  return `stridepilotSessionFeedback:${currentProfileId}`;
}

function savedFeedbackStatus(completionPct: number): SavedWorkoutSessionFeedback["status"] {
  if (completionPct <= 0) return "missed";
  if (completionPct < 95) return "shortened";
  return "completed";
}

function savedFeedbackStatusLabel(status: SavedWorkoutSessionFeedback["status"]): string {
  if (status === "completed") return "Gennemført";
  if (status === "shortened") return "Afkortet";
  return "Missede";
}

function savedFeedbackEnergyLabel(value: number): string {
  if (value <= 2) return "Lav energi";
  if (value >= 4) return "God energi";
  return "Okay energi";
}

function savedFeedbackPainLabel(value: number): string {
  if (value <= 1) return "Ingen smerte";
  if (value <= 3) return "Lidt ømhed";
  if (value <= 6) return "Smerte";
  return "Høj forsigtighed";
}

function formatSubmittedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("da-DK", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sessionShortDescription(session: WorkoutSession): string {
  if (/interval/i.test(session.title)) {
    return "Intervaltræningspas med korte løbeintervaller og rolige gangpauser.";
  }
  if (/udholdenhed/i.test(session.title)) {
    return "Roligt udholdenhedstræningspas med fokus på kontinuitet og roligt tempo.";
  }
  if (/roligt/i.test(session.title)) {
    return "Roligt træningspas med jævnt tempo og fokus på komfortabel rytme.";
  }
  if (/måldag|test/i.test(session.title)) {
    return "Målspecifikt træningspas hvor du afprøver den form, du har bygget op.";
  }
  return "Et guidet træningspas tilpasset dit nuværende program.";
}

function formatMinutesLabel(totalSec: number): string {
  if (totalSec <= 0) return "0 min";
  const minutes = totalSec / 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const rest = Math.round(minutes % 60);
    return rest > 0 ? `${hours} t ${rest} min` : `${hours} t`;
  }
  if (minutes % 1 === 0) return `${minutes} min`;
  return `${minutes.toFixed(1).replace(".", ",")} min`;
}

function linePath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

function sessionTotalDurationSec(session: WorkoutSession): number {
  return session.steps.reduce((sum, step) => sum + step.durationSec, 0);
}

function intervalSummary(session: WorkoutSession): string {
  const runSteps = session.steps.filter((step) => step.type === "run");
  const walkSteps = session.steps.filter((step) => step.type === "walk");
  if (runSteps.length > 1) {
    const runDuration = formatClock(runSteps[0].durationSec).replace(/^00:/, "");
    const walkDuration = walkSteps[0] ? ` · ${formatClock(walkSteps[0].durationSec).replace(/^00:/, "")} gangpause` : "";
    return `${runSteps.length} × ${runDuration} løb${walkDuration}`;
  }
  if (runSteps.length === 1) {
    return `${formatMinutesLabel(runSteps[0].durationSec)} sammenhængende løb`;
  }
  return "Let bevægelse og rolig rytme";
}

function runningAbilityLabel(value: CurrentRunningAbility): string {
  return CURRENT_RUNNING_ABILITY_OPTIONS.find((option) => option.value === value)?.label ?? "dit nuværende niveau";
}

function intermezzoSummary(params: {
  runnerProfile: RunnerProfile;
  goal: Goal;
  insights: RunnerProfileInsights | null;
  recommendation: { recommendedDays: number };
  planFeasibilityStatus: "feasible" | "feasible_with_adjustments" | "not_feasible";
  planTradeoff: string | null;
}): {
  title: string;
  summary: string;
  rationale: string;
  bullets: Array<{ label: string; value: string }>;
} {
  const { runnerProfile, goal, insights, recommendation, planFeasibilityStatus, planTradeoff } = params;
  const explanationLines = buildProfileExplanationSummary(runnerProfile, goal);
  const signals = interpretProfileSignals(runnerProfile, goal);
  const name = runnerProfile.firstName?.trim();
  const goalLabel = goalPerformanceLabel(goal);
  const abilityLabel = runningAbilityLabel(runnerProfile.currentRunningAbility);
  const strategyStyle = insights?.progressionStrategy.style ?? "balanced";

  const title = name ? `Tak ${name} — her er mit udgangspunkt for din plan` : "Her er mit udgangspunkt for din plan";

  const focusText =
    strategyStyle === "conservative"
      ? "rolig og tryg progression"
      : strategyStyle === "aggressive"
        ? "målrettet progression i et kontrolleret tempo"
        : "stabil progression med fokus på kontinuitet";

  const cautionText =
    planFeasibilityStatus === "feasible_with_adjustments" && planTradeoff
      ? planTradeoff
      : signals.injuryConcern
        ? "du nævner skader eller sårbare områder, som planen skal tage hensyn til"
        : signals.fitButRunSpecificLow
          ? "du har god generel form, men skal stadig bygge mere løbespecifik tolerance"
          : runnerProfile.currentRunningAbility === "helt_ny"
            ? "du er stadig i gang med at bygge dit løbegrundlag op"
            : goal.targetPaceSecPerKm
              ? "du har et konkret ambitionsniveau, som kræver stabil opbygning"
              : "det vigtigste er at bygge stabilitet og gode vaner op";

  const summary = name
    ? `${name}, du vil gerne frem mod ${goalLabel}, og lige nu peger dine svar på et udgangspunkt omkring ${abilityLabel.toLowerCase()}. Derfor lægger jeg planen an med fokus på ${focusText}.`
    : `Du vil gerne frem mod ${goalLabel}, og dine svar peger på, at planen skal bygges op med fokus på ${focusText}.`;

  const rationale = explanationLines[2] ?? explanationLines[0] ?? "Planen er lagt, så den passer til dit aktuelle udgangspunkt.";

  const bullets = [
    { label: "Mål", value: goalLabel },
    { label: "Udgangspunkt", value: explanationLines[0] ?? `${abilityLabel} lige nu` },
    { label: "Træningsrytme", value: `${recommendation.recommendedDays} træningsdage om ugen` },
    { label: "Særligt hensyn", value: cautionText },
    { label: "Åbning", value: rationale },
  ];

  return { title, summary, rationale, bullets };
}

function quickFeedbackPreset(value: QuickFeedbackOption): Pick<WorkoutFeedbackInput, "effort" | "completionPct" | "energy" | "painLevel"> {
  if (value === "very_easy") {
    return { effort: 3, completionPct: 100, energy: 5, painLevel: 1 };
  }
  if (value === "good") {
    return { effort: 6, completionPct: 100, energy: 4, painLevel: 1 };
  }
  if (value === "hard") {
    return { effort: 8, completionPct: 90, energy: 3, painLevel: 2 };
  }
  return { effort: 9, completionPct: 75, energy: 2, painLevel: 4 };
}

function mapQuickFeedbackToCoachDifficulty(value: QuickFeedbackOption): CoachWorkoutFeedback["difficulty"] {
  if (value === "very_easy") return "easy";
  if (value === "good") return "moderate";
  if (value === "hard") return "hard";
  return "very_hard";
}

function mapNumericEnergyToCoachEnergy(value: number): CoachWorkoutFeedback["energy"] {
  if (value >= 4) return "high";
  if (value <= 2) return "low";
  return "normal";
}

function mapNumericPainToCoachPain(value: number): CoachWorkoutFeedback["pain"] {
  if (value >= 7) return "high";
  if (value >= 4) return "moderate";
  if (value >= 2) return "mild";
  return "none";
}

function sessionRunMinutes(session: WorkoutSession): number {
  return session.steps.filter((step) => step.type === "run").reduce((sum, step) => sum + step.durationSec / 60, 0);
}

function classifyAdaptiveSession(session: WorkoutSession): "interval" | "tempo" | "easy" | "long" | "other" {
  const text = `${session.title} ${session.notes ?? ""}`.toLowerCase();
  if (/interval/.test(text)) return "interval";
  if (/tempo/.test(text)) return "tempo";
  if (/udholdenhed|lang|long/.test(text)) return "long";
  if (/roligt|easy|recovery/.test(text) || session.loadScore <= 5) return "easy";
  return "other";
}

function buildAdaptiveWorkoutFeedback(
  sessionId: string,
  feedback: WorkoutFeedbackInput,
): CoachWorkoutFeedback {
  const clearlyNegative =
    (feedback.completionPct ?? 100) < 95 ||
    feedback.quickFeedback === "hard" ||
    feedback.quickFeedback === "too_hard" ||
    (feedback.effort ?? 6) >= 8 ||
    (feedback.energy ?? 3) <= 2 ||
    (feedback.painLevel ?? 1) >= 4;

  return {
    sessionId,
    completed: feedback.completionPct >= 80,
    difficulty: mapQuickFeedbackToCoachDifficulty(feedback.quickFeedback ?? "good"),
    energy: mapNumericEnergyToCoachEnergy(feedback.energy),
    pain: mapNumericPainToCoachPain(feedback.painLevel),
    completionPct: feedback.completionPct,
    effort: feedback.effort,
    adaptationFactor:
      feedback.quickFeedback === "very_easy" && (feedback.energy ?? 3) >= 4 && (feedback.painLevel ?? 1) <= 2 && (feedback.completionPct ?? 100) >= 95
        ? 1.04
        : clearlyNegative
          ? 0.92
          : 1,
    progressionPauseWeeks: clearlyNegative ? 1 : 0,
    noteCaution: clearlyNegative,
  };
}

function mergeAdaptedUpcomingSessions(plan: TrainingPlan, activeSessionId: string, adaptedUpcoming: TrainingPlan): TrainingPlan {
  const activeIndex = plan.sessions.findIndex((session) => session.id === activeSessionId);
  if (activeIndex < 0) return plan;

  return {
    ...plan,
    sessions: plan.sessions.map((session, index) => {
      if (index <= activeIndex) return session;
      return adaptedUpcoming.sessions[index - activeIndex - 1] ?? session;
    }),
  };
}

function detectAdaptivePlanChange(previousPlan: TrainingPlan, updatedPlan: TrainingPlan): { interpretation: string; adjustment: string; log?: string } {
  const previousById = new Map(previousPlan.sessions.map((session) => [session.id, session]));

  for (const updatedSession of updatedPlan.sessions) {
    const previousSession = previousById.get(updatedSession.id);
    if (!previousSession) continue;

    const previousType = classifyAdaptiveSession(previousSession);
    const updatedType = classifyAdaptiveSession(updatedSession);
    const minuteDelta = Math.round(sessionRunMinutes(updatedSession) - sessionRunMinutes(previousSession));

    if ((previousType === "interval" || previousType === "tempo") && updatedType === "easy") {
      return {
        interpretation: "Træningspasset var mere krævende end planlagt, så det næste kvalitetstræningspas bliver gjort roligere.",
        adjustment: "Jeg skifter det næste hårdere træningspas til et roligt træningspas og korter det lidt ned.",
        log: "Jeg gør det næste kvalitetstræningspas roligere, så belastningen ikke bygger sig for hurtigt op.",
      };
    }

    if (minuteDelta <= -5 && updatedType === "long") {
      return {
        interpretation: "Belastningen ser lidt høj ud lige nu, så den næste længere tur bliver kortet lidt ned.",
        adjustment: "Jeg tager lidt tid af det længste træningspas, så progressionen forbliver realistisk.",
        log: "Jeg korter den næste længere tur lidt ned, så den samlede belastning bliver mere overkommelig.",
      };
    }

    if (minuteDelta < 0) {
      return {
        interpretation: "Træningspasset så ud til at koste lidt mere i dag, så det næste træningspas holdes lidt roligere.",
        adjustment: "Jeg tager en smule tid af den næste løbedel, så du kan holde rytmen med mere overskud.",
        log: "Jeg holder det næste træningspas lidt roligere, så kroppen får bedre plads til at følge med.",
      };
    }

    if (minuteDelta >= 3 && updatedType === "easy") {
      return {
        interpretation: "Du havde fint overskud i dag, så det næste rolige træningspas får et par ekstra minutter.",
        adjustment: "Jeg bygger en smule videre på det næste rolige træningspas, men holder stadig progressionen kontrolleret.",
        log: "Jeg lægger et par ekstra minutter på det næste rolige træningspas, fordi du ser ud til at have overskud.",
      };
    }
  }

  return {
    interpretation: "Træningspasset ramte et godt niveau, så planen kan fortsætte i et roligt og stabilt tempo.",
    adjustment: "Jeg holder progressionen stabil, så du kan bygge videre uden at forcere noget.",
  };
}

function learnedInsightLines(capability: CapabilityState | null, plan: TrainingPlan | null): string[] {
  const lines = [...(plan?.rationale?.adaptation?.learnedTendencies ?? [])];
  const traits = capability?.traits;
  if (!traits) return lines.slice(0, 3);

  if (traits.progressionTolerance >= 3.8 && traits.complianceTrend >= 3.5) {
    lines.push("Du har håndteret de seneste ugers progression godt.");
  }
  if (traits.longRunTolerance >= 3.8) {
    lines.push("Dine længere ture ser mere stabile ud end tidligere.");
  }
  if (traits.longRunTolerance <= 2.5) {
    lines.push("Langturene bygges lidt mere forsigtigt lige nu.");
  }
  if (traits.qualityTolerance <= 2.5) {
    lines.push("Kvalitetstræningspassene holdes mere kontrollerede, mens tolerancen bygger sig op.");
  }
  if (traits.cautionTrend >= 3.8) {
    lines.push("De seneste signaler peger på, at planen skal være lidt mere forsigtig lige nu.");
  }
  if (traits.complianceTrend >= 3.8 && traits.cautionTrend <= 2.6) {
    lines.push("Du har været stabil flere uger i træk, så planen kan holde rytmen.");
  }

  return Array.from(new Set(lines)).slice(0, 3);
}

function weekStateLabel(plan: TrainingPlan | null, weekNumber: number): { title: string; tone: string } {
  const adaptationMode = plan?.rationale?.adaptation?.mode;
  if (adaptationMode === "recovery_microcycle") return { title: "Recovery-uge", tone: "Vi holder ugen bevidst lettere." };
  if (adaptationMode === "down_shift") return { title: "Kontrolleret uge", tone: "Ugen er dæmpet lidt for at holde belastningen bæredygtig." };
  if (adaptationMode === "resume_build") return { title: "Tilbage i build", tone: "Du er på vej tilbage i normal progression." };
  if (adaptationMode === "progress") return { title: "Progressionsuge", tone: "Ugen bygger lidt mere selvsikkert videre." };

  const weekRationale = plan?.rationale?.weeks?.find((week) => week.weekNumber === weekNumber);
  if (weekRationale?.loadShape === "stabilize") return { title: "Stabiliseringsuge", tone: "Ugen giver plads til at absorbere træningen." };
  if (weekRationale?.loadShape === "taper") return { title: "Skærpende uge", tone: "Ugen holder dig frisk og målrettet." };
  return { title: "Byggeuge", tone: "Ugen bygger roligt videre på din form." };
}

function revertUpcomingSessionsAfterWorkout(currentPlan: TrainingPlan, previousPlan: TrainingPlan, activeSessionId: string): TrainingPlan {
  const activeIndex = currentPlan.sessions.findIndex((session) => session.id === activeSessionId);
  if (activeIndex < 0) return currentPlan;

  return {
    ...currentPlan,
    sessions: currentPlan.sessions.map((session, index) => {
      if (index <= activeIndex) return session;
      return previousPlan.sessions[index] ?? session;
    }),
  };
}

function coachAdjustmentCopy(text: string): string {
  const cleaned = text.replace(/\ber er\b/gi, "er").replace(/\s+/g, " ").trim();
  const variant = Array.from(cleaned).reduce((sum, char) => sum + char.charCodeAt(0), 0);

  if (/fordi/i.test(cleaned)) return cleaned;
  if (/restitution/i.test(cleaned)) {
    const variants = [
      "Jeg lagde mere restitution ind her, så kroppen får bedre plads til at absorbere træningen.",
      "Jeg holder denne del roligere, så du får lidt mere restitution mellem træningspassene.",
    ];
    return variants[variant % variants.length];
  }
  if (/holder progressionen|holde progressionen/i.test(cleaned)) {
    const variants = [
      "Jeg holder ugen stabil, så du kan bygge videre med lidt mere overskud.",
      "Jeg lader progressionen stå mere roligt her, så belastningen forbliver realistisk.",
    ];
    return variants[variant % variants.length];
  }
  if (/dæmper|lettere|smule/i.test(cleaned)) {
    const variants = [
      "Jeg dæmpede denne del en smule, så progressionen ikke bliver for stejl.",
      "Jeg holder intensiteten rolig her, så træningen stadig føles kontrolleret.",
    ];
    return variants[variant % variants.length];
  }
  if (/skruer|øger|anelse op/i.test(cleaned)) {
    const variants = [
      "Jeg øger her en smule, fordi de seneste træningspas tyder på overskud.",
      "Jeg bygger lidt videre her, fordi kroppen ser ud til at følge fint med.",
    ];
    return variants[variant % variants.length];
  }
  const fallback = [
    "Jeg justerede programmet let, så det passer bedre til din aktuelle rytme.",
    "Jeg finjusterede denne del, så planen bliver ved med at føles realistisk.",
  ];
  return fallback[variant % fallback.length];
}

function postWorkoutCoachMessage(params: {
  firstName?: string;
  session: WorkoutSession | null;
}): { title: string; body: string } {
  const { firstName, session } = params;
  const title = firstName?.trim() ? `Godt arbejde, ${firstName.trim()}` : "Godt arbejde";

  if (!session) {
    return {
      title,
      body: "Du har gennemført træningspasset. Det giver os et godt udgangspunkt for næste skridt i programmet.",
    };
  }

  if (session.loadScore >= 7) {
    return {
      title,
      body: "Det var et mere krævende træningspas i dag. Derfor holder jeg næste skridt kontrolleret, så du kan bygge videre med overskud.",
    };
  }

  if (session.loadScore >= 4) {
    return {
      title,
      body: "Du kom godt gennem træningspasset i dag. Det tyder på, at du bygger formen op i et tempo, der giver mening.",
    };
  }

  return {
    title,
    body: "Du gennemførte et roligt og stabilt træningspas i dag. Det er præcis sådan, vi bygger kontinuitet og gode vaner op.",
  };
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("welcome");
  const [authMode, setAuthMode] = useState<AuthMode>("signup");
  const [hasSetup, setHasSetup] = useState(false);
  const [displayWeek, setDisplayWeek] = useState(1);
  const [appearance, setAppearance] = useState<ThemePref>("system");
  const [effectiveTheme, setEffectiveTheme] = useState<"dark" | "light">("dark");
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [onboardingSelections, setOnboardingSelections] = useState<OnboardingSelectionState>({
    runningAbility: false,
    goalDistance: false,
    goalType: false,
    activityLevel: false,
  });

  const [runnerProfile, setRunnerProfile] = useState<RunnerProfile>({
    firstName: "",
    heightCm: 175,
    weightKg: 75,
    age: 30,
    activityLevel: "moderat",
    runningExperience: "nybegynder",
    currentRunningAbility: "helt_ny",
    gender: undefined,
    userTrainingContext: "",
    currentWeeklyVolumeKm: 0,
    currentRunsPerWeek: 0,
    longestCurrentRunMin: 0,
    recentRaceTimes: [],
    injuryHistory: "",
    weakPoints: "",
    typicalWorkoutMinutes: 45,
    otherTraining: "",
    preferredGuidance: undefined,
  });
  const [goal, setGoal] = useState<Goal>({
    distance: "5K",
    goalType: "complete",
    weeks: 12,
    startDate: todayIso(),
    reminderTime: "13:00",
    targetTime: "",
    targetPaceSecPerKm: undefined,
    endDate: addDaysToIso(todayIso(), 84),
    availableTrainingDays: ["Tirsdag", "Torsdag", "Lordag"],
  });
  const [goalPaceDraft, setGoalPaceDraft] = useState<{ minute: string; second: string }>({ minute: "", second: "" });
  const [recentRaceDraft, setRecentRaceDraft] = useState<{ distance: Goal["distance"] | ""; time: string }>({ distance: "", time: "" });

  const [profileDraft, setProfileDraft] = useState({
    heightCm: "175",
    weightKg: "75",
    age: "30",
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [openInfoField, setOpenInfoField] = useState<InfoField>(null);

  const [profileId, setProfileId] = useState<string>("");
  const [baselinePlan, setBaselinePlan] = useState<TrainingPlan | null>(null);
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [runnerProfileInsights, setRunnerProfileInsights] = useState<RunnerProfileInsights | null>(null);
  const [coachExplanationSummary, setCoachExplanationSummary] = useState<string[]>([]);
  const [, setFeedbackInsights] = useState<FeedbackInsights | null>(null);
  const [capabilityState, setCapabilityState] = useState<CapabilityState | null>(null);
  const [runnerState, setRunnerState] = useState<RunnerState | null>(null);
  const [sessionHistory, setSessionHistory] = useState<SessionHistory>(() => createInitialSessionHistory());
  const [trainingBlock, setTrainingBlock] = useState<TrainingBlock>(() => createInitialTrainingBlock());
  const [sessionFeedbackMap, setSessionFeedbackMap] = useState<SessionFeedbackMap>({});
  const [adjustmentLog, setAdjustmentLog] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [isRunning, setIsRunning] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(false);
  const [audioMode, setAudioMode] = useState<AudioMode>("coach");
  const [ttsSupported, setTtsSupported] = useState(false);
  const [cueFallbackText, setCueFallbackText] = useState("");
  const [stepIndex, setStepIndex] = useState(0);
  const [remainingSec, setRemainingSec] = useState(0);
  const [workoutCompleted, setWorkoutCompleted] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [stepNotice, setStepNotice] = useState("");
  const [safetyAdjustments, setSafetyAdjustments] = useState<string[]>([]);
  const [planWarnings, setPlanWarnings] = useState<string[]>([]);
  const [showAllSafety, setShowAllSafety] = useState(false);
  const [planTradeoff, setPlanTradeoff] = useState<string | null>(null);
  const [planFeasibilityStatus, setPlanFeasibilityStatus] = useState<"feasible" | "feasible_with_adjustments" | "not_feasible">("feasible");
  const [feedbackConfirmation, setFeedbackConfirmation] = useState<CoachInterpretationState | null>(null);
  const [feedbackSubmitState, setFeedbackSubmitState] = useState<"idle" | "submitting" | "success">("idle");
  const [showProgramIntro, setShowProgramIntro] = useState(false);
  const [isProgramTransitioning, setIsProgramTransitioning] = useState(false);
  const [showDetailedFeedback, setShowDetailedFeedback] = useState(false);
  const [clarificationDraft, setClarificationDraft] = useState("");

  const [feedback, setFeedback] = useState<WorkoutFeedbackInput>({
    quickFeedback: undefined,
    effort: 6,
    completionPct: 100,
    energy: 3,
    painLevel: 1,
    notes: "",
  });
  const [feedbackDraft, setFeedbackDraft] = useState({
    effort: "6",
    completionPct: "100",
    energy: "3",
    painLevel: "1",
  });

  const lastSpokenStepKey = useRef<string>("");
  const thirtySecCueKey = useRef<string>("");
  const feedbackSuccessTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const programWeekRef = useRef<HTMLDivElement | null>(null);
  const todayPrimaryCtaRef = useRef<HTMLButtonElement | null>(null);
  const preAdaptationPlanRef = useRef<TrainingPlan | null>(null);
  const recentFeedbackRef = useRef<CoachWorkoutFeedback[]>([]);
  const recentCapabilityRef = useRef<CapabilityState[]>([]);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [restDayPrompt, setRestDayPrompt] = useState<{ dateLabel: string; showIdeas: boolean } | null>(null);
  const [showStickyProgramCta, setShowStickyProgramCta] = useState(true);

  const resetProgramState = useCallback(() => {
    setHasSetup(false);
    setProfileId("");
    setBaselinePlan(null);
    setPlan(null);
    setRunnerProfileInsights(null);
    setCoachExplanationSummary([]);
    setFeedbackInsights(null);
    setCapabilityState(null);
    setRunnerState(null);
    setSessionHistory(createInitialSessionHistory());
    setTrainingBlock(createInitialTrainingBlock());
    setSessionFeedbackMap({});
    setAdjustmentLog([]);
    setSelectedSessionId("");
    setPlanTradeoff(null);
    setPlanWarnings([]);
    setSafetyAdjustments([]);
    setShowProgramIntro(false);
    setFeedbackConfirmation(null);
    preAdaptationPlanRef.current = null;
    recentFeedbackRef.current = [];
    recentCapabilityRef.current = [];
    setClarificationDraft("");
    setWorkoutCompleted(false);
    setCompletedSteps([]);
    setStepNotice("");
    setDisplayWeek(1);
  }, []);

  const resetAppState = useCallback(async () => {
    const currentUserId = authUser?.id;

    if (currentUserId && !isDemoMode) {
      try {
        await fetch("/api/auth/logout", { method: "POST" });
      } catch {
        // Keep the local reset reliable even if the auth endpoint is unavailable.
      }
    }

    cancelCue();
    resetProgramState();
    setMenuOpen(false);
    setAuthUser(null);
    setIsDemoMode(false);
    setStage("welcome");
    setAuthMode("signup");
    setAppearance("system");
    setAudioMode("coach");
    setEmail("");
    setPassword("");
    setError(null);
    setIsRunning(false);
    setSpeechEnabled(false);
    setCueFallbackText("");
    setStepIndex(0);
    setRemainingSec(0);
    setOnboardingStep(1);
    setOnboardingSelections({
      runningAbility: false,
      goalDistance: false,
      goalType: false,
      activityLevel: false,
    });
    setOpenInfoField(null);
    setRestDayPrompt(null);
    setShowAllSafety(false);
    setShowStickyProgramCta(true);
    setPlanFeasibilityStatus("feasible");
    setShowDetailedFeedback(false);
    setFeedbackSubmitState("idle");
    setFeedback({
      quickFeedback: undefined,
      effort: 6,
      completionPct: 100,
      energy: 3,
      painLevel: 1,
      notes: "",
    });
    setFeedbackDraft({
      effort: "6",
      completionPct: "100",
      energy: "3",
      painLevel: "1",
    });
    setRunnerProfile({
      firstName: "",
      heightCm: 175,
      weightKg: 75,
      age: 30,
      activityLevel: "moderat",
      runningExperience: "nybegynder",
      currentRunningAbility: "helt_ny",
      gender: undefined,
      userTrainingContext: "",
      currentWeeklyVolumeKm: 0,
      currentRunsPerWeek: 0,
      longestCurrentRunMin: 0,
      recentRaceTimes: [],
      injuryHistory: "",
      weakPoints: "",
      typicalWorkoutMinutes: 45,
      otherTraining: "",
      preferredGuidance: undefined,
    });
    setProfileDraft({
      heightCm: "175",
      weightKg: "75",
      age: "30",
    });
    setGoal({
      distance: "5K",
      goalType: "complete",
      weeks: 12,
      startDate: todayIso(),
      reminderTime: "13:00",
      targetTime: "",
      targetPaceSecPerKm: undefined,
      endDate: addDaysToIso(todayIso(), 84),
      availableTrainingDays: ["Tirsdag", "Torsdag", "Lordag"],
    });

    if (typeof window !== "undefined") {
      const keysToRemove: string[] = [];
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (!key) continue;
        if (
          key.startsWith("stridepilot") ||
          key.startsWith("runnerCoachHasSetup:") ||
          key.startsWith("runnerCoachProfileId:") ||
          key.startsWith("stridepilotCapability:")
        ) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => window.localStorage.removeItem(key));
    }
  }, [authUser?.id, isDemoMode, resetProgramState]);

  const activeSession = useMemo(
    () => plan?.sessions.find((session) => session.id === selectedSessionId) ?? null,
    [plan, selectedSessionId],
  );
  const activeSessionFeedback = useMemo(
    () => (activeSession ? sessionFeedbackMap[activeSession.id] ?? null : null),
    [activeSession, sessionFeedbackMap],
  );
  const currentStep = activeSession?.steps[stepIndex];
  const activeUserId = authUser?.id ?? (isDemoMode ? "demo-user" : profileId || "");
  const goalDestinationSession = useMemo(() => {
    if (!plan?.sessions.length) return null;
    return plan.sessions.find((session) => /Måldag|test/i.test(session.title)) ?? plan.sessions[plan.sessions.length - 1];
  }, [plan]);
  const trainingDayRecommendation = useMemo(
    () => recommendTrainingDays(runnerProfile, goal),
    [goal, runnerProfile],
  );
  const derivedPlanWeeks = useMemo(() => derivePlanWeeks(goal.startDate, goal.endDate), [goal.endDate, goal.startDate]);
  const feedbackSubmitted = Boolean(feedbackConfirmation);
  const baselineWeeklyLoad = useMemo(() => (baselinePlan ? buildWeeklyLoad(baselinePlan, goal.startDate) : []), [baselinePlan, goal.startDate]);
  const currentWeeklyLoad = useMemo(() => (plan ? buildWeeklyLoad(plan, goal.startDate) : []), [goal.startDate, plan]);
  const maxWeeklyLoad = useMemo(() => {
    const allLoads = [...baselineWeeklyLoad, ...currentWeeklyLoad].map((point) => point.load);
    return allLoads.length ? Math.max(...allLoads, 1) : 1;
  }, [baselineWeeklyLoad, currentWeeklyLoad]);
  const longestRunNow = currentWeeklyLoad.reduce((longest, point) => Math.max(longest, point.longestContinuousRunSec), 0);
  const currentWeekLoad = currentWeeklyLoad.find((point) => point.week === displayWeek) ?? currentWeeklyLoad[0] ?? null;
  const graphSeries = useMemo(() => {
    const chartWidth = 300;
    const chartHeight = 120;
    const padding = 18;

    function toPoints(series: typeof currentWeeklyLoad) {
      if (series.length === 0) return [];
      return series.map((point, index) => ({
        x: padding + (index / Math.max(series.length - 1, 1)) * (chartWidth - padding * 2),
        y: chartHeight - padding - (point.load / maxWeeklyLoad) * (chartHeight - padding * 2),
      }));
    }

    return {
      width: chartWidth,
      height: chartHeight,
      baselinePath: linePath(toPoints(baselineWeeklyLoad)),
      currentPath: linePath(toPoints(currentWeeklyLoad)),
    };
  }, [baselineWeeklyLoad, currentWeeklyLoad, maxWeeklyLoad]);
  const finishWorkout = useCallback(() => {
    cancelCue();
    setIsRunning(false);
    setWorkoutCompleted(true);
    const cue = "Godt løbet. Passet er gennemført.";
    setCueFallbackText(cue);
    if (audioMode !== "off" && ttsSupported && speechEnabled) {
      speakCue(cue);
    }
  }, [audioMode, speechEnabled, ttsSupported]);

  useEffect(() => {
    return () => {
      if (feedbackSuccessTimeout.current) {
        clearTimeout(feedbackSuccessTimeout.current);
      }
    };
  }, []);

  const weekNumber = useMemo(() => {
    if (!plan) return 1;
    const now = new Date();
    const computedWeek = calendarWeekIndexFromDate(goal.startDate, now);
    return Math.max(1, Math.min(plan.weeks, computedWeek));
  }, [goal.startDate, plan]);

  const calendarWeekDates = useMemo(() => {
    return calendarWeekDatesForIndex(goal.startDate, displayWeek);
  }, [goal.startDate, displayWeek]);

  const sessionsByDate = useMemo(() => {
    if (!plan) return new Map<string, WorkoutSession>();
    const byDate = new Map<string, WorkoutSession>();
    const weekSessions = visiblePlanSessions(plan, goal.startDate).filter((session) => {
      return calendarWeekIndexFromDate(goal.startDate, sessionDateFromPlan(goal.startDate, session)) === displayWeek;
    });
    weekSessions.forEach((session) => {
      byDate.set(sessionDateFromPlan(goal.startDate, session).toISOString().slice(0, 10), session);
    });
    return byDate;
  }, [goal.startDate, plan, displayWeek]);

  const nextSession = useMemo(() => {
    if (!plan) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sorted = [...visiblePlanSessions(plan, goal.startDate)].sort((a, b) => {
      return sessionDateFromPlan(goal.startDate, a).getTime() - sessionDateFromPlan(goal.startDate, b).getTime();
    });

    const upcoming = sorted.find((session) => sessionDateFromPlan(goal.startDate, session).getTime() > today.getTime());
    return upcoming ?? null;
  }, [goal.startDate, plan]);
  const todaySession = useMemo(() => {
    if (!plan) return null;
    const today = new Date();
    return (
      visiblePlanSessions(plan, goal.startDate).find((session) => sessionDateFromPlan(goal.startDate, session).toDateString() === today.toDateString()) ?? null
    );
  }, [goal.startDate, plan]);

  const stepProgress = useMemo(() => {
    if (!activeSession || !currentStep) return 0;

    const totalSessionSec = activeSession.steps.reduce((sum, step) => sum + step.durationSec, 0);
    const completedBeforeCurrent = activeSession.steps.slice(0, stepIndex).reduce((sum, step) => sum + step.durationSec, 0);
    const currentCompleted = currentStep.durationSec - remainingSec;

    return Math.min(100, Math.max(0, ((completedBeforeCurrent + currentCompleted) / totalSessionSec) * 100));
  }, [activeSession, currentStep, stepIndex, remainingSec]);

  const hydrateProgramState = useCallback(
    async (currentProfileId: string) => {
      const res = await fetch("/api/plan/current");
      if (!res.ok) return false;

      const data = (await res.json()) as {
        plan?: TrainingPlan;
        baselinePlan?: TrainingPlan;
        goal?: Goal;
        profile?: Partial<RunnerProfile>;
        explanationSummary?: string[];
        sessionFeedback?: SavedWorkoutSessionFeedback[];
      };

      if (!data.plan) return false;

      setPlan(data.plan);
      setBaselinePlan(data.baselinePlan ?? data.plan);
      setSelectedSessionId(data.plan.sessions[0]?.id ?? "");
      if (data.goal) {
        setGoal((current) => ({
          ...current,
          ...data.goal,
        }));
      }
      if (data.profile) {
        setRunnerProfile((current) => ({
          ...current,
          ...data.profile,
        }));
      }
      setCoachExplanationSummary(data.explanationSummary ?? []);
      setSessionFeedbackMap((current) => {
        const next = { ...current };
        for (const entry of data.sessionFeedback ?? []) {
          const existing = current[entry.sessionId];
          next[entry.sessionId] = {
            ...entry,
            quickFeedback: entry.quickFeedback ?? existing?.quickFeedback,
            notes: entry.notes ?? existing?.notes,
          };
        }
        return next;
      });

      const userKey = activeUserId || currentProfileId;
      if (userKey) {
        const savedName = window.localStorage.getItem(firstNameKey(userKey));
        if (savedName) {
          setRunnerProfile((current) => ({ ...current, firstName: savedName }));
        }
      }

      return true;
    },
    [activeUserId],
  );

  useEffect(() => {
    const savedAudioMode = window.localStorage.getItem("stridepilotAudioMode");
    const savedAppearance = window.localStorage.getItem("stridepilotAppearance");
    if (savedAudioMode === "off" || savedAudioMode === "short" || savedAudioMode === "coach") {
      setAudioMode(savedAudioMode);
    }
    if (savedAppearance === "dark" || savedAppearance === "light" || savedAppearance === "system") {
      setAppearance(savedAppearance);
    }
    setTtsSupported(isSpeechSupported());

    async function bootstrapAuth() {
      const meRes = await fetch("/api/auth/me");
      if (!meRes.ok) return;

      const meData = (await meRes.json()) as {
        authenticated: boolean;
        user?: AuthUser;
        profileId?: string | null;
      };

      if (meData.authenticated && meData.user) {
        setAuthUser(meData.user);
        window.localStorage.removeItem("stridepilotDemoMode");
        const savedName = window.localStorage.getItem(firstNameKey(meData.user.id));
        if (savedName) {
          setRunnerProfile((current) => ({ ...current, firstName: savedName }));
        }
        const hasProfile = Boolean(meData.profileId);
        setHasSetup(hasProfile);
        if (hasProfile && meData.profileId) {
          setProfileId(meData.profileId);
          window.localStorage.setItem(profileKey(meData.user.id), meData.profileId);
          window.localStorage.setItem(setupKey(meData.user.id), "1");
          const hasPlan = await hydrateProgramState(meData.profileId);
          setStage(hasPlan ? "program" : "profile");
        } else {
          window.localStorage.removeItem(setupKey(meData.user.id));
          window.localStorage.removeItem(profileKey(meData.user.id));
          setStage(window.localStorage.getItem(introSeenKey(meData.user.id)) === "1" ? "profile" : "intro");
        }
      }
    }

    bootstrapAuth().catch(() => undefined);

    const demoMode = window.localStorage.getItem("stridepilotDemoMode") === "1";
    if (demoMode) {
      const demoSetupDone = window.localStorage.getItem(setupKey("demo-user")) === "1";
      const localProfileId = window.localStorage.getItem(profileKey("demo-user")) ?? "demo-profile";
      setIsDemoMode(true);
      setAuthUser({ id: "demo-user", email: "demo@stridepilot.app", isDemo: true });
      setProfileId(localProfileId);
      setHasSetup(demoSetupDone);
      const savedName = window.localStorage.getItem(firstNameKey("demo-user"));
      if (savedName) {
        setRunnerProfile((current) => ({ ...current, firstName: savedName }));
      }
      setStage(demoSetupDone ? "program" : window.localStorage.getItem(introSeenKey("demo-user")) === "1" ? "profile" : "intro");
    }
  }, [hydrateProgramState]);

  useEffect(() => {
    window.localStorage.setItem("stridepilotAudioMode", audioMode);
    if (audioMode === "off") {
      cancelCue();
    }
  }, [audioMode]);

  useEffect(() => {
    window.localStorage.setItem("stridepilotAppearance", appearance);
  }, [appearance]);

  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
    const applyTheme = () => {
      setEffectiveTheme(appearance === "system" ? (mediaQuery.matches ? "light" : "dark") : appearance);
    };

    applyTheme();
    mediaQuery.addEventListener("change", applyTheme);
    return () => mediaQuery.removeEventListener("change", applyTheme);
  }, [appearance]);

  useEffect(() => {
    const themeBackground = effectiveTheme === "light" ? "#eef3f7" : "#0b0f14";
    const themeForeground = effectiveTheme === "light" ? "#11202c" : "#f2f5f7";

    document.documentElement.style.backgroundColor = themeBackground;
    document.documentElement.style.colorScheme = effectiveTheme;
    document.body.style.backgroundColor = themeBackground;
    document.body.style.color = themeForeground;

    let themeMeta = document.querySelector('meta[name="theme-color"]');
    if (!themeMeta) {
      themeMeta = document.createElement("meta");
      themeMeta.setAttribute("name", "theme-color");
      document.head.appendChild(themeMeta);
    }
    themeMeta.setAttribute("content", themeBackground);
  }, [effectiveTheme]);

  useEffect(() => {
    if (!plan) return;
    setDisplayWeek(weekNumber);
  }, [plan, weekNumber]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [stage]);

  useEffect(() => {
    if (!activeUserId) return;
    if (runnerProfile.firstName?.trim()) {
      window.localStorage.setItem(firstNameKey(activeUserId), runnerProfile.firstName.trim());
    }
  }, [activeUserId, runnerProfile.firstName]);

  useEffect(() => {
    if (!profileId) {
      setCapabilityState(null);
      return;
    }

    const saved = window.localStorage.getItem(capabilityStorageKey(profileId));
    if (!saved) {
      setCapabilityState(null);
      return;
    }

    try {
      setCapabilityState(JSON.parse(saved) as CapabilityState);
    } catch {
      window.localStorage.removeItem(capabilityStorageKey(profileId));
      setCapabilityState(null);
    }
  }, [profileId]);

  useEffect(() => {
    if (!profileId || !capabilityState) return;
    window.localStorage.setItem(capabilityStorageKey(profileId), JSON.stringify(capabilityState));
  }, [profileId, capabilityState]);

  useEffect(() => {
    if (!profileId) {
      setSessionFeedbackMap({});
      return;
    }

    const saved = window.localStorage.getItem(sessionFeedbackStorageKey(profileId));
    if (!saved) return;

    try {
      setSessionFeedbackMap((current) => {
        if (Object.keys(current).length > 0) return current;
        return JSON.parse(saved) as SessionFeedbackMap;
      });
    } catch {
      window.localStorage.removeItem(sessionFeedbackStorageKey(profileId));
    }
  }, [profileId]);

  useEffect(() => {
    if (!profileId) return;
    window.localStorage.setItem(sessionFeedbackStorageKey(profileId), JSON.stringify(sessionFeedbackMap));
  }, [profileId, sessionFeedbackMap]);

  useEffect(() => {
    if (stage !== "program" || !activeUserId) return;
    const seen = window.localStorage.getItem(programSeenKey(activeUserId)) === "1";
    setShowProgramIntro(!seen);
    if (!seen) {
      window.localStorage.setItem(programSeenKey(activeUserId), "1");
    }
  }, [stage, activeUserId]);

  useEffect(() => {
    if (stage === "profile") {
      setOnboardingStep(1);
      setOnboardingSelections({
        runningAbility: hasSetup,
        goalDistance: hasSetup,
        goalType: hasSetup,
        activityLevel: hasSetup,
      });
    }
  }, [stage, hasSetup]);

  useEffect(() => {
    setProfileDraft({
      heightCm: String(runnerProfile.heightCm),
      weightKg: String(runnerProfile.weightKg),
      age: String(runnerProfile.age),
    });
  }, [runnerProfile.heightCm, runnerProfile.weightKg, runnerProfile.age]);

  useEffect(() => {
    const derivedWeeks = derivePlanWeeks(goal.startDate, goal.endDate);
    if (!derivedWeeks || goal.weeks === derivedWeeks) return;
    setGoal((current) => ({ ...current, weeks: derivedWeeks }));
  }, [goal.endDate, goal.startDate, goal.weeks]);

  useEffect(() => {
    const firstRecentRace = runnerProfile.recentRaceTimes?.[0];
    const nextDraft: { distance: Goal["distance"] | ""; time: string } = firstRecentRace
      ? { distance: firstRecentRace.distance, time: firstRecentRace.time }
      : { distance: "", time: "" };

    if (recentRaceDraft.distance === nextDraft.distance && recentRaceDraft.time === nextDraft.time) return;
    setRecentRaceDraft(nextDraft);
  }, [recentRaceDraft.distance, recentRaceDraft.time, runnerProfile.recentRaceTimes]);

  useEffect(() => {
    if (!shouldShowGoalPaceInput(goal.goalType)) {
      if (goalPaceDraft.minute || goalPaceDraft.second) {
        setGoalPaceDraft({ minute: "", second: "" });
      }
      return;
    }

    if (!goal.targetPaceSecPerKm) return;

    const nextDraft = pacePickerValuesFromSeconds(goal.targetPaceSecPerKm);
    if (goalPaceDraft.minute === nextDraft.minute && goalPaceDraft.second === nextDraft.second) return;
    setGoalPaceDraft(nextDraft);
  }, [goal.goalType, goal.targetPaceSecPerKm, goalPaceDraft.minute, goalPaceDraft.second]);

  useEffect(() => {
    if (!shouldShowGoalPaceInput(goal.goalType)) {
      if (!goal.targetPaceSecPerKm && !goal.targetTime) return;
      setGoal((current) => ({ ...current, targetPaceSecPerKm: undefined, targetTime: "" }));
      return;
    }

    const nextTargetTime = targetTimeFromPace(goal.distance, goal.targetPaceSecPerKm);
    if (goal.targetTime === nextTargetTime) return;
    setGoal((current) => ({ ...current, targetTime: nextTargetTime }));
  }, [goal.distance, goal.goalType, goal.targetPaceSecPerKm, goal.targetTime]);

  useEffect(() => {
    setFeedbackDraft({
      effort: String(feedback.effort),
      completionPct: String(feedback.completionPct),
      energy: String(feedback.energy),
      painLevel: String(feedback.painLevel),
    });
  }, [feedback.effort, feedback.completionPct, feedback.energy, feedback.painLevel]);

  useEffect(() => {
    if (!plan || plan.sessions.length === 0) return;
    if (!selectedSessionId) {
      setSelectedSessionId(plan.sessions[0].id);
    }
  }, [plan, selectedSessionId]);

  useEffect(() => {
    if (!activeSession) return;
    setStepIndex(0);
    setRemainingSec(activeSession.steps[0].durationSec);
    setIsRunning(false);
    setWorkoutCompleted(false);
    setCompletedSteps([]);
    setStepNotice("");
    setFeedbackConfirmation(null);
    setFeedbackSubmitState("idle");
    setShowDetailedFeedback(false);
    lastSpokenStepKey.current = "";
    thirtySecCueKey.current = "";
  }, [activeSession]);

  useEffect(() => {
    if (!stepNotice) return;
    const timeout = window.setTimeout(() => setStepNotice(""), 1200);
    return () => window.clearTimeout(timeout);
  }, [stepNotice]);

  useEffect(() => {
    if (stage !== "workout") {
      cancelCue();
    }
  }, [stage]);

  useEffect(() => {
    if (!isRunning || !activeSession) return;
    const interval = window.setInterval(() => {
      setRemainingSec((prev) => Math.max(prev - 1, 0));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isRunning, activeSession]);

  useEffect(() => {
    if (!activeSession || !currentStep || audioMode === "off") return;
    const key = `${activeSession.id}-${stepIndex}`;
    if (lastSpokenStepKey.current === key) return;

    lastSpokenStepKey.current = key;
    const cue = buildCue(currentStep, audioMode);
    setCueFallbackText(cue);

    if (!ttsSupported || !speechEnabled) return;
    if (!speakCue(cue)) {
      setCueFallbackText(cue);
    }
  }, [activeSession, currentStep, speechEnabled, stepIndex, audioMode, ttsSupported]);

  useEffect(() => {
    if (!activeSession || !currentStep || audioMode === "off" || remainingSec !== 30) return;

    const key = `${activeSession.id}-${stepIndex}`;
    if (thirtySecCueKey.current === key) return;

    thirtySecCueKey.current = key;
    const cue = audioMode === "coach" ? "30 sekunder tilbage. Hold fokus på rytmen." : "30 sekunder tilbage";
    setCueFallbackText(cue);
    if (ttsSupported && speechEnabled) {
      speakCue(cue);
    }
  }, [activeSession, currentStep, remainingSec, speechEnabled, stepIndex, audioMode, ttsSupported]);

  useEffect(() => {
    if (!activeSession || remainingSec > 0) return;

    const nextStep = stepIndex + 1;
    setCompletedSteps((prev) => (prev.includes(stepIndex) ? prev : [...prev, stepIndex]));
    if (nextStep >= activeSession.steps.length) {
      finishWorkout();
      return;
    }

    setStepIndex(nextStep);
    setRemainingSec(activeSession.steps[nextStep].durationSec);
  }, [remainingSec, stepIndex, activeSession, finishWorkout]);

  function startFlow() {
    setError(null);
    if (!hasSetup || !authUser) {
      setStage("auth");
      return;
    }
    setStage("program");
  }

  async function register() {
    setError(null);
    if (password.length < 8) {
      setError("Adgangskoden skal være mindst 8 tegn.");
      return;
    }

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (res.status === 409) {
        setError("Der findes allerede en konto med denne e-mail. Prøv at logge ind.");
        return;
      }
      if (res.status === 400) {
        setError("Ugyldig e-mail eller adgangskode. Adgangskoden skal være mindst 8 tegn.");
        return;
      }
      setError(payload?.error ? `Kunne ikke oprette konto: ${payload.error}` : "Kunne ikke oprette konto lige nu.");
      return;
    }

    const data = (await res.json()) as { user: AuthUser };
    resetProgramState();
    setIsDemoMode(false);
    setAuthUser(data.user);
    window.localStorage.removeItem("stridepilotDemoMode");
    window.localStorage.removeItem(setupKey(data.user.id));
    window.localStorage.removeItem(profileKey(data.user.id));
    setStage(window.localStorage.getItem(introSeenKey(data.user.id)) === "1" ? "profile" : "intro");
  }

  async function login() {
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      setError("Login fejlede.");
      return;
    }

    const data = (await res.json()) as { user: AuthUser };
    resetProgramState();
    setIsDemoMode(false);
    setAuthUser(data.user);
    window.localStorage.removeItem("stridepilotDemoMode");
    const savedName = window.localStorage.getItem(firstNameKey(data.user.id));
    if (savedName) {
      setRunnerProfile((current) => ({ ...current, firstName: savedName }));
    }

    let hasProfile = false;
    let hasPlan = false;
    const meRes = await fetch("/api/auth/me");
    if (meRes.ok) {
      const meData = (await meRes.json()) as { profileId?: string | null };
      if (meData.profileId) {
        hasProfile = true;
        setProfileId(meData.profileId);
        window.localStorage.setItem(profileKey(data.user.id), meData.profileId);
        window.localStorage.setItem(setupKey(data.user.id), "1");
        hasPlan = await hydrateProgramState(meData.profileId);
      }
    }

    setHasSetup(hasProfile);
    if (!hasProfile) {
      window.localStorage.removeItem(setupKey(data.user.id));
      window.localStorage.removeItem(profileKey(data.user.id));
    }
    setStage(hasProfile ? (hasPlan ? "program" : "profile") : window.localStorage.getItem(introSeenKey(data.user.id)) === "1" ? "profile" : "intro");
  }

  async function logout() {
    setError(null);
    if (!isDemoMode) {
      await fetch("/api/auth/logout", { method: "POST" });
    }
    const userId = authUser?.id;
    resetProgramState();
    setAuthUser(null);
    setIsDemoMode(false);
    if (userId) {
      window.localStorage.removeItem(setupKey(userId));
      window.localStorage.removeItem(profileKey(userId));
    }
    window.localStorage.removeItem(setupKey("demo-user"));
    window.localStorage.removeItem(profileKey("demo-user"));
    window.localStorage.removeItem("stridepilotDemoMode");
    setStage("auth");
  }

  function startDemoMode() {
    setError(null);
    resetProgramState();
    setAuthUser({ id: "demo-user", email: "demo@stridepilot.app", isDemo: true });
    setIsDemoMode(true);
    setProfileId("demo-profile");
    window.localStorage.setItem("stridepilotDemoMode", "1");
    window.localStorage.removeItem(setupKey("demo-user"));
    window.localStorage.setItem(profileKey("demo-user"), "demo-profile");
    setStage(window.localStorage.getItem(introSeenKey("demo-user")) === "1" ? "profile" : "intro");
  }

  async function generatePlan() {
    setError(null);
    setFeedbackConfirmation(null);
    setPlanTradeoff(null);
    const trimmedFirstName = runnerProfile.firstName?.trim() ?? "";

    if (trimmedFirstName !== runnerProfile.firstName) {
      setRunnerProfile((current) => ({ ...current, firstName: trimmedFirstName }));
    }

    if (!goal.availableTrainingDays || goal.availableTrainingDays.length === 0) {
      setError("Vælg mindst én træningsdag for at generere programmet.");
      return;
    }

    if (!isValidIsoDate(goal.startDate)) {
      setError("Vælg en gyldig startdato, før jeg bygger programmet.");
      return;
    }

    if (!goal.endDate || !isValidIsoDate(goal.endDate)) {
      setError("Vælg en gyldig måldato eller racedato, før jeg bygger programmet.");
      return;
    }

    const calculatedWeeks = derivePlanWeeks(goal.startDate, goal.endDate);
    if (!calculatedWeeks) {
      setError("Startdato og måldato skal give en realistisk tidsramme.");
      return;
    }

    if ((goal.goalType === "target_time" || goal.goalType === "pr") && !goal.targetPaceSecPerKm) {
      setError("Vælg et ønsket tempo, hvis du går efter et bestemt tempo eller en PR.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runnerProfile,
          goal: {
            ...goal,
            targetTime: shouldShowGoalPaceInput(goal.goalType) ? targetTimeFromPace(goal.distance, goal.targetPaceSecPerKm) : "",
            weeks: calculatedWeeks,
          },
          profileId: isDemoMode ? undefined : profileId || undefined,
          runsPerWeek: goal.availableTrainingDays.length,
          demoMode: isDemoMode,
        }),
      });

      if (!res.ok) {
        const problem = (await res.json().catch(() => null)) as { message?: string; warnings?: string[] } | null;
        if (problem?.message) {
          const warningText = problem.warnings?.length ? ` ${problem.warnings.join(" ")}` : "";
          setError(`${problem.message}${warningText}`);
          return;
        }
        throw new Error("Fejl under generering af plan.");
      }

      const data = (await res.json()) as {
        plan: TrainingPlan;
        baselinePlan?: TrainingPlan;
        currentPlanView?: TrainingPlan;
        runnerProfileInsights?: RunnerProfileInsights;
        explanationSummary?: string[];
        feedbackInsights?: FeedbackInsights[];
        persistence?: { profileId?: string };
        warnings?: string[];
        safetyAdjustments?: Array<{ type: string; detail: string }>;
        feasibleStatus?: "feasible" | "feasible_with_adjustments" | "not_feasible";
        tradeoffExplanation?: string;
      };

      const nextBaseline = data.baselinePlan ?? data.plan;
      const nextCurrent = data.currentPlanView ?? data.plan;
      setBaselinePlan(nextBaseline);
      setPlan(nextCurrent);
      setSessionFeedbackMap({});
      setRunnerProfileInsights(data.runnerProfileInsights ?? null);
      setCoachExplanationSummary(data.explanationSummary ?? []);
      setFeedbackInsights(data.feedbackInsights?.[0] ?? null);
      setAdjustmentLog([]);
      setPlanWarnings(data.warnings ?? []);
      setSafetyAdjustments((data.safetyAdjustments ?? []).map((entry) => entry.detail));
      setShowAllSafety(false);
      setPlanTradeoff(data.tradeoffExplanation ?? null);
      setPlanFeasibilityStatus(data.feasibleStatus ?? "feasible");
      setSelectedSessionId(nextCurrent.sessions[0]?.id ?? "");
      const storageUserId = authUser?.id ?? (isDemoMode ? "demo-user" : data.persistence?.profileId ?? profileId);

      if (data.persistence?.profileId) {
        setProfileId(data.persistence.profileId);
        if (storageUserId) {
          window.localStorage.setItem(profileKey(storageUserId), data.persistence.profileId);
        }
      }

      if (storageUserId && trimmedFirstName) {
        window.localStorage.setItem(firstNameKey(storageUserId), trimmedFirstName);
      }
      if (storageUserId) {
        window.localStorage.removeItem(programSeenKey(storageUserId));
      }

      setHasSetup(true);
      if (storageUserId) {
        window.localStorage.setItem(setupKey(storageUserId), "1");
      }
      setStage("intermezzo");
    } catch {
      setError("Kunne ikke generere plan lige nu.");
    } finally {
      setIsLoading(false);
    }
  }

  async function submitFeedback() {
    if (!activeSession || !plan) {
      setError("Mangler aktivt træningspas eller program.");
      return;
    }

    if (feedbackSubmitState === "submitting") return;

    setError(null);
    setFeedbackSubmitState("submitting");
    const currentCapability = capabilityState ?? createInitialCapabilityState(plan);
    const currentRunnerState = runnerState ?? createInitialRunnerState(currentCapability);
    const currentTrainingBlock = trainingBlock;
    const currentSessionHistory = sessionHistory;
    const coachFeedback = buildAdaptiveWorkoutFeedback(activeSession.id, feedback);
    const previewCapability = updateCapability(currentCapability, coachFeedback);
    const nextRunnerState = updateRunnerState(currentRunnerState, coachFeedback, previewCapability);
    const nextSessionHistory = updateSessionHistory(currentSessionHistory, coachFeedback);
    const nextRecentFeedback = [...recentFeedbackRef.current, coachFeedback].slice(-3);
    const nextRecentCapability = [...recentCapabilityRef.current, previewCapability].slice(-3);
    const trend = evaluateTrainingTrend(nextRecentFeedback, nextRecentCapability);
    const decision = evaluateRunnerState(nextRunnerState, trend);
    const nextTrainingBlock = updateTrainingBlock(currentTrainingBlock, decision);
    preAdaptationPlanRef.current = plan;
    const activeIndex = plan.sessions.findIndex((session) => session.id === activeSession.id);
    const upcomingPlan: TrainingPlan =
      activeIndex >= 0
        ? {
            ...plan,
            sessions: plan.sessions.slice(activeIndex + 1),
          }
        : plan;

    const adapted = adaptPlanFromFeedback(upcomingPlan, coachFeedback, currentCapability);
    const updatedPlan = mergeAdaptedUpcomingSessions(plan, activeSession.id, adapted.plan);
    const adaptiveCopy = detectAdaptivePlanChange(plan, updatedPlan);
    const responseCopy = buildFeedbackResponseCopy({
      rationale: adapted.rationale,
      feedback: {
        quickFeedback: feedback.quickFeedback,
        completionPct: feedback.completionPct,
        effort: feedback.effort,
        energy: feedback.energy,
        painLevel: feedback.painLevel,
      },
    });
    const savedEntry: SavedWorkoutSessionFeedback = {
      sessionId: activeSession.id,
      status: savedFeedbackStatus(feedback.completionPct),
      quickFeedback: feedback.quickFeedback,
      effort: feedback.effort,
      completionPct: feedback.completionPct,
      energy: feedback.energy,
      painLevel: feedback.painLevel,
      notes: feedback.notes.trim() || undefined,
      submittedAt: new Date().toISOString(),
    };

    setFeedbackInsights(null);
    setCapabilityState(adapted.capability);
    setRunnerState(nextRunnerState);
    setSessionHistory(nextSessionHistory);
    setTrainingBlock(nextTrainingBlock);
    setPlan(updatedPlan);
    setSessionFeedbackMap((current) => ({
      ...current,
      [activeSession.id]: savedEntry,
    }));
    recentFeedbackRef.current = nextRecentFeedback;
    recentCapabilityRef.current = [...recentCapabilityRef.current, adapted.capability].slice(-3);
    setFeedbackConfirmation({
      title: runnerProfile.firstName?.trim() ? `Tak for din feedback, ${runnerProfile.firstName.trim()}.` : "Tak for din feedback.",
      updatedLabel: "Opdateret efter din feedback",
      interpretation: responseCopy.interpretation,
      adjustment: responseCopy.adjustmentExplanation,
      progressionPreview: responseCopy.progressionPreview,
      focus: responseCopy.runnerFocus,
      learnedInsights: responseCopy.learnedInsights.length > 0 ? responseCopy.learnedInsights : learnedInsightLines(adapted.capability, updatedPlan),
    });
    if (adaptiveCopy.log) {
      setAdjustmentLog((prev) => [...prev, adaptiveCopy.log!]);
    }
    setFeedback({ quickFeedback: undefined, effort: 6, completionPct: 100, energy: 3, painLevel: 1, notes: "" });
    setShowDetailedFeedback(false);
    setClarificationDraft("");
    setFeedbackSubmitState("success");
    if (feedbackSuccessTimeout.current) {
      clearTimeout(feedbackSuccessTimeout.current);
    }
    feedbackSuccessTimeout.current = setTimeout(() => {
      setFeedbackSubmitState("idle");
    }, 2400);

    if (!profileId) {
      return;
    }

    if (isDemoMode) {
      return;
    }

    try {
      const res = await fetch("/api/workout-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId,
          workoutSessionId: activeSession.id,
          quickFeedback: feedback.quickFeedback,
          effort: feedback.effort,
          completionPct: feedback.completionPct,
          energy: feedback.energy,
          painLevel: feedback.painLevel,
          notes: feedback.notes,
          capabilityState: currentCapability,
        }),
      });

      if (!res.ok) return;

      const payload = (await res.json()) as {
        updatedPlan?: TrainingPlan;
        capabilityState?: CapabilityState;
      };

      if (payload.updatedPlan) {
        setPlan(payload.updatedPlan);
      }
      if (payload.capabilityState) {
        setCapabilityState(payload.capabilityState);
      }
    } catch {
      // The UI already holds a local saved copy, so a persistence miss should not break the workout flow.
    }
  }

  function handleCoachReply(reply: CoachReply) {
    if (!feedbackConfirmation) return;

    if (reply.replyType === "agree") {
      setFeedbackConfirmation((current) =>
        current
          ? {
              ...current,
              reply,
              resolution: "Godt — så holder jeg den justering.",
            }
          : current,
      );
      return;
    }

    if (reply.replyType === "disagree") {
      if (plan && activeSession && preAdaptationPlanRef.current) {
        setPlan(revertUpcomingSessionsAfterWorkout(plan, preAdaptationPlanRef.current, activeSession.id));
      }
      setFeedbackConfirmation((current) =>
        current
          ? {
              ...current,
              reply,
              updatedLabel: "Opdateret efter din afklaring",
              resolution: "Forstået — jeg ruller den seneste justering tilbage og holder planen uændret for nu.",
            }
          : current,
      );
      return;
    }

    setFeedbackConfirmation((current) =>
      current
        ? {
            ...current,
            reply,
            updatedLabel: "Opdateret efter din afklaring",
            resolution: "Tak — jeg har opdateret vurderingen med din note og holder næste skridt forsigtigt og konsistent.",
          }
        : current,
    );
    setClarificationDraft("");
  }

  async function downloadIcs() {
    if (!plan) return;

    const res = await fetch("/api/calendar/ics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plan,
        startDate: goal.startDate,
        startTime: goal.reminderTime ?? "13:00",
        calendarName: `Løbeplan ${goal.distance}`,
      }),
    });

    if (!res.ok) {
      setError("Kunne ikke oprette kalenderfil.");
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "stridepilot-plan.ics";
    link.click();
    URL.revokeObjectURL(url);
  }

  const canOpenAuthenticatedPages = Boolean(authUser);
  const canOpenProgram = Boolean(authUser && hasSetup);
  const canOpenWorkout = Boolean(plan);

  function completeIntro() {
    if (authUser?.id) {
      window.localStorage.setItem(introSeenKey(authUser.id), "1");
    }
    setStage("profile");
  }

  function openProgramFromIntermezzo() {
    const storageUserId = authUser?.id ?? (isDemoMode ? "demo-user" : profileId || "");
    setIsProgramTransitioning(true);
    window.setTimeout(() => {
      if (storageUserId) {
        window.localStorage.setItem(programSeenKey(storageUserId), "1");
      }
      setShowProgramIntro(false);
      setStage("program");
      setIsProgramTransitioning(false);
    }, 700);
  }

  function openStage(nextStage: Stage) {
    setStage(nextStage);
    setMenuOpen(false);
  }

  function openWorkoutSession(sessionId: string) {
    setSelectedSessionId(sessionId);
    setStage("workout");
  }

  function closeWorkoutSession() {
    setIsRunning(false);
    cancelCue();
    setStage("program");
  }

  function toggleTrainingDay(day: WorkoutSession["dayOfWeek"]) {
    setGoal((current) => {
      const currentDays = current.availableTrainingDays ?? [];
      const exists = currentDays.includes(day);
      if (exists) {
        return { ...current, availableTrainingDays: currentDays.filter((item) => item !== day) };
      }
      return { ...current, availableTrainingDays: [...currentDays, day] };
    });
  }

  function goToStep(index: number) {
    if (!activeSession) return;
    const safeIndex = clampInt(index, 0, activeSession.steps.length - 1);
    setIsRunning(false);
    cancelCue();
    setStepIndex(safeIndex);
    setRemainingSec(activeSession.steps[safeIndex].durationSec);
    setWorkoutCompleted(false);
    setCueFallbackText(buildCue(activeSession.steps[safeIndex], audioMode));
    lastSpokenStepKey.current = "";
    thirtySecCueKey.current = "";
  }

  function nextStep() {
    if (!activeSession) return;
    const wasRunning = isRunning;
    setCompletedSteps((prev) => (prev.includes(stepIndex) ? prev : [...prev, stepIndex]));
    if (stepIndex >= activeSession.steps.length - 1) {
      finishWorkout();
      return;
    }
    cancelCue();
    const next = stepIndex + 1;
    setStepNotice("Interval afsluttet");
    setStepIndex(next);
    setRemainingSec(activeSession.steps[next].durationSec);
    setCueFallbackText(buildCue(activeSession.steps[next], audioMode));
    lastSpokenStepKey.current = "";
    thirtySecCueKey.current = "";
    setIsRunning(wasRunning);
  }

  function previousStep() {
    if (!activeSession) return;
    goToStep(Math.max(stepIndex - 1, 0));
  }

  function setVisibleWeek(nextWeek: number, options?: { scrollIntoView?: boolean }) {
    setDisplayWeek(nextWeek);

    if (options?.scrollIntoView) {
      window.setTimeout(() => {
        programWeekRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 0);
    }
  }

  const contextualHeader =
    stage === "program"
      ? { title: "Dit program", subtitle: `Uge ${weekNumber}` }
      : stage === "workout"
        ? {
            title: activeSession ? `Uge ${activeSession.week} · ${shortSessionTitle(activeSession.title)}` : "Intervalpas",
            subtitle: "Fokusér på næste interval",
          }
        : stage === "auth"
          ? {
              title: `Velkommen til ${APP_NAME}`,
              subtitle: "Dit adaptive løbeprogram der udvikler sig sammen med dig",
            }
        : {
            title: APP_NAME,
            subtitle: "Din AI løbecoach",
          };
  const programAdjustments = [...safetyAdjustments, ...adjustmentLog];
  const visibleSafetyAdjustments = showAllSafety ? programAdjustments : programAdjustments.slice(0, 3);
  const hasMoreSafetyAdjustments = programAdjustments.length > 3;
  const isLastWorkoutStep = Boolean(activeSession && stepIndex === activeSession.steps.length - 1);
  const nextStepLabel = isLastWorkoutStep ? "Afslut pas" : "Næste interval";
  const onboardingSteps = 5;
  const goalSummaryDate =
    goalDestinationSession &&
    sessionDateFromPlan(goal.startDate, goalDestinationSession).toLocaleDateString("da-DK", {
      day: "numeric",
      month: "short",
    });
  const todayDuration = todaySession ? Math.round(sessionTotalDurationSec(todaySession) / 60) : 0;
  const nextDuration = nextSession ? Math.round(sessionTotalDurationSec(nextSession) / 60) : 0;
  const activeSessionDuration = activeSession ? Math.round(sessionTotalDurationSec(activeSession) / 60) : 0;
  const profileInsightSummary =
    runnerProfileInsights?.progressionStrategy.style === "conservative"
      ? "Jeg har lagt planen roligt ud, så du kan bygge sikkert op fra start."
      : runnerProfileInsights?.progressionStrategy.style === "aggressive"
        ? "Jeg har lagt planen an med lidt mere fart i progressionen, men stadig inden for en kontrolleret ramme."
        : runnerProfileInsights
          ? "Jeg har lagt planen an med en stabil progression, der passer til dit udgangspunkt."
          : null;
  const greeting = runnerProfile.firstName?.trim() ? `Hej ${runnerProfile.firstName.trim()}` : "Hej";
  const stickyProgramCtaLabel = todaySession ? "Start dagens træningspas" : nextSession ? "Se næste træningspas" : null;
  const weekRationale = plan?.rationale?.weeks?.find((week) => week.weekNumber === weekNumber) ?? null;
  const weekState = weekStateLabel(plan, weekNumber);
  const learnedInsights = useMemo(() => learnedInsightLines(capabilityState, plan ?? null), [capabilityState, plan]);
  const planIntermezzo = useMemo(
    () =>
      intermezzoSummary({
        runnerProfile,
        goal,
        insights: runnerProfileInsights,
        recommendation: trainingDayRecommendation,
        planFeasibilityStatus,
        planTradeoff,
      }),
    [goal, planFeasibilityStatus, planTradeoff, runnerProfile, runnerProfileInsights, trainingDayRecommendation],
  );
  const isOnboardingStepValid =
    onboardingStep === 2
      ? onboardingSelections.runningAbility
      : onboardingStep === 3
        ? onboardingSelections.goalDistance &&
          onboardingSelections.goalType &&
          Boolean(goal.endDate) &&
          (!shouldShowGoalPaceInput(goal.goalType) || Boolean(goal.targetPaceSecPerKm))
        : onboardingStep === 4
          ? onboardingSelections.activityLevel && Boolean(goal.availableTrainingDays?.length) && isValidIsoDate(goal.startDate) && Boolean(derivedPlanWeeks)
          : true;
  const completedWorkoutCoach = useMemo(
    () =>
      postWorkoutCoachMessage({
        firstName: runnerProfile.firstName,
        session: activeSession,
      }),
    [activeSession, runnerProfile.firstName],
  );
  const activeWorkoutPurpose = useMemo(() => (activeSession ? getWorkoutPurpose(activeSession) : ""), [activeSession]);

  useEffect(() => {
    if (stage !== "program" || !stickyProgramCtaLabel) {
      setShowStickyProgramCta(false);
      return;
    }

    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(max-width: 720px)");
    const ctaNode = todayPrimaryCtaRef.current;

    if (!mediaQuery.matches) {
      setShowStickyProgramCta(false);
      return;
    }

    if (!ctaNode) {
      setShowStickyProgramCta(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        const shouldShow = !entry.isIntersecting;
        setShowStickyProgramCta((current) => (current === shouldShow ? current : shouldShow));
      },
      {
        root: null,
        rootMargin: "0px 0px 120px 0px",
        threshold: 0.12,
      },
    );

    observer.observe(ctaNode);

    function syncStickyVisibility(matches: boolean) {
      if (!matches) {
        setShowStickyProgramCta(false);
        return;
      }
      if (!ctaNode) {
        setShowStickyProgramCta(true);
        return;
      }
      const rect = ctaNode.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const shouldShow = rect.top > viewportHeight - 120 || rect.bottom < 0;
      setShowStickyProgramCta((current) => (current === shouldShow ? current : shouldShow));
    }

    function handleMediaChange(event: MediaQueryListEvent) {
      syncStickyVisibility(event.matches);
    }

    syncStickyVisibility(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleMediaChange);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener("change", handleMediaChange);
    };
  }, [stage, stickyProgramCtaLabel, todaySession?.id, nextSession?.id]);

  return (
    <main
      className={[
        styles.page,
        effectiveTheme === "light" ? styles.pageLight : styles.pageDark,
        stage === "welcome" ? styles.pageWelcomeStage : "",
        stage === "intermezzo" ? styles.pageIntermezzoStage : "",
        stage === "program" ? styles.pageProgramStage : "",
      ].join(" ")}
    >
      <section ref={menuRef} className={styles.menuContainer}>
        <button
          className={styles.burgerBtn}
          aria-label={menuOpen ? "Luk menu" : "Åbn menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          ☰
        </button>
        {menuOpen && (
          <div className={styles.menuDropdown}>
            <div className={styles.menuHeader}>
              <p className={styles.menuLabel}>Menu</p>
              <button type="button" className={styles.menuCloseBtn} aria-label="Luk menu" onClick={() => setMenuOpen(false)}>
                Luk
              </button>
            </div>
            <button className={stage === "welcome" ? styles.menuBtnActive : styles.menuBtn} onClick={() => openStage("welcome")}>
              Velkomst
            </button>
            <button className={stage === "auth" ? styles.menuBtnActive : styles.menuBtn} onClick={() => openStage("auth")}>
              Konto
            </button>
            <button
              className={stage === "profile" ? styles.menuBtnActive : styles.menuBtn}
              onClick={() => openStage("profile")}
              disabled={!canOpenAuthenticatedPages}
            >
              Rediger profil og mål
            </button>
            <button
              className={stage === "program" ? styles.menuBtnActive : styles.menuBtn}
              onClick={() => openStage("program")}
              disabled={!canOpenProgram}
            >
              Program
            </button>
            <button
              className={stage === "workout" ? styles.menuBtnActive : styles.menuBtn}
              onClick={() => openStage("workout")}
              disabled={!canOpenWorkout}
            >
              Pas
            </button>
            <div className={styles.audioSettings}>
              <p className={styles.menuLabel}>Tale-cues</p>
              <div className={styles.audioModeRow}>
                <button className={audioMode === "off" ? styles.audioModeActive : styles.audioModeBtn} onClick={() => setAudioMode("off")} type="button">
                  Off
                </button>
                <button className={audioMode === "short" ? styles.audioModeActive : styles.audioModeBtn} onClick={() => setAudioMode("short")} type="button">
                  Short
                </button>
                <button className={audioMode === "coach" ? styles.audioModeActive : styles.audioModeBtn} onClick={() => setAudioMode("coach")} type="button">
                  Coach
                </button>
              </div>
            </div>
            <div className={styles.audioSettings}>
              <p className={styles.menuLabel}>Udseende</p>
              <div className={styles.audioModeRow}>
                <button className={appearance === "light" ? styles.audioModeActive : styles.audioModeBtn} onClick={() => setAppearance("light")} type="button">
                  Lys
                </button>
                <button className={appearance === "dark" ? styles.audioModeActive : styles.audioModeBtn} onClick={() => setAppearance("dark")} type="button">
                  Mørk
                </button>
                <button className={appearance === "system" ? styles.audioModeActive : styles.audioModeBtn} onClick={() => setAppearance("system")} type="button">
                  Automatisk
                </button>
              </div>
            </div>
            <button
              className={styles.menuBtn}
              onClick={() => {
                downloadIcs();
                setMenuOpen(false);
              }}
              disabled={!plan}
            >
              Download .ics
            </button>
            {authUser && (
              <button
                className={styles.menuBtn}
                onClick={() => {
                  logout();
                  setMenuOpen(false);
                }}
              >
                Log ud
              </button>
            )}
            <button
              className={styles.menuResetBtn}
              type="button"
              onClick={() => {
                void resetAppState();
              }}
            >
              Nulstil app
            </button>
          </div>
        )}
      </section>

      {stage !== "welcome" && stage !== "auth" && stage !== "intro" && stage !== "workout" && stage !== "program" && (
        <section className={styles.hero}>
          <h1>{contextualHeader.title}</h1>
          <p className={styles.heroSub}>{contextualHeader.subtitle}</p>
          {isDemoMode && <p className={styles.demoBadge}>Demo-tilstand · data gemmes ikke permanent</p>}
        </section>
      )}

      {stage === "welcome" && (
        <section className={styles.welcomeHero}>
          <div className={styles.welcomeOverlay}>
            <div className={styles.welcomeBody}>
              <h1>{APP_NAME}</h1>
              <p>Din AI løbecoach</p>
              <button className={styles.primaryBtn} onClick={startFlow}>
                Kom i gang
              </button>
              <button className={styles.secondaryBtn} onClick={startDemoMode}>
                Prøv demo
              </button>
            </div>
          </div>
        </section>
      )}

      {stage === "auth" && (
        <section className={styles.authHero}>
          <div className={styles.authOverlay}>
            <section className={styles.centerCard}>
              <h2>Velkommen til {APP_NAME}</h2>
              <p className={styles.subtle}>Dit adaptive løbeprogram der udvikler sig sammen med dig</p>

              <div className={styles.formGrid}>
                <label>
                  E-mailadresse
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </label>
                <label>
                  Adgangskode
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </label>
              </div>

              {authMode === "signup" ? (
                <div className={styles.authActions}>
                  <button className={styles.primaryBtn} onClick={register}>
                    Opret gratis konto
                  </button>
                  <p className={styles.authDivider}>eller</p>
                  <button className={styles.secondaryBtn} onClick={startDemoMode}>
                    Prøv demo
                  </button>
                  <p className={styles.subtleInline}>
                    Har du allerede en konto?{" "}
                    <button className={styles.textBtn} onClick={() => setAuthMode("login")}>
                      Log ind
                    </button>
                  </p>
                </div>
              ) : (
                <div className={styles.authActions}>
                  <button className={styles.primaryBtn} onClick={login}>
                    Log ind
                  </button>
                  <p className={styles.authDivider}>eller</p>
                  <button className={styles.secondaryBtn} onClick={startDemoMode}>
                    Prøv demo
                  </button>
                  <p className={styles.subtleInline}>
                    Ny her?{" "}
                    <button className={styles.textBtn} onClick={() => setAuthMode("signup")}>
                      Opret gratis konto
                    </button>
                  </p>
                </div>
              )}
            </section>
          </div>
        </section>
      )}

      {stage === "intro" && (
        <section className={`${styles.centerCard} ${styles.introCard}`}>
          <h2>Klar til et program, der faktisk passer til dig?</h2>
          <p className={styles.subtle}>StridePilot starter ud fra dit niveau nu og justerer videre, når din træning viser hvad du reagerer bedst på.</p>
          <ul className={styles.bulletList}>
            <li>Startniveauet matcher det du realistisk kan løbe lige nu</li>
            <li>De næste uger justeres ud fra din feedback efter dine træningspas</li>
            <li>Du får korte forklaringer, så planen føles gennemtænkt</li>
          </ul>
          <div className={styles.topActions}>
            <button className={styles.primaryBtn} onClick={completeIntro}>
              Kom i gang
            </button>
          </div>
        </section>
      )}

      {stage === "profile" && (
        <section className={`${styles.card} ${styles.onboardingCard}`}>
          <div className={styles.onboardingHeader}>
            <h2>Byg dit personlige løbeprogram</h2>
            <p className={styles.onboardingIntro}>Et par korte svar. Så sætter {APP_NAME} dit startniveau, din træningsrytme og hvor forsigtigt planen skal åbne.</p>
          </div>
          {onboardingStep === 1 && (
            <div className={styles.planWhyCard}>
              <p className={styles.nextLabel}>Sådan bruger jeg dine svar</p>
              <p className={styles.subtleInline}>Dit niveau afgør startpunktet. Dit mål og din tidsramme sætter retningen. Din feedback justerer ugerne undervejs.</p>
            </div>
          )}
          <div className={styles.onboardingProgress}>
            <p className={styles.nextLabel}>Trin {onboardingStep} af {onboardingSteps}</p>
            <div className={styles.progressTrack}>
              <div className={styles.progressFill} style={{ width: `${(onboardingStep / onboardingSteps) * 100}%` }} />
            </div>
          </div>

          {onboardingStep === 1 && (
            <div className={styles.sectionBlock}>
              <h3>Fortæl lidt om dig selv</h3>
              <p className={styles.subtleInline}>Et kort fritekstsvar er nok. Jeg bruger det til at forstå dine mål, udfordringer og hvad der skal føles realistisk.</p>
              <div className={styles.formGrid}>
                <label>
                  <span>Hvad skal jeg kalde dig?</span>
                  <input
                    type="text"
                    value={runnerProfile.firstName ?? ""}
                    onChange={(e) => setRunnerProfile((current) => ({ ...current, firstName: e.target.value.trimStart() }))}
                    onBlur={(e) => setRunnerProfile((current) => ({ ...current, firstName: e.target.value.trim() }))}
                    placeholder="Fx Anders"
                  />
                  <small className={styles.fieldHint}>Jeg bruger navnet i coach-oplevelsen i appen.</small>
                </label>
                <label>
                  <span>Din situation lige nu</span>
                  <textarea
                    rows={5}
                    value={runnerProfile.userTrainingContext ?? ""}
                    onChange={(e) => setRunnerProfile((p) => ({ ...p, userTrainingContext: e.target.value }))}
                    placeholder="Skriv kort om dine mål, udfordringer eller hvad du gerne vil blive bedre til."
                  />
                  <small className={styles.fieldHint}>Du kan skrive frit. Det hjælper StridePilot med at forstå dine mål og udfordringer.</small>
                </label>
              </div>
            </div>
          )}

          {onboardingStep === 2 && (
            <div className={styles.sectionBlock}>
              <h3>Hvad kan du realistisk løbe lige nu?</h3>
              <div className={styles.abilityGrid}>
                {CURRENT_RUNNING_ABILITY_OPTIONS.map((option) => {
                  const active = onboardingSelections.runningAbility && runnerProfile.currentRunningAbility === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={active ? styles.abilityCardActive : styles.abilityCard}
                      onClick={() => {
                        setRunnerProfile((p) => ({ ...p, currentRunningAbility: option.value }));
                        setOnboardingSelections((current) => ({ ...current, runningAbility: true }));
                      }}
                    >
                      <span className={styles.choiceCheck} aria-hidden="true">{active ? "✓" : ""}</span>
                      <span className={styles.choiceText}>{option.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className={styles.infoRow}>
                <button type="button" className={styles.infoBtn} onClick={() => setOpenInfoField((field) => (field === "currentRunningAbility" ? null : "currentRunningAbility"))}>
                  i
                </button>
                <span>Hvordan bruges det?</span>
              </div>
              {openInfoField === "currentRunningAbility" && <small className={styles.infoTextBox}>{INFO_TEXT.currentRunningAbility}</small>}
            </div>
          )}

          {onboardingStep === 3 && (
            <div className={styles.sectionBlock}>
              <h3>Dit mål</h3>
              <div className={styles.choiceGrid}>
                {GOAL_DISTANCE_OPTIONS.map((option) => {
                  const active = onboardingSelections.goalDistance && goal.distance === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={active ? styles.choiceCardActive : styles.choiceCard}
                      onClick={() => {
                        setGoal((g) => ({ ...g, distance: option.value }));
                        setOnboardingSelections((current) => ({ ...current, goalDistance: true }));
                      }}
                    >
                      <span className={styles.choiceCheck} aria-hidden="true">{active ? "✓" : ""}</span>
                      <span className={styles.choiceText}>{option.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className={styles.trainingDays}>
                <p className={styles.daysLabel}>Hvad er dit mål med denne distance?</p>
                <div className={styles.choiceGrid}>
                  {GOAL_TYPE_OPTIONS.map((option) => {
                    const active = onboardingSelections.goalType && goal.goalType === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={active ? styles.choiceCardActive : styles.choiceCard}
                        onClick={() => {
                          setGoal((current) => ({ ...current, goalType: option.value }));
                          setOnboardingSelections((current) => ({ ...current, goalType: true }));
                        }}
                      >
                        <span className={styles.choiceCheck} aria-hidden="true">{active ? "✓" : ""}</span>
                        <span className={styles.choiceText}>{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className={styles.formGrid}>
                <label>
                  Måldato eller racedato
                  <input
                    type="date"
                    value={goal.endDate ?? ""}
                    onChange={(e) => setGoal((current) => ({ ...current, endDate: e.target.value }))}
                  />
                  <small className={styles.fieldHint}>Vælg den dato du gerne vil være klar til målet.</small>
                </label>
                {shouldShowGoalPaceInput(goal.goalType) && (
                  <label>
                    <span className={styles.labelRow}>
                      Ønsket tempo (min/km)
                      <button type="button" className={styles.infoBtn} onClick={() => setOpenInfoField((field) => (field === "targetPace" ? null : "targetPace"))}>
                        i
                      </button>
                    </span>
                    <div className={styles.pacePickerRow}>
                      <select
                        className={styles.pacePicker}
                        value={goalPaceDraft.minute}
                        onChange={(e) => {
                          const nextDraft = { ...goalPaceDraft, minute: e.target.value };
                          setGoalPaceDraft(nextDraft);
                          setGoal((current) => updateGoalPace(current, "minute", nextDraft.minute, nextDraft));
                        }}
                      >
                        <option value="">Min</option>
                        {PACE_MINUTE_OPTIONS.map((minute) => (
                          <option key={`pace-minute-${minute}`} value={String(minute)}>
                            {String(minute).padStart(2, "0")}
                          </option>
                        ))}
                      </select>
                      <span className={styles.paceSeparator}>:</span>
                      <select
                        className={styles.pacePicker}
                        value={goalPaceDraft.second}
                        onChange={(e) => {
                          const nextDraft = { ...goalPaceDraft, second: e.target.value };
                          setGoalPaceDraft(nextDraft);
                          setGoal((current) => updateGoalPace(current, "second", nextDraft.second, nextDraft));
                        }}
                      >
                        <option value="">Sek</option>
                        {PACE_SECOND_OPTIONS.map((second) => (
                          <option key={`pace-second-${second}`} value={String(second).padStart(2, "0")}>
                            {String(second).padStart(2, "0")}
                          </option>
                        ))}
                      </select>
                      <span className={styles.paceSuffix}>min/km</span>
                    </div>
                    <small className={styles.fieldHint}>{goalPaceFieldHint(goal)}</small>
                    {goal.targetPaceSecPerKm && <small className={styles.fieldHint}>Svarende til ca. {targetTimeFromPace(goal.distance, goal.targetPaceSecPerKm)} for {goal.distance}.</small>}
                    {openInfoField === "targetPace" && <small className={styles.infoTextBox}>{INFO_TEXT.targetPace}</small>}
                  </label>
                )}
              </div>
              {!goal.endDate && <p className={styles.warningText}>Vælg en måldato eller racedato for at gå videre.</p>}
              {goal.endDate && isValidIsoDate(goal.startDate) && isValidIsoDate(goal.endDate) && derivePlanWeeks(goal.startDate, goal.endDate) === null && (
                <p className={styles.warningText}>Slutdatoen skal ligge efter startdatoen.</p>
              )}
              {(goal.goalType === "target_time" || goal.goalType === "pr") && !goal.targetPaceSecPerKm && (
                <p className={styles.warningText}>Vælg et ønsket tempo for at gå videre.</p>
              )}
            </div>
          )}

          {onboardingStep === 4 && (
            <div className={styles.sectionBlock}>
              <h3>Træningsrammer</h3>
              <div className={styles.formGrid}>
                <label>
                  Startdato
                  <input
                    type="date"
                    value={goal.startDate}
                    onChange={(e) => setGoal((g) => ({ ...g, startDate: e.target.value }))}
                    aria-invalid={!isValidIsoDate(goal.startDate)}
                  />
                  <small className={styles.fieldHint}>Programmet starter fra denne dato, og uge 1 tager udgangspunkt i den.</small>
                </label>
                <label>
                  Foretrukkent træningstidspunkt
                  <select value={goal.reminderTime ?? "13:00"} onChange={(e) => setGoal((g) => ({ ...g, reminderTime: e.target.value }))}>
                    {TRAINING_TIME_OPTIONS.map((time) => (
                      <option key={`training-time-${time}`} value={time}>
                        {time}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Hvor lang tid har du typisk til et træningspas?
                  <select
                    value={String(runnerProfile.typicalWorkoutMinutes ?? 45)}
                    onChange={(e) => setRunnerProfile((current) => ({ ...current, typicalWorkoutMinutes: Number(e.target.value) }))}
                  >
                    <option value="30">Ca. 30 min</option>
                    <option value="45">Ca. 45 min</option>
                    <option value="60">Ca. 60 min</option>
                    <option value="75">75+ min</option>
                  </select>
                </label>
                <label>
                  Hvordan skal planen føles i hverdagen?
                  <select
                    value={runnerProfile.preferredGuidance ?? ""}
                    onChange={(e) =>
                      setRunnerProfile((current) => ({
                        ...current,
                        preferredGuidance: e.target.value ? (e.target.value as GuidancePreference) : undefined,
                      }))
                    }
                  >
                    <option value="">Ingen særlig præference</option>
                    {GUIDANCE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <small className={styles.fieldHint}>
                    {runnerProfile.preferredGuidance
                      ? GUIDANCE_OPTIONS.find((option) => option.value === runnerProfile.preferredGuidance)?.help
                      : "Valgfrit. Brug feltet hvis du gerne vil signalere, hvordan planen skal opleves i praksis."}
                  </small>
                </label>
              </div>
              <p className={styles.recommendationText}>
                {derivedPlanWeeks ? `Programlængde: ${derivedPlanWeeks} uger.` : "Vælg både startdato og måldato for at beregne programmets længde."}
              </p>
              {goal.endDate && isValidIsoDate(goal.startDate) && isValidIsoDate(goal.endDate) && derivedPlanWeeks === null && (
                <p className={styles.warningText}>Slutdatoen skal ligge efter startdatoen.</p>
              )}
              {derivedPlanWeeks !== null && derivedPlanWeeks < 6 && <p className={styles.fieldHint}>Det er en kort tidshorisont. Planen kan blive mere komprimeret end normalt.</p>}
              <div className={styles.trainingDays}>
                <p className={styles.daysLabel}>
                  Hvor meget træner du generelt ud over løb?
                  <button type="button" className={styles.infoBtn} onClick={() => setOpenInfoField((field) => (field === "activityLevel" ? null : "activityLevel"))}>
                    i
                  </button>
                </p>
                <div className={styles.choiceGrid}>
                  {ACTIVITY_LEVEL_OPTIONS.map((option) => {
                    const active = onboardingSelections.activityLevel && runnerProfile.activityLevel === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={active ? styles.choiceCardActive : styles.choiceCard}
                        onClick={() => {
                          setRunnerProfile((p) => ({ ...p, activityLevel: option.value }));
                          setOnboardingSelections((current) => ({ ...current, activityLevel: true }));
                        }}
                      >
                        <span className={styles.choiceCheck} aria-hidden="true">{active ? "✓" : ""}</span>
                        <span className={styles.choiceText}>{option.label}</span>
                      </button>
                    );
                  })}
                </div>
                <small className={styles.fieldHint}>{ACTIVITY_LEVEL_INFO[runnerProfile.activityLevel]}</small>
                {openInfoField === "activityLevel" && <small className={styles.infoTextBox}>{INFO_TEXT.activityLevel}</small>}
              </div>
              <div className={styles.trainingDays}>
                <p className={styles.daysLabel}>
                  Tilgængelige træningsdage
                  <button type="button" className={styles.infoBtn} onClick={() => setOpenInfoField((field) => (field === "availableTrainingDays" ? null : "availableTrainingDays"))}>
                    i
                  </button>
                </p>
                <p className={styles.subtleInline}>Vælg de dage hvor du realistisk kan træne.</p>
                <p className={styles.recommendationText}>{trainingDayRecommendation.reason}</p>
                {trainingDayRecommendation.caution && <p className={styles.fieldHint}>{trainingDayRecommendation.caution}</p>}
                {openInfoField === "availableTrainingDays" && <small className={styles.infoTextBox}>{INFO_TEXT.availableTrainingDays}</small>}
                <div className={styles.daysGrid}>
                  {WEEK_DAY_NAMES.map((day) => {
                    const active = goal.availableTrainingDays?.includes(day);
                    return (
                      <button key={`day-${day}`} type="button" className={active ? styles.dayChipActive : styles.dayChip} onClick={() => toggleTrainingDay(day)}>
                        <span className={styles.choiceCheck} aria-hidden="true">{active ? "✓" : ""}</span>
                        <span className={styles.choiceText}>{DAY_LABEL[day]}</span>
                      </button>
                    );
                  })}
                </div>
                {(goal.availableTrainingDays?.length ?? 0) < requiredRunsPerWeek(goal.distance) && (
                  <p className={styles.warningText}>Du har valgt færre træningsdage end programmet normalt kræver. Programmet kan blive mindre effektivt eller kræve en længere tidshorisont.</p>
                )}
                {(goal.availableTrainingDays?.length ?? 0) < trainingDayRecommendation.recommendedDays && (
                  <p className={styles.warningText}>Du har valgt færre træningsdage end den aktuelle anbefaling. Programmet kan stadig fungere, men vil ofte kræve mere tid eller en roligere progression.</p>
                )}
                {!isValidIsoDate(goal.startDate) && <p className={styles.warningText}>Vælg en gyldig startdato for at gå videre.</p>}
                {!derivedPlanWeeks && <p className={styles.warningText}>Startdato og måldato skal give en gyldig tidsramme.</p>}
              </div>
            </div>
          )}

          {onboardingStep === 5 && (
            <div className={styles.sectionBlock}>
              <h3>Dit aktuelle træningsudgangspunkt</h3>
              <div className={styles.formGrid}>
                <label>
                  Løbeerfaring
                  <select
                    value={runnerProfile.runningExperience}
                    onChange={(e) => setRunnerProfile((current) => ({ ...current, runningExperience: e.target.value as RunnerProfile["runningExperience"] }))}
                  >
                    <option value="nybegynder">Nybegynder</option>
                    <option value="let_ovet">Lidt erfaren</option>
                    <option value="ovet">Erfaren</option>
                  </select>
                </label>
                <label>
                  Aktuel løbemængde pr. uge (km)
                  <input
                    type="number"
                    min={0}
                    max={150}
                    value={runnerProfile.currentWeeklyVolumeKm ?? 0}
                    onChange={(e) => setRunnerProfile((current) => ({ ...current, currentWeeklyVolumeKm: clampInt(Number(e.target.value || 0), 0, 150) }))}
                  />
                </label>
                <label>
                  Aktuelle træningspas pr. uge
                  <input
                    type="number"
                    min={0}
                    max={7}
                    value={runnerProfile.currentRunsPerWeek ?? 0}
                    onChange={(e) => setRunnerProfile((current) => ({ ...current, currentRunsPerWeek: clampInt(Number(e.target.value || 0), 0, 7) }))}
                  />
                </label>
                <label>
                  Længste nuværende tur (min)
                  <input
                    type="number"
                    min={0}
                    max={240}
                    value={runnerProfile.longestCurrentRunMin ?? 0}
                    onChange={(e) => setRunnerProfile((current) => ({ ...current, longestCurrentRunMin: clampInt(Number(e.target.value || 0), 0, 240) }))}
                  />
                </label>
                <label>
                  Seneste relevante tid/PR (valgfrit)
                  <div className={styles.pacePickerRow}>
                    <select
                      className={styles.pacePicker}
                      value={recentRaceDraft.distance}
                      onChange={(e) => {
                        const distance = e.target.value as Goal["distance"] | "";
                        const nextDraft = { ...recentRaceDraft, distance };
                        setRecentRaceDraft(nextDraft);
                        setRunnerProfile((current) => ({
                          ...current,
                          recentRaceTimes: nextDraft.distance && nextDraft.time ? [{ distance: nextDraft.distance, time: nextDraft.time }] : [],
                        }));
                      }}
                    >
                      <option value="">Distance</option>
                      {GOAL_DISTANCE_OPTIONS.map((option) => (
                        <option key={`recent-race-distance-${option.value}`} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <select
                      className={styles.pacePicker}
                      value={recentRaceDraft.time}
                      onChange={(e) => {
                        const nextDraft = { ...recentRaceDraft, time: e.target.value };
                        setRecentRaceDraft(nextDraft);
                        setRunnerProfile((current) => ({
                          ...current,
                          recentRaceTimes: nextDraft.distance && nextDraft.time ? [{ distance: nextDraft.distance, time: nextDraft.time }] : [],
                        }));
                      }}
                    >
                      <option value="">Tid</option>
                      {RECENT_RACE_TIME_OPTIONS.map((totalSeconds) => {
                        const label = formatDurationOption(totalSeconds);
                        return (
                          <option key={`recent-race-time-${totalSeconds}`} value={label}>
                            {label}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <small className={styles.fieldHint}>Vælg distance og en tid fra listen, hvis du har en nylig PR eller konkurrencetid.</small>
                </label>
                <label>
                  Skader eller sårbare områder
                  <textarea
                    rows={3}
                    value={runnerProfile.injuryHistory ?? ""}
                    onChange={(e) => setRunnerProfile((current) => ({ ...current, injuryHistory: e.target.value }))}
                    placeholder="Fx akillessene, knæ eller noget du er ekstra opmærksom på"
                  />
                </label>
                <label>
                  Anden træning
                  <textarea
                    rows={3}
                    value={runnerProfile.otherTraining ?? ""}
                    onChange={(e) => setRunnerProfile((current) => ({ ...current, otherTraining: e.target.value }))}
                    placeholder="Fx styrketræning, cykling, fodbold eller meget fysisk arbejde"
                  />
                </label>
                <label>
                  Noget du helst vil undgå?
                  <textarea
                    rows={3}
                    value={runnerProfile.weakPoints ?? ""}
                    onChange={(e) => setRunnerProfile((current) => ({ ...current, weakPoints: e.target.value }))}
                    placeholder="Fx for mange intervaller, for lange pas eller meget stive uger"
                  />
                </label>
                <label>
                  Højde (cm)
                  <input
                    type="number"
                    value={profileDraft.heightCm}
                    onChange={(e) => {
                      const value = e.target.value;
                      setProfileDraft((d) => ({ ...d, heightCm: value }));
                      if (value !== "") setRunnerProfile((p) => ({ ...p, heightCm: clampInt(Number(value), 1, 300) }));
                    }}
                    onBlur={() => {
                      if (profileDraft.heightCm === "") setProfileDraft((d) => ({ ...d, heightCm: String(runnerProfile.heightCm) }));
                    }}
                  />
                </label>
                <label>
                  Vægt (kg)
                  <input
                    type="number"
                    value={profileDraft.weightKg}
                    onChange={(e) => {
                      const value = e.target.value;
                      setProfileDraft((d) => ({ ...d, weightKg: value }));
                      if (value !== "") setRunnerProfile((p) => ({ ...p, weightKg: clampInt(Number(value), 1, 400) }));
                    }}
                    onBlur={() => {
                      if (profileDraft.weightKg === "") setProfileDraft((d) => ({ ...d, weightKg: String(runnerProfile.weightKg) }));
                    }}
                  />
                </label>
                <label>
                  Alder
                  <input
                    type="number"
                    value={profileDraft.age}
                    onChange={(e) => {
                      const value = e.target.value;
                      setProfileDraft((d) => ({ ...d, age: value }));
                      if (value !== "") setRunnerProfile((p) => ({ ...p, age: clampInt(Number(value), 1, 120) }));
                    }}
                    onBlur={() => {
                      if (profileDraft.age === "") setProfileDraft((d) => ({ ...d, age: String(runnerProfile.age) }));
                    }}
                  />
                </label>
              </div>
              <div className={styles.trainingDays}>
                <p className={styles.daysLabel}>Køn (valgfrit)</p>
                <div className={styles.choiceGrid}>
                  {GENDER_OPTIONS.map((option) => {
                    const active = runnerProfile.gender === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={active ? styles.choiceCardActive : styles.choiceCard}
                        onClick={() => setRunnerProfile((p) => ({ ...p, gender: active ? undefined : option.value }))}
                      >
                        <span className={styles.choiceCheck} aria-hidden="true">{active ? "✓" : ""}</span>
                        <span className={styles.choiceText}>{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div className={styles.onboardingNav}>
            <button className={styles.secondaryBtn} type="button" onClick={() => setOnboardingStep((step) => Math.max(1, step - 1))} disabled={onboardingStep === 1}>
              Forrige
            </button>
            {onboardingStep < onboardingSteps ? (
              <button className={styles.primaryBtn} type="button" onClick={() => setOnboardingStep((step) => Math.min(onboardingSteps, step + 1))} disabled={!isOnboardingStepValid}>
                Næste
              </button>
            ) : (
              <button className={styles.primaryBtn} onClick={generatePlan} disabled={isLoading}>
                {isLoading ? "Genererer program..." : "Start mit program"}
              </button>
            )}
          </div>
        </section>
      )}

      {stage === "intermezzo" && (
        <section className={`${styles.centerCard} ${styles.intermezzoCard}`}>
          <p className={styles.nextLabel}>Jeg har forstået dit udgangspunkt sådan her</p>
          <h2>{planIntermezzo.title}</h2>
          {coachExplanationSummary.length > 0 ? (
            <div className={styles.valueGrid}>
              {coachExplanationSummary.slice(0, 2).map((line, index) => (
                <p key={`coach-summary-${index}`} className={styles.subtle}>
                  {line}
                </p>
              ))}
            </div>
          ) : (
            <p className={styles.subtle}>{planIntermezzo.summary}</p>
          )}

          <div className={styles.intermezzoReason}>
            <h3>Derfor starter planen her</h3>
            {coachExplanationSummary.length > 2 ? (
              coachExplanationSummary.slice(2).map((line, index) => (
                <p key={`coach-rationale-${index}`} className={styles.subtleInline}>
                  {line}
                </p>
              ))
            ) : (
              <p className={styles.subtleInline}>{planIntermezzo.rationale}</p>
            )}
          </div>

          <div className={styles.intermezzoGrid}>
            {planIntermezzo.bullets.map((item) => (
              <div key={item.label} className={styles.intermezzoItem}>
                <p>{item.label}</p>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>

          <p className={styles.subtleInline}>Jeg justerer løbende programmet ud fra din feedback, så progressionen bliver ved med at give mening.</p>

          <div className={styles.topActions}>
            <button
              className={styles.secondaryBtn}
              onClick={() => {
                setStage("profile");
              }}
            >
              Ret min profil
            </button>
            <button className={styles.primaryBtn} onClick={openProgramFromIntermezzo}>
              Se mit program
            </button>
          </div>
        </section>
      )}

      {stage === "program" && (
        <section className={styles.grid}>
          <article className={styles.card}>
            {plan && (
              <>
                <div className={styles.programHeaderBlock}>
                  <p className={styles.nextLabel}>Dit program</p>
                  <h2>Uge {weekNumber} af {plan.weeks}</h2>
                  <p className={styles.subtle}>{goal.distance} · {goalSummaryDate ?? "Måldag"}</p>
                  <div className={styles.progressTrack}><div className={styles.progressFill} style={{ width: `${(weekNumber / plan.weeks) * 100}%` }} /></div>
                  <p className={styles.subtleInline}>Du træner frem mod {goal.distance} {goalSummaryDate ? `· ${goalSummaryDate}` : ""}</p>
                  {isDemoMode && <p className={styles.demoBadge}>Demo-mode aktiv</p>}
                </div>
                {showProgramIntro && (
                  <div className={styles.programIntroBlock}>
                    <p className={styles.subtleInline}>Her er dit program frem mod målet. Jeg justerer de næste uger, når din feedback viser, at noget skal bygges roligere op eller kan udvikles hurtigere.</p>
                    {profileInsightSummary && <p className={styles.subtleInline}>{profileInsightSummary}</p>}
                    {baselinePlan && <p className={styles.subtleInline}>Det her er dit udgangspunkt, ikke en statisk plan.</p>}
                  </div>
                )}
                <div className={styles.goalCard}>
                  <p className={styles.nextLabel}>{weekState.title}</p>
                  <h3>Fokus i denne uge</h3>
                  <p className={styles.subtleInline}>{weekRationale?.summary ?? weekState.tone}</p>
                  <p className={styles.subtleInline}>{feedbackConfirmation?.adjustment ?? plan?.rationale?.adaptation?.reason ?? weekRationale?.focus ?? "Hold rytmen og lad ugen gøre sit arbejde."}</p>
                  <p className={styles.subtleInline}>{feedbackConfirmation?.focus ?? plan?.rationale?.adaptation?.runnerFocus ?? weekState.tone}</p>
                </div>
                {planFeasibilityStatus === "feasible_with_adjustments" && planTradeoff && (
                  <div className={styles.tradeoffCard}>
                    <h3>Planen er tilpasset dine rammer</h3>
                    <p className={styles.subtleInline}>{planTradeoff}</p>
                  </div>
                )}
              </>
            )}

            <div className={styles.todayCard}>
              <p className={styles.todayGreeting}>{greeting}</p>
              <p className={styles.nextLabel}>I dag skal du</p>
              <h3 className={!todaySession ? styles.restDayTitle : undefined}>{todaySession ? shortSessionTitle(todaySession.title) : "Hviledag"}</h3>
              {todaySession ? (
                <>
                  <p className={styles.todayMeta}>{todayDuration} min</p>
                  <p className={styles.todayDescription}>{intervalSummary(todaySession)}</p>
                  <p className={styles.todaySupport}>{sessionShortDescription(todaySession)}</p>
                </>
              ) : (
                <>
                  <p className={styles.restDayBadge}>Restitution</p>
                  <p className={styles.todayDescription}>I dag er en restitutionsdag.</p>
                  <p className={styles.todaySupport}>Ingen planlagt løbetræning. Brug dagen til restitution eller let bevægelse.</p>
                </>
              )}
              {todaySession ? (
                <button
                  ref={todayPrimaryCtaRef}
                  className={styles.primaryBtn}
                  onClick={() => {
                    openWorkoutSession(todaySession.id);
                  }}
                >
                  Start dagens træningspas
                </button>
              ) : nextSession ? (
                <button
                  ref={todayPrimaryCtaRef}
                  className={`${styles.secondaryBtn} ${styles.secondaryBtnMuted}`}
                  onClick={() => {
                    openWorkoutSession(nextSession.id);
                  }}
                >
                  Se næste træningspas
                </button>
              ) : null}
            </div>

            {todaySession && nextSession && (
              <div className={styles.nextCard}>
                <p className={styles.nextLabel}>Næste træningspas</p>
                <p className={styles.subtleInline}>{formatDanishDateWithWeekday(sessionDateFromPlan(goal.startDate, nextSession))}</p>
                <h3>{shortSessionTitle(nextSession.title)} · {nextDuration} min</h3>
                <p className={styles.subtleInline}>{intervalSummary(nextSession)}</p>
                <p className={styles.subtle}>{sessionShortDescription(nextSession)}</p>
                <button
                  className={styles.primaryBtn}
                  onClick={() => {
                    openWorkoutSession(nextSession.id);
                  }}
                >
                  Se næste træningspas
                </button>
              </div>
            )}

            {plan && (
              <div className={styles.progressSummaryGrid}>
                <div className={styles.valueCard}>
                  <p>Ugens træningsload</p>
                  <strong>{currentWeekLoad ? currentWeekLoad.load.toFixed(1).replace(".", ",") : "0,0"}</strong>
                </div>
                <div className={styles.valueCard}>
                  <p>Længste sammenhængende løb</p>
                  <strong>{formatMinutesLabel(longestRunNow)}</strong>
                </div>
                <div className={styles.valueCard}>
                  <p>Måldag</p>
                  <strong>{goalDestinationSession ? shortSessionTitle(goalDestinationSession.title) : "—"}</strong>
                </div>
              </div>
            )}

            {plan && currentWeeklyLoad.length > 0 && (
              <div className={styles.chartCard}>
                <div className={styles.labelRow}>
                  <h3>Sådan udvikler programmet sig</h3>
                  <button type="button" className={styles.infoBtn} onClick={() => setOpenInfoField((field) => (field === "graph" ? null : "graph"))}>
                    i
                  </button>
                </div>
                {openInfoField === "graph" && <p className={styles.infoText}>{INFO_TEXT.graph}</p>}
                <div className={styles.chartMetaRow}>
                  <span className={styles.chartActiveWeek}>Valgt uge: U{displayWeek}</span>
                  <span className={styles.chartMetaHint}>Tryk på en uge for at åbne den i programmet</span>
                </div>
                <div className={styles.barRow}>
                  {currentWeeklyLoad.map((point) => (
                    <button
                      key={`load-${point.week}`}
                      type="button"
                      className={point.week === displayWeek ? styles.barColActive : styles.barCol}
                      onClick={() => setVisibleWeek(point.week, { scrollIntoView: true })}
                      aria-pressed={point.week === displayWeek}
                      aria-current={point.week === displayWeek ? "true" : undefined}
                      aria-label={`Vis uge ${point.week}`}
                      title={`Vis uge ${point.week}`}
                    >
                      <div className={styles.barTrackMini}>
                        <div className={styles.barFillMini} style={{ height: `${(point.load / maxWeeklyLoad) * 100}%` }} />
                      </div>
                      <span className={point.week === displayWeek ? styles.barLabelActive : undefined}>U{point.week}</span>
                    </button>
                  ))}
                </div>
                <svg viewBox={`0 0 ${graphSeries.width} ${graphSeries.height}`} className={styles.lineChart} role="img" aria-label="Oprindelig og nuværende plan">
                  <path d={graphSeries.baselinePath} className={styles.baselinePath} />
                  <path d={graphSeries.currentPath} className={styles.currentPath} />
                </svg>
                <div className={styles.chartLegend}>
                  <span className={styles.chartLegendItem}>
                    <i className={styles.baselineDot} />
                    <span>
                      <strong className={styles.chartLegendLabel}>Oprindelig plan</strong>
                      <small className={styles.chartLegendHint}>Programmet som det så ud fra start</small>
                    </span>
                  </span>
                  <span className={styles.chartLegendItem}>
                    <i className={styles.currentDot} />
                    <span>
                      <strong className={styles.chartLegendLabel}>Nuværende plan</strong>
                      <small className={styles.chartLegendHint}>Planen efter dine justeringer</small>
                    </span>
                  </span>
                </div>
              </div>
            )}

            {plan && (
              <div ref={programWeekRef}>
              <div className={styles.topActions}>
                <button className={styles.secondaryBtn} onClick={() => setVisibleWeek(Math.max(1, displayWeek - 1))} disabled={displayWeek <= 1}>
                  Forrige uge
                </button>
                <span className={styles.weekLabel}>Uge {displayWeek}</span>
                <button className={styles.secondaryBtn} onClick={() => setVisibleWeek(Math.min(plan.weeks, displayWeek + 1))} disabled={displayWeek >= plan.weeks}>
                  Næste uge
                </button>
              </div>
              </div>
            )}

            <div className={styles.weekCalendar}>
              {calendarWeekDates.map((date) => {
                const daySession = sessionsByDate.get(date.toISOString().slice(0, 10));
                const daySessionFeedback = daySession ? sessionFeedbackMap[daySession.id] ?? null : null;
                const isToday = date.toDateString() === new Date().toDateString();
                const isGoalDay = Boolean(daySession && /Måldag|test/i.test(daySession.title));
                const cardStateClass = daySession
                  ? daySessionFeedback
                    ? styles.dayCardCompleted
                    : styles.dayCardPlanned
                  : styles.dayCardRest;
                return (
                  <button
                    key={date.toISOString()}
                    className={`${isGoalDay ? styles.dayCardGoal : isToday ? styles.dayCardToday : styles.dayCard} ${cardStateClass}`}
                    onClick={() => {
                      if (daySession) {
                        setSelectedSessionId(daySession.id);
                        openWorkoutSession(daySession.id);
                      } else {
                        setRestDayPrompt({ dateLabel: formatDanishDateWithWeekday(date), showIdeas: false });
                      }
                    }}
                  >
                    <strong>{formatDanishDateWithWeekday(date)}</strong>
                    {daySession ? (
                      <span>
                        {daySession.title} · {daySessionFeedback ? savedFeedbackStatusLabel(daySessionFeedback.status) : intensityFromLoad(daySession.loadScore)}
                        {` · ca. ${Math.round(sessionTotalDurationSec(daySession) / 60)} min`}
                        {daySession.week % 4 === 0 ? " · Restitutionsuge" : ""}
                        {/Måldag|test/i.test(daySession.title) ? " · Måldag" : ""}
                      </span>
                    ) : (
                      <span>Hvile</span>
                    )}
                  </button>
                );
              })}
            </div>

            {restDayPrompt && (
              <div className={styles.tradeoffCard}>
                <h3>Hviledag</h3>
                <p className={styles.subtleInline}>I dag er planlagt som hviledag. Vil du have forslag til andre gode aktiviteter?</p>
                <p className={styles.subtleInline}>{restDayPrompt.dateLabel}</p>
                <div className={styles.topActions}>
                  <button className={styles.secondaryBtn} type="button" onClick={() => setRestDayPrompt({ ...restDayPrompt, showIdeas: true })}>
                    Ja
                  </button>
                  <button className={styles.secondaryBtn} type="button" onClick={() => setRestDayPrompt(null)}>
                    Nej
                  </button>
                </div>
                {restDayPrompt.showIdeas && (
                  <ul className={styles.bulletList}>
                    <li>Gåtur</li>
                    <li>Mobilitet</li>
                    <li>Let styrketræning</li>
                    <li>Rolig cykling</li>
                  </ul>
                )}
              </div>
            )}

            {(planWarnings.length > 0 || programAdjustments.length > 0) && (
              <div className={styles.safetyCard}>
                <h3>Programjusteringer</h3>
                <p className={styles.subtleInline}>Her kan du se de vigtigste ændringer, der er lavet i dit program.</p>
                {programAdjustments.length > 0 && (
                  <p className={styles.subtleInline}>
                    {programAdjustments.length} justering{programAdjustments.length === 1 ? "" : "er"} er lavet undervejs.
                  </p>
                )}
                {planWarnings.length > 0 && (
                  <ul className={styles.bulletList}>
                    {planWarnings.map((warning, index) => (
                      <li key={`warning-${index}`}>{warning}</li>
                    ))}
                  </ul>
                )}
                {visibleSafetyAdjustments.length > 0 && (
                  <ul className={styles.bulletList}>
                    {visibleSafetyAdjustments.map((item, index) => (
                      <li key={`safety-${index}`}>{coachAdjustmentCopy(item)}</li>
                    ))}
                  </ul>
                )}
                {hasMoreSafetyAdjustments && (
                  <button className={styles.textBtn} type="button" onClick={() => setShowAllSafety((value) => !value)}>
                    {showAllSafety ? "Vis mindre" : "Vis mere"}
                  </button>
                )}
              </div>
            )}

            <div className={styles.insightCard}>
              <h3>Det har jeg lært om din træning</h3>
              {learnedInsights.length > 0 ? (
                <ul className={styles.bulletList}>
                  {learnedInsights.map((line, index) => (
                    <li key={`learned-insight-${index}`}>{line}</li>
                  ))}
                </ul>
              ) : (
                <>
                  <p className={styles.subtleInline}>Jeg bruger din feedback over tid til at lære, hvordan du reagerer på progression, kvalitet og længere ture.</p>
                  <p className={styles.subtleInline}>Når jeg har lidt mere historik, viser jeg korte træningsindsigter her.</p>
                </>
              )}
            </div>
          </article>

          {stickyProgramCtaLabel && (
            <div className={`${styles.programStickyCta} ${!showStickyProgramCta ? styles.programStickyCtaHidden : ""}`}>
              <div className={styles.programStickyInner}>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={() => {
                    if (todaySession) {
                      openWorkoutSession(todaySession.id);
                      return;
                    }
                    if (nextSession) {
                      openWorkoutSession(nextSession.id);
                    }
                  }}
                >
                  {stickyProgramCtaLabel}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {stage === "workout" && (
        <section className={styles.workoutHero}>
          <div className={styles.workoutOverlay}>
        <section className={styles.grid}>
          <article className={styles.card}>
            {!activeSession && <p>Vælg et træningspas i programmet først.</p>}
            {activeSession && currentStep && !workoutCompleted && (
              <>
                <div className={styles.workoutTopBar}>
                  <button type="button" className={styles.workoutBackBtn} onClick={closeWorkoutSession} aria-label="Tilbage til program">
                    Tilbage
                  </button>
                  <div className={styles.workoutHeaderCenter}>
                    <p className={styles.workoutWeekContext}>Uge {activeSession.week}</p>
                    <h2 className={styles.workoutHeaderTitle}>{shortSessionTitle(activeSession.title)}</h2>
                  </div>
                  <p className={styles.workoutDurationBadge}>Ca. {activeSessionDuration} min</p>
                </div>
                <div className={styles.workoutPurposeCard}>
                  <p className={styles.nextLabel}>Formål med træningspasset</p>
                  <p className={styles.subtleInline}>{activeWorkoutPurpose}</p>
                </div>
                {activeSessionFeedback && (
                  <div className={styles.savedFeedbackCard}>
                    <p className={styles.confirmationBadge}>Gemt feedback</p>
                    <h3>Dette træningspas er allerede logget</h3>
                    <div className={styles.savedFeedbackChips}>
                      <span>{savedFeedbackStatusLabel(activeSessionFeedback.status)}</span>
                      <span>{savedFeedbackEnergyLabel(activeSessionFeedback.energy)}</span>
                      <span>{savedFeedbackPainLabel(activeSessionFeedback.painLevel)}</span>
                      <span>Belastning {activeSessionFeedback.effort}/10</span>
                    </div>
                    {activeSessionFeedback.quickFeedback && (
                      <p className={styles.subtleInline}>Vurdering: {QUICK_FEEDBACK_OPTIONS.find((option) => option.value === activeSessionFeedback.quickFeedback)?.label ?? "Gemte signaler"}</p>
                    )}
                    {activeSessionFeedback.notes && <p className={styles.subtleInline}>Note: {activeSessionFeedback.notes}</p>}
                    <p className={styles.subtleInline}>Gemt {formatSubmittedAt(activeSessionFeedback.submittedAt)}</p>
                  </div>
                )}
                <p className={styles.ttsStatus}>
                  {audioMode === "off" ? "Tale-cues er slået fra." : ttsSupported ? "Tale-cues aktive." : "Tale-cues ikke tilgængelige. Viser tekst-cues."}
                </p>
                <div className={styles.workoutPrimaryAction}>
                  <button
                    className={styles.primaryBtn}
                    onClick={() => {
                      setIsRunning((v) => {
                        const next = !v;
                        if (!next) cancelCue();
                        if (next && !speechEnabled && audioMode !== "off") {
                          const initialized = initSpeech();
                          setSpeechEnabled(initialized);
                          setTtsSupported(isSpeechSupported());
                        }
                        if (audioMode === "off") {
                          setSpeechEnabled(false);
                        }
                        return next;
                      });
                    }}
                  >
                    {isRunning ? "Pause" : "Start"}
                  </button>
                </div>
                <p className={styles.phaseLabel}>{phaseName(currentStep).toUpperCase()}</p>
                <div className={styles.timerBig}>{formatClock(remainingSec)}</div>
                <p className={styles.instruction}>{coachingHint(currentStep)}</p>
                {audioMode !== "off" && cueFallbackText && (!ttsSupported || !speechEnabled) && <p className={styles.cueFallback}>{cueFallbackText}</p>}

                <div className={styles.progressTrack}>
                  <div className={styles.progressFill} style={{ width: `${stepProgress}%` }} />
                </div>
                <p className={styles.subtleStrong}>
                  Interval {stepIndex + 1} / {activeSession.steps.length}
                  {isLastWorkoutStep && <span className={styles.finalStepTag}>Sidste interval</span>}
                </p>
                {stepNotice && <p className={styles.stepNotice}>{stepNotice}</p>}

                <ul className={styles.stepOverview}>
                  {activeSession.steps.map((step, index) => {
                    const done = completedSteps.includes(index);
                    const marker = done ? "✓" : index === stepIndex ? "●" : "○";
                    return (
                      <li
                        key={`${step.label}-${index}`}
                        className={done ? styles.stepDone : index === stepIndex ? styles.stepCurrent : ""}
                      >
                        <button
                          type="button"
                          className={styles.stepJumpBtn}
                          onClick={() => goToStep(index)}
                          aria-label={`Gå til interval ${index + 1}`}
                          aria-current={index === stepIndex ? "step" : undefined}
                        >
                          <span>{marker}</span>
                          <span>{phaseName(step)}</span>
                          <span>{formatClock(step.durationSec)}</span>
                          <span>{index === stepIndex ? "Aktiv" : done ? "Udført" : "Kommende"}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>

                <div className={styles.topActions}>
                  <button className={styles.secondaryBtn} onClick={previousStep} disabled={stepIndex === 0}>
                    Forrige interval
                  </button>
                  <button
                    className={isLastWorkoutStep ? styles.completeWorkoutBtn : styles.secondaryBtn}
                    onClick={nextStep}
                  >
                    {nextStepLabel}
                  </button>
                </div>
              </>
            )}
            {activeSession && workoutCompleted && (
              <div className={styles.completedWorkoutCard}>
                <div className={styles.workoutTopBar}>
                  <button type="button" className={styles.workoutBackBtn} onClick={closeWorkoutSession} aria-label="Tilbage til program">
                    Tilbage
                  </button>
                  <div className={styles.workoutHeaderCenter}>
                    <p className={styles.workoutWeekContext}>Uge {activeSession.week}</p>
                    <h2 className={styles.workoutHeaderTitle}>{shortSessionTitle(activeSession.title)}</h2>
                  </div>
                  <p className={styles.workoutDurationBadge}>Ca. {activeSessionDuration} min</p>
                </div>
                <p className={styles.confirmationBadge}>Træningspas afsluttet</p>
                <h2>Godt arbejde — træningspasset er gennemført</h2>
                <p className={styles.subtle}>Fortæl kort hvordan træningspasset føltes, så jeg kan justere det næste skridt i programmet.</p>
                <div className={styles.postWorkoutCoachCard}>
                  <h3>{completedWorkoutCoach.title}</h3>
                  <p className={styles.subtleInline}>{completedWorkoutCoach.body}</p>
                </div>
                <div className={styles.completedWorkoutStats}>
                  <span>{shortSessionTitle(activeSession.title)}</span>
                  <span>{activeSession.steps.length} intervaller gennemført</span>
                </div>
              </div>
            )}
          </article>

          {workoutCompleted && (
            <article className={styles.card}>
              <p className={styles.confirmationBadge}>{feedbackSubmitted ? "Coach-respons" : "Din feedback"}</p>
              <h2>{feedbackSubmitted ? feedbackConfirmation?.title ?? "Tak for din feedback." : "Hvordan føltes træningspasset?"}</h2>
              <p className={styles.subtle}>
                {feedbackSubmitted ? "Jeg har set din feedback og justeret det næste skridt i planen." : "Det skal være hurtigt: fortæl bare om du gennemførte træningspasset, hvordan det føltes, din energi og eventuel smerte."}
              </p>
              {feedbackConfirmation && (
                <div className={styles.confirmationCard}>
                  {feedbackConfirmation.updatedLabel && <p className={styles.updatedResponseBadge}>{feedbackConfirmation.updatedLabel}</p>}
                  <p className={styles.nextLabel}>Det lagde jeg mærke til</p>
                  <p className={styles.subtleInline}>{feedbackConfirmation.interpretation}</p>
                  <p className={styles.nextLabel}>Det ændrer jeg</p>
                  <p className={styles.subtleInline}>{feedbackConfirmation.adjustment}</p>
                  {feedbackConfirmation.progressionPreview && (
                    <>
                      <p className={styles.nextLabel}>Næste skridt</p>
                      <p className={styles.subtleInline}>{feedbackConfirmation.progressionPreview}</p>
                    </>
                  )}
                  {feedbackConfirmation.focus && (
                    <>
                      <p className={styles.nextLabel}>Fokus nu</p>
                      <p className={styles.subtleInline}>{feedbackConfirmation.focus}</p>
                    </>
                  )}
                  {feedbackConfirmation.learnedInsights && feedbackConfirmation.learnedInsights.length > 0 && (
                    <>
                      <p className={styles.nextLabel}>Det lærer jeg om dig</p>
                      {feedbackConfirmation.learnedInsights.map((line, index) => (
                        <p key={`feedback-learned-${index}`} className={styles.subtleInline}>{line}</p>
                      ))}
                    </>
                  )}
                  {!feedbackConfirmation.reply && (
                    <div className={styles.coachReplyBlock}>
                      <div className={styles.coachReplyActions}>
                        <button
                          type="button"
                          className={styles.secondaryBtn}
                          onClick={() => handleCoachReply({ replyType: "agree" })}
                        >
                          Enig
                        </button>
                        <button
                          type="button"
                          className={styles.secondaryBtn}
                          onClick={() => handleCoachReply({ replyType: "disagree" })}
                        >
                          Ikke enig
                        </button>
                      </div>
                      <div className={styles.coachClarifyBox}>
                        <textarea
                          value={clarificationDraft}
                          onChange={(e) => setClarificationDraft(e.target.value)}
                          placeholder="Kort forklaring, hvis du vil nuancere vurderingen"
                          rows={3}
                        />
                        <button
                          type="button"
                          className={styles.textBtn}
                          onClick={() => handleCoachReply({ replyType: "clarify", text: clarificationDraft.trim() })}
                          disabled={!clarificationDraft.trim()}
                        >
                          Send afklaring
                        </button>
                      </div>
                    </div>
                  )}
                  {feedbackConfirmation.reply && feedbackConfirmation.resolution && (
                    <div className={styles.coachReplyResolution}>
                      <p className={styles.subtleInline}>{feedbackConfirmation.resolution}</p>
                      {feedbackConfirmation.reply.replyType === "clarify" && feedbackConfirmation.reply.text && (
                        <p className={styles.subtleInline}>Din note: {feedbackConfirmation.reply.text}</p>
                      )}
                    </div>
                  )}
                  <div className={styles.confirmationActions}>
                    <button
                      type="button"
                      className={styles.primaryBtn}
                      onClick={() => {
                        setIsRunning(false);
                        setStage("program");
                      }}
                    >
                      Se opdateret program
                    </button>
                  </div>
                </div>
              )}

              {!feedbackSubmitted && (
              <>
              <p className={styles.nextLabel}>1. Gennemførte du træningspasset?</p>
              <div className={styles.quickFeedbackGrid}>
                {COMPLETION_OPTIONS.map((option) => {
                  const active = feedback.completionPct === option.value;
                  return (
                    <button
                      key={`completion-${option.value}`}
                      type="button"
                      className={active ? styles.quickFeedbackCardActive : styles.quickFeedbackCard}
                      onClick={() => {
                        setFeedback((current) => ({ ...current, completionPct: option.value }));
                        setFeedbackDraft((draft) => ({ ...draft, completionPct: String(option.value) }));
                      }}
                    >
                      <span className={styles.choiceCheck} aria-hidden="true">{active ? "✓" : ""}</span>
                      <span className={styles.choiceText}>{option.label}</span>
                    </button>
                  );
                })}
              </div>

              <p className={styles.nextLabel}>2. Hvordan føltes det?</p>
              <div className={styles.quickFeedbackGrid}>
                {QUICK_FEEDBACK_OPTIONS.map((option) => {
                  const active = feedback.quickFeedback === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={active ? styles.quickFeedbackCardActive : styles.quickFeedbackCard}
                      onClick={() => {
                        const preset = quickFeedbackPreset(option.value);
                        setFeedback((current) => ({
                          ...current,
                          quickFeedback: option.value,
                          ...preset,
                        }));
                        setFeedbackDraft((draft) => ({
                          ...draft,
                          effort: String(preset.effort),
                          completionPct: String(preset.completionPct),
                          energy: String(preset.energy),
                          painLevel: String(preset.painLevel),
                        }));
                      }}
                    >
                      <span className={styles.choiceCheck} aria-hidden="true">{active ? "✓" : ""}</span>
                      <span className={styles.choiceText}>{option.label}</span>
                    </button>
                  );
                })}
              </div>

              <p className={styles.nextLabel}>3. Hurtige signaler</p>
              <div className={styles.quickFeedbackGrid}>
                {ENERGY_OPTIONS.map((option) => {
                  const active = feedback.energy === option.value;
                  return (
                    <button
                      key={`energy-${option.value}`}
                      type="button"
                      className={active ? styles.quickFeedbackCardActive : styles.quickFeedbackCard}
                      onClick={() => {
                        setFeedback((current) => ({ ...current, energy: option.value }));
                        setFeedbackDraft((draft) => ({ ...draft, energy: String(option.value) }));
                      }}
                    >
                      <span className={styles.choiceCheck} aria-hidden="true">{active ? "✓" : ""}</span>
                      <span className={styles.choiceText}>{option.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className={styles.quickFeedbackGrid}>
                {PAIN_OPTIONS.map((option) => {
                  const active = feedback.painLevel === option.value;
                  return (
                    <button
                      key={`pain-${option.value}`}
                      type="button"
                      className={active ? styles.quickFeedbackCardActive : styles.quickFeedbackCard}
                      onClick={() => {
                        setFeedback((current) => ({ ...current, painLevel: option.value }));
                        setFeedbackDraft((draft) => ({ ...draft, painLevel: String(option.value) }));
                      }}
                    >
                      <span className={styles.choiceCheck} aria-hidden="true">{active ? "✓" : ""}</span>
                      <span className={styles.choiceText}>{option.label}</span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                className={styles.textBtn}
                onClick={() => {
                  setShowDetailedFeedback((current) => !current);
                }}
              >
                {showDetailedFeedback ? "Skjul ekstra detaljer" : "Tilføj note eller finjuster tal"}
              </button>

              {showDetailedFeedback && (
              <div className={styles.formGrid}>
              <label>
                Oplevet belastning (1–10)
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={feedbackDraft.effort}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFeedbackDraft((d) => ({ ...d, effort: value }));
                    if (value !== "") setFeedback((f) => ({ ...f, effort: clampInt(Number(value), 1, 10) }));
                  }}
                  onBlur={() => {
                    if (feedbackDraft.effort === "") setFeedbackDraft((d) => ({ ...d, effort: String(feedback.effort) }));
                  }}
                />
              </label>
              <label>
                Gennemført %
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={feedbackDraft.completionPct}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFeedbackDraft((d) => ({ ...d, completionPct: value }));
                    if (value !== "") setFeedback((f) => ({ ...f, completionPct: clampInt(Number(value), 0, 100) }));
                  }}
                  onBlur={() => {
                    if (feedbackDraft.completionPct === "") setFeedbackDraft((d) => ({ ...d, completionPct: String(feedback.completionPct) }));
                  }}
                />
              </label>
              <label>
                Energi (1–5)
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={feedbackDraft.energy}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFeedbackDraft((d) => ({ ...d, energy: value }));
                    if (value !== "") setFeedback((f) => ({ ...f, energy: clampInt(Number(value), 1, 5) }));
                  }}
                  onBlur={() => {
                    if (feedbackDraft.energy === "") setFeedbackDraft((d) => ({ ...d, energy: String(feedback.energy) }));
                  }}
                />
              </label>
              <label>
                Smerte (1–10)
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={feedbackDraft.painLevel}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFeedbackDraft((d) => ({ ...d, painLevel: value }));
                    if (value !== "") setFeedback((f) => ({ ...f, painLevel: clampInt(Number(value), 1, 10) }));
                  }}
                  onBlur={() => {
                    if (feedbackDraft.painLevel === "") setFeedbackDraft((d) => ({ ...d, painLevel: String(feedback.painLevel) }));
                  }}
                />
              </label>
              <label>
                Noter
                <input
                  type="text"
                  value={feedback.notes}
                  onChange={(e) => {
                    setFeedback((f) => ({ ...f, notes: e.target.value }));
                  }}
                  placeholder="Kort note om træningspasset"
                />
              </label>
              </div>
              )}

              <div className={styles.topActions}>
                <button
                  className={styles.primaryBtn}
                  onClick={submitFeedback}
                  disabled={!activeSession || !workoutCompleted || feedbackSubmitState === "submitting" || !feedback.quickFeedback}
                >
                  {feedbackSubmitState === "submitting" && <span className={styles.buttonSpinner} aria-hidden="true" />}
                  {feedbackSubmitState === "submitting"
                    ? "Gemmer..."
                    : feedbackSubmitState === "success"
                      ? "Feedback gemt ✓"
                      : "Gem feedback"}
                </button>
              </div>
              </>
              )}
            </article>
          )}
        </section>
          </div>
        </section>
      )}

      {(isLoading || isProgramTransitioning) && (
        <section className={styles.loadingHero}>
          <div className={styles.loadingOverlay}>
            <div className={styles.spinner} />
            <p>{isProgramTransitioning ? "Jeg bygger dit program..." : "Jeg samler dit program..."}</p>
            <small>{isProgramTransitioning ? "Gør den sidste coach-opsummering klar." : "Jeg lægger dine første uger på plads ud fra dit mål og dit nuværende niveau."}</small>
          </div>
        </section>
      )}
      {error && <p className={styles.error}>{error}</p>}
    </main>
  );
}
