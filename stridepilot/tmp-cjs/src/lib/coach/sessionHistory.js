"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInitialSessionHistory = createInitialSessionHistory;
exports.updateSessionHistory = updateSessionHistory;
exports.getRecentSessions = getRecentSessions;
function createInitialSessionHistory() {
    return {
        sessions: [],
    };
}
function updateSessionHistory(history, feedback) {
    const nextSessions = [
        ...history.sessions,
        {
            sessionId: feedback.sessionId,
            difficulty: feedback.difficulty,
            pain: feedback.pain,
            completed: feedback.completed,
        },
    ];
    return {
        sessions: nextSessions.slice(-10),
    };
}
function getRecentSessions(history, count) {
    const safeCount = Math.max(0, Math.floor(count));
    return history.sessions.slice(-safeCount);
}
