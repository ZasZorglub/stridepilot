"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WORKOUT_CHECKIN_SECTION_ORDER = exports.WORKOUT_SCREEN_SECTION_ORDER = void 0;
exports.buildWorkoutInterruptionNotice = buildWorkoutInterruptionNotice;
exports.getVisibleWorkoutSteps = getVisibleWorkoutSteps;
exports.getNextWorkoutStep = getNextWorkoutStep;
exports.getWorkoutAudioStatus = getWorkoutAudioStatus;
exports.shouldSpeakWorkoutCue = shouldSpeakWorkoutCue;
exports.buildWorkoutCueState = buildWorkoutCueState;
exports.getWorkoutHeartRateGuidance = getWorkoutHeartRateGuidance;
exports.buildWorkoutActionState = buildWorkoutActionState;
exports.buildWorkoutCheckInState = buildWorkoutCheckInState;
exports.hasRequiredWorkoutFeedback = hasRequiredWorkoutFeedback;
exports.WORKOUT_SCREEN_SECTION_ORDER = [
    "current_interval",
    "timer_state",
    "next_cue",
    "essential_controls",
    "full_structure",
];
exports.WORKOUT_CHECKIN_SECTION_ORDER = [
    "completion",
    "feeling",
    "signals",
    "optional_details",
    "submit",
];
function buildWorkoutInterruptionNotice(params) {
    if (params.reason === "audio_interrupted") {
        return "Tale-cues blev afbrudt. Jeg viser resten på skærmen, mens appen er åben.";
    }
    if (params.secondsAway && params.secondsAway >= 10) {
        return `Passet blev sat på pause, mens appen var væk i cirka ${params.secondsAway} sekunder.`;
    }
    return "Passet blev sat på pause, mens appen ikke var synlig.";
}
function statusForStep(index, activeIndex, completedSteps) {
    if (completedSteps.includes(index))
        return "done";
    if (index === activeIndex)
        return "current";
    if (index === activeIndex + 1)
        return "next";
    return "upcoming";
}
function getVisibleWorkoutSteps(steps, activeIndex, completedSteps, expanded) {
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
function getNextWorkoutStep(steps, activeIndex) {
    return steps[activeIndex + 1] ?? null;
}
function getWorkoutAudioStatus(audioMode, ttsSupported, speechEnabled) {
    if (audioMode === "off")
        return "Tale-cues er slået fra.";
    if (!ttsSupported)
        return "Tale-cues er ikke tilgængelige. Jeg viser cues på skærmen.";
    if (!speechEnabled)
        return "Tryk start, hvis du vil bruge tale-cues under passet.";
    return null;
}
function shouldSpeakWorkoutCue(params) {
    return params.isRunning && params.audioMode !== "off" && params.ttsSupported && params.speechEnabled;
}
function buildWorkoutCueState({ nextStepTitle, nextStepDetail, nextStepHeartRateDetail, cueFallbackText, isLastStep, audioMode, ttsSupported, speechEnabled, }) {
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
function getWorkoutHeartRateGuidance(step, pulseGuidanceEnabled) {
    if (!pulseGuidanceEnabled || !step?.heartRateGuidance?.summary)
        return null;
    return step.heartRateGuidance.summary;
}
function buildWorkoutActionState({ isRunning, isLastStep, }) {
    return {
        primaryLabel: isRunning ? "Sæt på pause" : "Start pas",
        closeLabel: "Luk",
        previousLabel: "Forrige del",
        advanceLabel: isLastStep ? "Afslut passet" : "Næste del",
        manualLabel: "Manuelt",
    };
}
function buildWorkoutCheckInState(showDetailedFeedback) {
    return {
        title: "Kort check-in",
        summary: "Et par hurtige svar er nok.",
        optionalLabel: showDetailedFeedback ? "Skjul ekstra detaljer" : "Finjuster eller tilføj note",
        optionalHint: "Det her er kun hvis du vil nuancere passet lidt mere.",
        submitLabel: "Send check-in",
    };
}
function hasRequiredWorkoutFeedback(feedback) {
    return Boolean(feedback.quickFeedback) && feedback.completionPct >= 0 && feedback.energy >= 1 && feedback.painLevel >= 1;
}
