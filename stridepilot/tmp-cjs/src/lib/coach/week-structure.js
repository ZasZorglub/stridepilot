"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.preferredTrainingDays = preferredTrainingDays;
exports.preferredLongRunDay = preferredLongRunDay;
exports.orderTrainingDaysForLongRun = orderTrainingDaysForLongRun;
exports.cutbackInterval = cutbackInterval;
const DEFAULT_WEEKDAYS = {
    2: ["tuesday", "saturday"],
    3: ["tuesday", "thursday", "saturday"],
    4: ["monday", "wednesday", "friday", "sunday"],
};
const DAY_ORDER = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
];
function uniqueOrdered(days) {
    const seen = new Set();
    return days.filter((day) => {
        if (seen.has(day))
            return false;
        seen.add(day);
        return true;
    });
}
function preferredTrainingDays(goal) {
    const provided = uniqueOrdered(goal.preferredTrainingDays ?? []);
    if (provided.length >= goal.trainingDaysPerWeek) {
        return provided.slice(0, goal.trainingDaysPerWeek);
    }
    const merged = uniqueOrdered([...provided, ...DEFAULT_WEEKDAYS[goal.trainingDaysPerWeek]]);
    return merged.slice(0, goal.trainingDaysPerWeek);
}
function preferredLongRunDay(goal) {
    const days = preferredTrainingDays(goal);
    if (goal.preferredLongRunDay === "saturday" && days.includes("saturday"))
        return "saturday";
    if (goal.preferredLongRunDay === "sunday" && days.includes("sunday"))
        return "sunday";
    if (goal.preferredLongRunDay === "weekday") {
        const weekday = [...days].reverse().find((day) => day !== "saturday" && day !== "sunday");
        if (weekday)
            return weekday;
    }
    if (days.includes("sunday"))
        return "sunday";
    if (days.includes("saturday"))
        return "saturday";
    return [...days].sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b)).at(-1) ?? days[days.length - 1] ?? "saturday";
}
function orderTrainingDaysForLongRun(goal) {
    const days = preferredTrainingDays(goal);
    const longRunDay = preferredLongRunDay(goal);
    const remaining = days.filter((day) => day !== longRunDay).sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
    return [...remaining, longRunDay];
}
function cutbackInterval(category, trainingDaysPerWeek) {
    if (category === "true_beginner" || category === "run_walk_beginner" || category === "continuous_beginner")
        return 3;
    if (trainingDaysPerWeek >= 4)
        return 4;
    return 3;
}
