import assert from "node:assert/strict";

import {
  addWeeksToIsoDate,
  applyDurationToRecommendationOption,
  buildDurationEditBounds,
  buildDurationAdjustmentState,
  buildLowFrequencyOverridePrompt,
  buildRecommendationLeadCopy,
  buildTrackRecommendationContext,
  buildPlanStartDateHelpText,
  buildRecentRaceTimeFromParts,
  buildRecentRaceTimes,
  deriveBaselineLoadFromAbility,
  deriveBaselineLoadFromCapacity,
  getGoalTypeOptions,
  getOnboardingTrackOptions,
  getOnboardingStepDefinition,
  getSuggestedPlanStartDate,
  hasRecentRaceEntry,
  inferAbilityFromCapacityDistance,
  inferOnboardingTrackFromProfile,
  isOnboardingStepReady,
  isGoalTypeAllowed,
  mapAbilityToRunningExperience,
  ONBOARDING_TRACK_OPTIONS,
  ONBOARDING_STEPS,
  ONBOARDING_STEP_COUNT,
  parseCurrentCapacityDistanceKm,
  recentRaceDraftFromEntries,
  recentRaceDraftSummaryLabel,
  recentRaceSummaryLabel,
  recentRaceTimePartsFromString,
  shouldRequireLowFrequencyOverride,
  shouldInitializeOnboardingProfileStage,
  trackCapacityHint,
} from "../src/lib/onboarding-flow";

function goalValues(distance: Parameters<typeof getGoalTypeOptions>[0], ability: Parameters<typeof getGoalTypeOptions>[1]) {
  return getGoalTypeOptions(distance, ability).map((option) => option.value);
}

assert.equal(ONBOARDING_STEP_COUNT, 9, "the onboarding should expose 9 steps after the early track addition");
assert.deepEqual(
  ONBOARDING_STEPS.map((step) => step.id),
  ["track", "intro", "running_level", "target_distance", "goal_type", "weekly_structure", "plan_style", "constraints", "extra_profile"],
  "step order should match the redesigned onboarding flow",
);

assert.equal(getOnboardingStepDefinition(9).optional, true, "extra profile step should be skippable");
assert.deepEqual(
  ONBOARDING_STEPS.map((step) => step.index),
  [1, 2, 3, 4, 5, 6, 7, 8, 9],
  "progress indicator should map directly to the 9 steps",
);
assert.equal(
  getOnboardingStepDefinition(9).nextLabel,
  "Se min plan",
  "sticky onboarding navigation should keep a specific final CTA label",
);
assert.equal(ONBOARDING_TRACK_OPTIONS.length, 4, "onboarding should expose a compact four-track entry step");
assert.equal(
  inferOnboardingTrackFromProfile({ currentRunsPerWeek: 4, runningExperience: "ovet", currentRunningAbility: "mere_end_tredive_min" }),
  "goal_focused",
  "existing stronger runners should hydrate into the goal-focused track",
);
assert.match(
  trackCapacityHint("returning"),
  /efter pausen/,
  "capacity hint should adapt its coaching tone to the selected track",
);
assert.match(
  trackCapacityHint("goal_focused", "en"),
  /current stable distance/i,
  "step 3 running-level helper text should be English on the .eu path",
);
assert.equal(
  buildTrackRecommendationContext("goal_focused"),
  "Planen er lagt med tydelig retning mod dit mål.",
  "track-specific recommendation framing should make goal-focused runners feel clearly target-oriented",
);
assert.equal(
  getOnboardingStepDefinition(1, "en").title,
  "Which of these feels most like you right now?",
  "English beta locale should expose natural onboarding step copy",
);
assert.equal(
  getOnboardingStepDefinition(9, "en").title,
  "Extra details",
  "step 9 should still resolve through the English onboarding definitions",
);
assert.equal(
  getOnboardingTrackOptions("en")[0]?.label,
  "I want to start running",
  "English beta locale should expose translated onboarding track labels",
);
assert.equal(
  buildTrackRecommendationContext("goal_focused", "en"),
  "The plan is shaped with a clear line toward your goal.",
  "English beta locale should expose track-aware recommendation framing",
);
assert.equal(
  getGoalTypeOptions("Halvmaraton", "mere_end_tredive_min", "en").find((option) => option.value === "target_time")?.label,
  "Run to a target pace",
  "English beta locale should expose natural goal-type labels on the core onboarding flow",
);
assert.match(
  buildPlanStartDateHelpText("2026-04-03", "2026-04-03", "en"),
  /start week 1 from today/i,
  "English beta locale should explain plan start dates in natural English",
);
assert.equal(
  shouldInitializeOnboardingProfileStage("welcome", "profile"),
  true,
  "onboarding should initialize when the user actually enters the profile flow",
);
assert.equal(
  shouldInitializeOnboardingProfileStage("profile", "profile"),
  false,
  "selecting a Step 3 quick distance should not reinitialize onboarding back to Step 1 while the user is still in the profile flow",
);
assert.equal(
  isOnboardingStepReady({
    onboardingStep: 5,
    selections: { track: true, runningAbility: true, goalDistance: true, goalType: false, activityLevel: false, ambition: true },
    typicalWorkoutMinutes: 45,
    availableTrainingDaysCount: 3,
    preferredLongRunDay: "both",
    hasValidStartDate: true,
  }),
  true,
  "valid Step 5 weekly-structure input should enable Næste",
);
assert.equal(
  isOnboardingStepReady({
    onboardingStep: 5,
    selections: { track: true, runningAbility: true, goalDistance: true, goalType: true, activityLevel: false, ambition: true },
    typicalWorkoutMinutes: 45,
    availableTrainingDaysCount: 3,
    preferredLongRunDay: "both",
    hasValidStartDate: false,
  }),
  false,
  "invalid or missing Step 5 start date should still keep Næste disabled",
);
assert.equal(
  isOnboardingStepReady({
    onboardingStep: 6,
    selections: { track: true, runningAbility: true, goalDistance: true, goalType: true, activityLevel: false, ambition: true },
    goalType: "target_time",
    targetPaceSecPerKm: undefined,
  }),
  false,
  "Step 6 should still require target pace when the chosen goal type needs it",
);
assert.equal(
  isOnboardingStepReady({
    onboardingStep: 6,
    selections: { track: true, runningAbility: true, goalDistance: true, goalType: true, activityLevel: false, ambition: true },
    goalType: "target_time",
    targetPaceSecPerKm: 300,
  }),
  true,
  "changing the Step 6 pace value should update the enabled state correctly",
);
assert.equal(
  getSuggestedPlanStartDate(new Date("2026-03-29T10:00:00+02:00")),
  "2026-03-29",
  "onboarding should expose a sensible editable default plan start date",
);
assert.match(
  buildPlanStartDateHelpText("2026-03-29", "2026-03-29"),
  /uge 1 fra i dag/,
  "start date helper should keep the copy light when the user starts today",
);
assert.match(
  buildPlanStartDateHelpText("2026-04-02", "2026-03-29"),
  /den dato/,
  "start date helper should explain future starts without feeling technical",
);
assert.equal(
  buildRecommendationLeadCopy(
    "Den her vej giver dig en rolig og realistisk progression.",
    "Planen passer til dit nuværende niveau og din træningsrytme.",
  ),
  "Den her vej giver dig en rolig og realistisk progression. Planen passer til dit nuværende niveau og din træningsrytme.",
  "recommendation screen should merge its guidance into one concise lead paragraph",
);
assert.equal(
  buildRecommendationLeadCopy(
    "Den her vej giver dig en rolig og realistisk progression over de næste uger, så du bygger videre uden at forcere forløbet fra start.",
    "Planen passer til dit nuværende niveau og din træningsrytme.",
  ),
  "Den her vej giver dig en rolig og realistisk progression over de næste uger, så du bygger videre uden at forcere forløbet fra start.",
  "longer recommendation summaries should stay compact instead of appending another similar explanation",
);
assert.equal(
  buildRecommendationLeadCopy(
    "Planen passer til dit nuværende niveau og din træningsrytme.",
    "Planen passer til dit nuværende niveau og din træningsrytme.",
  ),
  "Planen passer til dit nuværende niveau og din træningsrytme.",
  "recommendation lead copy should avoid repeating the same explanation twice",
);
assert.equal(addWeeksToIsoDate("2026-04-03", 12), "2026-06-26", "duration helpers should derive a deterministic goal date from weeks");
assert.deepEqual(
  buildDurationEditBounds({ recommendedWeeks: 21, realisticMinWeeks: 19, realisticMaxWeeks: 24 }),
  { editableMinWeeks: 11, editableMaxWeeks: 32 },
  "editable duration bounds should extend beyond the realistic span so the user can still override it",
);
assert.equal(
  buildDurationAdjustmentState({
    goal: { distance: "10K", goalType: "complete", weeks: 12, startDate: "2026-04-03" },
    recommendedWeeks: 12,
    selectedWeeks: 12,
  }).overridePrompt,
  null,
  "recommended duration should remain the default without requiring any override",
);
assert.equal(
  buildDurationAdjustmentState({
    goal: { distance: "10K", goalType: "complete", weeks: 12, startDate: "2026-04-03" },
    recommendedWeeks: 12,
    selectedWeeks: 10,
    realisticMinWeeks: 11,
    realisticMaxWeeks: 14,
    locale: "en",
  }).overridePrompt?.title,
  "10 weeks is shorter than my recommendation",
  "English beta locale should expose the recommendation/intermezzo override prompt in natural English",
);
assert.equal(
  buildDurationAdjustmentState({
    goal: { distance: "Halvmaraton", goalType: "complete", weeks: 21, startDate: "2026-04-03" },
    recommendedWeeks: 21,
    selectedWeeks: 18,
    realisticMinWeeks: 19,
    realisticMaxWeeks: 24,
    locale: "en",
  }).overridePrompt?.confirmLabel,
  "Use 18 weeks anyway",
  "English beta locale should expose the duration override confirm CTA in English",
);
assert.equal(
  buildLowFrequencyOverridePrompt({ distance: "Marathon", goalType: "complete", availableTrainingDays: ["Tirsdag", "Fredag"], weeks: 18, startDate: "2026-04-03" }, "en")?.title,
  "Two runs per week is low for a marathon",
  "English beta locale should expose low-frequency override warnings in English",
);
assert.equal(
  buildDurationAdjustmentState({
    goal: { distance: "10K", goalType: "complete", weeks: 12, startDate: "2026-04-03" },
    recommendedWeeks: 12,
    selectedWeeks: 12,
  }).note,
  null,
  "changing back to the recommended duration should clear custom duration warnings",
);
assert.deepEqual(
  applyDurationToRecommendationOption({
    goal: { distance: "10K", goalType: "complete", weeks: 12, startDate: "2026-04-03" },
    option: {
      mode: "standard",
      label: "Anbefalet vej",
      durationWeeks: 12,
      goalDate: "2026-06-26",
      sessionsPerWeek: 3,
      progressionMode: "standard",
      realism: "high_confidence",
      warnings: [],
      headline: "Min anbefaling",
      summary: "Standardvejen passer bedst.",
      planLevel: "realistic",
      planLevelLabel: "Realistisk",
      planLevelExplanation: "Planen passer til dit niveau.",
      wasAdjusted: false,
    },
    recommendedWeeks: 12,
    selectedWeeks: 14,
  }),
  {
    mode: "standard",
    label: "Anbefalet vej",
    durationWeeks: 14,
    goalDate: "2026-07-10",
    sessionsPerWeek: 3,
    progressionMode: "standard",
    realism: "high_confidence",
    warnings: [],
    headline: "Min anbefaling",
    summary: "Du har valgt 14 uger i stedet for de anbefalede 12. Det giver planen lidt mere luft og en roligere opbygning.",
    planLevel: "easy",
    planLevelLabel: "Roligere",
    planLevelExplanation: "Planen får lidt mere luft, så progressionen kan bygges roligere op.",
    wasAdjusted: true,
    adjustmentMessage: "Det giver 2 uger mere luft i planen og en roligere opbygning end anbefalingen.",
  },
  "user-adjusted duration should produce a recommendation option that matches the chosen weeks and derived goal date",
);

assert.deepEqual(goalValues("5K", "helt_ny"), ["complete", "run_without_walking"], "new 5K runners should see only beginner-safe goals");
assert.deepEqual(goalValues("10K", "tyve_tredive_min"), ["complete", "run_without_walking", "target_time", "pr"], "stronger 10K runners should see performance options");
assert.deepEqual(goalValues("Marathon", "fem_min"), ["complete"], "very early marathon runners should only see complete");
assert.equal(isGoalTypeAllowed("Halvmaraton", "tyve_tredive_min", "target_time"), true, "half marathon target pace should unlock once continuity is credible");
assert.equal(isGoalTypeAllowed("5K", "helt_ny", "pr"), false, "PR should stay hidden for true beginners");

assert.equal(mapAbilityToRunningExperience("helt_ny"), "nybegynder");
assert.equal(mapAbilityToRunningExperience("mere_end_tredive_min"), "ovet");
assert.deepEqual(
  deriveBaselineLoadFromAbility("fem_min"),
  {
    currentWeeklyVolumeKm: 4,
    currentRunsPerWeek: 2,
    longestCurrentRunMin: 8,
  },
  "baseline load defaults should remain deterministic for onboarding state",
);
assert.equal(parseCurrentCapacityDistanceKm("6,5"), 6.5, "distance parsing should support Danish decimal input");
assert.equal(parseCurrentCapacityDistanceKm("31"), null, "distance parsing should reject unrealistic onboarding values");
assert.equal(inferAbilityFromCapacityDistance(10), "mere_end_tredive_min", "stronger runners should map into the stronger current-capacity band");
assert.deepEqual(
  deriveBaselineLoadFromCapacity(10, 4),
  {
    currentRunningAbility: "mere_end_tredive_min",
    runningExperience: "ovet",
    currentWeeklyVolumeKm: 32.8,
    currentRunsPerWeek: 4,
    longestCurrentRunMin: 63,
  },
  "current-capacity mapping should materially preserve stronger runners' baseline instead of dropping them into a low start point",
);
assert.deepEqual(
  deriveBaselineLoadFromCapacity(5, 3),
  {
    currentRunningAbility: "mere_end_tredive_min",
    runningExperience: "ovet",
    currentWeeklyVolumeKm: 12.3,
    currentRunsPerWeek: 3,
    longestCurrentRunMin: 31,
  },
  "selecting a valid Step 3 distance should still apply the chosen capacity value correctly without changing the onboarding step",
);
assert.equal(
  shouldRequireLowFrequencyOverride({
    distance: "Halvmaraton",
    goalType: "complete",
    weeks: 18,
    startDate: "2026-04-03",
    availableTrainingDays: ["Onsdag", "Sondag"],
  }),
  true,
  "very low frequency should require an explicit override for ambitious long goals",
);
assert.match(
  buildLowFrequencyOverridePrompt({
    distance: "Marathon",
    goalType: "target_time",
    weeks: 20,
    startDate: "2026-04-03",
    availableTrainingDays: ["Onsdag", "Sondag"],
  })?.body ?? "",
  /mindre robusthed/,
  "low-frequency override copy should explain the coaching reason instead of only blocking the user",
);

assert.equal(hasRecentRaceEntry([]), false, "optional PR path should stay closed when nothing is entered");
assert.equal(
  hasRecentRaceEntry([{ distance: "10K", time: "48:30" }]),
  true,
  "recent race helper should treat a complete distance/time pair as active",
);
assert.deepEqual(
  buildRecentRaceTimes("5K", "26:00"),
  [{ distance: "5K", time: "26:00" }],
  "recent race builder should produce a deterministic entry when both fields are present",
);
assert.deepEqual(
  recentRaceTimePartsFromString("48:30"),
  { hours: 0, minutes: 48, seconds: 30 },
  "time picker helper should hydrate mm:ss values into picker parts",
);
assert.deepEqual(
  recentRaceTimePartsFromString("1:39:00"),
  { hours: 1, minutes: 39, seconds: 0 },
  "time picker helper should hydrate h:mm:ss values into picker parts",
);
assert.equal(
  buildRecentRaceTimeFromParts({ hours: 0, minutes: 48, seconds: 30 }),
  "48:30",
  "time picker should support realistic race times without fragile free text entry",
);
assert.equal(
  buildRecentRaceTimeFromParts({ hours: 1, minutes: 39, seconds: 0 }),
  "1:39:00",
  "time picker should support longer race times with hours",
);
assert.deepEqual(
  buildRecentRaceTimes("10K", buildRecentRaceTimeFromParts({ hours: 0, minutes: 48, seconds: 30 })),
  [{ distance: "10K", time: "48:30" }],
  "distance and picker values should still map into deterministic recent-race state",
);
assert.deepEqual(
  buildRecentRaceTimes("", "26:00"),
  [],
  "recent race builder should keep the field optional until both parts are filled in",
);
assert.deepEqual(
  recentRaceDraftFromEntries([{ distance: "10K", time: "48:30" }]),
  { distance: "10K", time: "48:30" },
  "recent race drafts should hydrate from saved onboarding state without losing editability",
);
assert.equal(
  recentRaceDraftSummaryLabel({ distance: "10K", time: "48:30" }),
  "10K · 48:30",
  "saved summary should reflect the currently edited distance/time pair",
);
assert.equal(
  recentRaceDraftSummaryLabel({ distance: "Halvmaraton", time: "1:42:00" }),
  "Halvmaraton · 1:42:00",
  "saved summary should render cleanly for longer picker-based race times",
);
assert.equal(
  recentRaceDraftSummaryLabel({ distance: "Halvmaraton", time: "1:42:00" }, "en"),
  "Half marathon · 1:42:00",
  "step 9 recent-result summaries should localize distance labels on the English beta path",
);
assert.equal(
  recentRaceDraftSummaryLabel({ distance: "10K", time: "" }),
  null,
  "saved summary should disappear cleanly when the optional recent race entry is incomplete",
);
assert.equal(
  recentRaceSummaryLabel([{ distance: "10K", time: "48:30" }]),
  "10K · 48:30",
  "optional PR/time state should expose a compact saved summary when data exists",
);
assert.equal(
  recentRaceSummaryLabel([]),
  null,
  "optional PR/time summary should stay empty when nothing is saved",
);

console.log("onboarding redesign flow tests passed");
