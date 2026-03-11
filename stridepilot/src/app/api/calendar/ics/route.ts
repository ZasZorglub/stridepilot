import { NextResponse } from "next/server";
import { TrainingPlan } from "@/lib/types";
import { sessionStartDate } from "@/lib/schedule";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function toIcsDate(date: Date): string {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function escapeText(input: string): string {
  return input.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      plan: TrainingPlan;
      startDate: string;
      startTime?: string;
      calendarName?: string;
    };

    const startTime = body.startTime ?? "07:00";
    const [hourRaw, minuteRaw] = startTime.split(":");
    const startHour = Number(hourRaw);
    const startMinute = Number(minuteRaw);

    const events = body.plan.sessions.map((session) => {
      const start = sessionStartDate({
        startDate: new Date(`${body.startDate}T00:00:00`),
        week: session.week,
        dayOfWeek: session.dayOfWeek,
        startHour,
        startMinute,
      });
      const durationSec = session.steps.reduce((acc, step) => acc + step.durationSec, 0);
      const end = new Date(start.getTime() + durationSec * 1000);

      const description = `${session.notes ?? "Intervaltræning"}\\nSteps: ${session.steps
        .map((s) => `${s.label} (${Math.round(s.durationSec / 60)}m)`)
        .join(", ")}`;

      return [
        "BEGIN:VEVENT",
        `UID:${session.id}@stridepilot.local`,
        `DTSTAMP:${toIcsDate(new Date())}`,
        `DTSTART:${toIcsDate(start)}`,
        `DTEND:${toIcsDate(end)}`,
        `SUMMARY:${escapeText(session.title)}`,
        `DESCRIPTION:${escapeText(description)}`,
        "END:VEVENT",
      ].join("\r\n");
    });

    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//StridePilot//DA",
      "CALSCALE:GREGORIAN",
      `X-WR-CALNAME:${escapeText(body.calendarName ?? "StridePilot Plan")}`,
      ...events,
      "END:VCALENDAR",
      "",
    ].join("\r\n");

    return new NextResponse(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="stridepilot-plan.ics"',
      },
    });
  } catch {
    return NextResponse.json({ error: "Could not generate ICS" }, { status: 500 });
  }
}
