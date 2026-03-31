import type { PhasePlan, ProgressionCurves, RunnerClassification, RunnerInput } from "../models";

function roundHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

function capGrowth(curve: number[], maxRatio: number, protectedWeeks: Set<number>): number[] {
  if (curve.length === 0) return curve;
  const adjusted = [...curve];
  for (let index = 1; index < adjusted.length; index += 1) {
    const weekIndex = index + 1;
    if (protectedWeeks.has(weekIndex)) continue;
    const previous = adjusted[index - 1];
    const maxAllowed = roundHalf(previous * (1 + maxRatio));
    if (adjusted[index] > maxAllowed) adjusted[index] = maxAllowed;
  }
  return adjusted;
}

export function applySafetyRules(params: {
  input: RunnerInput;
  classification: RunnerClassification;
  phasePlan: PhasePlan;
  curves: ProgressionCurves;
}): { curves: ProgressionCurves; reasons: string[] } {
  const reasons: string[] = [];
  const taperAndRaceWeeks = new Set(
    params.phasePlan.weeks.filter((week) => week.phase === "taper" || week.isRaceWeek).map((week) => week.weekIndex),
  );
  const cutbackWeeks = new Set(params.curves.cutbackWeeks);
  const protectedVolumeWeeks = new Set([...taperAndRaceWeeks, ...cutbackWeeks]);
  const protectedLongRunWeeks = new Set([...taperAndRaceWeeks, ...cutbackWeeks]);

  const weeklyVolumeCurve = capGrowth(params.curves.weeklyVolumeCurve, 0.08, protectedVolumeWeeks);
  const longRunCurve = capGrowth(params.curves.longRunCurve, 0.1, protectedLongRunWeeks);

  if (weeklyVolumeCurve.some((value, index) => value !== params.curves.weeklyVolumeCurve[index])) {
    reasons.push("Weekly load blev justeret, så progressionen holder sig inden for sikre stigninger uge for uge.");
  }
  if (longRunCurve.some((value, index) => value !== params.curves.longRunCurve[index])) {
    reasons.push("Langturskurven blev justeret, så langturen ikke stiger for hurtigt.");
  }

  return {
    curves: {
      ...params.curves,
      weeklyVolumeCurve,
      longRunCurve,
    },
    reasons,
  };
}
