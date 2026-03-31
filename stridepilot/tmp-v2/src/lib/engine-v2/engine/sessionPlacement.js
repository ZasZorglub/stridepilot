"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.placeSessionsOnDays = placeSessionsOnDays;
const weeklyStructure_1 = require("../weeklyStructure");
function placeSessionsOnDays(weeklyStructures, input) {
    const preferredLongRunDay = (0, weeklyStructure_1.chooseLongRunDay)(input);
    return weeklyStructures.map((week) => ({
        ...week,
        longRunDay: week.slots.some((slot) => slot.role === "long_run" && slot.day === preferredLongRunDay) ? preferredLongRunDay : week.longRunDay,
    }));
}
