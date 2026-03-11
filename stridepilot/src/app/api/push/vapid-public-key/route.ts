import { NextResponse } from "next/server";
import { getVapidPublicKey } from "@/lib/push/server";

export async function GET() {
  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return NextResponse.json({ error: "Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY" }, { status: 400 });
  }

  return NextResponse.json({ publicKey });
}
