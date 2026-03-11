export function normalizeStepDuration(seconds: number, min = 30, max = 20 * 60): number {
  const raw = Number.isFinite(seconds) ? seconds : min;
  const clamped = Math.max(min, Math.min(max, raw));
  return Math.round(clamped / 30) * 30;
}
