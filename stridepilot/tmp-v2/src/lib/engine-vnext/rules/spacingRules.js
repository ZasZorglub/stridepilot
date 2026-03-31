"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.noBackToBackQualityRule = exports.noHardBeforeLongRunRule = void 0;
const DAY_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const HARD_FAMILIES = new Set(["tempo_run", "intervals", "race_specific", "hill_reps"]);
const QUALITY_FAMILIES = new Set(["tempo_run", "intervals", "race_specific", "hill_reps", "progression_run"]);
function sortedSessions(sessions) {
    return [...sessions].sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day));
}
exports.noHardBeforeLongRunRule = {
    id: "SP-001",
    run: ({ plan }) => {
        return plan.weeks.flatMap((week) => {
            const sessions = sortedSessions(week.sessions);
            const longRunIndex = sessions.findIndex((session) => session.role === "long_run");
            if (longRunIndex <= 0)
                return [];
            const priorSession = sessions[longRunIndex - 1];
            if (!HARD_FAMILIES.has(priorSession.family))
                return [];
            return [
                {
                    ruleId: "SP-001",
                    severity: "auto_adjust",
                    message: "Hard session is scheduled immediately before the long run.",
                    weekIndex: week.weekIndex,
                    sessionId: priorSession.id,
                    sessionDay: priorSession.day,
                },
            ];
        });
    },
};
exports.noBackToBackQualityRule = {
    id: "SP-002",
    run: ({ plan }) => {
        return plan.weeks.flatMap((week) => {
            const sessions = sortedSessions(week.sessions);
            const issues = [];
            for (let index = 1; index < sessions.length; index += 1) {
                const previous = sessions[index - 1];
                const current = sessions[index];
                if (!QUALITY_FAMILIES.has(previous.family) || !QUALITY_FAMILIES.has(current.family))
                    continue;
                issues.push({
                    ruleId: "SP-002",
                    severity: "hard_fail",
                    message: "Back-to-back quality sessions detected in the same week.",
                    weekIndex: week.weekIndex,
                    sessionId: current.id,
                    sessionDay: current.day,
                });
            }
            return issues;
        });
    },
};
