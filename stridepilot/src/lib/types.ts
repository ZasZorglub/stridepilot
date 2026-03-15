export type ActivityLevel = "meget_lav" | "lav" | "moderat" | "høj" | "meget_høj";
export type GoalDistance = "5K" | "10K" | "Halvmaraton" | "Marathon";
export type CurrentRunningAbility =
  | "helt_ny"
  | "fem_min"
  | "ti_femten_min"
  | "tyve_tredive_min"
  | "mere_end_tredive_min";

export interface RunnerProfile {
  heightCm: number;
  weightKg: number;
  age: number;
  activityLevel: ActivityLevel;
  runningExperience: "nybegynder" | "let_ovet" | "ovet";
  currentRunningAbility: CurrentRunningAbility;
  gender?: "kvinde" | "mand" | "andet" | "vil_ikke_oplyse";
  userTrainingContext?: string;
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
