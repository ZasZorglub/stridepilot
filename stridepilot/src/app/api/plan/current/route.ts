import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSession } from "@/lib/auth/session";
import { Goal, RunnerProfile, TrainingPlan } from "@/lib/types";

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
              include: { steps: { orderBy: { order: "asc" } } },
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
    });
  } catch {
    return NextResponse.json({ error: "Could not load current plan" }, { status: 500 });
  }
}
