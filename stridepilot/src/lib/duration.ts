export function normalizeStepDuration(seconds: number, min = 30, max = 4 * 60 * 60): number {
  const raw = Number.isFinite(seconds) ? seconds : min;
  const clamped = Math.max(min, Math.min(max, raw));
  return Math.round(clamped / 30) * 30;
}

export function formatReadableDurationFromSeconds(totalSec: number): string {
  if (!Number.isFinite(totalSec) || totalSec <= 0) return "0 min";
  if (totalSec < 60) return `${Math.round(totalSec)} sek`;

  const totalMinutes = totalSec / 60;
  if (totalMinutes >= 60) {
    const roundedMinutes = Math.round(totalMinutes);
    const hours = Math.floor(roundedMinutes / 60);
    const minutes = roundedMinutes % 60;
    return minutes > 0 ? `${hours} t ${minutes} min` : `${hours} t`;
  }

  if (Number.isInteger(totalMinutes)) return `${totalMinutes} min`;
  return `${totalMinutes.toFixed(1).replace(".", ",")} min`;
}
