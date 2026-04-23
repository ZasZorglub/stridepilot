import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { enforceAvailableTrainingDays } from "@/lib/plan";
import { prisma } from "@/lib/db";
import { FeedbackInsights, Goal, PlanRecommendationOption, RunnerProfile, TrainingPlan } from "@/lib/types";
import { getCurrentSession } from "@/lib/auth/session";
import { applyAdaptiveGuardrails, buildAdaptationPayload, FeedbackSignal } from "@/lib/adaptation";
import { applyPlanSafety, validatePlanFeasibility } from "@/lib/plan-safety";
import { interpretWorkoutFeedback, summarizePlanRationale } from "@/lib/ai/interpretation";
import { deriveCalendarWeekCount } from "@/lib/calendar-week";
import { applyStubWeekToPlan, buildStubWeekSession, resolveStubWeekPolicy } from "@/lib/late-week-start";
import {
  buildGoalPlan,
  GoalConfig as CoachGoalConfig,
  interpretRunnerProfile as interpretCoachRunnerProfile,
  mapCoachPlanToAppPlan,
  mapCoachProfileToRunnerProfileInsights,
} from "@/lib/coach";
import { buildProfileExplanationSummary } from "@/lib/profile-interpretation";
import { handleVNextPlanGenerationRequest } from "@/lib/engine-vnext/app/routeHandlers";

function parseReminderTime(reminderTime?: string): { reminderHour: number; reminderMin: number } {
  const fallback = { reminderHour: 13, reminderMin: 0 };
  if (!reminderTime) return fallback;

  const [h, m] = reminderTime.split(":").map((v) => Number(v));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return fallback;
  if (h < 0 || h > 23 || m < 0 || m > 59) return fallback;
  return { reminderHour: h, reminderMin: m };
}

function toJsonValue<T>(value: T | undefined): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (typeof value === "undefined") return undefined;
  return value as Prisma.InputJsonValue;
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

function mapPreferredDays(days?: Goal["availableTrainingDays"]): CoachGoalConfig["preferredTrainingDays"] {
  if (!days || days.length === 0) return undefined;
  return days.map((day) => {
    if (day === "Mandag") return "monday";
    if (day === "Tirsdag") return "tuesday";
    if (day === "Onsdag") return "wednesday";
    if (day === "Torsdag") return "thursday";
    if (day === "Fredag") return "friday";
    if (day === "Lordag") return "saturday";
    return "sunday";
  });
}

function deriveWeeksFromDates(startDate: string, endDate?: string): number {
  return deriveCalendarWeekCount(startDate, endDate) ?? 12;
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
  const goalIntent =
    goal.goalType === "target_time"
      ? "target_time"
      : goal.goalType === "pr"
        ? "improve"
        : goal.goalType === "run_without_walking"
          ? "finish_comfortably"
          : "finish";

  return {
    goalDistance: goal.distance,
    goalIntent,
    targetDate,
    trainingDaysPerWeek,
    startDate,
    targetTime: goal.targetTime,
    preferredTrainingDays: mapPreferredDays(goal.availableTrainingDays),
    preferredLongRunDay:
      goal.preferredLongRunDay === "both" || goal.preferredLongRunDay === "flexible" || !goal.preferredLongRunDay
        ? "flexible"
        : goal.preferredLongRunDay,
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
  recommendationSelection?: PlanRecommendationOption;
}) {
  const { profileId, userId, runnerProfile, goal, plan, source, recommendationSelection } = params;
  const reminder = parseReminderTime(goal.reminderTime);

  let profile;

  if (userId) {
    profile = await prisma.runnerProfile.upsert({
      where: { userId },
      update: {
        firstName: runnerProfile.firstName,
        heightCm: runnerProfile.heightCm,
        weightKg: runnerProfile.weightKg,
        age: runnerProfile.age,
        activityLevel: runnerProfile.activityLevel,
        runningExperience: runnerProfile.runningExperience,
        currentRunningAbility: runnerProfile.currentRunningAbility,
        gender: runnerProfile.gender,
        userTrainingContext: runnerProfile.userTrainingContext,
        currentWeeklyVolumeKm: runnerProfile.currentWeeklyVolumeKm,
        currentRunsPerWeek: runnerProfile.currentRunsPerWeek,
        longestCurrentRunMin: runnerProfile.longestCurrentRunMin,
        recentRaceTimesJson: toJsonValue(runnerProfile.recentRaceTimes),
        injuryHistory: runnerProfile.injuryHistory,
        weakPoints: runnerProfile.weakPoints,
        realisticTrainingDaysPerWeek: runnerProfile.realisticTrainingDaysPerWeek,
        typicalWorkoutMinutes: runnerProfile.typicalWorkoutMinutes,
        otherTraining: runnerProfile.otherTraining,
        preferredGuidance: runnerProfile.preferredGuidance,
      },
      create: {
        firstName: runnerProfile.firstName,
        heightCm: runnerProfile.heightCm,
        weightKg: runnerProfile.weightKg,
        age: runnerProfile.age,
        activityLevel: runnerProfile.activityLevel,
        runningExperience: runnerProfile.runningExperience,
        currentRunningAbility: runnerProfile.currentRunningAbility,
        gender: runnerProfile.gender,
        userTrainingContext: runnerProfile.userTrainingContext,
        currentWeeklyVolumeKm: runnerProfile.currentWeeklyVolumeKm,
        currentRunsPerWeek: runnerProfile.currentRunsPerWeek,
        longestCurrentRunMin: runnerProfile.longestCurrentRunMin,
        recentRaceTimesJson: toJsonValue(runnerProfile.recentRaceTimes),
        injuryHistory: runnerProfile.injuryHistory,
        weakPoints: runnerProfile.weakPoints,
        realisticTrainingDaysPerWeek: runnerProfile.realisticTrainingDaysPerWeek,
        typicalWorkoutMinutes: runnerProfile.typicalWorkoutMinutes,
        otherTraining: runnerProfile.otherTraining,
        preferredGuidance: runnerProfile.preferredGuidance,
        userId,
      },
    });
  } else if (profileId) {
    profile = await prisma.runnerProfile.upsert({
      where: { id: profileId },
      update: {
        firstName: runnerProfile.firstName,
        heightCm: runnerProfile.heightCm,
        weightKg: runnerProfile.weightKg,
        age: runnerProfile.age,
        activityLevel: runnerProfile.activityLevel,
        runningExperience: runnerProfile.runningExperience,
        currentRunningAbility: runnerProfile.currentRunningAbility,
        gender: runnerProfile.gender,
        userTrainingContext: runnerProfile.userTrainingContext,
        currentWeeklyVolumeKm: runnerProfile.currentWeeklyVolumeKm,
        currentRunsPerWeek: runnerProfile.currentRunsPerWeek,
        longestCurrentRunMin: runnerProfile.longestCurrentRunMin,
        recentRaceTimesJson: toJsonValue(runnerProfile.recentRaceTimes),
        injuryHistory: runnerProfile.injuryHistory,
        weakPoints: runnerProfile.weakPoints,
        realisticTrainingDaysPerWeek: runnerProfile.realisticTrainingDaysPerWeek,
        typicalWorkoutMinutes: runnerProfile.typicalWorkoutMinutes,
        otherTraining: runnerProfile.otherTraining,
        preferredGuidance: runnerProfile.preferredGuidance,
      },
      create: {
        id: profileId,
        firstName: runnerProfile.firstName,
        heightCm: runnerProfile.heightCm,
        weightKg: runnerProfile.weightKg,
        age: runnerProfile.age,
        activityLevel: runnerProfile.activityLevel,
        runningExperience: runnerProfile.runningExperience,
        currentRunningAbility: runnerProfile.currentRunningAbility,
        gender: runnerProfile.gender,
        userTrainingContext: runnerProfile.userTrainingContext,
        currentWeeklyVolumeKm: runnerProfile.currentWeeklyVolumeKm,
        currentRunsPerWeek: runnerProfile.currentRunsPerWeek,
        longestCurrentRunMin: runnerProfile.longestCurrentRunMin,
        recentRaceTimesJson: toJsonValue(runnerProfile.recentRaceTimes),
        injuryHistory: runnerProfile.injuryHistory,
        weakPoints: runnerProfile.weakPoints,
        realisticTrainingDaysPerWeek: runnerProfile.realisticTrainingDaysPerWeek,
        typicalWorkoutMinutes: runnerProfile.typicalWorkoutMinutes,
        otherTraining: runnerProfile.otherTraining,
        preferredGuidance: runnerProfile.preferredGuidance,
      },
    });
  } else {
    profile = await prisma.runnerProfile.create({
      data: {
        firstName: runnerProfile.firstName,
        heightCm: runnerProfile.heightCm,
        weightKg: runnerProfile.weightKg,
        age: runnerProfile.age,
        activityLevel: runnerProfile.activityLevel,
        runningExperience: runnerProfile.runningExperience,
        currentRunningAbility: runnerProfile.currentRunningAbility,
        gender: runnerProfile.gender,
        userTrainingContext: runnerProfile.userTrainingContext,
        currentWeeklyVolumeKm: runnerProfile.currentWeeklyVolumeKm,
        currentRunsPerWeek: runnerProfile.currentRunsPerWeek,
        longestCurrentRunMin: runnerProfile.longestCurrentRunMin,
        recentRaceTimesJson: toJsonValue(runnerProfile.recentRaceTimes),
        injuryHistory: runnerProfile.injuryHistory,
        weakPoints: runnerProfile.weakPoints,
        realisticTrainingDaysPerWeek: runnerProfile.realisticTrainingDaysPerWeek,
        typicalWorkoutMinutes: runnerProfile.typicalWorkoutMinutes,
        otherTraining: runnerProfile.otherTraining,
        preferredGuidance: runnerProfile.preferredGuidance,
      },
    });
  }

  const goalRecord = await prisma.goal.create({
    data: {
      profileId: profile.id,
      distance: goal.distance,
      goalType: goal.goalType,
      weeks: goal.weeks,
      startDate: new Date(goal.startDate),
      endDate: goal.endDate ? new Date(goal.endDate) : null,
      targetTime: goal.targetTime,
      targetPaceSecPerKm: goal.targetPaceSecPerKm,
      availableTrainingDays: goal.availableTrainingDays ?? [],
      preferredLongRunDay: goal.preferredLongRunDay,
      ambition: recommendationSelection?.mode,
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
      currentWeek: 1,
      rationaleJson: plan.rationale,
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
    plan: {
      ...toTrainingPlan(planRecord),
      rationale: plan.rationale,
    },
  };
}

export async function POST(req: Request) {
  try {
    const session = await getCurrentSession();
    const demoModeEnabled =
      process.env.NODE_ENV !== "production" || process.env.ENABLE_DEMO_MODE === "true" || process.env.NEXT_PUBLIC_ENABLE_DEMO_MODE === "true";
    const body = (await req.json()) as {
      engineVersion?: "vnext";
      runnerProfile: RunnerProfile;
      goal: Goal;
      selectedStartDate?: string;
      locale?: "da" | "en";
      profileId?: string;
      runsPerWeek?: number;
      demoMode?: boolean;
      recommendationSelection?: PlanRecommendationOption;
    };
    if (body.engineVersion === "vnext") {
      const result = await handleVNextPlanGenerationRequest(body, {
        persist: true,
        userId: session?.userId ?? null,
      });
      return NextResponse.json(result.body, { status: result.status });
    }
    const { runnerProfile, goal, profileId } = body;
    const demoMode = Boolean(body.demoMode && demoModeEnabled);
    if (body.recommendationSelection?.goalDate) {
      goal.endDate = body.recommendationSelection.goalDate;
      goal.weeks = body.recommendationSelection.durationWeeks;
    }

    const derivedWeeks = deriveWeeksFromDates(goal.startDate, goal.endDate);
    goal.weeks = derivedWeeks;

    const requestedRunsPerWeek =
      typeof body.recommendationSelection?.sessionsPerWeek === "number"
        ? body.recommendationSelection.sessionsPerWeek
        : typeof body.runsPerWeek === "number"
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
    const stubWeekPolicy = resolveStubWeekPolicy({
      selectedStartDateIso: body.selectedStartDate ?? goal.startDate,
      availableTrainingDays: goal.availableTrainingDays,
    });
    const recentFeedback = await fetchRecentFeedbackSignals(session?.userId, profileId);
    const coachProfile = interpretCoachRunnerProfile({
      recentRunningState: runnerProfile.recentRunningState,
      onboardingText: runnerProfile.userTrainingContext,
      injuryHistory: runnerProfile.injuryHistory,
      weakPoints: runnerProfile.weakPoints,
      otherTraining: runnerProfile.otherTraining,
      currentAbility: runnerProfile.currentRunningAbility,
      goalDistance: goal.distance,
      goalTime: goal.targetTime,
      goalType: goal.goalType,
      activityLevel: runnerProfile.activityLevel,
      currentRunsPerWeek: runnerProfile.currentRunsPerWeek,
      currentWeeklyVolumeKm: runnerProfile.currentWeeklyVolumeKm,
      longestRunMinutes: runnerProfile.longestCurrentRunMin,
      realisticTrainingDaysPerWeek: runnerProfile.realisticTrainingDaysPerWeek,
      typicalWorkoutMinutes: runnerProfile.typicalWorkoutMinutes,
      preferredGuidance: runnerProfile.preferredGuidance,
    });
    const profileExplanationSummary = buildProfileExplanationSummary(runnerProfile, goal);
    const runnerProfileInsights = mapCoachProfileToRunnerProfileInsights(coachProfile);
    const feedbackInsights = await buildRecentFeedbackInsights(recentFeedback);
    const adaptationPayload = buildAdaptationPayload({
      goal,
      runnerProfile,
      currentWeek,
      recentFeedback,
      runnerInsights: runnerProfileInsights,
    });
    const coachPlan = buildGoalPlan(coachProfile, toCoachGoalConfig(goal, requestedRunsPerWeek));
    let plan: TrainingPlan = mapCoachPlanToAppPlan(coachPlan, coachPlan.goal);
    const planRationale = plan.rationale?.plan;
    source = "fallback";
    const explanationSummary = await summarizePlanRationale({
      rationale: plan.rationale,
      fallbackLines: [
        ...(planRationale?.profileSummary ?? []),
        ...(planRationale?.structureSummary ?? []),
        ...(planRationale?.safetySummary ?? []),
        ...(planRationale?.ambitionAdjustment?.applied ? [planRationale.ambitionAdjustment.reason] : []),
        ...profileExplanationSummary,
      ],
    });

    plan = applyAdaptiveGuardrails(plan, recentFeedback);
    const safety = applyPlanSafety({ plan, goal, recentFeedback });
    const dayAlignment = enforceAvailableTrainingDays(safety.plan, goal.availableTrainingDays);
    plan = dayAlignment.plan;
    plan = applyStubWeekToPlan(
      plan,
      buildStubWeekSession({
        policy: stubWeekPolicy,
        runnerProfile,
        goal,
        locale: body.locale,
      }),
    );
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
          explanationSummary,
          engineRationale: plan.rationale,
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
        recommendationSelection: body.recommendationSelection,
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
        explanationSummary,
        engineRationale: persisted.plan.rationale,
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
        explanationSummary,
        engineRationale: plan.rationale,
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
