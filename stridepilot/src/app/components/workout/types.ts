export type WorkoutPhaseKind = "warmup" | "run" | "walk" | "cooldown";

export interface PhaseEntry {
  kind: WorkoutPhaseKind;
  weight: number;
  label?: string;
}
