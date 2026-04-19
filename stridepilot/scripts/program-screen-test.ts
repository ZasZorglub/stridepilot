import assert from "node:assert/strict";

import { sessionDateFromCalendarWeek } from "../src/lib/calendar-week";
import { expandStructure } from "../src/lib/coach/mapToAppPlan";
import { enforceAvailableTrainingDays } from "../src/lib/plan";
import {
  buildGoalEventSessionLabel,
  buildWeekOverviewAction,
  buildNextWorkoutState,
  buildProgressGraphState,
  buildProgressGraphWeekAction,
  buildProgramStatusLine,
  buildTodayActionState,
  buildProgramAdjustmentHighlights,
  buildProgramInsightState,
  buildProgressOverviewSummary,
  findRelevantNextSession,
  getAdjustmentToneAppearance,
  goalEventDistanceLabel,
  getProgramDayVisualState,
  isGoalEventSession,
  PROGRAM_SCREEN_SECTION_ORDER,
  shouldHighlightNextWorkout,
  translateVisibleSessionTitle,
} from "../src/lib/program-screen";
import { formatReadableDurationFromSeconds } from "../src/lib/duration";
import type { TrainingPlan, WorkoutSession } from "../src/lib/types";
import { deriveWorkoutCardRepresentation } from "../src/lib/workout-profile";

const DAY_INDEX: Record<string, number> = {
  Mandag: 0,
  Tirsdag: 1,
  Onsdag: 2,
  Torsdag: 3,
  Fredag: 4,
  Lordag: 5,
  Sondag: 6,
};

assert.deepEqual(
  PROGRAM_SCREEN_SECTION_ORDER,
  [
    "today_action",
    "next_workout",
    "progression_overview",
    "more_details",
  ],
  "the main program screen should keep the short default hierarchy",
);

assert.equal(
  buildProgramStatusLine({
    distance: "10 km",
    goalDateLabel: "18. maj",
    displayWeek: 4,
    totalWeeks: 12,
  }),
  "10 km · 18. maj · uge 4 af 12",
  "top status line should stay compact and human-readable",
);
assert.equal(
  buildProgramStatusLine({
    distance: "10 km",
    goalDateLabel: "18 May",
    displayWeek: 4,
    totalWeeks: 12,
    locale: "en",
  }),
  "10 km · 18 May · week 4 of 12",
  "English beta locale should expose the compact status line in natural English",
);

const nextWorkoutState = buildNextWorkoutState({
  nextSession: { title: "Rolig tur" } as never,
  durationMin: 42,
  dateLabel: "torsdag 3. apr.",
});
assert.equal(nextWorkoutState.visible, true, "next workout should be surfaced early when it exists");
assert.equal(nextWorkoutState.meta, "42 min · torsdag 3. apr.");
assert.equal(
  buildNextWorkoutState({
    nextSession: { title: "Lang tur" } as never,
    durationMin: 131,
    dateLabel: "søndag 7. jun.",
  }).meta,
  "2 t 11 min · søndag 7. jun.",
  "longer user-facing durations should be rendered as readable hours and minutes",
);
assert.equal(
  buildNextWorkoutState({
    nextSession: { title: "Roligt løb" } as never,
    durationMin: 42,
    dateLabel: "Thursday 3 Apr",
    locale: "en",
  }).title,
  "Easy run",
  "visible session titles sourced from plan data should render in English on the .eu path",
);
assert.equal(formatReadableDurationFromSeconds(4000), "1 t 7 min");
assert.equal(formatReadableDurationFromSeconds(1170), "19,5 min");
assert.equal(goalEventDistanceLabel("Halvmaraton"), "21,1 km");
assert.equal(goalEventDistanceLabel("Halvmaraton", "en"), "21.1 km");
assert.equal(isGoalEventSession({ title: "Halvmaraton måldag" } as never), true);
assert.equal(buildGoalEventSessionLabel({ title: "Maraton måldag" } as never, "Marathon", "en"), "42.2 km race day");
assert.equal(translateVisibleSessionTitle("Roligt løb", "en"), "Easy run");
assert.equal(translateVisibleSessionTitle("Langt roligt pas", "en"), "Long easy run");
assert.equal(translateVisibleSessionTitle("Roligt løb", "da"), "Roligt løb");

assert.equal(
  "ctaLabel" in nextWorkoutState,
  false,
  "next workout should be a single secondary context pattern instead of rendering a duplicate open-workout CTA",
);

assert.equal(
  buildNextWorkoutState({
    nextSession: null,
    durationMin: null,
    dateLabel: null,
  }).visible,
  false,
  "next workout block should disappear cleanly when there is no upcoming session",
);

assert.equal(getProgramDayVisualState(undefined, null), "rest", "rest days should stay visually distinct");
assert.equal(
  getProgramDayVisualState({ id: "session-1" } as never, null),
  "planned",
  "training days without feedback should still render as planned workouts",
);
assert.equal(
  getProgramDayVisualState({ id: "session-2" } as never, { id: "feedback-1" } as never),
  "completed",
  "completed training days should remain visually distinct from planned/rest days",
);
assert.equal(
  shouldHighlightNextWorkout({ id: "session-2" } as never, "session-2"),
  true,
  "the next real workout should still be highlighted clearly in the week overview",
);
assert.equal(
  shouldHighlightNextWorkout(undefined, "session-2"),
  false,
  "rest days should never be promoted as the next workout",
);

const trainingDayState = buildTodayActionState({
  todaySession: { id: "today-1" } as never,
  nextSession: { id: "next-1" } as never,
});
assert.equal(trainingDayState.mode, "training_day", "training days should keep the action-first state");
assert.equal(trainingDayState.label, "Dagens træning");
assert.equal(trainingDayState.ctaLabel, "Start pas");

const runWalkSession: WorkoutSession = {
  id: "run-walk-1",
  title: "Intervalpas",
  week: 1,
  dayOfWeek: "Mandag",
  loadScore: 4,
  steps: [
    { type: "warmup", label: "Opvarmning", durationSec: 300, cue: "" },
    { type: "run", label: "Løb", durationSec: 120, cue: "" },
    { type: "walk", label: "Gang", durationSec: 120, cue: "" },
    { type: "run", label: "Løb", durationSec: 120, cue: "" },
    { type: "walk", label: "Gang", durationSec: 120, cue: "" },
    { type: "run", label: "Løb", durationSec: 120, cue: "" },
    { type: "walk", label: "Gang", durationSec: 120, cue: "" },
    { type: "cooldown", label: "Nedkøling", durationSec: 300, cue: "" },
  ],
};
const easyRunSession: WorkoutSession = {
  id: "easy-1",
  title: "Roligt løb",
  week: 1,
  dayOfWeek: "Onsdag",
  loadScore: 3,
  steps: [
    { type: "run", label: "Roligt løb", durationSec: 900, cue: "", heartRateGuidance: { zoneLabel: "Zone 2", summary: "" } },
  ],
};

const runWalkCard = deriveWorkoutCardRepresentation(runWalkSession);
assert.ok(runWalkCard, "run-walk sessions should produce a shared workout-card representation");
assert.equal(runWalkCard?.shortStructureSummary, "3 × 2 min løb · 2 min gang");
assert.equal(
  runWalkCard?.visualProfile?.map((segment) => segment.stepType).join(","),
  "warmup,run,walk,run,walk,run,walk,cooldown",
  "visual profile should preserve the actual workout order instead of collapsing repeated intervals",
);

const easyRunCard = deriveWorkoutCardRepresentation(easyRunSession);
assert.equal(easyRunCard?.shortStructureSummary, "15 min roligt løb");
assert.equal(easyRunCard?.visualProfile?.length, 1, "continuous easy runs should stay visually continuous instead of looking interval-like");

const brokenThreeIntervalSession: WorkoutSession = {
  id: "broken-3-intervals",
  title: "Roligt løb",
  week: 1,
  dayOfWeek: "Tirsdag",
  loadScore: 4,
  steps: [
    { type: "run", label: "Arbejdsblok 1", durationSec: 120, cue: "Løb i fast, kontrolleret tempo.", heartRateGuidance: { zoneLabel: "Zone 3", summary: "Arbejd op mod zone 3 med kontrol." } },
    { type: "run", label: "Recovery 1", durationSec: 90, cue: "Hold det meget let fra start til slut.", heartRateGuidance: { zoneLabel: "Zone 2", summary: "Hold det roligt i zone 2." } },
    { type: "run", label: "Arbejdsblok 2", durationSec: 120, cue: "Løb i fast, kontrolleret tempo.", heartRateGuidance: { zoneLabel: "Zone 3", summary: "Arbejd op mod zone 3 med kontrol." } },
    { type: "run", label: "Recovery 2", durationSec: 90, cue: "Hold det meget let fra start til slut.", heartRateGuidance: { zoneLabel: "Zone 2", summary: "Hold det roligt i zone 2." } },
    { type: "run", label: "Arbejdsblok 3", durationSec: 120, cue: "Løb i fast, kontrolleret tempo.", heartRateGuidance: { zoneLabel: "Zone 3", summary: "Arbejd op mod zone 3 med kontrol." } },
    { type: "run", label: "Recovery 3", durationSec: 90, cue: "Hold det meget let fra start til slut.", heartRateGuidance: { zoneLabel: "Zone 2", summary: "Hold det roligt i zone 2." } },
  ],
};
const brokenThreeIntervalCard = deriveWorkoutCardRepresentation(brokenThreeIntervalSession);
assert.equal(
  brokenThreeIntervalCard?.shortStructureSummary,
  "3 × 2 min løb · 1,5 min roligt",
  "summary should reflect interval structure even when recovery segments are stored as run steps",
);
assert.deepEqual(
  brokenThreeIntervalCard?.visualProfile?.map((segment) => ({ role: segment.role, durationSec: segment.durationSec, level: segment.level })),
  [
    { role: "work", durationSec: 120, level: "moderate" },
    { role: "recovery", durationSec: 90, level: "rest" },
    { role: "work", durationSec: 120, level: "moderate" },
    { role: "recovery", durationSec: 90, level: "rest" },
    { role: "work", durationSec: 120, level: "moderate" },
    { role: "recovery", durationSec: 90, level: "rest" },
  ],
  "run-based recovery blocks must stay visually separate so a 3-interval workout does not collapse into one long continuous block",
);

const repeatedEasySegmentsSession: WorkoutSession = {
  id: "easy-build-1",
  title: "Roligt løb",
  week: 1,
  dayOfWeek: "Fredag",
  loadScore: 3,
  steps: [
    { type: "warmup", label: "Opvarmning", durationSec: 180, cue: "" },
    { type: "warmup", label: "Opvarmning", durationSec: 120, cue: "" },
    { type: "run", label: "Roligt løb", durationSec: 240, cue: "", heartRateGuidance: { zoneLabel: "Zone 2", summary: "" } },
    { type: "run", label: "Roligt løb", durationSec: 360, cue: "", heartRateGuidance: { zoneLabel: "Zone 2", summary: "" } },
    { type: "walk", label: "Gang", durationSec: 60, cue: "" },
    { type: "walk", label: "Gang", durationSec: 60, cue: "" },
    { type: "run", label: "Tempo", durationSec: 120, cue: "", heartRateGuidance: { zoneLabel: "Zone 3", summary: "" } },
    { type: "run", label: "Tempo", durationSec: 120, cue: "", heartRateGuidance: { zoneLabel: "Zone 3", summary: "" } },
    { type: "cooldown", label: "Nedkøling", durationSec: 180, cue: "" },
    { type: "cooldown", label: "Nedkøling", durationSec: 120, cue: "" },
  ],
};
const repeatedEasySegmentsCard = deriveWorkoutCardRepresentation(repeatedEasySegmentsSession);
assert.deepEqual(
  repeatedEasySegmentsCard?.visualProfile,
  [
    { stepType: "warmup", role: "warmup", level: "easy", durationSec: 180 },
    { stepType: "warmup", role: "warmup", level: "easy", durationSec: 120 },
    { stepType: "run", role: "work", level: "easy", durationSec: 240 },
    { stepType: "run", role: "work", level: "easy", durationSec: 360 },
    { stepType: "walk", role: "walk", level: "rest", durationSec: 60 },
    { stepType: "walk", role: "walk", level: "rest", durationSec: 60 },
    { stepType: "run", role: "work", level: "moderate", durationSec: 120 },
    { stepType: "run", role: "work", level: "moderate", durationSec: 120 },
    { stepType: "cooldown", role: "cooldown", level: "easy", durationSec: 180 },
    { stepType: "cooldown", role: "cooldown", level: "easy", durationSec: 120 },
  ],
  "visual profile should preserve the actual ordered workout steps so no second-pass grouping can flatten a structured workout into a simplified shape",
);

const restDayWithNextState = buildTodayActionState({
  todaySession: null,
  nextSession: { id: "next-1" } as never,
});
assert.equal(restDayWithNextState.mode, "rest_day_with_next", "rest days with a next session should still feel calm");
assert.equal(restDayWithNextState.ctaLabel, "Se ugeplan");
assert.match(restDayWithNextState.support ?? "", /Lad dagen være let|overblikket/, "rest-day copy should stay calm and non-pushy");
assert.deepEqual(
  buildWeekOverviewAction({
    displayWeek: 4,
    nextSessionWeek: 5,
    showProgramMore: false,
  }),
  {
    targetWeek: 5,
    shouldExpand: true,
    shouldFocusNextWorkout: true,
  },
  "Se ugeplan should open the week overview and target the next real workout even when the current visible day is a rest day",
);

assert.deepEqual(
  buildWeekOverviewAction({
    displayWeek: 4,
    nextSessionWeek: null,
    showProgramMore: true,
  }),
  {
    targetWeek: 4,
    shouldExpand: false,
    shouldFocusNextWorkout: false,
  },
  "week overview action should still scroll to the visible week cleanly when there is no next workout to focus",
);

const emptyRestDayState = buildTodayActionState({
  todaySession: null,
  nextSession: null,
});
assert.equal(emptyRestDayState.mode, "rest_day_empty");
assert.equal(emptyRestDayState.ctaLabel, "Se denne uge");
assert.equal(
  buildTodayActionState({
    todaySession: null,
    nextSession: { id: "next-english" } as never,
    locale: "en",
  }).ctaLabel,
  "See week plan",
  "English beta locale should keep the calm rest-day CTA readable for first-time users",
);
assert.equal(
  expandStructure([{ type: "walk", label: "Rask gang opvarmning", durationMin: 8 } as never])[0]?.durationSec,
  5 * 60,
  "opening walk blocks should be capped at 5 minutes when plan structure is expanded into workout steps",
);
assert.equal(
  buildProgramAdjustmentHighlights({
    planWarnings: [],
    safetyAdjustments: [],
    savedAdaptations: [],
    previousGoalDate: "2026-06-20",
    currentGoalDate: "2026-06-20",
    previousTotalWeeks: 12,
    currentTotalWeeks: 12,
    locale: "en",
  }).toneLabel,
  "On track",
  "English beta locale should expose adaptation labels in English on the trust-critical program layer",
);
assert.deepEqual(
  buildProgressOverviewSummary({
    plan: { weeks: 12 } as never,
    historySummary: { progressPct: 38 } as never,
    displayWeek: 4,
    currentWeekLoad: { load: 7.4 },
    locale: "en",
  }),
  [
    { label: "Current week", value: "Week 4 of 12" },
    { label: "Progress", value: "38%" },
    { label: "Weekly load", value: "7.4" },
  ],
  "English beta locale should expose chart and week summary labels in English",
);

const frontLoadedPlan: TrainingPlan = {
  summary: "Testplan",
  weeks: 3,
  sessionsPerWeek: 4,
  sessions: [
    { id: "w3-a", title: "Run-walk", week: 3, dayOfWeek: "Mandag", loadScore: 3, steps: [{ type: "run", label: "Run", durationSec: 1200, cue: "" }] },
    { id: "w3-b", title: "Langt roligt pas", week: 3, dayOfWeek: "Tirsdag", loadScore: 8, steps: [{ type: "run", label: "Run", durationSec: 2400, cue: "" }] },
    { id: "w3-c", title: "Roligt løb", week: 3, dayOfWeek: "Onsdag", loadScore: 4, steps: [{ type: "run", label: "Run", durationSec: 1500, cue: "" }] },
    { id: "w3-d", title: "Recovery-pas", week: 3, dayOfWeek: "Torsdag", loadScore: 2, steps: [{ type: "run", label: "Run", durationSec: 900, cue: "" }] },
  ],
};
const spacedPlan = enforceAvailableTrainingDays(frontLoadedPlan, ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lordag", "Sondag"]).plan;
const spacedWeekDays = [...spacedPlan.sessions.map((session) => session.dayOfWeek)].sort((left, right) => DAY_INDEX[left] - DAY_INDEX[right]);
assert.deepEqual(
  spacedWeekDays,
  ["Mandag", "Onsdag", "Fredag", "Sondag"],
  "the live legacy availability-alignment path should spread a 4-session week across the week instead of defaulting to Monday through Thursday",
);
assert.equal(
  spacedPlan.sessions.find((session) => session.title === "Langt roligt pas")?.dayOfWeek,
  "Sondag",
  "the long run in the live plan path should land on the weekend when Sunday is available",
);

const threeRunPlan = enforceAvailableTrainingDays(
  {
    ...frontLoadedPlan,
    sessionsPerWeek: 3,
    sessions: frontLoadedPlan.sessions.slice(0, 3),
  },
  ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lordag", "Sondag"],
).plan;
assert.deepEqual(
  [...threeRunPlan.sessions.map((session) => session.dayOfWeek)].sort((left, right) => DAY_INDEX[left] - DAY_INDEX[right]),
  ["Tirsdag", "Torsdag", "Sondag"],
  "three-session weeks should also be spaced meaningfully when all seven days are available",
);

const restrictedPlan = enforceAvailableTrainingDays(frontLoadedPlan, ["Mandag", "Onsdag", "Fredag", "Sondag"]).plan;
assert.deepEqual(
  [...restrictedPlan.sessions.map((session) => session.dayOfWeek)].sort((left, right) => DAY_INDEX[left] - DAY_INDEX[right]),
  ["Mandag", "Onsdag", "Fredag", "Sondag"],
  "restricted availability should still be respected exactly in the live alignment path",
);

const activeWeekPlan: TrainingPlan = {
  summary: "Aktiv plan",
  weeks: 4,
  sessionsPerWeek: 2,
  sessions: [
    { id: "week-2", title: "Roligt løb", week: 2, dayOfWeek: "Mandag", loadScore: 3, steps: [{ type: "run", label: "Run", durationSec: 1500, cue: "" }] },
    { id: "week-3", title: "Langt roligt pas", week: 3, dayOfWeek: "Mandag", loadScore: 7, steps: [{ type: "run", label: "Run", durationSec: 1800, cue: "" }] },
    { id: "week-3b", title: "Recovery-pas", week: 3, dayOfWeek: "Onsdag", loadScore: 2, steps: [{ type: "run", label: "Run", durationSec: 900, cue: "" }] },
  ],
};
const relevantNextSession = findRelevantNextSession({
  sessions: activeWeekPlan.sessions.map((session) => ({
    session,
    date: sessionDateFromCalendarWeek("2026-03-30", session),
  })),
  activeWeek: 3,
  today: new Date("2026-04-03T12:00:00"),
});
assert.equal(
  relevantNextSession?.id,
  "week-3",
  "the top-card next planned workout should come from the same active plan week instead of surfacing an earlier stale week",
);
const relevantNextSessionDate = sessionDateFromCalendarWeek("2026-03-30", relevantNextSession as never);
assert.equal(relevantNextSessionDate.getFullYear(), 2026);
assert.equal(relevantNextSessionDate.getMonth(), 3);
assert.equal(
  relevantNextSessionDate.getDate(),
  13,
  "the next planned workout date should match the relevant upcoming session from the active plan source",
);

const adjustmentState = buildProgramAdjustmentHighlights({
  planWarnings: ["Du ligger tæt på din maksimale tilgængelige træningstid."],
  safetyAdjustments: ["Den næste lange tur er gjort lidt kortere for at holde ugen robust."],
  savedAdaptations: [{ id: "a1", reason: "Uge 4 blev holdt roligere efter hårdt pas", runnerFocus: "Mere restitution i næste blok" } as never],
  previousGoalDate: "2026-05-18",
  currentGoalDate: "2026-05-18",
});
assert.equal(adjustmentState.hasAdjustments, true, "adjustment section should surface real changes");
assert.match(adjustmentState.summary, /holdt roligere|næste skridt|restitution/, "adjustment summary should feel productized instead of raw");
assert.ok(adjustmentState.highlights.length >= 1, "adjustment highlights should stay concise but useful");
assert.equal(adjustmentState.timelineNote, "Måldatoen er uændret.", "adaptation messaging should always answer whether the date changed");

const noChangeState = buildProgramAdjustmentHighlights({
  planWarnings: [],
  safetyAdjustments: [],
  savedAdaptations: [],
  previousGoalDate: "2026-05-18",
  currentGoalDate: "2026-05-18",
});
assert.equal(noChangeState.kind, "none", "no-change state should be explicit");
assert.match(noChangeState.summary, /ikke noget lige nu|holde rytmen/, "no-change copy should still feel useful");
assert.equal(noChangeState.timelineNote, "Måldatoen er uændret.");

const repeatWeekState = buildProgramAdjustmentHighlights({
  planWarnings: [],
  safetyAdjustments: [],
  savedAdaptations: [{ id: "hold-1", createdAt: "2026-03-27", mode: "hold", reason: "Jeg holder denne uge stabil efter et krævende pas", changeSummary: ["Jeg holder denne uge stabil efter et krævende pas"] } as never],
  previousGoalDate: "2026-05-18",
  currentGoalDate: "2026-05-18",
});
assert.equal(repeatWeekState.kind, "holding", "hold state should render distinctly");
assert.equal(repeatWeekState.headline, "Jeg gentager denne uge");
assert.match(repeatWeekState.practicalConsequence, /samme struktur én uge mere|stabil/i, "repeat-current-week should explain what happens now");
assert.equal(getAdjustmentToneAppearance(repeatWeekState.kind), "steady", "hold state should map to a calm steady tone");

const downshiftState = buildProgramAdjustmentHighlights({
  planWarnings: [],
  safetyAdjustments: [],
  savedAdaptations: [{ id: "down-1", createdAt: "2026-03-27", mode: "down_shift", reason: "Belastningen skal ned et trin for at holde planen robust", changeSummary: ["Næste uge er gjort lettere"] } as never],
  previousGoalDate: "2026-05-18",
  currentGoalDate: "2026-05-18",
});
assert.equal(downshiftState.headline, "Næste uge bliver lettere");
assert.match(downshiftState.practicalConsequence, /lettere|bygger videre/i, "downshift should explain the immediate next step");

const recoveryMicrocycleState = buildProgramAdjustmentHighlights({
  planWarnings: [],
  safetyAdjustments: ["Den næste uge er gjort roligere for at give mere luft."],
  savedAdaptations: [
    {
      id: "rec-1",
      createdAt: "2026-03-27",
      mode: "recovery_microcycle",
      reason: "Den næste uge er gjort roligere for at give mere luft",
      runnerFocus: "Mere overskud til den næste blok",
      changeSummary: [
        "Den næste uge er gjort roligere for at give mere luft",
        "Den næste uge er gjort roligere for at give mere luft",
      ],
    } as never,
  ],
  previousGoalDate: "2026-05-18",
  currentGoalDate: "2026-05-18",
});
assert.equal(recoveryMicrocycleState.kind, "conservative", "recovery/downshift should read as conservative");
assert.equal(recoveryMicrocycleState.headline, "Jeg lægger en kort recovery-uge ind");
assert.equal(
  getAdjustmentToneAppearance(recoveryMicrocycleState.kind),
  "protective",
  "conservative adjustments should map to the more protective tone pill styling",
);
assert.ok(
  new Set(recoveryMicrocycleState.highlights).size === recoveryMicrocycleState.highlights.length,
  "duplicate adjustment bullets should be collapsed",
);

const movedDateState = buildProgramAdjustmentHighlights({
  planWarnings: [],
  safetyAdjustments: [],
  savedAdaptations: [{ id: "move-1", createdAt: "2026-03-27", mode: "progress", reason: "Planen er justeret efter nye signaler", changeSummary: [] } as never],
  previousGoalDate: "2026-05-18",
  currentGoalDate: "2026-05-25",
});
assert.match(movedDateState.timelineNote, /Måldatoen er flyttet til/, "date changes should be made explicit when metadata indicates a moved goal date");

const unknownPreviousDateState = buildProgramAdjustmentHighlights({
  planWarnings: [],
  safetyAdjustments: [],
  savedAdaptations: [{ id: "move-2", createdAt: "2026-03-27", mode: "progress", reason: "Planen er justeret efter nye signaler", changeSummary: [] } as never],
  previousGoalDate: null,
  currentGoalDate: "2026-05-25",
});
assert.equal(
  unknownPreviousDateState.timelineNote,
  "Måldatoen er uændret.",
  "moved-date copy should only appear when both previous and current dates are genuinely present and different",
);

const emptyInsightState = buildProgramInsightState([]);
assert.equal(emptyInsightState.isEmpty, true, "insights empty state should be explicit early on");
assert.equal(emptyInsightState.readiness, "early");
assert.match(emptyInsightState.summary, /flere loggede pas|går igen/, "insights empty state should explain why it is empty");
assert.match(emptyInsightState.body, /logge træningen roligt og ærligt/, "insights empty state should feel intentional");
assert.match(emptyInsightState.cta ?? "", /par pas mere|første mønstre/, "insights empty state should motivate continued logging");
assert.deepEqual(
  buildProgramInsightState([], "en"),
  {
    readiness: "early",
    isEmpty: true,
    title: "Insights appear once I have a little more to work from",
    summary: "After a few more logged workouts, I start showing the patterns that are actually repeating.",
    body: "For now, it is enough to log training calmly and honestly. The rest comes later.",
    cta: "Log a few more workouts and the first patterns will become clearer.",
    bullets: [],
  },
  "English beta locale should expose the insight empty state in natural English",
);

const populatedInsightState = buildProgramInsightState(["Du håndterer længere rolige pas godt."]);
assert.equal(populatedInsightState.isEmpty, false, "insights section should switch once history exists");
assert.equal(populatedInsightState.readiness, "ready");
assert.deepEqual(populatedInsightState.bullets, ["Du håndterer længere rolige pas godt."]);

const progressSummary = buildProgressOverviewSummary({
  plan: { weeks: 16 } as never,
  historySummary: { progressPct: 38 } as never,
  displayWeek: 4,
  currentWeekLoad: { load: 123.4 },
});
assert.equal(progressSummary.length, 3, "progress overview should stay compact on the main screen");
assert.equal(progressSummary[0]?.value, "Uge 4 af 16");

const progressGraph = buildProgressGraphState({
  weeklyLoads: [
    { week: 1, load: 72 },
    { week: 2, load: 88 },
    { week: 3, load: 96 },
    { week: 4, load: 110 },
  ],
  displayWeek: 4,
});
assert.equal(progressGraph.visible, true, "progress graph should render by default when weekly load data exists");
assert.match(progressGraph.path, /^M /, "progress graph should expose an SVG path for the compact chart");
assert.equal(progressGraph.windowStartWeek, 1, "short plans should keep the full visible week window");
assert.equal(progressGraph.windowEndWeek, 4, "short plans should keep the full visible week window");
assert.equal(
  progressGraph.points.some((point) => point.isCurrent),
  true,
  "progress graph should highlight the current week in the visible default chart",
);
assert.equal(progressGraph.bars.length, 4, "progress graph should include compact weekly load bars");
assert.equal(progressGraph.bars[0]?.label, "U1", "progress graph should expose weekly bar labels");
assert.equal(progressGraph.showBaselineSeries, false, "graph should degrade gracefully when no original-plan series is available");
assert.equal(
  progressGraph.bars.some((bar) => bar.isCurrent),
  true,
  "progress graph should also highlight the current week bar",
);

const extendedProgressGraph = buildProgressGraphState({
  weeklyLoads: Array.from({ length: 24 }, (_, index) => ({
    week: index + 1,
    load: 70 + index * 2,
  })),
  displayWeek: 17,
  visibleWeekCount: 9,
});
assert.equal(extendedProgressGraph.visible, true, "24-week plans should still render a visible compact progression graph");
assert.equal(extendedProgressGraph.bars.length, 9, "mobile graph should show a readable week window instead of squeezing the full plan");
assert.equal(extendedProgressGraph.windowStartWeek, 13, "current week should be centered where possible in the mobile graph window");
assert.equal(extendedProgressGraph.windowEndWeek, 21, "mobile graph window should track the visible week slice");
assert.equal(extendedProgressGraph.bars[0]?.label, "U13", "visible week labels should match the current mobile window");
assert.equal(
  extendedProgressGraph.bars.some((bar) => bar.isCurrent),
  true,
  "the current week should remain highlighted even in longer plans",
);
assert.equal(
  extendedProgressGraph.bars.find((bar) => bar.isCurrent)?.week,
  17,
  "week bar selection should stay aligned with the visible week state used elsewhere on the program screen",
);

const comparedProgressGraph = buildProgressGraphState({
  weeklyLoads: [
    { week: 1, load: 72 },
    { week: 2, load: 88 },
    { week: 3, load: 96 },
    { week: 4, load: 110 },
  ],
  baselineWeeklyLoads: [
    { week: 1, load: 68 },
    { week: 2, load: 82 },
    { week: 3, load: 92 },
    { week: 4, load: 104 },
  ],
  displayWeek: 3,
});
assert.equal(comparedProgressGraph.showBaselineSeries, true, "graph should render the original-plan comparison when baseline data exists");
assert.match(comparedProgressGraph.baselinePath, /^M /, "original-plan comparison should expose a visual series path");
assert.equal(comparedProgressGraph.points.filter((point) => point.isCurrent).length, 1, "graph state should still expose exactly one current week marker");

assert.deepEqual(
  buildProgressGraphWeekAction(12),
  { targetWeek: 12, scrollIntoView: true },
  "week bars should map to a concrete week-navigation action",
);

console.log("program screen hierarchy tests passed");
