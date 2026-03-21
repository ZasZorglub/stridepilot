import { WorkoutFeedback } from "./capability";

export type SessionRecord = {
  sessionId: string;
  difficulty: WorkoutFeedback["difficulty"];
  pain: WorkoutFeedback["pain"];
  completed: boolean;
};

export type SessionHistory = {
  sessions: SessionRecord[];
};

export function createInitialSessionHistory(): SessionHistory {
  return {
    sessions: [],
  };
}

export function updateSessionHistory(history: SessionHistory, feedback: WorkoutFeedback): SessionHistory {
  const nextSessions = [
    ...history.sessions,
    {
      sessionId: feedback.sessionId,
      difficulty: feedback.difficulty,
      pain: feedback.pain,
      completed: feedback.completed,
    },
  ];

  return {
    sessions: nextSessions.slice(-10),
  };
}

export function getRecentSessions(history: SessionHistory, count: number): SessionRecord[] {
  const safeCount = Math.max(0, Math.floor(count));
  return history.sessions.slice(-safeCount);
}
