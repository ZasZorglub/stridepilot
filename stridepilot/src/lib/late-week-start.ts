import { Goal, RunnerProfile, TrainingPlan, WorkoutSession } from "./types";
import { SiteLocale } from "./site-variant";

function parseIsoDateLocal(value: string): Date | null {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfCalendarWeek(date: Date): Date {
  const next = new Date(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  next.setHours(0, 0, 0, 0);
  return next;
}

function toIsoDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dayOffsetFromWeekday(dayOfWeek: WorkoutSession["dayOfWeek"]): number {
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

export interface StubWeekPolicy {
  selectedStartDateIso: string;
  effectiveStartDateIso: string;
  shiftedToNextWeek: boolean;
  hasStubWeek: boolean;
  remainingPlannedSessions: number;
}

export function resolveStubWeekPolicy(params: {
  selectedStartDateIso: string;
  availableTrainingDays?: WorkoutSession["dayOfWeek"][] | null;
  minimumOpeningWeekSessions?: number;
}): StubWeekPolicy {
  const minimumOpeningWeekSessions = params.minimumOpeningWeekSessions ?? 2;
  const selectedDays = params.availableTrainingDays ?? [];
  const selectedStartDate = parseIsoDateLocal(params.selectedStartDateIso);

  if (!selectedStartDate || selectedDays.length === 0) {
    return {
      selectedStartDateIso: params.selectedStartDateIso,
      effectiveStartDateIso: params.selectedStartDateIso,
      shiftedToNextWeek: false,
      hasStubWeek: false,
      remainingPlannedSessions: 0,
    };
  }

  const weekStart = startOfCalendarWeek(selectedStartDate);
  const remainingPlannedSessions = selectedDays.filter((day) => {
    const sessionDate = new Date(weekStart);
    sessionDate.setDate(weekStart.getDate() + dayOffsetFromWeekday(day));
    return sessionDate.getTime() >= selectedStartDate.getTime();
  }).length;

  if (selectedDays.length < minimumOpeningWeekSessions || remainingPlannedSessions >= minimumOpeningWeekSessions) {
    return {
      selectedStartDateIso: params.selectedStartDateIso,
      effectiveStartDateIso: params.selectedStartDateIso,
      shiftedToNextWeek: false,
      hasStubWeek: false,
      remainingPlannedSessions,
    };
  }

  const nextWeekStart = new Date(weekStart);
  nextWeekStart.setDate(weekStart.getDate() + 7);
  return {
    selectedStartDateIso: params.selectedStartDateIso,
    effectiveStartDateIso: toIsoDateLocal(nextWeekStart),
    shiftedToNextWeek: true,
    hasStubWeek: remainingPlannedSessions > 0,
    remainingPlannedSessions,
  };
}

export function buildStubWeekSession(params: {
  policy: StubWeekPolicy;
  runnerProfile: RunnerProfile;
  goal: Goal;
  locale?: SiteLocale;
}): WorkoutSession | null {
  const { policy, runnerProfile, goal } = params;
  const locale = params.locale ?? "da";
  if (!policy.hasStubWeek) return null;

  const selectedStartDate = parseIsoDateLocal(policy.selectedStartDateIso);
  if (!selectedStartDate) return null;
  const weekStart = startOfCalendarWeek(selectedStartDate);
  const remainingDays = (goal.availableTrainingDays ?? [])
    .map((day) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + dayOffsetFromWeekday(day));
      date.setHours(0, 0, 0, 0);
      return { day, date };
    })
    .filter((entry) => entry.date.getTime() >= selectedStartDate.getTime())
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const firstOpportunity = remainingDays[0];
  if (!firstOpportunity) return null;

  const beginnerLike =
    runnerProfile.onboardingTrack === "getting_started" ||
    runnerProfile.onboardingTrack === "returning" ||
    (runnerProfile.currentRunsPerWeek ?? 0) <= 1 ||
    (runnerProfile.currentWeeklyVolumeKm ?? 0) <= 10 ||
    (runnerProfile.longestCurrentRunMin ?? 0) <= 25;

  const runWalk = beginnerLike || (runnerProfile.currentContinuousDistanceKm ?? 0) <= 3;
  const continuitySensitiveStarter =
    (runnerProfile.currentContinuousDistanceKm ?? 0) >= 0.5 ||
    (runnerProfile.longestCurrentRunMin ?? 0) >= 4 ||
    (runnerProfile.currentWeeklyVolumeKm ?? 0) >= 3;
  const introRunSec = runWalk
    ? runnerProfile.onboardingTrack === "getting_started" || (runnerProfile.currentRunsPerWeek ?? 0) === 0
      ? continuitySensitiveStarter
        ? 75
        : 60
      : continuitySensitiveStarter
        ? 90
        : 75
    : 12 * 60;
  const walkSec = runWalk ? 90 : 0;

  const steps = runWalk
    ? [
        { type: "walk" as const, label: locale === "en" ? "Easy start" : "Rolig start", durationSec: 3 * 60, cue: locale === "en" ? "Start calmly and find an easy rhythm." : "Start roligt og find rytmen." },
        { type: "run" as const, label: locale === "en" ? "Short run" : "Kort løb", durationSec: introRunSec, cue: locale === "en" ? "Run calmly and under control." : "Løb roligt og kontrolleret." },
        { type: "walk" as const, label: locale === "en" ? "Walk break" : "Gangpause", durationSec: walkSec, cue: locale === "en" ? "Walk easily and let your breathing settle." : "Gå roligt og lad pulsen falde." },
        { type: "run" as const, label: locale === "en" ? "Short run" : "Kort løb", durationSec: introRunSec, cue: locale === "en" ? "Keep it light and relaxed." : "Hold det let og ubesværet." },
        { type: "walk" as const, label: locale === "en" ? "Walk break" : "Gangpause", durationSec: walkSec, cue: locale === "en" ? "Keep rolling calmly." : "Rul roligt videre." },
        { type: "run" as const, label: locale === "en" ? "Short run" : "Kort løb", durationSec: introRunSec, cue: locale === "en" ? "Just find a calm rhythm." : "Bare find en rolig rytme." },
        { type: "walk" as const, label: locale === "en" ? "Walk break" : "Gangpause", durationSec: walkSec, cue: locale === "en" ? "Let the body settle again." : "Lad kroppen falde til ro igen." },
        { type: "run" as const, label: locale === "en" ? "Short run" : "Kort løb", durationSec: introRunSec, cue: locale === "en" ? "Finish with plenty in reserve." : "Afslut stadig med overskud." },
        { type: "walk" as const, label: locale === "en" ? "Easy finish" : "Rolig afslutning", durationSec: 3 * 60, cue: locale === "en" ? "Walk it down calmly." : "Gå roligt ned." },
      ]
    : [
        { type: "walk" as const, label: locale === "en" ? "Easy start" : "Rolig start", durationSec: 3 * 60, cue: locale === "en" ? "Start calmly and let the body wake up." : "Start roligt og lad kroppen vågne." },
        { type: "run" as const, label: locale === "en" ? "Easy run" : "Let løb", durationSec: introRunSec, cue: locale === "en" ? "Keep the effort light and controlled." : "Hold et let og kontrolleret tempo." },
        { type: "walk" as const, label: locale === "en" ? "Easy finish" : "Rolig afslutning", durationSec: 3 * 60, cue: locale === "en" ? "Walk it down calmly." : "Gå roligt ned." },
      ];

  return {
    id: "stub-week-intro",
    title: locale === "en" ? "Ease in" : "Kom roligt i gang",
    week: 0,
    dayOfWeek: firstOpportunity.day,
    notes: locale === "en" ? "Low-pressure intro session before the first full training week." : "Lavtryks-intropas før den første fulde træningsuge.",
    loadScore: 1,
    steps,
  };
}

export function applyStubWeekToPlan(plan: TrainingPlan, stubSession: WorkoutSession | null): TrainingPlan {
  if (!stubSession) return plan;
  if (plan.sessions.some((session) => session.id === stubSession.id)) return plan;
  return {
    ...plan,
    sessions: [stubSession, ...plan.sessions],
  };
}
