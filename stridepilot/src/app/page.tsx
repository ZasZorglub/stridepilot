"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";
import {
  FeedbackInsights,
  Goal,
  GoalType,
  OnboardingTrack,
  PlanHistorySummary,
  PlanAmbition,
  PlanRecommendation,
  PlanRecommendationOption,
  RunnerProfile,
  RunnerProfileInsights,
  SavedPlanAdaptation,
  SavedProfileNote,
  SavedWorkoutSessionFeedback,
  TrainingPlan,
  WorkoutFeedbackInput,
  WorkoutSession,
  WorkoutStep,
} from "@/lib/types";
import { APP_NAME, APP_VERSION } from "@/lib/app-config";
import { formatReadableDurationFromSeconds } from "@/lib/duration";
import { buildFeedbackMailto } from "@/lib/feedback-mail";
import { getSiteCopy } from "@/lib/site-copy";
import { getConfiguredSiteLocale, SiteLocale } from "@/lib/site-variant";
import { cancelCue, initSpeech, isSpeechSupported, speakCue } from "@/lib/speech-coach";
import { buildWeeklyLoad } from "@/lib/plan";
import {
  addWeeksToIsoDate,
  applyDurationToRecommendationOption,
  buildDurationEditBounds,
  buildRecommendationLeadCopy,
  buildTrackRecommendationContext,
  buildDurationAdjustmentState,
  buildPlanStartDateHelpText,
  buildRecentRaceTimeFromParts,
  buildRecentRaceTimes,
  buildLowFrequencyOverridePrompt,
  CURRENT_CAPACITY_DISTANCE_QUICK_OPTIONS,
  deriveBaselineLoadFromCapacity,
  getGoalTypeOptions,
  getOnboardingTrackOptions,
  getOnboardingStepDefinition,
  getSuggestedPlanStartDate,
  hasRecentRaceEntry,
  inferOnboardingTrackFromProfile,
  isOnboardingStepReady,
  parseCurrentCapacityDistanceKm,
  shouldInitializeOnboardingProfileStage,
  isGoalTypeAllowed,
  ONBOARDING_STEPS,
  ONBOARDING_STEP_COUNT,
  recentRaceDraftFromEntries,
  recentRaceDraftSummaryLabel,
  recentRaceSummaryLabel,
  resolvePlanStartDateForWeekRhythm,
  recentRaceTimePartsFromString,
  trackCapacityHint,
} from "@/lib/onboarding-flow";
import {
  buildWeekOverviewAction,
  buildGoalEventSessionLabel,
  buildNextWorkoutState,
  buildProgressGraphState,
  buildProgressGraphWeekAction,
  buildTodayActionState,
  buildProgramAdjustmentHighlights,
  buildProgramInsightState,
  buildProgressOverviewSummary,
  findRelevantNextSession,
  getAdjustmentToneAppearance,
  goalEventDistanceLabel,
  getProgramDayVisualState,
  isGoalEventSession,
  shouldHighlightNextWorkout,
  translateVisibleSessionTitle,
} from "@/lib/program-screen";
import {
  buildAnalyticsPlanProperties,
  captureAppEvent,
  identifyAnalyticsUser,
  resetAnalyticsUser,
  sessionAnalyticsType,
} from "@/lib/analytics";
import { buildPulseGuidanceSummary, buildPulseGuidanceWarning, buildPulseZoneLegend, parseMaxHeartRateInput } from "@/lib/profile-settings";
import { deriveWorkoutCardRepresentation } from "@/lib/workout-profile";
import {
  buildWorkoutActionState,
  buildWorkoutCheckInState,
  buildWorkoutInterruptionNotice,
  getNextWorkoutStep,
  buildWorkoutStepHeartRateState,
  hasRequiredWorkoutFeedback,
  shouldSpeakWorkoutCue,
} from "@/lib/workout-screen";
import {
  calendarWeekDatesForIndex,
  calendarWeekIndexFromDate,
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
import { recommendTrainingDays } from "@/lib/profile-interpretation";

type Stage = "welcome" | "auth" | "intro" | "profile" | "intermezzo" | "program" | "workout";
type AuthMode = "signup" | "login";
type AudioMode = "off" | "short" | "coach";
type ThemePref = "dark";
type InfoField = "targetPace" | "runningExperience" | "activityLevel" | "availableTrainingDays" | "currentRunningAbility" | "graph" | null;
type OnboardingSelectionState = {
  track: boolean;
  runningAbility: boolean;
  goalDistance: boolean;
  goalType: boolean;
  activityLevel: boolean;
  ambition: boolean;
};

type PendingLowFrequencyOverride =
  | { intent: "recommendation" }
  | { intent: "generation"; selectedRecommendation?: PlanRecommendationOption };

type PendingDurationOverride = {
  selectedRecommendation: PlanRecommendationOption;
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

type WakeLockSentinelLike = {
  released: boolean;
  release: () => Promise<void>;
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

const DAY_LABEL_EN: Record<WorkoutSession["dayOfWeek"], string> = {
  Mandag: "Monday",
  Tirsdag: "Tuesday",
  Onsdag: "Wednesday",
  Torsdag: "Thursday",
  Fredag: "Friday",
  Lordag: "Saturday",
  Sondag: "Sunday",
};

const ACTIVITY_LEVEL_INFO: Record<RunnerProfile["activityLevel"], string> = {
  meget_lav: "Næsten ingen anden træning ud over det mest nødvendige i hverdagen.",
  lav: "Lidt anden træning eller bevægelse, fx 1-2 lette pas om ugen.",
  moderat: "Regelmæssig anden træning, typisk 2-4 pas eller en aktiv hverdag.",
  høj: "En del anden træning eller sport i løbet af ugen.",
  meget_høj: "Meget høj samlet træningsmængde med hyppige pas ud over løb.",
};

const ACTIVITY_LEVEL_INFO_EN: Record<RunnerProfile["activityLevel"], string> = {
  meget_lav: "Almost no other training beyond the basics of daily life.",
  lav: "A little other training or movement, for example 1–2 light sessions per week.",
  moderat: "Regular other training, typically 2–4 sessions per week or an active daily life.",
  høj: "Quite a bit of other training or sport during the week.",
  meget_høj: "Very high total training load with frequent sessions beyond running.",
};

const CURRENT_RUNS_PER_WEEK_OPTIONS = [
  { value: 0, label: "0 gange" },
  { value: 1, label: "1 gang" },
  { value: 2, label: "2 gange" },
  { value: 3, label: "3 gange" },
  { value: 4, label: "4+ gange" },
] as const;

const GOAL_DISTANCE_OPTIONS: Array<{ value: Goal["distance"]; label: string }> = [
  { value: "5K", label: "5 km" },
  { value: "10K", label: "10 km" },
  { value: "Halvmaraton", label: "Halvmaraton" },
  { value: "Marathon", label: "Maraton" },
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

const AMBITION_OPTIONS: Array<{ value: PlanAmbition; label: string; help: string }> = [
  { value: "gentle", label: "Rolig", help: "En roligere og lidt længere vej med mere plads til restitution og stabile vaner." },
  { value: "standard", label: "Anbefalet", help: "StridePilots standardanbefaling og som regel den mest realistiske vej." },
  { value: "ambitious", label: "Ambitiøs", help: "En kortere vej, men kun når dit nuværende niveau understøtter det på en forsvarlig måde." },
];

const LONG_RUN_DAY_OPTIONS: Array<{ value: NonNullable<Goal["preferredLongRunDay"]>; label: string; help: string }> = [
  { value: "saturday", label: "Lørdag", help: "StridePilot prøver først at placere den lange tur om lørdagen." },
  { value: "sunday", label: "Søndag", help: "StridePilot prøver først at placere den lange tur om søndagen." },
  { value: "both", label: "Begge dage passer", help: "StridePilot vælger den weekenddag, der passer bedst til restitutionen." },
  { value: "flexible", label: "Fleksibel", help: "StridePilot vælger den dag, der giver den mest robuste uge." },
];

const PACE_MINUTE_OPTIONS = Array.from({ length: 8 }, (_, index) => 3 + index);
const PACE_SECOND_OPTIONS = Array.from({ length: 12 }, (_, index) => index * 5);
const RECENT_RACE_HOUR_OPTIONS = Array.from({ length: 10 }, (_, index) => index);
const RECENT_RACE_MINUTE_OPTIONS = Array.from({ length: 60 }, (_, index) => index);
const RECENT_RACE_SECOND_OPTIONS = Array.from({ length: 60 }, (_, index) => index);
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

function defaultPlanAmbitionForTrack(track: OnboardingTrack): PlanAmbition {
  return track === "getting_started" || track === "returning" ? "gentle" : "standard";
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function shouldShowGoalPaceInput(goalType?: GoalType): boolean {
  return goalType === "target_time" || goalType === "pr";
}

function pacePickerValues(goal: Goal): { minute: string; second: string } {
  if (!goal.targetPaceSecPerKm) return { minute: "", second: "" };
  return {
    minute: String(Math.floor(goal.targetPaceSecPerKm / 60)),
    second: String(goal.targetPaceSecPerKm % 60).padStart(2, "0"),
  };
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

function localizedGoalDistanceName(distance: Goal["distance"], locale: SiteLocale = "da"): string {
  if (locale !== "en") return distance === "Marathon" ? "Maraton" : distance;
  if (distance === "Halvmaraton") return "Half marathon";
  if (distance === "Marathon") return "Marathon";
  return distance;
}

function goalPaceFieldHint(goal: Goal, locale: SiteLocale = "da"): string {
  if (locale === "en") {
    if (goal.goalType === "pr") {
      return `Choose the pace you want to be able to hold to set a PR for ${localizedGoalDistanceName(goal.distance, locale)}.`;
    }
    return `Choose the pace you are aiming for on ${localizedGoalDistanceName(goal.distance, locale)}.`;
  }
  if (goal.goalType === "pr") {
    return `Vælg det tempo du gerne vil kunne holde for at sætte PR på ${goal.distance}.`;
  }
  return `Vælg det tempo du går efter på ${goal.distance}.`;
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

function goalDateFromPlanSessions(plan: TrainingPlan | null, startDateIso: string): string | null {
  if (!plan?.sessions.length) return null;
  const destinationSession =
    plan.sessions.find((session) => /Måldag|test/i.test(session.title)) ?? plan.sessions[plan.sessions.length - 1];
  return sessionDateFromPlan(startDateIso, destinationSession).toISOString().slice(0, 10);
}

function formatDateWithWeekday(date: Date, locale: SiteLocale = "da"): string {
  const localeCode = locale === "en" ? "en-GB" : "da-DK";
  const datePart = date.toLocaleDateString(localeCode, { day: "numeric", month: "long", year: "numeric" });
  const weekDay = date.toLocaleDateString(localeCode, { weekday: "long" }).toLowerCase();
  return `${datePart}: ${weekDay}`;
}

function formatDanishDateWithWeekday(date: Date): string {
  return formatDateWithWeekday(date, "da");
}

function dayLabel(day: WorkoutSession["dayOfWeek"], locale: SiteLocale = "da"): string {
  return locale === "en" ? DAY_LABEL_EN[day] : DAY_LABEL[day];
}

function formatDistanceLabel(distanceKm: number, locale: SiteLocale = "da"): string {
  const rendered = Number.isInteger(distanceKm) ? String(distanceKm) : distanceKm.toFixed(1);
  return locale === "en" ? rendered : rendered.replace(".", ",");
}

function sessionWeekBadge(week: number, locale: SiteLocale = "da"): string {
  if (week <= 0) return locale === "en" ? "Intro week" : "Intro-uge";
  return locale === "en" ? `Week ${week}` : `Uge ${week}`;
}

function translateTrainingDayRecommendationText(text: string, locale: SiteLocale = "da"): string {
  if (locale !== "en") return text;
  return text
    .replace(/^Jeg anbefaler (\d+) træningsdage, fordi du lige nu løber (\d+) gange om ugen og har valgt (\d+) faste dage at træne på\.$/, "I recommend $1 training days because you are currently running $2 times per week and have chosen $3 fixed days to train on.")
    .replace(/^Jeg anbefaler (\d+) korte træningsdage, fordi du stadig bygger selve løbevanen op, og hyppighed er vigtigere end lange pas lige nu\.$/, "I recommend $1 shorter training days because you are still building the habit of running itself, and frequency matters more than long sessions right now.")
    .replace(/^Jeg anbefaler (\d+) træningsdage, fordi du går efter et mere konkret præstationsmål og allerede har noget at bygge videre på\.$/, "I recommend $1 training days because you are chasing a more concrete performance goal and already have something to build from.")
    .replace(/^Jeg anbefaler (\d+) træningsdage, fordi planen også skal passe ind i en travl hverdag og stadig være realistisk at følge\.$/, "I recommend $1 training days because the plan still has to fit into a busy week and remain realistic to follow.")
    .replace(/^Jeg anbefaler (\d+) træningsdage, fordi du allerede har en vis kontinuitet og derfor kan bære lidt mere rytme i ugen\.$/, "I recommend $1 training days because you already have some consistency and can therefore carry a little more rhythm through the week.")
    .replace(/^Du har valgt færre dage end den anbefalede rytme, så planen skal enten være roligere eller have lidt længere tid til målet\.$/, "You have chosen fewer days than the recommended rhythm, so the plan either needs to be calmer or have a little more time to the goal.")
    .replace(/^Jeg holder også øje med din øvrige træning, så løbeplanen ikke vælter den samlede belastning\.$/, "I also keep an eye on your other training so the running plan does not tip the total load too high.");
}

function recommendationRouteLabel(mode: PlanRecommendationOption["mode"], locale: SiteLocale = "da"): string {
  if (locale === "en") {
    if (mode === "gentle") return "Calmer route";
    if (mode === "ambitious") return "Ambitious route";
    return "Recommended route";
  }
  if (mode === "gentle") return "Rolig vej";
  if (mode === "ambitious") return "Ambitiøs vej";
  return "Anbefalet vej";
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
  return formatReadableDurationFromSeconds(step.durationSec);
}

function stepCueText(step: WorkoutStep, locale: SiteLocale = "da"): string {
  if (locale === "en") {
    if (step.type === "warmup") return `Brisk walk for ${formatStepDuration(step)}`;
    if (step.type === "run") return `Run for ${formatStepDuration(step)}`;
    if (step.type === "walk") return `Walk for ${formatStepDuration(step)}`;
    return `Cool down for ${formatStepDuration(step)}`;
  }
  if (step.type === "warmup") return `Rask gang i ${formatStepDuration(step)}`;
  if (step.type === "run") return `Løb i ${formatStepDuration(step)}`;
  if (step.type === "walk") return `Gå i ${formatStepDuration(step)}`;
  return `Nedkøling i ${formatStepDuration(step)}`;
}

function shortSessionTitle(title: string): string {
  return title.replace(/^Uge \d+\s*-\s*/i, "").trim();
}

function visibleSessionTitle(title: string, locale: SiteLocale = "da"): string {
  return translateVisibleSessionTitle(title, locale);
}

function workoutProfileSegmentClassName(segment: { level: "rest" | "easy" | "moderate" | "hard"; role: "warmup" | "work" | "recovery" | "walk" | "cooldown" }): string {
  const levelClass =
    segment.level === "hard"
      ? styles.dayIntensityHard
      : segment.level === "moderate"
        ? styles.dayIntensityModerate
        : segment.level === "easy"
          ? styles.dayIntensityEasy
          : styles.dayIntensityRest;

  const roleClass =
    segment.role === "warmup"
      ? styles.dayIntensityWarmup
      : segment.role === "cooldown"
        ? styles.dayIntensityCooldown
        : segment.role === "walk"
          ? styles.dayIntensityWalk
          : segment.role === "recovery"
            ? styles.dayIntensityRecovery
            : styles.dayIntensityWork;

  return `${styles.dayIntensitySegment} ${levelClass} ${roleClass}`;
}

function workoutSegmentAccent(segment: { zoneKey: "z0" | "z1" | "z2" | "z3" | "z4" }): { color: string; muted: string } {
  if (segment.zoneKey === "z0") return { color: "rgba(242, 245, 247, 0.96)", muted: "rgba(242, 245, 247, 0.18)" };
  if (segment.zoneKey === "z1") return { color: "rgba(154, 166, 178, 0.82)", muted: "rgba(154, 166, 178, 0.18)" };
  if (segment.zoneKey === "z2") return { color: "rgba(52, 165, 218, 0.9)", muted: "rgba(52, 165, 218, 0.18)" };
  if (segment.zoneKey === "z3") return { color: "rgba(232, 185, 65, 0.92)", muted: "rgba(232, 185, 65, 0.18)" };
  return { color: "rgba(212, 84, 84, 0.92)", muted: "rgba(212, 84, 84, 0.18)" };
}

function phaseName(step: WorkoutStep, locale: SiteLocale = "da"): string {
  if (locale === "en") {
    if (step.type === "run") return "Run";
    if (step.type === "walk") return "Walk";
    if (step.type === "warmup") return "Warm-up";
    return "Cool-down";
  }
  if (step.type === "run") return "Løb";
  if (step.type === "walk") return "Gang";
  if (step.type === "warmup") return "Rask gang";
  return "Nedkøling";
}

function stepSupportingLabel(step: WorkoutStep, locale: SiteLocale = "da"): string | null {
  const label = step.label.trim();
  if (!label) return null;
  const phase = phaseName(step, locale).trim().toLowerCase();
  if (label.toLowerCase() === phase) return null;
  return label;
}

function coachingHint(step: WorkoutStep, locale: SiteLocale = "da"): string {
  if (locale === "en") {
    if (step.type === "warmup") return "Walk briskly and let your body warm up.";
    if (step.type === "run") return "Run at a controlled effort. You should still manage short sentences.";
    if (step.type === "walk") return "Ease the pace down and let your breathing settle.";
    return "Let your heart rate come down calmly while you keep moving.";
  }
  if (step.type === "warmup") return "Gå i rask tempo og bliv varm i kroppen.";
  if (step.type === "run") return "Løb i kontrolleret tempo. Du skal kunne tale i korte sætninger.";
  if (step.type === "walk") return "Sænk tempoet og træk vejret roligt.";
  return "Lad pulsen falde roligt og hold kroppen i bevægelse.";
}

function buildCue(step: WorkoutStep, mode: AudioMode, locale: SiteLocale = "da"): string {
  const shortCue = stepCueText(step, locale);
  if (mode === "coach") {
    return `${shortCue}. ${coachingHint(step, locale)}`;
  }
  return shortCue;
}

function transitionNoticeForStep(step: WorkoutStep, locale: SiteLocale = "da"): string {
  return locale === "en" ? `Now: ${phaseName(step, locale)}` : `Nu: ${phaseName(step, locale)}`;
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

function pulseSettingsKey(userId: string): string {
  return `stridepilotPulseSettings:${userId}`;
}

function sessionFeedbackStorageKey(currentProfileId: string): string {
  return `stridepilotSessionFeedback:${currentProfileId}`;
}

function savedFeedbackStatus(completionPct: number): SavedWorkoutSessionFeedback["status"] {
  if (completionPct <= 0) return "missed";
  if (completionPct < 95) return "shortened";
  return "completed";
}

function savedFeedbackStatusLabel(status: SavedWorkoutSessionFeedback["status"], locale: SiteLocale = "da"): string {
  if (locale === "en") {
    if (status === "completed") return "Completed";
    if (status === "shortened") return "Shortened";
    return "Missed";
  }
  if (status === "completed") return "Gennemført";
  if (status === "shortened") return "Afkortet";
  return "Missede";
}

function savedFeedbackEnergyLabel(value: number, locale: SiteLocale = "da"): string {
  if (locale === "en") {
    if (value <= 2) return "Low energy";
    if (value >= 4) return "Good energy";
    return "Okay energy";
  }
  if (value <= 2) return "Lav energi";
  if (value >= 4) return "God energi";
  return "Okay energi";
}

function savedFeedbackPainLabel(value: number, locale: SiteLocale = "da"): string {
  if (locale === "en") {
    if (value <= 1) return "No pain";
    if (value <= 3) return "Some soreness";
    if (value <= 6) return "Pain";
    return "High caution";
  }
  if (value <= 1) return "Ingen smerte";
  if (value <= 3) return "Lidt ømhed";
  if (value <= 6) return "Smerte";
  return "Høj forsigtighed";
}

function formatSubmittedAt(value: string, locale: SiteLocale = "da"): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale === "en" ? "en-GB" : "da-DK", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sessionShortDescription(session: WorkoutSession, locale: SiteLocale = "da"): string {
  if (locale === "en") {
    if (/interval/i.test(session.title)) return "Interval session with short run reps and calm recovery walking.";
    if (/udholdenhed/i.test(session.title)) return "Calm endurance session focused on continuity and steady rhythm.";
    if (/roligt/i.test(session.title)) return "Easy session with even effort and a comfortable rhythm.";
    if (/måldag|test/i.test(session.title)) return "Goal-specific session where you practise the form you have built.";
    return "A guided workout adapted to your current plan.";
  }
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
  return formatReadableDurationFromSeconds(totalSec);
}

function progressionTempoLabel(mode?: PlanRecommendationOption["progressionMode"], locale: SiteLocale = "da"): string {
  if (locale === "en") {
    if (mode === "conservative") return "Calm";
    if (mode === "ambitious") return "Ambitious";
    return "Standard";
  }
  if (mode === "conservative") return "Roligt";
  if (mode === "ambitious") return "Ambitiøst";
  return "Standard";
}

function longRunPreferenceLabel(value?: Goal["preferredLongRunDay"], locale: SiteLocale = "da"): string {
  if (locale === "en") {
    if (value === "saturday") return "Saturday";
    if (value === "sunday") return "Sunday";
    if (value === "both") return "Either works";
    return "Flexible";
  }
  if (value === "saturday") return "Lørdag";
  if (value === "sunday") return "Søndag";
  if (value === "both") return "Begge dage passer";
  return "Fleksibel";
}

function goalTypeLabel(value?: GoalType, locale: SiteLocale = "da"): string {
  if (locale === "en") {
    if (value === "run_without_walking") return "Without stopping";
    if (value === "target_time") return "Target pace";
    if (value === "pr") return "Set a PR";
    return "Complete";
  }
  if (value === "run_without_walking") return "Løbe uden stop";
  if (value === "target_time") return "Måltempo";
  if (value === "pr") return "Forbedre tid";
  return "Gennemføre";
}

function sessionTypeLabel(session: WorkoutSession, locale: SiteLocale = "da"): string {
  if (isGoalEventSession(session)) return locale === "en" ? "Race day" : "Måldag";
  if (/lang/i.test(session.title)) return locale === "en" ? "Long run" : "Lang tur";
  if (/run\/walk|udvikling/i.test(session.title)) return "Run/walk";
  if (/steady/i.test(session.title)) return "Steady";
  if (/progression/i.test(session.title)) return "Progression";
  if (/tempo/i.test(session.title)) return "Tempo";
  if (/recovery/i.test(session.title)) return "Recovery";
  return visibleSessionTitle(session.title, locale);
}

function sessionDisplayTitle(session: WorkoutSession, goalDistance: Goal["distance"], locale: SiteLocale = "da"): string {
  if (isGoalEventSession(session)) return buildGoalEventSessionLabel(session, goalDistance, locale);
  return visibleSessionTitle(session.title, locale);
}

function sessionStructureSummary(session: WorkoutSession, locale: SiteLocale = "da"): string {
  const runSteps = session.steps.filter((step) => step.type === "run");
  const walkSteps = session.steps.filter((step) => step.type === "walk");
  if (runSteps.length > 1 && walkSteps.length > 0) {
    const runLabel = formatMinutesLabel(runSteps[0].durationSec);
    const walkLabel = formatMinutesLabel(walkSteps[0].durationSec);
    return locale === "en" ? `${runSteps.length} x ${runLabel} run · ${walkLabel} walk` : `${runSteps.length} x ${runLabel} loeb · ${walkLabel} gang`;
  }
  if (runSteps.length === 1) {
    return locale === "en" ? `${formatMinutesLabel(runSteps[0].durationSec)} continuous running` : `${formatMinutesLabel(runSteps[0].durationSec)} sammenhaengende loeb`;
  }
  return session.steps.map((step) => `${phaseName(step, locale)} ${formatStepDuration(step)}`).join(" · ");
}

function sessionStructureText(session: WorkoutSession): string {
  const runSteps = session.steps.filter((step) => step.type === "run");
  const walkSteps = session.steps.filter((step) => step.type === "walk");
  if (runSteps.length > 1 && walkSteps.length > 0) {
    const runLabel = formatMinutesLabel(runSteps[0].durationSec);
    const walkLabel = formatMinutesLabel(walkSteps[0].durationSec);
    return `${runSteps.length} x ${runLabel} løb / ${walkLabel} gang`;
  }
  if (runSteps.length === 1) return `${formatMinutesLabel(runSteps[0].durationSec)} sammenhængende løb`;
  return session.steps.map((step) => `${phaseName(step)} ${formatStepDuration(step)}`).join(", ");
}

function buildProgramTextExport(params: {
  plan: TrainingPlan;
  goal: Goal;
  runnerProfile: RunnerProfile;
  recommendation?: PlanRecommendation | null;
}): string {
  const { plan, goal, runnerProfile, recommendation } = params;
  const sessions = visiblePlanSessions(plan, goal.startDate);
  const weeks = Array.from({ length: plan.weeks }, (_, index) => index + 1);
  const weeklyLoad = buildWeeklyLoad(plan, goal.startDate);
  const runnerName = runnerProfile.firstName?.trim();
  const goalText =
    goal.goalType === "run_without_walking"
      ? `${goal.distance} uden stop`
      : goal.goalType === "pr"
        ? `forbedre din tid på ${goal.distance}`
        : goal.goalType === "target_time"
          ? `${goal.distance} i måltempo`
          : `gennemføre ${goal.distance}`;
  const backboneType =
    goal.goalType === "run_without_walking" || goal.goalType === "complete" && goal.distance === "5K" || runnerProfile.currentRunningAbility === "helt_ny" || runnerProfile.currentRunningAbility === "fem_min"
      ? "Kontinuitets-backbone"
      : "Langturs-backbone";
  const longRunPeakMinutes = sessions
    .filter((session) => /lang|måldag|test/i.test(session.title))
    .reduce((max, session) => Math.max(max, Math.round(sessionTotalDurationSec(session) / 60)), 0);
  const continuousPeakMinutes = weeklyLoad.reduce((max, week) => Math.max(max, Math.round(week.longestContinuousRunSec / 60)), 0);
  const stepBackWeeks = weeklyLoad
    .filter((week, index) => index > 0 && week.load < weeklyLoad[index - 1]!.load * 0.94)
    .map((week) => week.week);
  const taperWeek = Math.max(plan.weeks - 1, 1);
  const raceWeek = plan.weeks;
  const totalTrainingMinutes = Math.round(sessions.reduce((sum, session) => sum + sessionTotalDurationSec(session), 0) / 60);
  const weeklyStructureLines = weeks.map((week) => {
    const weekSessions = sessions.filter((session) => session.week === week);
    const labels = weekSessions.map((session) => sessionTypeLabel(session));
    const stepBack = stepBackWeeks.includes(week) ? " · Step-back-uge" : "";
    return `Uge ${week}: ${labels.join(" / ") || "Ingen pas"}${stepBack}`;
  });

  const lines: string[] = [
    "StridePilot programeksport",
    runnerName ? `Løber: ${runnerName}` : "Løber: StridePilot-bruger",
    `Løberniveau: ${runnerProfile.runningExperience}`,
    `Mål: ${goalText}`,
    `Måltype: ${goalTypeLabel(goal.goalType)}`,
    `Varighed: ${plan.weeks} uger`,
    `Træningsrytme: ${recommendation ? `${recommendation.startingSessionsPerWeek} -> ${recommendation.peakSessionsPerWeek} pas/uge` : `${plan.sessionsPerWeek} pas/uge`}`,
    `Foretrukken dag til lang tur: ${longRunPreferenceLabel(goal.preferredLongRunDay)}`,
    `Progressionstempo: ${progressionTempoLabel(recommendation?.selectedOption?.progressionMode)}`,
    `Anbefalet varighed: ${recommendation?.recommendedDurationWeeks ?? plan.weeks} uger`,
    `Valgt varighed: ${recommendation?.selectedOption?.durationWeeks ?? plan.weeks} uger`,
    `Realistisk spænd: ${recommendation?.minDurationWeeks ?? plan.weeks}–${recommendation?.maxDurationWeeks ?? plan.weeks} uger`,
    `Planens niveau: ${recommendation?.selectedOption?.planLevelLabel ?? "Realistisk"}`,
    "",
    "Engine-resume",
    `Backbone-type: ${backboneType}`,
    `Peak lang tur: ${longRunPeakMinutes} min`,
    `Peak sammenhængende løb: ${continuousPeakMinutes} min`,
    `Step-back-uger: ${stepBackWeeks.length > 0 ? stepBackWeeks.join(", ") : "Ingen tydelige step-back-uger fundet"}`,
    `Taper-uge: Uge ${taperWeek}`,
    `Måluge: Uge ${raceWeek}`,
    `Antal pas i alt: ${sessions.length}`,
    `Samlet træningstid: ${totalTrainingMinutes} min`,
    "",
    "Tabel for sammenhængende løb",
    ...weeklyLoad.map((week) => `Uge ${week.week}: ${formatMinutesLabel(week.longestContinuousRunSec)}`),
    "",
    "Tabel for lang tur",
    ...weeks.map((week) => {
      const weekLongRun = sessions
        .filter((session) => session.week === week && /lang|måldag|test/i.test(session.title))
        .reduce((max, session) => Math.max(max, Math.round(sessionTotalDurationSec(session) / 60)), 0);
      return `Uge ${week}: ${weekLongRun} min`;
    }),
    "",
    "Ugestruktur",
    ...weeklyStructureLines,
    "",
  ];

  for (const week of weeks) {
    lines.push(`Uge ${week}`);
    const weekSessions = sessions.filter((session) => session.week === week);
    if (weekSessions.length === 0) {
      lines.push("Ingen planlagte pas.");
      lines.push("");
      continue;
    }
    for (const session of weekSessions) {
      const dateLabel = formatDanishDateWithWeekday(sessionDateFromPlan(goal.startDate, session));
      lines.push(`${session.dayOfWeek} – ${sessionTypeLabel(session)} – ${Math.round(sessionTotalDurationSec(session) / 60)} min`);
      lines.push(`Dato: ${dateLabel}`);
      lines.push(`Struktur: ${sessionStructureText(session)}`);
      lines.push(`Formål: ${sessionShortDescription(session)}`);
      if (session.notes) lines.push(`Note: ${session.notes}`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

function sessionTotalDurationSec(session: WorkoutSession): number {
  return session.steps.reduce((sum, step) => sum + step.durationSec, 0);
}

function intervalSummary(session: WorkoutSession, locale: SiteLocale = "da"): string {
  const runSteps = session.steps.filter((step) => step.type === "run");
  const walkSteps = session.steps.filter((step) => step.type === "walk");
  if (runSteps.length > 1) {
    const runDuration = formatClock(runSteps[0].durationSec).replace(/^00:/, "");
    const walkDuration = walkSteps[0]
      ? locale === "en"
        ? ` · ${formatClock(walkSteps[0].durationSec).replace(/^00:/, "")} walk recovery`
        : ` · ${formatClock(walkSteps[0].durationSec).replace(/^00:/, "")} gangpause`
      : "";
    return locale === "en" ? `${runSteps.length} × ${runDuration} run${walkDuration}` : `${runSteps.length} × ${runDuration} løb${walkDuration}`;
  }
  if (runSteps.length === 1) {
    return locale === "en" ? `${formatMinutesLabel(runSteps[0].durationSec)} continuous running` : `${formatMinutesLabel(runSteps[0].durationSec)} sammenhængende løb`;
  }
  return locale === "en" ? "Light movement and a calm rhythm" : "Let bevægelse og rolig rytme";
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

function detectAdaptivePlanChange(previousPlan: TrainingPlan, updatedPlan: TrainingPlan, locale: SiteLocale = "da"): { interpretation: string; adjustment: string; log?: string } {
  const previousById = new Map(previousPlan.sessions.map((session) => [session.id, session]));

  for (const updatedSession of updatedPlan.sessions) {
    const previousSession = previousById.get(updatedSession.id);
    if (!previousSession) continue;

    const previousType = classifyAdaptiveSession(previousSession);
    const updatedType = classifyAdaptiveSession(updatedSession);
    const minuteDelta = Math.round(sessionRunMinutes(updatedSession) - sessionRunMinutes(previousSession));

    if ((previousType === "interval" || previousType === "tempo") && updatedType === "easy") {
      return {
        interpretation: locale === "en" ? "The workout was more demanding than planned, so the next quality session is being made easier." : "Træningspasset var mere krævende end planlagt, så det næste kvalitetstræningspas bliver gjort roligere.",
        adjustment: locale === "en" ? "I am switching the next harder session to an easy run and shortening it slightly." : "Jeg skifter det næste hårdere træningspas til et roligt træningspas og korter det lidt ned.",
        log: locale === "en" ? "I am making the next quality session easier so the load does not build too quickly." : "Jeg gør det næste kvalitetstræningspas roligere, så belastningen ikke bygger sig for hurtigt op.",
      };
    }

    if (minuteDelta <= -5 && updatedType === "long") {
      return {
        interpretation: locale === "en" ? "The load looks a little high right now, so the next longer run is being shortened slightly." : "Belastningen ser lidt høj ud lige nu, så den næste længere tur bliver kortet lidt ned.",
        adjustment: locale === "en" ? "I am taking a little time off the longest session so the progression stays realistic." : "Jeg tager lidt tid af det længste træningspas, så progressionen forbliver realistisk.",
        log: locale === "en" ? "I am shortening the next longer run slightly so the overall load becomes more manageable." : "Jeg korter den næste længere tur lidt ned, så den samlede belastning bliver mere overkommelig.",
      };
    }

    if (minuteDelta < 0) {
      return {
        interpretation: locale === "en" ? "The workout looked a little more costly today, so the next session will stay slightly easier." : "Træningspasset så ud til at koste lidt mere i dag, så det næste træningspas holdes lidt roligere.",
        adjustment: locale === "en" ? "I am taking a little time off the next running block so you can hold the rhythm with more headroom." : "Jeg tager en smule tid af den næste løbedel, så du kan holde rytmen med mere overskud.",
        log: locale === "en" ? "I am keeping the next session a little easier so the body has more room to keep up." : "Jeg holder det næste træningspas lidt roligere, så kroppen får bedre plads til at følge med.",
      };
    }

    if (minuteDelta >= 3 && updatedType === "easy") {
      return {
        interpretation: locale === "en" ? "You had good headroom today, so the next easy session gets a few extra minutes." : "Du havde fint overskud i dag, så det næste rolige træningspas får et par ekstra minutter.",
        adjustment: locale === "en" ? "I am building a little further into the next easy session, while still keeping the progression controlled." : "Jeg bygger en smule videre på det næste rolige træningspas, men holder stadig progressionen kontrolleret.",
        log: locale === "en" ? "I am adding a few extra minutes to the next easy session because you looked comfortable today." : "Jeg lægger et par ekstra minutter på det næste rolige træningspas, fordi du ser ud til at have overskud.",
      };
    }
  }

  return {
    interpretation: locale === "en" ? "The workout landed at a good level, so the plan can keep moving at a calm and steady pace." : "Træningspasset ramte et godt niveau, så planen kan fortsætte i et roligt og stabilt tempo.",
    adjustment: locale === "en" ? "I am keeping the progression steady so you can continue building without forcing anything." : "Jeg holder progressionen stabil, så du kan bygge videre uden at forcere noget.",
  };
}

function learnedInsightLines(capability: CapabilityState | null, plan: TrainingPlan | null, locale: SiteLocale = "da"): string[] {
  const lines = [...(plan?.rationale?.adaptation?.learnedTendencies ?? [])];
  const traits = capability?.traits;
  if (!traits) return lines.slice(0, 3);

  if (traits.progressionTolerance >= 3.8 && traits.complianceTrend >= 3.5) {
    lines.push(locale === "en" ? "You have handled the progression of the last few weeks well." : "Du har håndteret de seneste ugers progression godt.");
  }
  if (traits.longRunTolerance >= 3.8) {
    lines.push(locale === "en" ? "Your longer runs look more stable than before." : "Dine længere ture ser mere stabile ud end tidligere.");
  }
  if (traits.longRunTolerance <= 2.5) {
    lines.push(locale === "en" ? "The long runs are being built a little more cautiously right now." : "Langturene bygges lidt mere forsigtigt lige nu.");
  }
  if (traits.qualityTolerance <= 2.5) {
    lines.push(locale === "en" ? "The quality sessions are being kept more controlled while tolerance builds." : "Kvalitetstræningspassene holdes mere kontrollerede, mens tolerancen bygger sig op.");
  }
  if (traits.cautionTrend >= 3.8) {
    lines.push(locale === "en" ? "Recent signals suggest that the plan should be a little more cautious right now." : "De seneste signaler peger på, at planen skal være lidt mere forsigtig lige nu.");
  }
  if (traits.complianceTrend >= 3.8 && traits.cautionTrend <= 2.6) {
    lines.push(locale === "en" ? "You have been stable for several weeks in a row, so the plan can keep its rhythm." : "Du har været stabil flere uger i træk, så planen kan holde rytmen.");
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

function localizedWeekStateLabel(plan: TrainingPlan | null, weekNumber: number, locale: SiteLocale = "da"): { title: string; tone: string } {
  const state = weekStateLabel(plan, weekNumber);
  if (locale !== "en") return state;
  const titleMap: Record<string, string> = {
    "Recovery-uge": "Recovery week",
    "Kontrolleret uge": "Controlled week",
    "Tilbage i build": "Back in build",
    "Progressionsuge": "Progression week",
    "Stabiliseringsuge": "Stabilization week",
    "Skærpende uge": "Sharpening week",
    "Byggeuge": "Build week",
  };
  const toneMap: Record<string, string> = {
    "Vi holder ugen bevidst lettere.": "We are intentionally keeping the week lighter.",
    "Ugen er dæmpet lidt for at holde belastningen bæredygtig.": "The week is eased slightly to keep the load sustainable.",
    "Du er på vej tilbage i normal progression.": "You are moving back toward normal progression.",
    "Ugen bygger lidt mere selvsikkert videre.": "This week builds a little more confidently.",
    "Ugen giver plads til at absorbere træningen.": "This week gives you room to absorb the training.",
    "Ugen holder dig frisk og målrettet.": "This week keeps you fresh and focused.",
    "Ugen bygger roligt videre på din form.": "This week builds calmly on your current fitness.",
  };
  return { title: titleMap[state.title] ?? state.title, tone: toneMap[state.tone] ?? state.tone };
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

function coachAdjustmentCopy(text: string, locale: SiteLocale = "da"): string {
  if (locale === "en") return text;
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

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("welcome");
  const [authMode, setAuthMode] = useState<AuthMode>("signup");
  const [hasSetup, setHasSetup] = useState(false);
  const [displayWeek, setDisplayWeek] = useState(1);
  const [isCompactProgramViewport, setIsCompactProgramViewport] = useState(false);
  const [appearance] = useState<ThemePref>("dark");
  const [effectiveTheme, setEffectiveTheme] = useState<"dark" | "light">("dark");
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [onboardingSelections, setOnboardingSelections] = useState<OnboardingSelectionState>({
    track: false,
    runningAbility: false,
    goalDistance: false,
    goalType: false,
    activityLevel: false,
    ambition: true,
  });

  const [runnerProfile, setRunnerProfile] = useState<RunnerProfile>({
    firstName: "",
    onboardingTrack: undefined,
    heightCm: 175,
    weightKg: 75,
    age: 30,
    activityLevel: "moderat",
    runningExperience: "nybegynder",
    currentRunningAbility: "helt_ny",
    currentContinuousDistanceKm: undefined,
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
    pulseGuidanceEnabled: false,
    maxHeartRate: null,
  });
  const [goal, setGoal] = useState<Goal>({
    distance: "5K",
    goalType: "complete",
    weeks: 12,
    startDate: getSuggestedPlanStartDate(),
    reminderTime: "13:00",
    targetTime: "",
    targetPaceSecPerKm: undefined,
    endDate: undefined,
    availableTrainingDays: ["Tirsdag", "Torsdag", "Lordag"],
    preferredLongRunDay: "both",
  });
  const [goalPaceDraft, setGoalPaceDraft] = useState<{ minute: string; second: string }>({ minute: "", second: "" });
  const [capacityDistanceDraft, setCapacityDistanceDraft] = useState("");
  const [recentRaceDraft, setRecentRaceDraft] = useState<{ distance: Goal["distance"] | ""; time: string }>({ distance: "", time: "" });
  const [recentRaceTimeParts, setRecentRaceTimeParts] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [showRecentRaceFields, setShowRecentRaceFields] = useState(false);
  const siteLocale = useMemo<SiteLocale>(() => {
    if (typeof window !== "undefined") {
      return getConfiguredSiteLocale(window.location.host);
    }
    return getConfiguredSiteLocale();
  }, []);
  const siteCopy = useMemo(() => getSiteCopy(siteLocale), [siteLocale]);
  const currentHost = useMemo(() => (typeof window !== "undefined" ? window.location.host : undefined), []);
  const ui = useMemo(
    () => ({
      onboardingLabel: siteLocale === "en" ? "Onboarding" : "Onboarding",
      onboardingStep: siteLocale === "en" ? `Step ${onboardingStep} of ${ONBOARDING_STEP_COUNT}` : `Trin ${onboardingStep} af ${ONBOARDING_STEP_COUNT}`,
      back: siteLocale === "en" ? "Back" : "Forrige",
      skip: siteLocale === "en" ? "Skip for now" : "Spring over",
      showMyPlan: siteLocale === "en" ? "Show my plan" : "Se min plan",
      loadingPlan: siteLocale === "en" ? "Getting your plan..." : "Henter plan...",
      recommendation: {
        title: siteLocale === "en" ? "My recommendation" : "Min anbefaling",
        recommendedDuration: siteLocale === "en" ? "Recommended duration" : "Anbefalet varighed",
        realisticRange: siteLocale === "en" ? "Realistic range" : "Realistisk spænd",
        selectedPath: siteLocale === "en" ? "Selected route" : "Valgt vej",
        recommendedPath: siteLocale === "en" ? "Recommended route" : "Anbefalet vej",
        selectedDuration: siteLocale === "en" ? "Your selected duration" : "Din valgte varighed",
        trainingRhythm: siteLocale === "en" ? "Training rhythm" : "Træningsrytme",
        progressionTempo: siteLocale === "en" ? "Progression pace" : "Progressionstempo",
        planLevel: siteLocale === "en" ? "Plan level" : "Planens niveau",
        realistic: siteLocale === "en" ? "Realistic" : "Realistisk",
        adjustDuration: siteLocale === "en" ? "Adjust duration" : "Tilpas varighed",
        adjustLead: siteLocale === "en" ? "I recommend this duration, but you can adjust it if you want to." : "Jeg anbefaler denne varighed, men du kan justere, hvis du vil.",
        weeks: siteLocale === "en" ? "Weeks" : "Uger",
        minusWeek: siteLocale === "en" ? "− 1 week" : "− 1 uge",
        plusWeek: siteLocale === "en" ? "+ 1 week" : "+ 1 uge",
        endDate: siteLocale === "en" ? "Target date" : "Slutdato",
        adjustment: siteLocale === "en" ? "Adjustment" : "Justering",
      },
      program: {
        introFallback: siteLocale === "en" ? "The key points are at the top. The rest is only there for context." : "Det vigtigste står øverst. Resten er kun baggrund.",
        progress: siteLocale === "en" ? "Progress" : "Fremdrift",
        selectedWeek: siteLocale === "en" ? `Selected week: W${displayWeek}` : `Valgt uge: U${displayWeek}`,
        weekRange: (start: number, end: number) => (siteLocale === "en" ? `Weeks ${start}–${end}` : `Uge ${start}–${end}`),
        tapWeekHint: siteLocale === "en" ? "Tap a week to open it in the plan" : "Tryk på en uge for at åbne den i programmet",
        viewWeek: (week: number) => (siteLocale === "en" ? `Show week ${week}` : `Vis uge ${week}`),
        originalPlan: siteLocale === "en" ? "Original plan" : "Oprindelig plan",
        fromStart: siteLocale === "en" ? "From the start" : "Fra start",
        currentPlan: siteLocale === "en" ? "Current plan" : "Nuværende plan",
        afterAdjustments: siteLocale === "en" ? "After adjustments" : "Efter justeringer",
        currentWeek: siteLocale === "en" ? "Current week" : "Aktuel uge",
        selectedNow: siteLocale === "en" ? "Selected now" : "Valgt nu",
        planAdjustment: siteLocale === "en" ? "Plan adjustment" : "Planjustering",
        showMore: siteLocale === "en" ? "Show more" : "Vis mere",
        showLess: siteLocale === "en" ? "Show less" : "Vis mindre",
        weekOverviewNotes: siteLocale === "en" ? "Week overview and notes" : "Ugeoverblik og noter",
        focusNow: siteLocale === "en" ? "Current focus" : "Fokus lige nu",
        currentWeekTitle: siteLocale === "en" ? "Current week" : "Nuværende uge",
        overviewOfWeek: (week: number) => (siteLocale === "en" ? `Overview of week ${week}` : `Overblik over uge ${week}`),
        weeklyLoad: siteLocale === "en" ? "Weekly load" : "Ugens load",
        longestRun: siteLocale === "en" ? "Longest continuous run" : "Længste sammenhængende løb",
        nextGoalDay: siteLocale === "en" ? "Next race day" : "Næste måldag",
        previousWeek: siteLocale === "en" ? "Previous week" : "Forrige uge",
        nextWeek: siteLocale === "en" ? "Next week" : "Næste uge",
        about: siteLocale === "en" ? "about" : "ca.",
        nextWorkout: siteLocale === "en" ? "Next workout" : "Næste pas",
        restDayText: siteLocale === "en" ? "Recovery day, light movement, and space to absorb the week." : "Hvile, let bevægelse og plads til at lande ugen.",
        recoveryDay: siteLocale === "en" ? "Recovery day" : "Restitutionsdag",
        noRunToday: siteLocale === "en" ? "No run is planned today. Would you like a few light ideas instead?" : "Ingen planlagt løbetræning. Vil du have et par lette forslag i stedet?",
        showIdeas: siteLocale === "en" ? "Show ideas" : "Vis forslag",
        close: siteLocale === "en" ? "Close" : "Luk",
        ideas: siteLocale === "en" ? ["20–30 min walk", "10 min mobility", "Light strength or core", "Easy cycling without pushing"] : ["20-30 min gåtur", "10 min mobilitet", "Let styrke eller core", "Rolig cykling uden at presse"],
        programAdjustments: siteLocale === "en" ? "Plan adjustments" : "Programjusteringer",
        seeAllAdjustments: siteLocale === "en" ? "See all adjustments" : "Se alle justeringer",
        yourNotes: siteLocale === "en" ? "Your notes" : "Egne noter",
        notesLead: siteLocale === "en" ? "Save short notes about sleep, load, or anything you want to remember for next week." : "Gem korte noter om søvn, belastning eller noget du vil huske til næste uge.",
        notesPlaceholder: siteLocale === "en" ? "For example: legs felt a little heavy after week 4, but sleep was poor too." : "Fx: lidt tunge ben efter uge 4, men søvnen var også dårlig.",
        saving: siteLocale === "en" ? "Saving..." : "Gemmer...",
        saved: siteLocale === "en" ? "Saved" : "Gemt",
        saveNote: siteLocale === "en" ? "Save note" : "Gem note",
        trainingInsights: siteLocale === "en" ? "Training insights" : "Træningsindsigter",
      },
      workout: {
        chooseWorkout: siteLocale === "en" ? "Choose a workout in the plan first." : "Vælg et træningspas i programmet først.",
        closeWorkoutAria: siteLocale === "en" ? "Close workout" : "Luk træningspas",
        savedFeedback: siteLocale === "en" ? "Saved feedback" : "Gemt feedback",
        alreadyLogged: siteLocale === "en" ? "This workout has already been logged" : "Dette træningspas er allerede logget",
        load: siteLocale === "en" ? "Load" : "Belastning",
        rating: siteLocale === "en" ? "Rating" : "Vurdering",
        savedSignals: siteLocale === "en" ? "Saved signals" : "Gemte signaler",
        note: siteLocale === "en" ? "Note" : "Note",
        completed: siteLocale === "en" ? "Workout completed" : "Pas afsluttet",
        completionTitle: siteLocale === "en" ? "Nice run 👏" : "Godt løbet 👏",
        completionRegistered: siteLocale === "en" ? "Your run is registered" : "Din tur er registreret",
        completionPrompt: siteLocale === "en" ? "How did it feel?" : "Hvordan føltes den?",
        continueToCheckIn: siteLocale === "en" ? "Continue" : "Fortsæt",
        quickCheckIn: siteLocale === "en" ? "Quick check-in" : "Kort check-in",
        quickCheckInLead: siteLocale === "en" ? "Your answer helps the plan adjust over time." : "Dit svar hjælper planen med at justere sig over tid.",
        confirmationTitle: siteLocale === "en" ? "Thanks 👍" : "Tak 👍",
        confirmationBadge: siteLocale === "en" ? "Plan update" : "Planopdatering",
        confirmationBody: siteLocale === "en" ? "We use your runs to keep the plan adjusted over time." : "Vi bruger dine ture til at justere planen løbende.",
        nextRunSoon: siteLocale === "en" ? "Next run is taking shape." : "Næste tur er ved at falde på plads.",
        nextRunLabel: siteLocale === "en" ? "Next run" : "Næste tur",
        seeNextRun: siteLocale === "en" ? "See next run" : "Se næste tur",
        niceWork: siteLocale === "en" ? "Nice work" : "Godt arbejde",
        howFelt: siteLocale === "en" ? "Tell me briefly how the workout felt." : "Fortæl kort hvordan passet føltes.",
        intervalsCompleted: (count: number) => siteLocale === "en" ? `${count} intervals completed` : `${count} intervaller gennemført`,
        coachResponse: siteLocale === "en" ? "Coach response" : "Coach-respons",
        yourFeedback: siteLocale === "en" ? "Your feedback" : "Din feedback",
        thanks: siteLocale === "en" ? "Thanks for your feedback." : "Tak for din feedback.",
        adjustedNextStep: siteLocale === "en" ? "I have reviewed your feedback and adjusted the next step in the plan." : "Jeg har set din feedback og justeret det næste skridt i planen.",
        whatINoticed: siteLocale === "en" ? "What I noticed" : "Det lagde jeg mærke til",
        whatIChange: siteLocale === "en" ? "What I am changing" : "Det ændrer jeg",
        nextStep: siteLocale === "en" ? "Next step" : "Næste skridt",
        focusNow: siteLocale === "en" ? "Focus now" : "Fokus nu",
        whatILearn: siteLocale === "en" ? "What I am learning about you" : "Det lærer jeg om dig",
        agree: siteLocale === "en" ? "Agree" : "Enig",
        disagree: siteLocale === "en" ? "Disagree" : "Ikke enig",
        clarifyPlaceholder: siteLocale === "en" ? "A short note if you want to add context" : "Kort forklaring, hvis du vil nuancere vurderingen",
        sendClarification: siteLocale === "en" ? "Send clarification" : "Send afklaring",
        yourNote: siteLocale === "en" ? "Your note" : "Din note",
        updatedProgram: siteLocale === "en" ? "See updated plan" : "Se opdateret program",
        completionQuestion: siteLocale === "en" ? "1. Did the workout go as planned?" : "1. Gik passet som planlagt?",
        chooseBest: siteLocale === "en" ? "Choose the option that fits best." : "Vælg den, der passer bedst.",
        feelingQuestion: siteLocale === "en" ? "2. How did it feel?" : "2. Hvordan føltes det?",
        quickSignals: siteLocale === "en" ? "3. Quick signals" : "3. Hurtige signaler",
        energyPainOnly: siteLocale === "en" ? "Only energy and pain. The rest is optional." : "Kun energi og smerte. Resten er valgfrit.",
        energy: siteLocale === "en" ? "Energy" : "Energi",
        pain: siteLocale === "en" ? "Pain" : "Smerte",
        perceivedLoad: siteLocale === "en" ? "Perceived load (1–10)" : "Oplevet belastning (1–10)",
        completionPct: siteLocale === "en" ? "Completed %" : "Gennemført %",
        shortNote: siteLocale === "en" ? "Short note" : "Kort note",
        shortNotePlaceholder: siteLocale === "en" ? "Anything specific I should know?" : "Noget særligt jeg skal vide?",
        feedbackSaved: siteLocale === "en" ? "Feedback saved ✓" : "Feedback gemt ✓",
        fewTaps: siteLocale === "en" ? "You can be done in just a few taps." : "Du kan være færdig på få tryk.",
      },
      overlay: {
        important: siteLocale === "en" ? "Important to confirm" : "Vigtigt at bekræfte",
        adjustTrainingDays: siteLocale === "en" ? "Adjust training days" : "Ret træningsdage",
        useRecommendedDuration: siteLocale === "en" ? "Use recommended duration" : "Brug anbefalet varighed",
        building: siteLocale === "en" ? "Building your plan..." : "Jeg bygger dit program...",
        assembling: siteLocale === "en" ? "Putting your plan together..." : "Jeg samler dit program...",
        finalSummary: siteLocale === "en" ? "Finishing the final coach summary." : "Gør den sidste coach-opsummering klar.",
        firstWeeks: siteLocale === "en" ? "I am laying out your first weeks from your goal and current level." : "Jeg lægger dine første uger på plads ud fra dit mål og dit nuværende niveau.",
      },
    }),
    [displayWeek, onboardingStep, siteLocale],
  );
  const localizedGoalDistanceOptions = useMemo(
    () => GOAL_DISTANCE_OPTIONS.map((option) => ({ ...option, label: option.value === "Halvmaraton" ? (siteLocale === "en" ? "Half marathon" : "Halvmaraton") : option.value === "Marathon" ? (siteLocale === "en" ? "Marathon" : "Maraton") : option.label })),
    [siteLocale],
  );
  const localizedCurrentRunsPerWeekOptions = useMemo(
    () => CURRENT_RUNS_PER_WEEK_OPTIONS.map((option) => ({ ...option, label: siteLocale === "en" ? (option.value === 0 ? "0 runs" : option.value === 1 ? "1 run" : option.value === 4 ? "4+ runs" : `${option.value} runs`) : option.label })),
    [siteLocale],
  );
  const localizedActivityLevelOptions = useMemo(
    () => ACTIVITY_LEVEL_OPTIONS.map((option, index) => ({ ...option, label: siteLocale === "en" ? ["Almost no other training", "A little other training", "Regular other training", "Quite a bit of other training", "Very high total training"][index] ?? option.label : option.label })),
    [siteLocale],
  );
  const localizedGenderOptions = useMemo(
    () => GENDER_OPTIONS.map((option, index) => ({ ...option, label: siteLocale === "en" ? ["Female", "Male", "Other", "Prefer not to say"][index] ?? option.label : option.label })),
    [siteLocale],
  );
  const localizedAmbitionOptions = useMemo(
    () => AMBITION_OPTIONS.map((option, index) => siteLocale === "en"
      ? [
          { ...option, label: "Calmer route", help: "A calmer, slightly longer route with more room for recovery and steady habits." },
          { ...option, label: "Recommended route", help: "StridePilot's standard recommendation and usually the most realistic route." },
          { ...option, label: "Ambitious route", help: "A shorter route, but only when your current level supports it safely." },
        ][index] ?? option
      : option),
    [siteLocale],
  );
  const localizedLongRunDayOptions = useMemo(
    () => LONG_RUN_DAY_OPTIONS.map((option, index) => siteLocale === "en"
      ? [
          { ...option, label: "Saturday", help: "StridePilot first tries to place the long run on Saturday." },
          { ...option, label: "Sunday", help: "StridePilot first tries to place the long run on Sunday." },
          { ...option, label: "Either works", help: "StridePilot chooses the weekend day that fits recovery best." },
          { ...option, label: "Flexible", help: "StridePilot chooses the day that gives the most robust week." },
        ][index] ?? option
      : option),
    [siteLocale],
  );
  const localizedQuickFeedbackOptions = useMemo(
    () => QUICK_FEEDBACK_OPTIONS.map((option, index) => ({ ...option, label: siteLocale === "en" ? ["Too easy", "About right", "A bit too hard", "Too hard"][index] ?? option.label : option.label })),
    [siteLocale],
  );
  const localizedCompletionOptions = useMemo(
    () => COMPLETION_OPTIONS.map((option, index) => ({ ...option, label: siteLocale === "en" ? ["Completed", "Shortened", "Missed"][index] ?? option.label : option.label })),
    [siteLocale],
  );
  const localizedEnergyOptions = useMemo(
    () => ENERGY_OPTIONS.map((option, index) => ({ ...option, label: siteLocale === "en" ? ["Low energy", "Okay energy", "Good energy"][index] ?? option.label : option.label })),
    [siteLocale],
  );
  const localizedPainOptions = useMemo(
    () => PAIN_OPTIONS.map((option, index) => ({ ...option, label: siteLocale === "en" ? ["No pain", "Some soreness", "Pain"][index] ?? option.label : option.label })),
    [siteLocale],
  );
  const [pulseDraft, setPulseDraft] = useState({ maxHeartRate: "" });
  const pulseSettingsHydratedUserRef = useRef<string | null>(null);
  const [planAmbition, setPlanAmbition] = useState<PlanAmbition>("standard");
  const [planRecommendation, setPlanRecommendation] = useState<PlanRecommendation | null>(null);

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
  const [pendingLowFrequencyOverride, setPendingLowFrequencyOverride] = useState<PendingLowFrequencyOverride | null>(null);
  const [acceptedLowFrequencyOverrideKey, setAcceptedLowFrequencyOverrideKey] = useState<string | null>(null);
  const [selectedRecommendationDurationWeeks, setSelectedRecommendationDurationWeeks] = useState<number | null>(null);
  const [pendingDurationOverride, setPendingDurationOverride] = useState<PendingDurationOverride | null>(null);
  const [acceptedDurationOverrideKey, setAcceptedDurationOverrideKey] = useState<string | null>(null);

  const [profileId, setProfileId] = useState<string>("");
  const [baselinePlan, setBaselinePlan] = useState<TrainingPlan | null>(null);
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [persistedCurrentWeek, setPersistedCurrentWeek] = useState<number | null>(null);
  const [historySummary, setHistorySummary] = useState<PlanHistorySummary | null>(null);
  const [savedAdaptations, setSavedAdaptations] = useState<SavedPlanAdaptation[]>([]);
  const [savedNotes, setSavedNotes] = useState<SavedProfileNote[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteSaveState, setNoteSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [runnerProfileInsights, setRunnerProfileInsights] = useState<RunnerProfileInsights | null>(null);
  const [, setCoachExplanationSummary] = useState<string[]>([]);
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
  const [focusedProgramDayIso, setFocusedProgramDayIso] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(false);
  const [audioMode, setAudioMode] = useState<AudioMode>("coach");
  const [ttsSupported, setTtsSupported] = useState(false);
  const [cueFallbackText, setCueFallbackText] = useState("");
  const [stepIndex, setStepIndex] = useState(0);
  const [remainingSec, setRemainingSec] = useState(0);
  const [workoutCompleted, setWorkoutCompleted] = useState(false);
  const [workoutStartCountdown, setWorkoutStartCountdown] = useState<number | null>(null);
  const [showWorkoutCheckIn, setShowWorkoutCheckIn] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [stepNotice, setStepNotice] = useState("");
  const [workoutInterruptionNotice, setWorkoutInterruptionNotice] = useState<string | null>(null);
  const [safetyAdjustments, setSafetyAdjustments] = useState<string[]>([]);
  const [planWarnings, setPlanWarnings] = useState<string[]>([]);
  const [showAllSafety, setShowAllSafety] = useState(false);
  const [showProgramMore, setShowProgramMore] = useState(false);
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
  const workoutNoticeTimeout = useRef<number | null>(null);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
  const lastTickAtRef = useRef<number | null>(null);
  const hiddenAtRef = useRef<number | null>(null);
  const wasRunningBeforeHideRef = useRef(false);
  const programWeekRef = useRef<HTMLDivElement | null>(null);
  const nextWorkoutDayRef = useRef<HTMLButtonElement | null>(null);
  const previousStageRef = useRef(stage);
  const preAdaptationPlanRef = useRef<TrainingPlan | null>(null);
  const recentFeedbackRef = useRef<CoachWorkoutFeedback[]>([]);
  const recentCapabilityRef = useRef<CapabilityState[]>([]);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const landingTrackedRef = useRef(false);
  const onboardingStartedTrackedRef = useRef(false);
  const lastWorkoutStartedRef = useRef<string | null>(null);
  const lastWorkoutCompletedRef = useRef<string | null>(null);
  const [restDayPrompt, setRestDayPrompt] = useState<{ dateLabel: string; showIdeas: boolean } | null>(null);

  const resetProgramState = useCallback(() => {
    setHasSetup(false);
    setProfileId("");
    setBaselinePlan(null);
    setPlan(null);
    setPersistedCurrentWeek(null);
    setHistorySummary(null);
    setSavedAdaptations([]);
    setSavedNotes([]);
    setNoteDraft("");
    setNoteSaveState("idle");
    setRunnerProfileInsights(null);
    setCoachExplanationSummary([]);
    setFeedbackInsights(null);
    setCapabilityState(null);
    setRunnerState(null);
    setSessionHistory(createInitialSessionHistory());
    setTrainingBlock(createInitialTrainingBlock());
    setFocusedProgramDayIso(null);
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
    setWorkoutStartCountdown(null);
    setShowWorkoutCheckIn(false);
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
    resetAnalyticsUser();
    setAuthUser(null);
    setIsDemoMode(false);
    setStage("welcome");
    setAuthMode("signup");
    setEffectiveTheme("dark");
    setAudioMode("coach");
    setEmail("");
    setPassword("");
    setError(null);
    setIsRunning(false);
    setSpeechEnabled(false);
    setCueFallbackText("");
    setStepIndex(0);
    setRemainingSec(0);
    setWorkoutInterruptionNotice(null);
    setOnboardingStep(1);
    setOnboardingSelections({
      track: false,
      runningAbility: false,
      goalDistance: false,
      goalType: false,
      activityLevel: false,
      ambition: true,
    });
    setOpenInfoField(null);
    setRestDayPrompt(null);
    setShowAllSafety(false);
    setPlanFeasibilityStatus("feasible");
    setPlanAmbition("standard");
    setPlanRecommendation(null);
    setPendingLowFrequencyOverride(null);
    setAcceptedLowFrequencyOverrideKey(null);
    setSelectedRecommendationDurationWeeks(null);
    setPendingDurationOverride(null);
    setAcceptedDurationOverrideKey(null);
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
      onboardingTrack: undefined,
      heightCm: 175,
      weightKg: 75,
      age: 30,
      activityLevel: "moderat",
      runningExperience: "nybegynder",
      currentRunningAbility: "helt_ny",
      currentContinuousDistanceKm: undefined,
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
      pulseGuidanceEnabled: false,
      maxHeartRate: null,
    });
    setCapacityDistanceDraft("");
    setPulseDraft({ maxHeartRate: "" });
    setProfileDraft({
      heightCm: "175",
      weightKg: "75",
      age: "30",
    });
    setGoal({
      distance: "5K",
      goalType: "complete",
      weeks: 12,
      startDate: getSuggestedPlanStartDate(),
      reminderTime: "13:00",
      targetTime: "",
      targetPaceSecPerKm: undefined,
      endDate: undefined,
      availableTrainingDays: ["Tirsdag", "Torsdag", "Lordag"],
      preferredLongRunDay: "both",
    });
    setShowRecentRaceFields(false);

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
    return plan.sessions.find((session) => isGoalEventSession(session) || /test/i.test(session.title)) ?? plan.sessions[plan.sessions.length - 1];
  }, [plan]);
  const baselineGoalDate = useMemo(() => {
    if (!baselinePlan || baselinePlan === plan) return null;
    return goalDateFromPlanSessions(baselinePlan, goal.startDate);
  }, [baselinePlan, goal.startDate, plan]);
  const currentPlanGoalDate = useMemo(
    () => goalDateFromPlanSessions(plan, goal.startDate) ?? goal.endDate ?? null,
    [goal.endDate, goal.startDate, plan],
  );
  const trainingDayRecommendation = useMemo(
    () => recommendTrainingDays(runnerProfile, goal),
    [goal, runnerProfile],
  );
  const capacityDistanceKm = useMemo(() => parseCurrentCapacityDistanceKm(capacityDistanceDraft), [capacityDistanceDraft]);
  const lowFrequencyOverridePrompt = useMemo(() => buildLowFrequencyOverridePrompt(goal, siteLocale), [goal, siteLocale]);
  const weeklyStructureStep = useMemo(
    () => ONBOARDING_STEPS.find((step) => step.id === "weekly_structure")?.index ?? 6,
    [],
  );
  const feedbackSubmitted = Boolean(feedbackConfirmation);
  const currentWeeklyLoad = useMemo(() => (plan ? buildWeeklyLoad(plan, goal.startDate) : []), [goal.startDate, plan]);
  const baselineWeeklyLoad = useMemo(() => (baselinePlan ? buildWeeklyLoad(baselinePlan, goal.startDate) : []), [baselinePlan, goal.startDate]);
  const currentWeekLoad = currentWeeklyLoad.find((point) => point.week === displayWeek) ?? currentWeeklyLoad[0] ?? null;
  const currentWeekLongestContinuousRunSec = currentWeekLoad?.longestContinuousRunSec ?? 0;
  const releaseWakeLock = useCallback(async () => {
    if (!wakeLockRef.current) return;
    try {
      await wakeLockRef.current.release();
    } catch {
      // Ignore release errors; the sentinel may already be gone.
    } finally {
      wakeLockRef.current = null;
    }
  }, []);

  const requestWakeLock = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (typeof document === "undefined" || document.visibilityState !== "visible") return;
    if (!("wakeLock" in navigator)) return;

    try {
      const sentinel = await (navigator as Navigator & {
        wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
      }).wakeLock?.request("screen");
      if (!sentinel) return;
      wakeLockRef.current = sentinel;
    } catch {
      // Safari/iOS may not support or may deny wake lock; we handle that quietly.
    }
  }, []);

  const finishWorkout = useCallback(() => {
    cancelCue();
    setIsRunning(false);
    void releaseWakeLock();
    setWorkoutCompleted(true);
    setWorkoutStartCountdown(null);
    setShowWorkoutCheckIn(false);
    if (activeSession && lastWorkoutCompletedRef.current !== activeSession.id) {
      lastWorkoutCompletedRef.current = activeSession.id;
      captureAppEvent("workout_completed", {
        locale: siteLocale,
        session_type: sessionAnalyticsType(activeSession),
        session_title: activeSession.title,
        week: activeSession.week,
      });
    }
    const cue = "Godt løbet. Passet er gennemført.";
    setCueFallbackText(cue);
    if (audioMode !== "off" && ttsSupported && speechEnabled) {
      speakCue(cue);
    }
  }, [activeSession, audioMode, releaseWakeLock, siteLocale, speechEnabled, ttsSupported]);

  useEffect(() => {
    if (landingTrackedRef.current) return;
    landingTrackedRef.current = true;
    captureAppEvent("landing_view", { locale: siteLocale });
  }, [siteLocale]);

  useEffect(() => {
    if (stage !== "profile" || hasSetup || onboardingStartedTrackedRef.current) return;
    onboardingStartedTrackedRef.current = true;
    captureAppEvent(
      "onboarding_started",
      buildAnalyticsPlanProperties({
        locale: siteLocale,
        goal,
        track: runnerProfile.onboardingTrack,
      }),
    );
  }, [goal, hasSetup, runnerProfile.onboardingTrack, siteLocale, stage]);

  useEffect(() => {
    return () => {
      if (feedbackSuccessTimeout.current) {
        clearTimeout(feedbackSuccessTimeout.current);
      }
      if (workoutNoticeTimeout.current) {
        window.clearTimeout(workoutNoticeTimeout.current);
      }
    };
  }, []);

  const weekNumber = useMemo(() => {
    if (!plan) return 1;
    if (persistedCurrentWeek) {
      return Math.max(1, Math.min(plan.weeks, persistedCurrentWeek));
    }
    const now = new Date();
    const computedWeek = calendarWeekIndexFromDate(goal.startDate, now);
    return Math.max(1, Math.min(plan.weeks, computedWeek));
  }, [goal.startDate, persistedCurrentWeek, plan]);

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
    const datedSessions = plan
      ? visiblePlanSessions(plan, goal.startDate).map((session) => ({
          session,
          date: sessionDateFromPlan(goal.startDate, session),
        }))
      : [];
    return findRelevantNextSession({
      sessions: datedSessions,
      activeWeek: weekNumber,
    });
  }, [goal.startDate, plan, weekNumber]);
  const nextSessionWeek = useMemo(() => {
    if (!nextSession) return null;
    return calendarWeekIndexFromDate(goal.startDate, sessionDateFromPlan(goal.startDate, nextSession));
  }, [goal.startDate, nextSession]);
  const todaySession = useMemo(() => {
    if (!plan) return null;
    const today = new Date();
    return (
      visiblePlanSessions(plan, goal.startDate).find((session) => sessionDateFromPlan(goal.startDate, session).toDateString() === today.toDateString()) ?? null
    );
  }, [goal.startDate, plan]);

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
        currentWeek?: number;
        history?: PlanHistorySummary;
        adaptations?: SavedPlanAdaptation[];
        notes?: SavedProfileNote[];
      };

      if (!data.plan) return false;

      setPlan(data.plan);
      setBaselinePlan(data.baselinePlan ?? data.plan);
      setPersistedCurrentWeek(data.currentWeek ?? null);
      setHistorySummary(data.history ?? null);
      setSavedAdaptations(data.adaptations ?? []);
      setSavedNotes(data.notes ?? []);
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
    if (savedAudioMode === "off" || savedAudioMode === "short" || savedAudioMode === "coach") {
      setAudioMode(savedAudioMode);
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
    setEffectiveTheme("dark");
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
    setPulseDraft({
      maxHeartRate: runnerProfile.maxHeartRate ? String(runnerProfile.maxHeartRate) : "",
    });
  }, [runnerProfile.maxHeartRate]);

  useEffect(() => {
    if (!activeUserId) return;

    const saved = window.localStorage.getItem(pulseSettingsKey(activeUserId));
    if (!saved) {
      pulseSettingsHydratedUserRef.current = activeUserId;
      return;
    }

    try {
      const parsed = JSON.parse(saved) as {
        pulseGuidanceEnabled?: boolean;
        maxHeartRate?: number | null;
      };
      setRunnerProfile((current) => ({
        ...current,
        pulseGuidanceEnabled: parsed.pulseGuidanceEnabled ?? false,
        maxHeartRate: typeof parsed.maxHeartRate === "number" ? parsed.maxHeartRate : null,
      }));
      pulseSettingsHydratedUserRef.current = activeUserId;
    } catch {
      window.localStorage.removeItem(pulseSettingsKey(activeUserId));
      pulseSettingsHydratedUserRef.current = activeUserId;
    }
  }, [activeUserId]);

  useEffect(() => {
    if (!activeUserId) return;
    if (pulseSettingsHydratedUserRef.current !== activeUserId) return;
    window.localStorage.setItem(
      pulseSettingsKey(activeUserId),
      JSON.stringify({
        pulseGuidanceEnabled: Boolean(runnerProfile.pulseGuidanceEnabled),
        maxHeartRate: runnerProfile.maxHeartRate ?? null,
      }),
    );
  }, [activeUserId, runnerProfile.maxHeartRate, runnerProfile.pulseGuidanceEnabled]);

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
    const previousStage = previousStageRef.current;
    if (shouldInitializeOnboardingProfileStage(previousStage, stage)) {
      const inferredTrack = runnerProfile.onboardingTrack ?? inferOnboardingTrackFromProfile({
        currentRunsPerWeek: runnerProfile.currentRunsPerWeek,
        runningExperience: runnerProfile.runningExperience,
        currentRunningAbility: runnerProfile.currentRunningAbility,
        contextText: runnerProfile.userTrainingContext,
      });
      setOnboardingStep(1);
      setOnboardingSelections({
        track: Boolean(inferredTrack),
        runningAbility: hasSetup,
        goalDistance: hasSetup,
        goalType: hasSetup,
        activityLevel: hasSetup,
        ambition: true,
      });
      if (!runnerProfile.onboardingTrack) {
        setRunnerProfile((current) => ({ ...current, onboardingTrack: inferredTrack }));
      }
    }
    previousStageRef.current = stage;
  }, [stage, hasSetup]);

  useEffect(() => {
    if (isGoalTypeAllowed(goal.distance, runnerProfile.currentRunningAbility, goal.goalType)) return;
    setGoal((current) => ({
      ...current,
      goalType: undefined,
      targetPaceSecPerKm: undefined,
      targetTime: "",
    }));
    setOnboardingSelections((current) => ({ ...current, goalType: false }));
  }, [goal.distance, goal.goalType, runnerProfile.currentRunningAbility]);

  useEffect(() => {
    if (!lowFrequencyOverridePrompt) {
      setAcceptedLowFrequencyOverrideKey(null);
      setPendingLowFrequencyOverride(null);
      return;
    }
    if (acceptedLowFrequencyOverrideKey === lowFrequencyOverridePrompt.overrideKey) return;
    setPendingLowFrequencyOverride(null);
  }, [acceptedLowFrequencyOverrideKey, lowFrequencyOverridePrompt]);

  useEffect(() => {
    setProfileDraft({
      heightCm: String(runnerProfile.heightCm),
      weightKg: String(runnerProfile.weightKg),
      age: String(runnerProfile.age),
    });
  }, [runnerProfile.heightCm, runnerProfile.weightKg, runnerProfile.age]);

  useEffect(() => {
    const nextValue = runnerProfile.currentContinuousDistanceKm ? String(runnerProfile.currentContinuousDistanceKm).replace(".", ",") : "";
    setCapacityDistanceDraft((current) => (current === nextValue ? current : nextValue));
  }, [runnerProfile.currentContinuousDistanceKm]);

  useEffect(() => {
    if (hasRecentRaceEntry(runnerProfile.recentRaceTimes)) {
      const nextDraft = recentRaceDraftFromEntries(runnerProfile.recentRaceTimes);
      setRecentRaceDraft((current) =>
        current.distance === nextDraft.distance && current.time === nextDraft.time ? current : nextDraft,
      );
      setRecentRaceTimeParts((current) => {
        const nextParts = recentRaceTimePartsFromString(nextDraft.time);
        return current.hours === nextParts.hours && current.minutes === nextParts.minutes && current.seconds === nextParts.seconds
          ? current
          : nextParts;
      });
      setShowRecentRaceFields(true);
      return;
    }

    if (!showRecentRaceFields) {
      setRecentRaceDraft((current) => (current.distance || current.time ? { distance: "", time: "" } : current));
      setRecentRaceTimeParts((current) =>
        current.hours === 0 && current.minutes === 0 && current.seconds === 0 ? current : { hours: 0, minutes: 0, seconds: 0 },
      );
    }
  }, [runnerProfile.recentRaceTimes, showRecentRaceFields]);

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
    setShowWorkoutCheckIn(false);
    setCompletedSteps([]);
    setStepNotice("");
    setFeedbackConfirmation(null);
    setFeedbackSubmitState("idle");
    setShowDetailedFeedback(false);
    setShowWorkoutCheckIn(false);
    setWorkoutInterruptionNotice(null);
    lastSpokenStepKey.current = "";
    thirtySecCueKey.current = "";
    lastTickAtRef.current = null;
    hiddenAtRef.current = null;
    wasRunningBeforeHideRef.current = false;
  }, [activeSession]);

  useEffect(() => {
    if (!stepNotice) return;
    const timeout = window.setTimeout(() => setStepNotice(""), 1200);
    return () => window.clearTimeout(timeout);
  }, [stepNotice]);

  useEffect(() => {
    if (!workoutInterruptionNotice) return;
    if (workoutNoticeTimeout.current) {
      window.clearTimeout(workoutNoticeTimeout.current);
    }
    workoutNoticeTimeout.current = window.setTimeout(() => setWorkoutInterruptionNotice(null), 4500);
    return () => {
      if (workoutNoticeTimeout.current) {
        window.clearTimeout(workoutNoticeTimeout.current);
      }
    };
  }, [workoutInterruptionNotice]);

  useEffect(() => {
    if (stage !== "workout" || !activeSession || workoutCompleted || workoutStartCountdown === null) return;

    if (workoutStartCountdown <= 1) {
      setWorkoutStartCountdown(null);
      if (!speechEnabled && audioMode !== "off") {
        const initialized = initSpeech();
        setSpeechEnabled(initialized);
        setTtsSupported(isSpeechSupported());
      }
      if (audioMode === "off") {
        setSpeechEnabled(false);
      }
      if (lastWorkoutStartedRef.current !== activeSession.id) {
        lastWorkoutStartedRef.current = activeSession.id;
        captureAppEvent("workout_started", {
          locale: siteLocale,
          goal_type: goal.goalType ?? null,
          session_type: sessionAnalyticsType(activeSession),
          session_title: activeSession.title,
          week: activeSession.week,
        });
      }
      setWorkoutInterruptionNotice(null);
      lastTickAtRef.current = Date.now();
      setIsRunning(true);
      return;
    }

    const timeout = window.setTimeout(() => {
      setWorkoutStartCountdown((current) => (current === null ? null : current - 1));
    }, 1000);
    return () => window.clearTimeout(timeout);
  }, [activeSession, audioMode, goal.goalType, siteLocale, speechEnabled, stage, ttsSupported, workoutCompleted, workoutStartCountdown]);

  useEffect(() => {
    if (stage !== "workout") {
      cancelCue();
      void releaseWakeLock();
      setWorkoutStartCountdown(null);
    }
  }, [releaseWakeLock, stage]);

  useEffect(() => {
    if (!isRunning || !activeSession) {
      lastTickAtRef.current = null;
      return;
    }

    lastTickAtRef.current = Date.now();
    const interval = window.setInterval(() => {
      const now = Date.now();
      const lastTickAt = lastTickAtRef.current ?? now;
      const elapsedSeconds = Math.floor((now - lastTickAt) / 1000);
      if (elapsedSeconds <= 0) return;
      lastTickAtRef.current = lastTickAt + elapsedSeconds * 1000;
      setRemainingSec((prev) => Math.max(prev - elapsedSeconds, 0));
    }, 300);
    return () => window.clearInterval(interval);
  }, [isRunning, activeSession]);

  useEffect(() => {
    if (!activeSession || !currentStep || audioMode === "off") return;
    const cue = buildCue(currentStep, audioMode, siteLocale);
    setCueFallbackText(cue);

    if (!isRunning) {
      lastSpokenStepKey.current = "";
      return;
    }

    const key = `${activeSession.id}-${stepIndex}`;
    if (lastSpokenStepKey.current === key) return;

    lastSpokenStepKey.current = key;
    if (
      !shouldSpeakWorkoutCue({
        isRunning,
        audioMode,
        ttsSupported,
        speechEnabled,
      })
    ) {
      return;
    }
    if (!speakCue(cue)) {
      setCueFallbackText(cue);
      setWorkoutInterruptionNotice(buildWorkoutInterruptionNotice({ reason: "audio_interrupted", locale: siteLocale }));
    }
  }, [activeSession, audioMode, currentStep, isRunning, siteLocale, speechEnabled, stepIndex, ttsSupported]);

  useEffect(() => {
    if (!activeSession || !currentStep || audioMode === "off" || remainingSec !== 30 || !isRunning) return;

    const key = `${activeSession.id}-${stepIndex}`;
    if (thirtySecCueKey.current === key) return;

    thirtySecCueKey.current = key;
    const cue = audioMode === "coach" ? "30 sekunder tilbage. Hold fokus på rytmen." : "30 sekunder tilbage";
    setCueFallbackText(cue);
    if (
      shouldSpeakWorkoutCue({
        isRunning,
        audioMode,
        ttsSupported,
        speechEnabled,
      })
    ) {
      if (!speakCue(cue)) {
        setWorkoutInterruptionNotice(buildWorkoutInterruptionNotice({ reason: "audio_interrupted", locale: siteLocale }));
      }
    }
  }, [activeSession, audioMode, currentStep, isRunning, remainingSec, speechEnabled, stepIndex, ttsSupported]);

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
    setStepNotice(transitionNoticeForStep(activeSession.steps[nextStep], siteLocale));
  }, [remainingSec, stepIndex, activeSession, finishWorkout, siteLocale]);

  useEffect(() => {
    if (stage !== "workout" || !isRunning || workoutCompleted) {
      void releaseWakeLock();
      return;
    }

    void requestWakeLock();
    return () => {
      void releaseWakeLock();
    };
  }, [isRunning, releaseWakeLock, requestWakeLock, stage, workoutCompleted]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
        if (stage === "workout" && isRunning) {
          wasRunningBeforeHideRef.current = true;
          setIsRunning(false);
          cancelCue();
          void releaseWakeLock();
        } else {
          wasRunningBeforeHideRef.current = false;
        }
        return;
      }

      void requestWakeLock();
      if (!wasRunningBeforeHideRef.current) return;

      const secondsAway = hiddenAtRef.current ? Math.max(1, Math.round((Date.now() - hiddenAtRef.current) / 1000)) : undefined;
      setWorkoutInterruptionNotice(
        buildWorkoutInterruptionNotice({
          reason: "hidden",
          secondsAway,
          locale: siteLocale,
        }),
      );
      setCueFallbackText("Passet er sat på pause. Tryk start, når du er klar igen.");
      wasRunningBeforeHideRef.current = false;
      hiddenAtRef.current = null;
      lastTickAtRef.current = null;
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isRunning, releaseWakeLock, requestWakeLock, stage]);

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
    captureAppEvent("signup_started", {
      locale: siteLocale,
      auth_mode: "signup",
    });
    if (password.length < 8) {
      setError(siteLocale === "en" ? "Your password must be at least 8 characters." : "Adgangskoden skal være mindst 8 tegn.");
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
        setError(siteLocale === "en" ? "An account already exists for this email. Try logging in instead." : "Der findes allerede en konto med denne e-mail. Prøv at logge ind.");
        return;
      }
      if (res.status === 400) {
        setError(siteLocale === "en" ? "Invalid email or password. Your password must be at least 8 characters." : "Ugyldig e-mail eller adgangskode. Adgangskoden skal være mindst 8 tegn.");
        return;
      }
      setError(payload?.error ? (siteLocale === "en" ? `Could not create account: ${payload.error}` : `Kunne ikke oprette konto: ${payload.error}`) : siteLocale === "en" ? "Could not create account right now." : "Kunne ikke oprette konto lige nu.");
      return;
    }

    const data = (await res.json()) as { user: AuthUser };
    resetProgramState();
    setIsDemoMode(false);
    setAuthUser(data.user);
    identifyAnalyticsUser(data.user.id, {
      locale: siteLocale,
      signup_method: "email",
    });
    captureAppEvent("signup_completed", {
      locale: siteLocale,
      auth_mode: "signup",
    });
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
      setError(siteLocale === "en" ? "Login failed." : "Login fejlede.");
      return;
    }

    const data = (await res.json()) as { user: AuthUser };
    resetProgramState();
    setIsDemoMode(false);
    setAuthUser(data.user);
    identifyAnalyticsUser(data.user.id, {
      locale: siteLocale,
      login_method: "email",
    });
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
    resetAnalyticsUser();
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

  async function requestPlanRecommendation(options?: { skipLowFrequencyGuardrail?: boolean }) {
    setError(null);
    setFeedbackConfirmation(null);
    setPlanTradeoff(null);
    setPlanRecommendation(null);
    const trimmedFirstName = runnerProfile.firstName?.trim() ?? "";

    if (trimmedFirstName !== runnerProfile.firstName) {
      setRunnerProfile((current) => ({ ...current, firstName: trimmedFirstName }));
    }

    if (!goal.availableTrainingDays || goal.availableTrainingDays.length === 0) {
      setError(siteLocale === "en" ? "Choose at least one training day to generate the plan." : "Vælg mindst én træningsdag for at generere programmet.");
      return;
    }

    if (!isValidIsoDate(goal.startDate)) {
      setError(siteLocale === "en" ? "Choose a valid start date before I ask StridePilot for a recommendation." : "Vælg en gyldig startdato, før jeg beder StridePilot om en anbefaling.");
      return;
    }

    if ((goal.goalType === "target_time" || goal.goalType === "pr") && !goal.targetPaceSecPerKm) {
      setError(siteLocale === "en" ? "Choose a target pace if you are aiming for a specific pace or a PR." : "Vælg et ønsket tempo, hvis du går efter et bestemt tempo eller en PR.");
      return;
    }

    if (
      !options?.skipLowFrequencyGuardrail &&
      lowFrequencyOverridePrompt &&
      !lowFrequencyOverrideAccepted(lowFrequencyOverridePrompt.overrideKey)
    ) {
      setPendingLowFrequencyOverride({ intent: "recommendation" });
      return;
    }

    setIsLoading(true);

    try {
      const selectedStartDate = goal.startDate;
      const effectiveGoal = {
        ...goal,
        startDate: startDateWeekRhythm.startDateIso,
        targetTime: shouldShowGoalPaceInput(goal.goalType) ? targetTimeFromPace(goal.distance, goal.targetPaceSecPerKm) : "",
      };

      const res = await fetch("/api/recommend-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runnerProfile,
          goal: effectiveGoal,
          selectedStartDate,
          locale: siteLocale,
          ambition: planAmbition,
        }),
      });

      if (!res.ok) {
        throw new Error("Fejl under anbefaling af plan.");
      }

      const data = (await res.json()) as PlanRecommendation;
      setPlanRecommendation(data);
      setSelectedRecommendationDurationWeeks(null);
      setAcceptedDurationOverrideKey(null);
      setPendingDurationOverride(null);
      setPlanAmbition(data.selectedOption.mode);
      setStage("intermezzo");
      captureAppEvent(
        "onboarding_completed",
        buildAnalyticsPlanProperties({
          locale: siteLocale,
          goal: effectiveGoal,
          track: runnerProfile.onboardingTrack,
          durationWeeks: data.selectedOption.durationWeeks,
        }),
      );
    } catch {
      setError(siteLocale === "en" ? "Could not fetch a recommendation right now." : "Kunne ikke hente en anbefaling lige nu.");
    } finally {
      setIsLoading(false);
    }
  }

  function selectRecommendationOption(mode: PlanAmbition) {
    setPlanRecommendation((current) => {
      if (!current) return current;
      const nextOption = current.options.find((option) => option.mode === mode) ?? current.recommendedOption;
      return {
        ...current,
        progressionMode: nextOption.progressionMode,
        realism: nextOption.realism,
        warnings: nextOption.warnings,
        headline: nextOption.headline,
        summary: nextOption.summary,
        selectedPathVariant: nextOption.mode,
        selectedOption: nextOption,
      };
    });
    setPlanAmbition(mode);
  }

  async function generatePlan(
    selectedRecommendation?: PlanRecommendationOption,
    options?: { skipLowFrequencyGuardrail?: boolean; skipDurationGuardrail?: boolean },
  ) {
    setError(null);
    setFeedbackConfirmation(null);
    setPlanTradeoff(null);
    setIsProgramTransitioning(true);
    const trimmedFirstName = runnerProfile.firstName?.trim() ?? "";
    const resolvedRecommendation = selectedRecommendation ?? activeRecommendationOption ?? null;

    if (trimmedFirstName !== runnerProfile.firstName) {
      setRunnerProfile((current) => ({ ...current, firstName: trimmedFirstName }));
    }

    if (!goal.availableTrainingDays || goal.availableTrainingDays.length === 0) {
      setError(siteLocale === "en" ? "Choose at least one training day to generate the plan." : "Vælg mindst én træningsdag for at generere programmet.");
      setIsProgramTransitioning(false);
      return;
    }

    if (!isValidIsoDate(goal.startDate)) {
      setError(siteLocale === "en" ? "Choose a valid start date before I build the plan." : "Vælg en gyldig startdato, før jeg bygger programmet.");
      setIsProgramTransitioning(false);
      return;
    }

    if (!resolvedRecommendation) {
      setError(siteLocale === "en" ? "Fetch a recommendation first so StridePilot can build the plan from a realistic timeline." : "Hent først en anbefaling, så StridePilot kan bygge planen ud fra en realistisk tidslinje.");
      setIsProgramTransitioning(false);
      return;
    }

    if ((goal.goalType === "target_time" || goal.goalType === "pr") && !goal.targetPaceSecPerKm) {
      setError(siteLocale === "en" ? "Choose a target pace if you are aiming for a specific pace or a PR." : "Vælg et ønsket tempo, hvis du går efter et bestemt tempo eller en PR.");
      setIsProgramTransitioning(false);
      return;
    }

    if (
      !options?.skipLowFrequencyGuardrail &&
      lowFrequencyOverridePrompt &&
      !lowFrequencyOverrideAccepted(lowFrequencyOverridePrompt.overrideKey)
    ) {
      setPendingLowFrequencyOverride({ intent: "generation", selectedRecommendation });
      setIsProgramTransitioning(false);
      return;
    }

    if (!options?.skipDurationGuardrail && durationOverridePrompt && !durationOverrideAccepted(durationOverridePrompt.overrideKey)) {
      setPendingDurationOverride({ selectedRecommendation: resolvedRecommendation });
      setIsProgramTransitioning(false);
      return;
    }

    setIsLoading(true);

    try {
      const selectedStartDate = goal.startDate;
      const effectiveGoal = {
        ...goal,
        startDate: startDateWeekRhythm.startDateIso,
        targetTime: shouldShowGoalPaceInput(goal.goalType) ? targetTimeFromPace(goal.distance, goal.targetPaceSecPerKm) : "",
        weeks: resolvedRecommendation.durationWeeks,
        endDate: resolvedRecommendation.goalDate,
      };

      const res = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runnerProfile,
          goal: effectiveGoal,
          selectedStartDate,
          locale: siteLocale,
          profileId: isDemoMode ? undefined : profileId || undefined,
          recommendationSelection: resolvedRecommendation,
          runsPerWeek: resolvedRecommendation.sessionsPerWeek,
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
      setGoal((current) => ({
        ...current,
        startDate: effectiveGoal.startDate,
        weeks: resolvedRecommendation.durationWeeks,
        endDate: resolvedRecommendation.goalDate,
      }));
      setPlanRecommendation((current) =>
        current
          ? {
              ...current,
              selectedOption: resolvedRecommendation,
              selectedPathVariant: resolvedRecommendation.mode,
              progressionMode: resolvedRecommendation.progressionMode,
              realism: resolvedRecommendation.realism,
              warnings: resolvedRecommendation.warnings,
              headline: resolvedRecommendation.headline,
              summary: resolvedRecommendation.summary,
            }
          : current,
      );
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
      setStage("program");
      setShowProgramIntro(true);
      setIsProgramTransitioning(false);
      captureAppEvent(
        "plan_generated",
        buildAnalyticsPlanProperties({
          locale: siteLocale,
          goal: {
            ...goal,
            weeks: resolvedRecommendation.durationWeeks,
          },
          track: runnerProfile.onboardingTrack,
          durationWeeks: resolvedRecommendation.durationWeeks,
        }),
      );
    } catch {
      setError(siteLocale === "en" ? "Could not generate the plan right now." : "Kunne ikke generere plan lige nu.");
    } finally {
      setIsProgramTransitioning(false);
      setIsLoading(false);
    }
  }

  async function submitFeedback() {
    if (!activeSession || !plan) {
      setError(siteLocale === "en" ? "Missing active workout or plan." : "Mangler aktivt træningspas eller program.");
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
    const adaptiveCopy = detectAdaptivePlanChange(plan, updatedPlan, siteLocale);
    const responseCopy = buildFeedbackResponseCopy({
      rationale: adapted.rationale,
      feedback: {
        quickFeedback: feedback.quickFeedback,
        completionPct: feedback.completionPct,
        effort: feedback.effort,
        energy: feedback.energy,
        painLevel: feedback.painLevel,
      },
      locale: siteLocale,
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
    captureAppEvent("checkin_submitted", {
      locale: siteLocale,
      goal_type: goal.goalType ?? null,
      session_type: sessionAnalyticsType(activeSession),
      completion_pct: feedback.completionPct,
      effort: feedback.effort,
      energy: feedback.energy,
      pain_level: feedback.painLevel,
    });
    setFeedbackConfirmation({
      title: runnerProfile.firstName?.trim()
        ? siteLocale === "en"
          ? `Thanks for your feedback, ${runnerProfile.firstName.trim()}.`
          : `Tak for din feedback, ${runnerProfile.firstName.trim()}.`
        : ui.workout.thanks,
      updatedLabel: siteLocale === "en" ? "Updated after your feedback" : "Opdateret efter din feedback",
      interpretation: responseCopy.interpretation,
      adjustment: responseCopy.adjustmentExplanation,
      progressionPreview: responseCopy.progressionPreview,
      focus: responseCopy.runnerFocus,
      learnedInsights: responseCopy.learnedInsights.length > 0 ? responseCopy.learnedInsights : learnedInsightLines(adapted.capability, updatedPlan, siteLocale),
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
      await hydrateProgramState(profileId);
    } catch {
      // The UI already holds a local saved copy, so a persistence miss should not break the workout flow.
    }
  }

  async function saveProfileNote() {
    if (!profileId || isDemoMode) return;
    const text = noteDraft.trim();
    if (!text) return;

    setNoteSaveState("saving");
    setError(null);

    try {
      const res = await fetch("/api/profile-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, text }),
      });

      if (!res.ok) {
        throw new Error("Kunne ikke gemme note.");
      }

      const payload = (await res.json()) as { note?: SavedProfileNote };
      if (payload.note) {
        setSavedNotes((current) => [payload.note!, ...current]);
      }
      setNoteDraft("");
      setNoteSaveState("saved");
      window.setTimeout(() => setNoteSaveState("idle"), 1800);
    } catch {
      setNoteSaveState("idle");
      setError(siteLocale === "en" ? "Could not save the note right now." : "Kunne ikke gemme note lige nu.");
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
              resolution: siteLocale === "en" ? "Understood. I will keep that adjustment in place." : "Godt — så holder jeg den justering.",
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
              updatedLabel: siteLocale === "en" ? "Updated after your clarification" : "Opdateret efter din afklaring",
              resolution: siteLocale === "en" ? "Understood. I am rolling back the latest adjustment and keeping the plan unchanged for now." : "Forstået — jeg ruller den seneste justering tilbage og holder planen uændret for nu.",
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
            updatedLabel: siteLocale === "en" ? "Updated after your clarification" : "Opdateret efter din afklaring",
            resolution: siteLocale === "en" ? "Thanks. I have updated the assessment with your note and will keep the next step cautious and consistent." : "Tak — jeg har opdateret vurderingen med din note og holder næste skridt forsigtigt og konsistent.",
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
      setError(siteLocale === "en" ? "Could not create the calendar file." : "Kunne ikke oprette kalenderfil.");
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

  function downloadProgramText() {
    if (!plan) return;

    const content = buildProgramTextExport({
      plan,
      goal,
      runnerProfile,
      recommendation: planRecommendation,
    });
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "stridepilot-program.txt";
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

  function openStage(nextStage: Stage) {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setStage(nextStage);
    setMenuOpen(false);
  }

  function openWorkoutSession(sessionId: string) {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setSelectedSessionId(sessionId);
    setFocusedProgramDayIso(null);
    lastWorkoutStartedRef.current = null;
    lastWorkoutCompletedRef.current = null;
    setWorkoutInterruptionNotice(null);
    setWorkoutStartCountdown(5);
    setShowWorkoutCheckIn(false);
    setStage("workout");
  }

  function closeWorkoutSession() {
    setIsRunning(false);
    cancelCue();
    void releaseWakeLock();
    setWorkoutInterruptionNotice(null);
    setWorkoutStartCountdown(null);
    setShowWorkoutCheckIn(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
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

  function applyCapacityBaseline(nextDistanceKm: number, nextRunsPerWeek: number) {
    const baseline = deriveBaselineLoadFromCapacity(nextDistanceKm, nextRunsPerWeek);
    setRunnerProfile((current) => ({
      ...current,
      currentContinuousDistanceKm: nextDistanceKm,
      currentRunningAbility: baseline.currentRunningAbility,
      runningExperience: baseline.runningExperience,
      currentWeeklyVolumeKm: baseline.currentWeeklyVolumeKm,
      currentRunsPerWeek: baseline.currentRunsPerWeek,
      longestCurrentRunMin: baseline.longestCurrentRunMin,
    }));
    setOnboardingSelections((current) => ({ ...current, runningAbility: true }));
  }

  function lowFrequencyOverrideAccepted(promptKey?: string | null): boolean {
    return Boolean(promptKey && acceptedLowFrequencyOverrideKey === promptKey);
  }

  function durationOverrideAccepted(promptKey?: string | null): boolean {
    return Boolean(promptKey && acceptedDurationOverrideKey === promptKey);
  }

  function updateRecommendationDuration(nextWeeks: number) {
    if (!planRecommendation || !baseRecommendationOption || !durationEditBounds) return;
    if (!Number.isFinite(nextWeeks)) return;
    const safeWeeks = clampInt(nextWeeks, durationEditBounds.editableMinWeeks, durationEditBounds.editableMaxWeeks);
    setSelectedRecommendationDurationWeeks(safeWeeks === baseRecommendationOption.durationWeeks ? null : safeWeeks);
    if (planRecommendation.recommendedOption.durationWeeks === safeWeeks) {
      setAcceptedDurationOverrideKey(null);
      setPendingDurationOverride(null);
    } else if (durationOverridePrompt && acceptedDurationOverrideKey !== durationOverridePrompt.overrideKey) {
      setPendingDurationOverride(null);
    }
  }

  function goToStep(index: number) {
    if (!activeSession) return;
    const safeIndex = clampInt(index, 0, activeSession.steps.length - 1);
    setIsRunning(false);
    cancelCue();
    void releaseWakeLock();
    setStepIndex(safeIndex);
    setRemainingSec(activeSession.steps[safeIndex].durationSec);
    setWorkoutCompleted(false);
    setCueFallbackText(buildCue(activeSession.steps[safeIndex], audioMode, siteLocale));
    lastSpokenStepKey.current = "";
    thirtySecCueKey.current = "";
    lastTickAtRef.current = null;
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
    setStepNotice(transitionNoticeForStep(activeSession.steps[next], siteLocale));
    setStepIndex(next);
    setRemainingSec(activeSession.steps[next].durationSec);
    setCueFallbackText(buildCue(activeSession.steps[next], audioMode, siteLocale));
    lastSpokenStepKey.current = "";
    thirtySecCueKey.current = "";
    lastTickAtRef.current = null;
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

  function revealWeekOverview(options?: { focusNextWorkout?: boolean }) {
    if (weekOverviewAction.shouldExpand) {
      setShowProgramMore(true);
    }

    setVisibleWeek(weekOverviewAction.targetWeek, { scrollIntoView: true });

    if (options?.focusNextWorkout && weekOverviewAction.shouldFocusNextWorkout) {
      window.setTimeout(() => {
        nextWorkoutDayRef.current?.focus({ preventScroll: true });
      }, 140);
    }
  }

  const onboardingTrackOptions = useMemo(() => getOnboardingTrackOptions(siteLocale), [siteLocale]);
  const feedbackMailto = useMemo(() => {
    const trackLabel =
      onboardingTrackOptions.find((option) => option.value === runnerProfile.onboardingTrack)?.label
      ?? runnerProfile.onboardingTrack
      ?? null;
    const goalLabel = goal.goalType
      ? `${localizedGoalDistanceName(goal.distance, siteLocale)} · ${goalTypeLabel(goal.goalType, siteLocale)}`
      : localizedGoalDistanceName(goal.distance, siteLocale);

    return buildFeedbackMailto({
      locale: siteLocale,
      host: currentHost,
      track: trackLabel,
      goal: goalLabel,
      daysPerWeek: goal.availableTrainingDays?.length ?? null,
    });
  }, [currentHost, goal.availableTrainingDays, goal.distance, goal.goalType, onboardingTrackOptions, runnerProfile.onboardingTrack, siteLocale]);
  const openFeedbackMail = useCallback(() => {
    if (typeof window !== "undefined") {
      window.location.href = feedbackMailto;
    }
  }, [feedbackMailto]);

  const contextualHeader =
    stage === "program"
      ? { title: siteLocale === "en" ? "Your plan" : "Dit program", subtitle: siteLocale === "en" ? `Week ${displayWeek}` : `Uge ${displayWeek}` }
      : stage === "workout"
        ? {
            title: activeSession
              ? `${sessionWeekBadge(activeSession.week, siteLocale)} · ${visibleSessionTitle(activeSession.title, siteLocale)}`
              : siteLocale === "en"
                ? "Interval workout"
                : "Intervalpas",
            subtitle: siteLocale === "en" ? "Focus on the next interval" : "Fokusér på næste interval",
          }
        : stage === "auth"
          ? {
              title: siteCopy.welcomeTitle,
              subtitle: siteCopy.authSubtitle,
            }
        : {
            title: APP_NAME,
            subtitle: siteCopy.welcomeSubhead,
          };
  const programAdjustments = useMemo(() => [...safetyAdjustments, ...adjustmentLog], [safetyAdjustments, adjustmentLog]);
  const hasMoreSafetyAdjustments = programAdjustments.length > 3;
  const isLastWorkoutStep = Boolean(activeSession && stepIndex === activeSession.steps.length - 1);
  const onboardingSteps = ONBOARDING_STEP_COUNT;
  const currentOnboardingStep = getOnboardingStepDefinition(onboardingStep, siteLocale);
  const baseRecommendationOption = planRecommendation?.selectedOption ?? null;
  const recommendedRecommendationOption = planRecommendation?.recommendedOption ?? null;
  const resolvedRecommendationDurationWeeks = useMemo(() => {
    if (!baseRecommendationOption) return null;
    return selectedRecommendationDurationWeeks ?? baseRecommendationOption.durationWeeks;
  }, [baseRecommendationOption, selectedRecommendationDurationWeeks]);
  const activeRecommendationOption = useMemo(() => {
    if (!baseRecommendationOption || !recommendedRecommendationOption || !resolvedRecommendationDurationWeeks) return null;
    return applyDurationToRecommendationOption({
      goal,
      option: baseRecommendationOption,
      recommendedWeeks: recommendedRecommendationOption.durationWeeks,
      selectedWeeks: resolvedRecommendationDurationWeeks,
      realisticMinWeeks: planRecommendation?.minDurationWeeks,
      realisticMaxWeeks: planRecommendation?.maxDurationWeeks,
      locale: siteLocale,
    });
  }, [baseRecommendationOption, goal, planRecommendation?.maxDurationWeeks, planRecommendation?.minDurationWeeks, recommendedRecommendationOption, resolvedRecommendationDurationWeeks, siteLocale]);
  const durationEditBounds = useMemo(
    () =>
      planRecommendation
        ? buildDurationEditBounds({
            recommendedWeeks: planRecommendation.recommendedDurationWeeks,
            realisticMinWeeks: planRecommendation.minDurationWeeks,
            realisticMaxWeeks: planRecommendation.maxDurationWeeks,
          })
        : null,
    [planRecommendation],
  );
  const durationAdjustmentState = useMemo(
    () =>
      recommendedRecommendationOption && resolvedRecommendationDurationWeeks
        ? buildDurationAdjustmentState({
            goal,
            recommendedWeeks: recommendedRecommendationOption.durationWeeks,
            selectedWeeks: resolvedRecommendationDurationWeeks,
            realisticMinWeeks: planRecommendation?.minDurationWeeks,
            realisticMaxWeeks: planRecommendation?.maxDurationWeeks,
            locale: siteLocale,
          })
        : null,
    [goal, planRecommendation?.maxDurationWeeks, planRecommendation?.minDurationWeeks, recommendedRecommendationOption, resolvedRecommendationDurationWeeks, siteLocale],
  );
  const durationOverridePrompt = durationAdjustmentState?.overridePrompt ?? null;
  const recommendationWarnings = activeRecommendationOption?.warnings ?? [];
  const trackRecommendationContext = useMemo(() => buildTrackRecommendationContext(runnerProfile.onboardingTrack, siteLocale), [runnerProfile.onboardingTrack, siteLocale]);
  useEffect(() => {
    if (!durationOverridePrompt) {
      setAcceptedDurationOverrideKey(null);
      setPendingDurationOverride(null);
      return;
    }
    if (acceptedDurationOverrideKey === durationOverridePrompt.overrideKey) return;
    setPendingDurationOverride(null);
  }, [acceptedDurationOverrideKey, durationOverridePrompt]);
  const recommendationLeadCopy = useMemo(() => {
    const summaryWithTrack = buildRecommendationLeadCopy(
      activeRecommendationOption?.summary ?? planRecommendation?.summary ?? "",
      trackRecommendationContext ?? undefined,
    );
    return buildRecommendationLeadCopy(summaryWithTrack, activeRecommendationOption?.planLevelExplanation);
  }, [activeRecommendationOption?.planLevelExplanation, activeRecommendationOption?.summary, planRecommendation?.summary, trackRecommendationContext]);
  const recommendationProgressionLabel = progressionTempoLabel(activeRecommendationOption?.progressionMode, siteLocale);
  const goalSummaryDate =
    goalDestinationSession &&
    sessionDateFromPlan(goal.startDate, goalDestinationSession).toLocaleDateString(siteLocale === "en" ? "en-GB" : "da-DK", {
      day: "numeric",
      month: "short",
    });
  const todayDuration = todaySession ? Math.round(sessionTotalDurationSec(todaySession) / 60) : 0;
  const nextDuration = nextSession ? Math.round(sessionTotalDurationSec(nextSession) / 60) : 0;
  const activeSessionDuration = activeSession ? Math.round(sessionTotalDurationSec(activeSession) / 60) : 0;
  const suggestedPlanStartDate = useMemo(() => getSuggestedPlanStartDate(), []);
  const startDateWeekRhythm = useMemo(
    () =>
      resolvePlanStartDateForWeekRhythm({
        startDateIso: goal.startDate,
        availableTrainingDays: goal.availableTrainingDays,
      }),
    [goal.availableTrainingDays, goal.startDate],
  );
  const planStartDateHelpText = useMemo(
    () => buildPlanStartDateHelpText(goal.startDate, suggestedPlanStartDate, siteLocale, goal.availableTrainingDays),
    [goal.availableTrainingDays, goal.startDate, siteLocale, suggestedPlanStartDate],
  );
  const weekRationale = plan?.rationale?.weeks?.find((week) => week.weekNumber === displayWeek) ?? null;
  const weekState = localizedWeekStateLabel(plan, displayWeek, siteLocale);
  const learnedInsights = useMemo(() => learnedInsightLines(capabilityState, plan ?? null, siteLocale), [capabilityState, plan, siteLocale]);
  const programInsightState = useMemo(() => buildProgramInsightState(learnedInsights, siteLocale), [learnedInsights, siteLocale]);
  const programAdjustmentState = useMemo(
    () =>
      buildProgramAdjustmentHighlights({
        planWarnings,
        safetyAdjustments: programAdjustments,
        savedAdaptations,
        previousGoalDate: baselineGoalDate,
        currentGoalDate: currentPlanGoalDate,
        previousTotalWeeks: baselinePlan?.weeks ?? null,
        currentTotalWeeks: plan?.weeks ?? null,
        locale: siteLocale,
      }),
    [baselineGoalDate, currentPlanGoalDate, baselinePlan?.weeks, plan?.weeks, planWarnings, programAdjustments, savedAdaptations, siteLocale],
  );
  const programAdjustmentToneAppearance = useMemo(
    () => getAdjustmentToneAppearance(programAdjustmentState.kind),
    [programAdjustmentState.kind],
  );
  const visibleAdjustmentHighlights = useMemo(() => {
    const all = programAdjustmentState.highlights;
    return showAllSafety ? all : all.slice(0, 3);
  }, [programAdjustmentState.highlights, showAllSafety]);
  const showVisibleAdaptationCard = programAdjustmentState.hasAdjustments;
  const todayActionState = useMemo(
    () =>
      buildTodayActionState({
        todaySession,
        nextSession,
        locale: siteLocale,
      }),
    [nextSession, siteLocale, todaySession],
  );
  const recentRaceSummary = useMemo(() => recentRaceSummaryLabel(runnerProfile.recentRaceTimes, siteLocale), [runnerProfile.recentRaceTimes, siteLocale]);
  const recentRaceDraftSummary = useMemo(() => recentRaceDraftSummaryLabel(recentRaceDraft, siteLocale), [recentRaceDraft, siteLocale]);
  const pulseGuidanceSummary = useMemo(
    () =>
      buildPulseGuidanceSummary({
        enabled: Boolean(runnerProfile.pulseGuidanceEnabled),
        maxHeartRate: runnerProfile.maxHeartRate ?? null,
      }, siteLocale),
    [runnerProfile.maxHeartRate, runnerProfile.pulseGuidanceEnabled, siteLocale],
  );
  const pulseGuidanceWarning = useMemo(
    () => buildPulseGuidanceWarning(pulseDraft.maxHeartRate, Boolean(runnerProfile.pulseGuidanceEnabled), siteLocale),
    [pulseDraft.maxHeartRate, runnerProfile.pulseGuidanceEnabled, siteLocale],
  );
  const pulseZoneLegend = useMemo(
    () => buildPulseZoneLegend(runnerProfile.maxHeartRate ?? null),
    [runnerProfile.maxHeartRate],
  );
  const updateRecentRaceTimeParts = useCallback(
    (part: "hours" | "minutes" | "seconds", value: number) => {
      const nextParts = { ...recentRaceTimeParts, [part]: value };
      const nextTime = buildRecentRaceTimeFromParts(nextParts);
      setRecentRaceTimeParts(nextParts);
      setRecentRaceDraft((draft) => ({ ...draft, time: nextTime }));
      setRunnerProfile((profile) => ({
        ...profile,
        recentRaceTimes: buildRecentRaceTimes(recentRaceDraft.distance, nextTime),
      }));
    },
    [recentRaceDraft.distance, recentRaceTimeParts],
  );
  const progressOverviewSummary = useMemo(
    () =>
      buildProgressOverviewSummary({
        plan,
        historySummary,
        displayWeek,
        currentWeekLoad,
        locale: siteLocale,
      }),
    [plan, historySummary, displayWeek, currentWeekLoad, siteLocale],
  );
  const progressGraphState = useMemo(
    () =>
      buildProgressGraphState({
        weeklyLoads: currentWeeklyLoad.map((point) => ({ week: point.week, load: point.load })),
        baselineWeeklyLoads: baselineWeeklyLoad.map((point) => ({ week: point.week, load: point.load })),
        displayWeek,
        visibleWeekCount: isCompactProgramViewport ? 9 : undefined,
      }),
    [baselineWeeklyLoad, currentWeeklyLoad, displayWeek, isCompactProgramViewport],
  );
  const weeklyFocusSummary = feedbackConfirmation?.adjustment ?? plan?.rationale?.adaptation?.reason ?? weekRationale?.focus ?? (siteLocale === "en" ? "Keep the rhythm and let the week do its work." : "Hold rytmen og lad ugen gøre sit arbejde.");
  const weeklyFocusSupport = feedbackConfirmation?.focus ?? plan?.rationale?.adaptation?.runnerFocus ?? weekState.tone;
  const nextWorkoutState = useMemo(
    () =>
      buildNextWorkoutState({
        nextSession,
        durationMin: nextDuration,
        dateLabel: nextSession ? formatDateWithWeekday(sessionDateFromPlan(goal.startDate, nextSession), siteLocale) : null,
        locale: siteLocale,
      }),
    [goal.startDate, nextDuration, nextSession, siteLocale],
  );
  const workoutFeelingOptions = useMemo(
    () => [
      { value: "very_easy" as QuickFeedbackOption, label: siteLocale === "en" ? "Easy" : "Let" },
      { value: "good" as QuickFeedbackOption, label: siteLocale === "en" ? "About right" : "Passende" },
      { value: "hard" as QuickFeedbackOption, label: siteLocale === "en" ? "Hard" : "Hård" },
    ],
    [siteLocale],
  );
  const nextWorkoutDayLabel = useMemo(
    () => (nextSession ? formatDateWithWeekday(sessionDateFromPlan(goal.startDate, nextSession), siteLocale) : siteLocale === "en" ? "To be decided" : "Kommer snart"),
    [goal.startDate, nextSession, siteLocale],
  );
  const todayWorkoutCard = useMemo(
    () => deriveWorkoutCardRepresentation(todaySession, { locale: siteLocale, goalDistance: goal.distance }),
    [goal.distance, siteLocale, todaySession],
  );
  const activeWorkoutCard = useMemo(
    () => deriveWorkoutCardRepresentation(activeSession, { locale: siteLocale, goalDistance: goal.distance }),
    [activeSession, goal.distance, siteLocale],
  );
  const focusedProgramSession = useMemo(
    () => (focusedProgramDayIso && plan ? plan.sessions.find((session) => session.id === selectedSessionId) ?? null : null),
    [focusedProgramDayIso, plan, selectedSessionId],
  );
  const focusedWorkoutCard = useMemo(
    () => deriveWorkoutCardRepresentation(focusedProgramSession, { locale: siteLocale, goalDistance: goal.distance }),
    [focusedProgramSession, goal.distance, siteLocale],
  );
  const focusedProgramDate = useMemo(
    () => (focusedProgramDayIso ? new Date(focusedProgramDayIso) : null),
    [focusedProgramDayIso],
  );
  const workoutCheckInMicroCopy = useMemo(() => {
    if (feedback.quickFeedback === "hard") {
      return siteLocale === "en" ? "We will ease it a little next time." : "Vi tager lidt hensyn næste gang.";
    }
    if (feedback.quickFeedback === "very_easy") {
      return siteLocale === "en" ? "We will turn it up a little next time." : "Vi skruer en smule op næste gang.";
    }
    return null;
  }, [feedback.quickFeedback, siteLocale]);
  const weekOverviewAction = useMemo(
    () =>
      buildWeekOverviewAction({
        displayWeek,
        nextSessionWeek,
        showProgramMore,
      }),
    [displayWeek, nextSessionWeek, showProgramMore],
  );
  const filteredGoalTypeOptions = useMemo(
    () => getGoalTypeOptions(goal.distance, runnerProfile.currentRunningAbility, siteLocale),
    [goal.distance, runnerProfile.currentRunningAbility, siteLocale],
  );
  const isOnboardingStepValid = isOnboardingStepReady({
    onboardingStep,
    selections: onboardingSelections,
    firstName: runnerProfile.firstName,
    trainingContext: runnerProfile.userTrainingContext,
    goalType: goal.goalType,
    targetPaceSecPerKm: goal.targetPaceSecPerKm,
    typicalWorkoutMinutes: runnerProfile.typicalWorkoutMinutes,
    availableTrainingDaysCount: goal.availableTrainingDays?.length ?? 0,
    preferredLongRunDay: goal.preferredLongRunDay,
    hasValidStartDate: isValidIsoDate(goal.startDate),
  });
  const workoutActionState = useMemo(
    () =>
      buildWorkoutActionState({
        isRunning,
        isLastStep: isLastWorkoutStep,
        locale: siteLocale,
      }),
    [isLastWorkoutStep, isRunning, siteLocale],
  );
  const nextWorkoutStep = useMemo(
    () => (activeSession ? getNextWorkoutStep(activeSession.steps, stepIndex) : null),
    [activeSession, stepIndex],
  );
  const currentStepProgressPct = useMemo(() => {
    if (!currentStep || currentStep.durationSec <= 0) return 0;
    const elapsedSec = Math.max(0, currentStep.durationSec - remainingSec);
    return Math.max(0, Math.min(100, (elapsedSec / currentStep.durationSec) * 100));
  }, [currentStep, remainingSec]);
  const totalElapsedSec = useMemo(() => {
    if (!activeSession || !currentStep) return 0;
    const completedBeforeCurrent = activeSession.steps.slice(0, stepIndex).reduce((sum, step) => sum + step.durationSec, 0);
    const currentCompleted = Math.max(0, currentStep.durationSec - remainingSec);
    return completedBeforeCurrent + currentCompleted;
  }, [activeSession, currentStep, remainingSec, stepIndex]);
  const currentWorkoutHeartRateState = useMemo(
    () =>
      buildWorkoutStepHeartRateState({
        step: currentStep,
        pulseGuidanceEnabled: Boolean(runnerProfile.pulseGuidanceEnabled),
        maxHeartRate: runnerProfile.maxHeartRate ?? null,
        locale: siteLocale,
      }),
    [currentStep, runnerProfile.maxHeartRate, runnerProfile.pulseGuidanceEnabled, siteLocale],
  );
  const nextWorkoutHeartRateState = useMemo(
    () =>
      buildWorkoutStepHeartRateState({
        step: nextWorkoutStep,
        pulseGuidanceEnabled: Boolean(runnerProfile.pulseGuidanceEnabled),
        maxHeartRate: runnerProfile.maxHeartRate ?? null,
        locale: siteLocale,
      }),
    [nextWorkoutStep, runnerProfile.maxHeartRate, runnerProfile.pulseGuidanceEnabled, siteLocale],
  );
  const currentWorkoutSegment = activeWorkoutCard?.visualProfile?.[stepIndex] ?? null;
  const currentWorkoutAccent = useMemo(
    () => (currentWorkoutSegment ? workoutSegmentAccent(currentWorkoutSegment) : workoutSegmentAccent({ zoneKey: "z2" })),
    [currentWorkoutSegment],
  );
  const workoutCheckInState = useMemo(
    () => buildWorkoutCheckInState(showDetailedFeedback, siteLocale),
    [showDetailedFeedback, siteLocale],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(max-width: 720px)");
    const syncViewport = (matches: boolean) => {
      setIsCompactProgramViewport((current) => (current === matches ? current : matches));
    };

    syncViewport(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => syncViewport(event.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  return (
    <main
      className={[
        styles.page,
        effectiveTheme === "light" ? styles.pageLight : styles.pageDark,
        stage === "welcome" ? styles.pageWelcomeStage : "",
        stage === "intro" ? styles.pageIntroStage : "",
        stage === "intermezzo" ? styles.pageIntermezzoStage : "",
        stage === "program" ? styles.pageProgramStage : "",
      ].join(" ")}
    >
      <section ref={menuRef} className={styles.menuContainer}>
        <button
          className={styles.burgerBtn}
          aria-label={menuOpen ? (siteLocale === "en" ? "Close menu" : "Luk menu") : siteLocale === "en" ? "Open menu" : "Åbn menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          ☰
        </button>
        {menuOpen && (
          <div className={styles.menuDropdown}>
            <div className={styles.menuHeader}>
              <p className={styles.menuLabel}>{siteLocale === "en" ? "Menu" : "Menu"}</p>
              <button type="button" className={styles.menuCloseBtn} aria-label={siteLocale === "en" ? "Close menu" : "Luk menu"} onClick={() => setMenuOpen(false)}>
                {siteLocale === "en" ? "Close" : "Luk"}
              </button>
            </div>
            <button className={stage === "welcome" ? styles.menuBtnActive : styles.menuBtn} onClick={() => openStage("welcome")}>
              {siteLocale === "en" ? "Welcome" : "Velkomst"}
            </button>
            <button className={stage === "auth" ? styles.menuBtnActive : styles.menuBtn} onClick={() => openStage("auth")}>
              {siteLocale === "en" ? "Account" : "Konto"}
            </button>
            <button
              className={stage === "profile" ? styles.menuBtnActive : styles.menuBtn}
              onClick={() => openStage("profile")}
              disabled={!canOpenAuthenticatedPages}
            >
              {siteLocale === "en" ? "Edit profile and goal" : "Rediger profil og mål"}
            </button>
            <button
              className={stage === "program" ? styles.menuBtnActive : styles.menuBtn}
              onClick={() => openStage("program")}
              disabled={!canOpenProgram}
            >
              {siteLocale === "en" ? "Plan" : "Program"}
            </button>
            <button
              className={stage === "workout" ? styles.menuBtnActive : styles.menuBtn}
              onClick={() => openStage("workout")}
              disabled={!canOpenWorkout}
            >
              {siteLocale === "en" ? "Workout" : "Pas"}
            </button>
            <div className={styles.audioSettings}>
              <p className={styles.menuLabel}>{siteLocale === "en" ? "Voice cues" : "Tale-cues"}</p>
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
              <p className={styles.menuLabel}>{siteLocale === "en" ? "Heart rate as extra guidance" : "Puls som ekstra guide"}</p>
              <p className={styles.menuHint}>{siteLocale === "en" ? "Optional. If you know your max heart rate, I can use it as an extra guide in relevant workouts." : "Valgfrit. Hvis du kender din makspuls, kan jeg bruge den som ekstra guide på relevante pas."}</p>
              <div className={styles.menuToggleRow}>
                <button
                  className={!runnerProfile.pulseGuidanceEnabled ? styles.audioModeActive : styles.audioModeBtn}
                  onClick={() => setRunnerProfile((current) => ({ ...current, pulseGuidanceEnabled: false }))}
                  type="button"
                >
                    {siteLocale === "en" ? "Off" : "Fra"}
                </button>
                <button
                  className={runnerProfile.pulseGuidanceEnabled ? styles.audioModeActive : styles.audioModeBtn}
                  onClick={() => setRunnerProfile((current) => ({ ...current, pulseGuidanceEnabled: true }))}
                  type="button"
                >
                    {siteLocale === "en" ? "Use heart rate" : "Brug puls"}
                </button>
              </div>
              {runnerProfile.pulseGuidanceEnabled && (
                <label className={styles.menuFieldGroup}>
                  <span>{siteLocale === "en" ? "Max heart rate" : "Makspuls"}</span>
                  <input
                    className={styles.menuFieldInput}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder={siteLocale === "en" ? "E.g. 190" : "Fx 190"}
                    value={pulseDraft.maxHeartRate}
                    onChange={(event) => {
                      const rawValue = event.target.value.replace(/[^\d]/g, "").slice(0, 3);
                      setPulseDraft({ maxHeartRate: rawValue });
                      setRunnerProfile((current) => ({
                        ...current,
                        maxHeartRate: parseMaxHeartRateInput(rawValue),
                      }));
                    }}
                  />
                </label>
              )}
              <p className={styles.subtleInline}>{pulseGuidanceSummary}</p>
              {runnerProfile.pulseGuidanceEnabled && pulseZoneLegend.length > 0 && (
                <div className={styles.zoneLegendGrid}>
                  {pulseZoneLegend.map((entry) => (
                    <div key={entry.zoneLabel} className={styles.zoneLegendCard}>
                      <strong>{entry.zoneLabel}</strong>
                      <span>{entry.rangeLabel}</span>
                      <small>{entry.description}</small>
                    </div>
                  ))}
                </div>
              )}
              {pulseGuidanceWarning && <p className={styles.menuWarning}>{pulseGuidanceWarning}</p>}
            </div>
            <div className={styles.audioSettings}>
              <p className={styles.menuLabel}>{siteLocale === "en" ? "Appearance" : "Udseende"}</p>
              <div className={styles.audioModeRow}>
                <button className={styles.audioModeActive} type="button" disabled>
                  {siteLocale === "en" ? "Dark" : "Mørk"}
                </button>
              </div>
              <p className={styles.subtleInline}>{siteLocale === "en" ? "StridePilot uses dark mode as the default beta view." : "StridePilot bruger mørk tilstand som fast visning i betaen."}</p>
            </div>
            <button
              className={styles.menuBtn}
              onClick={() => {
                downloadIcs();
                setMenuOpen(false);
              }}
              disabled={!plan}
            >
              {siteLocale === "en" ? "Download .ics" : "Hent .ics"}
            </button>
            <button
              className={styles.menuBtn}
              onClick={() => {
                downloadProgramText();
                setMenuOpen(false);
              }}
              disabled={!plan}
            >
              {siteLocale === "en" ? "Download plan" : "Hent program"}
            </button>
            <button
              className={styles.menuBtn}
              onClick={() => {
                openFeedbackMail();
                setMenuOpen(false);
              }}
            >
              Send feedback
            </button>
            {authUser && (
              <button
                className={styles.menuBtn}
                onClick={() => {
                  logout();
                  setMenuOpen(false);
                }}
              >
                {siteLocale === "en" ? "Log out" : "Log ud"}
              </button>
            )}
            <button
              className={styles.menuResetBtn}
              type="button"
              onClick={() => {
                void resetAppState();
              }}
            >
              {siteLocale === "en" ? "Reset app" : "Nulstil app"}
            </button>
          </div>
        )}
      </section>

      {stage !== "welcome" && stage !== "auth" && stage !== "intro" && stage !== "workout" && stage !== "program" && (
        <section className={styles.hero}>
          <h1>{contextualHeader.title}</h1>
          <p className={styles.heroSub}>{contextualHeader.subtitle}</p>
          {isDemoMode && <p className={styles.demoBadge}>{siteLocale === "en" ? "Demo mode · data is not stored permanently" : "Demo-tilstand · data gemmes ikke permanent"}</p>}
        </section>
      )}

      {stage === "welcome" && (
        <section className={styles.welcomeHero}>
          <div className={styles.welcomeOverlay}>
            <div className={styles.welcomeBody}>
              <h1>{APP_NAME}</h1>
              <p>{siteCopy.welcomeSubhead}</p>
              <p className={styles.subtle}>
                {siteCopy.welcomeExplainerLines[0]}
                <br />
                {siteCopy.welcomeExplainerLines[1]}
              </p>
              <button className={styles.primaryBtn} onClick={startFlow}>
                {siteCopy.startLabel}
              </button>
              <button className={styles.secondaryBtn} onClick={startDemoMode}>
                {siteCopy.demoLabel}
              </button>
              <p className={styles.subtleInline}>{siteCopy.betaTesterInstructions}</p>
              <p className={styles.authVersionLabel}>
                {APP_NAME} {APP_VERSION} · build b00d5be
              </p>
            </div>
          </div>
        </section>
      )}

      {stage === "auth" && (
        <section className={styles.authHero}>
          <div className={styles.authOverlay}>
            <section className={styles.centerCard}>
              <h2>{siteCopy.welcomeTitle}</h2>
              <p className={styles.subtle}>
                {siteCopy.authSubtitle}
                <br />
                {siteCopy.welcomeExplainerLines[1]}
              </p>

              <div className={styles.formGrid}>
                <label>
                  {siteCopy.emailLabel}
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </label>
                <label>
                  {siteCopy.passwordLabel}
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </label>
              </div>

              {authMode === "signup" ? (
                <div className={styles.authActions}>
                  <button className={styles.primaryBtn} onClick={register}>
                    {siteCopy.signUpLabel}
                  </button>
                  <p className={styles.authDivider}>eller</p>
                  <button className={styles.secondaryBtn} onClick={startDemoMode}>
                    {siteCopy.demoLabel}
                  </button>
                  <p className={styles.subtleInline}>
                    {siteCopy.alreadyAccount}{" "}
                    <button className={styles.textBtn} onClick={() => setAuthMode("login")}>
                      {siteCopy.loginLabel}
                    </button>
                  </p>
                </div>
              ) : (
                <div className={styles.authActions}>
                  <button className={styles.primaryBtn} onClick={login}>
                    {siteCopy.loginLabel}
                  </button>
                  <p className={styles.authDivider}>eller</p>
                  <button className={styles.secondaryBtn} onClick={startDemoMode}>
                    {siteCopy.demoLabel}
                  </button>
                  <p className={styles.subtleInline}>
                    {siteCopy.newHere}{" "}
                    <button className={styles.textBtn} onClick={() => setAuthMode("signup")}>
                      {siteCopy.signUpLabel}
                    </button>
                  </p>
                </div>
              )}

              <p className={styles.authVersionLabel}>
                {APP_NAME} {APP_VERSION} · build b00d5be
              </p>
            </section>
          </div>
        </section>
      )}

      {stage === "intro" && (
        <section className={`${styles.centerCard} ${styles.introCard}`}>
          <h2>{siteCopy.introTitle}</h2>
          <p className={styles.subtle}>{siteCopy.introBody}</p>
          <p className={styles.subtleInline}>{siteCopy.introBullets[0]}</p>
          <p className={styles.subtleInline}>{siteCopy.introBullets[1]}</p>
          <div className={styles.topActions}>
            <button className={styles.primaryBtn} onClick={completeIntro}>
              {siteCopy.startLabel}
            </button>
          </div>
        </section>
      )}

      {stage === "profile" && (
        <section className={`${styles.card} ${styles.onboardingCard}`}>
          <div className={styles.onboardingHeader}>
            <p className={styles.nextLabel}>{ui.onboardingLabel}</p>
            <h2>{currentOnboardingStep.title}</h2>
            {currentOnboardingStep.subtitle ? <p className={styles.onboardingIntro}>{currentOnboardingStep.subtitle}</p> : null}
          </div>
          <div className={styles.onboardingProgress}>
            <p className={styles.nextLabel}>{ui.onboardingStep}</p>
            <div className={styles.progressTrack}>
              <div className={styles.progressFill} style={{ width: `${(onboardingStep / onboardingSteps) * 100}%` }} />
            </div>
          </div>
          <div className={styles.onboardingContent}>

          {onboardingStep === 1 && (
            <div className={styles.sectionBlock}>
              <div className={styles.choiceGrid}>
                {onboardingTrackOptions.map((option) => {
                  const active = onboardingSelections.track && runnerProfile.onboardingTrack === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={active ? styles.choiceCardActive : styles.choiceCard}
                      onClick={() => {
                        setRunnerProfile((current) => ({
                          ...current,
                          onboardingTrack: option.value,
                          preferredGuidance:
                            option.value === "getting_started" || option.value === "returning"
                              ? current.preferredGuidance ?? "simple"
                              : current.preferredGuidance,
                        }));
                        setPlanAmbition(defaultPlanAmbitionForTrack(option.value));
                        setOnboardingSelections((current) => ({ ...current, track: true }));
                      }}
                    >
                      <span className={styles.choiceCheck} aria-hidden="true">{active ? "✓" : ""}</span>
                      <span className={styles.choiceText}>{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {onboardingStep === 2 && (
            <div className={styles.sectionBlock}>
              <div className={styles.formGrid}>
                <label>
                  <span>{siteLocale === "en" ? "Name" : "Navn"}</span>
                  <input
                    type="text"
                    value={runnerProfile.firstName ?? ""}
                    onChange={(e) => setRunnerProfile((current) => ({ ...current, firstName: e.target.value.trimStart() }))}
                    onBlur={(e) => setRunnerProfile((current) => ({ ...current, firstName: e.target.value.trim() }))}
                    placeholder={siteLocale === "en" ? "For example Alex" : "Fx Anders"}
                  />
                </label>
              </div>
            </div>
          )}

          {onboardingStep === 3 && (
            <div className={styles.sectionBlock}>
              <div className={styles.formGrid}>
                <label>
                  <span>{siteLocale === "en" ? "How far can you run without stopping?" : "Hvor langt kan du realistisk løbe nu uden stop?"}</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder={siteLocale === "en" ? "For example 6.5 km" : "Fx 6,5 km"}
                    value={capacityDistanceDraft}
                    onChange={(event) => {
                      const rawValue = event.target.value.replace(/[^\d,.-]/g, "").replace(".", ",");
                      setCapacityDistanceDraft(rawValue);
                      const parsedDistance = parseCurrentCapacityDistanceKm(rawValue);
                      if (parsedDistance !== null) {
                        applyCapacityBaseline(parsedDistance, runnerProfile.currentRunsPerWeek ?? 0);
                      } else {
                        setOnboardingSelections((current) => ({ ...current, runningAbility: false }));
                      }
                    }}
                    aria-invalid={capacityDistanceDraft.length > 0 && capacityDistanceKm === null ? true : undefined}
                  />
                  <div className={styles.quickChipRow}>
                    {CURRENT_CAPACITY_DISTANCE_QUICK_OPTIONS.map((distanceKm) => {
                      const active = capacityDistanceKm === distanceKm;
                      return (
                        <button
                          key={`capacity-${distanceKm}`}
                          type="button"
                          className={active ? styles.quickChipActive : styles.quickChip}
                          onClick={() => {
                            const nextDraft = String(distanceKm).replace(".", ",");
                            setCapacityDistanceDraft(nextDraft);
                            applyCapacityBaseline(distanceKm, runnerProfile.currentRunsPerWeek ?? 0);
                          }}
                        >
                      {distanceKm >= 10 ? `${distanceKm}+ km` : `${distanceKm} km`}
                        </button>
                      );
                    })}
                  </div>
                  {capacityDistanceDraft.length > 0 && capacityDistanceKm === null && (
                    <small className={styles.warningText}>{siteLocale === "en" ? "Enter a realistic number between 0.5 and 30 km." : "Skriv et realistisk tal mellem 0,5 og 30 km."}</small>
                  )}
                </label>
              </div>
              <div className={styles.trainingDays}>
                <p className={styles.daysLabel}>{siteLocale === "en" ? "How often do you run now?" : "Hvor mange gange løber du typisk nu?"}</p>
                <div className={styles.choiceGrid}>
                  {localizedCurrentRunsPerWeekOptions.map((option) => {
                    const active = (runnerProfile.currentRunsPerWeek ?? 0) === option.value;
                    return (
                      <button
                        key={`current-runs-${option.value}`}
                        type="button"
                        className={active ? styles.choiceCardActive : styles.choiceCard}
                        onClick={() => {
                          const nextRuns = option.value;
                          if (capacityDistanceKm !== null) {
                            applyCapacityBaseline(capacityDistanceKm, nextRuns);
                          } else {
                            setRunnerProfile((current) => ({ ...current, currentRunsPerWeek: nextRuns }));
                          }
                        }}
                      >
                        <span className={styles.choiceCheck} aria-hidden="true">{active ? "✓" : ""}</span>
                        <span className={styles.choiceText}>{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {capacityDistanceKm !== null && (
                <div className={styles.optionalSavedState}>
                  <span className={styles.optionalSavedChip}>{siteLocale === "en" ? "Starting point" : "Udgangspunkt"}</span>
                  <strong>{siteLocale === "en" ? `${formatDistanceLabel(capacityDistanceKm, siteLocale)} km without stopping` : `${formatDistanceLabel(capacityDistanceKm, siteLocale)} km uden stop`}</strong>
                </div>
              )}
            </div>
          )}

          {onboardingStep === 4 && (
            <div className={styles.sectionBlock}>
              <div className={styles.choiceGrid}>
                {localizedGoalDistanceOptions.map((option) => {
                  const active = onboardingSelections.goalDistance && goal.distance === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={active ? styles.choiceCardActive : styles.choiceCard}
                      onClick={() => {
                        setGoal((g) => ({ ...g, distance: option.value }));
                        setOnboardingSelections((current) => ({ ...current, goalDistance: true, goalType: false }));
                      }}
                    >
                      <span className={styles.choiceCheck} aria-hidden="true">{active ? "✓" : ""}</span>
                      <span className={styles.choiceText}>{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {onboardingStep === 6 && (
            <div className={styles.sectionBlock}>
              <div className={styles.choiceGrid}>
                {filteredGoalTypeOptions.map((option) => {
                  const active = onboardingSelections.goalType && goal.goalType === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={active ? styles.choiceCardActive : styles.choiceCard}
                      onClick={() => {
                        setGoal((current) => ({
                          ...current,
                          goalType: option.value,
                          ...(shouldShowGoalPaceInput(option.value) ? {} : { targetPaceSecPerKm: undefined, targetTime: "" }),
                        }));
                        setOnboardingSelections((current) => ({ ...current, goalType: true }));
                      }}
                    >
                      <span className={styles.choiceCheck} aria-hidden="true">{active ? "✓" : ""}</span>
                      <span className={styles.choiceText}>{option.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className={styles.formGrid}>
                {shouldShowGoalPaceInput(goal.goalType) && (
                  <label>
                    <span className={styles.labelRow}>
                      {siteLocale === "en" ? "Target pace (min/km)" : "Ønsket tempo (min/km)"}
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
                        <option value="">{siteLocale === "en" ? "Min" : "Min"}</option>
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
                        <option value="">{siteLocale === "en" ? "Sec" : "Sek"}</option>
                        {PACE_SECOND_OPTIONS.map((second) => (
                          <option key={`pace-second-${second}`} value={String(second).padStart(2, "0")}>
                            {String(second).padStart(2, "0")}
                          </option>
                        ))}
                      </select>
                      <span className={styles.paceSuffix}>min/km</span>
                    </div>
                    {goal.targetPaceSecPerKm && <small className={styles.fieldHint}>{siteLocale === "en" ? `About ${targetTimeFromPace(goal.distance, goal.targetPaceSecPerKm)} for ${localizedGoalDistanceName(goal.distance, siteLocale)}.` : `Svarende til ca. ${targetTimeFromPace(goal.distance, goal.targetPaceSecPerKm)} for ${goal.distance}.`}</small>}
                    {openInfoField === "targetPace" && <small className={styles.infoTextBox}>{INFO_TEXT.targetPace}</small>}
                  </label>
                )}
              </div>
              {(goal.goalType === "target_time" || goal.goalType === "pr") && !goal.targetPaceSecPerKm && (
                <p className={styles.warningText}>{siteLocale === "en" ? "Choose a pace to continue." : "Vælg et tempo for at fortsætte."}</p>
              )}
            </div>
          )}

          {onboardingStep === 5 && (
            <div className={styles.sectionBlock}>
              <div className={styles.formGrid}>
                <label>
                  {siteLocale === "en" ? "Typical workout length" : "Typisk tid til et pas"}
                  <select
                    value={String(runnerProfile.typicalWorkoutMinutes ?? 45)}
                    onChange={(e) => setRunnerProfile((current) => ({ ...current, typicalWorkoutMinutes: Number(e.target.value) }))}
                  >
                    <option value="30">{siteLocale === "en" ? "About 30 min" : "Ca. 30 min"}</option>
                    <option value="45">{siteLocale === "en" ? "About 45 min" : "Ca. 45 min"}</option>
                    <option value="60">{siteLocale === "en" ? "About 60 min" : "Ca. 60 min"}</option>
                    <option value="75">75+ min</option>
                  </select>
                </label>
                <label>
                  {siteLocale === "en" ? "Start date" : "Hvornår vil du gerne starte?"}
                  <input
                    type="date"
                    value={goal.startDate}
                    min={suggestedPlanStartDate}
                    onChange={(e) => setGoal((current) => ({ ...current, startDate: e.target.value }))}
                  />
                  <small className={styles.fieldHint}>{planStartDateHelpText}</small>
                </label>
              </div>
              <div className={styles.trainingDays}>
                <p className={styles.daysLabel}>{siteLocale === "en" ? "Training days" : "Træningsdage"}</p>
                <div className={styles.daysGrid}>
                  {WEEK_DAY_NAMES.map((day) => {
                    const active = goal.availableTrainingDays?.includes(day);
                    return (
                      <button key={`day-${day}`} type="button" className={active ? styles.dayChipActive : styles.dayChip} onClick={() => toggleTrainingDay(day)}>
                        <span className={styles.choiceCheck} aria-hidden="true">{active ? "✓" : ""}</span>
                        <span className={styles.choiceText}>{dayLabel(day, siteLocale)}</span>
                      </button>
                    );
                  })}
                </div>
                {lowFrequencyOverridePrompt && (
                  <p className={styles.warningText}>{siteLocale === "en" ? "For half marathon and marathon, I ask for an extra confirmation if you want to stay at 2 runs per week." : "Til halvmaraton og maraton beder jeg om en ekstra bekræftelse, hvis du vil holde dig til 2 pas om ugen."}</p>
                )}
              </div>
              <div className={styles.trainingDays}>
                <p className={styles.daysLabel}>{siteLocale === "en" ? "Long run day" : "Lang tur"}</p>
                <div className={styles.choiceGrid}>
                  {localizedLongRunDayOptions.map((option) => {
                    const active = (goal.preferredLongRunDay ?? "both") === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={active ? styles.choiceCardActive : styles.choiceCard}
                        onClick={() => setGoal((current) => ({ ...current, preferredLongRunDay: option.value }))}
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

          {onboardingStep === 7 && (
            <div className={styles.sectionBlock}>
              <div className={styles.trainingDays}>
                <p className={styles.daysLabel}>{siteLocale === "en" ? "Other training in your week" : "Anden træning i hverdagen"}</p>
                <div className={styles.choiceGrid}>
                  {localizedActivityLevelOptions.map((option) => {
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
              </div>
              <div className={styles.formGrid}>
                <label>
                  {siteLocale === "en" ? "Plan style" : "Hvordan vil du helst bygge op?"}
                </label>
                <div className={styles.choiceGrid}>
                  {localizedAmbitionOptions.map((option) => {
                    const active = onboardingSelections.ambition && planAmbition === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={active ? styles.choiceCardActive : styles.choiceCard}
                        onClick={() => {
                          setPlanAmbition(option.value);
                          setOnboardingSelections((current) => ({ ...current, ambition: true }));
                        }}
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

          {onboardingStep === 8 && (
            <div className={styles.sectionBlock}>
              <h3>{siteLocale === "en" ? "Constraints (optional)" : "Hensyn (valgfrit)"}</h3>
              <div className={styles.formGrid}>
                <label>
                  {siteLocale === "en" ? "Anything your body is sensitive to?" : "Noget kroppen er følsom over for?"}
                  <textarea
                    rows={2}
                    className={styles.compactTextarea}
                    value={runnerProfile.injuryHistory ?? ""}
                    onChange={(e) => setRunnerProfile((current) => ({ ...current, injuryHistory: e.target.value }))}
                    placeholder={siteLocale === "en" ? "For example Achilles, knee, or anything you are keeping an eye on" : "Fx akillessene, knæ eller noget du holder øje med"}
                  />
                </label>
                <label>
                  {siteLocale === "en" ? "Anything you would prefer to avoid?" : "Noget du helst vil styre uden om?"}
                  <textarea
                    rows={2}
                    className={styles.compactTextarea}
                    value={runnerProfile.weakPoints ?? ""}
                    onChange={(e) => setRunnerProfile((current) => ({ ...current, weakPoints: e.target.value }))}
                    placeholder={siteLocale === "en" ? "For example too many intervals or weeks that feel too rigid" : "Fx for mange intervaller eller for stive uger"}
                  />
                </label>
              </div>
            </div>
          )}

          {onboardingStep === 9 && (
            <div className={styles.sectionBlock}>
              <h3>{siteLocale === "en" ? "Fine-tune the plan (optional)" : "Finjustér planen (valgfrit)"}</h3>
              <div className={styles.formGrid}>
                <div className={styles.optionalSectionCard}>
                  <div className={styles.optionalSectionHeader}>
                    <div>
                      <p className={styles.nextLabel}>{siteLocale === "en" ? "Recent relevant result or PR" : "Seneste relevante tid eller PR"}</p>
                      <p className={styles.subtleInline}>
                        {showRecentRaceFields
                          ? siteLocale === "en"
                            ? "Only use this if you already have a result that is relevant to include."
                            : "Brug kun den her, hvis du allerede har en tid, der er relevant at tage med."
                          : siteLocale === "en"
                            ? "Only relevant if you already have a result you want the plan to lean on a little."
                            : "Kun relevant hvis du allerede har en tid, du vil lade planen læne sig lidt op ad."}
                      </p>
                    </div>
                    <button
                      type="button"
                      className={styles.secondaryBtnMuted}
                      onClick={() => {
                        if (showRecentRaceFields) {
                          setShowRecentRaceFields(false);
                          setRecentRaceDraft({ distance: "", time: "" });
                          setRecentRaceTimeParts({ hours: 0, minutes: 0, seconds: 0 });
                          setRunnerProfile((current) => ({ ...current, recentRaceTimes: [] }));
                          return;
                        }
                        setShowRecentRaceFields(true);
                      }}
                    >
                      {showRecentRaceFields ? (siteLocale === "en" ? "Remove" : "Fjern") : siteLocale === "en" ? "Add time/PR" : "Tilføj tid/PR"}
                    </button>
                  </div>
                  {(recentRaceDraftSummary ?? recentRaceSummary) && (
                    <div className={styles.optionalSavedState}>
                      <span className={styles.optionalSavedChip}>{ui.program.saved}</span>
                      <strong>{recentRaceDraftSummary ?? recentRaceSummary}</strong>
                      <span>{siteLocale === "en" ? "You can still edit or remove it." : "Du kan stadig rette eller fjerne den."}</span>
                    </div>
                  )}
                  {showRecentRaceFields && (
                    <div className={styles.optionalRaceEditor}>
                      <div className={styles.choiceGrid}>
                        {GOAL_DISTANCE_OPTIONS.map((option) => {
                          const active = recentRaceDraft.distance === option.value;
                          return (
                            <button
                              key={`recent-race-distance-${option.value}`}
                              type="button"
                              className={active ? styles.choiceCardActive : styles.choiceCard}
                              onClick={() => {
                                const nextDraft = { ...recentRaceDraft, distance: option.value };
                                setRecentRaceDraft(nextDraft);
                                setRunnerProfile((current) => ({
                                  ...current,
                                  recentRaceTimes: buildRecentRaceTimes(nextDraft.distance, nextDraft.time),
                                }));
                              }}
                            >
                              <span className={styles.choiceCheck} aria-hidden="true">{active ? "✓" : ""}</span>
                              <span className={styles.choiceText}>{option.label}</span>
                            </button>
                          );
                        })}
                      </div>
                      <div className={styles.optionalInputLabel}>
                        <span>{siteLocale === "en" ? "Time" : "Tid"}</span>
                        <div className={styles.timePickerGrid}>
                          <label className={styles.timePickerColumn}>
                            <span>{siteLocale === "en" ? "Hours" : "Timer"}</span>
                            <select
                              className={styles.timePickerSelect}
                              value={String(recentRaceTimeParts.hours)}
                              onChange={(e) => updateRecentRaceTimeParts("hours", Number(e.target.value))}
                              aria-label="Timer"
                            >
                              {RECENT_RACE_HOUR_OPTIONS.map((value) => (
                                <option key={`recent-race-hours-${value}`} value={value}>
                                  {value}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className={styles.timePickerColumn}>
                            <span>{siteLocale === "en" ? "Min" : "Min"}</span>
                            <select
                              className={styles.timePickerSelect}
                              value={String(recentRaceTimeParts.minutes)}
                              onChange={(e) => updateRecentRaceTimeParts("minutes", Number(e.target.value))}
                              aria-label="Minutter"
                            >
                              {RECENT_RACE_MINUTE_OPTIONS.map((value) => (
                                <option key={`recent-race-minutes-${value}`} value={value}>
                                  {String(value).padStart(2, "0")}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className={styles.timePickerColumn}>
                            <span>{siteLocale === "en" ? "Sec" : "Sek"}</span>
                            <select
                              className={styles.timePickerSelect}
                              value={String(recentRaceTimeParts.seconds)}
                              onChange={(e) => updateRecentRaceTimeParts("seconds", Number(e.target.value))}
                              aria-label="Sekunder"
                            >
                              {RECENT_RACE_SECOND_OPTIONS.map((value) => (
                                <option key={`recent-race-seconds-${value}`} value={value}>
                                  {String(value).padStart(2, "0")}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <small className={styles.fieldHint}>
                          {siteLocale === "en" ? `I show ${recentRaceTimeParts.hours > 0 ? "h:mm:ss" : "mm:ss"} in the summary.` : `Jeg viser ${recentRaceTimeParts.hours > 0 ? "t:mm:ss" : "mm:ss"} i resuméet.`}
                        </small>
                      </div>
                    </div>
                  )}
                  {showRecentRaceFields && (!recentRaceDraft.distance || !recentRaceDraftSummary) && (
                    <small className={styles.fieldHint}>{siteLocale === "en" ? "Choose both a distance and a time if you want to save a recent relevant result." : "Vælg både distance og tid, hvis du vil gemme en seneste relevant tid."}</small>
                  )}
                </div>
                <div className={`${styles.inlineFieldGrid} ${styles.secondarySetupBlock}`}>
                  <p className={styles.subtleInline}>{siteLocale === "en" ? "The rest is only for fine-tuning. You can comfortably skip it." : "Resten er kun til finjustering. Du kan sagtens springe det over."}</p>
                  <label>
                    {siteLocale === "en" ? "Height (cm)" : "Højde (cm)"}
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
                    {siteLocale === "en" ? "Weight (kg)" : "Vægt (kg)"}
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
                    {siteLocale === "en" ? "Age" : "Alder"}
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
              </div>
              <div className={styles.trainingDays}>
                <p className={styles.daysLabel}>{siteLocale === "en" ? "Gender (optional)" : "Køn (valgfrit)"}</p>
                <div className={styles.choiceGrid}>
                  {localizedGenderOptions.map((option) => {
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

          </div>
          <div className={styles.onboardingStickyNav}>
            <div className={styles.onboardingStickyNavInner}>
              <button className={styles.secondaryBtn} type="button" onClick={() => setOnboardingStep((step) => Math.max(1, step - 1))} disabled={onboardingStep === 1}>
                {ui.back}
              </button>
              {onboardingStep < onboardingSteps ? (
                <button className={styles.primaryBtn} type="button" onClick={() => setOnboardingStep((step) => Math.min(onboardingSteps, step + 1))} disabled={!isOnboardingStepValid}>
                  {currentOnboardingStep.nextLabel}
                </button>
              ) : (
                <div className={styles.onboardingNavActions}>
                  <button className={styles.secondaryBtnMuted} type="button" onClick={() => void requestPlanRecommendation()} disabled={isLoading}>
                    {ui.skip}
                  </button>
                  <button className={styles.primaryBtn} onClick={() => void requestPlanRecommendation()} disabled={isLoading}>
                    {isLoading ? ui.loadingPlan : ui.showMyPlan}
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {stage === "intermezzo" && planRecommendation && (
        <section className={`${styles.centerCard} ${styles.intermezzoCard}`}>
          <p className={styles.nextLabel}>{ui.recommendation.title}</p>
          <p className={styles.subtle}>{recommendationLeadCopy}</p>
          <div className={styles.intermezzoGrid}>
            <div className={styles.intermezzoItem}>
              <p>{ui.recommendation.recommendedDuration}</p>
              <strong>{recommendedRecommendationOption?.durationWeeks ?? planRecommendation.recommendedDurationWeeks} {siteLocale === "en" ? "weeks" : "uger"}</strong>
            </div>
            <div className={styles.intermezzoItem}>
              <p>{ui.recommendation.realisticRange}</p>
              <strong>{planRecommendation.minDurationWeeks}–{planRecommendation.maxDurationWeeks} {siteLocale === "en" ? "weeks" : "uger"}</strong>
            </div>
            <div className={styles.intermezzoItem}>
              <p>{ui.recommendation.selectedPath}</p>
              <strong>{activeRecommendationOption ? recommendationRouteLabel(activeRecommendationOption.mode, siteLocale) : ui.recommendation.recommendedPath}</strong>
            </div>
            <div className={styles.intermezzoItem}>
              <p>{ui.recommendation.selectedDuration}</p>
              <strong>{activeRecommendationOption?.durationWeeks ?? planRecommendation.recommendedDurationWeeks} {siteLocale === "en" ? "weeks" : "uger"}</strong>
            </div>
            <div className={styles.intermezzoItem}>
              <p>{ui.recommendation.trainingRhythm}</p>
              <strong>
                {(activeRecommendationOption?.sessionsPerWeek ?? planRecommendation.recommendedSessionsPerWeek) === (goal.availableTrainingDays?.length ?? 0)
                  ? `${activeRecommendationOption?.sessionsPerWeek ?? planRecommendation.recommendedSessionsPerWeek} ${siteLocale === "en" ? "runs/week" : "pas/uge"}`
                  : `${Math.max(1, (activeRecommendationOption?.sessionsPerWeek ?? planRecommendation.recommendedSessionsPerWeek) - 1)} → ${activeRecommendationOption?.sessionsPerWeek ?? planRecommendation.recommendedSessionsPerWeek} ${siteLocale === "en" ? "runs/week" : "pas/uge"}`}
              </strong>
            </div>
            <div className={styles.intermezzoItem}>
              <p>{ui.recommendation.progressionTempo}</p>
              <strong>{recommendationProgressionLabel}</strong>
            </div>
            <div className={styles.intermezzoItem}>
              <p>{ui.recommendation.planLevel}</p>
              <strong>{activeRecommendationOption?.planLevelLabel ?? ui.recommendation.realistic}</strong>
            </div>
          </div>
          <div className={styles.intermezzoReason}>
            <h3>{ui.recommendation.adjustDuration}</h3>
            <p className={styles.subtleInline}>
              {siteLocale === "en"
                ? `I recommend ${recommendedRecommendationOption?.durationWeeks ?? planRecommendation.recommendedDurationWeeks} weeks, but you can adjust it if you want to.`
                : `Jeg anbefaler ${recommendedRecommendationOption?.durationWeeks ?? planRecommendation.recommendedDurationWeeks} uger, men du kan justere, hvis du vil.`}
            </p>
            <div className={styles.durationAdjustRow}>
              <button
                type="button"
                className={styles.secondaryBtnMuted}
                onClick={() => updateRecommendationDuration((activeRecommendationOption?.durationWeeks ?? planRecommendation.recommendedDurationWeeks) - 1)}
                disabled={isLoading || (activeRecommendationOption?.durationWeeks ?? planRecommendation.recommendedDurationWeeks) <= (durationEditBounds?.editableMinWeeks ?? planRecommendation.minDurationWeeks)}
              >
                {ui.recommendation.minusWeek}
              </button>
              <label className={styles.durationAdjustField}>
                <span>{ui.recommendation.weeks}</span>
                <input
                  type="number"
                  min={durationEditBounds?.editableMinWeeks ?? planRecommendation.minDurationWeeks}
                  max={durationEditBounds?.editableMaxWeeks ?? planRecommendation.maxDurationWeeks}
                  inputMode="numeric"
                  value={activeRecommendationOption?.durationWeeks ?? planRecommendation.recommendedDurationWeeks}
                  onChange={(event) => updateRecommendationDuration(Number(event.target.value || planRecommendation.recommendedDurationWeeks))}
                />
              </label>
              <button
                type="button"
                className={styles.secondaryBtnMuted}
                onClick={() => updateRecommendationDuration((activeRecommendationOption?.durationWeeks ?? planRecommendation.recommendedDurationWeeks) + 1)}
                disabled={isLoading || (activeRecommendationOption?.durationWeeks ?? planRecommendation.recommendedDurationWeeks) >= (durationEditBounds?.editableMaxWeeks ?? planRecommendation.maxDurationWeeks)}
              >
                {ui.recommendation.plusWeek}
              </button>
            </div>
            <p className={styles.subtleInline}>
              {ui.recommendation.endDate}: {activeRecommendationOption?.goalDate ? new Date(`${activeRecommendationOption.goalDate}T12:00:00`).toLocaleDateString(siteLocale === "en" ? "en-GB" : "da-DK", { day: "numeric", month: "long", year: "numeric" }) : "—"}
            </p>
            {durationAdjustmentState?.note && <p className={styles.warningText}>{durationAdjustmentState.note}</p>}
          </div>
          {activeRecommendationOption?.wasAdjusted && activeRecommendationOption.adjustmentMessage && (
            <div className={styles.intermezzoReason}>
              <h3>{ui.recommendation.adjustment}</h3>
              <p className={styles.subtleInline}>{activeRecommendationOption.adjustmentMessage}</p>
            </div>
          )}
          {recommendationWarnings.length > 0 && (
            <div className={styles.intermezzoReason}>
              <h3>{siteLocale === "en" ? "Important to know" : "Vigtigt at vide"}</h3>
              {recommendationWarnings.map((warning, index) => (
                <p key={`recommendation-warning-${index}`} className={styles.subtleInline}>
                  {warning}
                </p>
              ))}
            </div>
          )}

          <div className={styles.topActions}>
            {planRecommendation.options.map((option) => (
              <button
                key={option.mode}
                className={
                  planRecommendation.selectedPathVariant === option.mode
                    ? styles.recommendationOptionBtnActive
                    : styles.recommendationOptionBtn
                }
                onClick={() => selectRecommendationOption(option.mode)}
                disabled={isLoading}
              >
                {recommendationRouteLabel(option.mode, siteLocale)}
              </button>
            ))}
          </div>
          <div className={styles.topActions}>
            <button className={`${styles.primaryBtn} ${styles.recommendationPrimaryBtn}`} onClick={() => generatePlan()} disabled={isLoading}>
              {isLoading ? (siteLocale === "en" ? "Generating..." : "Genererer...") : siteLocale === "en" ? "Use this plan" : "Brug denne anbefaling"}
            </button>
            <button className={styles.secondaryBtn} onClick={() => setStage("profile")} disabled={isLoading}>
              {siteLocale === "en" ? "Edit my answers" : "Ret mine svar"}
            </button>
          </div>
        </section>
      )}

      {stage === "program" && (
        <section className={styles.grid}>
          <article className={styles.card}>
            {plan && !showProgramIntro && isDemoMode && <p className={`${styles.demoBadge} ${styles.programDemoBadge}`}>{siteLocale === "en" ? "Demo mode active" : "Demo-mode aktiv"}</p>}

            <div className={styles.programHeroGrid}>
              <div className={styles.todayCard}>
                <p className={styles.nextLabel}>{todayActionState.label}</p>
                <h3 className={!todaySession ? styles.restDayTitle : undefined}>{todayWorkoutCard?.title ?? todayActionState.emptyTitle}</h3>
                {todaySession ? (
                  <>
                    <p className={styles.todayMeta}>{todayWorkoutCard?.duration ?? formatReadableDurationFromSeconds(todayDuration * 60)}</p>
                    {todayWorkoutCard && <p className={styles.workoutCardSummary}>{todayWorkoutCard.shortStructureSummary}</p>}
                    {todayWorkoutCard?.visualProfile && (
                      <div className={styles.dayIntensityBar} aria-hidden="true">
                        {todayWorkoutCard.visualProfile.map((segment, index) => (
                          <span
                            key={`${todaySession.id}-today-intensity-${index}`}
                            className={workoutProfileSegmentClassName(segment)}
                            style={{ flexGrow: Math.max(1, segment.durationSec) }}
                          />
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <p className={styles.restDayBadge}>{siteLocale === "en" ? "Calm day" : "Rolig dag"}</p>
                    {nextSession && (
                      <p className={styles.todayMeta}>
                        {siteLocale === "en" ? `Next run: ${nextWorkoutDayLabel}` : `Næste tur: ${nextWorkoutDayLabel}`}
                      </p>
                    )}
                  </>
                )}
                {todaySession ? (
                  <button
                    className={styles.primaryBtn}
                    onClick={() => {
                      openWorkoutSession(todaySession.id);
                    }}
                  >
                    {siteLocale === "en" ? "Start run" : "Start tur"}
                  </button>
                ) : nextSession ? (
                  <button
                    className={`${styles.secondaryBtn} ${styles.secondaryBtnMuted}`}
                    onClick={() => {
                      revealWeekOverview({ focusNextWorkout: true });
                    }}
                  >
                    {todayActionState.ctaLabel}
                  </button>
                ) : (
                  <button
                    className={`${styles.secondaryBtn} ${styles.secondaryBtnMuted}`}
                    onClick={() => {
                      revealWeekOverview();
                    }}
                  >
                    {todayActionState.ctaLabel}
                  </button>
                )}
              </div>
              <div className={styles.programSecondaryStack}>
                {nextWorkoutState.visible && (
                  <div className={`${styles.goalCard} ${styles.goalCardSecondary} ${styles.programSecondaryCard} ${nextSession && isGoalEventSession(nextSession) ? styles.goalCardGoalEvent : ""}`}>
                    <p className={styles.nextLabel}>{siteLocale === "en" ? "Next planned workout" : "Næste planlagte pas"}</p>
                    <h3>{nextSession ? sessionDisplayTitle(nextSession, goal.distance, siteLocale) : visibleSessionTitle(nextWorkoutState.title, siteLocale)}</h3>
                    {nextSession && isGoalEventSession(nextSession) && <p className={styles.goalEventTag}>{goalEventDistanceLabel(goal.distance, siteLocale)} · {siteLocale === "en" ? "race day" : "måldag"}</p>}
                    {nextWorkoutState.meta && <p className={styles.subtleInline}>{nextWorkoutState.meta}</p>}
                  </div>
                )}

                {plan && currentWeeklyLoad.length > 0 && (
                  <div className={`${styles.chartCard} ${styles.chartCardCompact} ${styles.chartCardMinimal} ${styles.programProgressCard}`}>
                    <p className={styles.nextLabel}>{ui.program.progress}</p>
                    {progressGraphState.visible && (
                      <div className={styles.progressMiniChart}>
                        <div className={styles.chartMetaRow}>
                          <span className={styles.chartActiveWeek}>{ui.program.selectedWeek}</span>
                          <span>{ui.program.weekRange(progressGraphState.windowStartWeek, progressGraphState.windowEndWeek)}</span>
                        </div>
                        <div
                          className={styles.barRow}
                          style={{ ["--progress-columns" as never]: String(progressGraphState.bars.length) }}
                        >
                          {progressGraphState.bars.map((bar) => (
                            <button
                              type="button"
                              key={`progress-bar-${bar.week}`}
                              className={bar.isCurrent ? styles.barColActive : styles.barCol}
                              onClick={() => {
                                const action = buildProgressGraphWeekAction(bar.week);
                                setVisibleWeek(action.targetWeek, { scrollIntoView: action.scrollIntoView });
                              }}
                              aria-pressed={bar.isCurrent}
                              aria-current={bar.isCurrent ? "true" : undefined}
                              aria-label={ui.program.viewWeek(bar.week)}
                              title={ui.program.viewWeek(bar.week)}
                            >
                              <div className={styles.barTrackMini}>
                                <div
                                  className={styles.barFillMini}
                                  style={{ height: `${bar.heightPct}%` }}
                                />
                              </div>
                              <span className={bar.isCurrent ? styles.barLabelActive : undefined}>{bar.label}</span>
                            </button>
                          ))}
                        </div>
                        <svg viewBox="0 0 120 28" preserveAspectRatio="none" className={styles.lineChart} role="img" aria-label={siteLocale === "en" ? "Original and current plan" : "Oprindelig og nuværende plan"}>
                          {progressGraphState.showBaselineSeries && <path d={progressGraphState.baselinePath} className={styles.baselinePath} />}
                          <path d={progressGraphState.path} className={styles.currentPath} />
                          {progressGraphState.points
                            .filter((point) => point.isCurrent)
                            .map((point) => <circle key={point.week} className={styles.progressMiniChartPointActive} cx={point.x} cy={point.y} r={2.5} />)}
                        </svg>
                        <div className={styles.chartLegend}>
                          {progressGraphState.showBaselineSeries && (
                            <span className={styles.chartLegendItem}>
                              <i className={styles.baselineDot} />
                              <span>
                                <strong className={styles.chartLegendLabel}>{ui.program.originalPlan}</strong>
                                <small className={styles.chartLegendHint}>{ui.program.fromStart}</small>
                              </span>
                            </span>
                          )}
                          <span className={styles.chartLegendItem}>
                            <i className={styles.currentDot} />
                            <span>
                                <strong className={styles.chartLegendLabel}>{ui.program.currentPlan}</strong>
                                <small className={styles.chartLegendHint}>{ui.program.afterAdjustments}</small>
                            </span>
                          </span>
                          <span className={styles.chartLegendItem}>
                            <i className={styles.progressLegendCurrent} />
                            <span>
                                <strong className={styles.chartLegendLabel}>{ui.program.currentWeek}</strong>
                                <small className={styles.chartLegendHint}>{ui.program.selectedNow}</small>
                            </span>
                          </span>
                        </div>
                      </div>
                    )}
                    <div className={styles.progressSummaryGrid}>
                      {progressOverviewSummary.map((item) => (
                        <div key={item.label} className={styles.valueCard}>
                          <p>{item.label}</p>
                          <strong>{item.value}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className={styles.programDetailStack}>
                <div className={`${styles.programSection} ${styles.programSectionMuted} ${styles.programDetailCard}`}>
                  <div className={styles.programSectionHeader}>
                    <div>
                        <p className={styles.nextLabel}>{ui.program.currentWeekTitle}</p>
                        <h3>{ui.program.overviewOfWeek(displayWeek)}</h3>
                    </div>
                  </div>
                  {plan && (
                    <div className={styles.progressSummaryGrid}>
                      <div className={styles.valueCard}>
                        <p>{ui.program.weeklyLoad}</p>
                        <strong>{currentWeekLoad ? currentWeekLoad.load.toFixed(1).replace(".", ",") : "0,0"}</strong>
                      </div>
                      <div className={styles.valueCard}>
                        <p>{ui.program.longestRun}</p>
                        <strong>{formatMinutesLabel(currentWeekLongestContinuousRunSec)}</strong>
                      </div>
                      <div className={styles.valueCard}>
                        <p>{ui.program.nextGoalDay}</p>
                        <strong>{goalDestinationSession ? sessionDisplayTitle(goalDestinationSession, goal.distance, siteLocale) : "—"}</strong>
                      </div>
                    </div>
                  )}
                  {plan && (
                    <div ref={programWeekRef}>
                      <div className={styles.topActions}>
                        <button className={styles.secondaryBtn} onClick={() => setVisibleWeek(Math.max(1, displayWeek - 1))} disabled={displayWeek <= 1}>
                          {ui.program.previousWeek}
                        </button>
                        <span className={styles.weekLabel}>{siteLocale === "en" ? `Week ${displayWeek}` : `Uge ${displayWeek}`}</span>
                        <button className={styles.secondaryBtn} onClick={() => setVisibleWeek(Math.min(plan.weeks, displayWeek + 1))} disabled={displayWeek >= plan.weeks}>
                          {ui.program.nextWeek}
                        </button>
                      </div>
                    </div>
                  )}
                  <div className={styles.weekCalendar}>
                    {calendarWeekDates.map((date) => {
                      const daySession = sessionsByDate.get(date.toISOString().slice(0, 10));
                      const daySessionFeedback = daySession ? sessionFeedbackMap[daySession.id] ?? null : null;
                      const dayWorkoutCard = deriveWorkoutCardRepresentation(daySession, { locale: siteLocale, goalDistance: goal.distance });
                      const isToday = date.toDateString() === new Date().toDateString();
                      const isGoalDay = Boolean(daySession && isGoalEventSession(daySession));
                      const isNextWorkout = shouldHighlightNextWorkout(daySession, nextSession?.id ?? null);
                      const visualState = getProgramDayVisualState(daySession, daySessionFeedback);
                      const cardStateClass =
                        visualState === "completed"
                          ? styles.dayCardCompleted
                          : visualState === "planned"
                            ? styles.dayCardPlanned
                            : styles.dayCardRest;
                      return (
                        <button
                          key={date.toISOString()}
                          ref={isNextWorkout ? nextWorkoutDayRef : undefined}
                          className={`${isGoalDay ? styles.dayCardGoal : isToday ? styles.dayCardToday : styles.dayCard} ${cardStateClass} ${isNextWorkout ? styles.dayCardNext : ""}`}
                          onClick={() => {
                            if (daySession) {
                              setSelectedSessionId(daySession.id);
                              setFocusedProgramDayIso(date.toISOString());
                            }
                          }}
                        >
                          <p className={styles.dayCardWeekday}>{dayLabel(daySession?.dayOfWeek ?? WEEK_DAY_NAMES[(date.getDay() + 6) % 7]!, siteLocale).toUpperCase()}</p>
                          <span className={styles.dayCardDate}>{formatDateWithWeekday(date, siteLocale).split(":")[0]}</span>
                          {daySession ? (
                            <>
                              <strong>{dayWorkoutCard?.title ?? sessionDisplayTitle(daySession, goal.distance, siteLocale)}</strong>
                              {dayWorkoutCard && <span className={styles.dayCardSummary}>{dayWorkoutCard.shortStructureSummary}</span>}
                              {dayWorkoutCard?.visualProfile && (
                                <div className={styles.dayIntensityBar} aria-hidden="true">
                                  {dayWorkoutCard.visualProfile.map((segment, index) => (
                                    <span
                                      key={`${daySession.id}-intensity-${index}`}
                                      className={workoutProfileSegmentClassName(segment)}
                                      style={{ flexGrow: Math.max(1, segment.durationSec) }}
                                    />
                                  ))}
                                </div>
                              )}
                              <span>
                                {dayWorkoutCard?.duration ?? `${Math.round(sessionTotalDurationSec(daySession) / 60)} min`}
                                {daySessionFeedback ? ` · ${savedFeedbackStatusLabel(daySessionFeedback.status, siteLocale)}` : ""}
                                {isNextWorkout ? ` · ${ui.program.nextWorkout}` : ""}
                              </span>
                            </>
                          ) : (
                            <span>{siteLocale === "en" ? "Calm day" : "Rolig dag"}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            {focusedProgramSession && focusedProgramDate && (
              <section className={styles.inlineOverlay}>
                <div className={styles.inlineOverlayBackdrop} onClick={() => setFocusedProgramDayIso(null)} />
                <article className={styles.inlineOverlayCard}>
                      <>
                  <p className={styles.dayFocusWeekday}>{dayLabel(focusedProgramSession.dayOfWeek, siteLocale).toUpperCase()}</p>
                  <h3>{focusedWorkoutCard?.title ?? sessionDisplayTitle(focusedProgramSession, goal.distance, siteLocale)}</h3>
                  <p className={styles.subtleStrong}>{focusedWorkoutCard?.duration ?? formatReadableDurationFromSeconds(sessionTotalDurationSec(focusedProgramSession))}</p>
                  <p className={styles.dayFocusStructure}>{focusedWorkoutCard?.shortStructureSummary ?? sessionStructureSummary(focusedProgramSession, siteLocale)}</p>
                  {focusedWorkoutCard?.visualProfile && (
                    <div className={styles.dayIntensityBar} aria-hidden="true">
                      {focusedWorkoutCard.visualProfile.map((segment, index) => (
                        <span
                          key={`${focusedProgramSession.id}-focus-intensity-${index}`}
                          className={workoutProfileSegmentClassName(segment)}
                          style={{ flexGrow: Math.max(1, segment.durationSec) }}
                        />
                      ))}
                    </div>
                  )}
                  <ol className={styles.workoutDetailList}>
                    {focusedProgramSession.steps.map((step, index) => (
                      <li key={`${focusedProgramSession.id}-detail-step-${index}`} className={styles.workoutDetailRow}>
                        <span className={styles.workoutDetailIndex}>{index + 1}</span>
                        <div className={styles.workoutDetailText}>
                          <strong>{phaseName(step, siteLocale)}</strong>
                          {stepSupportingLabel(step, siteLocale) && <small>{stepSupportingLabel(step, siteLocale)}</small>}
                        </div>
                        <span className={styles.workoutDetailDuration}>{formatStepDuration(step)}</span>
                      </li>
                    ))}
                  </ol>
                  <div className={styles.topActions}>
                    <button type="button" className={styles.primaryBtn} onClick={() => openWorkoutSession(focusedProgramSession.id)}>
                      {siteLocale === "en" ? "Start run" : "Start tur"}
                    </button>
                    <button type="button" className={styles.textBtn} onClick={() => setFocusedProgramDayIso(null)}>
                      {siteLocale === "en" ? "Back" : "Tilbage"}
                    </button>
                  </div>
                      </>
                </article>
              </section>
            )}
          </article>

        </section>
      )}

      {stage === "workout" && (
        <section className={styles.workoutHero}>
          <div className={styles.workoutOverlay}>
        <section className={styles.grid}>
          <article className={styles.card}>
            {!activeSession && <p>{ui.workout.chooseWorkout}</p>}
            {activeSession && currentStep && !workoutCompleted && workoutStartCountdown !== null && (
              <div className={styles.workoutCountdownCard}>
                <button type="button" className={styles.workoutBackBtn} onClick={closeWorkoutSession} aria-label={ui.workout.closeWorkoutAria}>
                  {workoutActionState.closeLabel}
                </button>
                <p className={styles.workoutMiniLabel}>{siteLocale === "en" ? "Starting" : "Starter"}</p>
                <h2 className={styles.workoutCountdownTitle}>{sessionDisplayTitle(activeSession, goal.distance, siteLocale)}</h2>
                <p className={styles.subtleInline}>
                  {isGoalEventSession(activeSession)
                    ? `${goalEventDistanceLabel(goal.distance, siteLocale)} · ${siteLocale === "en" ? "race day" : "måldag"}`
                    : formatReadableDurationFromSeconds(activeSessionDuration * 60)}
                </p>
                <div className={styles.workoutCountdownNumber}>{workoutStartCountdown}</div>
              </div>
            )}
            {activeSession && currentStep && !workoutCompleted && workoutStartCountdown === null && (
              <>
                <div className={styles.workoutCompactTopBar}>
                  <button type="button" className={styles.workoutBackBtn} onClick={closeWorkoutSession} aria-label={ui.workout.closeWorkoutAria}>
                    {workoutActionState.closeLabel}
                  </button>
                  <span className={styles.workoutCompactProgress}>{stepIndex + 1} / {activeSession.steps.length}</span>
                </div>
                {workoutInterruptionNotice && <p className={styles.workoutStatusNotice}>{workoutInterruptionNotice}</p>}
                <div className={styles.workoutSessionOverview}>
                  <div className={styles.workoutTopMetrics}>
                    <div className={styles.workoutMetricCard}>
                      <span>{siteLocale === "en" ? "Segment time" : "Segment tid"}</span>
                      <strong>{formatClock(currentStep.durationSec)}</strong>
                    </div>
                    <div className={styles.workoutMetricCard}>
                      <span>{siteLocale === "en" ? "Total elapsed" : "Total tid"}</span>
                      <strong>{formatClock(totalElapsedSec)}</strong>
                    </div>
                  </div>
                  <div className={styles.workoutNextSummary}>
                    <div>
                      <p className={styles.workoutMiniLabel}>{siteLocale === "en" ? "Next" : "Næste"}</p>
                      <h3>{nextWorkoutStep ? phaseName(nextWorkoutStep, siteLocale) : siteLocale === "en" ? "Finish workout" : "Afslut passet"}</h3>
                    </div>
                    <div className={styles.workoutNextMetaGrid}>
                      <span>
                        <small>{siteLocale === "en" ? "Time" : "Tid"}</small>
                        <strong>{nextWorkoutStep ? formatStepDuration(nextWorkoutStep) : "—"}</strong>
                      </span>
                      <span>
                        <small>{siteLocale === "en" ? "Target" : "Målzone"}</small>
                        <strong>{nextWorkoutHeartRateState?.zoneLabel ?? (siteLocale === "en" ? "Easy" : "Roligt")}</strong>
                      </span>
                      <span>
                        <small>{siteLocale === "en" ? "Type" : "Type"}</small>
                        <strong>{nextWorkoutStep ? (stepSupportingLabel(nextWorkoutStep, siteLocale) ?? phaseName(nextWorkoutStep, siteLocale)) : siteLocale === "en" ? "Complete" : "Afslut"}</strong>
                      </span>
                    </div>
                  </div>
                  {activeWorkoutCard?.visualProfile && (
                    <div className={styles.workoutTopProfile}>
                      {activeWorkoutCard.visualProfile.map((segment, index) => {
                        const tone = workoutSegmentAccent(segment);
                        const isCurrentSegment = index === stepIndex;
                        return (
                          <span
                            key={`${activeSession.id}-top-profile-${index}`}
                            className={`${styles.workoutTopProfileSegment} ${isCurrentSegment ? styles.workoutTopProfileSegmentCurrent : ""}`}
                            style={{
                              flexGrow: Math.max(1, segment.durationSec),
                              background: tone.color,
                              boxShadow: isCurrentSegment ? `0 0 0 2px ${tone.muted}` : "none",
                            }}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className={styles.liveWorkoutCard}>
                  {stepNotice && <p className={styles.stepNotice}>{stepNotice}</p>}
                  <div className={styles.trackTimerShell}>
                    <svg viewBox="0 0 280 220" className={styles.trackTimerSvg} aria-hidden="true">
                      <path
                        d="M84 34 H196 A56 56 0 0 1 196 186 H84 A56 56 0 0 1 84 34 Z"
                        pathLength={100}
                        className={styles.trackTimerBase}
                        style={{ stroke: currentWorkoutAccent.muted }}
                      />
                      <path
                        d="M84 34 H196 A56 56 0 0 1 196 186 H84 A56 56 0 0 1 84 34 Z"
                        pathLength={100}
                        className={styles.trackTimerProgress}
                        style={{
                          stroke: currentWorkoutAccent.color,
                          strokeDasharray: `${currentStepProgressPct} 100`,
                        }}
                      />
                    </svg>
                    <div className={styles.trackTimerCenter}>
                      <p className={styles.workoutMiniLabel}>{siteLocale === "en" ? "Current segment" : "Aktuelt trin"}</p>
                      <p className={styles.phaseLabel}>{phaseName(currentStep, siteLocale)}</p>
                      <div className={styles.timerBig}>{formatClock(remainingSec)}</div>
                      <p className={styles.trackTimerZone}>{currentWorkoutHeartRateState?.zoneLabel ?? (siteLocale === "en" ? "Easy effort" : "Roligt arbejde")}</p>
                      {stepSupportingLabel(currentStep, siteLocale) && <p className={styles.trackTimerType}>{stepSupportingLabel(currentStep, siteLocale)}</p>}
                    </div>
                  </div>
                  {isLastWorkoutStep && (
                    <p className={styles.workoutFinalHint}>{siteLocale === "en" ? "Ready to finish the workout." : "Passet er klar til at blive afsluttet."}</p>
                  )}
                </div>

                <div className={styles.workoutPrimaryAction}>
                  {isLastWorkoutStep ? (
                    <button className={styles.completeWorkoutBtn} onClick={nextStep} type="button">
                      {workoutActionState.finishLabel}
                    </button>
                  ) : (
                    <button
                      className={styles.primaryBtn}
                      onClick={() => {
                        setIsRunning((v) => {
                          const next = !v;
                          if (!next) cancelCue();
                          if (next) {
                            setWorkoutInterruptionNotice(null);
                            lastTickAtRef.current = Date.now();
                          }
                          return next;
                        });
                      }}
                    >
                      {workoutActionState.primaryLabel}
                    </button>
                  )}
                  {(!isRunning || isLastWorkoutStep) && (
                    <div className={styles.workoutManualControls}>
                      <div className={`${styles.workoutSecondaryControls} ${stepIndex === 0 ? styles.workoutSecondaryControlsSingle : ""}`}>
                        {stepIndex > 0 && (
                          <button className={styles.workoutSecondaryAction} onClick={previousStep} type="button">
                            {workoutActionState.previousLabel}
                          </button>
                        )}
                        {isLastWorkoutStep ? (
                          <button
                            className={styles.workoutSecondaryAction}
                            onClick={() => {
                              setIsRunning((v) => {
                                const next = !v;
                                if (!next) cancelCue();
                                if (next) {
                                  setWorkoutInterruptionNotice(null);
                                  lastTickAtRef.current = Date.now();
                                }
                                return next;
                              });
                            }}
                            type="button"
                          >
                            {workoutActionState.primaryLabel}
                          </button>
                        ) : (
                          <button className={styles.workoutSecondaryAction} onClick={nextStep} type="button">
                            {workoutActionState.advanceLabel}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
            {activeSession && workoutCompleted && (
              <div className={styles.completedWorkoutCard}>
                <div className={styles.workoutTopBar}>
                  <button type="button" className={styles.workoutBackBtn} onClick={closeWorkoutSession} aria-label={ui.workout.closeWorkoutAria}>
                    {workoutActionState.closeLabel}
                  </button>
                  <div className={styles.workoutHeaderCenter}>
                    <p className={styles.workoutWeekContext}>{sessionWeekBadge(activeSession.week, siteLocale)}</p>
                    <h2 className={styles.workoutHeaderTitle}>{sessionDisplayTitle(activeSession, goal.distance, siteLocale)}</h2>
                  </div>
                  <span className={styles.workoutDurationBadge}>{formatReadableDurationFromSeconds(activeSessionDuration * 60)}</span>
                </div>
                <p className={styles.confirmationBadge}>{ui.workout.completed}</p>
                <h2>{ui.workout.completionTitle}</h2>
                <p className={styles.subtleStrong}>{ui.workout.completionRegistered}</p>
                <p className={styles.subtle}>{ui.workout.completionPrompt}</p>
                <div className={styles.completedWorkoutActions}>
                  <button type="button" className={styles.primaryBtn} onClick={() => setShowWorkoutCheckIn(true)}>
                    {ui.workout.continueToCheckIn}
                  </button>
                </div>
              </div>
            )}
          </article>

          {workoutCompleted && showWorkoutCheckIn && (
            <article className={styles.card}>
              {!feedbackSubmitted ? (
                <div className={styles.feedbackFlow}>
                  <div className={styles.feedbackQuickSection}>
                    <div className={styles.feedbackSectionHeader}>
                      <p className={styles.confirmationBadge}>{ui.workout.quickCheckIn}</p>
                      <h2>{siteLocale === "en" ? "How did the run feel?" : "Hvordan føltes turen?"}</h2>
                      <p className={styles.subtle}>{ui.workout.quickCheckInLead}</p>
                    </div>
                    <div className={styles.quickFeedbackGrid}>
                      {workoutFeelingOptions.map((option) => {
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
                  </div>

                  <div className={styles.feedbackSubmitBar}>
                    <button
                      className={styles.primaryBtn}
                      onClick={submitFeedback}
                      disabled={!activeSession || !workoutCompleted || feedbackSubmitState === "submitting" || !hasRequiredWorkoutFeedback(feedback)}
                    >
                      {feedbackSubmitState === "submitting" && <span className={styles.buttonSpinner} aria-hidden="true" />}
                      {feedbackSubmitState === "submitting"
                        ? ui.program.saving
                        : feedbackSubmitState === "success"
                          ? ui.workout.feedbackSaved
                          : siteLocale === "en"
                            ? "Save and continue"
                            : "Gem og fortsæt"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.confirmationCard}>
                  <p className={styles.confirmationBadge}>{ui.workout.confirmationBadge}</p>
                  <h2>{ui.workout.confirmationTitle}</h2>
                  <p className={styles.subtle}>{ui.workout.confirmationBody}</p>
                  {workoutCheckInMicroCopy && <p className={styles.subtleInline}>{workoutCheckInMicroCopy}</p>}
                  {nextSession ? (
                    <>
                      <p className={styles.nextWorkoutSummary}>{`${ui.workout.nextRunLabel}: ${nextWorkoutDayLabel}`}</p>
                      <p className={styles.subtleStrong}>{nextWorkoutState.title}</p>
                    </>
                  ) : (
                    <p className={styles.nextWorkoutSummary}>{ui.workout.nextRunSoon}</p>
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
                      {ui.workout.seeNextRun}
                    </button>
                  </div>
                </div>
              )}
            </article>
          )}
        </section>
          </div>
        </section>
      )}

      {pendingLowFrequencyOverride && lowFrequencyOverridePrompt && (
        <section className={styles.inlineOverlay}>
          <div className={styles.inlineOverlayBackdrop} onClick={() => setPendingLowFrequencyOverride(null)} />
          <div className={styles.inlineOverlayCard}>
            <p className={styles.nextLabel}>{ui.overlay.important}</p>
            <h3>{lowFrequencyOverridePrompt.title}</h3>
            <p className={styles.subtleInline}>{lowFrequencyOverridePrompt.body}</p>
            <div className={styles.topActions}>
              <button
                className={styles.primaryBtn}
                type="button"
                onClick={() => {
                  setAcceptedLowFrequencyOverrideKey(lowFrequencyOverridePrompt.overrideKey);
                  const pending = pendingLowFrequencyOverride;
                  setPendingLowFrequencyOverride(null);
                  if (pending.intent === "generation") {
                    void generatePlan(pending.selectedRecommendation, { skipLowFrequencyGuardrail: true });
                    return;
                  }
                  void requestPlanRecommendation({ skipLowFrequencyGuardrail: true });
                }}
              >
                {lowFrequencyOverridePrompt.confirmLabel}
              </button>
              <button
                className={styles.secondaryBtn}
                type="button"
                onClick={() => {
                  setPendingLowFrequencyOverride(null);
                  setStage("profile");
                  setOnboardingStep(weeklyStructureStep);
                }}
              >
                {ui.overlay.adjustTrainingDays}
              </button>
            </div>
          </div>
        </section>
      )}

      {pendingDurationOverride && durationOverridePrompt && (
        <section className={styles.inlineOverlay}>
          <div className={styles.inlineOverlayBackdrop} onClick={() => setPendingDurationOverride(null)} />
          <div className={styles.inlineOverlayCard}>
            <p className={styles.nextLabel}>{ui.overlay.important}</p>
            <h3>{durationOverridePrompt.title}</h3>
            <p className={styles.subtleInline}>{durationOverridePrompt.body}</p>
            <div className={styles.topActions}>
              <button
                className={styles.primaryBtn}
                type="button"
                onClick={() => {
                  setAcceptedDurationOverrideKey(durationOverridePrompt.overrideKey);
                  const pending = pendingDurationOverride;
                  setPendingDurationOverride(null);
                  void generatePlan(pending.selectedRecommendation, { skipDurationGuardrail: true });
                }}
              >
                {durationOverridePrompt.confirmLabel}
              </button>
              <button
                className={styles.secondaryBtn}
                type="button"
                onClick={() => {
                  setPendingDurationOverride(null);
                  if (recommendedRecommendationOption) {
                    updateRecommendationDuration(recommendedRecommendationOption.durationWeeks);
                  }
                }}
              >
                {ui.overlay.useRecommendedDuration}
              </button>
            </div>
          </div>
        </section>
      )}

      {(isLoading || isProgramTransitioning) && (
        <section className={styles.loadingHero}>
          <div className={styles.loadingOverlay}>
            <div className={styles.spinner} />
            <p>{isProgramTransitioning ? ui.overlay.building : ui.overlay.assembling}</p>
            <small>{isProgramTransitioning ? ui.overlay.finalSummary : ui.overlay.firstWeeks}</small>
          </div>
        </section>
      )}
      {error && <p className={styles.error}>{error}</p>}
    </main>
  );
}
