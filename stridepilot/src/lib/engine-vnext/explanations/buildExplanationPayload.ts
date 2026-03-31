import type {
  BuiltWeek,
  EnginePlan,
  VNextAdaptivePassResult,
} from "../../engine-v2/models";

export interface ExplanationSessionSummary {
  day: string;
  role: string;
  family: string;
  durationMin: number;
  isRaceEvent: boolean;
}

export interface PlanExplanationPayload {
  kind: "plan_summary";
  runnerContext: {
    raceDistance: string;
    goalType: string;
    planType: string;
    runnerLevel: string;
    protectedRunner: boolean;
    versionNumber: number;
  };
  progressionSummary: {
    totalWeeks: number;
    sessionsPerWeekStart: number;
    sessionsPerWeekPeak: number;
    longRunStartMin: number;
    longRunPeakMin: number;
    phaseSequence: string[];
  };
  safetySummary: {
    returnToRunningActive: boolean;
    validationWarnings: number;
    validationHardFails: number;
  };
  groundingFacts: string[];
}

export interface WeekExplanationPayload {
  kind: "week_summary";
  runnerContext: {
    planType: string;
    protectedRunner: boolean;
    versionNumber: number;
  };
  weekContext: {
    weekIndex: number;
    phase: string;
    isCutback: boolean;
    isRaceWeek: boolean;
    focus: string;
    volumeTargetMin: number;
    longRunTargetMin: number;
    intensityTarget: number;
    progressionGate?: string;
  };
  structureSummary: {
    sessionCount: number;
    qualityCount: number;
    sessionSummaries: ExplanationSessionSummary[];
  };
  groundingFacts: string[];
}

export interface AdaptationExplanationPayload {
  kind: "adaptation_summary";
  runnerContext: {
    planType: string;
    protectedRunner: boolean;
    versionNumber: number;
    isAdaptiveDerivative: boolean;
  };
  adaptationContext: {
    targetWeekIndex: number;
    action: string;
    applied: boolean;
    fallback: boolean;
    mutationType: string;
    conservativeBias: boolean;
    reasonCodes: string[];
  };
  mutationSummary: {
    sourceVersionNumber: number;
    resultingVersionNumber: number;
    sourceWeekIndex?: number;
    targetWeekIndex?: number;
    recoveryCandidateUsed?: boolean;
  };
  validationSummary: {
    passed: boolean;
    vNextWarningCount: number;
    vNextHardFailCount: number;
    criticalIssueCount: number;
  };
  groundingFacts: string[];
}

function summarizeSessions(week: BuiltWeek): ExplanationSessionSummary[] {
  return week.sessions.map((session) => ({
    day: session.day,
    role: session.role,
    family: session.family,
    durationMin: session.durationMin,
    isRaceEvent: session.isRaceEvent === true,
  }));
}

function buildPlanFacts(plan: EnginePlan): string[] {
  return [
    `Plan type: ${plan.planTypeDecision.planType}`,
    `Goal: ${plan.resolvedInput.goalType} for ${plan.resolvedInput.raceDistance}`,
    `Runner level: ${plan.classification.traits.runnerLevel}`,
    `Total weeks: ${plan.weeks.length}`,
    `Protected runner: ${Boolean(plan.adaptationHooks?.protectedRunner)}`,
    `Long run progression: ${plan.curves.longRunCurve[0]} -> ${Math.max(...plan.curves.longRunCurve)}`,
  ];
}

function buildWeekFacts(plan: EnginePlan, week: BuiltWeek): string[] {
  return [
    `Week ${week.weekIndex} is in phase ${week.phase}`,
    `Week focus: ${week.focus}`,
    `Session count: ${week.sessions.length}`,
    `Quality sessions: ${week.sessions.filter((session) => session.role === "quality").length}`,
    `Long run target: ${week.longRunTargetMin}`,
    `Protected runner: ${Boolean(plan.adaptationHooks?.protectedRunner)}`,
  ];
}

function buildAdaptationFacts(result: VNextAdaptivePassResult): string[] {
  return [
    `Decision action: ${result.decision.action}`,
    `Mutation type: ${result.mutation.mutationType}`,
    `Applied: ${result.applied}`,
    `Fallback: ${result.fallback}`,
    `Protected runner: ${result.originalPlanMeta.protectedRunner}`,
    `Version transition: ${result.historyEntry.sourceVersionNumber} -> ${result.historyEntry.resultingVersionNumber}`,
  ];
}

export function buildPlanExplanationPayload(plan: EnginePlan): PlanExplanationPayload {
  return {
    kind: "plan_summary",
    runnerContext: {
      raceDistance: plan.resolvedInput.raceDistance,
      goalType: plan.resolvedInput.goalType,
      planType: plan.planTypeDecision.planType,
      runnerLevel: plan.classification.traits.runnerLevel,
      protectedRunner: Boolean(plan.adaptationHooks?.protectedRunner),
      versionNumber: plan.versionMetadata?.versionNumber ?? 1,
    },
    progressionSummary: {
      totalWeeks: plan.weeks.length,
      sessionsPerWeekStart: plan.curves.sessionsPerWeekCurve[0] ?? plan.weeks[0]?.sessions.length ?? 0,
      sessionsPerWeekPeak: Math.max(...plan.curves.sessionsPerWeekCurve),
      longRunStartMin: plan.curves.longRunCurve[0] ?? 0,
      longRunPeakMin: Math.max(...plan.curves.longRunCurve),
      phaseSequence: [...new Set(plan.weeks.map((week) => week.phase))],
    },
    safetySummary: {
      returnToRunningActive: Boolean(plan.returnToRunningState?.active),
      validationWarnings: plan.vNextValidation?.warningCount ?? 0,
      validationHardFails: plan.vNextValidation?.hardFailCount ?? 0,
    },
    groundingFacts: buildPlanFacts(plan),
  };
}

export function buildWeekExplanationPayload(plan: EnginePlan, weekIndex: number): WeekExplanationPayload {
  const week = plan.weeks.find((entry) => entry.weekIndex === weekIndex);
  if (!week) {
    throw new Error(`Week ${weekIndex} was not found in plan.`);
  }

  return {
    kind: "week_summary",
    runnerContext: {
      planType: plan.planTypeDecision.planType,
      protectedRunner: Boolean(plan.adaptationHooks?.protectedRunner),
      versionNumber: plan.versionMetadata?.versionNumber ?? 1,
    },
    weekContext: {
      weekIndex: week.weekIndex,
      phase: week.phase,
      isCutback: week.isCutback,
      isRaceWeek: week.isRaceWeek,
      focus: week.focus,
      volumeTargetMin: week.volumeTargetMin,
      longRunTargetMin: week.longRunTargetMin,
      intensityTarget: week.intensityTarget,
      progressionGate: week.adaptationHooks?.progressionGate,
    },
    structureSummary: {
      sessionCount: week.sessions.length,
      qualityCount: week.sessions.filter((session) => session.role === "quality").length,
      sessionSummaries: summarizeSessions(week),
    },
    groundingFacts: buildWeekFacts(plan, week),
  };
}

export function buildAdaptationExplanationPayload(result: VNextAdaptivePassResult): AdaptationExplanationPayload {
  return {
    kind: "adaptation_summary",
    runnerContext: {
      planType: result.finalPlan.planTypeDecision.planType,
      protectedRunner: result.originalPlanMeta.protectedRunner,
      versionNumber: result.finalPlan.versionMetadata?.versionNumber ?? 1,
      isAdaptiveDerivative: result.finalPlan.versionMetadata?.isAdaptiveDerivative ?? false,
    },
    adaptationContext: {
      targetWeekIndex: result.feedback.targetWeekIndex,
      action: result.decision.action,
      applied: result.applied,
      fallback: result.fallback,
      mutationType: result.mutation.mutationType,
      conservativeBias: result.decision.conservativeBias,
      reasonCodes: result.decision.reasonCodes,
    },
    mutationSummary: {
      sourceVersionNumber: result.historyEntry.sourceVersionNumber,
      resultingVersionNumber: result.historyEntry.resultingVersionNumber,
      sourceWeekIndex: result.mutation.sourceWeekIndex,
      targetWeekIndex: result.mutation.targetWeekIndex,
      recoveryCandidateUsed: result.mutation.recoveryCandidateUsed,
    },
    validationSummary: {
      passed: result.finalValidation.passed,
      vNextWarningCount: result.finalValidation.vNextWarningCount,
      vNextHardFailCount: result.finalValidation.vNextHardFailCount,
      criticalIssueCount: result.finalValidation.criticalIssueCount,
    },
    groundingFacts: buildAdaptationFacts(result),
  };
}
