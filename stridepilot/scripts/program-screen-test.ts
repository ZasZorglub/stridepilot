import assert from "node:assert/strict";

import {
  buildWeekOverviewAction,
  buildNextWorkoutState,
  buildProgressGraphState,
  buildProgressGraphWeekAction,
  buildProgramStatusLine,
  buildTodayActionState,
  buildProgramAdjustmentHighlights,
  buildProgramInsightState,
  buildProgressOverviewSummary,
  getAdjustmentToneAppearance,
  getProgramDayVisualState,
  PROGRAM_SCREEN_SECTION_ORDER,
  shouldHighlightNextWorkout,
} from "../src/lib/program-screen";

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

const nextWorkoutState = buildNextWorkoutState({
  nextSession: { title: "Rolig tur" } as never,
  durationMin: 42,
  dateLabel: "torsdag 3. apr.",
});
assert.equal(nextWorkoutState.visible, true, "next workout should be surfaced early when it exists");
assert.equal(nextWorkoutState.meta, "42 min · torsdag 3. apr.");

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

const adjustmentState = buildProgramAdjustmentHighlights({
  planWarnings: ["Du ligger tæt på din maksimale tilgængelige træningstid."],
  safetyAdjustments: ["Den næste lange tur er gjort lidt kortere for at holde ugen robust."],
  savedAdaptations: [{ id: "a1", reason: "Uge 4 blev holdt roligere efter hårdt pas", runnerFocus: "Mere restitution i næste blok" } as never],
});
assert.equal(adjustmentState.hasAdjustments, true, "adjustment section should surface real changes");
assert.match(adjustmentState.summary, /Planen er justeret|næste skridt/, "adjustment summary should feel productized instead of raw");
assert.ok(adjustmentState.highlights.length >= 1, "adjustment highlights should stay concise but useful");

const noChangeState = buildProgramAdjustmentHighlights({
  planWarnings: [],
  safetyAdjustments: [],
  savedAdaptations: [],
});
assert.equal(noChangeState.kind, "none", "no-change state should be explicit");
assert.match(noChangeState.summary, /ikke noget lige nu|holde rytmen/, "no-change copy should still feel useful");

const holdState = buildProgramAdjustmentHighlights({
  planWarnings: [],
  safetyAdjustments: [],
  savedAdaptations: [{ id: "hold-1", createdAt: "2026-03-27", mode: "hold", reason: "Jeg holder denne uge stabil efter et krævende pas", changeSummary: ["Jeg holder denne uge stabil efter et krævende pas"] } as never],
});
assert.equal(holdState.kind, "holding", "hold state should render distinctly");
assert.equal(holdState.toneLabel, "Holdt rolig");
assert.equal(getAdjustmentToneAppearance(holdState.kind), "steady", "hold state should map to a calm steady tone");

const meaningfulAdjustmentState = buildProgramAdjustmentHighlights({
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
});
assert.equal(meaningfulAdjustmentState.kind, "conservative", "recovery/downshift should read as conservative");
assert.equal(
  getAdjustmentToneAppearance(meaningfulAdjustmentState.kind),
  "protective",
  "conservative adjustments should map to the more protective tone pill styling",
);
assert.ok(
  new Set(meaningfulAdjustmentState.highlights).size === meaningfulAdjustmentState.highlights.length,
  "duplicate adjustment bullets should be collapsed",
);

const emptyInsightState = buildProgramInsightState([]);
assert.equal(emptyInsightState.isEmpty, true, "insights empty state should be explicit early on");
assert.equal(emptyInsightState.readiness, "early");
assert.match(emptyInsightState.summary, /flere loggede pas|går igen/, "insights empty state should explain why it is empty");
assert.match(emptyInsightState.body, /logge træningen roligt og ærligt/, "insights empty state should feel intentional");
assert.match(emptyInsightState.cta ?? "", /par pas mere|første mønstre/, "insights empty state should motivate continued logging");

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

assert.deepEqual(
  buildProgressGraphWeekAction(12),
  { targetWeek: 12, scrollIntoView: true },
  "week bars should map to a concrete week-navigation action",
);

console.log("program screen hierarchy tests passed");
