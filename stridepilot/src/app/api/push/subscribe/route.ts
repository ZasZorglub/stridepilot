import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSession } from "@/lib/auth/session";

interface PushKeys {
  p256dh?: string;
  auth?: string;
}

interface PushSubscriptionBody {
  profileId?: string;
  subscription?: {
    endpoint?: string;
    keys?: PushKeys;
  };
}

export async function POST(req: Request) {
  try {
    const session = await getCurrentSession();
    const body = (await req.json()) as PushSubscriptionBody;
    let profileId = body.profileId;

    if (!profileId && session) {
      const user = await prisma.appUser.findUnique({ where: { id: session.userId }, include: { profile: true } });
      profileId = user?.profile?.id;
    }

    const endpoint = body.subscription?.endpoint;
    const p256dh = body.subscription?.keys?.p256dh;
    const auth = body.subscription?.keys?.auth;

    if (!profileId || !endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: "Missing profileId or subscription values" }, { status: 400 });
    }

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: {
        profileId,
        p256dh,
        auth,
        userAgent: req.headers.get("user-agent") ?? null,
      },
      create: {
        profileId,
        endpoint,
        p256dh,
        auth,
        userAgent: req.headers.get("user-agent") ?? null,
      },
    });

    return NextResponse.json({ saved: true });
  } catch {
    return NextResponse.json({ error: "Could not save push subscription" }, { status: 500 });
  }
}
