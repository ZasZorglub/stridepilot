import type { RacePerformancePrediction, RacePerformancePredictionInput } from "./models";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roundSeconds(value: number): number {
  return Math.round(value);
}

function formatTime(totalSeconds: number): string {
  const safe = Math.max(0, roundSeconds(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatPace(secondsPerKm: number): string {
  const safe = Math.max(0, roundSeconds(secondsPerKm));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")} /km`;
}

function runnerLevelMultiplier(level: RacePerformancePredictionInput["runnerLevel"]): number {
  if (level === "true_beginner") return 1.18;
  if (level === "beginner_plus") return 1.1;
  if (level === "recreational") return 1.02;
  if (level === "intermediate") return 0.95;
  return 0.9;
}

function consistencyAdjustment(consistencyScore: number): number {
  return clamp(1 - (consistencyScore - 0.5) * 0.16, 0.9, 1.1);
}

function loadAdjustment(weeklyLoad: number, sessionsPerWeek: number): number {
  const loadScore = clamp((weeklyLoad - 90) / 240, -0.2, 0.22);
  const frequencyScore = clamp((sessionsPerWeek - 3) * 0.025, -0.06, 0.06);
  return clamp(1 - loadScore - frequencyScore, 0.88, 1.12);
}

function rpeAdjustment(recentRPE?: number): number {
  if (recentRPE == null) return 1;
  if (recentRPE <= 5) return 0.98;
  if (recentRPE <= 7) return 1;
  return clamp(1 + (recentRPE - 7) * 0.025, 1, 1.08);
}

function baseFiveKPaceSeconds(input: RacePerformancePredictionInput): number {
  const continuous = Math.max(input.continuousDuration, 1);
  const longRun = Math.max(input.longRunDuration, continuous);
  const continuityEffect = clamp(420 - continuous * 2.4, 255, 440);
  const longRunBonus = clamp((longRun - 30) * 0.18, -8, 18);
  const base = continuityEffect - longRunBonus;
  const adjusted =
    base *
    runnerLevelMultiplier(input.runnerLevel) *
    consistencyAdjustment(input.consistencyScore) *
    loadAdjustment(input.weeklyLoad, input.sessionsPerWeek) *
    rpeAdjustment(input.recentRPE);
  return clamp(adjusted, 255, 480);
}

function raceTimeFromPace(distanceKm: number, secondsPerKm: number): number {
  return roundSeconds(distanceKm * secondsPerKm);
}

function longerRacePace(basePace: number, multiplier: number, longRunDuration: number, weeklyLoad: number): number {
  const enduranceBonus = clamp((longRunDuration - 60) * 0.0025 + (weeklyLoad - 180) * 0.0005, -0.03, 0.05);
  return basePace * (multiplier - enduranceBonus);
}

export function predictRacePerformance(input: RacePerformancePredictionInput): RacePerformancePrediction {
  const fiveKPace = baseFiveKPaceSeconds(input);
  const tenKPace = longerRacePace(fiveKPace, 1.055, input.longRunDuration, input.weeklyLoad);
  const halfMarathonPace = longerRacePace(fiveKPace, 1.13, input.longRunDuration, input.weeklyLoad);
  const marathonPace = longerRacePace(fiveKPace, 1.22, input.longRunDuration, input.weeklyLoad);

  return {
    fiveKTime: formatTime(raceTimeFromPace(5, fiveKPace)),
    tenKTime: formatTime(raceTimeFromPace(10, tenKPace)),
    halfMarathonTime: formatTime(raceTimeFromPace(21.0975, halfMarathonPace)),
    marathonTime: formatTime(raceTimeFromPace(42.195, marathonPace)),
    goalPacePerKm: formatPace(fiveKPace),
  };
}
