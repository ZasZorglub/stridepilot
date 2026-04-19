import { formatReadableDurationFromSeconds } from "@/lib/duration";
import { buildGoalEventSessionLabel, isGoalEventSession, translateVisibleSessionTitle } from "@/lib/program-screen";
import { GoalDistance, WorkoutSession, WorkoutStep } from "@/lib/types";

export type WorkoutProfileLevel = "rest" | "easy" | "moderate" | "hard";

export type WorkoutProfileSegment = {
  level: WorkoutProfileLevel;
  durationSec: number;
  stepType: WorkoutStep["type"];
  role: "warmup" | "work" | "recovery" | "walk" | "cooldown";
};

export interface WorkoutCardRepresentation {
  title: string;
  duration: string;
  durationSec: number;
  shortStructureSummary: string;
  visualProfile: WorkoutProfileSegment[] | null;
}

function stepRole(step: WorkoutStep): WorkoutProfileSegment["role"] {
  if (step.type === "warmup") return "warmup";
  if (step.type === "cooldown") return "cooldown";
  if (step.type === "walk") return "walk";

  const identity = `${step.label} ${step.cue} ${step.heartRateGuidance?.summary ?? ""}`.toLowerCase();
  if (/pause|recovery|meget let|falde til ro|zone 1-2|rolig tilbage|rolig afslutning/.test(identity)) {
    return "recovery";
  }

  return "work";
}

function stepProfileLevel(step: WorkoutStep): WorkoutProfileLevel {
  if (step.type === "walk") return "rest";
  if (step.type === "warmup" || step.type === "cooldown") return "easy";
  if (stepRole(step) === "recovery") return "rest";

  const zoneLabel = step.heartRateGuidance?.zoneLabel?.toLowerCase() ?? "";
  const stepIdentity = `${step.label} ${step.cue}`.toLowerCase();

  if (zoneLabel.includes("zone 4") || zoneLabel.includes("zone 5")) return "hard";
  if (zoneLabel.includes("zone 3") || zoneLabel.includes("ovre zone 2")) return "moderate";
  if (/interval|bakke|hill|drag/.test(stepIdentity)) return "hard";
  if (/tempo|steady|progression|maal|mål|race|specifik/.test(stepIdentity)) return "moderate";
  return "easy";
}

function formatStepMinutes(durationSec: number): string {
  return formatReadableDurationFromSeconds(durationSec);
}

function sameDurations(steps: WorkoutStep[]): boolean {
  if (steps.length <= 1) return true;
  return steps.every((step) => step.durationSec === steps[0]?.durationSec);
}

function alternatingWorkRecoveryPattern(steps: WorkoutStep[]): boolean {
  if (steps.length < 2) return false;
  if (stepRole(steps[0]!) !== "work") return false;
  return steps.every((step, index) => stepRole(step) === (index % 2 === 0 ? "work" : "recovery"));
}

function recoveryStepLabel(step: WorkoutStep, locale: "da" | "en"): string {
  if (step.type === "walk") return locale === "en" ? "walk" : "gang";
  return locale === "en" ? "easy" : "roligt";
}

function describeSingleRunStep(step: WorkoutStep, locale: "da" | "en"): string {
  const duration = formatStepMinutes(step.durationSec);
  const level = stepProfileLevel(step);

  if (locale === "en") {
    if (level === "easy") return `${duration} easy run`;
    return `${duration} continuous run`;
  }

  if (level === "easy") return `${duration} roligt løb`;
  return `${duration} sammenhængende løb`;
}

function fallbackStructureSummary(steps: WorkoutStep[], locale: "da" | "en"): string {
  return steps
    .filter((step) => step.durationSec > 0)
    .map((step) => {
      const duration = formatStepMinutes(step.durationSec);
      if (locale === "en") {
        if (step.type === "warmup") return `${duration} warm-up`;
        if (step.type === "cooldown") return `${duration} cool-down`;
        if (step.type === "run") return `${duration} run`;
        return `${duration} walk`;
      }

      if (step.type === "warmup") return `${duration} opvarmning`;
      if (step.type === "cooldown") return `${duration} nedkøling`;
      if (step.type === "run") return `${duration} løb`;
      return `${duration} gang`;
    })
    .join(" · ");
}

function deriveShortStructureSummary(session: WorkoutSession, locale: "da" | "en"): string {
  const relevantSteps = session.steps.filter((step) => step.durationSec > 0);
  const mainSteps = relevantSteps.filter((step) => stepRole(step) === "work" || stepRole(step) === "recovery" || stepRole(step) === "walk");
  const workSteps = mainSteps.filter((step) => stepRole(step) === "work");
  const recoverySteps = mainSteps.filter((step) => stepRole(step) === "recovery" || stepRole(step) === "walk");

  if (workSteps.length === 1 && recoverySteps.length === 0) {
    return describeSingleRunStep(workSteps[0]!, locale);
  }

  if (workSteps.length >= 2 && recoverySteps.length === 0 && sameDurations(workSteps)) {
    const runDuration = formatStepMinutes(workSteps[0]!.durationSec);
    return locale === "en" ? `${workSteps.length} × ${runDuration} run` : `${workSteps.length} × ${runDuration} løb`;
  }

  if (
    workSteps.length >= 2 &&
    recoverySteps.length >= 1 &&
    alternatingWorkRecoveryPattern(mainSteps) &&
    sameDurations(workSteps) &&
    sameDurations(recoverySteps)
  ) {
    const runDuration = formatStepMinutes(workSteps[0]!.durationSec);
    const recoveryDuration = formatStepMinutes(recoverySteps[0]!.durationSec);
    const recoveryLabel = recoveryStepLabel(recoverySteps[0]!, locale);
    return locale === "en"
      ? `${workSteps.length} × ${runDuration} run · ${recoveryDuration} ${recoveryLabel}`
      : `${workSteps.length} × ${runDuration} løb · ${recoveryDuration} ${recoveryLabel}`;
  }

  return fallbackStructureSummary(relevantSteps, locale);
}

function deriveVisualProfile(session: WorkoutSession): WorkoutProfileSegment[] | null {
  const rawSegments = session.steps
    .filter((step) => step.durationSec > 0)
    .map<WorkoutProfileSegment>((step) => ({
      level: stepProfileLevel(step),
      durationSec: step.durationSec,
      stepType: step.type,
      role: stepRole(step),
    }));

  if (rawSegments.length === 0) return null;
  return rawSegments;
}

function visibleWorkoutTitle(session: WorkoutSession, locale: "da" | "en", goalDistance?: GoalDistance): string {
  if (goalDistance && isGoalEventSession(session)) {
    return buildGoalEventSessionLabel(session, goalDistance, locale);
  }

  return translateVisibleSessionTitle(session.title, locale);
}

export function deriveWorkoutCardRepresentation(
  session: WorkoutSession | null | undefined,
  options?: {
    locale?: "da" | "en";
    goalDistance?: GoalDistance;
  },
): WorkoutCardRepresentation | null {
  if (!session || session.steps.length === 0) return null;

  const locale = options?.locale ?? "da";
  const durationSec = session.steps.reduce((sum, step) => sum + Math.max(0, step.durationSec), 0);

  return {
    title: visibleWorkoutTitle(session, locale, options?.goalDistance),
    duration: formatReadableDurationFromSeconds(durationSec),
    durationSec,
    shortStructureSummary: deriveShortStructureSummary(session, locale),
    visualProfile: deriveVisualProfile(session),
  };
}

export function deriveWorkoutProfile(session: WorkoutSession | null | undefined): WorkoutProfileSegment[] | null {
  return deriveWorkoutCardRepresentation(session)?.visualProfile ?? null;
}
