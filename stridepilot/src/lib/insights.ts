export interface FuturePerformanceInsights {
  vo2maxEstimate?: number;
  progressionPrediction?: string;
  fatigueScore?: number;
  adaptiveIntervalHint?: string;
  pacingHint?: string;
}

export const EMPTY_INSIGHTS: FuturePerformanceInsights = {};
