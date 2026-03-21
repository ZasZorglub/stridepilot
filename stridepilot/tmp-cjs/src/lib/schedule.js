"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionStartDate = sessionStartDate;
const DAY_INDEX = {
    Sondag: 0,
    Mandag: 1,
    Tirsdag: 2,
    Onsdag: 3,
    Torsdag: 4,
    Fredag: 5,
    Lordag: 6,
};
function sessionStartDate(params) {
    const { startDate, week, dayOfWeek, startHour, startMinute } = params;
    const base = new Date(startDate);
    base.setHours(0, 0, 0, 0);
    const weekBase = new Date(base);
    weekBase.setDate(base.getDate() + (week - 1) * 7);
    const targetDay = DAY_INDEX[dayOfWeek] ?? 2;
    let diff = targetDay - weekBase.getDay();
    if (diff < 0)
        diff += 7;
    const sessionDate = new Date(weekBase);
    sessionDate.setDate(weekBase.getDate() + diff);
    sessionDate.setHours(startHour, startMinute, 0, 0);
    return sessionDate;
}
