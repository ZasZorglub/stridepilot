import { buildAdaptationHooks } from "./buildAdaptationHooks";
import { validateVNextPlan } from "../validators/validatePlan";
import { validateEnginePlan } from "../../engine-v2/validation";
import type {
  BuiltSession,
  BuiltWeek,
  EnginePlan,
  VNextAdaptationDecision,
  VNextAdaptationMutationResult,
} from "../../engine-v2/models";

function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function cloneSessionForWeek(session: BuiltSession, targetWeekIndex: number, dayShift: number): BuiltSession {
  return {
    ...session,
    id: `${session.id}__repeat_w${targetWeekIndex}`,
    weekIndex: targetWeekIndex,
    date: shiftDate(session.date, dayShift),
    notes: [...(session.notes ?? []), `Repeated from week ${session.weekIndex}.`],
  };
}

function cloneWeekIntoTarget(sourceWeek: BuiltWeek, targetWeek: BuiltWeek): BuiltWeek {
  const dayShift = (targetWeek.weekIndex - sourceWeek.weekIndex) * 7;
  return {
    ...targetWeek,
    phase: targetWeek.phase,
    timelinePhase: targetWeek.timelinePhase,
    isCutback: true,
    isRaceWeek: false,
    volumeTargetMin: sourceWeek.volumeTargetMin,
    longRunTargetMin: sourceWeek.longRunTargetMin,
    intensityTarget: sourceWeek.intensityTarget,
    focus: `${sourceWeek.focus} (gentaget uge)`,
    sessions: sourceWeek.sessions.map((session) => cloneSessionForWeek(session, targetWeek.weekIndex, dayShift)),
    workoutSelections: sourceWeek.workoutSelections?.map((selection) => ({
      ...selection,
      weekIndex: targetWeek.weekIndex,
      isRaceWeek: false,
      isRaceEvent: false,
    })),
    validationIssues: undefined,
  };
}

function noOp(plan: EnginePlan, reason: string, sourceWeekIndex?: number, targetWeekIndex?: number): VNextAdaptationMutationResult {
  return {
    plan,
    mutation: {
      applied: false,
      mutationType: "noop",
      sourceWeekIndex,
      targetWeekIndex,
      reason,
      fallback: true,
      conservativeBiasApplied: false,
      recoveryCandidateUsed: false,
    },
  };
}

function validateMutatedPlan(
  originalPlan: EnginePlan,
  mutatedPlan: EnginePlan,
  reason: string,
  sourceWeekIndex?: number,
  targetWeekIndex?: number,
): VNextAdaptationMutationResult | undefined {
  mutatedPlan.vNextValidation = validateVNextPlan(mutatedPlan);
  mutatedPlan.adaptationHooks = buildAdaptationHooks(mutatedPlan);

  const criticalIssues = validateEnginePlan(mutatedPlan).filter((issue) => issue.severity === "critical");
  if (criticalIssues.length > 0 || (mutatedPlan.vNextValidation?.hardFailCount ?? 0) > 0) {
    return noOp(
      originalPlan,
      reason,
      sourceWeekIndex,
      targetWeekIndex,
    );
  }
  return undefined;
}

function clonePlanWithWeek(plan: EnginePlan, targetWeekIndex: number, replacement: BuiltWeek): EnginePlan {
  return {
    ...plan,
    weeks: plan.weeks.map((week) => (week.weekIndex === targetWeekIndex ? replacement : week)),
  };
}

function buildDownshiftedSession(session: BuiltSession, targetWeekIndex: number, conservativeBias: boolean): BuiltSession {
  const qualityLike = session.role === "quality" || session.family === "tempo_run" || session.family === "intervals" || session.family === "race_specific";
  if (qualityLike) {
    return {
      ...session,
      id: `${session.id}__downshift_w${targetWeekIndex}`,
      weekIndex: targetWeekIndex,
      role: "easy",
      family: "easy_run",
      title: `Nedskaleret: ${session.title}`,
      purpose: "Bevare rytme med lavere belastning efter behov for en lettere uge.",
      durationMin: Math.max(20, Math.round(session.durationMin * (conservativeBias ? 0.65 : 0.75))),
      estimatedTotalMinutes: Math.max(20, Math.round(session.estimatedTotalMinutes * (conservativeBias ? 0.65 : 0.75))),
      longRunMinContribution: 0,
      intensityLoad: Number((session.intensityLoad * (conservativeBias ? 0.5 : 0.6)).toFixed(2)),
      intensityLevel: "easy",
      summary: "Roligt erstatningspas efter behov for nedskalering.",
      notes: [...(session.notes ?? []), "Downshifted from a quality-oriented session."],
      isRaceEvent: false,
    };
  }

  return {
    ...session,
    id: `${session.id}__downshift_w${targetWeekIndex}`,
    weekIndex: targetWeekIndex,
    durationMin: Math.max(20, Math.round(session.durationMin * (conservativeBias ? 0.82 : 0.88))),
    estimatedTotalMinutes: Math.max(20, Math.round(session.estimatedTotalMinutes * (conservativeBias ? 0.82 : 0.88))),
    longRunMinContribution: session.role === "long_run"
      ? Math.max(0, Math.round(session.longRunMinContribution * (conservativeBias ? 0.8 : 0.88)))
      : session.longRunMinContribution,
    intensityLoad: Number((session.intensityLoad * (conservativeBias ? 0.78 : 0.86)).toFixed(2)),
    notes: [...(session.notes ?? []), "Week was downshifted conservatively."],
    isRaceEvent: false,
  };
}

function downshiftWeek(targetWeek: BuiltWeek, conservativeBias: boolean): BuiltWeek {
  const loadFactor = conservativeBias ? 0.82 : 0.9;
  const longRunFactor = conservativeBias ? 0.78 : 0.88;
  const intensityFactor = conservativeBias ? 0.72 : 0.82;

  return {
    ...targetWeek,
    isCutback: true,
    volumeTargetMin: Math.max(30, Math.round(targetWeek.volumeTargetMin * loadFactor)),
    longRunTargetMin: Math.max(0, Math.round(targetWeek.longRunTargetMin * longRunFactor)),
    intensityTarget: Number((targetWeek.intensityTarget * intensityFactor).toFixed(2)),
    focus: `${targetWeek.focus} (nedskaleret uge)`,
    sessions: targetWeek.sessions.map((session) => buildDownshiftedSession(session, targetWeek.weekIndex, conservativeBias)),
    workoutSelections: targetWeek.workoutSelections?.map((selection) => {
      const qualityLike = selection.role === "quality" || selection.family === "tempo_run" || selection.family === "intervals" || selection.family === "race_specific";
      return {
        ...selection,
        role: qualityLike ? "easy" : selection.role,
        family: qualityLike ? "easy_run" : selection.family,
        isRaceWeek: false,
        isRaceEvent: false,
        conservative: true,
        notes: [...(selection.notes ?? []), "Downshifted week kept local structure but reduced load and quality."],
      };
    }),
    validationIssues: undefined,
  };
}

function buildRecoverySession(session: BuiltSession, targetWeekIndex: number, conservativeBias: boolean): BuiltSession {
  const durationFactor = conservativeBias ? 0.62 : 0.72;
  const longRunFactor = conservativeBias ? 0.5 : 0.6;
  const qualityLike = session.role === "quality" || session.family === "tempo_run" || session.family === "intervals" || session.family === "race_specific";
  const longRunLike = session.role === "long_run" || session.family === "long_run";

  if (qualityLike) {
    return {
      ...session,
      id: `${session.id}__recovery_w${targetWeekIndex}`,
      weekIndex: targetWeekIndex,
      role: "recovery",
      family: "recovery_run",
      title: `Recovery: ${session.title}`,
      purpose: "Skabe en tydelig restitutionsuge med lavere krav og mere overskud.",
      durationMin: Math.max(18, Math.round(session.durationMin * durationFactor)),
      estimatedTotalMinutes: Math.max(18, Math.round(session.estimatedTotalMinutes * durationFactor)),
      longRunMinContribution: 0,
      intensityLoad: Number((session.intensityLoad * 0.35).toFixed(2)),
      intensityLevel: "very_easy",
      summary: "Meget roligt restitutionspas i stedet for kvalitet.",
      notes: [...(session.notes ?? []), "Converted to recovery for recovery microcycle."],
      isRaceEvent: false,
    };
  }

  if (longRunLike) {
    return {
      ...session,
      id: `${session.id}__recovery_w${targetWeekIndex}`,
      weekIndex: targetWeekIndex,
      role: "easy",
      family: "easy_run",
      title: `Kort recovery-langtur: ${session.title}`,
      purpose: "Holde lidt tid på benene uden at bevare normalt langtursstress.",
      durationMin: Math.max(20, Math.round(session.durationMin * longRunFactor)),
      estimatedTotalMinutes: Math.max(20, Math.round(session.estimatedTotalMinutes * longRunFactor)),
      longRunMinContribution: Math.max(0, Math.round(session.longRunMinContribution * longRunFactor)),
      intensityLoad: Number((session.intensityLoad * 0.5).toFixed(2)),
      intensityLevel: "easy",
      summary: "Kort og rolig udholdenhedsstøtte i recovery-uge.",
      notes: [...(session.notes ?? []), "Long run reduced materially for recovery microcycle."],
      isRaceEvent: false,
    };
  }

  return {
    ...session,
    id: `${session.id}__recovery_w${targetWeekIndex}`,
    weekIndex: targetWeekIndex,
    role: session.role === "aerobic_support" ? "recovery" : session.role,
    family: session.family === "steady_run" || session.family === "development_run" ? "recovery_run" : session.family,
    durationMin: Math.max(18, Math.round(session.durationMin * durationFactor)),
    estimatedTotalMinutes: Math.max(18, Math.round(session.estimatedTotalMinutes * durationFactor)),
    intensityLoad: Number((session.intensityLoad * 0.55).toFixed(2)),
    intensityLevel: session.intensityLevel === "very_easy" ? "very_easy" : "easy",
    notes: [...(session.notes ?? []), "Recovery microcycle reduced support load."],
    isRaceEvent: false,
  };
}

function recoveryMicrocycleWeek(targetWeek: BuiltWeek, conservativeBias: boolean): BuiltWeek {
  const loadFactor = conservativeBias ? 0.65 : 0.75;
  const longRunFactor = conservativeBias ? 0.45 : 0.55;
  const intensityFactor = conservativeBias ? 0.4 : 0.5;

  const sessions = targetWeek.sessions.map((session) => buildRecoverySession(session, targetWeek.weekIndex, conservativeBias));
  const trimmedSessions = sessions.length > 3
    ? sessions.filter((session, index) => !(index === sessions.length - 2 && session.role === "recovery"))
    : sessions;

  return {
    ...targetWeek,
    isCutback: true,
    volumeTargetMin: Math.max(24, Math.round(targetWeek.volumeTargetMin * loadFactor)),
    longRunTargetMin: Math.max(0, Math.round(targetWeek.longRunTargetMin * longRunFactor)),
    intensityTarget: Number((targetWeek.intensityTarget * intensityFactor).toFixed(2)),
    focus: `${targetWeek.focus} (recovery microcycle)`,
    sessions: trimmedSessions,
    workoutSelections: targetWeek.workoutSelections
      ?.slice(0, trimmedSessions.length)
      .map((selection) => {
        const qualityLike = selection.role === "quality" || selection.family === "tempo_run" || selection.family === "intervals" || selection.family === "race_specific";
        const longRunLike = selection.role === "long_run" || selection.family === "long_run";
        return {
          ...selection,
          role: qualityLike ? "recovery" : longRunLike ? "easy" : (selection.role === "aerobic_support" ? "recovery" : selection.role),
          family: qualityLike
            ? "recovery_run"
            : longRunLike
              ? "easy_run"
              : (selection.family === "steady_run" || selection.family === "development_run" ? "recovery_run" : selection.family),
          isRaceWeek: false,
          isRaceEvent: false,
          conservative: true,
          notes: [...(selection.notes ?? []), "Recovery microcycle removed quality and reduced support load."],
        };
      }),
    validationIssues: undefined,
  };
}

function applyRepeatCurrentWeek(plan: EnginePlan, decision: VNextAdaptationDecision): VNextAdaptationMutationResult {

  const sourceWeek = plan.weeks.find((week) => week.weekIndex === decision.targetWeekIndex);
  const targetWeek = plan.weeks.find((week) => week.weekIndex === decision.targetWeekIndex + 1);
  if (!sourceWeek || !targetWeek) {
    return noOp(plan, "Repeat-week mutation requires both source week and next week.", decision.targetWeekIndex, decision.targetWeekIndex + 1);
  }
  if (sourceWeek.phase === "taper" || sourceWeek.isRaceWeek) {
    return noOp(plan, "Taper or race week cannot be repeated safely.", sourceWeek.weekIndex, targetWeek.weekIndex);
  }
  if (targetWeek.isRaceWeek || targetWeek.phase === "taper") {
    return noOp(plan, "Next week is taper/race week, so repeat mutation is blocked.", sourceWeek.weekIndex, targetWeek.weekIndex);
  }
  if (sourceWeek.adaptationHooks?.boundaryKinds.includes("protected_hold") || targetWeek.adaptationHooks?.boundaryKinds.includes("protected_hold")) {
    return noOp(plan, "Protected hold boundary blocks repeat mutation.", sourceWeek.weekIndex, targetWeek.weekIndex);
  }
  if (sourceWeek.adaptationHooks?.safeReplanBoundaryAfter === false) {
    return noOp(plan, "Source week is not marked as a safe replan boundary.", sourceWeek.weekIndex, targetWeek.weekIndex);
  }

  const mutatedPlan: EnginePlan = {
    ...clonePlanWithWeek(plan, targetWeek.weekIndex, cloneWeekIntoTarget(sourceWeek, targetWeek)),
  };
  const invalid = validateMutatedPlan(
    plan,
    mutatedPlan,
    "Repeat mutation was rolled back because post-mutation validation found critical issues.",
    sourceWeek.weekIndex,
    targetWeek.weekIndex,
  );
  if (invalid) return invalid;

  return {
    plan: mutatedPlan,
    mutation: {
      applied: true,
      mutationType: "repeat_current_week",
      sourceWeekIndex: sourceWeek.weekIndex,
      targetWeekIndex: targetWeek.weekIndex,
      reason: "Next safe week was held to the current week's structure and load.",
      fallback: false,
      conservativeBiasApplied: Boolean(decision.conservativeBias),
    },
  };
}

function applyDownshiftNextWeek(plan: EnginePlan, decision: VNextAdaptationDecision): VNextAdaptationMutationResult {
  const sourceWeek = plan.weeks.find((week) => week.weekIndex === decision.targetWeekIndex);
  const targetWeekIndex = decision.nearestBoundaryWeekIndex && decision.nearestBoundaryWeekIndex > decision.targetWeekIndex
    ? decision.nearestBoundaryWeekIndex
    : decision.targetWeekIndex + 1;
  const targetWeek = plan.weeks.find((week) => week.weekIndex === targetWeekIndex);
  const conservativeBias = Boolean(decision.conservativeBias || plan.adaptationHooks?.protectedRunner);

  if (!sourceWeek || !targetWeek) {
    return noOp(plan, "Downshift mutation requires both source week and target week.", decision.targetWeekIndex, targetWeekIndex);
  }
  if (targetWeek.phase === "taper" || targetWeek.isRaceWeek) {
    return noOp(plan, "Taper or race week cannot be downshifted via local mutation.", sourceWeek.weekIndex, targetWeek.weekIndex);
  }
  if (targetWeek.adaptationHooks?.boundaryKinds.includes("protected_hold")) {
    return noOp(plan, "Protected hold boundary blocks local downshift mutation.", sourceWeek.weekIndex, targetWeek.weekIndex);
  }
  if (targetWeek.adaptationHooks?.safeReplanBoundaryBefore === false && targetWeek.adaptationHooks?.safeReplanBoundaryAfter === false) {
    return noOp(plan, "Target week is not marked as a safe local mutation point.", sourceWeek.weekIndex, targetWeek.weekIndex);
  }
  if (targetWeek.sessions.every((session) => session.role !== "quality" && session.family !== "long_run")) {
    return noOp(plan, "Target week is already too simple to downshift safely.", sourceWeek.weekIndex, targetWeek.weekIndex);
  }

  const mutatedPlan = clonePlanWithWeek(plan, targetWeek.weekIndex, downshiftWeek(targetWeek, conservativeBias));
  const invalid = validateMutatedPlan(
    plan,
    mutatedPlan,
    "Downshift mutation was rolled back because post-mutation validation found critical issues.",
    sourceWeek.weekIndex,
    targetWeek.weekIndex,
  );
  if (invalid) return invalid;

  return {
    plan: mutatedPlan,
    mutation: {
      applied: true,
      mutationType: "downshift_next_week",
      sourceWeekIndex: sourceWeek.weekIndex,
      targetWeekIndex: targetWeek.weekIndex,
      reason: "Next safe week was simplified with lower load and reduced quality.",
      fallback: false,
      conservativeBiasApplied: conservativeBias,
    },
  };
}

function applyRecoveryMicrocycle(plan: EnginePlan, decision: VNextAdaptationDecision): VNextAdaptationMutationResult {
  const sourceWeek = plan.weeks.find((week) => week.weekIndex === decision.targetWeekIndex);
  const recoveryCandidates = plan.adaptationHooks?.recoveryCandidateWeekIndices ?? [];
  const recoveryCandidateWeekIndex =
    recoveryCandidates.find((weekIndex) => weekIndex >= decision.targetWeekIndex) ??
    recoveryCandidates.find((weekIndex) => weekIndex >= decision.targetWeekIndex - 1);
  const targetWeekIndex =
    recoveryCandidateWeekIndex ??
    (decision.nearestBoundaryWeekIndex && decision.nearestBoundaryWeekIndex > decision.targetWeekIndex
      ? decision.nearestBoundaryWeekIndex
      : decision.targetWeekIndex + 1);
  const targetWeek = plan.weeks.find((week) => week.weekIndex === targetWeekIndex);
  const conservativeBias = Boolean(decision.conservativeBias || plan.adaptationHooks?.protectedRunner);

  if (!sourceWeek || !targetWeek) {
    return noOp(plan, "Recovery microcycle requires both source week and target week.", decision.targetWeekIndex, targetWeekIndex);
  }
  if (targetWeek.phase === "taper" || targetWeek.isRaceWeek) {
    return noOp(plan, "Taper or race week cannot receive a local recovery microcycle.", sourceWeek.weekIndex, targetWeek.weekIndex);
  }
  if (targetWeek.adaptationHooks?.boundaryKinds.includes("protected_hold")) {
    return noOp(plan, "Protected hold boundary blocks local recovery microcycle mutation.", sourceWeek.weekIndex, targetWeek.weekIndex);
  }
  if (targetWeek.adaptationHooks?.safeReplanBoundaryBefore === false && targetWeek.adaptationHooks?.safeReplanBoundaryAfter === false) {
    return noOp(plan, "Target week is not marked as a safe recovery mutation point.", sourceWeek.weekIndex, targetWeek.weekIndex);
  }
  const meaningfulWork = targetWeek.sessions.filter((session) => session.role === "quality" || session.role === "long_run" || session.family === "steady_run" || session.family === "development_run");
  if (meaningfulWork.length === 0) {
    return noOp(plan, "Target week is already too reduced to convert into a recovery microcycle meaningfully.", sourceWeek.weekIndex, targetWeek.weekIndex);
  }

  const mutatedPlan = clonePlanWithWeek(plan, targetWeek.weekIndex, recoveryMicrocycleWeek(targetWeek, conservativeBias));
  const invalid = validateMutatedPlan(
    plan,
    mutatedPlan,
    "Recovery microcycle mutation was rolled back because post-mutation validation found critical issues.",
    sourceWeek.weekIndex,
    targetWeek.weekIndex,
  );
  if (invalid) return invalid;

  return {
    plan: mutatedPlan,
    mutation: {
      applied: true,
      mutationType: "insert_recovery_microcycle",
      sourceWeekIndex: sourceWeek.weekIndex,
      targetWeekIndex: targetWeek.weekIndex,
      reason: "Nearest safe week was converted into a recovery-oriented microcycle with materially reduced load.",
      fallback: false,
      conservativeBiasApplied: conservativeBias,
      recoveryCandidateUsed: recoveryCandidateWeekIndex === targetWeek.weekIndex,
    },
  };
}

export function applyVNextAdaptationDecision(plan: EnginePlan, decision: VNextAdaptationDecision): VNextAdaptationMutationResult {
  if (decision.action === "repeat_current_week") {
    return applyRepeatCurrentWeek(plan, decision);
  }
  if (decision.action === "downshift_next_week") {
    return applyDownshiftNextWeek(plan, decision);
  }
  if (decision.action === "insert_recovery_microcycle") {
    return applyRecoveryMicrocycle(plan, decision);
  }
  return noOp(plan, `Action ${decision.action} is not implemented in this slice.`, decision.targetWeekIndex);
}
