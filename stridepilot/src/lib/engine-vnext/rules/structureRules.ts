import type { BuiltWeek, EnginePlan, GoalType, RunnerLevel } from "../../engine-v2/models";
import type { VNextRule, VNextRuleResult } from "./types";

const ILLEGAL_BEGINNER_FAMILIES = new Set(["intervals", "hill_reps", "race_specific"]);
const ILLEGAL_RETURN_FAMILIES = new Set(["intervals", "hill_reps", "race_specific", "tempo_run"]);
const DISTINCT_RACE_WEEK_FAMILIES = new Set(["strides_session", "race_specific"]);

function longRunShareThresholds(goalType: GoalType, runnerLevel: RunnerLevel): { warning: number; hardFail: number } {
  if (goalType === "return_to_running") return { warning: 0.32, hardFail: 0.38 };
  if (runnerLevel === "true_beginner" || runnerLevel === "beginner_plus") return { warning: 0.35, hardFail: 0.4 };
  if (goalType === "target_time" || goalType === "improve_time") return { warning: 0.38, hardFail: 0.43 };
  if (runnerLevel === "advanced") return { warning: 0.42, hardFail: 0.48 };
  return { warning: 0.4, hardFail: 0.45 };
}

function qualityCount(week: BuiltWeek): number {
  return week.sessions.filter((session) =>
    !session.isRaceEvent && ["tempo_run", "intervals", "race_specific", "hill_reps", "progression_run"].includes(session.family),
  ).length;
}

function complexityScore(week: BuiltWeek): number {
  return week.sessions.reduce((score, session) => {
    if (session.isRaceEvent) return score;
    if (session.family === "intervals" || session.family === "hill_reps") return score + 3;
    if (session.family === "tempo_run" || session.family === "race_specific" || session.family === "progression_run") return score + 2;
    if (session.family === "strides_session" || session.family === "steady_run") return score + 1;
    return score;
  }, 0);
}

export const longRunShareSanityRule: VNextRule<EnginePlan> = {
  id: "ST-001",
  run: ({ plan }) => {
    const thresholds = longRunShareThresholds(plan.resolvedInput.goalType, plan.classification.traits.runnerLevel);
    return plan.weeks.flatMap((week): VNextRuleResult[] => {
      if (week.volumeTargetMin <= 0 || week.longRunTargetMin <= 0) return [];
      const share = week.longRunTargetMin / week.volumeTargetMin;
      if (share >= thresholds.hardFail) {
        return [
          {
            ruleId: "ST-001",
            severity: "hard_fail",
            message: `Long run consumes ${(share * 100).toFixed(0)}% of weekly load, above the current hard limit.`,
            weekIndex: week.weekIndex,
          },
        ];
      }
      if (share >= thresholds.warning) {
        return [
          {
            ruleId: "ST-001",
            severity: "warning",
            message: `Long run consumes ${(share * 100).toFixed(0)}% of weekly load, which is high for this runner/goal.`,
            weekIndex: week.weekIndex,
          },
        ];
      }
      return [];
    });
  },
};

export const beginnerReturnIntensityLockRule: VNextRule<EnginePlan> = {
  id: "ST-002",
  run: ({ plan }) => {
    const beginnerLike =
      plan.classification.traits.runnerLevel === "true_beginner" ||
      plan.classification.traits.runnerLevel === "beginner_plus";
    const returnLike = plan.resolvedInput.goalType === "return_to_running" || plan.classification.traits.primaryRunnerType === "return_to_running";
    if (!beginnerLike && !returnLike) return [];

    const illegalFamilies = returnLike ? ILLEGAL_RETURN_FAMILIES : ILLEGAL_BEGINNER_FAMILIES;
    return plan.weeks.flatMap((week) =>
      week.sessions.flatMap((session) => {
        if (!illegalFamilies.has(session.family)) return [];
        return [
          {
            ruleId: "ST-002",
            severity: "hard_fail",
            message: `Protected runner received illegal intensity family: ${session.family}.`,
            weekIndex: week.weekIndex,
            sessionId: session.id,
            sessionDay: session.day,
          },
        ];
      }),
    );
  },
};

export const raceWeekDistinctnessRule: VNextRule<EnginePlan> = {
  id: "ST-003",
  run: ({ plan }) => {
    const raceWeek = plan.weeks.find((week) => week.isRaceWeek);
    if (!raceWeek) return [];

    const previousWeek = plan.weeks[Math.max(0, raceWeek.weekIndex - 2)];
    const priorPeakOrBuild =
      [...plan.weeks]
        .reverse()
        .find((week) => week.weekIndex < raceWeek.weekIndex && (week.phase === "peak" || week.phase === "specific" || week.phase === "build")) ?? previousWeek;
    const issues: VNextRuleResult[] = [];
    const finishLike =
      plan.resolvedInput.goalType === "finish" ||
      plan.resolvedInput.goalType === "finish_without_walking" ||
      plan.resolvedInput.goalType === "build_consistency" ||
      plan.resolvedInput.goalType === "return_to_running";

    if (raceWeek.sessions.some((session) => session.role === "long_run" || session.family === "long_run")) {
      issues.push({
        ruleId: "ST-003",
        severity: "hard_fail" as const,
        message: "Race week still contains a normal long run.",
        weekIndex: raceWeek.weekIndex,
      });
    }

    if (!raceWeek.sessions.some((session) => session.isRaceEvent)) {
      issues.push({
        ruleId: "ST-003",
        severity: "hard_fail" as const,
        message: "Race week is missing an explicit race-event session marker.",
        weekIndex: raceWeek.weekIndex,
      });
    }

    const hasDistinctSignal = raceWeek.sessions.some((session) => DISTINCT_RACE_WEEK_FAMILIES.has(session.family));
    const performanceGoal = plan.resolvedInput.goalType === "target_time" || plan.resolvedInput.goalType === "improve_time";
    if (performanceGoal && !hasDistinctSignal) {
      issues.push({
        ruleId: "ST-003",
        severity: "warning" as const,
        message: "Performance race week lacks a clear sharpening or race-specific session signal.",
        weekIndex: raceWeek.weekIndex,
      });
    }

    if (previousWeek) {
      if (raceWeek.sessions.length >= previousWeek.sessions.length && qualityCount(raceWeek) === 0 && !hasDistinctSignal) {
        issues.push({
          ruleId: "ST-003",
          severity: "warning" as const,
          message: "Race week looks too structurally similar to the previous training week.",
          weekIndex: raceWeek.weekIndex,
        });
      }
      if (raceWeek.volumeTargetMin >= previousWeek.volumeTargetMin * 0.85) {
        issues.push({
          ruleId: "ST-003",
          severity: "warning" as const,
          message: "Race week volume is still too close to the prior week.",
          weekIndex: raceWeek.weekIndex,
        });
      }
    }

    if (priorPeakOrBuild) {
      if (complexityScore(raceWeek) >= complexityScore(priorPeakOrBuild)) {
        issues.push({
          ruleId: "ST-003",
          severity: "warning" as const,
          message: "Race week still looks too complex relative to the nearest build/peak week.",
          weekIndex: raceWeek.weekIndex,
        });
      }
    }

    if (finishLike && raceWeek.sessions.some((session) => !session.isRaceEvent && (session.family === "tempo_run" || session.family === "intervals" || session.family === "race_specific"))) {
      issues.push({
        ruleId: "ST-003",
        severity: "hard_fail" as const,
        message: "Finish race week still contains performance-style quality that should be removed.",
        weekIndex: raceWeek.weekIndex,
      });
    }

    if (plan.resolvedInput.raceDistance === "Marathon") {
      const peakWeek = plan.weeks.reduce((best, week) => (week.volumeTargetMin > best.volumeTargetMin ? week : best), plan.weeks[0]);
      if (peakWeek && raceWeek.volumeTargetMin >= peakWeek.volumeTargetMin * 0.55) {
        issues.push({
          ruleId: "ST-003",
          severity: "warning" as const,
          message: "Marathon race week is still too heavy relative to peak load.",
          weekIndex: raceWeek.weekIndex,
        });
      }
    }

    return issues;
  },
};

export const taperDistinctnessRule: VNextRule<EnginePlan> = {
  id: "ST-004",
  run: ({ plan }) => {
    const taperWeeks = plan.weeks.filter((week) => week.phase === "taper" && !week.isRaceWeek);
    const comparisonWeek =
      [...plan.weeks]
        .reverse()
        .find((week) => week.phase === "build" || week.phase === "specific" || week.phase === "peak");
    if (taperWeeks.length === 0 || !comparisonWeek) return [];

    return taperWeeks.flatMap((week) => {
      const issues: VNextRuleResult[] = [];
      if (complexityScore(week) >= complexityScore(comparisonWeek)) {
        issues.push({
          ruleId: "ST-004",
          severity: "warning",
          message: "Taper week is not clearly simpler than the earlier build/peak structure.",
          weekIndex: week.weekIndex,
        });
      }
      if (week.longRunTargetMin > 0 && week.longRunTargetMin >= comparisonWeek.longRunTargetMin * 0.85) {
        issues.push({
          ruleId: "ST-004",
          severity: "warning",
          message: "Taper long run has not reduced enough from earlier training load.",
          weekIndex: week.weekIndex,
        });
      }
      return issues;
    });
  },
};
