import fs from "node:fs";
import path from "node:path";

import { applyPlanSafety, sumWorkoutRunDurationSec, sumWorkoutStepDurationSec, summarizeWorkoutSteps } from "../src/lib/plan-safety";
import { applyStubWeekToPlan, buildStubWeekSession, resolveStubWeekPolicy } from "../src/lib/late-week-start";
import { buildGoalPlan, interpretRunnerProfile as interpretCoachRunnerProfile, mapCoachPlanToAppPlan } from "../src/lib/coach";
import { buildWeeklyLoad, enforceAvailableTrainingDays } from "../src/lib/plan";
import { calendarWeekIndexFromDate, sessionDateFromCalendarWeek, visiblePlanSessions } from "../src/lib/calendar-week";
import type { Goal, RunnerProfile, TrainingPlan, WorkoutSession } from "../src/lib/types";
import type { GoalConfig as CoachGoalConfig } from "../src/lib/coach/types";

type BeginnerScenarioId = "ultra_zero" | "one_to_two_min" | "five_min" | "half_km";

type BeginnerScenario = {
  id: BeginnerScenarioId;
  label: string;
  runnerProfile: RunnerProfile;
};

type CalibrationCase = {
  caseId: string;
  scenarioId: BeginnerScenarioId;
  scenarioLabel: string;
  daysPerWeek: 2 | 3;
  startLabel: "Monday" | "Friday" | "Saturday";
  selectedStartDateIso: string;
  derived: {
    firstWorkoutType: string;
    firstWorkoutTitle: string;
    firstWorkoutDurationMin: number;
    firstWorkoutTotalRunMin: number;
    firstWorkoutMaxContinuousRunBlockMin: number;
    firstWorkoutStructureSummary: string;
    firstWorkoutWeekKind: "stub_week" | "full_week";
    week1SessionCount: number;
    week1TotalLoad: number;
    fullWeek1SessionCount: number;
    fullWeek1TotalLoad: number;
    stubWeekApplied: boolean;
  };
  heuristics: {
    possibleTooHardScore: number;
    possibleTooHardReasons: string[];
    possibleTooEasyScore: number;
    possibleTooEasyReasons: string[];
  };
};

const DOCS_DIR = "/Users/anderschristiansloth/Documents/Playground/stridepilot/docs";
const JSON_PATH = path.join(DOCS_DIR, "beginner-calibration-report.json");
const MD_PATH = path.join(DOCS_DIR, "beginner-calibration-report.md");

const STARTS: Array<{ label: CalibrationCase["startLabel"]; iso: string }> = [
  { label: "Monday", iso: "2026-04-13" },
  { label: "Friday", iso: "2026-04-17" },
  { label: "Saturday", iso: "2026-04-18" },
];

const TRAINING_DAYS: Record<2 | 3, Goal["availableTrainingDays"]> = {
  2: ["Tirsdag", "Sondag"],
  3: ["Tirsdag", "Torsdag", "Sondag"],
};

const EXPECTED_OPENING_RANGE: Record<BeginnerScenarioId, { maxBlockMin: [number, number]; totalRunMin: [number, number] }> = {
  ultra_zero: { maxBlockMin: [0.5, 1.5], totalRunMin: [2, 5] },
  one_to_two_min: { maxBlockMin: [1, 2], totalRunMin: [4, 6] },
  five_min: { maxBlockMin: [1.5, 4], totalRunMin: [6, 10] },
  half_km: { maxBlockMin: [1, 3], totalRunMin: [4, 8] },
};

function addDaysToIsoDate(value: string, days: number): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function toCoachGoalConfig(goal: Goal, requestedRunsPerWeek: number): CoachGoalConfig {
  const trainingDaysPerWeek = Math.max(2, Math.min(4, requestedRunsPerWeek)) as 2 | 3 | 4;
  return {
    goalDistance: goal.distance,
    goalIntent:
      goal.goalType === "run_without_walking"
        ? "finish_comfortably"
        : goal.goalType === "pr"
          ? "improve"
          : goal.goalType === "target_time"
            ? "target_time"
            : "finish",
    targetDate: goal.endDate ?? addDaysToIsoDate(goal.startDate, goal.weeks * 7),
    trainingDaysPerWeek,
    startDate: goal.startDate,
    targetTime: goal.targetTime,
    targetPaceSecPerKm: goal.targetPaceSecPerKm,
    preferredTrainingDays: (goal.availableTrainingDays ?? []).map((day) =>
      day === "Mandag"
        ? "monday"
        : day === "Tirsdag"
          ? "tuesday"
          : day === "Onsdag"
            ? "wednesday"
            : day === "Torsdag"
              ? "thursday"
              : day === "Fredag"
                ? "friday"
                : day === "Lordag"
                  ? "saturday"
                  : "sunday",
    ),
    preferredLongRunDay: "flexible" as const,
  };
}

function buildGoal(startDateIso: string, daysPerWeek: 2 | 3): Goal {
  return {
    distance: "5K",
    goalType: "complete",
    weeks: 12,
    startDate: startDateIso,
    endDate: addDaysToIsoDate(startDateIso, 12 * 7),
    availableTrainingDays: TRAINING_DAYS[daysPerWeek],
    preferredLongRunDay: "flexible",
  };
}

function baseRunnerProfile(): RunnerProfile {
  return {
    firstName: "Test",
    onboardingTrack: "getting_started",
    heightCm: 172,
    weightKg: 68,
    age: 36,
    activityLevel: "lav",
    runningExperience: "nybegynder",
    currentRunningAbility: "fem_min",
    currentContinuousDistanceKm: 0,
    userTrainingContext: "Vil gerne starte roligt og trygt.",
    currentWeeklyVolumeKm: 0,
    currentRunsPerWeek: 0,
    longestCurrentRunMin: 0,
    realisticTrainingDaysPerWeek: 3,
    typicalWorkoutMinutes: 30,
    preferredGuidance: "simple",
    recentRaceTimes: [],
    injuryHistory: "",
    weakPoints: "",
    otherTraining: "",
  };
}

function beginnerScenarios(): BeginnerScenario[] {
  return [
    {
      id: "ultra_zero",
      label: "Ultra zero",
      runnerProfile: {
        ...baseRunnerProfile(),
        currentRunningAbility: "helt_ny",
        currentContinuousDistanceKm: 0,
        currentWeeklyVolumeKm: 0,
        currentRunsPerWeek: 0,
        longestCurrentRunMin: 0,
      },
    },
    {
      id: "one_to_two_min",
      label: "1-2 min",
      runnerProfile: {
        ...baseRunnerProfile(),
        currentRunningAbility: "fem_min",
        currentContinuousDistanceKm: 0.15,
        currentWeeklyVolumeKm: 2,
        currentRunsPerWeek: 1,
        longestCurrentRunMin: 2,
      },
    },
    {
      id: "five_min",
      label: "3-5 min",
      runnerProfile: {
        ...baseRunnerProfile(),
        currentRunningAbility: "fem_min",
        currentContinuousDistanceKm: 0.8,
        currentWeeklyVolumeKm: 4,
        currentRunsPerWeek: 1,
        longestCurrentRunMin: 5,
      },
    },
    {
      id: "half_km",
      label: "Approx 0.5 km",
      runnerProfile: {
        ...baseRunnerProfile(),
        currentRunningAbility: "fem_min",
        currentContinuousDistanceKm: 0.5,
        currentWeeklyVolumeKm: 3,
        currentRunsPerWeek: 1,
        longestCurrentRunMin: 4,
      },
    },
  ];
}

function sortSessionsChronologically(plan: TrainingPlan, startDateIso: string): WorkoutSession[] {
  return [...visiblePlanSessions(plan, startDateIso)].sort((left, right) => {
    const leftDate = sessionDateFromCalendarWeek(startDateIso, left).getTime();
    const rightDate = sessionDateFromCalendarWeek(startDateIso, right).getTime();
    if (leftDate !== rightDate) return leftDate - rightDate;
    return left.week - right.week;
  });
}

function inferWorkoutType(session: WorkoutSession): string {
  const lowerTitle = session.title.toLowerCase();
  const runSteps = session.steps.filter((step) => step.type === "run");
  const walkSteps = session.steps.filter((step) => step.type === "walk");

  if (lowerTitle.includes("run-walk")) return "run-walk";
  if (runSteps.length >= 2 && walkSteps.length >= 2) return "run-walk";
  if (runSteps.length === 1 && walkSteps.length <= 2) return "easy";
  return "mixed";
}

function weekSessionCount(plan: TrainingPlan, startDateIso: string, calendarWeek: number): number {
  return visiblePlanSessions(plan, startDateIso).filter((session) => {
    const date = sessionDateFromCalendarWeek(startDateIso, session);
    return calendarWeekIndexFromDate(startDateIso, date) === calendarWeek;
  }).length;
}

function deriveHeuristics(record: CalibrationCase): CalibrationCase["heuristics"] {
  const range = EXPECTED_OPENING_RANGE[record.scenarioId];
  const hardReasons: string[] = [];
  const easyReasons: string[] = [];
  let hard = 0;
  let easy = 0;
  const { firstWorkoutType, firstWorkoutMaxContinuousRunBlockMin, firstWorkoutTotalRunMin, firstWorkoutWeekKind } = record.derived;

  if (firstWorkoutType !== "run-walk") {
    hard += 4;
    hardReasons.push("Opening session is not run-walk.");
  }
  if (firstWorkoutMaxContinuousRunBlockMin > range.maxBlockMin[1]) {
    hard += Number((firstWorkoutMaxContinuousRunBlockMin - range.maxBlockMin[1]).toFixed(2));
    hardReasons.push(`Max run block ${firstWorkoutMaxContinuousRunBlockMin} min is above the expected opening range.`);
  }
  if (firstWorkoutTotalRunMin > range.totalRunMin[1]) {
    hard += Number(((firstWorkoutTotalRunMin - range.totalRunMin[1]) / 2).toFixed(2));
    hardReasons.push(`Total run time ${firstWorkoutTotalRunMin} min is above the expected opening range.`);
  }
  if (firstWorkoutMaxContinuousRunBlockMin < range.maxBlockMin[0]) {
    easy += Number((range.maxBlockMin[0] - firstWorkoutMaxContinuousRunBlockMin).toFixed(2));
    easyReasons.push(`Max run block ${firstWorkoutMaxContinuousRunBlockMin} min may be overly cautious for this band.`);
  }
  if (firstWorkoutTotalRunMin < range.totalRunMin[0]) {
    easy += Number(((range.totalRunMin[0] - firstWorkoutTotalRunMin) / 2).toFixed(2));
    easyReasons.push(`Total run time ${firstWorkoutTotalRunMin} min may be very light for this band.`);
  }
  if (firstWorkoutWeekKind === "stub_week" && record.derived.week1SessionCount === 1) {
    easy += 0.5;
    easyReasons.push("Late-week start produces only one intro session in the opening calendar week.");
  }

  return {
    possibleTooHardScore: Number(hard.toFixed(2)),
    possibleTooHardReasons: hardReasons,
    possibleTooEasyScore: Number(easy.toFixed(2)),
    possibleTooEasyReasons: easyReasons,
  };
}

function generateCase(scenario: BeginnerScenario, daysPerWeek: 2 | 3, start: { label: CalibrationCase["startLabel"]; iso: string }): CalibrationCase {
  const runnerProfile = {
    ...scenario.runnerProfile,
    realisticTrainingDaysPerWeek: daysPerWeek,
  };
  const goal = buildGoal(start.iso, daysPerWeek);
  const stubWeekPolicy = resolveStubWeekPolicy({
    selectedStartDateIso: start.iso,
    availableTrainingDays: goal.availableTrainingDays,
  });
  const coachProfile = interpretCoachRunnerProfile({
    onboardingTrack: runnerProfile.onboardingTrack,
    onboardingText: runnerProfile.userTrainingContext,
    injuryHistory: runnerProfile.injuryHistory,
    weakPoints: runnerProfile.weakPoints,
    otherTraining: runnerProfile.otherTraining,
    currentAbility: runnerProfile.currentRunningAbility,
    goalDistance: goal.distance,
    goalTime: goal.targetTime,
    goalType: goal.goalType,
    activityLevel: runnerProfile.activityLevel,
    currentRunsPerWeek: runnerProfile.currentRunsPerWeek,
    currentWeeklyVolumeKm: runnerProfile.currentWeeklyVolumeKm,
    longestRunMinutes: runnerProfile.longestCurrentRunMin,
    realisticTrainingDaysPerWeek: runnerProfile.realisticTrainingDaysPerWeek,
    typicalWorkoutMinutes: runnerProfile.typicalWorkoutMinutes,
    preferredGuidance: runnerProfile.preferredGuidance,
  });
  const coachPlan = buildGoalPlan(coachProfile, toCoachGoalConfig(goal, daysPerWeek));
  let plan = mapCoachPlanToAppPlan(coachPlan, coachPlan.goal);
  plan = applyPlanSafety({ plan, goal, recentFeedback: [] }).plan;
  plan = enforceAvailableTrainingDays(plan, goal.availableTrainingDays).plan;
  plan = applyStubWeekToPlan(
    plan,
    buildStubWeekSession({
      policy: stubWeekPolicy,
      runnerProfile,
      goal,
      locale: "en",
    }),
  );

  const sortedSessions = sortSessionsChronologically(plan, goal.startDate);
  const firstSession = sortedSessions[0];
  if (!firstSession) {
    throw new Error(`No opening session generated for ${scenario.id} / ${daysPerWeek} / ${start.iso}`);
  }

  const weeklyLoad = buildWeeklyLoad(plan, goal.startDate);
  const openingWeekIndex = 1;
  const firstFullWeekIndex = stubWeekPolicy.hasStubWeek ? 2 : 1;
  const firstWorkoutDurationMin = Math.round((sumWorkoutStepDurationSec(firstSession.steps) / 60) * 10) / 10;
  const firstWorkoutTotalRunMin = Math.round((sumWorkoutRunDurationSec(firstSession.steps) / 60) * 10) / 10;
  const firstWorkoutMaxContinuousRunBlockMin = Math.max(
    ...firstSession.steps.filter((step) => step.type === "run").map((step) => step.durationSec / 60),
  );

  const record: CalibrationCase = {
    caseId: `${scenario.id}-${daysPerWeek}d-${start.label.toLowerCase()}`,
    scenarioId: scenario.id,
    scenarioLabel: scenario.label,
    daysPerWeek,
    startLabel: start.label,
    selectedStartDateIso: start.iso,
    derived: {
      firstWorkoutType: inferWorkoutType(firstSession),
      firstWorkoutTitle: firstSession.title,
      firstWorkoutDurationMin,
      firstWorkoutTotalRunMin,
      firstWorkoutMaxContinuousRunBlockMin: Math.round(firstWorkoutMaxContinuousRunBlockMin * 10) / 10,
      firstWorkoutStructureSummary: summarizeWorkoutSteps(firstSession.steps),
      firstWorkoutWeekKind: firstSession.week === 0 ? "stub_week" : "full_week",
      week1SessionCount: weekSessionCount(plan, goal.startDate, openingWeekIndex),
      week1TotalLoad: weeklyLoad[openingWeekIndex - 1]?.load ?? 0,
      fullWeek1SessionCount: weekSessionCount(plan, goal.startDate, firstFullWeekIndex),
      fullWeek1TotalLoad: weeklyLoad[firstFullWeekIndex - 1]?.load ?? 0,
      stubWeekApplied: stubWeekPolicy.hasStubWeek,
    },
    heuristics: {
      possibleTooHardScore: 0,
      possibleTooHardReasons: [],
      possibleTooEasyScore: 0,
      possibleTooEasyReasons: [],
    },
  };

  record.heuristics = deriveHeuristics(record);
  return record;
}

function buildMarkdownReport(cases: CalibrationCase[]): string {
  const hardCases = [...cases].filter((entry) => entry.heuristics.possibleTooHardScore > 0).sort((a, b) => b.heuristics.possibleTooHardScore - a.heuristics.possibleTooHardScore).slice(0, 5);
  const easyCases = [...cases].filter((entry) => entry.heuristics.possibleTooEasyScore > 0).sort((a, b) => b.heuristics.possibleTooEasyScore - a.heuristics.possibleTooEasyScore).slice(0, 5);

  const lines: string[] = [];
  lines.push("# Beginner Calibration Report");
  lines.push("");
  lines.push("Matrix generated from the current StridePilot generation path with stub-week handling, coach-plan mapping, safety pass, and available-day enforcement.");
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Cases generated: ${cases.length}`);
  lines.push(`- Stub-week openings: ${cases.filter((entry) => entry.derived.stubWeekApplied).length}`);
  lines.push(`- Full-week openings: ${cases.filter((entry) => !entry.derived.stubWeekApplied).length}`);
  lines.push("");
  lines.push("## Matrix");
  lines.push("");
  lines.push("| Case | Start | Days | First workout | Duration | Run time | Max block | Week kind | Week 1 count | Week 1 load |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const entry of cases) {
    lines.push(`| ${entry.caseId} | ${entry.startLabel} | ${entry.daysPerWeek} | ${entry.derived.firstWorkoutTitle} | ${entry.derived.firstWorkoutDurationMin} min | ${entry.derived.firstWorkoutTotalRunMin} min | ${entry.derived.firstWorkoutMaxContinuousRunBlockMin} min | ${entry.derived.firstWorkoutWeekKind} | ${entry.derived.week1SessionCount} | ${entry.derived.week1TotalLoad} |`);
  }
  lines.push("");
  lines.push("## Detailed Cases");
  lines.push("");
  for (const entry of cases) {
    lines.push(`### ${entry.caseId}`);
    lines.push(`- Scenario: ${entry.scenarioLabel}`);
    lines.push(`- Start: ${entry.startLabel} (${entry.selectedStartDateIso})`);
    lines.push(`- Training days per week: ${entry.daysPerWeek}`);
    lines.push(`- First workout: ${entry.derived.firstWorkoutTitle}`);
    lines.push(`- Total duration: ${entry.derived.firstWorkoutDurationMin} min`);
    lines.push(`- Total run time: ${entry.derived.firstWorkoutTotalRunMin} min`);
    lines.push(`- Max continuous run block: ${entry.derived.firstWorkoutMaxContinuousRunBlockMin} min`);
    lines.push(`- Structure: ${entry.derived.firstWorkoutStructureSummary}`);
    lines.push(`- Opening week kind: ${entry.derived.firstWorkoutWeekKind}`);
    lines.push(`- Calendar week 1 session count/load: ${entry.derived.week1SessionCount} sessions / ${entry.derived.week1TotalLoad}`);
    lines.push(`- First full week session count/load: ${entry.derived.fullWeek1SessionCount} sessions / ${entry.derived.fullWeek1TotalLoad}`);
    if (entry.heuristics.possibleTooHardReasons.length > 0) {
      lines.push(`- Possibly too hard: ${entry.heuristics.possibleTooHardReasons.join(" ")}`);
    }
    if (entry.heuristics.possibleTooEasyReasons.length > 0) {
      lines.push(`- Possibly too easy: ${entry.heuristics.possibleTooEasyReasons.join(" ")}`);
    }
    lines.push("");
  }
  lines.push("## Cases That May Still Be Too Hard");
  lines.push("");
  if (hardCases.length === 0) {
    lines.push("- No opening cases crossed the current “possibly too hard” heuristic.");
  } else {
    for (const entry of hardCases) {
      lines.push(`- ${entry.caseId}: ${entry.heuristics.possibleTooHardReasons.join(" ")}`);
    }
  }
  lines.push("");
  lines.push("## Cases That May Now Be Too Easy");
  lines.push("");
  if (easyCases.length === 0) {
    lines.push("- No opening cases crossed the current “possibly too easy” heuristic.");
  } else {
    for (const entry of easyCases) {
      lines.push(`- ${entry.caseId}: ${entry.heuristics.possibleTooEasyReasons.join(" ")}`);
    }
  }
  lines.push("");
  lines.push("## Notes");
  lines.push("");
  lines.push("- The “possibly too hard” and “possibly too easy” flags are heuristic coach-review signals, not product verdicts.");
  lines.push("- Week 1 values are reported from the opening calendar week after the selected start date. If a stub week is inserted, the first full training week is reported separately.");
  lines.push("");
  return lines.join("\n");
}

function main() {
  const cases = beginnerScenarios().flatMap((scenario) =>
    ([2, 3] as const).flatMap((daysPerWeek) =>
      STARTS.map((start) => generateCase(scenario, daysPerWeek, start)),
    ),
  );

  const hardCases = [...cases]
    .filter((entry) => entry.heuristics.possibleTooHardScore > 0)
    .sort((a, b) => b.heuristics.possibleTooHardScore - a.heuristics.possibleTooHardScore)
    .slice(0, 5)
    .map((entry) => ({
      caseId: entry.caseId,
      score: entry.heuristics.possibleTooHardScore,
      reasons: entry.heuristics.possibleTooHardReasons,
    }));

  const easyCases = [...cases]
    .filter((entry) => entry.heuristics.possibleTooEasyScore > 0)
    .sort((a, b) => b.heuristics.possibleTooEasyScore - a.heuristics.possibleTooEasyScore)
    .slice(0, 5)
    .map((entry) => ({
      caseId: entry.caseId,
      score: entry.heuristics.possibleTooEasyScore,
      reasons: entry.heuristics.possibleTooEasyReasons,
    }));

  const payload = {
    generatedAt: new Date().toISOString(),
    totalCases: cases.length,
    cases,
    topPossiblyTooHard: hardCases,
    topPossiblyTooEasy: easyCases,
  };

  fs.mkdirSync(DOCS_DIR, { recursive: true });
  fs.writeFileSync(JSON_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  fs.writeFileSync(MD_PATH, `${buildMarkdownReport(cases)}\n`, "utf8");

  console.log(`beginner calibration report written: ${JSON_PATH}`);
  console.log(`beginner calibration report written: ${MD_PATH}`);
  console.log(`cases=${cases.length}`);
}

main();
