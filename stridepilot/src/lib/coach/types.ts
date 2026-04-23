export type RunnerArchetype =
  | "nervous_beginner"
  | "motivated_novice"
  | "fit_but_inexperienced"
  | "returning_runner"
  | "overeager_runner";
export type BaseProgramTrack = "getting_started" | "returning" | "steady_runner" | "goal_focused";

export type RunnerCategory =
  | "true_beginner"
  | "run_walk_beginner"
  | "continuous_beginner"
  | "recreational"
  | "light_intermediate"
  | "intermediate"
  | "advanced";

export type ProgressionStyle = "conservative" | "balanced" | "steady";
export type GoalDistance = "5K" | "10K" | "Halvmaraton" | "Marathon";
export type GoalIntent = "finish" | "finish_comfortably" | "improve" | "target_time";
export type PlanType = "RunWalk5K" | "Continuous5K" | "FiveKImprove" | "TenKDistance" | "TenKPerformance" | "HalfMarathon" | "Marathon";

export type WorkoutType =
  | "run-walk"
  | "easy"
  | "long"
  | "interval"
  | "tempo"
  | "strides"
  | "recovery"
  | "benchmark"
  | "fartlek"
  | "hill-reps"
  | "steady"
  | "progression"
  | "race-specific";

export type PlanPhase =
  | "introduction"
  | "continuous_running"
  | "capacity"
  | "race_preparation"
  | "base"
  | "build"
  | "specific"
  | "peak"
  | "taper";

export type DayOfWeek = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

export interface RunnerProfile {
  baseProgramTrack: BaseProgramTrack;
  archetype: RunnerArchetype;
  runnerCategory?: RunnerCategory;
  aerobicBase: 1 | 2 | 3 | 4 | 5;
  runningSpecificity: 1 | 2 | 3 | 4 | 5;
  confidence: 1 | 2 | 3 | 4 | 5;
  injurySensitivity: 1 | 2 | 3 | 4 | 5;
  progressionStyle: ProgressionStyle;
  currentRunsPerWeek: number;
  currentWeeklyVolumeKm: number;
  longestRunMinutes: number;
  typicalWorkoutMinutes: number;
  realisticTrainingDaysPerWeek: number;
}

export interface GoalConfig {
  goalDistance: GoalDistance;
  goalIntent: GoalIntent;
  targetDate: string;
  trainingDaysPerWeek: 2 | 3 | 4;
  startDate: string;
  targetTime?: string;
  targetPaceSecPerKm?: number;
  preferredTrainingDays?: DayOfWeek[];
  preferredLongRunDay?: "saturday" | "sunday" | "weekday" | "flexible";
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

export interface ProgressionCurves {
  longRunCurve: number[];
  weeklyVolumeCurve: number[];
  intensityCurve: number[];
}

export interface PlanAdjustment {
  id: string;
  weekNumber: number;
  sessionId?: string;
  reason: string;
  effect: "reduce_load" | "hold" | "increase" | "insert_recovery";
  summary: string;
}

export interface AmbitionAdjustmentRationale {
  applied: boolean;
  originalIntent: GoalIntent;
  effectiveIntent: GoalIntent | "conservative_improve";
  reason: string;
}

export interface PlanRationale {
  profileSummary: string[];
  structureSummary: string[];
  safetySummary: string[];
  ambitionAdjustment?: AmbitionAdjustmentRationale;
}

export interface WeekRationale {
  weekNumber: number;
  summary: string;
  focus: string;
  loadShape: "build" | "stabilize" | "taper";
}

export interface WorkoutRationale {
  sessionId: string;
  summary: string;
  purpose: string;
}

export interface AdaptationRationale {
  mode: "hold" | "down_shift" | "recovery_microcycle" | "resume_build" | "progress";
  reason: string;
  changeSummary: string[];
  learnedTendencies?: string[];
  runnerFocus: string;
}

export interface TrainingPlan {
  planType?: PlanType;
  goal: GoalConfig;
  profile: RunnerProfile;
  weeks: TrainingWeek[];
  sessions: WorkoutSession[];
  adjustments: PlanAdjustment[];
  explanationSummary: string[];
  rationale?: {
    plan: PlanRationale;
    weeks: WeekRationale[];
    workouts: WorkoutRationale[];
  };
  curves?: ProgressionCurves;
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
  onboardingTrack?: "getting_started" | "returning" | "running_consistently" | "goal_focused";
  recentRunningState?: "recent" | "returning" | "long_break_or_new";
  onboardingText?: string;
  injuryHistory?: string;
  weakPoints?: string;
  otherTraining?: string;
  currentAbility?: string;
  goalDistance: GoalDistance | "5k";
  goalTime?: string;
  goalType?: "complete" | "run_without_walking" | "target_time" | "pr";
  activityLevel?: "meget_lav" | "lav" | "moderat" | "høj" | "meget_høj" | string;
  confidence?: 1 | 2 | 3 | 4 | 5;
  currentRunsPerWeek?: number;
  currentWeeklyVolumeKm?: number;
  longestRunMinutes?: number;
  realisticTrainingDaysPerWeek?: number;
  typicalWorkoutMinutes?: number;
  preferredGuidance?: "simple" | "flexible" | "performance_oriented";
}

export interface WorkoutTemplate {
  type: WorkoutType;
  purpose: string;
  progressionNotes: string[];
}
