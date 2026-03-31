import type { PhasePlan, ProgressionCurves, RunnerClassification, RunnerInput } from "../../engine-v2/models";

export interface ReturnToRunningWeekState {
  weekIndex: number;
  continuityGatePassed: boolean;
  qualityEligible: boolean;
  runWalkPreferred: boolean;
  maxSessionsAllowed: number;
}

export interface ReturnToRunningPlanState {
  active: boolean;
  stableWeeksRequired: number;
  continuityGateMin: number;
  graduationContinuousMin: number;
  graduationLongestRunMin: number;
  graduationConsistencyMin: number;
  weeklyStates: ReturnToRunningWeekState[];
  graduationEligible: boolean;
  reasons: string[];
}

export function buildReturnToRunningState(params: {
  input: RunnerInput;
  classification: RunnerClassification;
  phasePlan: PhasePlan;
  curves: ProgressionCurves;
}): ReturnToRunningPlanState | undefined {
  const active =
    params.input.goalType === "return_to_running" ||
    params.classification.traits.primaryRunnerType === "return_to_running";

  if (!active) return undefined;

  const stableWeeksRequired = 3;
  const continuityGateMin = 20;
  const graduationContinuousMin = 25;
  const graduationLongestRunMin = 35;
  const graduationConsistencyMin = 0.55;

  const weeklyStates = params.phasePlan.weeks.map((week) => {
    const continuityTarget = params.curves.continuousCurve[week.weekIndex - 1] ?? params.input.currentContinuousRunMin;
    const continuityGatePassed = week.weekIndex > stableWeeksRequired && continuityTarget >= continuityGateMin;
    const qualityEligible = false;
    const runWalkPreferred = !continuityGatePassed;
    const maxSessionsAllowed = continuityGatePassed ? 3 : 2;

    return {
      weekIndex: week.weekIndex,
      continuityGatePassed,
      qualityEligible,
      runWalkPreferred,
      maxSessionsAllowed,
    };
  });

  const graduationEligible =
    Math.max(...params.curves.continuousCurve, params.input.currentContinuousRunMin) >= graduationContinuousMin &&
    Math.max(...params.curves.longRunCurve, params.input.longestRecentRunMin) >= graduationLongestRunMin &&
    params.classification.traits.consistencyScore >= graduationConsistencyMin;

  const reasons = [
    "Return-to-running bruger lavere progression og holder kompleksitet tilbage, indtil kontinuiteten ser stabil ud.",
  ];
  if (graduationEligible) {
    reasons.push("Planen opfylder kriterierne for at kunne graduate til et standard beginner-forløb i et senere slice.");
  }

  return {
    active: true,
    stableWeeksRequired,
    continuityGateMin,
    graduationContinuousMin,
    graduationLongestRunMin,
    graduationConsistencyMin,
    weeklyStates,
    graduationEligible,
    reasons,
  };
}
