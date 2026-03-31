import assert from "node:assert/strict";

import {
  buildWorkoutActionState,
  buildWorkoutCheckInState,
  buildWorkoutCueState,
  buildWorkoutInterruptionNotice,
  getWorkoutHeartRateGuidance,
  getNextWorkoutStep,
  getWorkoutAudioStatus,
  WORKOUT_CHECKIN_SECTION_ORDER,
  getVisibleWorkoutSteps,
  hasRequiredWorkoutFeedback,
  shouldSpeakWorkoutCue,
  WORKOUT_SCREEN_SECTION_ORDER,
} from "../src/lib/workout-screen";
import { expandStructure, segmentHeartRateGuidance } from "../src/lib/coach/mapToAppPlan";

const steps = [
  { type: "warmup", label: "Warmup", durationSec: 300, cue: "Roligt i gang" },
  { type: "run", label: "Run 1", durationSec: 180, cue: "Stabil rytme" },
  { type: "walk", label: "Walk", durationSec: 90, cue: "Tag luft ind" },
  { type: "run", label: "Run 2", durationSec: 180, cue: "Find fart igen" },
  { type: "cooldown", label: "Cooldown", durationSec: 240, cue: "Ro på" },
] as const;

assert.deepEqual(
  WORKOUT_SCREEN_SECTION_ORDER,
  ["current_interval", "timer_state", "next_cue", "essential_controls", "full_structure"],
  "workout screen should keep the live-first hierarchy",
);

assert.deepEqual(
  WORKOUT_CHECKIN_SECTION_ORDER,
  ["completion", "feeling", "signals", "optional_details", "submit"],
  "check-in should prioritize essential signals before optional details",
);

assert.equal(
  getNextWorkoutStep(steps as never, 1)?.label,
  "Walk",
  "next cue helper should expose the next relevant interval",
);

const activeCueState = buildWorkoutCueState({
  nextStepTitle: "Gang",
  nextStepDetail: "1:30 · Tag luft ind",
  nextStepHeartRateDetail: null,
  cueFallbackText: null,
  isLastStep: false,
  audioMode: "coach",
  ttsSupported: true,
  speechEnabled: true,
});
assert.deepEqual(
  activeCueState,
  {
    label: "Lige efter",
    title: "Gang",
    detail: "1:30 · Tag luft ind",
    secondaryDetail: undefined,
    tone: "muted",
  },
  "next cue state should stay concise and secondary when speech works normally",
);

const fallbackCueState = buildWorkoutCueState({
  nextStepTitle: "Løb",
  nextStepDetail: "3:00 · Stabil rytme",
  nextStepHeartRateDetail: "Sigt efter ovre zone 2.",
  cueFallbackText: "Find rytmen igen",
  isLastStep: false,
  audioMode: "coach",
  ttsSupported: false,
  speechEnabled: false,
});
assert.equal(fallbackCueState.tone, "active", "fallback cue should surface more clearly when speech is unavailable");

assert.equal(
  getWorkoutHeartRateGuidance(
    {
      type: "run",
      label: "Roligt løb",
      durationSec: 1800,
      cue: "Løb roligt og kontrolleret.",
      heartRateGuidance: { zoneLabel: "Zone 2", summary: "Hold dig i zone 2." },
    },
    true,
  ),
  "Hold dig i zone 2.",
  "heart-rate guidance should appear when pulse guidance is enabled",
);
assert.equal(
  getWorkoutHeartRateGuidance(
    {
      type: "run",
      label: "Roligt løb",
      durationSec: 1800,
      cue: "Løb roligt og kontrolleret.",
      heartRateGuidance: { zoneLabel: "Zone 2", summary: "Hold dig i zone 2." },
    },
    false,
  ),
  null,
  "heart-rate guidance should stay hidden when pulse guidance is disabled",
);

assert.equal(
  getWorkoutAudioStatus("coach", true, true),
  null,
  "supported speech should not add extra status noise once the workout is live",
);
assert.equal(
  getWorkoutAudioStatus("off", true, false),
  "Tale-cues er slået fra.",
  "audio status should stay explicit when cues are off",
);
assert.equal(
  shouldSpeakWorkoutCue({
    isRunning: false,
    audioMode: "coach",
    ttsSupported: true,
    speechEnabled: true,
  }),
  false,
  "the first cue should not be marked as spoken before the user actually starts the workout",
);
assert.equal(
  shouldSpeakWorkoutCue({
    isRunning: true,
    audioMode: "coach",
    ttsSupported: true,
    speechEnabled: true,
  }),
  true,
  "tapping Start pas should immediately allow the active cue to begin",
);

assert.deepEqual(
  buildWorkoutActionState({ isRunning: false, isLastStep: false }),
  {
    primaryLabel: "Start pas",
    closeLabel: "Luk",
    previousLabel: "Forrige del",
    advanceLabel: "Næste del",
    manualLabel: "Manuelt",
  },
  "pre-start state should keep one clear primary action and softer manual controls",
);

assert.equal(
  buildWorkoutActionState({ isRunning: true, isLastStep: true }).advanceLabel,
  "Afslut passet",
  "last step state should make completion explicit",
);

assert.deepEqual(
  buildWorkoutCheckInState(false),
  {
    title: "Kort check-in",
    summary: "Et par hurtige svar er nok.",
    optionalLabel: "Finjuster eller tilføj note",
    optionalHint: "Det her er kun hvis du vil nuancere passet lidt mere.",
    submitLabel: "Send check-in",
  },
  "default check-in state should stay short and clearly separate optional details",
);

assert.equal(
  buildWorkoutCheckInState(true).optionalLabel,
  "Skjul ekstra detaljer",
  "optional detail area should remain collapsible after opening",
);

assert.equal(
  buildWorkoutInterruptionNotice({ reason: "hidden" }),
  "Passet blev sat på pause, mens appen ikke var synlig.",
  "background interruptions should be explained honestly",
);

assert.equal(
  buildWorkoutInterruptionNotice({ reason: "hidden", secondsAway: 23 }),
  "Passet blev sat på pause, mens appen var væk i cirka 23 sekunder.",
  "resume notice should stay specific when the interruption was longer",
);

assert.equal(
  buildWorkoutInterruptionNotice({ reason: "audio_interrupted" }),
  "Tale-cues blev afbrudt. Jeg viser resten på skærmen, mens appen er åben.",
  "audio interruptions should fall back to on-screen guidance without pretending background audio works",
);

const compactSteps = getVisibleWorkoutSteps(steps as never, 1, [0], false);
assert.deepEqual(
  compactSteps.map((entry) => ({ label: entry.step.label, status: entry.status })),
  [
    { label: "Warmup", status: "done" },
    { label: "Run 1", status: "current" },
    { label: "Walk", status: "next" },
    { label: "Run 2", status: "upcoming" },
  ],
  "collapsed workout structure should emphasize current, next, and only the nearest context",
);

const expandedSteps = getVisibleWorkoutSteps(steps as never, 1, [0], true);
assert.equal(expandedSteps.length, steps.length, "expanded workout structure should still expose the full interval list");

assert.deepEqual(
  segmentHeartRateGuidance({ type: "steady", label: "Roligt løb", durationMin: 28 }),
  {
    zoneLabel: "Ovre zone 2",
    summary: "Sigt efter ovre zone 2.",
  },
  "easy and steady running should get calm upper-zone-2 guidance",
);

const continuousRunSteps = expandStructure([
  { type: "warmup", label: "Rask gang", durationMin: 5 },
  { type: "steady", label: "Roligt løb", durationMin: 28 },
  { type: "cooldown", label: "Nedkøling", durationMin: 4 },
]);
assert.deepEqual(
  continuousRunSteps.map((step) => step.heartRateGuidance?.summary ?? null),
  ["Start roligt i zone 1-2.", "Sigt efter ovre zone 2.", "Lad pulsen falde tilbage mod zone 1-2."],
  "continuous sessions should expose sensible secondary heart-rate guidance per phase",
);

const intervalSteps = expandStructure([
  { type: "warmup", label: "Opvarmning", durationMin: 8 },
  { type: "tempo", label: "Tempoblok", durationMin: 5, repeats: 2, recoverMin: 2 },
  { type: "cooldown", label: "Nedjog", durationMin: 6 },
]);
assert.deepEqual(
  intervalSteps.map((step) => ({ type: step.type, hr: step.heartRateGuidance?.summary ?? null })),
  [
    { type: "warmup", hr: "Start roligt i zone 1-2." },
    { type: "run", hr: "Arbejd op mod zone 3 med kontrol." },
    { type: "walk", hr: null },
    { type: "run", hr: "Arbejd op mod zone 3 med kontrol." },
    { type: "cooldown", hr: "Lad pulsen falde tilbage mod zone 1-2." },
  ],
  "interval sessions should keep their structure and add secondary heart-rate guidance without taking over the workout logic",
);

assert.equal(
  hasRequiredWorkoutFeedback({
    quickFeedback: "good",
    effort: 5,
    completionPct: 100,
    energy: 4,
    painLevel: 1,
    notes: "",
  }),
  true,
  "quick check-in path should remain valid when the required deterministic fields are present",
);

assert.equal(
  hasRequiredWorkoutFeedback({
    effort: 5,
    completionPct: 100,
    energy: 0,
    painLevel: 1,
    notes: "",
  } as never),
  false,
  "missing quick feedback or invalid quick signals should block submission",
);

console.log("workout screen hierarchy tests passed");
