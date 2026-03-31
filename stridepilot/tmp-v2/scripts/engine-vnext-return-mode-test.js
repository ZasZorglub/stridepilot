"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const engine_1 = require("../src/lib/engine-v2/engine");
const weeklyStructure_1 = require("../src/lib/engine-v2/weeklyStructure");
const validatePlan_1 = require("../src/lib/engine-vnext/validators/validatePlan");
function maxGrowth(curve) {
    let max = 0;
    for (let index = 1; index < curve.length; index += 1) {
        const previous = curve[index - 1];
        if (previous <= 0)
            continue;
        max = Math.max(max, (curve[index] - previous) / previous);
    }
    return max;
}
const returnProfile = {
    raceDistance: "5K",
    goalType: "return_to_running",
    startDate: "2026-03-30",
    goalDate: "2026-06-21",
    currentContinuousRunMin: 8,
    currentWeeklyRuns: 1,
    currentWeeklyVolumeKm: 6,
    longestRecentRunMin: 16,
    recentConsistency: 0.35,
    availableTrainingDays: ["monday", "wednesday", "saturday"],
    preferredLongRunDay: "saturday",
    typicalAvailableTimeMin: 35,
    trainingStylePreference: "conservative",
    experienceLevel: "recreational",
    injuryConcern: "moderate",
    externalTrainingLoad: "light",
    confidence: 3,
    freeTextFlags: ["return after break"],
};
const beginnerProfile = {
    ...returnProfile,
    goalType: "finish",
    injuryConcern: "low",
    freeTextFlags: [],
};
const returnPlan = (0, engine_1.generateEngineV2Plan)(returnProfile);
const beginnerPlan = (0, engine_1.generateEngineV2Plan)(beginnerProfile);
strict_1.default.ok(returnPlan.returnToRunningState?.active, "Return plan should expose protected return mode state");
strict_1.default.ok(maxGrowth(returnPlan.curves.weeklyVolumeCurve) <= maxGrowth(beginnerPlan.curves.weeklyVolumeCurve), "Return mode weekly volume should be capped at least as tightly as beginner equivalent");
strict_1.default.ok(maxGrowth(returnPlan.curves.longRunCurve) <= maxGrowth(beginnerPlan.curves.longRunCurve), "Return mode long-run growth should be capped at least as tightly as beginner equivalent");
strict_1.default.ok(Math.max(...returnPlan.curves.sessionsPerWeekCurve) <= 3, "Return mode should not ramp beyond 3 sessions/week in this slice");
strict_1.default.ok(returnPlan.curves.sessionsPerWeekCurve.slice(0, 4).every((value) => value <= 2), "Return mode should restrain session-count growth in early weeks");
const illegalIntensity = returnPlan.weeks.some((week) => week.sessions.some((session) => ["intervals", "tempo_run", "race_specific", "hill_reps"].includes(session.family)));
strict_1.default.equal(illegalIntensity, false, "Return mode must not unlock illegal intensity families");
const returnBaseTemplate = (0, weeklyStructure_1.getWeeklyStructure)({
    phase: "base",
    sessionsPerWeek: 3,
    runnerType: "return_to_running",
    goalType: "return_to_running",
    raceDistance: "5K",
});
const beginnerBaseTemplate = (0, weeklyStructure_1.getWeeklyStructure)({
    phase: "base",
    sessionsPerWeek: 3,
    runnerType: "beginner_plus",
    goalType: "finish",
    raceDistance: "5K",
});
strict_1.default.notDeepEqual(returnBaseTemplate, beginnerBaseTemplate, "Return-to-running templates should remain distinct from beginner finish");
const weekOneState = returnPlan.returnToRunningState?.weeklyStates[0];
const laterState = returnPlan.returnToRunningState?.weeklyStates.find((state) => state.weekIndex >= 5);
strict_1.default.ok(weekOneState && !weekOneState.continuityGatePassed, "Early return weeks should start behind the continuity gate");
strict_1.default.ok(weekOneState?.runWalkPreferred, "Early return weeks should prefer run/walk");
strict_1.default.ok(laterState, "Later return week state should exist");
const compliantReturnProfile = {
    ...returnProfile,
    currentContinuousRunMin: 22,
    currentWeeklyRuns: 3,
    currentWeeklyVolumeKm: 18,
    longestRecentRunMin: 38,
    recentConsistency: 0.72,
    injuryConcern: "low",
};
const compliantReturnPlan = (0, engine_1.generateEngineV2Plan)(compliantReturnProfile);
strict_1.default.equal(compliantReturnPlan.returnToRunningState?.graduationEligible, true, "Compliant comeback runner should be marked as graduation-eligible");
const validationReport = (0, validatePlan_1.validateVNextPlan)(returnPlan);
strict_1.default.equal(typeof validationReport.passed, "boolean");
strict_1.default.ok(Array.isArray(validationReport.results), "Validator should still run on return-to-running plans");
console.log("engine-vnext return mode tests passed");
