import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { canSendWebPush, sendPushNotification } from "@/lib/push/server";
import { sessionStartDate } from "@/lib/schedule";

function getWindowMinutes(): number {
  const raw = Number(process.env.PUSH_WINDOW_MINUTES ?? 60);
  if (!Number.isFinite(raw) || raw <= 0) return 60;
  return Math.min(180, Math.round(raw));
}

async function run(req: Request) {
  try {
    if (!canSendWebPush()) {
      return NextResponse.json({ error: "Missing VAPID env vars" }, { status: 400 });
    }

    const expectedSecret = process.env.CRON_SECRET;
    if (expectedSecret) {
      const incoming = req.headers.get("x-cron-secret");
      if (incoming !== expectedSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const now = new Date();
    const windowEnd = new Date(now.getTime() + getWindowMinutes() * 60 * 1000);

    const latestPlans = await prisma.trainingPlan.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        goal: true,
        sessions: {
          orderBy: [{ week: "asc" }, { order: "asc" }],
        },
        profile: {
          include: {
            pushSubscriptions: true,
          },
        },
      },
    });

    const planByProfile = new Map<string, (typeof latestPlans)[number]>();
    for (const plan of latestPlans) {
      if (!planByProfile.has(plan.profileId)) {
        planByProfile.set(plan.profileId, plan);
      }
    }

    let delivered = 0;
    let skipped = 0;

    for (const plan of planByProfile.values()) {
      if (!plan.goal || plan.profile.pushSubscriptions.length === 0) {
        continue;
      }

      for (const session of plan.sessions) {
        const scheduledFor = sessionStartDate({
          startDate: plan.goal.startDate,
          week: session.week,
          dayOfWeek: session.dayOfWeek,
          startHour: plan.goal.reminderHour,
          startMinute: plan.goal.reminderMin,
        });

        if (scheduledFor < now || scheduledFor > windowEnd) {
          continue;
        }

        for (const sub of plan.profile.pushSubscriptions) {
          const existing = await prisma.pushDelivery.findUnique({
            where: {
              pushSubId_workoutSessionId: {
                pushSubId: sub.id,
                workoutSessionId: session.id,
              },
            },
          });

          if (existing) {
            skipped += 1;
            continue;
          }

          try {
            await sendPushNotification(
              {
                endpoint: sub.endpoint,
                keys: {
                  p256dh: sub.p256dh,
                  auth: sub.auth,
                },
              },
              {
                title: "StridePilot",
                body: `Tid til træning: ${session.title}`,
                url: "/",
              },
            );

            await prisma.pushDelivery.create({
              data: {
                pushSubId: sub.id,
                workoutSessionId: session.id,
                scheduledFor,
                status: "sent",
              },
            });

            delivered += 1;
          } catch {
            await prisma.pushDelivery.create({
              data: {
                pushSubId: sub.id,
                workoutSessionId: session.id,
                scheduledFor,
                status: "failed",
              },
            });
            skipped += 1;
          }
        }
      }
    }

    return NextResponse.json({ ok: true, delivered, skipped, now: now.toISOString(), windowEnd: windowEnd.toISOString() });
  } catch {
    return NextResponse.json({ error: "Could not send due pushes" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return run(req);
}

export async function GET(req: Request) {
  return run(req);
}
