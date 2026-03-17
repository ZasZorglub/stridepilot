import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSession } from "@/lib/auth/session";
import { interpretWorkoutFeedback } from "@/lib/ai/interpretation";
import { factorFromFeedbackInsights } from "@/lib/adaptation";
import { adaptPlanFromFeedback, CapabilityState, createInitialCapabilityState } from "@/lib/coach";
import { WorkoutFeedback as CoachWorkoutFeedback } from "@/lib/coach/capability";
import { TrainingPlan } from "@/lib/types";

interface FeedbackBody {
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

function describeFeedbackInterpretation(input: {
  quickFeedback?: FeedbackBody["quickFeedback"];
  effort: number;
  completionPct: number;
  energy: number;
  painLevel: number;
}): string {
  if (input.quickFeedback === "very_easy") {
    return "Jeg vurderer, at passet føltes let, med godt overskud og lav belastning.";
  }
  if (input.quickFeedback === "good") {
    return "Jeg vurderer, at passet ramte et godt niveau, med fint overskud og stabil belastning.";
  }
  if (input.quickFeedback === "hard") {
    return "Jeg vurderer, at passet var lidt hårdere end planlagt, men stadig under kontrol.";
  }
  if (input.quickFeedback === "too_hard") {
    return "Jeg vurderer, at passet var krævende, og at belastningen var højere end ønsket.";
  }

  const effortText = input.effort >= 8 ? "hårdt" : input.effort <= 4 ? "let" : "moderat";
  const energyText = input.energy <= 2 ? "lav energi" : input.energy >= 4 ? "god energi" : "moderat energi";
  const painText = input.painLevel >= 6 ? "forhøjet belastning" : input.painLevel <= 3 ? "lav belastning" : "moderat belastning";
  return `Jeg vurderer, at passet føltes ${effortText}, med ${energyText} og ${painText}.`;
}

function describeAdjustment(input: {
  quickFeedback?: FeedbackBody["quickFeedback"];
  factor: number;
  progressionPauseWeeks: number;
}): string {
  if (input.quickFeedback === "very_easy") {
    return "Derfor kan planen fortsætte som planlagt, så du kan bygge videre med rolig progression.";
  }
  if (input.quickFeedback === "good") {
    return "Derfor holder jeg progressionen stabil, så du kan bygge videre uden at forcere noget.";
  }
  if (input.quickFeedback === "hard") {
    return "Derfor holder jeg næste pas en smule roligere, så du kan bevare en stabil rytme i træningen.";
  }
  if (input.quickFeedback === "too_hard") {
    return "Derfor justerer jeg planen lidt ned, så progressionen bliver mere stabil og bæredygtig.";
  }

  if (input.progressionPauseWeeks > 0 || input.factor < 1) {
    return "Derfor holder jeg den næste del af planen lidt roligere, så kroppen bedre kan følge med.";
  }
  if (input.factor > 1) {
    return "Derfor kan planen fortsætte som planlagt med en rolig og stabil progression.";
  }
  return "Derfor holder jeg progressionen stabil, så du kan bygge videre uden at forcere noget.";
}

export async function POST(req: Request) {
  try {
    const session = await getCurrentSession();
    const demoModeEnabled =
      process.env.NODE_ENV !== "production" || process.env.ENABLE_DEMO_MODE === "true" || process.env.NEXT_PUBLIC_ENABLE_DEMO_MODE === "true";
    const body = (await req.json()) as FeedbackBody;
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
    const interpretation = describeFeedbackInterpretation({ quickFeedback: body.quickFeedback, effort, completionPct, energy, painLevel });
    const adjustmentExplanation = describeAdjustment({
      quickFeedback: body.quickFeedback,
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
    };

    if (demoMode) {
      const adapted = adaptPlanFromFeedback({ summary: "", weeks: 0, sessionsPerWeek: 0, sessions: [] }, coachFeedback, initialCapability);
      return NextResponse.json({
        saved: true,
        demoMode: true,
        adaptationFactor: factor,
        feedbackInsights,
        capabilityState: adapted.capability,
        confirmation: {
          title: "Tak for din feedback.",
        },
        interpretation,
        adjustmentExplanation,
        adjustmentSummary: summary,
        note:
          factor < 1
            ? "Næste pas er justeret ned for bedre restitution."
            : factor > 1
              ? "Næste pas er justeret let op ud fra din indsats."
              : "Næste pas fastholdes på samme niveau.",
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
    const mergedPlan: TrainingPlan = {
      ...currentPlan,
      sessions: currentPlan.sessions.map((session) => adapted.plan.sessions.find((item) => item.id === session.id) ?? session),
    };

    await persistAdaptedSessions({
      originalPlan: currentPlan,
      adaptedPlan: mergedPlan,
      currentSessionId: workoutSession.id,
      sessionStepIds: stepIdsBySession,
    });

    return NextResponse.json({
      saved: true,
      adaptationFactor: factor,
      feedbackInsights,
      capabilityState: adapted.capability,
      updatedPlan: mergedPlan,
      confirmation: {
        title: "Tak for din feedback.",
      },
      interpretation,
      adjustmentExplanation,
      adjustmentSummary: summary,
      note:
        factor < 1
          ? "Næste pas er justeret ned for bedre restitution."
          : factor > 1
            ? "Næste pas er justeret let op ud fra din indsats."
            : "Næste pas fastholdes på samme niveau.",
    });
  } catch {
    return NextResponse.json({ error: "Could not save feedback" }, { status: 500 });
  }
}
