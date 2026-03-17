import { NextResponse } from "next/server";
import { enforceAvailableTrainingDays, generateFallbackPlan } from "@/lib/plan";
import { prisma } from "@/lib/db";
import { FeedbackInsights, Goal, RunnerProfile, TrainingPlan } from "@/lib/types";
import { getCurrentSession } from "@/lib/auth/session";
import { applyAdaptiveGuardrails, buildAdaptationPayload, FeedbackSignal } from "@/lib/adaptation";
import { applyPlanSafety, validatePlanFeasibility } from "@/lib/plan-safety";
import { interpretRunnerProfile as interpretAiRunnerProfile, interpretWorkoutFeedback } from "@/lib/ai/interpretation";
import {
  build5kPlan,
  GoalConfig as CoachGoalConfig,
  interpretRunnerProfile as interpretCoachRunnerProfile,
  mapCoachPlanToAppPlan,
  mapCoachProfileToRunnerProfileInsights,
} from "@/lib/coach";

function parseReminderTime(reminderTime?: string): { reminderHour: number; reminderMin: number } {
  const fallback = { reminderHour: 13, reminderMin: 0 };
  if (!reminderTime) return fallback;

  const [h, m] = reminderTime.split(":").map((v) => Number(v));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return fallback;
  if (h < 0 || h > 23 || m < 0 || m > 59) return fallback;
  return { reminderHour: h, reminderMin: m };
}

function addDaysToIsoDate(value: string, days: number): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  const nextYear = date.getFullYear();
  const nextMonth = String(date.getMonth() + 1).padStart(2, "0");
  const nextDay = String(date.getDate()).padStart(2, "0");
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

function toTrainingPlan(
  planRecord: {
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
  },
): TrainingPlan {
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

function toCoachGoalConfig(goal: Goal, requestedRunsPerWeek: number): CoachGoalConfig {
  const trainingDaysPerWeek = Math.max(2, Math.min(4, requestedRunsPerWeek)) as 2 | 3 | 4;
  const startDate = goal.startDate;
  const targetDate = goal.endDate ? goal.endDate : addDaysToIsoDate(goal.startDate, 7 * 7);

  return {
    goalDistance: "5k",
    targetDate,
    trainingDaysPerWeek,
    startDate,
  };
}

async function fetchRecentFeedbackSignals(userId?: string, profileId?: string): Promise<FeedbackSignal[]> {
  let resolvedProfileId = profileId;

  if (userId && !resolvedProfileId) {
    const profile = await prisma.runnerProfile.findUnique({ where: { userId } });
    resolvedProfileId = profile?.id;
  }

  if (!resolvedProfileId) return [];

  const rows = await prisma.workoutFeedback.findMany({
    where: { profileId: resolvedProfileId },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  return rows.map((row) => ({
    effort: row.effort,
    completionPct: row.completionPct,
    energy: row.energy,
    painLevel: row.painLevel,
    notes: row.notes,
    adaptationFactor: row.adaptationFactor,
    createdAt: row.createdAt.toISOString(),
  }));
}

async function buildRecentFeedbackInsights(recentFeedback: FeedbackSignal[]): Promise<FeedbackInsights[]> {
  return Promise.all(
    recentFeedback.map((entry) =>
      interpretWorkoutFeedback({
        RPE: entry.effort,
        energy: entry.energy,
        pain: entry.painLevel,
        completion: entry.completionPct,
        notes: entry.notes,
      }),
    ),
  );
}

async function persistPlan(params: {
  profileId?: string;
  userId?: string;
  runnerProfile: RunnerProfile;
  goal: Goal;
  plan: TrainingPlan;
  source: "openai" | "fallback";
}) {
  const { profileId, userId, runnerProfile, goal, plan, source } = params;
  const reminder = parseReminderTime(goal.reminderTime);

  let profile;

  if (userId) {
    profile = await prisma.runnerProfile.upsert({
      where: { userId },
      update: {
        heightCm: runnerProfile.heightCm,
        weightKg: runnerProfile.weightKg,
        age: runnerProfile.age,
        activityLevel: runnerProfile.activityLevel,
        runningExperience: runnerProfile.runningExperience,
      },
      create: {
        heightCm: runnerProfile.heightCm,
        weightKg: runnerProfile.weightKg,
        age: runnerProfile.age,
        activityLevel: runnerProfile.activityLevel,
        runningExperience: runnerProfile.runningExperience,
        userId,
      },
    });
  } else if (profileId) {
    profile = await prisma.runnerProfile.upsert({
      where: { id: profileId },
      update: {
        heightCm: runnerProfile.heightCm,
        weightKg: runnerProfile.weightKg,
        age: runnerProfile.age,
        activityLevel: runnerProfile.activityLevel,
        runningExperience: runnerProfile.runningExperience,
      },
      create: {
        id: profileId,
        heightCm: runnerProfile.heightCm,
        weightKg: runnerProfile.weightKg,
        age: runnerProfile.age,
        activityLevel: runnerProfile.activityLevel,
        runningExperience: runnerProfile.runningExperience,
      },
    });
  } else {
    profile = await prisma.runnerProfile.create({
      data: {
        heightCm: runnerProfile.heightCm,
        weightKg: runnerProfile.weightKg,
        age: runnerProfile.age,
        activityLevel: runnerProfile.activityLevel,
        runningExperience: runnerProfile.runningExperience,
      },
    });
  }

  const goalRecord = await prisma.goal.create({
    data: {
      profileId: profile.id,
      distance: goal.distance,
      weeks: goal.weeks,
      startDate: new Date(goal.startDate),
      endDate: goal.endDate ? new Date(goal.endDate) : null,
      reminderHour: reminder.reminderHour,
      reminderMin: reminder.reminderMin,
    },
  });

  const planRecord = await prisma.trainingPlan.create({
    data: {
      profileId: profile.id,
      goalId: goalRecord.id,
      summary: plan.summary,
      weeks: plan.weeks,
      sessionsPerWeek: plan.sessionsPerWeek,
      source,
      sessions: {
        create: plan.sessions.map((session, sessionOrder) => ({
          title: session.title,
          week: session.week,
          dayOfWeek: session.dayOfWeek,
          notes: session.notes,
          loadScore: session.loadScore,
          order: sessionOrder,
          steps: {
            create: session.steps.map((step, stepOrder) => ({
              type: step.type,
              label: step.label,
              durationSec: step.durationSec,
              cue: step.cue,
              order: stepOrder,
            })),
          },
        })),
      },
    },
    include: {
      sessions: {
        orderBy: [{ week: "asc" }, { order: "asc" }],
        include: { steps: { orderBy: { order: "asc" } } },
      },
    },
  });

  return {
    profileId: profile.id,
    goalId: goalRecord.id,
    planId: planRecord.id,
    plan: toTrainingPlan(planRecord),
  };
}

export async function POST(req: Request) {
  try {
    const session = await getCurrentSession();
    const demoModeEnabled =
      process.env.NODE_ENV !== "production" || process.env.ENABLE_DEMO_MODE === "true" || process.env.NEXT_PUBLIC_ENABLE_DEMO_MODE === "true";
    const body = (await req.json()) as {
      runnerProfile: RunnerProfile;
      goal: Goal;
      profileId?: string;
      runsPerWeek?: number;
      demoMode?: boolean;
    };
    const { runnerProfile, goal, profileId } = body;
    const demoMode = Boolean(body.demoMode && demoModeEnabled);
    const requestedRunsPerWeek =
      typeof body.runsPerWeek === "number"
        ? body.runsPerWeek
        : goal.availableTrainingDays?.length
          ? goal.availableTrainingDays.length
        : runnerProfile.activityLevel === "meget_lav"
          ? 2
          : runnerProfile.activityLevel === "lav"
            ? 3
            : runnerProfile.activityLevel === "moderat"
              ? 3
              : runnerProfile.activityLevel === "høj"
                ? 4
                : 5;

    const feasibility = validatePlanFeasibility({
      goal,
      runnerProfile,
      runsPerWeek: requestedRunsPerWeek,
    });

    if (!feasibility.feasible) {
      const feasibilityMessage = goal.targetTime
        ? "Det ønskede mål virker meget ambitiøst i forhold til dit nuværende niveau og tidsrammen. Jeg kan foreslå et mere realistisk forløb eller et mere sikkert delmål."
        : "Ud fra dit nuværende niveau og tidsrammen er det ikke forsvarligt at nå dette mål. Jeg kan i stedet foreslå et mere realistisk program.";
      return NextResponse.json(
        {
          feasible: false,
          feasibleStatus: feasibility.status,
          warnings: feasibility.warnings,
          minWeeksRequired: feasibility.minWeeksRequired,
          message: feasibility.explanation ? `${feasibilityMessage} ${feasibility.explanation}` : feasibilityMessage,
        },
        { status: 422 },
      );
    }

    let source: "openai" | "fallback" = "fallback";
    const currentWeek = 1;
    const recentFeedback = await fetchRecentFeedbackSignals(session?.userId, profileId);
    const is5kGoal = goal.distance === "5K";
    const coachProfile = is5kGoal
      ? interpretCoachRunnerProfile({
          onboardingText: runnerProfile.userTrainingContext,
          currentAbility: runnerProfile.currentRunningAbility,
          goalDistance: goal.distance,
          goalTime: goal.targetTime,
          activityLevel: runnerProfile.activityLevel,
        })
      : null;
    const runnerProfileInsights = is5kGoal
      ? mapCoachProfileToRunnerProfileInsights(coachProfile!)
      : await interpretAiRunnerProfile({
          onboardingText: runnerProfile.userTrainingContext,
          currentAbility: runnerProfile.currentRunningAbility,
          goalDistance: goal.distance,
          goalTime: goal.targetTime,
          activityLevel: runnerProfile.activityLevel,
        });
    const feedbackInsights = await buildRecentFeedbackInsights(recentFeedback);
    const adaptationPayload = buildAdaptationPayload({
      goal,
      runnerProfile,
      currentWeek,
      recentFeedback,
      runnerInsights: runnerProfileInsights,
    });
    const coachPlan = is5kGoal ? build5kPlan(coachProfile!, toCoachGoalConfig(goal, requestedRunsPerWeek)) : null;
    let plan: TrainingPlan = coachPlan ? mapCoachPlanToAppPlan(coachPlan, coachPlan.goal) : generateFallbackPlan(runnerProfile, goal, { profileInsights: runnerProfileInsights });
    source = coachPlan ? "fallback" : process.env.OPENAI_API_KEY ? "openai" : "fallback";

    plan = applyAdaptiveGuardrails(plan, recentFeedback);
    const safety = applyPlanSafety({ plan, goal, recentFeedback });
    const dayAlignment = enforceAvailableTrainingDays(safety.plan, goal.availableTrainingDays);
    plan = dayAlignment.plan;
    const warnings = [...feasibility.warnings, ...dayAlignment.warnings];

    try {
      if (demoMode) {
        return NextResponse.json({
          source,
          plan,
          validatedPlan: plan,
          baselinePlan: plan,
          currentPlanView: plan,
          feasible: true,
          feasibleStatus: feasibility.status,
          adaptation: {
            signalCount: recentFeedback.length,
            message: "Programmet tager udgangspunkt i dit mål og justeres løbende efter din feedback.",
          },
          runnerProfileInsights,
          explanationSummary: coachPlan?.explanationSummary ?? [],
          feedbackInsights,
          adaptationPayload,
          warnings,
          tradeoffExplanation: feasibility.explanation,
          safetyAdjustments: safety.adjustments,
          adjustments: safety.adjustments,
          persistence: { saved: false, demoMode: true },
        });
      }

      const persisted = await persistPlan({
        profileId,
        userId: session?.userId,
        runnerProfile,
        goal,
        plan,
        source,
      });
      return NextResponse.json({
        source,
        plan: persisted.plan,
        validatedPlan: persisted.plan,
        baselinePlan: persisted.plan,
        currentPlanView: persisted.plan,
        feasible: true,
        feasibleStatus: feasibility.status,
        adaptation: {
          signalCount: recentFeedback.length,
          message: "Programmet tager udgangspunkt i dit mål og justeres løbende efter din feedback.",
        },
        runnerProfileInsights,
        explanationSummary: coachPlan?.explanationSummary ?? [],
        feedbackInsights,
        adaptationPayload,
        warnings,
        tradeoffExplanation: feasibility.explanation,
        safetyAdjustments: safety.adjustments,
        adjustments: safety.adjustments,
        persistence: { saved: true, ...persisted },
      });
    } catch {
      return NextResponse.json({
        source,
        plan,
        validatedPlan: plan,
        baselinePlan: plan,
        currentPlanView: plan,
        feasible: true,
        feasibleStatus: feasibility.status,
        runnerProfileInsights,
        explanationSummary: coachPlan?.explanationSummary ?? [],
        feedbackInsights,
        adaptationPayload,
        warnings,
        tradeoffExplanation: feasibility.explanation,
        safetyAdjustments: safety.adjustments,
        adjustments: safety.adjustments,
        persistence: { saved: false },
      });
    }
  } catch {
    return NextResponse.json({ error: "Could not generate training plan" }, { status: 500 });
  }
}
