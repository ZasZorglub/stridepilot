import { buildGoalPlan } from "../src/lib/coach/build5kPlan";
import { coachEvaluationScenarios } from "../src/lib/coach/evaluationScenarios";
import type { GoalConfig, RunnerProfile, TrainingPlan, WorkoutStructureSegment, WorkoutSession } from "../src/lib/coach/types";

type ExpandedSegment = {
  type: WorkoutStructureSegment["type"] | "pause";
  label: string;
  durationMin: number;
};

type SessionFlag =
  | "passive_start"
  | "low_meaningful_running"
  | "long_passive_finish"
  | "muddy_structure";

function roundHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

function roundTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function formatMinutes(value: number): string {
  const rounded = roundTenth(value);
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}

function expandStructureForReview(structure: WorkoutStructureSegment[]): ExpandedSegment[] {
  const expanded: ExpandedSegment[] = [];

  for (const segment of structure) {
    const repeats = segment.repeats ?? 1;
    for (let index = 0; index < repeats; index += 1) {
      expanded.push({
        type: segment.type,
        label: repeats > 1 ? `${segment.label} ${index + 1}` : segment.label,
        durationMin: segment.durationMin,
      });

      if (segment.recoverMin && index < repeats - 1) {
        expanded.push({
          type: "pause",
          label: "Pause",
          durationMin: segment.recoverMin,
        });
      }
    }
  }

  return expanded;
}

function sumDuration(segments: ExpandedSegment[]): number {
  return roundHalf(segments.reduce((sum, segment) => sum + segment.durationMin, 0));
}

function runningDuration(segments: ExpandedSegment[]): number {
  return roundHalf(
    segments
      .filter((segment) => segment.type === "run" || segment.type === "steady" || segment.type === "tempo" || segment.type === "stride" || segment.type === "recovery")
      .reduce((sum, segment) => sum + segment.durationMin, 0),
  );
}

function openingDuration(segments: ExpandedSegment[]): number {
  let total = 0;
  for (const segment of segments) {
    const label = segment.label.toLowerCase();
    if (
      segment.type === "walk" ||
      segment.type === "warmup" ||
      label.includes("opvarm") ||
      (segment.type === "recovery" && label.includes("jog"))
    ) {
      total += segment.durationMin;
      continue;
    }
    break;
  }
  return roundHalf(total);
}

function endingDuration(segments: ExpandedSegment[]): number {
  let total = 0;
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index]!;
    const label = segment.label.toLowerCase();
    if (
      segment.type === "walk" ||
      segment.type === "cooldown" ||
      label.includes("ned") ||
      label.includes("afslut") ||
      (segment.type === "recovery" && label.includes("jog"))
    ) {
      total += segment.durationMin;
      continue;
    }
    break;
  }
  return roundHalf(total);
}

function summarizeExpandedStructure(segments: ExpandedSegment[]): string {
  return segments
    .map((segment) => `${formatMinutes(segment.durationMin)}m ${segment.label.toLowerCase()}`)
    .join(" -> ");
}

function sessionIdentity(session: WorkoutSession, expanded: ExpandedSegment[]): "continuous" | "run-walk" | "interval" | "mixed" {
  const hasRepeats = session.structure.some((segment) => (segment.repeats ?? 1) > 1);
  const hasPause = expanded.some((segment) => segment.type === "pause");
  const hasWalkInside = expanded.slice(1, -1).some((segment) => segment.type === "walk" || segment.type === "pause");
  const workBlocks = expanded.filter((segment) => segment.type === "run" || segment.type === "tempo" || segment.type === "steady" || segment.type === "stride");

  if (hasRepeats && hasPause) return session.type === "run-walk" ? "run-walk" : "interval";
  if (hasWalkInside && session.type === "run-walk") return "run-walk";
  if (!hasWalkInside && workBlocks.length <= 2) return "continuous";
  return "mixed";
}

function detectSessionFlags(session: WorkoutSession, expanded: ExpandedSegment[]): SessionFlag[] {
  const flags: SessionFlag[] = [];
  const total = sumDuration(expanded);
  const running = runningDuration(expanded);
  const opening = openingDuration(expanded);
  const ending = endingDuration(expanded);
  const walkStart = expanded[0]?.type === "walk" ? expanded[0].durationMin : 0;
  const identity = sessionIdentity(session, expanded);

  if (walkStart > 5 || (opening > 6 && total <= 26)) {
    flags.push("passive_start");
  }

  if (total <= 28 && running / Math.max(total, 1) < 0.45) {
    flags.push("low_meaningful_running");
  }

  if (ending > 5 || (ending >= 4 && ending / Math.max(total, 1) > 0.28)) {
    flags.push("long_passive_finish");
  }

  if (
    (session.type === "easy" || session.type === "recovery" || session.type === "long") &&
    identity !== "continuous"
  ) {
    flags.push("muddy_structure");
  }

  return flags;
}

function weeklyLoad(week: TrainingPlan["weeks"][number]): number {
  return roundHalf(week.sessions.reduce((sum, session) => sum + session.estimatedLoad, 0));
}

function describeInputs(profile: RunnerProfile, goal: GoalConfig): string[] {
  return [
    `goal=${goal.goalDistance} ${goal.goalIntent}`,
    `days=${goal.trainingDaysPerWeek}`,
    `category=${profile.runnerCategory ?? "auto"}`,
    `runs/wk=${profile.currentRunsPerWeek}`,
    `km/wk=${profile.currentWeeklyVolumeKm}`,
    `longest=${profile.longestRunMinutes}m`,
    `typical=${profile.typicalWorkoutMinutes}m`,
    `confidence=${profile.confidence}/5`,
    `injury=${profile.injurySensitivity}/5`,
  ];
}

function formatSessionReview(session: WorkoutSession): string[] {
  const expanded = expandStructureForReview(session.structure);
  const flags = detectSessionFlags(session, expanded);
  const markers = [
    `shape=${sessionIdentity(session, expanded)}`,
    `run=${formatMinutes(runningDuration(expanded))}m`,
    `open=${formatMinutes(openingDuration(expanded))}m`,
    `close=${formatMinutes(endingDuration(expanded))}m`,
  ];

  return [
    `  - ${session.dayOfWeek} | ${session.type} | ${session.title} | ${formatMinutes(session.durationMin)}m | load ${formatMinutes(session.estimatedLoad)}`,
    `    markers: ${markers.join(" · ")}${flags.length > 0 ? ` · flags=${flags.join(",")}` : ""}`,
    `    structure: ${summarizeExpandedStructure(expanded)}`,
  ];
}

function printScenarioReview(): void {
  for (const scenario of coachEvaluationScenarios) {
    const plan = buildGoalPlan(scenario.profile, scenario.goal);
    const reviewWeeks = Math.max(1, Math.min(scenario.reviewWeeks ?? 2, plan.weeks.length));
    const earlyWeeks = plan.weeks.slice(0, reviewWeeks);
    const firstWeekLoad = earlyWeeks[0] ? weeklyLoad(earlyWeeks[0]) : 0;
    const secondWeekLoad = earlyWeeks[1] ? weeklyLoad(earlyWeeks[1]) : 0;
    const progressionDelta = firstWeekLoad > 0 && secondWeekLoad > 0 ? roundHalf(((secondWeekLoad - firstWeekLoad) / firstWeekLoad) * 100) : 0;
    const planFlags = earlyWeeks.flatMap((week) => week.sessions.flatMap((session) => detectSessionFlags(session, expandStructureForReview(session.structure))));
    const planFlagSummary = [...new Set(planFlags)].map((flag) => `${flag}${planFlags.filter((entry) => entry === flag).length > 1 ? `×${planFlags.filter((entry) => entry === flag).length}` : ""}`);

    console.log(`\n=== ${scenario.id} :: ${scenario.name} ===`);
    console.log(`focus: ${scenario.focus}`);
    console.log(`inputs: ${describeInputs(scenario.profile, scenario.goal).join(" | ")}`);
    console.log(`plan: type=${plan.planType ?? "n/a"} | totalWeeks=${plan.weeks.length} | reviewWeeks=${reviewWeeks}`);
    console.log(`early-load: week1=${formatMinutes(firstWeekLoad)}${secondWeekLoad > 0 ? ` | week2=${formatMinutes(secondWeekLoad)} | delta=${formatMinutes(progressionDelta)}%` : ""}`);
    console.log(`early-flags: ${planFlagSummary.length > 0 ? planFlagSummary.join(", ") : "none"}`);

    for (const week of earlyWeeks) {
      console.log(`week ${week.weekNumber} | phase=${week.phase} | focus=${week.focus} | load=${weeklyLoad(week)}`);
      for (const session of week.sessions) {
        for (const line of formatSessionReview(session)) {
          console.log(line);
        }
      }
    }
  }
}

printScenarioReview();
