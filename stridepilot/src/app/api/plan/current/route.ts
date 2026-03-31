import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSession } from "@/lib/auth/session";
import { Goal, PlanHistorySummary, RunnerProfile, SavedPlanAdaptation, SavedProfileNote, SavedWorkoutSessionFeedback, TrainingPlan } from "@/lib/types";
import { handleVNextCurrentPlanReadRequest } from "@/lib/engine-vnext/app/routeHandlers";

function toTrainingPlan(planRecord: {
  summary: string;
  weeks: number;
  sessionsPerWeek: number;
  sessions: Array<{
    id: string;
    title: string;
    week: number;
    dayOfWeek: string;
    notes: string | null;
    loadScore: number;
    steps: Array<{
      type: string;
      label: string;
      durationSec: number;
      cue: string;
    }>;
  }>;
}): TrainingPlan {
  return {
    summary: planRecord.summary,
    weeks: planRecord.weeks,
    sessionsPerWeek: planRecord.sessionsPerWeek,
    sessions: planRecord.sessions.map((session) => ({
      id: session.id,
      title: session.title,
      week: session.week,
      dayOfWeek: session.dayOfWeek as TrainingPlan["sessions"][number]["dayOfWeek"],
      notes: session.notes ?? undefined,
      loadScore: session.loadScore,
      steps: session.steps.map((step) => ({
        type: step.type as TrainingPlan["sessions"][number]["steps"][number]["type"],
        label: step.label,
        durationSec: step.durationSec,
        cue: step.cue,
      })),
    })),
  };
}

function feedbackStatusFromCompletion(completionPct: number): SavedWorkoutSessionFeedback["status"] {
  if (completionPct <= 0) return "missed";
  if (completionPct < 95) return "shortened";
  return "completed";
}

function sessionDurationMin(session: { steps: Array<{ durationSec: number }> }): number {
  return Math.round(session.steps.reduce((sum, step) => sum + step.durationSec, 0) / 60);
}

function sessionContinuousMinutes(session: { steps: Array<{ durationSec: number; type: string }> }): number {
  let current = 0;
  let longest = 0;

  for (const step of session.steps) {
    if (step.type === "run") {
      current += step.durationSec;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }

  return Math.round(longest / 60);
}

function buildHistorySummary(planRecord: {
  currentWeek: number;
  sessions: Array<{
    id: string;
    week: number;
    steps: Array<{ durationSec: number; type: string }>;
    feedback: Array<{
      completionPct: number;
    }>;
  }>;
}): PlanHistorySummary {
  const sessionsByWeek = new Map<number, typeof planRecord.sessions>();
  for (const session of planRecord.sessions) {
    const bucket = sessionsByWeek.get(session.week) ?? [];
    bucket.push(session);
    sessionsByWeek.set(session.week, bucket);
  }

  const weeklyHistory = [...sessionsByWeek.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([week, sessions]) => {
      const completedSessions = sessions.filter((session) => {
        const latest = session.feedback[0];
        return latest && latest.completionPct > 0;
      });

      const completedMinutes = completedSessions.reduce((sum, session) => {
        const duration = sessionDurationMin(session);
        const pct = session.feedback[0]?.completionPct ?? 0;
        return sum + Math.round((duration * pct) / 100);
      }, 0);

      const longRunMinutes = completedSessions.reduce((max, session) => Math.max(max, sessionDurationMin(session)), 0);
      const longestContinuousRunMinutes = completedSessions.reduce((max, session) => Math.max(max, sessionContinuousMinutes(session)), 0);

      return {
        week,
        completedWorkouts: completedSessions.length,
        plannedWorkouts: sessions.length,
        completedMinutes,
        longRunMinutes,
        longestContinuousRunMinutes,
      };
    });

  const completedWorkouts = weeklyHistory.reduce((sum, week) => sum + week.completedWorkouts, 0);
  const totalWorkouts = planRecord.sessions.length;

  return {
    currentWeek: planRecord.currentWeek,
    completedWorkouts,
    totalWorkouts,
    progressPct: totalWorkouts > 0 ? Math.round((completedWorkouts / totalWorkouts) * 100) : 0,
    weeklyVolumeHistory: weeklyHistory.map((week) => ({ week: week.week, minutes: week.completedMinutes })),
    longRunHistory: weeklyHistory.map((week) => ({ week: week.week, minutes: week.longRunMinutes })),
    weeklyHistory,
  };
}

function fromJsonArray<T>(value: unknown): T[] | undefined {
  return Array.isArray(value) ? (value as T[]) : undefined;
}

function adaptationModeFromValue(value: string): SavedPlanAdaptation["mode"] {
  if (value === "progress" || value === "down_shift" || value === "resume_build" || value === "recovery_microcycle") {
    return value;
  }
  return "hold";
}

export async function GET(req: Request) {
  try {
    const session = await getCurrentSession();
    const { searchParams } = new URL(req.url);
    if (searchParams.get("engineVersion") === "vnext") {
      const result = await handleVNextCurrentPlanReadRequest({
        persistedPlanId: searchParams.get("persistedPlanId") ?? undefined,
      }, {
        userId: session?.userId ?? null,
      });
      return NextResponse.json(result.body, { status: result.status });
    }
    if (!session?.userId) {
      return NextResponse.json({ plan: null }, { status: 200 });
    }

    const profile = await prisma.runnerProfile.findUnique({
      where: { userId: session.userId },
      include: {
        notes: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        goals: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        plans: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            adaptations: {
              orderBy: { createdAt: "desc" },
              take: 20,
            },
            sessions: {
              orderBy: [{ week: "asc" }, { order: "asc" }],
              include: {
                steps: { orderBy: { order: "asc" } },
                feedback: {
                  orderBy: { createdAt: "desc" },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    if (!profile || profile.plans.length === 0) {
      return NextResponse.json({ plan: null, profileId: profile?.id ?? null }, { status: 200 });
    }

    const latestGoal = profile.goals[0];
    const latestPlan = profile.plans[0];
    const sessionFeedback: SavedWorkoutSessionFeedback[] = latestPlan.sessions.flatMap((session) => {
      const latestFeedback = session.feedback[0];
      if (!latestFeedback) return [];

      return [
        {
          sessionId: session.id,
          status: feedbackStatusFromCompletion(latestFeedback.completionPct),
          quickFeedback: latestFeedback.quickFeedback as SavedWorkoutSessionFeedback["quickFeedback"] | undefined,
          effort: latestFeedback.effort,
          completionPct: latestFeedback.completionPct,
          energy: latestFeedback.energy,
          painLevel: latestFeedback.painLevel,
          notes: latestFeedback.notes ?? undefined,
          submittedAt: latestFeedback.createdAt.toISOString(),
        },
      ];
    });

    return NextResponse.json({
      profileId: profile.id,
      profile: {
        heightCm: profile.heightCm,
        firstName: profile.firstName ?? undefined,
        weightKg: profile.weightKg,
        age: profile.age,
        activityLevel: profile.activityLevel as RunnerProfile["activityLevel"],
        runningExperience: profile.runningExperience as RunnerProfile["runningExperience"],
        currentRunningAbility: profile.currentRunningAbility as RunnerProfile["currentRunningAbility"] | undefined,
        gender: profile.gender as RunnerProfile["gender"] | undefined,
        userTrainingContext: profile.userTrainingContext ?? undefined,
        currentWeeklyVolumeKm: profile.currentWeeklyVolumeKm ?? undefined,
        currentRunsPerWeek: profile.currentRunsPerWeek ?? undefined,
        longestCurrentRunMin: profile.longestCurrentRunMin ?? undefined,
        recentRaceTimes: fromJsonArray<NonNullable<RunnerProfile["recentRaceTimes"]>[number]>(profile.recentRaceTimesJson),
        injuryHistory: profile.injuryHistory ?? undefined,
        weakPoints: profile.weakPoints ?? undefined,
        realisticTrainingDaysPerWeek: profile.realisticTrainingDaysPerWeek ?? undefined,
        typicalWorkoutMinutes: profile.typicalWorkoutMinutes ?? undefined,
        otherTraining: profile.otherTraining ?? undefined,
        preferredGuidance: profile.preferredGuidance as RunnerProfile["preferredGuidance"] | undefined,
      } satisfies Partial<RunnerProfile>,
      goal: latestGoal
        ? ({
            distance: latestGoal.distance as Goal["distance"],
            goalType: latestGoal.goalType as Goal["goalType"] | undefined,
            weeks: latestGoal.weeks,
            startDate: latestGoal.startDate.toISOString().slice(0, 10),
            endDate: latestGoal.endDate?.toISOString().slice(0, 10),
            targetTime: latestGoal.targetTime ?? undefined,
            targetPaceSecPerKm: latestGoal.targetPaceSecPerKm ?? undefined,
            availableTrainingDays: latestGoal.availableTrainingDays as Goal["availableTrainingDays"],
            preferredLongRunDay: latestGoal.preferredLongRunDay as Goal["preferredLongRunDay"] | undefined,
            reminderTime: `${String(latestGoal.reminderHour).padStart(2, "0")}:${String(latestGoal.reminderMin).padStart(2, "0")}`,
          } satisfies Partial<Goal>)
        : null,
      baselinePlan: toTrainingPlan(latestPlan),
      plan: toTrainingPlan(latestPlan),
      sessionFeedback,
      currentWeek: latestPlan.currentWeek,
      history: buildHistorySummary(latestPlan),
      adaptations: latestPlan.adaptations.map(
        (item) =>
          ({
            id: item.id,
            createdAt: item.createdAt.toISOString(),
            mode: adaptationModeFromValue(item.mode),
            reason: item.reason,
            runnerFocus: item.runnerFocus ?? undefined,
            changeSummary: Array.isArray(item.changeSummaryJson) ? (item.changeSummaryJson as string[]) : [],
            weekNumber: item.weekNumber ?? undefined,
            triggeredBySessionId: item.triggeredBySessionId ?? undefined,
          }) satisfies SavedPlanAdaptation,
      ),
      notes: profile.notes.map(
        (note) =>
          ({
            id: note.id,
            createdAt: note.createdAt.toISOString(),
            text: note.text,
          }) satisfies SavedProfileNote,
      ),
    });
  } catch {
    return NextResponse.json({ error: "Could not load current plan" }, { status: 500 });
  }
}
