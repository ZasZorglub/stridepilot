import { TrainingPlan } from "@/lib/types";

export type CapabilityState = {
  continuousRunMinutes: number;
  longestRunMinutes: number;
  weeklyLoad: number;
  fatigueIndex: number;
  recoveryNeeded?: boolean;
  lastWorkoutDifficulty?: "easy" | "moderate" | "hard" | "very_hard";
};

export type WorkoutFeedback = {
  sessionId: string;
  completed: boolean;
  difficulty: "easy" | "moderate" | "hard" | "very_hard";
  energy: "low" | "normal" | "high";
  pain: "none" | "mild" | "moderate" | "high";
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

export function createInitialCapabilityState(plan?: TrainingPlan | null): CapabilityState {
  if (!plan || plan.sessions.length === 0) {
    return {
      continuousRunMinutes: 8,
      longestRunMinutes: 15,
      weeklyLoad: 40,
      fatigueIndex: 0.2,
    };
  }

  const firstWeekSessions = plan.sessions.filter((session) => session.week === 1);
  const seedSessions = firstWeekSessions.length > 0 ? firstWeekSessions : plan.sessions.slice(0, 3);
  const weeklyLoad = seedSessions.reduce((sum, session) => sum + session.loadScore * 6, 0);

  return {
    continuousRunMinutes: Math.max(5, Math.round(Math.max(...seedSessions.map(sessionContinuousMinutes), 5))),
    longestRunMinutes: Math.max(10, Math.round(Math.max(...seedSessions.map(sessionRunMinutes), 10))),
    weeklyLoad,
    fatigueIndex: 0.25,
  };
}
