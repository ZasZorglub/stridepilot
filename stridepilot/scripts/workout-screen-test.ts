import assert from "node:assert/strict";
import fs from "node:fs";

import {
  buildWorkoutActionState,
  buildWorkoutCheckInState,
  buildWorkoutCueState,
  buildWorkoutStepPulsePresentation,
  buildWorkoutStepHeartRateState,
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
import { buildFeedbackResponseCopy } from "../src/lib/coach/explanations";
import { benchmarkReportFixtures, buildBenchmarkReport } from "../src/lib/coach/benchmarkReports";
import { expandStructure, segmentHeartRateGuidance } from "../src/lib/coach/mapToAppPlan";
import { applyPlanSafety } from "../src/lib/plan-safety";
import { sumWorkoutStepDurationSec, summarizeWorkoutSteps } from "../src/lib/plan-safety";
import { buildWeeklyLoad, generateFallbackPlan } from "../src/lib/plan";
import type { Goal, RunnerProfile, TrainingPlan } from "../src/lib/types";

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
  nextStepRangeDetail: null,
  nextStepHeartRateDetail: null,
  cueFallbackText: null,
  isLastStep: false,
  audioMode: "coach",
  ttsSupported: true,
  speechEnabled: true,
  locale: "en",
});
assert.deepEqual(
  activeCueState,
  {
    label: "Coming up",
    title: "Gang",
    detail: "1:30 · Tag luft ind",
    secondaryDetail: undefined,
    tertiaryDetail: undefined,
    tone: "muted",
  },
  "next cue state should stay concise and secondary when speech works normally",
);

const fallbackCueState = buildWorkoutCueState({
  nextStepTitle: "Løb",
  nextStepDetail: "3:00 · Stabil rytme",
  nextStepRangeDetail: null,
  nextStepHeartRateDetail: "Sigt efter ovre zone 2.",
  cueFallbackText: "Find rytmen igen",
  isLastStep: false,
  audioMode: "coach",
  ttsSupported: false,
  speechEnabled: false,
  locale: "en",
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
  getWorkoutAudioStatus("off", true, false, "en"),
  "Voice cues are off.",
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
  buildWorkoutActionState({ isRunning: false, isLastStep: false, locale: "en" }),
  {
    primaryLabel: "Start workout",
    closeLabel: "Close",
    previousLabel: "Previous interval",
    advanceLabel: "Next interval",
    manualLabel: "Manual",
  },
  "pre-start state should keep one clear primary action and softer manual controls",
);

assert.equal(
  buildWorkoutActionState({ isRunning: true, isLastStep: true, locale: "en" }).advanceLabel,
  "Finish workout",
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
assert.deepEqual(
  buildWorkoutCheckInState(false, "en"),
  {
    title: "Quick check-in",
    summary: "A few quick answers are enough.",
    optionalLabel: "Fine-tune or add a note",
    optionalHint: "Only use this if you want to add a little more nuance.",
    submitLabel: "Send check-in",
  },
  "English beta locale should expose calm, natural workout check-in copy",
);

assert.equal(
  buildWorkoutCheckInState(true).optionalLabel,
  "Skjul ekstra detaljer",
  "optional detail area should remain collapsible after opening",
);

assert.equal(
  buildWorkoutInterruptionNotice({ reason: "hidden", locale: "en" }),
  "The workout was paused while the app was not visible.",
  "background interruptions should be explained honestly",
);

assert.equal(
  buildWorkoutInterruptionNotice({ reason: "hidden", secondsAway: 23, locale: "en" }),
  "The workout was paused while the app was away for about 23 seconds.",
  "resume notice should stay specific when the interruption was longer",
);

assert.equal(
  buildWorkoutInterruptionNotice({ reason: "audio_interrupted", locale: "en" }),
  "Voice cues were interrupted. I will show the rest on screen while the app stays open.",
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
const workoutZoneState = buildWorkoutStepHeartRateState({
  step: continuousRunSteps[1] as never,
  pulseGuidanceEnabled: true,
  maxHeartRate: 190,
  locale: "en",
});
assert.equal(workoutZoneState?.visible, true, "pulse-guided workouts should expose interval-level pulse guidance");
assert.equal(workoutZoneState?.zoneLabel, "Ovre zone 2", "the current interval should surface its own target zone");
assert.match(workoutZoneState?.rangeLabel ?? "", /bpm/, "known max pulse should turn zone guidance into usable bpm ranges");
assert.equal(workoutZoneState?.summary, "Aim for the upper end of zone 2.");

const inferredGoalDayPulseState = buildWorkoutStepHeartRateState({
  step: {
    type: "run",
    label: "Maraton måldag",
    durationSec: 12600,
    cue: "Start kontrolleret og find rytmen tidligt.",
  },
  pulseGuidanceEnabled: true,
  maxHeartRate: null,
  locale: "en",
});
assert.equal(inferredGoalDayPulseState?.zoneLabel, "Zone 3", "goal-event intervals without embedded pulse metadata should still infer a useful target zone on the live workout screen");
assert.match(inferredGoalDayPulseState?.rangeLabel ?? "", /% af makspuls/, "live fallback guidance should still expose a percent-based range when max pulse is missing");

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

const nextCueWithPulse = buildWorkoutCueState({
  nextStepTitle: "Løb",
  nextStepDetail: "42,5 min · Zone 3",
  nextStepRangeDetail: "156-167 bpm",
  nextStepHeartRateDetail: "Arbejd op mod zone 3 med kontrol.",
  cueFallbackText: null,
  isLastStep: false,
  audioMode: "coach",
  ttsSupported: true,
  speechEnabled: true,
  locale: "en",
});
assert.equal(nextCueWithPulse.secondaryDetail, "156-167 bpm", "next cue should show the interval-specific pulse range");
assert.equal(nextCueWithPulse.tertiaryDetail, "Arbejd op mod zone 3 med kontrol.", "next cue should keep the coaching guidance tied to the upcoming interval");

const currentIntervalPresentation = buildWorkoutStepPulsePresentation({
  step: {
    type: "run",
    label: "Løb",
    durationSec: 2550,
    cue: "Løb i kontrolleret tempo.",
    heartRateGuidance: { zoneLabel: "Zone 3", summary: "Løb i kontrolleret tempo. Du skal kunne tale i korte sætninger." },
  },
  phaseLabel: "Løb",
  durationLabel: "42,5 min",
  pulseGuidanceEnabled: true,
  maxHeartRate: 190,
  locale: "en",
});
assert.equal(currentIntervalPresentation.headline, "Løb · 42,5 min · Zone 3");
assert.match(currentIntervalPresentation.rangeLabel ?? "", /156-167 bpm|82-88 % af makspuls/);
assert.equal(currentIntervalPresentation.summary, "Run at a controlled effort. You should still manage short sentences.");

const overviewIntervalPresentation = buildWorkoutStepPulsePresentation({
  step: {
    type: "cooldown",
    label: "Nedkøling",
    durationSec: 180,
    cue: "Lad pulsen falde.",
    heartRateGuidance: { zoneLabel: "Zone 1-2", summary: "Lad pulsen falde tilbage mod zone 1-2." },
  },
  phaseLabel: "Nedkøling",
  durationLabel: "3 min",
  pulseGuidanceEnabled: true,
  maxHeartRate: null,
  locale: "en",
});
assert.equal(overviewIntervalPresentation.compactZoneLabel, "Zone 1-2", "interval overview should expose a compact zone label when pulse guidance exists");

const pageSource = fs.readFileSync("/Users/anderschristiansloth/Documents/Playground/stridepilot/src/app/page.tsx", "utf8");
assert.equal(
  pageSource.includes("Pulszoner i dette pas"),
  false,
  "the live workout render path should no longer mount the generic pulse-zone block",
);
assert.match(
  pageSource,
  /ui\.workout\.coachResponse|ui\.workout\.yourFeedback|ui\.workout\.completionQuestion/,
  "the live workout render path should now pull trust-critical English labels through the shared locale-aware UI copy",
);
assert.match(
  pageSource,
  /Height \(cm\)|Weight \(kg\)|Gender \(optional\)|Recent relevant result or PR|The rest is only for fine-tuning/,
  "the final English beta pass should localize the remaining extra-profile onboarding strings on the .eu path",
);
assert.match(
  pageSource,
  /Edit profile and goal|Appearance|Dark|Voice cues/,
  "the final English beta pass should localize the remaining menu and settings strings on the .eu path",
);
assert.match(
  pageSource,
  /5 km without stopping|Recommended route|Use this plan|Easy run|Build week|Rest/,
  "the final English beta pass should cover the remaining surfaced onboarding, recommendation, and plan-workout strings on the .eu path",
);
assert.equal(
  pageSource.includes('siteLocale === "en" ? "goal day"'),
  false,
  "English-facing goal-event surfaces should no longer use the old goal day wording",
);
const englishCoachResponse = buildFeedbackResponseCopy({
  rationale: {
    mode: "hold",
    reason: "Passet ser samlet set ud til at passe godt ind i planen.",
    changeSummary: ["Næste uge holder samme overordnede struktur som før."],
    learnedTendencies: ["Du har håndteret den seneste progression stabilt, så planen kan bygge lidt mere tillidsfuldt videre."],
    runnerFocus: "Fokus nu er at fortsætte stabilt og lade kontinuiteten arbejde for dig.",
  },
  feedback: {
    quickFeedback: "good",
    completionPct: 100,
    effort: 6,
    energy: 3,
    painLevel: 1,
  },
  locale: "en",
});
assert.equal(englishCoachResponse.interpretation, "Overall, the session looks like it fit the plan well.");
assert.equal(englishCoachResponse.adjustmentExplanation, "Next week keeps the same overall structure as before.");
assert.equal(englishCoachResponse.runnerFocus, "The focus now is to continue steadily and let consistency work for you.");
assert.equal(
  englishCoachResponse.learnedInsights[0],
  "You have handled the recent progression steadily, so the plan can build a little more confidently.",
  "English-facing coach explanation outputs should no longer leak Danish on the .eu path",
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

const normalFinalSessionPlan: TrainingPlan = {
  summary: "Test",
  weeks: 4,
  sessionsPerWeek: 3,
  sessions: [
    { id: "s-1", title: "Roligt løb", week: 4, dayOfWeek: "Mandag", loadScore: 4, steps: [{ type: "warmup", label: "Warmup", durationSec: 300, cue: "" }, { type: "run", label: "Roligt løb", durationSec: 1200, cue: "" }, { type: "cooldown", label: "Cooldown", durationSec: 240, cue: "" }] },
    { id: "s-2", title: "Recovery-pas", week: 4, dayOfWeek: "Onsdag", loadScore: 2, steps: [{ type: "warmup", label: "Warmup", durationSec: 300, cue: "" }, { type: "run", label: "Recovery", durationSec: 900, cue: "" }, { type: "cooldown", label: "Cooldown", durationSec: 240, cue: "" }] },
    { id: "s-3", title: "Roligt løb", week: 4, dayOfWeek: "Fredag", loadScore: 4, steps: [{ type: "warmup", label: "Warmup", durationSec: 300, cue: "" }, { type: "run", label: "Roligt løb", durationSec: 1200, cue: "" }, { type: "cooldown", label: "Cooldown", durationSec: 240, cue: "" }] },
  ],
};
const marathonGoal: Goal = {
  distance: "Marathon",
  goalType: "complete",
  weeks: 4,
  startDate: "2026-03-30",
  endDate: "2026-04-26",
};
assert.equal(
  applyPlanSafety({ plan: normalFinalSessionPlan, goal: marathonGoal, recentFeedback: [] }).plan.sessions.at(-1)?.title,
  "Roligt løb",
  "an ordinary training session should not be relabeled as marathon goal day just because the overall goal is a marathon",
);

const actualGoalSessionPlan: TrainingPlan = {
  ...normalFinalSessionPlan,
  sessions: [
    ...normalFinalSessionPlan.sessions.slice(0, 2),
    {
      id: "goal-day",
      title: "Maraton måldag",
      week: 4,
      dayOfWeek: "Sondag",
      loadScore: 6,
      notes: "Måldag — Maraton som afslutning på forløbet.",
      steps: [{ type: "warmup", label: "Warmup", durationSec: 300, cue: "" }, { type: "run", label: "Maraton måldag", durationSec: 7200, cue: "" }, { type: "cooldown", label: "Cooldown", durationSec: 240, cue: "" }],
    },
  ],
};
assert.match(
  applyPlanSafety({ plan: actualGoalSessionPlan, goal: marathonGoal, recentFeedback: [] }).plan.sessions.find((session) => session.id === "goal-day")?.title ?? "",
  /Måldag|måldag/,
  "a genuine goal-day session should still keep its goal-day identity",
);

const collapsedGoalSessionPlan: TrainingPlan = {
  ...normalFinalSessionPlan,
  sessions: [
    {
      id: "peak-long",
      title: "Langt roligt pas",
      week: 3,
      dayOfWeek: "Sondag",
      loadScore: 7,
      steps: [
        { type: "warmup", label: "Warmup", durationSec: 420, cue: "" },
        { type: "run", label: "Lang rolig blok", durationSec: 7200, cue: "" },
        { type: "cooldown", label: "Cooldown", durationSec: 300, cue: "" },
      ],
    },
    {
      id: "goal-collapse",
      title: "Maraton måldag",
      week: 4,
      dayOfWeek: "Sondag",
      loadScore: 4,
      notes: "Måldag — Maraton som afslutning på forløbet.",
      steps: [
        { type: "warmup", label: "Warmup", durationSec: 420, cue: "" },
        { type: "run", label: "Maraton måldag", durationSec: 1200, cue: "" },
        { type: "cooldown", label: "Cooldown", durationSec: 180, cue: "" },
        { type: "walk", label: "Rolig afslutning", durationSec: 120, cue: "" },
      ],
    },
  ],
};
const repairedGoalSession = applyPlanSafety({ plan: collapsedGoalSessionPlan, goal: marathonGoal, recentFeedback: [] }).plan.sessions.find((session) => session.id === "goal-collapse");
assert.ok(repairedGoalSession, "collapsed marathon goal-day session should still exist after safety repair");
assert.match(repairedGoalSession?.title ?? "", /Måldag|måldag/, "a repaired goal-event session should keep its goal-day label");
assert.ok(
  (repairedGoalSession?.steps.filter((step) => step.type === "run").reduce((sum, step) => sum + step.durationSec, 0) ?? 0) / 60 >= 90,
  "long-distance goal-event sessions should not collapse into implausibly short workouts",
);

const profile50Fixture = benchmarkReportFixtures.find((fixture) => fixture.profileId === "profile-50");
assert.ok(profile50Fixture, "profile-50 benchmark fixture should exist");
const profile50Report = buildBenchmarkReport(profile50Fixture!);
const profile50GoalSession = profile50Report.weeks.at(-1)?.sessions.find((session) => /måldag/i.test(session.sessionLabel));
assert.ok(profile50GoalSession, "profile-50-like benchmark export should preserve an explicit goal-event session");
assert.ok(
  Math.abs(profile50GoalSession!.durationMin - sumWorkoutStepDurationSec(profile50GoalSession!.steps) / 60) <= 0.5,
  "benchmark session duration should match the summed step duration within a tight tolerance",
);
assert.equal(
  profile50GoalSession?.structureSummary,
  summarizeWorkoutSteps(profile50GoalSession?.steps ?? []),
  "benchmark structure summary should be derived from the same actual steps shown to the user",
);
assert.ok(
  (profile50GoalSession?.steps.filter((step) => step.type === "run").reduce((sum, step) => sum + step.durationSec, 0) ?? 0) / 60 >= 175,
  "profile-50-like long-distance goal-event sessions should read like a real event, not a short benchmark workout",
);
assert.match(
  profile50GoalSession?.steps.find((step) => step.type === "run")?.heartRateGuidance?.zoneLabel ?? "",
  /Zone 3/,
  "goal-event run steps should carry interval-level pulse guidance directly on the step data",
);

const profile14Fixture = benchmarkReportFixtures.find((fixture) => fixture.profileId === "profile-14");
assert.ok(profile14Fixture, "profile-14 benchmark fixture should exist");
const profile14Report = buildBenchmarkReport(profile14Fixture);
const profile14GoalSession = profile14Report.weeks.at(-1)?.sessions.find((session) => /måldag/i.test(session.sessionLabel));
assert.ok(profile14GoalSession, "profile-14-like benchmark export should preserve a goal-event session");
assert.ok(
  (profile14GoalSession?.steps.filter((step) => step.type === "run").reduce((sum, step) => sum + step.durationSec, 0) ?? 0) / 60 >= 175,
  "marathon goal-day sessions should no longer be modeled as 97-minute workouts",
);

const marathonMidBlockProfile: RunnerProfile = {
  firstName: "Rasmus",
  heightCm: 182,
  weightKg: 76,
  age: 39,
  activityLevel: "høj",
  runningExperience: "ovet",
  currentRunningAbility: "mere_end_tredive_min",
  userTrainingContext: "Vil gerne have rolig men troværdig maratonopbygning.",
  currentWeeklyVolumeKm: 42,
  currentRunsPerWeek: 4,
  longestCurrentRunMin: 92,
  recentRaceTimes: [{ distance: "Halvmaraton", time: "1:45:00" }],
  injuryHistory: "",
  weakPoints: "",
  realisticTrainingDaysPerWeek: 4,
  typicalWorkoutMinutes: 70,
  otherTraining: "",
  preferredGuidance: "flexible",
};
const marathonMidBlockGoal: Goal = {
  distance: "Marathon",
  goalType: "complete",
  weeks: 20,
  startDate: "2026-03-30",
  availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"],
  preferredLongRunDay: "sunday",
};
const marathonPlan = generateFallbackPlan(marathonMidBlockProfile, marathonMidBlockGoal);
const weeklyLoads = buildWeeklyLoad(marathonPlan, marathonMidBlockGoal.startDate).filter((week) => week.week >= 6 && week.week <= 13);
const longRunMinutes = weeklyLoads.map((week) => Math.round(week.longestContinuousRunSec / 60));
assert.ok(
  new Set(longRunMinutes).size >= 4 && Math.max(...longRunMinutes) - Math.min(...longRunMinutes) >= 18,
  "mid-block marathon weeks should show visible long-run evolution instead of feeling flat across many consecutive weeks",
);
assert.ok(
  weeklyLoads.some((week, index) => {
    if (index === 0) return false;
    const previousWeek = weeklyLoads[index - 1]!;
    return (
      week.load < previousWeek.load * 0.96 ||
      week.longestContinuousRunSec + 5 * 60 < previousWeek.longestContinuousRunSec ||
      (week.load <= previousWeek.load * 1.02 && week.longestContinuousRunSec < previousWeek.longestContinuousRunSec)
    );
  }),
  "mid-block progression should still include a lighter absorption week instead of only inching upward in a flat line",
);
const midBlockSupportTitles = marathonPlan.sessions
  .filter((session) => session.week >= 6 && session.week <= 13 && session.title !== "Langt roligt pas" && session.title !== "Recovery-pas")
  .map((session) => session.title);
assert.ok(
  midBlockSupportTitles.some((title) => /Steady|Progression/i.test(title)),
  "mid-block progression should evolve through calmer structure changes like steady/progression work, not just by making everything more intense",
);

console.log("workout screen hierarchy tests passed");
