import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSession } from "@/lib/auth/session";
import { normalizeStepDuration } from "@/lib/duration";
import { interpretWorkoutFeedback } from "@/lib/ai/interpretation";
import { factorFromFeedbackInsights } from "@/lib/adaptation";

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
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
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

    if (demoMode) {
      return NextResponse.json({
        saved: true,
        demoMode: true,
        adaptationFactor: factor,
        feedbackInsights,
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

    if (factor !== 1 || feedbackInsights.progressionPauseWeeks > 0) {
      const futureSessions = workoutSession.plan.sessions.filter((s) => {
        if (s.order <= workoutSession.order) return false;
        if (feedbackInsights.progressionPauseWeeks <= 0) return s.order === workoutSession.order + 1;
        return s.week <= workoutSession.week + feedbackInsights.progressionPauseWeeks;
      });
      const updates: ReturnType<typeof prisma.workoutStep.update>[] = [];
      const sessionLoadUpdates: ReturnType<typeof prisma.workoutSession.update>[] = [];
      const currentLongestRun = Math.max(
        ...workoutSession.steps.filter((step) => step.type === "run").map((step) => step.durationSec),
        30,
      );

      for (const future of futureSessions) {
        for (const step of future.steps) {
          if (step.type !== "run") continue;

          const scaledDuration = step.durationSec * factor;
          const heldDuration =
            feedbackInsights.adjustment === "hold_progression"
              ? Math.min(step.durationSec, currentLongestRun)
              : scaledDuration;
          const nextDuration = normalizeStepDuration(clampNumber(heldDuration, 30, 20 * 60));
          updates.push(
            prisma.workoutStep.update({
              where: { id: step.id },
              data: { durationSec: nextDuration },
            }),
          );
        }

        sessionLoadUpdates.push(
          prisma.workoutSession.update({
            where: { id: future.id },
            data: {
              loadScore:
                feedbackInsights.adjustment === "hold_progression"
                  ? Math.min(future.loadScore, workoutSession.loadScore)
                  : clampNumber(future.loadScore * factor, 1, 10),
            },
          }),
        );
      }

      if (updates.length > 0 || sessionLoadUpdates.length > 0) {
        await prisma.$transaction([...updates, ...sessionLoadUpdates]);
      }
    }

    return NextResponse.json({
      saved: true,
      adaptationFactor: factor,
      feedbackInsights,
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
