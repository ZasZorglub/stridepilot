export type WorkoutPhaseKind = "warmup" | "run" | "walk" | "cooldown";

export interface PhaseEntry {
  kind: WorkoutPhaseKind;
  weight: number;
  label?: string;
}

export interface LiveWorkoutCardProps {
  phase: WorkoutPhaseKind;
  phaseLabel: string;
  remainingTime: string;
  progress: number;
  cue: string;
  heartRate?: number | null;
  paused?: boolean;
  anticipating?: boolean;
  anticipationNum?: 1 | 2 | 3 | null;
  transitionKey?: string | number;
  nextPhaseKind?: WorkoutPhaseKind | null;
  resumeN?: 0 | 1 | 2 | 3;
}
