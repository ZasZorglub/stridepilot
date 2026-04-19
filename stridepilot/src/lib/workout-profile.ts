import { formatReadableDurationFromSeconds } from "@/lib/duration";
import { buildGoalEventSessionLabel, isGoalEventSession, translateVisibleSessionTitle } from "@/lib/program-screen";
import { GoalDistance, WorkoutSession, WorkoutStep } from "@/lib/types";

export type WorkoutProfileLevel = "rest" | "easy" | "moderate" | "hard";

export type WorkoutProfileSegment = {
  level: WorkoutProfileLevel;
  durationSec: number;
  stepType: WorkoutStep["type"];
};

export interface WorkoutCardRepresentation {
  title: string;
  duration: string;
  durationSec: number;
  shortStructureSummary: string;
  visualProfile: WorkoutProfileSegment[] | null;
}

function sameVisualSemantics(left: WorkoutProfileSegment, right: WorkoutProfileSegment): boolean {
  return left.stepType === right.stepType && left.level === right.level;
}

function stepProfileLevel(step: WorkoutStep): WorkoutProfileLevel {
  if (step.type === "walk") return "rest";
  if (step.type === "warmup" || step.type === "cooldown") return "easy";

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

function alternatingRunWalkPattern(steps: WorkoutStep[]): boolean {
  if (steps.length < 2) return false;
  if (steps[0]?.type !== "run") return false;
  return steps.every((step, index) => step.type === (index % 2 === 0 ? "run" : "walk"));
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
  const workSteps = relevantSteps.filter((step) => step.type === "run" || step.type === "walk");
  const runSteps = workSteps.filter((step) => step.type === "run");
  const walkSteps = workSteps.filter((step) => step.type === "walk");

  if (runSteps.length === 1 && walkSteps.length === 0) {
    return describeSingleRunStep(runSteps[0]!, locale);
  }

  if (runSteps.length >= 2 && walkSteps.length === 0 && sameDurations(runSteps)) {
    const runDuration = formatStepMinutes(runSteps[0]!.durationSec);
    return locale === "en" ? `${runSteps.length} × ${runDuration} run` : `${runSteps.length} × ${runDuration} løb`;
  }

  if (
    runSteps.length >= 2 &&
    walkSteps.length >= 1 &&
    alternatingRunWalkPattern(workSteps) &&
    sameDurations(runSteps) &&
    sameDurations(walkSteps)
  ) {
    const runDuration = formatStepMinutes(runSteps[0]!.durationSec);
    const walkDuration = formatStepMinutes(walkSteps[0]!.durationSec);
    return locale === "en"
      ? `${runSteps.length} × ${runDuration} run · ${walkDuration} walk`
      : `${runSteps.length} × ${runDuration} løb · ${walkDuration} gang`;
  }

  return fallbackStructureSummary(relevantSteps, locale);
}

function deriveVisualProfile(session: WorkoutSession): WorkoutProfileSegment[] | null {
  const groupedSegments = session.steps
    .filter((step) => step.durationSec > 0)
    .reduce<WorkoutProfileSegment[]>((segments, step) => {
      const nextSegment: WorkoutProfileSegment = {
        level: stepProfileLevel(step),
        durationSec: step.durationSec,
        stepType: step.type,
      };

      const previous = segments[segments.length - 1];
      if (previous && sameVisualSemantics(previous, nextSegment)) {
        previous.durationSec += nextSegment.durationSec;
        return segments;
      }

      segments.push(nextSegment);
      return segments;
    }, []);

  if (groupedSegments.length === 0) return null;
  return groupedSegments;
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
