import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildGoalPlan } from "../src/lib/coach/build5kPlan";
import { interpretRunnerProfile } from "../src/lib/coach/interpreter";
import {
  fixedProgramExportScenarios,
  programExportScenarios,
  stressProgramExportScenarios,
  type ProgramExportScenario,
} from "../src/lib/coach/programExportScenarios";
import type { OnboardingInterpretationInput, TrainingPlan, WorkoutSession, WorkoutStructureSegment } from "../src/lib/coach/types";

type ExpandedSegment = {
  order: number;
  type: WorkoutStructureSegment["type"] | "pause";
  label: string;
  durationMin: number;
  sourceRepeatIndex?: number;
};

type SessionFlag =
  | "passive_start"
  | "low_meaningful_running"
  | "long_passive_finish"
  | "muddy_structure";

type WeekFlag = "abrupt_load_jump" | "partial_first_week";

interface ExportSession {
  id: string;
  dayOfWeek: WorkoutSession["dayOfWeek"];
  date: string;
  type: WorkoutSession["type"];
  title: string;
  description: string;
  intent: string;
  effortGuidance: string;
  totalDurationMin: number;
  estimatedLoad: number;
  rawStructure: WorkoutStructureSegment[];
  orderedStructure: ExpandedSegment[];
  structureSummary: string;
  runningDurationMin: number;
  openingDurationMin: number;
  endingDurationMin: number;
  flags: SessionFlag[];
}

interface ExportWeek {
  weekNumber: number;
  phase: TrainingPlan["weeks"][number]["phase"];
  focus: string;
  weekSummary: string;
  estimatedLoad: number;
  sessionCount: number;
  flags: WeekFlag[];
  sessions: ExportSession[];
}

interface ExportProgram {
  programId: string;
  scenarioId: string;
  scenarioName: string;
  scenarioType: "fixed" | "stress";
  scenarioFocus: string;
  scenarioTags: string[];
  comparisonGroup?: string;
  planType: TrainingPlan["planType"];
  goal: ProgramExportScenario["goal"];
  weeks: number;
  userInputs: {
    recentRunningState?: NonNullable<OnboardingInterpretationInput["recentRunningState"]>;
    onboardingTrack?: OnboardingInterpretationInput["onboardingTrack"];
    currentAbility?: string;
    baseProgramTrack: ProgramExportScenario["profile"]["baseProgramTrack"];
    archetype: ProgramExportScenario["profile"]["archetype"];
    runnerCategory: ProgramExportScenario["profile"]["runnerCategory"];
    aerobicBase: number;
    runningSpecificity: number;
    confidence: number;
    injurySensitivity: number;
    progressionStyle: ProgramExportScenario["profile"]["progressionStyle"];
    currentRunsPerWeek: number;
    currentWeeklyVolumeKm: number;
    longestRunMinutes: number;
    typicalWorkoutMinutes: number;
    realisticTrainingDaysPerWeek: number;
    trainingDaysPerWeek: ProgramExportScenario["goal"]["trainingDaysPerWeek"];
    preferredTrainingDays: NonNullable<ProgramExportScenario["goal"]["preferredTrainingDays"]>;
    preferredLongRunDay?: ProgramExportScenario["goal"]["preferredLongRunDay"];
    startDate: string;
    targetDate: string;
    goalIntent: ProgramExportScenario["goal"]["goalIntent"];
    goalDistance: ProgramExportScenario["goal"]["goalDistance"];
    targetTime?: string;
  };
  calendarAssumptions: {
    startDate: string;
    targetDate: string;
    preferredTrainingDays: NonNullable<ProgramExportScenario["goal"]["preferredTrainingDays"]>;
    requestedTrainingDaysPerWeek: number;
    firstWeekSessionCount: number;
    partialFirstWeek: boolean;
  };
  reviewWeeks: ExportWeek[];
  reviewFlags: {
    sessionFlagCounts: Record<SessionFlag, number>;
    weekFlags: WeekFlag[];
  };
}

interface ExportBundle {
  exportVersion: 1;
  generatedFromBranch?: string;
  totalPrograms: number;
  fixedPrograms: number;
  stressPrograms: number;
  reviewWeeksPerProgram: number;
  programs: ExportProgram[];
}

const REVIEW_WEEKS = 3;
const OUTPUT_DIR = "/Users/anderschristiansloth/stridepilot/stridepilot/artifacts/engine-program-export";
const OUTPUT_JSON = join(OUTPUT_DIR, "programs.json");
const OUTPUT_MD = join(OUTPUT_DIR, "README.md");

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
  let order = 1;

  for (const segment of structure) {
    const repeats = segment.repeats ?? 1;
    for (let index = 0; index < repeats; index += 1) {
      expanded.push({
        order,
        type: segment.type,
        label: repeats > 1 ? `${segment.label} ${index + 1}` : segment.label,
        durationMin: segment.durationMin,
        sourceRepeatIndex: repeats > 1 ? index + 1 : undefined,
      });
      order += 1;

      if (segment.recoverMin && index < repeats - 1) {
        expanded.push({
          order,
          type: "pause",
          label: "Pause",
          durationMin: segment.recoverMin,
        });
        order += 1;
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

  if ((session.type === "easy" || session.type === "recovery" || session.type === "long") && identity !== "continuous") {
    flags.push("muddy_structure");
  }

  return flags;
}

function detectWeekFlags(
  plan: TrainingPlan,
  reviewWeeks: TrainingPlan["weeks"],
  weekIndex: number,
): WeekFlag[] {
  const flags: WeekFlag[] = [];
  const week = reviewWeeks[weekIndex]!;

  if (week.weekNumber === 1 && week.sessions.length < plan.goal.trainingDaysPerWeek) {
    flags.push("partial_first_week");
  }

  const previousWeek = reviewWeeks[weekIndex - 1];
  if (previousWeek && previousWeek.estimatedLoad > 0) {
    const delta = ((week.estimatedLoad - previousWeek.estimatedLoad) / previousWeek.estimatedLoad) * 100;
    if (delta > 20) {
      flags.push("abrupt_load_jump");
    }
  }

  return flags;
}

function buildExportSession(session: WorkoutSession): ExportSession {
  const orderedStructure = expandStructureForReview(session.structure);

  return {
    id: session.id,
    dayOfWeek: session.dayOfWeek,
    date: session.date,
    type: session.type,
    title: session.title,
    description: session.description,
    intent: session.intent,
    effortGuidance: session.effortGuidance,
    totalDurationMin: roundHalf(session.durationMin),
    estimatedLoad: roundHalf(session.estimatedLoad),
    rawStructure: session.structure,
    orderedStructure,
    structureSummary: summarizeExpandedStructure(orderedStructure),
    runningDurationMin: runningDuration(orderedStructure),
    openingDurationMin: openingDuration(orderedStructure),
    endingDurationMin: endingDuration(orderedStructure),
    flags: detectSessionFlags(session, orderedStructure),
  };
}

function resolveScenarioProfile(scenario: ProgramExportScenario) {
  if (!scenario.onboardingInput) {
    return scenario.profile;
  }

  return interpretRunnerProfile(scenario.onboardingInput);
}

function buildExportProgram(scenario: ProgramExportScenario): ExportProgram {
  const resolvedProfile = resolveScenarioProfile(scenario);
  const plan = buildGoalPlan(resolvedProfile, scenario.goal);
  const reviewWeeks = plan.weeks.slice(0, Math.min(REVIEW_WEEKS, plan.weeks.length));

  const exportedWeeks = reviewWeeks.map((week, weekIndex) => {
    const sessions = week.sessions.map(buildExportSession);
    return {
      weekNumber: week.weekNumber,
      phase: week.phase,
      focus: week.focus,
      weekSummary: `${week.phase} · ${week.focus}`,
      estimatedLoad: roundHalf(week.estimatedLoad),
      sessionCount: week.sessions.length,
      flags: detectWeekFlags(plan, reviewWeeks, weekIndex),
      sessions,
    } satisfies ExportWeek;
  });

  const sessionFlags: Record<SessionFlag, number> = {
    passive_start: 0,
    low_meaningful_running: 0,
    long_passive_finish: 0,
    muddy_structure: 0,
  };

  for (const week of exportedWeeks) {
    for (const session of week.sessions) {
      for (const flag of session.flags) {
        sessionFlags[flag] += 1;
      }
    }
  }

  return {
    programId: `${scenario.scenarioType}:${scenario.id}:${plan.planType ?? "unknown"}`,
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    scenarioType: scenario.scenarioType,
    scenarioFocus: scenario.focus,
    scenarioTags: scenario.tags,
    comparisonGroup: scenario.comparisonGroup,
    planType: plan.planType,
    goal: scenario.goal,
    weeks: plan.weeks.length,
    userInputs: {
      recentRunningState: scenario.onboardingInput?.recentRunningState,
      onboardingTrack: scenario.onboardingInput?.onboardingTrack,
      currentAbility: scenario.onboardingInput?.currentAbility,
      baseProgramTrack: resolvedProfile.baseProgramTrack,
      archetype: resolvedProfile.archetype,
      runnerCategory: resolvedProfile.runnerCategory,
      aerobicBase: resolvedProfile.aerobicBase,
      runningSpecificity: resolvedProfile.runningSpecificity,
      confidence: resolvedProfile.confidence,
      injurySensitivity: resolvedProfile.injurySensitivity,
      progressionStyle: resolvedProfile.progressionStyle,
      currentRunsPerWeek: resolvedProfile.currentRunsPerWeek,
      currentWeeklyVolumeKm: resolvedProfile.currentWeeklyVolumeKm,
      longestRunMinutes: resolvedProfile.longestRunMinutes,
      typicalWorkoutMinutes: resolvedProfile.typicalWorkoutMinutes,
      realisticTrainingDaysPerWeek: resolvedProfile.realisticTrainingDaysPerWeek,
      trainingDaysPerWeek: scenario.goal.trainingDaysPerWeek,
      preferredTrainingDays: scenario.goal.preferredTrainingDays ?? [],
      preferredLongRunDay: scenario.goal.preferredLongRunDay,
      startDate: scenario.goal.startDate,
      targetDate: scenario.goal.targetDate,
      goalIntent: scenario.goal.goalIntent,
      goalDistance: scenario.goal.goalDistance,
      targetTime: scenario.goal.targetTime,
    },
    calendarAssumptions: {
      startDate: scenario.goal.startDate,
      targetDate: scenario.goal.targetDate,
      preferredTrainingDays: scenario.goal.preferredTrainingDays ?? [],
      requestedTrainingDaysPerWeek: scenario.goal.trainingDaysPerWeek,
      firstWeekSessionCount: exportedWeeks[0]?.sessionCount ?? 0,
      partialFirstWeek: (exportedWeeks[0]?.sessionCount ?? 0) < scenario.goal.trainingDaysPerWeek,
    },
    reviewWeeks: exportedWeeks,
    reviewFlags: {
      sessionFlagCounts: sessionFlags,
      weekFlags: [...new Set(exportedWeeks.flatMap((week) => week.flags))],
    },
  };
}

function buildMarkdownSummary(programs: ExportProgram[]): string {
  const lines: string[] = [
    "# Engine Program Export",
    "",
    `Programs: ${programs.length}`,
    `Fixed: ${fixedProgramExportScenarios.length}`,
    `Stress: ${stressProgramExportScenarios.length}`,
    `Review weeks per program: ${REVIEW_WEEKS}`,
    "",
  ];

  for (const program of programs) {
    lines.push(`## ${program.programId}`);
    lines.push(`- Scenario: ${program.scenarioName} (${program.scenarioType})`);
    lines.push(`- Focus: ${program.scenarioFocus}`);
    lines.push(`- Plan: ${program.planType ?? "unknown"} · ${program.goal.goalDistance} ${program.goal.goalIntent} · ${program.weeks} weeks`);
    lines.push(`- Inputs: ${program.userInputs.runnerCategory ?? "auto"} · ${program.userInputs.trainingDaysPerWeek} days/week · ${program.userInputs.currentWeeklyVolumeKm} km/week · longest ${program.userInputs.longestRunMinutes}m`);
    lines.push(
      `- Flags: session=${Object.entries(program.reviewFlags.sessionFlagCounts)
        .filter(([, count]) => count > 0)
        .map(([flag, count]) => `${flag}×${count}`)
        .join(", ") || "none"} | week=${program.reviewFlags.weekFlags.join(", ") || "none"}`,
    );
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function buildExportBundle(): ExportBundle {
  const programs = programExportScenarios.map(buildExportProgram);

  if (programs.length !== 50) {
    throw new Error(`Expected 50 programs, received ${programs.length}`);
  }

  return {
    exportVersion: 1,
    generatedFromBranch: process.env.GIT_BRANCH,
    totalPrograms: programs.length,
    fixedPrograms: fixedProgramExportScenarios.length,
    stressPrograms: stressProgramExportScenarios.length,
    reviewWeeksPerProgram: REVIEW_WEEKS,
    programs,
  };
}

function main(): void {
  const bundle = buildExportBundle();

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_JSON, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
  writeFileSync(OUTPUT_MD, buildMarkdownSummary(bundle.programs), "utf8");

  console.log(`Exported ${bundle.totalPrograms} programs to ${OUTPUT_JSON}`);
  console.log(`Fixed scenarios: ${bundle.fixedPrograms}`);
  console.log(`Stress scenarios: ${bundle.stressPrograms}`);
  console.log(`Summary: ${OUTPUT_MD}`);
}

main();
