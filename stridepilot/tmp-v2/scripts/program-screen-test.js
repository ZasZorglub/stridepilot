"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const program_screen_1 = require("../src/lib/program-screen");
strict_1.default.deepEqual(program_screen_1.PROGRAM_SCREEN_SECTION_ORDER, [
    "today_action",
    "next_workout",
    "progression_overview",
    "more_details",
], "the main program screen should keep the short default hierarchy");
strict_1.default.equal((0, program_screen_1.buildProgramStatusLine)({
    distance: "10 km",
    goalDateLabel: "18. maj",
    displayWeek: 4,
    totalWeeks: 12,
}), "10 km · 18. maj · uge 4 af 12", "top status line should stay compact and human-readable");
const nextWorkoutState = (0, program_screen_1.buildNextWorkoutState)({
    nextSession: { title: "Rolig tur" },
    durationMin: 42,
    dateLabel: "torsdag 3. apr.",
});
strict_1.default.equal(nextWorkoutState.visible, true, "next workout should be surfaced early when it exists");
strict_1.default.equal(nextWorkoutState.meta, "42 min · torsdag 3. apr.");
strict_1.default.equal("ctaLabel" in nextWorkoutState, false, "next workout should be a single secondary context pattern instead of rendering a duplicate open-workout CTA");
strict_1.default.equal((0, program_screen_1.buildNextWorkoutState)({
    nextSession: null,
    durationMin: null,
    dateLabel: null,
}).visible, false, "next workout block should disappear cleanly when there is no upcoming session");
strict_1.default.equal((0, program_screen_1.getProgramDayVisualState)(undefined, null), "rest", "rest days should stay visually distinct");
strict_1.default.equal((0, program_screen_1.getProgramDayVisualState)({ id: "session-1" }, null), "planned", "training days without feedback should still render as planned workouts");
strict_1.default.equal((0, program_screen_1.getProgramDayVisualState)({ id: "session-2" }, { id: "feedback-1" }), "completed", "completed training days should remain visually distinct from planned/rest days");
strict_1.default.equal((0, program_screen_1.shouldHighlightNextWorkout)({ id: "session-2" }, "session-2"), true, "the next real workout should still be highlighted clearly in the week overview");
strict_1.default.equal((0, program_screen_1.shouldHighlightNextWorkout)(undefined, "session-2"), false, "rest days should never be promoted as the next workout");
const trainingDayState = (0, program_screen_1.buildTodayActionState)({
    todaySession: { id: "today-1" },
    nextSession: { id: "next-1" },
});
strict_1.default.equal(trainingDayState.mode, "training_day", "training days should keep the action-first state");
strict_1.default.equal(trainingDayState.label, "Dagens træning");
strict_1.default.equal(trainingDayState.ctaLabel, "Start pas");
const restDayWithNextState = (0, program_screen_1.buildTodayActionState)({
    todaySession: null,
    nextSession: { id: "next-1" },
});
strict_1.default.equal(restDayWithNextState.mode, "rest_day_with_next", "rest days with a next session should still feel calm");
strict_1.default.equal(restDayWithNextState.ctaLabel, "Se ugeplan");
strict_1.default.match(restDayWithNextState.support ?? "", /Lad dagen være let|overblikket/, "rest-day copy should stay calm and non-pushy");
strict_1.default.deepEqual((0, program_screen_1.buildWeekOverviewAction)({
    displayWeek: 4,
    nextSessionWeek: 5,
    showProgramMore: false,
}), {
    targetWeek: 5,
    shouldExpand: true,
    shouldFocusNextWorkout: true,
}, "Se ugeplan should open the week overview and target the next real workout even when the current visible day is a rest day");
strict_1.default.deepEqual((0, program_screen_1.buildWeekOverviewAction)({
    displayWeek: 4,
    nextSessionWeek: null,
    showProgramMore: true,
}), {
    targetWeek: 4,
    shouldExpand: false,
    shouldFocusNextWorkout: false,
}, "week overview action should still scroll to the visible week cleanly when there is no next workout to focus");
const emptyRestDayState = (0, program_screen_1.buildTodayActionState)({
    todaySession: null,
    nextSession: null,
});
strict_1.default.equal(emptyRestDayState.mode, "rest_day_empty");
strict_1.default.equal(emptyRestDayState.ctaLabel, "Se denne uge");
const adjustmentState = (0, program_screen_1.buildProgramAdjustmentHighlights)({
    planWarnings: ["Du ligger tæt på din maksimale tilgængelige træningstid."],
    safetyAdjustments: ["Den næste lange tur er gjort lidt kortere for at holde ugen robust."],
    savedAdaptations: [{ id: "a1", reason: "Uge 4 blev holdt roligere efter hårdt pas", runnerFocus: "Mere restitution i næste blok" }],
});
strict_1.default.equal(adjustmentState.hasAdjustments, true, "adjustment section should surface real changes");
strict_1.default.match(adjustmentState.summary, /Planen er justeret|næste skridt/, "adjustment summary should feel productized instead of raw");
strict_1.default.ok(adjustmentState.highlights.length >= 1, "adjustment highlights should stay concise but useful");
const noChangeState = (0, program_screen_1.buildProgramAdjustmentHighlights)({
    planWarnings: [],
    safetyAdjustments: [],
    savedAdaptations: [],
});
strict_1.default.equal(noChangeState.kind, "none", "no-change state should be explicit");
strict_1.default.match(noChangeState.summary, /ikke noget lige nu|holde rytmen/, "no-change copy should still feel useful");
const holdState = (0, program_screen_1.buildProgramAdjustmentHighlights)({
    planWarnings: [],
    safetyAdjustments: [],
    savedAdaptations: [{ id: "hold-1", createdAt: "2026-03-27", mode: "hold", reason: "Jeg holder denne uge stabil efter et krævende pas", changeSummary: ["Jeg holder denne uge stabil efter et krævende pas"] }],
});
strict_1.default.equal(holdState.kind, "holding", "hold state should render distinctly");
strict_1.default.equal(holdState.toneLabel, "Holdt rolig");
strict_1.default.equal((0, program_screen_1.getAdjustmentToneAppearance)(holdState.kind), "steady", "hold state should map to a calm steady tone");
const meaningfulAdjustmentState = (0, program_screen_1.buildProgramAdjustmentHighlights)({
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
        },
    ],
});
strict_1.default.equal(meaningfulAdjustmentState.kind, "conservative", "recovery/downshift should read as conservative");
strict_1.default.equal((0, program_screen_1.getAdjustmentToneAppearance)(meaningfulAdjustmentState.kind), "protective", "conservative adjustments should map to the more protective tone pill styling");
strict_1.default.ok(new Set(meaningfulAdjustmentState.highlights).size === meaningfulAdjustmentState.highlights.length, "duplicate adjustment bullets should be collapsed");
const emptyInsightState = (0, program_screen_1.buildProgramInsightState)([]);
strict_1.default.equal(emptyInsightState.isEmpty, true, "insights empty state should be explicit early on");
strict_1.default.equal(emptyInsightState.readiness, "early");
strict_1.default.match(emptyInsightState.summary, /flere loggede pas|går igen/, "insights empty state should explain why it is empty");
strict_1.default.match(emptyInsightState.body, /logge træningen roligt og ærligt/, "insights empty state should feel intentional");
strict_1.default.match(emptyInsightState.cta ?? "", /par pas mere|første mønstre/, "insights empty state should motivate continued logging");
const populatedInsightState = (0, program_screen_1.buildProgramInsightState)(["Du håndterer længere rolige pas godt."]);
strict_1.default.equal(populatedInsightState.isEmpty, false, "insights section should switch once history exists");
strict_1.default.equal(populatedInsightState.readiness, "ready");
strict_1.default.deepEqual(populatedInsightState.bullets, ["Du håndterer længere rolige pas godt."]);
const progressSummary = (0, program_screen_1.buildProgressOverviewSummary)({
    plan: { weeks: 16 },
    historySummary: { progressPct: 38 },
    displayWeek: 4,
    currentWeekLoad: { load: 123.4 },
});
strict_1.default.equal(progressSummary.length, 3, "progress overview should stay compact on the main screen");
strict_1.default.equal(progressSummary[0]?.value, "Uge 4 af 16");
const progressGraph = (0, program_screen_1.buildProgressGraphState)({
    weeklyLoads: [
        { week: 1, load: 72 },
        { week: 2, load: 88 },
        { week: 3, load: 96 },
        { week: 4, load: 110 },
    ],
    displayWeek: 4,
});
strict_1.default.equal(progressGraph.visible, true, "progress graph should render by default when weekly load data exists");
strict_1.default.match(progressGraph.path, /^M /, "progress graph should expose an SVG path for the compact chart");
strict_1.default.equal(progressGraph.windowStartWeek, 1, "short plans should keep the full visible week window");
strict_1.default.equal(progressGraph.windowEndWeek, 4, "short plans should keep the full visible week window");
strict_1.default.equal(progressGraph.points.some((point) => point.isCurrent), true, "progress graph should highlight the current week in the visible default chart");
strict_1.default.equal(progressGraph.bars.length, 4, "progress graph should include compact weekly load bars");
strict_1.default.equal(progressGraph.bars[0]?.label, "U1", "progress graph should expose weekly bar labels");
strict_1.default.equal(progressGraph.showBaselineSeries, false, "graph should degrade gracefully when no original-plan series is available");
strict_1.default.equal(progressGraph.bars.some((bar) => bar.isCurrent), true, "progress graph should also highlight the current week bar");
const extendedProgressGraph = (0, program_screen_1.buildProgressGraphState)({
    weeklyLoads: Array.from({ length: 24 }, (_, index) => ({
        week: index + 1,
        load: 70 + index * 2,
    })),
    displayWeek: 17,
    visibleWeekCount: 9,
});
strict_1.default.equal(extendedProgressGraph.visible, true, "24-week plans should still render a visible compact progression graph");
strict_1.default.equal(extendedProgressGraph.bars.length, 9, "mobile graph should show a readable week window instead of squeezing the full plan");
strict_1.default.equal(extendedProgressGraph.windowStartWeek, 13, "current week should be centered where possible in the mobile graph window");
strict_1.default.equal(extendedProgressGraph.windowEndWeek, 21, "mobile graph window should track the visible week slice");
strict_1.default.equal(extendedProgressGraph.bars[0]?.label, "U13", "visible week labels should match the current mobile window");
strict_1.default.equal(extendedProgressGraph.bars.some((bar) => bar.isCurrent), true, "the current week should remain highlighted even in longer plans");
strict_1.default.equal(extendedProgressGraph.bars.find((bar) => bar.isCurrent)?.week, 17, "week bar selection should stay aligned with the visible week state used elsewhere on the program screen");
const comparedProgressGraph = (0, program_screen_1.buildProgressGraphState)({
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
strict_1.default.equal(comparedProgressGraph.showBaselineSeries, true, "graph should render the original-plan comparison when baseline data exists");
strict_1.default.match(comparedProgressGraph.baselinePath, /^M /, "original-plan comparison should expose a visual series path");
strict_1.default.deepEqual((0, program_screen_1.buildProgressGraphWeekAction)(12), { targetWeek: 12, scrollIntoView: true }, "week bars should map to a concrete week-navigation action");
console.log("program screen hierarchy tests passed");
