export type ActivityLevel = "meget_lav" | "lav" | "moderat" | "høj" | "meget_høj";
export type GoalDistance = "5K" | "10K" | "Halvmaraton" | "Marathon";

export interface RunnerProfile {
  heightCm: number;
  weightKg: number;
  age: number;
  activityLevel: ActivityLevel;
  runningExperience: "nybegynder" | "let_ovet" | "ovet";
}

export interface Goal {
  distance: GoalDistance;
  weeks: number;
  startDate: string;
  endDate?: string;
  reminderTime?: string;
  targetTime?: string;
  availableTrainingDays?: WorkoutSession["dayOfWeek"][];
}

export type WorkoutStepType = "warmup" | "run" | "walk" | "cooldown";

export interface WorkoutStep {
  type: WorkoutStepType;
  label: string;
  durationSec: number;
  cue: string;
}

export interface WorkoutSession {
  id: string;
  title: string;
  week: number;
  dayOfWeek: "Mandag" | "Tirsdag" | "Onsdag" | "Torsdag" | "Fredag" | "Lordag" | "Sondag";
  notes?: string;
  loadScore: number;
  steps: WorkoutStep[];
}

export interface TrainingPlan {
  summary: string;
  weeks: number;
  sessionsPerWeek: number;
  sessions: WorkoutSession[];
}

export interface WorkoutFeedbackInput {
  effort: number;
  completionPct: number;
  energy: number;
  painLevel: number;
  notes: string;
}
