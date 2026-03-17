export type RunnerArchetype =
  | "nervous_beginner"
  | "motivated_novice"
  | "fit_but_inexperienced"
  | "returning_runner"
  | "overeager_runner";

export type ProgressionStyle = "conservative" | "balanced" | "steady";

export type WorkoutType =
  | "run-walk"
  | "easy"
  | "long"
  | "interval"
  | "tempo"
  | "strides"
  | "recovery"
  | "benchmark";

export type PlanPhase = "introduction" | "continuous_running" | "capacity" | "race_preparation";

export type DayOfWeek = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

export interface RunnerProfile {
  archetype: RunnerArchetype;
  aerobicBase: 1 | 2 | 3 | 4 | 5;
  runningSpecificity: 1 | 2 | 3 | 4 | 5;
  confidence: 1 | 2 | 3 | 4 | 5;
  injurySensitivity: 1 | 2 | 3 | 4 | 5;
  progressionStyle: ProgressionStyle;
}

export interface GoalConfig {
  goalDistance: "5k";
  targetDate: string;
  trainingDaysPerWeek: 2 | 3 | 4;
  startDate: string;
}

export interface WorkoutStructureSegment {
  type: "warmup" | "run" | "walk" | "cooldown" | "steady" | "tempo" | "stride" | "recovery";
  label: string;
  durationMin: number;
  repeats?: number;
  recoverMin?: number;
}

export interface WorkoutSession {
  id: string;
  week: number;
  dayOfWeek: DayOfWeek;
  date: string;
  type: WorkoutType;
  title: string;
  description: string;
  durationMin: number;
  structure: WorkoutStructureSegment[];
  intent: string;
  effortGuidance: string;
  estimatedLoad: number;
}

export interface TrainingWeek {
  weekNumber: number;
  phase: PlanPhase;
  focus: string;
  sessions: WorkoutSession[];
  estimatedLoad: number;
  isStabilizationWeek: boolean;
}

export interface PlanAdjustment {
  id: string;
  weekNumber: number;
  sessionId?: string;
  reason: string;
  effect: "reduce_load" | "hold" | "increase" | "insert_recovery";
  summary: string;
}

export interface TrainingPlan {
  goal: GoalConfig;
  profile: RunnerProfile;
  weeks: TrainingWeek[];
  sessions: WorkoutSession[];
  adjustments: PlanAdjustment[];
  explanationSummary: string[];
}

export interface WorkoutFeedback {
  sessionId: string;
  weekNumber: number;
  difficulty: "very_easy" | "good" | "hard" | "too_hard";
  energy: 1 | 2 | 3 | 4 | 5;
  pain: 1 | 2 | 3 | 4 | 5;
  completion: number;
  notes?: string;
}

export interface OnboardingInterpretationInput {
  onboardingText?: string;
  currentAbility?: string;
  goalDistance: "5K" | "10K" | "Halvmaraton" | "Marathon" | "5k";
  goalTime?: string;
  activityLevel?: "meget_lav" | "lav" | "moderat" | "høj" | "meget_høj" | string;
  confidence?: 1 | 2 | 3 | 4 | 5;
}

export interface WorkoutTemplate {
  type: WorkoutType;
  purpose: string;
  progressionNotes: string[];
}
