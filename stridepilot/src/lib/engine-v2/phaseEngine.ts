import type { Phase, PhaseBlock, PhasePlan, PhasePurpose, PhaseWeek, PlanType, RunnerClassification, RunnerInput } from "./models";
import { deriveCalendarWeekCount } from "../calendar-week";

type PhaseAllocations = Record<Phase, number>;

function normalizeAllocations(totalWeeks: number, raw: PhaseAllocations): PhaseAllocations {
  const entries: Array<[Phase, number]> = [
    ["base", raw.base],
    ["build", raw.build],
    ["specific", raw.specific],
    ["peak", raw.peak],
    ["taper", raw.taper],
  ];
  let assigned = entries.reduce((sum, [, count]) => sum + count, 0);
  while (assigned < totalWeeks) {
    raw.build += 1;
    assigned += 1;
  }
  while (assigned > totalWeeks) {
    const key = (["build", "base", "specific", "peak"] as Phase[]).find((phase) => raw[phase] > 1);
    if (!key) break;
    raw[key] -= 1;
    assigned -= 1;
  }
  return raw;
}

function defaultAllocations(totalWeeks: number, planType: PlanType, runnerLevel: RunnerClassification["traits"]["runnerLevel"]): PhaseAllocations {
  const returnLike = planType === "return_to_running" || planType === "consistency_builder";
  const targetTime = planType.includes("target_time");
  const performance = planType.includes("improve") || targetTime;
  const marathonLike = planType.includes("marathon");
  const beginner = runnerLevel === "true_beginner" || runnerLevel === "beginner_plus";

  if (returnLike) {
    const taper = totalWeeks >= 10 ? 1 : 0;
    const peak = 0;
    const base = Math.max(4, Math.round(totalWeeks * 0.45));
    const build = Math.max(2, totalWeeks - taper - base);
    const specific = 0;
    return normalizeAllocations(totalWeeks, { base, build, specific, peak, taper });
  }

  const taper = marathonLike ? Math.max(2, totalWeeks >= 18 ? 3 : 2) : totalWeeks >= 14 ? 2 : 1;
  const peak = marathonLike ? Math.max(1, Math.round(totalWeeks * 0.1)) : performance && totalWeeks >= 12 ? 2 : totalWeeks >= 16 ? 1 : 0;
  const base = beginner ? Math.max(3, Math.round(totalWeeks * 0.34)) : Math.max(2, Math.round(totalWeeks * (marathonLike ? 0.28 : 0.22)));
  const build = Math.max(3, Math.round(totalWeeks * (performance ? 0.28 : 0.34)));
  const specific = Math.max(performance || !beginner ? 2 : 1, totalWeeks - taper - peak - base - build);
  return normalizeAllocations(totalWeeks, { base, build, specific, peak, taper });
}

function phasePurpose(phase: Phase, planType: PlanType, classification: RunnerClassification): PhasePurpose {
  const beginner = classification.traits.runnerLevel === "true_beginner" || classification.traits.runnerLevel === "beginner_plus";
  const performance = planType.includes("improve") || planType.includes("target_time");
  if (phase === "base") {
    return {
      primaryObjective: beginner ? "Build basic durability and repeatable running rhythm." : "Stabilize aerobic base and repeatable weekly structure.",
      volumeEmphasis: 0.7,
      intensityEmphasis: 0.15,
      longRunEmphasis: 0.5,
      specificityEmphasis: 0.1,
      adaptationSensitivity: 0.8,
    };
  }
  if (phase === "build") {
    return {
      primaryObjective: "Increase total training load in a controlled way.",
      volumeEmphasis: 0.82,
      intensityEmphasis: 0.3,
      longRunEmphasis: 0.72,
      specificityEmphasis: 0.22,
      adaptationSensitivity: 0.72,
    };
  }
  if (phase === "specific") {
    return {
      primaryObjective: performance ? "Shift more load toward race-relevant work." : "Introduce more event-relevant rhythm without losing control.",
      volumeEmphasis: 0.62,
      intensityEmphasis: performance ? 0.62 : 0.38,
      longRunEmphasis: 0.66,
      specificityEmphasis: 0.7,
      adaptationSensitivity: 0.68,
    };
  }
  if (phase === "peak") {
    return {
      primaryObjective: "Deliver the strongest and most event-specific training weeks.",
      volumeEmphasis: 0.48,
      intensityEmphasis: performance ? 0.68 : 0.44,
      longRunEmphasis: 0.74,
      specificityEmphasis: 0.84,
      adaptationSensitivity: 0.74,
    };
  }
  return {
    primaryObjective: "Reduce fatigue while preserving confidence and rhythm.",
    volumeEmphasis: 0.22,
    intensityEmphasis: performance ? 0.36 : 0.24,
    longRunEmphasis: 0.2,
    specificityEmphasis: 0.52,
    adaptationSensitivity: 0.9,
  };
}

function buildBlocks(weeks: PhaseWeek[], planType: PlanType, classification: RunnerClassification): PhaseBlock[] {
  const blocks: PhaseBlock[] = [];
  for (const week of weeks) {
    const current = blocks.at(-1);
    if (!current || current.phase !== week.phase) {
      blocks.push({
        phase: week.phase,
        startWeekIndex: week.weekIndex,
        endWeekIndex: week.weekIndex,
        weeks: 1,
        purpose: phasePurpose(week.phase, planType, classification),
      });
    } else {
      current.endWeekIndex = week.weekIndex;
      current.weeks += 1;
    }
  }
  return blocks;
}

export function buildPhasePlan(input: RunnerInput, classification: RunnerClassification, planType: PlanType): PhasePlan {
  const totalWeeks = Math.max(6, deriveCalendarWeekCount(input.startDate, input.goalDate) ?? 12);
  const allocations = defaultAllocations(totalWeeks, planType, classification.traits.runnerLevel);
  const weeks: PhaseWeek[] = [];

  ([
    ["base", allocations.base],
    ["build", allocations.build],
    ["specific", allocations.specific],
    ["peak", allocations.peak],
    ["taper", allocations.taper],
  ] as Array<[Phase, number]>).forEach(([phase, count]) => {
    for (let index = 0; index < count; index += 1) {
      weeks.push({
        weekIndex: weeks.length + 1,
        phase,
        phaseProgress: count <= 1 ? 1 : index / (count - 1),
        isCutback: false,
      });
    }
  });

  return {
    totalWeeks,
    weeks,
    blocks: buildBlocks(weeks, planType, classification),
  };
}
