export type RaceDistance = "5K" | "10K" | "HalfMarathon" | "Marathon";
export type GoalType =
  | "finish"
  | "finish_without_walking"
  | "build_consistency"
  | "improve_time"
  | "target_time"
  | "return_to_running";
export type TrainingStyle = "conservative" | "balanced" | "performance";
export type ExperienceLevel = "none" | "new" | "recreational" | "intermediate" | "advanced";
export type RunnerLevel =
  | "true_beginner"
  | "beginner_plus"
  | "recreational"
  | "intermediate"
  | "advanced";
export type PrimaryRunnerType =
  | "true_beginner"
  | "beginner_plus"
  | "recreational"
  | "intermediate"
  | "advanced_recreational"
  | "return_to_running"
  | "injury_sensitive"
  | "low_availability_runner"
  | "performance_oriented"
  | "consistency_builder";
export type RunnerModifier =
  | "injury_sensitive"
  | "low_confidence"
  | "high_consistency"
  | "low_availability"
  | "high_external_load"
  | "performance_bias"
  | "conservative_bias"
  | "return_from_break"
  | "consistency_first";
export type PlanType =
  | "5k_finish"
  | "5k_finish_no_walk"
  | "5k_improve"
  | "5k_target_time"
  | "10k_finish"
  | "10k_improve"
  | "10k_target_time"
  | "hm_finish"
  | "hm_improve"
  | "hm_target_time"
  | "marathon_finish"
  | "marathon_improve"
  | "marathon_target_time"
  | "return_to_running"
  | "consistency_builder";
export type Phase = "base" | "build" | "specific" | "peak" | "taper";
export type ConfidenceProfile = "fragile" | "cautious" | "stable" | "confident";
export type ConsistencyProfile = "sporadic" | "developing" | "stable" | "high";
export type ScheduleConstraintLevel = "low" | "moderate" | "high";
export type WorkoutFamily =
  | "easy_run"
  | "recovery_run"
  | "steady_run"
  | "development_run"
  | "tempo_run"
  | "intervals"
  | "fartlek"
  | "hill_reps"
  | "progression_run"
  | "strides_session"
  | "long_run"
  | "run_walk_progression"
  | "race_specific";
export type WeeklyRole = "quality" | "aerobic_support" | "easy" | "recovery" | "long_run";
export type WarmupType = "brisk_walk" | "walk_jog" | "easy_jog";
export type AdaptationMode = "hold" | "down_shift" | "recovery_microcycle" | "resume_build" | "progress";
export type DayOfWeek = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
export type LoadDimension = "long_run" | "weekly_volume" | "intensity" | "continuous_running" | "stabilize";
export type WeeklyEmphasis =
  | "base_support"
  | "durability_build"
  | "specific_development"
  | "peak_specificity"
  | "recovery_absorption"
  | "taper_freshness";
export type WorkoutPurpose =
  | "build_tolerance"
  | "build_consistency"
  | "build_aerobic_base"
  | "support_recovery"
  | "build_long_run_durability"
  | "improve_threshold"
  | "improve_speed_support"
  | "improve_rhythm"
  | "build_race_specific_endurance"
  | "sharpen_without_fatigue";
export type SessionStructureType =
  | "continuous_easy"
  | "continuous_steady"
  | "development_blocks"
  | "run_walk_blocks"
  | "interval_repeats"
  | "tempo_block"
  | "tempo_intervals"
  | "progression_blocks"
  | "long_run_continuous"
  | "long_run_run_walk"
  | "strides_after_easy"
  | "hill_repeat_structure"
  | "race_specific_blocks";
export type SessionIntensityLevel = "very_easy" | "easy" | "steady" | "moderate" | "comfortably_hard" | "hard";

export interface RunnerInput {
  raceDistance: RaceDistance;
  goalType: GoalType;
  startDate: string;
  goalDate: string;
  currentContinuousRunMin: number;
  currentWeeklyRuns: number;
  currentWeeklyVolumeKm: number;
  longestRecentRunMin: number;
  recentConsistency: number;
  availableTrainingDays: DayOfWeek[];
  preferredLongRunDay?: "saturday" | "sunday" | "weekday" | "flexible";
  typicalAvailableTimeMin: number;
  trainingStylePreference: TrainingStyle;
  externalTrainingLoad?: "none" | "light" | "moderate" | "high";
  injuryConcern?: "none" | "low" | "moderate" | "high";
  confidence?: number;
  age?: number;
  weightKg?: number;
  sex?: "female" | "male" | "other" | "prefer_not_to_say";
  experienceLevel: ExperienceLevel;
  recentBestTimes?: Partial<Record<RaceDistance, string>>;
  freeTextFlags?: string[];
  recentFeedbackTendencies?: Array<"struggles_to_finish" | "needs_caution" | "recovers_well" | "finds_training_too_easy" | "finds_training_too_hard">;
}

export interface RunnerTraits {
  runnerLevel: RunnerLevel;
  primaryRunnerType: PrimaryRunnerType;
  modifiers: RunnerModifier[];
  durabilityScore: number;
  progressionTolerance: number;
  intensityReadiness: number;
  longRunReadiness: number;
  injuryRiskFlag: boolean;
  injuryRiskScore: number;
  recoveryNeed: number;
  consistencyProfile: ConsistencyProfile;
  confidenceProfile: ConfidenceProfile;
  scheduleConstraintLevel: ScheduleConstraintLevel;
  trainingStyle: TrainingStyle;
  consistencyScore: number;
}

export interface RunnerClassification {
  traits: RunnerTraits;
  reasons: string[];
  explanation: {
    capabilitySummary: string;
    riskSummary: string;
    intentSummary: string;
    classificationSummary: string;
  };
}

export interface PlanTypeDecision {
  planType: PlanType;
  reasons: string[];
}

export interface PhaseWeek {
  weekIndex: number;
  phase: Phase;
  phaseProgress: number;
  isCutback: boolean;
}

export interface PhasePurpose {
  primaryObjective: string;
  volumeEmphasis: number;
  intensityEmphasis: number;
  longRunEmphasis: number;
  specificityEmphasis: number;
  adaptationSensitivity: number;
}

export interface PhaseBlock {
  phase: Phase;
  startWeekIndex: number;
  endWeekIndex: number;
  weeks: number;
  purpose: PhasePurpose;
}

export interface PhasePlan {
  totalWeeks: number;
  weeks: PhaseWeek[];
  blocks: PhaseBlock[];
}

export interface ProgressionCurves {
  longRunCurve: number[];
  weeklyVolumeCurve: number[];
  intensityCurve: number[];
  continuousCurve: number[];
  specificityCurve: number[];
  densityCurve: number[];
  primaryLoadDimension: LoadDimension[];
  cutbackWeeks: number[];
  taperWeeks: number[];
}

export interface WeeklySlot {
  role: WeeklyRole;
  day: DayOfWeek;
  qualityBias?: "none" | "intro" | "moderate" | "specific";
  protected?: boolean;
}

export interface WeeklyStructure {
  weekIndex: number;
  phase: Phase;
  totalRuns: number;
  weeklyEmphasis: WeeklyEmphasis;
  longRunDay: DayOfWeek;
  qualityDays: DayOfWeek[];
  easyDays: DayOfWeek[];
  recoveryDays: DayOfWeek[];
  longRunTargetMin: number;
  weeklyVolumeTargetMin: number;
  intensityTarget: number;
  continuousTargetMin: number;
  slots: WeeklySlot[];
}

export interface WorkoutBlueprint {
  family: WorkoutFamily;
  role: WeeklyRole;
  day: DayOfWeek;
  weekIndex: number;
}

export interface WorkoutSelection extends WorkoutBlueprint {
  purpose: WorkoutPurpose;
  protected: boolean;
  progressive: boolean;
  conservative: boolean;
  intensityCap: SessionIntensityLevel;
  notes?: string[];
}

export interface SessionBlueprint {
  family: WorkoutFamily;
  structureType: SessionStructureType;
  purpose: WorkoutPurpose;
  intensityLevel: SessionIntensityLevel;
  primaryLoadDimension: LoadDimension;
  warmupType: WarmupType;
  estimatedTotalMinutes: number;
  notes?: string[];
}

export interface SessionSegment {
  kind: "warmup" | "main" | "recovery" | "cooldown";
  label: string;
  durationMin: number;
  repeats?: number;
  recoverMin?: number;
}

export interface BuiltSession {
  id: string;
  weekIndex: number;
  day: DayOfWeek;
  date: string;
  role: WeeklyRole;
  family: WorkoutFamily;
  structureType: SessionStructureType;
  title: string;
  purpose: string;
  warmupType: WarmupType;
  durationMin: number;
  estimatedTotalMinutes: number;
  longRunMinContribution: number;
  intensityLoad: number;
  primaryLoadDimension: LoadDimension;
  intensityLevel: SessionIntensityLevel;
  summary: string;
  notes?: string[];
  structure: SessionSegment[];
  coachingCues: string[];
}

export interface BuiltWeek {
  weekIndex: number;
  phase: Phase;
  isCutback: boolean;
  volumeTargetMin: number;
  longRunTargetMin: number;
  intensityTarget: number;
  focus: string;
  sessions: BuiltSession[];
  workoutSelections?: WorkoutSelection[];
  validationIssues?: SessionValidationIssue[];
}

export interface CoachExplanation {
  planWhy: string[];
  weekWhy: string[];
  learnedTendencies?: string[];
}

export interface EnginePlan {
  input: RunnerInput;
  classification: RunnerClassification;
  planTypeDecision: PlanTypeDecision;
  phasePlan: PhasePlan;
  curves: ProgressionCurves;
  weeks: BuiltWeek[];
  explanation: CoachExplanation;
}

export interface FeedbackSignal {
  weekIndex: number;
  sessionFamily: WorkoutFamily;
  completionPct: number;
  perceivedDifficulty: "too_easy" | "appropriate" | "hard" | "too_hard";
  energy: 1 | 2 | 3 | 4 | 5;
  pain: 1 | 2 | 3 | 4 | 5;
}

export interface AdaptationResult {
  mode: AdaptationMode;
  updatedCurves: ProgressionCurves;
  reasons: string[];
}

export interface ValidationIssue {
  severity: "critical" | "important" | "minor";
  area: "progression" | "structure" | "specificity" | "safety" | "coherence";
  message: string;
}

export interface SessionValidationIssue {
  severity: "critical" | "important" | "minor";
  area: "selection" | "structure" | "purpose" | "safety" | "specificity" | "progression";
  message: string;
  sessionId?: string;
  weekIndex?: number;
}
