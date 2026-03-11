import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSession } from "@/lib/auth/session";
import { normalizeStepDuration } from "@/lib/duration";

interface FeedbackBody {
  profileId?: string;
  workoutSessionId?: string;
  effort?: number;
  completionPct?: number;
  energy?: number;
  painLevel?: number;
  notes?: string;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function adaptationFactor(input: { effort: number; completionPct: number; energy: number; painLevel: number }): number {
  if (input.painLevel >= 7 || input.completionPct < 70 || input.effort >= 9) {
    return 0.9;
  }
  if (input.painLevel <= 3 && input.completionPct >= 95 && input.effort <= 6 && input.energy >= 4) {
    return 1.05;
  }
  return 1;
}

function buildAdjustmentSummary(input: { effort: number; completionPct: number; energy: number; painLevel: number; factor: number }): string[] {
  const summary: string[] = [];

  if (input.painLevel >= 6) {
    summary.push("Næste pas er gjort lettere på grund af rapporteret smerte.");
  }
  if (input.completionPct < 70) {
    summary.push("Næste pas gentages i lignende form på grund af lav gennemførelse.");
  }
  if (input.effort >= 9) {
    summary.push("Intervalintensiteten er sænket efter høj oplevet belastning.");
  }
  if (input.energy <= 2) {
    summary.push("Restitution er prioriteret på grund af lav energi.");
  }
  if (summary.length === 0) {
    if (input.factor > 1) {
      summary.push("Næste pas er justeret let op ud fra din indsats.");
    } else if (input.factor < 1) {
      summary.push("Næste pas er justeret ned for bedre restitution.");
    } else {
      summary.push("Din feedback er modtaget. Der var ikke behov for at ændre næste pas.");
    }
  }

  return summary;
}

function describeFeedbackInterpretation(input: { effort: number; completionPct: number; energy: number; painLevel: number }): string {
  const effortText = input.effort >= 8 ? "hårdt" : input.effort <= 4 ? "let" : "moderat";
  const energyText = input.energy <= 2 ? "lav energi" : input.energy >= 4 ? "god energi" : "moderat energi";
  const completionText =
    input.completionPct < 70 ? "lav gennemførelse" : input.completionPct >= 95 ? "høj gennemførelse" : "delvis gennemførelse";
  const painText = input.painLevel >= 6 ? "forhøjet smerte" : input.painLevel <= 3 ? "lav smerte" : "moderat smerte";
  return `Du vurderede passet som ${effortText}, med ${energyText}, ${completionText} og ${painText}.`;
}

function describeAdjustment(input: { factor: number; painLevel: number; completionPct: number; effort: number; energy: number }): string {
  if (input.painLevel >= 6) {
    return "Næste pas bliver derfor roligere, og programmet prioriterer restitution.";
  }
  if (input.completionPct < 70) {
    return "Næste pas bliver derfor gentaget i lignende form for at skabe stabil progression.";
  }
  if (input.effort >= 9 || input.energy <= 2) {
    return "Næste pas bliver derfor lidt lettere, og progressionen i den kommende uge dæmpes.";
  }
  if (input.factor > 1) {
    return "Næste pas bliver derfor let skærpet, fordi belastningen ser bæredygtig ud.";
  }
  if (input.factor < 1) {
    return "Næste pas bliver derfor kortere og mere kontrolleret.";
  }
  return "Programmet fortsætter som planlagt, da der ikke var behov for ændringer.";
}

export async function POST(req: Request) {
  try {
    const session = await getCurrentSession();
    const body = (await req.json()) as FeedbackBody;

    if (!body.profileId || !body.workoutSessionId) {
      return NextResponse.json({ error: "Missing profileId or workoutSessionId" }, { status: 400 });
    }

    const effort = clampNumber(Number(body.effort ?? 0), 1, 10);
    const completionPct = clampNumber(Number(body.completionPct ?? 0), 0, 100);
    const energy = clampNumber(Number(body.energy ?? 0), 1, 5);
    const painLevel = clampNumber(Number(body.painLevel ?? 1), 1, 10);
    const notes = body.notes?.trim() || null;

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

    const factor = adaptationFactor({ effort, completionPct, energy, painLevel });

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

    if (factor !== 1) {
      const futureSessions = workoutSession.plan.sessions.filter((s) => s.order > workoutSession.order);
      const updates: ReturnType<typeof prisma.workoutStep.update>[] = [];
      const sessionLoadUpdates: ReturnType<typeof prisma.workoutSession.update>[] = [];

      for (const future of futureSessions) {
        for (const step of future.steps) {
          if (step.type !== "run") continue;

          const nextDuration = normalizeStepDuration(clampNumber(step.durationSec * factor, 30, 20 * 60));
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
            data: { loadScore: clampNumber(future.loadScore * factor, 1, 10) },
          }),
        );
      }

      if (updates.length > 0 || sessionLoadUpdates.length > 0) {
        await prisma.$transaction([...updates, ...sessionLoadUpdates]);
      }
    }

    const summary = buildAdjustmentSummary({ effort, completionPct, energy, painLevel, factor });
    const interpretation = describeFeedbackInterpretation({ effort, completionPct, energy, painLevel });
    const adjustmentExplanation = describeAdjustment({ factor, painLevel, completionPct, effort, energy });

    return NextResponse.json({
      saved: true,
      adaptationFactor: factor,
      confirmation: {
        title: "Tak — din feedback er modtaget",
        message: "StridePilot har opdateret dit program ud fra din feedback.",
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
