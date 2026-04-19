export type ActivityLevel = "meget_lav" | "lav" | "moderat" | "høj" | "meget_høj";
export type GoalDistance = "5K" | "10K" | "Halvmaraton" | "Marathon";
export type GoalType = "complete" | "run_without_walking" | "target_time" | "pr";
export type PlanAmbition = "gentle" | "standard" | "ambitious";
export type RecommendationPlanLevel =
  | "very_easy"
  | "easy"
  | "realistic"
  | "slightly_ambitious"
  | "ambitious";
export type GuidancePreference = "simple" | "flexible" | "performance_oriented";
export type OnboardingTrack = "getting_started" | "returning" | "running_consistently" | "goal_focused";
export type CurrentRunningAbility =
  | "helt_ny"
  | "fem_min"
  | "ti_femten_min"
  | "tyve_tredive_min"
  | "mere_end_tredive_min";

export interface RecentRaceTime {
  distance: GoalDistance;
  time: string;
}

export interface RunnerProfile {
  firstName?: string;
  onboardingTrack?: OnboardingTrack;
  heightCm: number;
  weightKg: number;
  age: number;
  activityLevel: ActivityLevel;
  runningExperience: "nybegynder" | "let_ovet" | "ovet";
  currentRunningAbility: CurrentRunningAbility;
  currentContinuousDistanceKm?: number;
  gender?: "kvinde" | "mand" | "andet" | "vil_ikke_oplyse";
  userTrainingContext?: string;
  currentWeeklyVolumeKm?: number;
  currentRunsPerWeek?: number;
  longestCurrentRunMin?: number;
  recentRaceTimes?: RecentRaceTime[];
  injuryHistory?: string;
  weakPoints?: string;
  realisticTrainingDaysPerWeek?: number;
  typicalWorkoutMinutes?: number;
  otherTraining?: string;
  preferredGuidance?: GuidancePreference;
  pulseGuidanceEnabled?: boolean;
  maxHeartRate?: number | null;
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
  goalType?: GoalType;
  weeks: number;
  startDate: string;
  endDate?: string;
  reminderTime?: string;
  targetTime?: string;
  targetPaceSecPerKm?: number;
  availableTrainingDays?: WorkoutSession["dayOfWeek"][];
  preferredLongRunDay?: "saturday" | "sunday" | "both" | "flexible";
}

export interface PlanRecommendationOption {
  mode: PlanAmbition;
  label: string;
  durationWeeks: number;
  goalDate: string;
  sessionsPerWeek: number;
  progressionMode: "conservative" | "standard" | "ambitious";
  realism: "high_confidence" | "realistic" | "stretch" | "capped";
  warnings: string[];
  headline: string;
  summary: string;
  planLevel: RecommendationPlanLevel;
  planLevelLabel: string;
  planLevelExplanation: string;
  wasAdjusted: boolean;
  adjustmentMessage?: string;
}

export interface PlanRecommendation {
  recommendedDurationWeeks: number;
  minDurationWeeks: number;
  maxDurationWeeks: number;
  recommendedSessionsPerWeek: number;
  startingSessionsPerWeek: number;
  peakSessionsPerWeek: number;
  progressionMode: "conservative" | "standard" | "ambitious";
  realism: "high_confidence" | "realistic" | "stretch" | "capped";
  warnings: string[];
  summary: string;
  headline: string;
  rationaleTags: string[];
  recommendedOption: PlanRecommendationOption;
  selectedPathVariant: PlanAmbition;
  selectedOption: PlanRecommendationOption;
  options: PlanRecommendationOption[];
}

export type WorkoutStepType = "warmup" | "run" | "walk" | "cooldown";

export interface WorkoutHeartRateGuidance {
  zoneLabel: string;
  summary: string;
}

export interface WorkoutStep {
  type: WorkoutStepType;
  label: string;
  durationSec: number;
  cue: string;
  heartRateGuidance?: WorkoutHeartRateGuidance;
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
  rationale?: {
    plan?: {
      profileSummary: string[];
      structureSummary: string[];
      safetySummary: string[];
      ambitionAdjustment?: {
        applied: boolean;
        originalIntent: "finish" | "finish_comfortably" | "improve" | "target_time";
        effectiveIntent: "finish" | "finish_comfortably" | "improve" | "target_time" | "conservative_improve";
        reason: string;
      };
    };
    weeks?: Array<{
      weekNumber: number;
      summary: string;
      focus: string;
      loadShape: "build" | "stabilize" | "taper";
    }>;
    workouts?: Array<{
      sessionId: string;
      summary: string;
      purpose: string;
    }>;
    adaptation?: {
      mode: "hold" | "down_shift" | "recovery_microcycle" | "resume_build" | "progress";
      reason: string;
      changeSummary: string[];
      learnedTendencies?: string[];
      runnerFocus: string;
    };
  };
}

export interface WorkoutFeedbackInput {
  quickFeedback?: "very_easy" | "good" | "hard" | "too_hard";
  effort: number;
  completionPct: number;
  energy: number;
  painLevel: number;
  notes: string;
}

export interface SavedWorkoutSessionFeedback {
  sessionId: string;
  status: "completed" | "shortened" | "missed";
  quickFeedback?: WorkoutFeedbackInput["quickFeedback"];
  effort: number;
  completionPct: number;
  energy: number;
  painLevel: number;
  notes?: string;
  submittedAt: string;
}

export interface WeeklyHistoryPoint {
  week: number;
  completedWorkouts: number;
  plannedWorkouts: number;
  completedMinutes: number;
  longRunMinutes: number;
  longestContinuousRunMinutes: number;
}

export interface PlanHistorySummary {
  currentWeek: number;
  completedWorkouts: number;
  totalWorkouts: number;
  progressPct: number;
  weeklyVolumeHistory: Array<{ week: number; minutes: number }>;
  longRunHistory: Array<{ week: number; minutes: number }>;
  weeklyHistory: WeeklyHistoryPoint[];
}

export interface SavedPlanAdaptation {
  id: string;
  createdAt: string;
  mode: "hold" | "down_shift" | "recovery_microcycle" | "resume_build" | "progress";
  reason: string;
  runnerFocus?: string;
  changeSummary: string[];
  weekNumber?: number;
  triggeredBySessionId?: string;
}

export interface SavedProfileNote {
  id: string;
  createdAt: string;
  text: string;
}
