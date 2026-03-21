import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { createSessionToken, getSessionCookieName, getSessionMaxAge } from "@/lib/auth/session";
import { sendWelcomeEmail } from "@/lib/email";

interface RegisterBody {
  email?: string;
  password?: string;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RegisterBody;
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? "";

    if (!email || !email.includes("@") || password.length < 8) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 400 });
    }

    const existing = await prisma.appUser.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "User already exists" }, { status: 409 });
    }

    const user = await prisma.appUser.create({
      data: {
        email,
        passwordHash: hashPassword(password),
      },
    });

    try {
      await sendWelcomeEmail({ to: user.email });
    } catch (mailError) {
      console.error("Could not send welcome email", mailError);
    }

    const token = createSessionToken(user.id, user.email);
    const response = NextResponse.json({
      user: { id: user.id, email: user.email },
    });

    response.cookies.set(getSessionCookieName(), token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: getSessionMaxAge(),
    });

    return response;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json({ error: "User already exists" }, { status: 409 });
      }
      if (error.code === "P2021") {
        return NextResponse.json(
          { error: "Database schema is not up to date. Run prisma db push before registering users." },
          { status: 500 },
        );
      }
    }

    if (error instanceof Prisma.PrismaClientInitializationError) {
      return NextResponse.json({ error: "Could not connect to database" }, { status: 500 });
    }

    return NextResponse.json({ error: "Could not register" }, { status: 500 });
  }
}
