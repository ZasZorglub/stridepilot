import { TrainingPlan, WorkoutSession } from "./types";

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const MS_PER_WEEK = MS_PER_DAY * 7;

export function parseIsoDateLocal(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function startOfCalendarWeek(date: Date): Date {
  const next = new Date(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function planStartWeekMonday(startDateIso: string): Date {
  return startOfCalendarWeek(parseIsoDateLocal(startDateIso));
}

export function dayOffsetFromSession(dayOfWeek: WorkoutSession["dayOfWeek"]): number {
  switch (dayOfWeek) {
    case "Mandag":
      return 0;
    case "Tirsdag":
      return 1;
    case "Onsdag":
      return 2;
    case "Torsdag":
      return 3;
    case "Fredag":
      return 4;
    case "Lordag":
      return 5;
    case "Sondag":
      return 6;
    default:
      return 0;
  }
}

export function sessionDateFromCalendarWeek(startDateIso: string, session: WorkoutSession): Date {
  const monday = planStartWeekMonday(startDateIso);
  const next = new Date(monday);
  next.setDate(monday.getDate() + (session.week - 1) * 7 + dayOffsetFromSession(session.dayOfWeek));
  next.setHours(0, 0, 0, 0);
  return next;
}

export function calendarWeekIndexFromDate(startDateIso: string, date: Date): number {
  const monday = planStartWeekMonday(startDateIso);
  const current = new Date(date);
  current.setHours(0, 0, 0, 0);
  const diffMs = current.getTime() - monday.getTime();
  return Math.floor(diffMs / MS_PER_WEEK) + 1;
}

export function calendarWeekDatesForIndex(startDateIso: string, weekIndex: number): Date[] {
  const monday = planStartWeekMonday(startDateIso);
  const weekStart = new Date(monday);
  weekStart.setDate(monday.getDate() + (weekIndex - 1) * 7);
  return Array.from({ length: 7 }, (_, index) => {
    const next = new Date(weekStart);
    next.setDate(weekStart.getDate() + index);
    next.setHours(0, 0, 0, 0);
    return next;
  });
}

export function deriveCalendarWeekCount(startDateIso: string, endDateIso?: string): number | null {
  if (!endDateIso) return null;
  const monday = planStartWeekMonday(startDateIso);
  const end = parseIsoDateLocal(endDateIso);
  end.setHours(0, 0, 0, 0);
  const diffMs = end.getTime() - monday.getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return null;
  return Math.floor(diffMs / MS_PER_WEEK) + 1;
}

export function sessionOccursOnOrAfterStart(startDateIso: string, session: WorkoutSession): boolean {
  return sessionDateFromCalendarWeek(startDateIso, session).getTime() >= parseIsoDateLocal(startDateIso).getTime();
}

export function visiblePlanSessions(plan: TrainingPlan, startDateIso?: string): WorkoutSession[] {
  if (!startDateIso) return plan.sessions;
  return plan.sessions.filter((session) => sessionOccursOnOrAfterStart(startDateIso, session));
}

