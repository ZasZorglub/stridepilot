import { generatePlanExplanation } from "./explanations";
import {
  GoalConfig,
  PlanAdjustment,
  PlanPhase,
  RunnerProfile,
  TrainingPlan,
  TrainingWeek,
  WorkoutSession,
} from "./types";
import {
  buildBenchmarkWorkout,
  buildEasyWorkout,
  buildIntervalWorkout,
  buildLongWorkout,
  buildRecoveryWorkout,
  buildRunWalkWorkout,
  buildStridesWorkout,
  buildTempoWorkout,
} from "./workouts";

const DEFAULT_WEEKDAYS: Record<GoalConfig["trainingDaysPerWeek"], WorkoutSession["dayOfWeek"][]> = {
  2: ["tuesday", "saturday"],
  3: ["tuesday", "thursday", "sunday"],
  4: ["monday", "wednesday", "friday", "sunday"],
};

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dayOffset(dayOfWeek: WorkoutSession["dayOfWeek"]): number {
  if (dayOfWeek === "monday") return 0;
  if (dayOfWeek === "tuesday") return 1;
  if (dayOfWeek === "wednesday") return 2;
  if (dayOfWeek === "thursday") return 3;
  if (dayOfWeek === "friday") return 4;
  if (dayOfWeek === "saturday") return 5;
  return 6;
}

function phaseForWeek(weekNumber: number): PlanPhase {
  if (weekNumber <= 2) return "introduction";
  if (weekNumber <= 4) return "continuous_running";
  if (weekNumber <= 6) return "capacity";
  return "race_preparation";
}

function focusForWeek(phase: PlanPhase, weekNumber: number, isStabilizationWeek: boolean): string {
  if (isStabilizationWeek) return "Lad kroppen absorbere træningen og hold rytmen stabil.";
  if (phase === "introduction") return "Byg tryg rytme og gode vaner fra første uge.";
  if (phase === "continuous_running") return "Gør løbet mere sammenhængende og roligt stabilt.";
  if (phase === "capacity") return "Byg mere kapacitet med lidt tydeligere kvalitet.";
  if (weekNumber === 8) return "Frisk benene op og gør dig klar til 5K.";
  return "Skab fartkontrol og målrettet 5K-følelse.";
}

function weeklyLoadTargets(profile: RunnerProfile): number[] {
  const base = 70 + profile.aerobicBase * 10 + profile.runningSpecificity * 4;
  const confidenceModifier = profile.confidence <= 2 ? -4 : profile.confidence >= 4 ? 3 : 0;
  const sensitivityModifier = profile.injurySensitivity >= 4 ? -8 : 0;
  const firstWeek = base + confidenceModifier + sensitivityModifier;

  const growth = profile.progressionStyle === "conservative" ? [1, 1.08, 1.15, 1.12, 1.22, 1.32, 1.4, 1.24] : profile.progressionStyle === "steady" ? [1, 1.09, 1.18, 1.16, 1.28, 1.39, 1.48, 1.3] : [1, 1.1, 1.2, 1.16, 1.3, 1.42, 1.52, 1.34];

  return growth.map((factor) => Math.round(firstWeek * factor));
}

function buildWeekState(profile: RunnerProfile, goal: GoalConfig, weekNumber: number, previousContinuousMin: number): {
  continuousRunMin: number;
  longRunMin: number;
  intervalRunMin: number;
  walkBreakMin: number;
  repeats: number;
  useRunWalk: boolean;
  useTempo: boolean;
  useBenchmark: boolean;
  useRecovery: boolean;
  useStrides: boolean;
} {
  const phase = phaseForWeek(weekNumber);
  const needsRunWalkFoundation =
    profile.archetype === "nervous_beginner" ||
    profile.archetype === "returning_runner" ||
    profile.runningSpecificity <= 2;

  const introductionContinuous = Math.max(8, profile.aerobicBase * 4 + profile.confidence);
  const weekTargetContinuous =
    weekNumber === 1
      ? introductionContinuous
      : Math.min(32, Math.round(previousContinuousMin * (weekNumber === 4 ? 0.97 : 1.1)));

  const walkBreakMin =
    phase === "introduction"
      ? needsRunWalkFoundation
        ? weekNumber === 1
          ? 2
          : 1.5
        : 1
      : weekNumber === 3
        ? 1
        : 0.5;

  return {
    continuousRunMin: weekTargetContinuous,
    longRunMin: Math.round(weekTargetContinuous * 1.45 + (goal.trainingDaysPerWeek === 2 ? 4 : 8)),
    intervalRunMin: phase === "capacity" || phase === "race_preparation" ? Math.max(3, Math.round(weekTargetContinuous / 5)) : Math.max(2, Math.round(weekTargetContinuous / 6)),
    walkBreakMin,
    repeats: phase === "introduction" ? 5 : phase === "continuous_running" ? 4 : 5,
    useRunWalk: needsRunWalkFoundation && weekNumber <= 3,
    useTempo: phase === "capacity" || weekNumber === 7,
    useBenchmark: weekNumber === 6 || weekNumber === 8,
    useRecovery: goal.trainingDaysPerWeek === 4,
    useStrides: goal.trainingDaysPerWeek >= 3 && (phase === "continuous_running" || phase === "race_preparation"),
  };
}

function sessionMix(trainingDaysPerWeek: GoalConfig["trainingDaysPerWeek"], weekNumber: number, state: ReturnType<typeof buildWeekState>): Array<"recovery" | "run-walk" | "easy" | "interval" | "tempo" | "strides" | "long" | "benchmark"> {
  if (trainingDaysPerWeek === 2) {
    if (state.useBenchmark && weekNumber === 8) return ["easy", "benchmark"];
    return [state.useRunWalk ? "run-walk" : state.useTempo ? "tempo" : "interval", state.useBenchmark ? "benchmark" : "long"];
  }

  if (trainingDaysPerWeek === 3) {
    const first = state.useRunWalk ? "run-walk" : "easy";
    const second = state.useTempo ? "tempo" : "interval";
    const third = state.useBenchmark ? "benchmark" : "long";
    return [first, state.useStrides && weekNumber !== 8 ? "strides" : second, third];
  }

  return [
    "recovery",
    state.useRunWalk ? "run-walk" : state.useTempo ? "tempo" : "interval",
    state.useStrides && weekNumber !== 8 ? "strides" : "easy",
    state.useBenchmark ? "benchmark" : "long",
  ];
}

function buildSessionByType(type: ReturnType<typeof sessionMix>[number], context: Parameters<typeof buildEasyWorkout>[0]): WorkoutSession {
  if (type === "run-walk") return buildRunWalkWorkout(context);
  if (type === "recovery") return buildRecoveryWorkout(context);
  if (type === "interval") return buildIntervalWorkout(context);
  if (type === "tempo") return buildTempoWorkout(context);
  if (type === "strides") return buildStridesWorkout(context);
  if (type === "benchmark") return buildBenchmarkWorkout(context);
  if (type === "long") return buildLongWorkout(context);
  return buildEasyWorkout(context);
}

function capWeekLoad(sessions: WorkoutSession[], targetLoad: number, previousWeekLoad: number | null): WorkoutSession[] {
  const currentLoad = sessions.reduce((sum, session) => sum + session.estimatedLoad, 0);
  const cappedTarget = previousWeekLoad ? Math.min(targetLoad, Math.round(previousWeekLoad * 1.15)) : targetLoad;
  if (currentLoad <= cappedTarget || currentLoad === 0) return sessions;

  const scale = cappedTarget / currentLoad;
  return sessions.map((session) => ({
    ...session,
    estimatedLoad: Math.round(session.estimatedLoad * scale * 10) / 10,
  }));
}

export function build5kPlan(profile: RunnerProfile, goalConfig: GoalConfig): TrainingPlan {
  const loadTargets = weeklyLoadTargets(profile);
  const weekDays = DEFAULT_WEEKDAYS[goalConfig.trainingDaysPerWeek];
  const startDate = parseIsoDate(goalConfig.startDate);
  const weeks: TrainingWeek[] = [];
  const adjustments: PlanAdjustment[] = [];
  let previousContinuousMin = Math.max(8, profile.aerobicBase * 4);
  let previousLoad: number | null = null;

  for (let weekNumber = 1; weekNumber <= 8; weekNumber += 1) {
    const phase = phaseForWeek(weekNumber);
    const isStabilizationWeek = weekNumber === 4;
    const state = buildWeekState(profile, goalConfig, weekNumber, previousContinuousMin);
    const types = sessionMix(goalConfig.trainingDaysPerWeek, weekNumber, state);

    let sessions = types.map((type, index) =>
      buildSessionByType(type, {
        weekNumber,
        phase,
        profile,
        goal: goalConfig,
        dayOfWeek: weekDays[index],
        date: toIsoDate(addDays(startDate, (weekNumber - 1) * 7 + dayOffset(weekDays[index]))),
        isStabilizationWeek,
        continuousRunMin: state.continuousRunMin,
        longRunMin: state.longRunMin,
        intervalRunMin: state.intervalRunMin,
        walkBreakMin: state.walkBreakMin,
        repeats: state.repeats,
      }),
    );

    sessions = capWeekLoad(sessions, loadTargets[weekNumber - 1], previousLoad);
    const estimatedLoad = Math.round(sessions.reduce((sum, session) => sum + session.estimatedLoad, 0) * 10) / 10;

    weeks.push({
      weekNumber,
      phase,
      focus: focusForWeek(phase, weekNumber, isStabilizationWeek),
      sessions,
      estimatedLoad,
      isStabilizationWeek,
    });

    if (isStabilizationWeek) {
      adjustments.push({
        id: `stabilize-${weekNumber}`,
        weekNumber,
        effect: "hold",
        reason: "stabiliseringsuge",
        summary: "Ugen holdes mere stabil, så kroppen kan absorbere den forrige progression.",
      });
    }

    previousContinuousMin = state.continuousRunMin;
    previousLoad = estimatedLoad;
  }

  const sessions = weeks.flatMap((week) => week.sessions);
  const explanationSummary = generatePlanExplanation(profile, {
    goal: goalConfig,
    profile,
    weeks,
    sessions,
    adjustments,
    explanationSummary: [],
  });

  return {
    goal: goalConfig,
    profile,
    weeks,
    sessions,
    adjustments,
    explanationSummary,
  };
}
