"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const onboarding_flow_1 = require("../src/lib/onboarding-flow");
function goalValues(distance, ability) {
    return (0, onboarding_flow_1.getGoalTypeOptions)(distance, ability).map((option) => option.value);
}
strict_1.default.equal(onboarding_flow_1.ONBOARDING_STEP_COUNT, 8, "the onboarding should expose 8 steps");
strict_1.default.deepEqual(onboarding_flow_1.ONBOARDING_STEPS.map((step) => step.id), ["intro", "running_level", "target_distance", "goal_type", "weekly_structure", "plan_style", "constraints", "extra_profile"], "step order should match the redesigned onboarding flow");
strict_1.default.equal((0, onboarding_flow_1.getOnboardingStepDefinition)(8).optional, true, "extra profile step should be skippable");
strict_1.default.deepEqual(onboarding_flow_1.ONBOARDING_STEPS.map((step) => step.index), [1, 2, 3, 4, 5, 6, 7, 8], "progress indicator should map directly to the 8 steps");
strict_1.default.equal((0, onboarding_flow_1.getOnboardingStepDefinition)(8).nextLabel, "Se min plan", "sticky onboarding navigation should keep a specific final CTA label");
strict_1.default.equal((0, onboarding_flow_1.getSuggestedPlanStartDate)(new Date("2026-03-29T10:00:00+02:00")), "2026-03-29", "onboarding should expose a sensible editable default plan start date");
strict_1.default.match((0, onboarding_flow_1.buildPlanStartDateHelpText)("2026-03-29", "2026-03-29"), /uge 1 fra i dag/, "start date helper should keep the copy light when the user starts today");
strict_1.default.match((0, onboarding_flow_1.buildPlanStartDateHelpText)("2026-04-02", "2026-03-29"), /den dato/, "start date helper should explain future starts without feeling technical");
strict_1.default.equal((0, onboarding_flow_1.buildRecommendationLeadCopy)("Den her vej giver dig en rolig og realistisk progression.", "Planen passer til dit nuværende niveau og din træningsrytme."), "Den her vej giver dig en rolig og realistisk progression. Planen passer til dit nuværende niveau og din træningsrytme.", "recommendation screen should merge its guidance into one concise lead paragraph");
strict_1.default.equal((0, onboarding_flow_1.buildRecommendationLeadCopy)("Den her vej giver dig en rolig og realistisk progression over de næste uger, så du bygger videre uden at forcere forløbet fra start.", "Planen passer til dit nuværende niveau og din træningsrytme."), "Den her vej giver dig en rolig og realistisk progression over de næste uger, så du bygger videre uden at forcere forløbet fra start.", "longer recommendation summaries should stay compact instead of appending another similar explanation");
strict_1.default.equal((0, onboarding_flow_1.buildRecommendationLeadCopy)("Planen passer til dit nuværende niveau og din træningsrytme.", "Planen passer til dit nuværende niveau og din træningsrytme."), "Planen passer til dit nuværende niveau og din træningsrytme.", "recommendation lead copy should avoid repeating the same explanation twice");
strict_1.default.deepEqual(goalValues("5K", "helt_ny"), ["complete", "run_without_walking"], "new 5K runners should see only beginner-safe goals");
strict_1.default.deepEqual(goalValues("10K", "tyve_tredive_min"), ["complete", "run_without_walking", "target_time", "pr"], "stronger 10K runners should see performance options");
strict_1.default.deepEqual(goalValues("Marathon", "fem_min"), ["complete"], "very early marathon runners should only see complete");
strict_1.default.equal((0, onboarding_flow_1.isGoalTypeAllowed)("Halvmaraton", "tyve_tredive_min", "target_time"), true, "half marathon target pace should unlock once continuity is credible");
strict_1.default.equal((0, onboarding_flow_1.isGoalTypeAllowed)("5K", "helt_ny", "pr"), false, "PR should stay hidden for true beginners");
strict_1.default.equal((0, onboarding_flow_1.mapAbilityToRunningExperience)("helt_ny"), "nybegynder");
strict_1.default.equal((0, onboarding_flow_1.mapAbilityToRunningExperience)("mere_end_tredive_min"), "ovet");
strict_1.default.deepEqual((0, onboarding_flow_1.deriveBaselineLoadFromAbility)("fem_min"), {
    currentWeeklyVolumeKm: 4,
    currentRunsPerWeek: 2,
    longestCurrentRunMin: 8,
}, "baseline load defaults should remain deterministic for onboarding state");
strict_1.default.equal((0, onboarding_flow_1.hasRecentRaceEntry)([]), false, "optional PR path should stay closed when nothing is entered");
strict_1.default.equal((0, onboarding_flow_1.hasRecentRaceEntry)([{ distance: "10K", time: "48:30" }]), true, "recent race helper should treat a complete distance/time pair as active");
strict_1.default.deepEqual((0, onboarding_flow_1.buildRecentRaceTimes)("5K", "26:00"), [{ distance: "5K", time: "26:00" }], "recent race builder should produce a deterministic entry when both fields are present");
strict_1.default.deepEqual((0, onboarding_flow_1.recentRaceTimePartsFromString)("48:30"), { hours: 0, minutes: 48, seconds: 30 }, "time picker helper should hydrate mm:ss values into picker parts");
strict_1.default.deepEqual((0, onboarding_flow_1.recentRaceTimePartsFromString)("1:39:00"), { hours: 1, minutes: 39, seconds: 0 }, "time picker helper should hydrate h:mm:ss values into picker parts");
strict_1.default.equal((0, onboarding_flow_1.buildRecentRaceTimeFromParts)({ hours: 0, minutes: 48, seconds: 30 }), "48:30", "time picker should support realistic race times without fragile free text entry");
strict_1.default.equal((0, onboarding_flow_1.buildRecentRaceTimeFromParts)({ hours: 1, minutes: 39, seconds: 0 }), "1:39:00", "time picker should support longer race times with hours");
strict_1.default.deepEqual((0, onboarding_flow_1.buildRecentRaceTimes)("10K", (0, onboarding_flow_1.buildRecentRaceTimeFromParts)({ hours: 0, minutes: 48, seconds: 30 })), [{ distance: "10K", time: "48:30" }], "distance and picker values should still map into deterministic recent-race state");
strict_1.default.deepEqual((0, onboarding_flow_1.buildRecentRaceTimes)("", "26:00"), [], "recent race builder should keep the field optional until both parts are filled in");
strict_1.default.deepEqual((0, onboarding_flow_1.recentRaceDraftFromEntries)([{ distance: "10K", time: "48:30" }]), { distance: "10K", time: "48:30" }, "recent race drafts should hydrate from saved onboarding state without losing editability");
strict_1.default.equal((0, onboarding_flow_1.recentRaceDraftSummaryLabel)({ distance: "10K", time: "48:30" }), "10K · 48:30", "saved summary should reflect the currently edited distance/time pair");
strict_1.default.equal((0, onboarding_flow_1.recentRaceDraftSummaryLabel)({ distance: "Halvmaraton", time: "1:42:00" }), "Halvmaraton · 1:42:00", "saved summary should render cleanly for longer picker-based race times");
strict_1.default.equal((0, onboarding_flow_1.recentRaceDraftSummaryLabel)({ distance: "10K", time: "" }), null, "saved summary should disappear cleanly when the optional recent race entry is incomplete");
strict_1.default.equal((0, onboarding_flow_1.recentRaceSummaryLabel)([{ distance: "10K", time: "48:30" }]), "10K · 48:30", "optional PR/time state should expose a compact saved summary when data exists");
strict_1.default.equal((0, onboarding_flow_1.recentRaceSummaryLabel)([]), null, "optional PR/time summary should stay empty when nothing is saved");
console.log("onboarding redesign flow tests passed");
