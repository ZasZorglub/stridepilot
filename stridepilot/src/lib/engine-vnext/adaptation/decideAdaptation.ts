import type {
  EnginePlan,
  VNextAdaptationDecision,
  VNextAdaptationFeedback,
  VNextAdaptationReasonCode,
} from "../../engine-v2/models";

function complianceRate(feedback: VNextAdaptationFeedback): number {
  if (feedback.sessionsPlanned <= 0) return 0;
  return feedback.sessionsCompleted / feedback.sessionsPlanned;
}

function nearestBoundaryWeekIndex(plan: EnginePlan, weekIndex: number): number | undefined {
  const boundaries = plan.adaptationHooks?.boundaryWeeks ?? [];
  const boundary = boundaries.find((entry) => entry.weekIndex >= weekIndex);
  return boundary?.weekIndex ?? boundaries.at(-1)?.weekIndex;
}

function nearestRecoveryCandidate(plan: EnginePlan, weekIndex: number): number | undefined {
  const candidates = plan.adaptationHooks?.recoveryCandidateWeekIndices ?? [];
  return candidates.find((entry) => entry >= weekIndex) ?? candidates.find((entry) => entry >= Math.max(1, weekIndex - 1));
}

function reasonedDecision(
  action: VNextAdaptationDecision["action"],
  feedback: VNextAdaptationFeedback,
  conservativeBias: boolean,
  reasonCodes: VNextAdaptationReasonCode[],
  boundaryWeekIndex?: number,
): VNextAdaptationDecision {
  return {
    action,
    reasonCodes,
    targetWeekIndex: feedback.targetWeekIndex,
    nearestBoundaryWeekIndex: boundaryWeekIndex,
    conservativeBias,
  };
}

export function decideVNextAdaptation(plan: EnginePlan, feedback: VNextAdaptationFeedback): VNextAdaptationDecision {
  const week = plan.weeks.find((entry) => entry.weekIndex === feedback.targetWeekIndex);
  const hooks = week?.adaptationHooks;
  const conservativeBias = Boolean(plan.adaptationHooks?.protectedRunner || hooks?.protectedRunnerBias);
  const boundaryWeekIndex = nearestBoundaryWeekIndex(plan, feedback.targetWeekIndex);
  const recoveryWeekIndex = nearestRecoveryCandidate(plan, feedback.targetWeekIndex);
  const compliance = complianceRate(feedback);

  if (!week || !hooks || !plan.adaptationHooks?.adaptationReady) {
    return reasonedDecision(
      "keep_current_progression",
      feedback,
      conservativeBias,
      ["boundary_limited"],
      boundaryWeekIndex,
    );
  }

  if (week.isRaceWeek || week.phase === "taper" || hooks.progressionGate === "restricted") {
    const reasonCodes: VNextAdaptationReasonCode[] = ["restricted_phase"];
    if (hooks.progressionGate === "restricted") reasonCodes.push("progression_gate_hold");
    return reasonedDecision("keep_current_progression", feedback, conservativeBias, reasonCodes, boundaryWeekIndex);
  }

  if (feedback.painFlag) {
    const reasonCodes: VNextAdaptationReasonCode[] = ["pain_flag"];
    if (conservativeBias) reasonCodes.push("protected_runner_bias");
    if (recoveryWeekIndex !== undefined) {
      reasonCodes.push("recovery_candidate_available");
      return reasonedDecision("insert_recovery_microcycle", feedback, true, reasonCodes, recoveryWeekIndex);
    }
    return reasonedDecision("downshift_next_week", feedback, true, reasonCodes, boundaryWeekIndex);
  }

  if (feedback.fatigue === "high" && (hooks.recoveryMicrocycleCandidate || recoveryWeekIndex !== undefined)) {
    const reasonCodes: VNextAdaptationReasonCode[] = ["high_fatigue", "recovery_candidate_available"];
    if (conservativeBias) reasonCodes.push("protected_runner_bias");
    return reasonedDecision(
      "insert_recovery_microcycle",
      feedback,
      conservativeBias,
      reasonCodes,
      recoveryWeekIndex ?? boundaryWeekIndex,
    );
  }

  const lowComplianceThreshold = conservativeBias ? 0.75 : 0.65;
  if (compliance < lowComplianceThreshold) {
    const reasonCodes: VNextAdaptationReasonCode[] = ["low_compliance"];
    if (conservativeBias) reasonCodes.push("protected_runner_bias");
    if (hooks.repeatWeekCandidate) {
      reasonCodes.push("repeat_candidate_available");
      return reasonedDecision("repeat_current_week", feedback, conservativeBias, reasonCodes, boundaryWeekIndex);
    }
    return reasonedDecision("downshift_next_week", feedback, conservativeBias, reasonCodes, boundaryWeekIndex);
  }

  if (hooks.progressionGate === "hold" || feedback.fatigue === "moderate" || feedback.confidence === "low") {
    return reasonedDecision(
      "repeat_current_week",
      feedback,
      conservativeBias,
      ["progression_gate_hold"],
      boundaryWeekIndex,
    );
  }

  return reasonedDecision(
    "keep_current_progression",
    feedback,
    conservativeBias,
    ["progression_gate_open"],
    boundaryWeekIndex,
  );
}
