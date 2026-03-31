import type { ProgressionCurves } from "../models";

export function insertTaper(curves: ProgressionCurves): { curves: ProgressionCurves; taperWeeks: number[] } {
  return {
    curves,
    taperWeeks: [...curves.taperWeeks],
  };
}
