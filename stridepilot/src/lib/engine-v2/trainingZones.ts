import type { TrainingZones, TrainingZonesInput } from "./models";

function roundSeconds(value: number): number {
  return Math.round(value);
}

function formatPace(secondsPerKm: number): string {
  const safe = Math.max(0, roundSeconds(secondsPerKm));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")} /km`;
}

function paceFromMinutesAndDistance(predictedRaceTime: number, raceDistance: number): number {
  const totalSeconds = predictedRaceTime * 60;
  return totalSeconds / Math.max(raceDistance, 0.1);
}

export function calculateTrainingZones(input: TrainingZonesInput): TrainingZones {
  const goalPaceSeconds = paceFromMinutesAndDistance(input.predictedRaceTime, input.raceDistance);

  return {
    goalPace: formatPace(goalPaceSeconds),
    recoveryPace: formatPace(goalPaceSeconds + 105),
    easyPace: formatPace(goalPaceSeconds + 75),
    steadyPace: formatPace(goalPaceSeconds + 38),
    tempoPace: formatPace(goalPaceSeconds + 15),
    intervalPace: formatPace(goalPaceSeconds - 20),
    repetitionPace: formatPace(goalPaceSeconds - 45),
  };
}
