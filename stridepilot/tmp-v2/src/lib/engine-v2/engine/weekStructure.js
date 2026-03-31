"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildWeeklyStructure = buildWeeklyStructure;
const weeklyStructure_1 = require("../weeklyStructure");
function buildWeeklyStructure(params) {
    return params.phasePlan.weeks.map((phaseWeek) => (0, weeklyStructure_1.buildWeeklyStructure)(params.input, params.classification, phaseWeek, params.planType, params.curves));
}
