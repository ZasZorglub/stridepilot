"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseIsoDateLocal = parseIsoDateLocal;
exports.startOfCalendarWeek = startOfCalendarWeek;
exports.planStartWeekMonday = planStartWeekMonday;
exports.dayOffsetFromSession = dayOffsetFromSession;
exports.sessionDateFromCalendarWeek = sessionDateFromCalendarWeek;
exports.calendarWeekIndexFromDate = calendarWeekIndexFromDate;
exports.calendarWeekDatesForIndex = calendarWeekDatesForIndex;
exports.deriveCalendarWeekCount = deriveCalendarWeekCount;
exports.sessionOccursOnOrAfterStart = sessionOccursOnOrAfterStart;
exports.visiblePlanSessions = visiblePlanSessions;
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const MS_PER_WEEK = MS_PER_DAY * 7;
function parseIsoDateLocal(value) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
}
function startOfCalendarWeek(date) {
    const next = new Date(date);
    const day = next.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    next.setDate(next.getDate() + diff);
    next.setHours(0, 0, 0, 0);
    return next;
}
function planStartWeekMonday(startDateIso) {
    return startOfCalendarWeek(parseIsoDateLocal(startDateIso));
}
function dayOffsetFromSession(dayOfWeek) {
    switch (dayOfWeek) {
        case "Mandag":
            return 0;
        case "Tirsdag":
            return 1;
        case "Onsdag":
            return 2;
        case "Torsdag":
            return 3;
        case "Fredag":
            return 4;
        case "Lordag":
            return 5;
        case "Sondag":
            return 6;
        default:
            return 0;
    }
}
function sessionDateFromCalendarWeek(startDateIso, session) {
    const monday = planStartWeekMonday(startDateIso);
    const next = new Date(monday);
    next.setDate(monday.getDate() + (session.week - 1) * 7 + dayOffsetFromSession(session.dayOfWeek));
    next.setHours(0, 0, 0, 0);
    return next;
}
function calendarWeekIndexFromDate(startDateIso, date) {
    const monday = planStartWeekMonday(startDateIso);
    const current = new Date(date);
    current.setHours(0, 0, 0, 0);
    const diffMs = current.getTime() - monday.getTime();
    return Math.floor(diffMs / MS_PER_WEEK) + 1;
}
function calendarWeekDatesForIndex(startDateIso, weekIndex) {
    const monday = planStartWeekMonday(startDateIso);
    const weekStart = new Date(monday);
    weekStart.setDate(monday.getDate() + (weekIndex - 1) * 7);
    return Array.from({ length: 7 }, (_, index) => {
        const next = new Date(weekStart);
        next.setDate(weekStart.getDate() + index);
        next.setHours(0, 0, 0, 0);
        return next;
    });
}
function deriveCalendarWeekCount(startDateIso, endDateIso) {
    if (!endDateIso)
        return null;
    const monday = planStartWeekMonday(startDateIso);
    const end = parseIsoDateLocal(endDateIso);
    end.setHours(0, 0, 0, 0);
    const diffMs = end.getTime() - monday.getTime();
    if (!Number.isFinite(diffMs) || diffMs < 0)
        return null;
    return Math.floor(diffMs / MS_PER_WEEK) + 1;
}
function sessionOccursOnOrAfterStart(startDateIso, session) {
    return sessionDateFromCalendarWeek(startDateIso, session).getTime() >= parseIsoDateLocal(startDateIso).getTime();
}
function visiblePlanSessions(plan, startDateIso) {
    if (!startDateIso)
        return plan.sessions;
    return plan.sessions.filter((session) => sessionOccursOnOrAfterStart(startDateIso, session));
}
