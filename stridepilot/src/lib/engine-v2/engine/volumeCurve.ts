import type { ProgressionCurves } from "../models";

export function buildWeeklyVolumeCurve(curves: ProgressionCurves): number[] {
  return [...curves.weeklyVolumeCurve];
}
