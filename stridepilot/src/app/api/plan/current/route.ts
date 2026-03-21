import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSession } from "@/lib/auth/session";
import { Goal, RunnerProfile, SavedWorkoutSessionFeedback, TrainingPlan } from "@/lib/types";

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

export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session?.userId) {
      return NextResponse.json({ plan: null }, { status: 200 });
    }

    const profile = await prisma.runnerProfile.findUnique({
      where: { userId: session.userId },
      include: {
        goals: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        plans: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
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
        weightKg: profile.weightKg,
        age: profile.age,
        activityLevel: profile.activityLevel as RunnerProfile["activityLevel"],
        runningExperience: profile.runningExperience as RunnerProfile["runningExperience"],
      } satisfies Partial<RunnerProfile>,
      goal: latestGoal
        ? ({
            distance: latestGoal.distance as Goal["distance"],
            weeks: latestGoal.weeks,
            startDate: latestGoal.startDate.toISOString().slice(0, 10),
            endDate: latestGoal.endDate?.toISOString().slice(0, 10),
            reminderTime: `${String(latestGoal.reminderHour).padStart(2, "0")}:${String(latestGoal.reminderMin).padStart(2, "0")}`,
          } satisfies Partial<Goal>)
        : null,
      baselinePlan: toTrainingPlan(latestPlan),
      plan: toTrainingPlan(latestPlan),
      sessionFeedback,
    });
  } catch {
    return NextResponse.json({ error: "Could not load current plan" }, { status: 500 });
  }
}
