import type { VNextValidationReport } from "../engine-vnext/rules/types";
import type { ReturnToRunningPlanState, ReturnToRunningWeekState } from "../engine-vnext/eligibility/returnToRunning";

export type RaceDistance = "5K" | "10K" | "HalfMarathon" | "Marathon";
export type GoalType =
  | "finish"
  | "finish_without_walking"
  | "build_consistency"
  | "improve_time"
  | "target_time"
  | "return_to_running";
export type TrainingStyle = "conservative" | "balanced" | "performance";
export type BaseProgramTrack = "getting_started" | "returning" | "steady_runner" | "goal_focused";
export type AmbitionPreference = "gentle" | "standard" | "ambitious";
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
export type TimelinePhase = Phase | "race";
export type ProgressionGate = "open" | "hold" | "restricted";
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
export type SessionType =
  | "easy_run"
  | "steady_run"
  | "progression_run"
  | "strides_session"
  | "run_walk"
  | "run_walk_long"
  | "threshold_intervals"
  | "vo2_intervals"
  | "race_pace_blocks"
  | "long_run_easy"
  | "long_run_progressive"
  | "long_run_with_blocks"
  | "recovery_jog"
  | "continuous_build"
  | "development_run";
export type WeeklyRole = "quality" | "aerobic_support" | "easy" | "recovery" | "long_run";
export type PhaseStructureRole =
  | "easy"
  | "steady"
  | "quality"
  | "intervals"
  | "threshold"
  | "race_pace"
  | "race_pace_short"
  | "short_quality"
  | "long_run"
  | "long_with_segments"
  | "long_short"
  | "recovery"
  | "support"
  | "strides";
export type WarmupType = "brisk_walk" | "walk_jog" | "easy_jog";
export type AdaptationMode = "hold" | "progress" | "down_shift" | "recovery_week" | "repeat_week" | "resume_build";
export type RunnerStatus =
  | "progressing_well"
  | "struggling"
  | "overreaching"
  | "undertraining"
  | "injury_risk"
  | "inconsistent";
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
export type GoalDemand =
  | "continuity_first"
  | "completion_foundation"
  | "completion_endurance"
  | "performance_development"
  | "performance_specific"
  | "consistency_first"
  | "reentry";
export type RecommendationRealism = "high_confidence" | "realistic" | "stretch" | "capped";
export type RecommendationProgressionMode = "conservative" | "standard" | "ambitious";
export type BackboneType = "continuous_backbone" | "long_run_backbone";

export interface RacePerformancePredictionInput {
  continuousDuration: number;
  longRunDuration: number;
  weeklyLoad: number;
  sessionsPerWeek: number;
  consistencyScore: number;
  recentRPE?: number;
  runnerLevel: RunnerLevel;
}

export interface RacePerformancePrediction {
  fiveKTime: string;
  tenKTime: string;
  halfMarathonTime: string;
  marathonTime: string;
  goalPacePerKm: string;
}

export interface TrainingZonesInput {
  predictedRaceTime: number;
  raceDistance: number;
}

export interface TrainingZones {
  goalPace: string;
  recoveryPace: string;
  easyPace: string;
  steadyPace: string;
  tempoPace: string;
  intervalPace: string;
  repetitionPace: string;
}

export interface RunnerInput {
  raceDistance: RaceDistance;
  goalType: GoalType;
  startDate: string;
  goalDate?: string;
  requestedDurationWeeks?: number;
  ambitionPreference?: AmbitionPreference;
  currentContinuousRunMin: number;
  currentWeeklyRuns: number;
  currentWeeklyVolumeKm: number;
  longestRecentRunMin: number;
  recentConsistency: number;
  availableTrainingDays: DayOfWeek[];
  preferredLongRunDay?: "saturday" | "sunday" | "weekday" | "flexible";
  typicalAvailableTimeMin: number;
  trainingStylePreference: TrainingStyle;
  baseProgramTrack?: BaseProgramTrack;
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

export interface GoalClassification {
  demand: GoalDemand;
  specificityNeed: number;
  finishBias: number;
  recommendedComplexity: "simple" | "moderate" | "structured";
  reasons: string[];
}

export interface TimelineRecommendation {
  feasibleDurationRangeWeeks: {
    minimum: number;
    recommended: number;
    maximum: number;
  };
  recommendedDurationWeeks: number;
  recommendedGoalDate: string;
  requestedDurationWeeks?: number;
  finalDurationWeeks: number;
  finalGoalDate: string;
  recommendedSessionsPerWeek: number;
  startingSessionsPerWeek: number;
  peakSessionsPerWeek: number;
  recommendedProgressionMode: RecommendationProgressionMode;
  realism: RecommendationRealism;
  warnings: string[];
  rationaleTags: string[];
  explanation: {
    headline: string;
    summary: string;
    adjustmentNote?: string;
  };
}

export interface BackboneSelection {
  type: BackboneType;
  primaryMetric: "continuous_running" | "long_run";
  reasons: string[];
}

export interface PhaseWeek {
  weekIndex: number;
  phase: Phase;
  timelinePhase: TimelinePhase;
  phaseProgress: number;
  isCutback: boolean;
  isRaceWeek: boolean;
  targetRuns: number;
  targetQualitySessions: number;
  notes: string[];
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
  timelinePhase: TimelinePhase;
  startWeekIndex: number;
  endWeekIndex: number;
  weeks: number;
  purpose: PhasePurpose;
}

export interface PhasePlan {
  totalWeeks: number;
  weeks: PhaseWeek[];
  blocks: PhaseBlock[];
  raceWeekIndex?: number;
}

export interface ProgressionCurves {
  backboneType: BackboneType;
  backboneTargetCurve: number[];
  sessionsPerWeekCurve: number[];
  longRunCurve: number[];
  weeklyVolumeCurve: number[];
  intervalDurationCurve: number[];
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
  targetDurationMin?: number;
  qualityBias?: "none" | "intro" | "moderate" | "specific" | "short" | "sharpen";
  protected?: boolean;
}

export interface WeeklyLoadDistributionEntry {
  role: WeeklyRole;
  duration: number;
}

export interface WeeklyStructure {
  weekIndex: number;
  phase: Phase;
  isRaceWeek?: boolean;
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
  returnToRunningState?: ReturnToRunningWeekState;
  slots: WeeklySlot[];
}

export interface WorkoutBlueprint {
  sessionType: SessionType;
  family: WorkoutFamily;
  role: WeeklyRole;
  day: DayOfWeek;
  weekIndex: number;
}

export interface WorkoutSelection extends WorkoutBlueprint {
  isRaceWeek?: boolean;
  isRaceEvent?: boolean;
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

export interface StructuredSessionBlock {
  type: "easy" | "steady" | "progression" | "interval" | "threshold" | "race_pace" | "run" | "walk";
  duration: number;
  repeats?: number;
  rest?: number;
}

export interface StructuredSessionDefinition {
  warmup: number;
  blocks: StructuredSessionBlock[];
  cooldown: number;
  totalDuration: number;
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
  isRaceEvent?: boolean;
}

export interface WeekAdaptationHooks {
  progressionGate: ProgressionGate;
  longRunAdvanceEligible: boolean;
  qualityAdvanceEligible: boolean;
  sessionCountAdvanceEligible: boolean;
  repeatWeekCandidate: boolean;
  recoveryMicrocycleCandidate: boolean;
  protectedRunnerBias: boolean;
  boundaryKinds: Array<"phase_start" | "phase_end" | "post_cutback" | "pre_specific" | "post_race" | "protected_hold">;
  safeReplanBoundaryBefore: boolean;
  safeReplanBoundaryAfter: boolean;
}

export interface BuiltWeek {
  weekIndex: number;
  phase: Phase;
  timelinePhase: TimelinePhase;
  isCutback: boolean;
  isRaceWeek: boolean;
  volumeTargetMin: number;
  longRunTargetMin: number;
  intensityTarget: number;
  focus: string;
  sessions: BuiltSession[];
  workoutSelections?: WorkoutSelection[];
  validationIssues?: SessionValidationIssue[];
  adaptationHooks?: WeekAdaptationHooks;
}

export interface CoachExplanation {
  planWhy: string[];
  weekWhy: string[];
  learnedTendencies?: string[];
}

export interface CoachingProgressSnapshot {
  consistency?: number;
  completionRate?: number;
  longRunProgressMin?: number;
  continuousProgressMin?: number;
  moodTrend?: "stable" | "improving" | "wobbly";
}

export interface AdaptationBoundary {
  weekIndex: number;
  kind: "phase_start" | "phase_end" | "post_cutback" | "pre_specific" | "post_race" | "protected_hold";
  label: string;
}

export interface PlanAdaptationHooks {
  adaptationReady: boolean;
  protectedRunner: boolean;
  progressionMode: "conservative" | "standard";
  eligibleForStandardProgression: boolean;
  qualityProgressionEligible: boolean;
  containsRepeatCandidates: boolean;
  containsRecoveryCandidates: boolean;
  containsProtectedHoldPoints: boolean;
  repeatableWeekIndices: number[];
  recoveryCandidateWeekIndices: number[];
  boundaryWeeks: AdaptationBoundary[];
}

export interface PlanVersionMetadata {
  planId: string;
  versionNumber: number;
  derivedFromVersionNumber?: number;
  lastMutationType?: VNextAdaptationMutation["mutationType"];
  lastMutationRef?: string;
  isAdaptiveDerivative: boolean;
}

export type VNextAdaptationFatigue = "low" | "moderate" | "high";
export type VNextAdaptationConfidence = "low" | "normal" | "high";
export type VNextAdaptationAction =
  | "keep_current_progression"
  | "repeat_current_week"
  | "downshift_next_week"
  | "insert_recovery_microcycle";
export type VNextAdaptationReasonCode =
  | "restricted_phase"
  | "protected_runner_bias"
  | "pain_flag"
  | "low_compliance"
  | "high_fatigue"
  | "recovery_candidate_available"
  | "repeat_candidate_available"
  | "boundary_limited"
  | "progression_gate_hold"
  | "progression_gate_open";

export interface EnginePlan {
  input: RunnerInput;
  resolvedInput: RunnerInput;
  classification: RunnerClassification;
  goalClassification: GoalClassification;
  timelineRecommendation: TimelineRecommendation;
  backboneSelection: BackboneSelection;
  planTypeDecision: PlanTypeDecision;
  phasePlan: PhasePlan;
  curves: ProgressionCurves;
  weeks: BuiltWeek[];
  explanation: CoachExplanation;
  vNextValidation?: VNextValidationReport;
  returnToRunningState?: ReturnToRunningPlanState;
  adaptationHooks?: PlanAdaptationHooks;
  versionMetadata?: PlanVersionMetadata;
  mutationHistory?: PlanMutationHistoryEntry[];
}

export interface VNextAdaptationFeedback {
  targetWeekIndex: number;
  sessionsCompleted: number;
  sessionsPlanned: number;
  fatigue: VNextAdaptationFatigue;
  painFlag: boolean;
  confidence: VNextAdaptationConfidence;
}

export interface VNextAdaptationDecision {
  action: VNextAdaptationAction;
  reasonCodes: VNextAdaptationReasonCode[];
  targetWeekIndex: number;
  nearestBoundaryWeekIndex?: number;
  conservativeBias: boolean;
}

export interface VNextAdaptationMutation {
  applied: boolean;
  mutationType: "repeat_current_week" | "downshift_next_week" | "insert_recovery_microcycle" | "noop";
  sourceWeekIndex?: number;
  targetWeekIndex?: number;
  reason: string;
  fallback: boolean;
  conservativeBiasApplied?: boolean;
  recoveryCandidateUsed?: boolean;
}

export interface VNextAdaptationMutationResult {
  plan: EnginePlan;
  mutation: VNextAdaptationMutation;
}

export interface VNextAdaptivePassPlanMeta {
  totalWeeks: number;
  protectedRunner: boolean;
  planType: PlanType;
  targetWeekIndex: number;
}

export interface VNextAdaptivePassValidationSummary {
  passed: boolean;
  vNextHardFailCount: number;
  vNextAutoAdjustCount: number;
  vNextWarningCount: number;
  criticalIssueCount: number;
  importantIssueCount: number;
  minorIssueCount: number;
}

export interface VNextAdaptivePassResult {
  originalPlanMeta: VNextAdaptivePassPlanMeta;
  feedback: VNextAdaptationFeedback;
  decision: VNextAdaptationDecision;
  mutation: VNextAdaptationMutation;
  historyEntry: PlanMutationHistoryEntry;
  finalPlan: EnginePlan;
  finalValidation: VNextAdaptivePassValidationSummary;
  applied: boolean;
  fallback: boolean;
}

export interface PlanMutationHistoryFeedbackSummary {
  targetWeekIndex: number;
  sessionsCompleted: number;
  sessionsPlanned: number;
  fatigue: VNextAdaptationFatigue;
  painFlag: boolean;
  confidence: VNextAdaptationConfidence;
}

export interface PlanMutationHistoryEntry {
  entryId: string;
  sourceVersionNumber: number;
  resultingVersionNumber: number;
  feedback: PlanMutationHistoryFeedbackSummary;
  decision: VNextAdaptationDecision;
  mutation: VNextAdaptationMutation;
  validation: VNextAdaptivePassValidationSummary;
  applied: boolean;
  fallback: boolean;
}

export interface FeedbackSignal {
  weekIndex: number;
  sessionFamily: WorkoutFamily;
  completed?: boolean;
  completionPct: number;
  effort?: 1 | 2 | 3 | 4 | 5;
  rpe?: number;
  perceivedDifficulty: "too_easy" | "appropriate" | "hard" | "too_hard";
  energy: 1 | 2 | 3 | 4 | 5;
  pain: 0 | 1 | 2 | 3 | 4 | 5;
  comment?: string;
  workoutDuration?: number;
  plannedDuration?: number;
}

export interface AdaptationDecisionInput {
  recentWorkouts: FeedbackSignal[];
  fatigueScore: number;
  completionRate: number;
  painScore: number;
}

export interface AdaptationDecision {
  mode: AdaptationMode;
  reason: string;
}

export interface RunnerStatusEvaluation {
  status: RunnerStatus;
  reason: string;
}

export interface AdaptationResult {
  mode: AdaptationMode;
  reason: string;
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
