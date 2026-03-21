import { TrainingPlan } from "../types";

export type AdaptationMode = "hold" | "down_shift" | "recovery_microcycle" | "resume_build" | "progress";
export type FeedbackSessionKind = "quality" | "long" | "easy" | "other";

export type FeedbackSnapshot = {
  sessionId: string;
  sessionKind: FeedbackSessionKind;
  runMinutes: number;
  completed: boolean;
  difficulty: "easy" | "moderate" | "hard" | "very_hard";
  energy: "low" | "normal" | "high";
  pain: "none" | "mild" | "moderate" | "high";
  completionPct: number;
  effort: number;
  adaptationFactor: number;
  progressionPauseWeeks: number;
  noteCaution: boolean;
};

export type RunnerTraits = {
  durabilityTrend: number;
  complianceTrend: number;
  qualityTolerance: number;
  longRunTolerance: number;
  progressionTolerance: number;
  cautionTrend: number;
};

export type CapabilityState = {
  continuousRunMinutes: number;
  longestRunMinutes: number;
  weeklyLoad: number;
  fatigueIndex: number;
  recoveryDebt: number;
  intervalTolerance: number;
  consistencyScore: number;
  recentFeedback: FeedbackSnapshot[];
  traits: RunnerTraits;
  lastAdaptationMode: AdaptationMode;
  lastAdaptationReason?: string;
};

export type WorkoutFeedback = {
  sessionId: string;
  sessionKind?: FeedbackSessionKind;
  runMinutes?: number;
  completed: boolean;
  difficulty: "easy" | "moderate" | "hard" | "very_hard";
  energy: "low" | "normal" | "high";
  pain: "none" | "mild" | "moderate" | "high";
  completionPct?: number;
  effort?: number;
  adaptationFactor?: number;
  progressionPauseWeeks?: number;
  noteCaution?: boolean;
};

export function capabilityStorageKey(profileId: string): string {
  return `stridepilotCapability:${profileId}`;
}

function sessionRunMinutes(session: TrainingPlan["sessions"][number]): number {
  return session.steps.filter((step) => step.type === "run").reduce((sum, step) => sum + step.durationSec / 60, 0);
}

function sessionContinuousMinutes(session: TrainingPlan["sessions"][number]): number {
  let current = 0;
  let longest = 0;

  session.steps.forEach((step) => {
    if (step.type === "run") {
      current += step.durationSec / 60;
      longest = Math.max(longest, current);
      return;
    }
    current = 0;
  });

  return longest;
}

function clampTrait(value: number): number {
  return Math.max(1, Math.min(5, Math.round(value * 10) / 10));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function defaultRunnerTraits(): RunnerTraits {
  return {
    durabilityTrend: 3,
    complianceTrend: 3,
    qualityTolerance: 3,
    longRunTolerance: 3,
    progressionTolerance: 3,
    cautionTrend: 3,
  };
}

export function deriveRunnerTraits(history: FeedbackSnapshot[]): RunnerTraits {
  if (history.length === 0) {
    return defaultRunnerTraits();
  }

  const completionAvg = average(history.map((entry) => entry.completionPct));
  const missedCount = history.filter((entry) => !entry.completed || entry.completionPct < 70).length;
  const lowEnergyCount = history.filter((entry) => entry.energy === "low").length;
  const painCount = history.filter((entry) => entry.pain === "moderate" || entry.pain === "high").length;
  const cautionCount = history.filter((entry) => entry.noteCaution || entry.progressionPauseWeeks > 0).length;
  const tooEasyCount = history.filter(
    (entry) => entry.completed && entry.completionPct >= 90 && entry.difficulty === "easy" && entry.energy === "high" && entry.pain === "none",
  ).length;
  const strongSessionCount = history.filter(
    (entry) => entry.completed && entry.completionPct >= 90 && entry.difficulty !== "very_hard" && entry.energy !== "low" && entry.pain !== "moderate" && entry.pain !== "high",
  ).length;

  const qualityHistory = history.filter((entry) => entry.sessionKind === "quality");
  const qualityTolerance =
    qualityHistory.length === 0
      ? clampTrait(3 + (tooEasyCount - cautionCount) * 0.15)
      : clampTrait(
          3 +
            average(
              qualityHistory.map((entry) => {
                let score = 0;
                if (entry.completed && entry.completionPct >= 90) score += 0.45;
                if (entry.difficulty === "easy") score += 0.35;
                if (entry.difficulty === "hard") score -= 0.25;
                if (entry.difficulty === "very_hard") score -= 0.55;
                if (entry.energy === "high") score += 0.2;
                if (entry.energy === "low") score -= 0.35;
                if (entry.pain === "moderate") score -= 0.45;
                if (entry.pain === "high") score -= 0.8;
                return score;
              }),
            ),
        );

  const longRunHistory = history.filter((entry) => entry.sessionKind === "long");
  const longRunTolerance =
    longRunHistory.length === 0
      ? 3
      : clampTrait(
          3 +
            average(
              longRunHistory.map((entry) => {
                let score = 0;
                if (entry.completed && entry.completionPct >= 90) score += 0.45;
                if (entry.energy === "high") score += 0.2;
                if (entry.energy === "low") score -= 0.35;
                if (entry.difficulty === "very_hard") score -= 0.45;
                if (entry.pain === "moderate") score -= 0.55;
                if (entry.pain === "high") score -= 0.9;
                return score;
              }),
            ),
        );

  return {
    complianceTrend: clampTrait(3 + (completionAvg - 85) / 12 - missedCount * 0.22),
    durabilityTrend: clampTrait(3 + strongSessionCount * 0.14 - lowEnergyCount * 0.26 - painCount * 0.35 - missedCount * 0.2),
    qualityTolerance,
    longRunTolerance,
    progressionTolerance: clampTrait(3 + tooEasyCount * 0.18 + strongSessionCount * 0.08 - cautionCount * 0.2 - painCount * 0.22),
    cautionTrend: clampTrait(2.2 + cautionCount * 0.35 + painCount * 0.45 + lowEnergyCount * 0.22 + missedCount * 0.18 - tooEasyCount * 0.12),
  };
}

export function createInitialCapabilityState(plan?: TrainingPlan | null): CapabilityState {
  if (!plan || plan.sessions.length === 0) {
    return {
      continuousRunMinutes: 8,
      longestRunMinutes: 15,
      weeklyLoad: 40,
      fatigueIndex: 2,
      recoveryDebt: 1,
      intervalTolerance: 2,
      consistencyScore: 3,
      recentFeedback: [],
      traits: defaultRunnerTraits(),
      lastAdaptationMode: "hold",
    };
  }

  const firstWeekSessions = plan.sessions.filter((session) => session.week === 1);
  const seedSessions = firstWeekSessions.length > 0 ? firstWeekSessions : plan.sessions.slice(0, 3);
  const weeklyLoad = seedSessions.reduce((sum, session) => sum + session.loadScore * 6, 0);

  return {
    continuousRunMinutes: Math.max(5, Math.round(Math.max(...seedSessions.map(sessionContinuousMinutes), 5))),
    longestRunMinutes: Math.max(10, Math.round(Math.max(...seedSessions.map(sessionRunMinutes), 10))),
    weeklyLoad,
    fatigueIndex: 2,
    recoveryDebt: 1,
    intervalTolerance: Math.max(1, Math.min(10, Math.round(seedSessions.length + 1))),
    consistencyScore: Math.max(1, Math.min(10, seedSessions.length * 2)),
    recentFeedback: [],
    traits: defaultRunnerTraits(),
    lastAdaptationMode: "hold",
  };
}
