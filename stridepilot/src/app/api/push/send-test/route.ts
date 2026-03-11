import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { canSendWebPush, sendPushNotification } from "@/lib/push/server";
import { getCurrentSession } from "@/lib/auth/session";

interface SendTestBody {
  profileId?: string;
}

export async function POST(req: Request) {
  try {
    if (!canSendWebPush()) {
      return NextResponse.json({ error: "Missing VAPID env vars" }, { status: 400 });
    }

    const session = await getCurrentSession();
    const body = (await req.json()) as SendTestBody;

    let profileId = body.profileId;
    if (!profileId && session) {
      const user = await prisma.appUser.findUnique({ where: { id: session.userId }, include: { profile: true } });
      profileId = user?.profile?.id;
    }

    if (!profileId) {
      return NextResponse.json({ error: "Missing profileId" }, { status: 400 });
    }

    const subscriptions = await prisma.pushSubscription.findMany({
      where: { profileId },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    if (subscriptions.length === 0) {
      return NextResponse.json({ error: "No push subscriptions for profile" }, { status: 404 });
    }

    const payload = {
      title: "StridePilot",
      body: "Tid til træning. Dit næste intervalpas venter.",
      url: "/",
    };

    await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          await sendPushNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth,
              },
            },
            payload,
          );
        } catch {
          // Ignore per-subscription errors; stale endpoints are expected over time.
        }
      }),
    );

    return NextResponse.json({ sent: true });
  } catch {
    return NextResponse.json({ error: "Could not send push" }, { status: 500 });
  }
}
