import type { GoalType, Phase, PlanType, PrimaryRunnerType, RunnerInput, RunnerModifier, RunnerLevel, WeeklyRole, WorkoutFamily } from "../models";

export type BenchmarkBand = "within_band" | "borderline" | "out_of_band";
export type FailureScanStatus = "pass" | "warnings" | "fail";

export interface RangeBand {
  min: number;
  max: number;
  borderlineMin?: number;
  borderlineMax?: number;
}

export interface MilestoneWindow {
  label: string;
  weekMin: number;
  weekMax: number;
  targetMin?: number;
  targetPhase?: Phase;
}

export interface WeeklyStructureExpectation {
  typicalRoles: WeeklyRole[];
  preferredQualityFamilies?: WorkoutFamily[];
  forbiddenFamilies?: WorkoutFamily[];
  maxQualitySessionsPerWeek?: number;
  planFamily?: "finish" | "improve" | "target_time" | "return_to_running";
  requirePhaseVariation?: boolean;
  minDistinctPhaseSkeletons?: number;
  allowProtectedLowComplexity?: boolean;
  allowRunWalk?: boolean;
  phaseExpectations?: Array<{
    phase: Phase;
    requiredRoles?: WeeklyRole[];
    requiredRoleGroups?: WeeklyRole[][];
    preferredQualityFamilies?: WorkoutFamily[];
    forbiddenFamilies?: WorkoutFamily[];
    maxQualitySessionsPerWeek?: number;
    minQualitySessionsPerWeek?: number;
  }>;
}

export interface RaceWeekExpectation {
  requireTaper: boolean;
  maxLongRunFractionOfPeak: number;
  requireGoalSpecificSignal: boolean;
  acceptableFamilies: WorkoutFamily[];
}

export interface ReferenceAcceptanceCriteria {
  acceptablePrimaryTypes: PrimaryRunnerType[];
  acceptableRunnerLevels: RunnerLevel[];
  recommendedModifiers?: RunnerModifier[];
  expectedPlanTypes: PlanType[];
  expectedPhaseSequence: Phase[];
  allowedPhaseOmissions?: Phase[];
  longRunStartBand: RangeBand;
  longRunPeakBand: RangeBand;
  taperReductionBand: RangeBand;
  weeklyStructure: WeeklyStructureExpectation;
  earlyIntensityMax: number;
  peakIntensityMin?: number;
  allowedQualityFamilies: WorkoutFamily[];
  milestoneWindows: MilestoneWindow[];
  raceWeek: RaceWeekExpectation;
  failureModes: string[];
}

export interface ReferenceRunnerBenchmark {
  id: string;
  name: string;
  input: RunnerInput;
  goalType: GoalType;
  coachIntent: string;
  acceptance: ReferenceAcceptanceCriteria;
}

export interface BenchmarkDimensionResult {
  status: BenchmarkBand;
  notes: string[];
}

export interface BenchmarkFailureScan {
  status: FailureScanStatus;
  warnings: string[];
  failures: string[];
}

export interface BenchmarkRunnerResult {
  runnerId: string;
  runnerName: string;
  classificationSummary: string;
  phaseSummary: string;
  classificationFit: BenchmarkDimensionResult;
  phaseFit: BenchmarkDimensionResult;
  longRunFit: BenchmarkDimensionResult;
  weeklyStructureFit: BenchmarkDimensionResult;
  intensityFit: BenchmarkDimensionResult;
  milestoneFit: BenchmarkDimensionResult;
  raceWeekFit: BenchmarkDimensionResult;
  failureScan: BenchmarkFailureScan;
  summaryScore: number;
  majorNotes: string[];
}

export interface BenchmarkSuiteResult {
  results: BenchmarkRunnerResult[];
  overallScore: number;
  failingRunners: string[];
}
