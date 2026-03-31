import { WorkoutFeedbackInput, WorkoutStep } from "@/lib/types";

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
  tone: "muted" | "active";
}

export interface WorkoutActionState {
  primaryLabel: string;
  closeLabel: string;
  previousLabel: string;
  advanceLabel: string;
  manualLabel: string;
}

export interface WorkoutCheckInState {
  title: string;
  summary: string;
  optionalLabel: string;
  optionalHint: string;
  submitLabel: string;
}

export function buildWorkoutInterruptionNotice(params: {
  reason: "hidden" | "audio_interrupted";
  secondsAway?: number;
}): string {
  if (params.reason === "audio_interrupted") {
    return "Tale-cues blev afbrudt. Jeg viser resten på skærmen, mens appen er åben.";
  }

  if (params.secondsAway && params.secondsAway >= 10) {
    return `Passet blev sat på pause, mens appen var væk i cirka ${params.secondsAway} sekunder.`;
  }

  return "Passet blev sat på pause, mens appen ikke var synlig.";
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
): string | null {
  if (audioMode === "off") return "Tale-cues er slået fra.";
  if (!ttsSupported) return "Tale-cues er ikke tilgængelige. Jeg viser cues på skærmen.";
  if (!speechEnabled) return "Tryk start, hvis du vil bruge tale-cues under passet.";
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
  nextStepHeartRateDetail,
  cueFallbackText,
  isLastStep,
  audioMode,
  ttsSupported,
  speechEnabled,
}: {
  nextStepTitle?: string | null;
  nextStepDetail?: string | null;
  nextStepHeartRateDetail?: string | null;
  cueFallbackText?: string | null;
  isLastStep: boolean;
  audioMode: WorkoutAudioMode;
  ttsSupported: boolean;
  speechEnabled: boolean;
}): WorkoutCueState {
  if (audioMode !== "off" && cueFallbackText && (!ttsSupported || !speechEnabled)) {
    return {
      label: "Lige efter",
      title: "Cue vises på skærmen",
      detail: cueFallbackText,
      tone: "active",
    };
  }

  if (nextStepTitle && nextStepDetail) {
    return {
      label: "Lige efter",
      title: nextStepTitle,
      detail: nextStepDetail,
      secondaryDetail: nextStepHeartRateDetail ?? undefined,
      tone: "muted",
    };
  }

  if (isLastStep) {
    return {
      label: "Til sidst",
      title: "Du er næsten færdig",
      detail: "Når tiden er færdig, kan du afslutte og sende en hurtig check-in.",
      tone: "muted",
    };
  }

  return {
    label: "Lige efter",
    title: "Fortsæt i samme rytme",
    detail: "Jeg viser næste cue her, når det bliver relevant.",
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

export function buildWorkoutActionState({
  isRunning,
  isLastStep,
}: {
  isRunning: boolean;
  isLastStep: boolean;
}): WorkoutActionState {
  return {
    primaryLabel: isRunning ? "Sæt på pause" : "Start pas",
    closeLabel: "Luk",
    previousLabel: "Forrige del",
    advanceLabel: isLastStep ? "Afslut passet" : "Næste del",
    manualLabel: "Manuelt",
  };
}

export function buildWorkoutCheckInState(showDetailedFeedback: boolean): WorkoutCheckInState {
  return {
    title: "Kort check-in",
    summary: "Et par hurtige svar er nok.",
    optionalLabel: showDetailedFeedback ? "Skjul ekstra detaljer" : "Finjuster eller tilføj note",
    optionalHint: "Det her er kun hvis du vil nuancere passet lidt mere.",
    submitLabel: "Send check-in",
  };
}

export function hasRequiredWorkoutFeedback(feedback: WorkoutFeedbackInput): boolean {
  return Boolean(feedback.quickFeedback) && feedback.completionPct >= 0 && feedback.energy >= 1 && feedback.painLevel >= 1;
}
