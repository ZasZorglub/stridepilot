import { WorkoutFeedbackInput, WorkoutStep } from "@/lib/types";
import { getPulseZoneLegendEntry } from "./profile-settings";
import { SiteLocale } from "./site-variant";

export type WorkoutScreenSectionId =
  | "current_interval"
  | "timer_state"
  | "next_cue"
  | "essential_controls"
  | "full_structure";

export const WORKOUT_SCREEN_SECTION_ORDER: WorkoutScreenSectionId[] = [
  "current_interval",
  "timer_state",
  "next_cue",
  "essential_controls",
  "full_structure",
];

export type WorkoutCheckInSectionId =
  | "completion"
  | "feeling"
  | "signals"
  | "optional_details"
  | "submit";

export const WORKOUT_CHECKIN_SECTION_ORDER: WorkoutCheckInSectionId[] = [
  "completion",
  "feeling",
  "signals",
  "optional_details",
  "submit",
];

export interface VisibleWorkoutStep {
  index: number;
  step: WorkoutStep;
  status: "done" | "current" | "next" | "upcoming";
}

type WorkoutAudioMode = "off" | "short" | "coach";

export interface WorkoutCueState {
  label: string;
  title: string;
  detail: string;
  secondaryDetail?: string;
  tertiaryDetail?: string;
  tone: "muted" | "active";
}

export interface WorkoutActionState {
  primaryLabel: string;
  closeLabel: string;
  previousLabel: string;
  advanceLabel: string;
  manualLabel: string;
  finishLabel: string;
  checkInLabel: string;
}

export interface WorkoutCheckInState {
  title: string;
  summary: string;
  optionalLabel: string;
  optionalHint: string;
  submitLabel: string;
}

export interface WorkoutStepHeartRateState {
  visible: boolean;
  zoneLabel: string;
  rangeLabel: string;
  summary: string;
}

export interface WorkoutStepPulsePresentation {
  headline: string;
  rangeLabel: string | null;
  summary: string | null;
  compactZoneLabel: string | null;
}

function inferredHeartRateGuidance(step: WorkoutStep | null | undefined, locale: SiteLocale = "da"): { zoneLabel: string; summary: string } | null {
  if (!step) return null;
  const identity = `${step.label} ${step.cue}`.toLowerCase();

  if (step.type === "walk") return null;
  if (step.type === "warmup") {
    return {
      zoneLabel: "Zone 1-2",
      summary: locale === "en" ? "Start calmly in zones 1-2." : "Start roligt i zone 1-2.",
    };
  }
  if (step.type === "cooldown") {
    return {
      zoneLabel: "Zone 1-2",
      summary: locale === "en" ? "Let your heart rate come back down toward zones 1-2." : "Lad pulsen falde tilbage mod zone 1-2.",
    };
  }
  if (identity.includes("måldag") || identity.includes("race") || identity.includes("specifik") || identity.includes("tempo")) {
    return {
      zoneLabel: "Zone 3",
      summary: locale === "en" ? "Run at a controlled effort. You should still manage short sentences." : "Løb i kontrolleret tempo. Du skal kunne tale i korte sætninger.",
    };
  }
  if (identity.includes("bakke") || identity.includes("drag") || identity.includes("interval")) {
    return {
      zoneLabel: "Zone 4",
      summary: locale === "en" ? "Work in a controlled way up toward zone 4 during the harder reps." : "Arbejd kontrolleret op mod zone 4 på de hårde drag.",
    };
  }
  if (identity.includes("steady")) {
    return {
      zoneLabel: "Ovre zone 2",
      summary: locale === "en" ? "Aim for the upper end of zone 2." : "Sigt efter ovre zone 2.",
    };
  }
  return {
    zoneLabel: "Zone 2",
    summary: locale === "en" ? "Stay in zone 2." : "Hold dig i zone 2.",
  };
}

function translateHeartRateSummary(summary: string, locale: SiteLocale = "da"): string {
  if (locale !== "en") return summary;
  const normalized = summary.trim();
  if (normalized === "Start roligt i zone 1-2.") return "Start calmly in zones 1-2.";
  if (normalized === "Lad pulsen falde tilbage mod zone 1-2.") return "Let your heart rate come back down toward zones 1-2.";
  if (normalized === "Løb i kontrolleret tempo. Du skal kunne tale i korte sætninger.") return "Run at a controlled effort. You should still manage short sentences.";
  if (normalized === "Arbejd op mod zone 3 med kontrol.") return "Work up toward zone 3 with control.";
  if (normalized === "Arbejd kontrolleret op mod zone 4 på de hårde drag.") return "Work in a controlled way up toward zone 4 during the harder reps.";
  if (normalized === "Sigt efter ovre zone 2.") return "Aim for the upper end of zone 2.";
  if (normalized === "Hold dig i zone 2.") return "Stay in zone 2.";
  return summary;
}

export function buildWorkoutInterruptionNotice(params: {
  reason: "hidden" | "audio_interrupted";
  secondsAway?: number;
  locale?: SiteLocale;
}): string {
  const locale = params.locale ?? "da";
  if (params.reason === "audio_interrupted") {
    return locale === "en" ? "Voice cues were interrupted. I will show the rest on screen while the app stays open." : "Tale-cues blev afbrudt. Jeg viser resten på skærmen, mens appen er åben.";
  }

  if (params.secondsAway && params.secondsAway >= 10) {
    return locale === "en" ? `The workout was paused while the app was away for about ${params.secondsAway} seconds.` : `Passet blev sat på pause, mens appen var væk i cirka ${params.secondsAway} sekunder.`;
  }

  return locale === "en" ? "The workout was paused while the app was not visible." : "Passet blev sat på pause, mens appen ikke var synlig.";
}

function statusForStep(index: number, activeIndex: number, completedSteps: number[]): VisibleWorkoutStep["status"] {
  if (completedSteps.includes(index)) return "done";
  if (index === activeIndex) return "current";
  if (index === activeIndex + 1) return "next";
  return "upcoming";
}

export function getVisibleWorkoutSteps(
  steps: WorkoutStep[],
  activeIndex: number,
  completedSteps: number[],
  expanded: boolean,
): VisibleWorkoutStep[] {
  if (expanded) {
    return steps.map((step, index) => ({
      index,
      step,
      status: statusForStep(index, activeIndex, completedSteps),
    }));
  }

  return steps
    .map((step, index) => ({
      index,
      step,
      status: statusForStep(index, activeIndex, completedSteps),
    }))
    .filter((item) => item.status === "current" || item.status === "next" || item.index === activeIndex + 2 || item.status === "done" && item.index === activeIndex - 1);
}

export function getNextWorkoutStep(steps: WorkoutStep[], activeIndex: number): WorkoutStep | null {
  return steps[activeIndex + 1] ?? null;
}

export function getWorkoutAudioStatus(
  audioMode: WorkoutAudioMode,
  ttsSupported: boolean,
  speechEnabled: boolean,
  locale: SiteLocale = "da",
): string | null {
  if (audioMode === "off") return locale === "en" ? "Voice cues are off." : "Tale-cues er slået fra.";
  if (!ttsSupported) return locale === "en" ? "Voice cues are unavailable. I will show cues on screen." : "Tale-cues er ikke tilgængelige. Jeg viser cues på skærmen.";
  if (!speechEnabled) return locale === "en" ? "Press start if you want voice cues during the workout." : "Tryk start, hvis du vil bruge tale-cues under passet.";
  return null;
}

export function shouldSpeakWorkoutCue(params: {
  isRunning: boolean;
  audioMode: WorkoutAudioMode;
  ttsSupported: boolean;
  speechEnabled: boolean;
}): boolean {
  return params.isRunning && params.audioMode !== "off" && params.ttsSupported && params.speechEnabled;
}

export function buildWorkoutCueState({
  nextStepTitle,
  nextStepDetail,
  nextStepRangeDetail,
  nextStepHeartRateDetail,
  cueFallbackText,
  isLastStep,
  audioMode,
  ttsSupported,
  speechEnabled,
  locale,
}: {
  nextStepTitle?: string | null;
  nextStepDetail?: string | null;
  nextStepRangeDetail?: string | null;
  nextStepHeartRateDetail?: string | null;
  cueFallbackText?: string | null;
  isLastStep: boolean;
  audioMode: WorkoutAudioMode;
  ttsSupported: boolean;
  speechEnabled: boolean;
  locale?: SiteLocale;
}): WorkoutCueState {
  const uiLocale = locale ?? "da";
  if (audioMode !== "off" && cueFallbackText && (!ttsSupported || !speechEnabled)) {
    return {
      label: uiLocale === "en" ? "Coming up" : "Lige efter",
      title: uiLocale === "en" ? "Cue shown on screen" : "Cue vises på skærmen",
      detail: cueFallbackText,
      tone: "active",
    };
  }

  if (nextStepTitle && nextStepDetail) {
    return {
      label: uiLocale === "en" ? "Coming up" : "Lige efter",
      title: nextStepTitle,
      detail: nextStepDetail,
      secondaryDetail: nextStepRangeDetail ?? undefined,
      tertiaryDetail: nextStepHeartRateDetail ?? undefined,
      tone: "muted",
    };
  }

  if (isLastStep) {
    return {
      label: uiLocale === "en" ? "At the end" : "Til sidst",
      title: uiLocale === "en" ? "You are almost done" : "Du er næsten færdig",
      detail: uiLocale === "en" ? "When the time ends, you can finish and send a quick check-in." : "Når tiden er færdig, kan du afslutte og sende en hurtig check-in.",
      tone: "muted",
    };
  }

  return {
    label: uiLocale === "en" ? "Coming up" : "Lige efter",
    title: uiLocale === "en" ? "Keep the same rhythm" : "Fortsæt i samme rytme",
    detail: uiLocale === "en" ? "I will show the next cue here when it becomes relevant." : "Jeg viser næste cue her, når det bliver relevant.",
    tone: "muted",
  };
}

export function getWorkoutHeartRateGuidance(
  step: WorkoutStep | null | undefined,
  pulseGuidanceEnabled: boolean,
): string | null {
  if (!pulseGuidanceEnabled || !step?.heartRateGuidance?.summary) return null;
  return step.heartRateGuidance.summary;
}

export function buildWorkoutStepHeartRateState(params: {
  step: WorkoutStep | null | undefined;
  pulseGuidanceEnabled: boolean;
  maxHeartRate: number | null;
  locale?: SiteLocale;
}): WorkoutStepHeartRateState | null {
  if (!params.pulseGuidanceEnabled) return null;
  const locale = params.locale ?? "da";
  const guidance =
    params.step?.heartRateGuidance?.zoneLabel && params.step.heartRateGuidance.summary
      ? { ...params.step.heartRateGuidance, summary: translateHeartRateSummary(params.step.heartRateGuidance.summary, locale) }
      : inferredHeartRateGuidance(params.step, locale);
  if (!guidance) return null;
  const entry = getPulseZoneLegendEntry(guidance.zoneLabel, params.maxHeartRate);
  if (!entry) return null;
  return {
    visible: true,
    zoneLabel: entry.zoneLabel,
    rangeLabel: entry.rangeLabel,
    summary: guidance.summary,
  };
}

export function buildWorkoutStepPulsePresentation(params: {
  step: WorkoutStep | null | undefined;
  phaseLabel: string;
  durationLabel: string;
  pulseGuidanceEnabled: boolean;
  maxHeartRate: number | null;
  locale?: SiteLocale;
}): WorkoutStepPulsePresentation {
  const heartRateState = buildWorkoutStepHeartRateState({
    step: params.step,
    pulseGuidanceEnabled: params.pulseGuidanceEnabled,
    maxHeartRate: params.maxHeartRate,
    locale: params.locale,
  });
  return {
    headline: `${params.phaseLabel} · ${params.durationLabel}${heartRateState ? ` · ${heartRateState.zoneLabel}` : ""}`,
    rangeLabel: heartRateState?.rangeLabel ?? null,
    summary: heartRateState?.summary ?? null,
    compactZoneLabel: heartRateState?.zoneLabel ?? null,
  };
}

export function buildWorkoutActionState({
  isRunning,
  isLastStep,
  locale,
}: {
  isRunning: boolean;
  isLastStep: boolean;
  locale?: SiteLocale;
}): WorkoutActionState {
  const uiLocale = locale ?? "da";
  return {
    primaryLabel: isRunning ? (uiLocale === "en" ? "Pause" : "Sæt på pause") : (uiLocale === "en" ? "Resume" : "Fortsæt"),
    closeLabel: uiLocale === "en" ? "Close" : "Luk",
    previousLabel: uiLocale === "en" ? "Previous" : "Forrige",
    advanceLabel: isLastStep ? (uiLocale === "en" ? "Finish run" : "Afslut tur") : (uiLocale === "en" ? "Next" : "Næste"),
    manualLabel: uiLocale === "en" ? "Controls" : "Kontroller",
    finishLabel: uiLocale === "en" ? "Finish run" : "Afslut tur",
    checkInLabel: uiLocale === "en" ? "Check-in" : "Check-in",
  };
}

export function buildWorkoutCheckInState(showDetailedFeedback: boolean, locale: SiteLocale = "da"): WorkoutCheckInState {
  return {
    title: locale === "en" ? "Quick check-in" : "Kort check-in",
    summary: locale === "en" ? "A few quick answers are enough." : "Et par hurtige svar er nok.",
    optionalLabel: showDetailedFeedback
      ? locale === "en"
        ? "Hide extra details"
        : "Skjul ekstra detaljer"
      : locale === "en"
        ? "Fine-tune or add a note"
        : "Finjuster eller tilføj note",
    optionalHint: locale === "en"
      ? "Only use this if you want to add a little more nuance."
      : "Det her er kun hvis du vil nuancere passet lidt mere.",
    submitLabel: locale === "en" ? "Send check-in" : "Send check-in",
  };
}

export function hasRequiredWorkoutFeedback(feedback: WorkoutFeedbackInput): boolean {
  return Boolean(feedback.quickFeedback) && feedback.completionPct >= 0 && feedback.energy >= 1 && feedback.painLevel >= 1;
}
