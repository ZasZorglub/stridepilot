import type {
  BuiltSession,
  BuiltWeek,
  PlanType,
  RunnerClassification,
  SessionValidationIssue,
  WeeklyStructure,
  WorkoutSelection,
} from "./models";

function structureAllowed(family: BuiltSession["family"], structureType: BuiltSession["structureType"]): boolean {
  if (family === "long_run") return structureType === "long_run_continuous";
  if (family === "run_walk_progression") return structureType === "run_walk_blocks" || structureType === "long_run_run_walk";
  if (family === "recovery_run") return structureType === "continuous_easy";
  if (family === "easy_run") return structureType === "continuous_easy";
  if (family === "development_run") return structureType === "continuous_easy" || structureType === "development_blocks";
  if (family === "steady_run") return structureType === "continuous_steady";
  if (family === "tempo_run") return structureType === "tempo_block" || structureType === "tempo_intervals";
  if (family === "intervals" || family === "fartlek") return structureType === "interval_repeats";
  if (family === "progression_run") return structureType === "progression_blocks";
  if (family === "strides_session") return structureType === "strides_after_easy";
  if (family === "hill_reps") return structureType === "hill_repeat_structure";
  if (family === "race_specific") return structureType === "race_specific_blocks";
  return true;
}

export function validateSession(
  session: BuiltSession,
  selection: WorkoutSelection,
  structure: WeeklyStructure,
  classification: RunnerClassification,
  planType: PlanType,
): SessionValidationIssue[] {
  const issues: SessionValidationIssue[] = [];

  if (!structureAllowed(session.family, session.structureType)) {
    issues.push({ severity: "critical", area: "structure", message: "Workout family and session structure do not match.", sessionId: session.id, weekIndex: session.weekIndex });
  }
  if (session.family === "long_run" && session.role !== "long_run") {
    issues.push({ severity: "critical", area: "purpose", message: "Long run family is assigned to a non-long-run role.", sessionId: session.id, weekIndex: session.weekIndex });
  }
  if (session.role === "recovery" && session.intensityLevel !== "very_easy" && session.intensityLevel !== "easy") {
    issues.push({ severity: "important", area: "safety", message: "Recovery session is too hard for its role.", sessionId: session.id, weekIndex: session.weekIndex });
  }
  if ((classification.traits.runnerLevel === "true_beginner" || classification.traits.runnerLevel === "beginner_plus") && (session.family === "intervals" || session.family === "hill_reps")) {
    issues.push({ severity: "critical", area: "safety", message: "Beginner session is too advanced.", sessionId: session.id, weekIndex: session.weekIndex });
  }
  if (planType.includes("finish") && (session.family === "intervals" || session.family === "race_specific") && structure.phase === "base") {
    issues.push({ severity: "important", area: "specificity", message: "Finish plan uses an overly specific session too early.", sessionId: session.id, weekIndex: session.weekIndex });
  }
  if (session.family === "long_run" && session.longRunMinContribution < structure.longRunTargetMin * 0.8) {
    issues.push({ severity: "important", area: "progression", message: "Long run does not meaningfully match weekly long-run target.", sessionId: session.id, weekIndex: session.weekIndex });
  }
  if (session.family === "recovery_run" && session.durationMin >= structure.weeklyVolumeTargetMin * 0.34) {
    issues.push({ severity: "minor", area: "structure", message: "Recovery session is drifting too long for a true low-stress role.", sessionId: session.id, weekIndex: session.weekIndex });
  }
  if (session.family === "easy_run" && session.summary.includes("steady")) {
    issues.push({ severity: "minor", area: "purpose", message: "Easy run summary reads too much like a steady session.", sessionId: session.id, weekIndex: session.weekIndex });
  }
  if (planType === "hm_finish" && (session.family === "tempo_run" || session.family === "race_specific") && (structure.phase === "build" || structure.phase === "peak")) {
    issues.push({ severity: "important", area: "specificity", message: "HM finish session is leaning too far toward performance complexity.", sessionId: session.id, weekIndex: session.weekIndex });
  }
  if (session.structure.length < 3) {
    issues.push({ severity: "minor", area: "structure", message: "Session lacks a clear warmup-main-cooldown shape.", sessionId: session.id, weekIndex: session.weekIndex });
  }
  if (selection.role === "quality" && selection.intensityCap === "intro" as never) {
    // no-op placeholder avoided; kept for future narrow selection checks
  }
  return issues;
}

export function validateWeeklySessions(
  sessions: BuiltSession[],
  selections: WorkoutSelection[],
  structure: WeeklyStructure,
  classification: RunnerClassification,
  planType: PlanType,
): SessionValidationIssue[] {
  const issues = sessions.flatMap((session, index) => validateSession(session, selections[index], structure, classification, planType));
  const longRun = sessions.find((session) => session.role === "long_run");
  const maxDuration = Math.max(...sessions.map((session) => session.durationMin));

  if (longRun && longRun.durationMin < maxDuration) {
    issues.push({ severity: "important", area: "structure", message: "Long run is not clearly the week's longest session.", sessionId: longRun.id, weekIndex: structure.weekIndex });
  }

  if (structure.totalRuns <= 2 && sessions.filter((session) => session.role === "quality").length > 1) {
    issues.push({ severity: "important", area: "safety", message: "Low-frequency week contains too much quality.", weekIndex: structure.weekIndex });
  }

  if (sessions.length >= 2) {
    for (let i = 1; i < sessions.length; i += 1) {
      if (sessions[i].structureType === sessions[i - 1].structureType && sessions[i].role === sessions[i - 1].role) {
        issues.push({ severity: "minor", area: "structure", message: "Nearby sessions repeat the same structure and role too closely.", weekIndex: structure.weekIndex });
        break;
      }
    }
  }

  const supportSessions = sessions.filter((session) => session.role !== "long_run" && session.role !== "quality");
  if (supportSessions.length >= 3) {
    const sameishSupport = supportSessions.every((session) => session.structureType === supportSessions[0]?.structureType);
    const tightDurations = Math.max(...supportSessions.map((session) => session.durationMin)) - Math.min(...supportSessions.map((session) => session.durationMin)) <= 8;
    if (sameishSupport && tightDurations) {
      issues.push({ severity: "minor", area: "purpose", message: "Support sessions blur together too much in duration and structure.", weekIndex: structure.weekIndex });
    }
  }

  const runWalkSessions = sessions.filter((session) => session.family === "run_walk_progression");
  if (
    (classification.traits.runnerLevel === "true_beginner" || classification.traits.runnerLevel === "beginner_plus") &&
    structure.continuousTargetMin >= 8 &&
    runWalkSessions.length >= 3
  ) {
    issues.push({ severity: "important", area: "progression", message: "Beginner week stays too fully run/walk despite readiness to introduce more continuous running.", weekIndex: structure.weekIndex });
  }

  if (planType.includes("marathon")) {
    const supportDurations = sessions
      .filter((session) => session.role === "aerobic_support" || session.role === "easy" || session.role === "recovery")
      .map((session) => ({ family: session.family, durationMin: session.durationMin, structureType: session.structureType }));
    if (
      supportDurations.length >= 3 &&
      new Set(supportDurations.map((session) => `${session.family}-${session.structureType}`)).size <= 2 &&
      Math.max(...supportDurations.map((session) => session.durationMin)) - Math.min(...supportDurations.map((session) => session.durationMin)) <= 10
    ) {
      issues.push({ severity: "important", area: "purpose", message: "Marathon support days are too similar and risk feeling like medium-long repeats.", weekIndex: structure.weekIndex });
    }
  }

  return issues;
}

export function validateSessionSeries(
  weeks: BuiltWeek[],
  classification: RunnerClassification,
  planType: PlanType,
): SessionValidationIssue[] {
  const issues: SessionValidationIssue[] = [];

  if (classification.traits.runnerLevel === "true_beginner" || classification.traits.runnerLevel === "beginner_plus") {
    for (let i = 1; i < weeks.length; i += 1) {
      const previous = weeks[i - 1];
      const current = weeks[i];
      const prevRunWalk = previous.sessions.filter((session) => session.family === "run_walk_progression").length;
      const currentRunWalk = current.sessions.filter((session) => session.family === "run_walk_progression").length;
      const currentContinuous = current.sessions.filter((session) => session.family === "easy_run" || session.family === "development_run").length;
      if (current.weekIndex >= 6 && prevRunWalk >= 2 && currentRunWalk >= 2 && currentContinuous === 0) {
        issues.push({
          severity: "important",
          area: "progression",
          message: "Beginner progression stays too locked in run/walk across nearby weeks.",
          weekIndex: current.weekIndex,
        });
        break;
      }
    }
  }

  const taperWeeks = weeks.filter((week) => week.phase === "taper");
  for (const week of taperWeeks) {
    const nonLongSessions = week.sessions.filter((session) => session.role !== "long_run");
    if (nonLongSessions.some((session) => session.family === "race_specific" || session.family === "progression_run")) {
      issues.push({
        severity: "minor",
        area: "specificity",
        message: "Taper still carries support sessions that feel too build-heavy.",
        weekIndex: week.weekIndex,
      });
    }
  }

  if (planType.includes("finish")) {
    const complexWeeks = weeks.filter((week) =>
      week.sessions.filter((session) => session.family === "tempo_run" || session.family === "race_specific" || session.family === "intervals").length >= 2,
    );
    if (complexWeeks.length > 0) {
      issues.push({
        severity: "important",
        area: "specificity",
        message: "Finish-plan weeks are accumulating more performance complexity than intended.",
        weekIndex: complexWeeks[0]?.weekIndex,
      });
    }
  }

  return issues;
}
