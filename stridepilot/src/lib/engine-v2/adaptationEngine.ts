import type { AdaptationResult, EnginePlan, FeedbackSignal, ProgressionCurves } from "./models";

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function scaleCurve(curve: number[], startWeekIndex: number, factor: number): number[] {
  return curve.map((value, index) => (index + 1 >= startWeekIndex ? Math.round(value * factor * 2) / 2 : value));
}

function withScaledCurves(plan: EnginePlan, startWeekIndex: number, factors: { long: number; volume: number; intensity: number }): ProgressionCurves {
  return {
    ...plan.curves,
    longRunCurve: scaleCurve(plan.curves.longRunCurve, startWeekIndex, factors.long),
    weeklyVolumeCurve: scaleCurve(plan.curves.weeklyVolumeCurve, startWeekIndex, factors.volume),
    intensityCurve: scaleCurve(plan.curves.intensityCurve, startWeekIndex, factors.intensity),
  };
}

export function adaptCurvesFromFeedback(plan: EnginePlan, feedback: FeedbackSignal[]): AdaptationResult {
  const recent = feedback.slice(-6);
  const hardCount = recent.filter((entry) => entry.perceivedDifficulty === "hard" || entry.perceivedDifficulty === "too_hard").length;
  const tooEasyCount = recent.filter((entry) => entry.perceivedDifficulty === "too_easy").length;
  const painCount = recent.filter((entry) => entry.pain >= 3).length;
  const missedCount = recent.filter((entry) => entry.completionPct < 70).length;
  const lowEnergyCount = recent.filter((entry) => entry.energy <= 2).length;
  const startWeekIndex = Math.max(2, Math.min(...recent.map((entry) => entry.weekIndex)));
  const lastEnergy = recent.length >= 1 ? recent[recent.length - 1].energy : 0;
  const previousEnergy = recent.length >= 2 ? recent[recent.length - 2].energy : 0;

  let mode: AdaptationResult["mode"] = "hold";
  const reasons: string[] = [];
  let updatedCurves: ProgressionCurves = plan.curves;

  if (painCount >= 1 || (missedCount >= 2 && lowEnergyCount >= 2)) {
    mode = "recovery_microcycle";
    reasons.push("Recent feedback shows pain or a clear inability to absorb load, so the engine inserts a more protective microcycle.");
    updatedCurves = withScaledCurves(plan, startWeekIndex, { long: 0.8, volume: 0.82, intensity: 0.75 });
  } else if (hardCount >= 2 || missedCount >= 2 || lowEnergyCount >= 2) {
    mode = "down_shift";
    reasons.push("Recent sessions are trending too hard, so the engine lowers the next part of the curve instead of forcing progression.");
    updatedCurves = withScaledCurves(plan, startWeekIndex, { long: 0.9, volume: 0.92, intensity: 0.88 });
  } else if (tooEasyCount >= 3 && average(recent.map((entry) => entry.energy)) >= 4 && painCount === 0) {
    mode = "progress";
    reasons.push("Repeated too-easy signals with good energy support a small upward shift in challenge.");
    updatedCurves = withScaledCurves(plan, startWeekIndex, { long: 1.04, volume: 1.05, intensity: 1.08 });
  } else if (recent.length >= 3 && lastEnergy >= 4 && previousEnergy >= 4 && hardCount <= 1) {
    mode = "resume_build";
    reasons.push("Recent feedback suggests the runner has steadied after a rough patch, so the engine resumes building cautiously.");
  } else {
    reasons.push("Recent feedback is broadly absorbable, so the engine holds the current progression path.");
  }

  return { mode, updatedCurves, reasons };
}
