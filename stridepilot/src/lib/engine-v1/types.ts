export type EngineV1RunnerLevel =
  | "true_beginner"
  | "beginner"
  | "beginner_plus"
  | "recreational"
  | "intermediate"
  | "advanced";

export type EngineV1GoalDistance = "5k" | "10k" | "half_marathon" | "marathon";

export type EngineV1GoalType =
  | "finish"
  | "finish_without_walking"
  | "return_to_running"
  | "improve_time"
  | "target_time";

export type EngineV1Phase = "base" | "build" | "specific" | "peak" | "taper" | "race_week";

export type EngineV1BackboneType = "continuous" | "long_run" | "hybrid";

export type EngineV1WorkoutType =
  | "easy"
  | "long"
  | "recovery"
  | "intervals"
  | "tempo"
  | "race_pace"
  | "run_walk";

export interface EngineV1Profile {
  runnerLevel: EngineV1RunnerLevel;
  goalDistance: EngineV1GoalDistance;
  goalType: EngineV1GoalType;
  timelineWeeks: number;
  sessionsPerWeek: number;
  currentContinuousMin: number;
  longestRecentRunMin: number;
  availableTrainingDays?: string[];
  preferredLongRunDay?: string;
}

export interface EngineV1PhaseBlock {
  phase: EngineV1Phase;
  startWeek: number;
  endWeek: number;
}

export interface EngineV1WorkoutBlock {
  type: "warmup" | "run" | "walk" | "easy" | "steady" | "tempo" | "interval" | "race_pace" | "cooldown";
  durationMin: number;
  repeats?: number;
  restMin?: number;
}

export interface EngineV1Workout {
  workoutType: EngineV1WorkoutType;
  durationMin: number;
  day?: string;
  blocks: EngineV1WorkoutBlock[];
}

export interface EngineV1Week {
  weekNumber: number;
  phase: EngineV1Phase;
  weeklyVolume: number;
  longRun: number;
  intervalVolume: number;
  continuousTarget: number;
  workouts: EngineV1Workout[];
  progressionMetrics: {
    sessionsPerWeek: number;
    isStepBackWeek: boolean;
    isTaperWeek: boolean;
    isRaceWeek: boolean;
  };
}

export interface EngineV1Plan {
  backboneType: EngineV1BackboneType;
  phases: EngineV1PhaseBlock[];
  stepBackWeeks: number[];
  taperWeeks: number[];
  continuousCurve: number[];
  longRunCurve: number[];
  weeklyVolumeCurve: number[];
  intervalVolumeCurve: number[];
  weeks: EngineV1Week[];
  progressionMetrics: {
    peakWeeklyVolume: number;
    peakLongRun: number;
    peakContinuousRun: number;
  };
}
