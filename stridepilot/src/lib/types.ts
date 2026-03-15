export type ActivityLevel = "meget_lav" | "lav" | "moderat" | "høj" | "meget_høj";
export type GoalDistance = "5K" | "10K" | "Halvmaraton" | "Marathon";
export type CurrentRunningAbility =
  | "helt_ny"
  | "fem_min"
  | "ti_femten_min"
  | "tyve_tredive_min"
  | "mere_end_tredive_min";

export interface RunnerProfile {
  firstName?: string;
  heightCm: number;
  weightKg: number;
  age: number;
  activityLevel: ActivityLevel;
  runningExperience: "nybegynder" | "let_ovet" | "ovet";
  currentRunningAbility: CurrentRunningAbility;
  gender?: "kvinde" | "mand" | "andet" | "vil_ikke_oplyse";
  userTrainingContext?: string;
}

export interface RunnerProfileInsights {
  runnerProfile: {
    experience: "beginner" | "intermediate" | "advanced";
    confidence: "low" | "medium" | "high";
    injuryCaution: boolean;
    motivationRisk: "low" | "medium" | "high";
  };
  progressionStrategy: {
    style: "conservative" | "balanced" | "aggressive";
    preferEarlyWins: boolean;
    avoidRapidLoadIncrease: boolean;
  };
  trainingRecommendations: {
    targetSessionsPerWeek: number;
    preferShortIntervalsInitially: boolean;
  };
  coachTone: {
    style: "encouraging" | "calm" | "analytical";
  };
}

export interface FeedbackInsights {
  adjustment: "reduce_load" | "increase_load" | "hold_progression" | "insert_recovery";
  severity: "mild" | "moderate" | "strong";
  progressionPauseWeeks: number;
  coachTone: "supportive" | "motivating" | "calm";
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
  quickFeedback?: "very_easy" | "good" | "hard" | "too_hard";
  effort: number;
  completionPct: number;
  energy: number;
  painLevel: number;
  notes: string;
}
