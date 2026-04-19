import { WorkoutSession, WorkoutStep } from "@/lib/types";

export type WorkoutProfileLevel = "rest" | "easy" | "moderate" | "hard";

export type WorkoutProfileSegment = {
  level: WorkoutProfileLevel;
  durationSec: number;
};

function intensityRank(level: WorkoutProfileLevel): number {
  if (level === "hard") return 4;
  if (level === "moderate") return 3;
  if (level === "easy") return 2;
  return 1;
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

function dominantLevel(a: WorkoutProfileSegment, b: WorkoutProfileSegment): WorkoutProfileLevel {
  if (a.durationSec === b.durationSec) {
    return intensityRank(a.level) >= intensityRank(b.level) ? a.level : b.level;
  }
  return a.durationSec >= b.durationSec ? a.level : b.level;
}

export function deriveWorkoutProfile(session: WorkoutSession | null | undefined, maxSegments = 8): WorkoutProfileSegment[] | null {
  if (!session || session.steps.length === 0) return null;

  const targetSegments = Math.max(5, Math.min(10, maxSegments));
  const grouped = session.steps.reduce<WorkoutProfileSegment[]>((segments, step) => {
    const durationSec = Math.max(0, step.durationSec ?? 0);
    if (durationSec <= 0) return segments;

    const level = stepProfileLevel(step);
    const previous = segments[segments.length - 1];
    if (previous && previous.level === level) {
      previous.durationSec += durationSec;
      return segments;
    }

    segments.push({ level, durationSec });
    return segments;
  }, []);

  if (grouped.length === 0) return null;

  const compressed = [...grouped];
  while (compressed.length > targetSegments) {
    let mergeIndex = 0;
    let smallestCombinedDuration = Number.POSITIVE_INFINITY;

    for (let index = 0; index < compressed.length - 1; index += 1) {
      const combinedDuration = compressed[index]!.durationSec + compressed[index + 1]!.durationSec;
      if (combinedDuration < smallestCombinedDuration) {
        smallestCombinedDuration = combinedDuration;
        mergeIndex = index;
      }
    }

    const left = compressed[mergeIndex]!;
    const right = compressed[mergeIndex + 1]!;
    compressed.splice(mergeIndex, 2, {
      level: dominantLevel(left, right),
      durationSec: left.durationSec + right.durationSec,
    });
  }

  return compressed;
}
