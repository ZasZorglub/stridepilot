"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateVNextPlan = validateVNextPlan;
const spacingRules_1 = require("../rules/spacingRules");
const runRules_1 = require("../rules/runRules");
const structureRules_1 = require("../rules/structureRules");
function validateVNextPlan(plan) {
    return (0, runRules_1.runRules)(plan, [
        spacingRules_1.noHardBeforeLongRunRule,
        spacingRules_1.noBackToBackQualityRule,
        structureRules_1.longRunShareSanityRule,
        structureRules_1.beginnerReturnIntensityLockRule,
        structureRules_1.taperDistinctnessRule,
        structureRules_1.raceWeekDistinctnessRule,
    ]);
}
