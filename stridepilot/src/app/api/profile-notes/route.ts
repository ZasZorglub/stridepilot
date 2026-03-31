import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSession } from "@/lib/auth/session";

interface NoteBody {
  profileId?: string;
  text?: string;
}

export async function POST(req: Request) {
  try {
    const session = await getCurrentSession();
    const body = (await req.json()) as NoteBody;
    const profileId = body.profileId?.trim();
    const text = body.text?.trim();

    if (!profileId || !text) {
      return NextResponse.json({ error: "Missing profile or note text" }, { status: 400 });
    }

    const profile = await prisma.runnerProfile.findUnique({ where: { id: profileId } });
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (session && profile.userId && profile.userId !== session.userId) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }

    const note = await prisma.profileNote.create({
      data: {
        profileId,
        text,
      },
    });

    return NextResponse.json({
      note: {
        id: note.id,
        createdAt: note.createdAt.toISOString(),
        text: note.text,
      },
    });
  } catch {
    return NextResponse.json({ error: "Could not save note" }, { status: 500 });
  }
}
