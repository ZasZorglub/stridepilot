import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSession } from "@/lib/auth/session";
import { interpretWorkoutFeedback, summarizeAdaptationRationale } from "@/lib/ai/interpretation";
import { factorFromFeedbackInsights } from "@/lib/adaptation";
import { adaptPlanFromFeedback, CapabilityState, createInitialCapabilityState, summarizeNextWeekShift } from "@/lib/coach";
import { WorkoutFeedback as CoachWorkoutFeedback } from "@/lib/coach/capability";
import { buildFeedbackResponseCopy } from "@/lib/coach/explanations";
import { TrainingPlan } from "@/lib/types";
import { handleVNextAdaptivePassRequest } from "@/lib/engine-vnext/app/routeHandlers";

interface FeedbackBody {
  engineVersion?: "vnext";
  plan?: import("@/lib/engine-v2/models").EnginePlan;
  feedback?: import("@/lib/engine-v2/models").VNextAdaptationFeedback;
  persistedPlanId?: string;
  profileId?: string;
  workoutSessionId?: string;
  quickFeedback?: "very_easy" | "good" | "hard" | "too_hard";
  effort?: number;
  completionPct?: number;
  energy?: number;
  painLevel?: number;
  notes?: string;
  demoMode?: boolean;
  capabilityState?: CapabilityState | null;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function toAppTrainingPlan(planRecord: {
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
      id: string;
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

async function persistAdaptedSessions(params: {
  originalPlan: TrainingPlan;
  adaptedPlan: TrainingPlan;
  currentSessionId: string;
  sessionStepIds: Map<string, string[]>;
}) {
  const { originalPlan, adaptedPlan, currentSessionId, sessionStepIds } = params;
  const currentIndex = originalPlan.sessions.findIndex((session) => session.id === currentSessionId);
  if (currentIndex < 0) return;

  const sessionUpdates: ReturnType<typeof prisma.workoutSession.update>[] = [];
  const stepUpdates: ReturnType<typeof prisma.workoutStep.update>[] = [];

  adaptedPlan.sessions.forEach((session) => {
    const original = originalPlan.sessions.find((item) => item.id === session.id);
    if (!original) return;
    const originalIndex = originalPlan.sessions.findIndex((item) => item.id === session.id);
    if (originalIndex <= currentIndex) return;

    if (original.loadScore !== session.loadScore || original.title !== session.title || (original.notes ?? "") !== (session.notes ?? "")) {
      sessionUpdates.push(
        prisma.workoutSession.update({
          where: { id: session.id },
          data: {
            title: session.title,
            notes: session.notes,
            loadScore: session.loadScore,
          },
        }),
      );
    }

    const stepIds = sessionStepIds.get(session.id) ?? [];
    session.steps.forEach((step, index) => {
      const originalStep = original.steps[index];
      const stepId = stepIds[index];
      if (!originalStep || !stepId) return;
      if (originalStep.durationSec === step.durationSec && originalStep.label === step.label && originalStep.cue === step.cue) return;

      stepUpdates.push(
        prisma.workoutStep.update({
          where: { id: stepId },
          data: {
            durationSec: step.durationSec,
            label: step.label,
            cue: step.cue,
          },
        }),
      );
    });
  });

  if (sessionUpdates.length > 0 || stepUpdates.length > 0) {
    await prisma.$transaction([...sessionUpdates, ...stepUpdates]);
  }
}

function buildAdjustmentSummary(input: {
  effort: number;
  completionPct: number;
  energy: number;
  painLevel: number;
  factor: number;
  progressionPauseWeeks: number;
}): string[] {
  const summary: string[] = [];

  if (input.painLevel >= 6) {
    summary.push("Jeg gør næste pas lettere, fordi du rapporterede smerte.");
  }
  if (input.completionPct < 70) {
    summary.push("Jeg lader næste pas ligne det forrige, fordi gennemførelsen var lavere end planlagt.");
  }
  if (input.effort >= 9) {
    summary.push("Jeg sænker intensiteten i næste pas, fordi belastningen var høj.");
  }
  if (input.energy <= 2) {
    summary.push("Jeg prioriterer restitution, fordi energien var lav.");
  }
  if (input.progressionPauseWeeks > 0) {
    summary.push(
      input.progressionPauseWeeks === 1
        ? "Jeg holder progressionen lidt tilbage i den kommende uge."
        : `Jeg holder progressionen tilbage i ${input.progressionPauseWeeks} uger for at give kroppen mere ro.`,
    );
  }
  if (summary.length === 0) {
    if (input.factor > 1) {
      summary.push("Jeg justerer næste pas en anelse op, fordi belastningen ser bæredygtig ud.");
    } else if (input.factor < 1) {
      summary.push("Jeg gør næste pas lidt roligere for at give dig bedre restitution.");
    } else {
      summary.push("Tak for din feedback. Jeg vurderer, at næste pas kan fortsætte som planlagt.");
    }
  }

  return summary;
}

export async function POST(req: Request) {
  try {
    const session = await getCurrentSession();
    const demoModeEnabled =
      process.env.NODE_ENV !== "production" || process.env.ENABLE_DEMO_MODE === "true" || process.env.NEXT_PUBLIC_ENABLE_DEMO_MODE === "true";
    const body = (await req.json()) as FeedbackBody;
    if (body.engineVersion === "vnext") {
      const result = await handleVNextAdaptivePassRequest(body, {
        persist: true,
        userId: session?.userId ?? null,
      });
      return NextResponse.json(result.body, { status: result.status });
    }
    const demoMode = Boolean(body.demoMode && demoModeEnabled);

    if (!body.profileId || !body.workoutSessionId) {
      return NextResponse.json({ error: "Missing profileId or workoutSessionId" }, { status: 400 });
    }

    const effort = clampNumber(Number(body.effort ?? 0), 1, 10);
    const completionPct = clampNumber(Number(body.completionPct ?? 0), 0, 100);
    const energy = clampNumber(Number(body.energy ?? 0), 1, 5);
    const painLevel = clampNumber(Number(body.painLevel ?? 1), 1, 10);
    const notes = body.notes?.trim() || null;
    const feedbackInsights = await interpretWorkoutFeedback({
      RPE: effort,
      energy,
      pain: painLevel,
      completion: completionPct,
      notes,
    });
    const factor = factorFromFeedbackInsights(feedbackInsights);
    const summary = buildAdjustmentSummary({
      effort,
      completionPct,
      energy,
      painLevel,
      factor,
      progressionPauseWeeks: feedbackInsights.progressionPauseWeeks,
    });
    const initialCapability = body.capabilityState ?? createInitialCapabilityState(null);
    const coachFeedback: CoachWorkoutFeedback = {
      sessionId: body.workoutSessionId ?? "unknown-session",
      completed: completionPct >= 80,
      difficulty:
        body.quickFeedback === "very_easy"
          ? "easy"
          : body.quickFeedback === "good"
            ? "moderate"
            : body.quickFeedback === "hard"
              ? "hard"
              : body.quickFeedback === "too_hard"
                ? "very_hard"
                : effort <= 4
                  ? "easy"
                  : effort <= 7
                    ? "moderate"
                    : effort <= 8
                      ? "hard"
                      : "very_hard",
      energy: energy >= 4 ? "high" : energy <= 2 ? "low" : "normal",
      pain: painLevel >= 7 ? "high" : painLevel >= 4 ? "moderate" : painLevel >= 2 ? "mild" : "none",
      completionPct,
      effort,
      adaptationFactor: factor,
      progressionPauseWeeks: feedbackInsights.progressionPauseWeeks,
      noteCaution: feedbackInsights.adjustment === "insert_recovery" || feedbackInsights.adjustment === "hold_progression",
    };

    if (demoMode) {
      const adapted = adaptPlanFromFeedback({ summary: "", weeks: 0, sessionsPerWeek: 0, sessions: [] }, coachFeedback, initialCapability);
      const responseCopy = buildFeedbackResponseCopy({
        rationale: adapted.rationale,
        feedback: { quickFeedback: body.quickFeedback, completionPct, effort, energy, painLevel },
      });
      const adaptationCopy = await summarizeAdaptationRationale({
        rationale: adapted.rationale,
        fallback: {
          interpretation: responseCopy.interpretation,
          adjustmentExplanation: responseCopy.adjustmentExplanation,
          runnerFocus: responseCopy.runnerFocus,
        },
      });
      return NextResponse.json({
        saved: true,
        demoMode: true,
        adaptationFactor: factor,
        adaptationMode: adapted.capability.lastAdaptationMode,
        adaptationReason: adapted.capability.lastAdaptationReason,
        feedbackInsights,
        capabilityState: adapted.capability,
        adaptationRationale: adapted.rationale,
        confirmation: {
          title: "Tak for din feedback.",
        },
        interpretation: adaptationCopy.interpretation,
        adjustmentExplanation: adaptationCopy.adjustmentExplanation,
        runnerFocus: adaptationCopy.runnerFocus,
        adjustmentSummary: summary,
        note:
          adapted.capability.lastAdaptationMode === "recovery_microcycle"
            ? "Den næste uge er gjort tydeligt lettere for at give kroppen mere ro."
            : adapted.capability.lastAdaptationMode === "down_shift"
              ? "Den næste uge er justeret lidt ned for at holde belastningen bæredygtig."
              : adapted.capability.lastAdaptationMode === "resume_build"
                ? "Den næste uge bygger forsigtigt videre efter en lidt roligere periode."
                : adapted.capability.lastAdaptationMode === "progress"
                  ? "Den næste uge er justeret en smule op, fordi de seneste signaler var stærke."
                  : "Den næste uge holdes overordnet stabil.",
      });
    }

    const profile = await prisma.runnerProfile.findUnique({ where: { id: body.profileId } });
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (session && profile.userId && profile.userId !== session.userId) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }

    const workoutSession = await prisma.workoutSession.findUnique({
      where: { id: body.workoutSessionId },
      include: {
        steps: { orderBy: { order: "asc" } },
        plan: {
          include: {
            sessions: {
              orderBy: [{ week: "asc" }, { order: "asc" }],
              include: { steps: { orderBy: { order: "asc" } } },
            },
          },
        },
      },
    });

    if (!workoutSession || workoutSession.plan.profileId !== body.profileId) {
      return NextResponse.json({ error: "Workout session not found for profile" }, { status: 404 });
    }

    const currentPlan = toAppTrainingPlan({
      summary: workoutSession.plan.summary,
      weeks: workoutSession.plan.weeks,
      sessionsPerWeek: workoutSession.plan.sessionsPerWeek,
      sessions: workoutSession.plan.sessions.map((session) => ({
        id: session.id,
        title: session.title,
        week: session.week,
        dayOfWeek: session.dayOfWeek,
        notes: session.notes,
        loadScore: session.loadScore,
        steps: session.steps.map((step) => ({
          id: step.id,
          type: step.type,
          label: step.label,
          durationSec: step.durationSec,
          cue: step.cue,
        })),
      })),
    });
    const stepIdsBySession = new Map(workoutSession.plan.sessions.map((session) => [session.id, session.steps.map((step) => step.id)]));
    coachFeedback.sessionId = workoutSession.id;

    await prisma.workoutFeedback.create({
      data: {
        profileId: body.profileId,
        workoutSessionId: workoutSession.id,
        quickFeedback: body.quickFeedback ?? null,
        effort,
        completionPct,
        energy,
        painLevel,
        notes,
        adaptationFactor: factor,
      },
    });

    const currentCapability = body.capabilityState ?? createInitialCapabilityState(currentPlan);
    const futureOnlyPlan: TrainingPlan = {
      ...currentPlan,
      sessions: currentPlan.sessions.filter((session) => {
        const persisted = workoutSession.plan.sessions.find((item) => item.id === session.id);
        return persisted ? persisted.order > workoutSession.order : false;
      }),
    };
    const adapted = adaptPlanFromFeedback(futureOnlyPlan, coachFeedback, currentCapability);
    const responseCopy = buildFeedbackResponseCopy({
      rationale: adapted.rationale,
      feedback: { quickFeedback: body.quickFeedback, completionPct, effort, energy, painLevel },
    });
    const adaptationCopy = await summarizeAdaptationRationale({
      rationale: adapted.rationale,
      fallback: {
        interpretation: responseCopy.interpretation,
        adjustmentExplanation: responseCopy.adjustmentExplanation,
        runnerFocus: responseCopy.runnerFocus,
      },
    });
    const mergedPlan: TrainingPlan = {
      ...currentPlan,
      sessions: currentPlan.sessions.map((session) => adapted.plan.sessions.find((item) => item.id === session.id) ?? session),
      rationale: {
        ...currentPlan.rationale,
        adaptation: adapted.rationale,
      },
    };
    const nextWeekShift = summarizeNextWeekShift(futureOnlyPlan, adapted.plan);

    await persistAdaptedSessions({
      originalPlan: currentPlan,
      adaptedPlan: mergedPlan,
      currentSessionId: workoutSession.id,
      sessionStepIds: stepIdsBySession,
    });

    const nextCurrentWeek = Math.min(workoutSession.plan.weeks, Math.max(workoutSession.week, workoutSession.week + (completionPct >= 80 ? 1 : 0)));

    await prisma.$transaction([
      prisma.trainingPlan.update({
        where: { id: workoutSession.planId },
        data: {
          currentWeek: nextCurrentWeek,
          rationaleJson: mergedPlan.rationale,
        },
      }),
      prisma.trainingPlanAdaptation.create({
        data: {
          planId: workoutSession.planId,
          mode: adapted.capability.lastAdaptationMode ?? "hold",
          reason: adapted.capability.lastAdaptationReason ?? adapted.rationale.reason,
          runnerFocus: adapted.rationale.runnerFocus,
          changeSummaryJson: adapted.rationale.changeSummary,
          weekNumber: workoutSession.week,
          triggeredBySessionId: workoutSession.id,
        },
      }),
    ]);

    return NextResponse.json({
      saved: true,
      adaptationFactor: factor,
      adaptationMode: adapted.capability.lastAdaptationMode,
      adaptationReason: adapted.capability.lastAdaptationReason,
      nextWeekLoadShift: nextWeekShift,
      feedbackInsights,
      capabilityState: adapted.capability,
      updatedPlan: mergedPlan,
      adaptationRationale: adapted.rationale,
      confirmation: {
        title: "Tak for din feedback.",
      },
      interpretation: adaptationCopy.interpretation,
      adjustmentExplanation: adaptationCopy.adjustmentExplanation,
      runnerFocus: adaptationCopy.runnerFocus,
      adjustmentSummary: summary,
      note:
        adapted.capability.lastAdaptationMode === "recovery_microcycle"
          ? "Den næste uge er gjort tydeligt lettere for at give kroppen mere ro."
          : adapted.capability.lastAdaptationMode === "down_shift"
            ? "Den næste uge er justeret lidt ned for at holde belastningen bæredygtig."
            : adapted.capability.lastAdaptationMode === "resume_build"
              ? "Den næste uge bygger forsigtigt videre efter en lidt roligere periode."
              : adapted.capability.lastAdaptationMode === "progress"
                ? "Den næste uge er justeret en smule op, fordi de seneste signaler var stærke."
                : "Den næste uge holdes overordnet stabil.",
    });
  } catch {
    return NextResponse.json({ error: "Could not save feedback" }, { status: 500 });
  }
}
