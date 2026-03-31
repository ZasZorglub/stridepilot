import type { ProgressionCurves } from "../models";

export function insertStepBackWeeks(curves: ProgressionCurves): { curves: ProgressionCurves; stepBackWeeks: number[] } {
  return {
    curves,
    stepBackWeeks: [...curves.cutbackWeeks],
  };
}
