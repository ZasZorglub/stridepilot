import OpenAI from "openai";
import { NextResponse } from "next/server";
import { generateFallbackPlan, normalizeTrainingPlan } from "@/lib/plan";
import { prisma } from "@/lib/db";
import { Goal, RunnerProfile, TrainingPlan } from "@/lib/types";
import { getCurrentSession } from "@/lib/auth/session";
import { applyAdaptiveGuardrails, buildAdaptationPayload, FeedbackSignal } from "@/lib/adaptation";
import { applyPlanSafety, validatePlanFeasibility } from "@/lib/plan-safety";

const WEEKDAY_ORDER: TrainingPlan["sessions"][number]["dayOfWeek"][] = [
  "Mandag",
  "Tirsdag",
  "Onsdag",
  "Torsdag",
  "Fredag",
  "Lordag",
  "Sondag",
];

const COACH_SYSTEM_PROMPT = [
  "Du er StridePilots løbecoach og programarkitekt.",
  "Du skal generere realistiske, sikre og målspecifikke løbeprogrammer.",
  "Sikkerhed kommer før ambition. Programmet skal være realistisk i forhold til niveau, mål, ønsket sluttid, uger og træningsdage.",
  "Hvis målet ikke er realistisk/forsvarligt, må du ikke lave aggressivt program.",
  "Progression skal være konservativ: ugentlig stigning ca. maks 5%, hver 4. uge lettere, undgå store spring i længste pas.",
  "Alle interval-step-varigheder skal være i 30-sekunders trin.",
  "Brug kun de træningsdage, brugeren har angivet som mulige.",
  "Programmet skal kulminere målspecifikt: 5K med 5K-relevante pas, 10K med 10K-relevante pas, osv.",
  "Du skal altid levere et komplet baseline-program fra uge 1 til sidste uge med synlig progression uge for uge.",
  "Ved signaler om smerte/lav energi/lav gennemførelse må du ikke skærpe programmet aggressivt.",
  "Returner kun gyldigt JSON uden markdown.",
  "JSON skal indeholde: feasibility_status (feasible|feasible_with_adjustments|not_feasible), coach_summary, internal_reasoning_summary, summary, weeks, sessionsPerWeek, sessions[].",
  "Hver session skal have: id, title, week, dayOfWeek (Mandag-Sondag), notes, loadScore (1-10), steps[].",
  "Hvert step skal have: type (warmup/run/walk/cooldown), label, durationSec, cue.",
].join(" ");

function extractJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model response did not contain JSON");
  }
  return JSON.parse(text.slice(start, end + 1));
}

function applyPreferredTrainingDays(plan: TrainingPlan, preferredDays?: TrainingPlan["sessions"][number]["dayOfWeek"][]): TrainingPlan {
  if (!preferredDays || preferredDays.length === 0) return plan;
  const normalizedPreferred = WEEKDAY_ORDER.filter((day) => preferredDays.includes(day));
  if (normalizedPreferred.length === 0) return plan;

  const sessionsByWeek = new Map<number, TrainingPlan["sessions"]>();
  for (const session of plan.sessions) {
    const bucket = sessionsByWeek.get(session.week) ?? [];
    bucket.push(session);
    sessionsByWeek.set(session.week, bucket);
  }

  const remappedSessions: TrainingPlan["sessions"] = [];
  for (const [week, sessions] of [...sessionsByWeek.entries()].sort((a, b) => a[0] - b[0])) {
    sessions.forEach((session, index) => {
      remappedSessions.push({
        ...session,
        week,
        dayOfWeek: normalizedPreferred[index % normalizedPreferred.length],
      });
    });
  }

  return {
    ...plan,
    sessions: remappedSessions,
  };
}

function parseReminderTime(reminderTime?: string): { reminderHour: number; reminderMin: number } {
  const fallback = { reminderHour: 13, reminderMin: 0 };
  if (!reminderTime) return fallback;

  const [h, m] = reminderTime.split(":").map((v) => Number(v));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return fallback;
  if (h < 0 || h > 23 || m < 0 || m > 59) return fallback;
  return { reminderHour: h, reminderMin: m };
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
    const body = (await req.json()) as {
      runnerProfile: RunnerProfile;
      goal: Goal;
      profileId?: string;
      runsPerWeek?: number;
    };
    const { runnerProfile, goal, profileId } = body;
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
          warnings: feasibility.warnings,
          minWeeksRequired: feasibility.minWeeksRequired,
          message: feasibilityMessage,
        },
        { status: 422 },
      );
    }

    let source: "openai" | "fallback" = "fallback";
    let plan: TrainingPlan = generateFallbackPlan(runnerProfile, goal);

    const currentWeek = 1;
    const recentFeedback = await fetchRecentFeedbackSignals(session?.userId, profileId);
    const adaptationPayload = buildAdaptationPayload({
      goal,
      runnerProfile,
      currentWeek,
      recentFeedback,
    });

    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      try {
        const client = new OpenAI({ apiKey });
        const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

        const completion = await client.chat.completions.create({
          model,
          temperature: 0.35,
          messages: [
            {
              role: "system",
              content: COACH_SYSTEM_PROMPT,
            },
            {
              role: "user",
              content: JSON.stringify({
                instruction:
                  "Design et komplet baseline-løbeprogram fra start til slut med realistisk progression, restitutionsuger og en tydelig måldag i slutugen. Programlængde: 12-52 uger. Prioritér valgte træningsdage og mål-specifik slutfase. Hvis målet virker urealistisk: returner feasibility_status som not_feasible eller feasible_with_adjustments med konservative forslag.",
                adaptationPayload,
              }),
            },
          ],
        });

        const content = completion.choices[0]?.message?.content;
        if (content) {
          const parsed = extractJsonObject(content);
          plan = normalizeTrainingPlan(parsed, runnerProfile, goal);
          source = "openai";
        }
      } catch {
        source = "fallback";
      }
    }

    plan = applyAdaptiveGuardrails(plan, recentFeedback);
    const safety = applyPlanSafety({ plan, goal, recentFeedback });
    plan = applyPreferredTrainingDays(safety.plan, goal.availableTrainingDays);

    try {
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
        adaptation: {
          signalCount: recentFeedback.length,
          message: "Programmet tilpasses løbende efter belastning, energi og gennemførelse.",
        },
        warnings: feasibility.warnings,
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
        warnings: feasibility.warnings,
        safetyAdjustments: safety.adjustments,
        adjustments: safety.adjustments,
        persistence: { saved: false },
      });
    }
  } catch {
    return NextResponse.json({ error: "Could not generate training plan" }, { status: 500 });
  }
}
