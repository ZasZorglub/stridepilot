import type { ProgressionCurves } from "../models";

export function buildLongRunProgression(curves: ProgressionCurves): number[] {
  return [...curves.longRunCurve];
}
