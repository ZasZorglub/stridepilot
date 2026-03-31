import type { BuiltSession, EnginePlan } from "../../engine-v2/models";
import type { VNextRule } from "./types";

const DAY_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const HARD_FAMILIES = new Set(["tempo_run", "intervals", "race_specific", "hill_reps"]);
const QUALITY_FAMILIES = new Set(["tempo_run", "intervals", "race_specific", "hill_reps", "progression_run"]);

function sortedSessions(sessions: BuiltSession[]): BuiltSession[] {
  return [...sessions].sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day));
}

export const noHardBeforeLongRunRule: VNextRule<EnginePlan> = {
  id: "SP-001",
  run: ({ plan }) => {
    return plan.weeks.flatMap((week) => {
      const sessions = sortedSessions(week.sessions);
      const longRunIndex = sessions.findIndex((session) => session.role === "long_run");
      if (longRunIndex <= 0) return [];
      const priorSession = sessions[longRunIndex - 1];
      if (!HARD_FAMILIES.has(priorSession.family)) return [];
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

export const noBackToBackQualityRule: VNextRule<EnginePlan> = {
  id: "SP-002",
  run: ({ plan }) => {
    return plan.weeks.flatMap((week) => {
      const sessions = sortedSessions(week.sessions);
      const issues = [];
      for (let index = 1; index < sessions.length; index += 1) {
        const previous = sessions[index - 1];
        const current = sessions[index];
        if (!QUALITY_FAMILIES.has(previous.family) || !QUALITY_FAMILIES.has(current.family)) continue;
        issues.push({
          ruleId: "SP-002",
          severity: "hard_fail" as const,
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
