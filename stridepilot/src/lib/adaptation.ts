import { Goal, RunnerProfile, TrainingPlan } from "./types";
import { normalizeStepDuration } from "./duration";

export interface FeedbackSignal {
  effort: number;
  completionPct: number;
  energy: number;
  painLevel: number;
  notes: string | null;
  adaptationFactor: number;
  createdAt: string;
}

export interface AdaptationPayload {
  goal: {
    distance: Goal["distance"];
    weeks: number;
    startDate: string;
    targetTime?: string;
    availableTrainingDays?: string[];
  };
  runner: {
    experience: RunnerProfile["runningExperience"];
    activityLevel: RunnerProfile["activityLevel"];
    age: number;
    weightKg: number;
    heightCm: number;
  };
  progressionState: {
    currentWeek: number;
    programWeeks: number;
    recentCompletionAvg: number | null;
    recentPainAvg: number | null;
    recentEnergyAvg: number | null;
  };
  recentWorkoutHistory: FeedbackSignal[];
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function buildAdaptationPayload(params: {
  goal: Goal;
  runnerProfile: RunnerProfile;
  currentWeek: number;
  recentFeedback: FeedbackSignal[];
}): AdaptationPayload {
  const { goal, runnerProfile, currentWeek, recentFeedback } = params;

  return {
    goal: {
      distance: goal.distance,
      weeks: goal.weeks,
      startDate: goal.startDate,
      targetTime: goal.targetTime,
      availableTrainingDays: goal.availableTrainingDays,
    },
    runner: {
      experience: runnerProfile.runningExperience,
      activityLevel: runnerProfile.activityLevel,
      age: runnerProfile.age,
      weightKg: runnerProfile.weightKg,
      heightCm: runnerProfile.heightCm,
    },
    progressionState: {
      currentWeek,
      programWeeks: goal.weeks,
      recentCompletionAvg: avg(recentFeedback.map((f) => f.completionPct)),
      recentPainAvg: avg(recentFeedback.map((f) => f.painLevel)),
      recentEnergyAvg: avg(recentFeedback.map((f) => f.energy)),
    },
    recentWorkoutHistory: recentFeedback,
  };
}

export function applyAdaptiveGuardrails(plan: TrainingPlan, recentFeedback: FeedbackSignal[]): TrainingPlan {
  if (recentFeedback.length === 0) return plan;

  const maxPain = Math.max(...recentFeedback.map((f) => f.painLevel));
  const minCompletion = Math.min(...recentFeedback.map((f) => f.completionPct));
  const minEnergy = Math.min(...recentFeedback.map((f) => f.energy));

  const recoveryBias = maxPain >= 7 || minCompletion < 50 || minEnergy <= 2;

  const guardedSessions = plan.sessions.map((session) => {
    const cappedLoad = recoveryBias ? Math.min(session.loadScore, 6) : session.loadScore;
    const steps = session.steps.map((step) => {
      if (!recoveryBias || step.type !== "run") return step;
      return {
        ...step,
        durationSec: normalizeStepDuration(step.durationSec * 0.9),
      };
    });

    return {
      ...session,
      loadScore: cappedLoad,
      steps,
    };
  });

  const smoothedSessions = guardedSessions.map((session, index) => {
    if (index === 0) return session;
    const prev = guardedSessions[index - 1];
    const maxAllowed = prev.loadScore + 2;

    if (session.loadScore <= maxAllowed) return session;

    return {
      ...session,
      loadScore: maxAllowed,
    };
  });

  return {
    ...plan,
    sessions: smoothedSessions,
  };
}
