import { Goal, RunnerProfile, TrainingPlan, WorkoutSession, WorkoutStep } from "./types";
import { normalizeStepDuration } from "./duration";

const DAYS: WorkoutSession["dayOfWeek"][] = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lordag", "Sondag"];

function clampWeeks(weeks: number): number {
  return Math.min(52, Math.max(12, Number.isFinite(weeks) ? Math.round(weeks) : 12));
}

function clampLoad(value: number): number {
  return Math.max(1, Math.min(10, Math.round(value)));
}

function distanceFactor(distance: Goal["distance"]): number {
  if (distance === "Marathon") return 1.7;
  if (distance === "Halvmaraton") return 1.4;
  if (distance === "10K") return 1.2;
  return 1;
}

function deriveLoadScore(steps: WorkoutStep[], week: number): number {
  const totalSec = steps.reduce((sum, step) => sum + step.durationSec, 0);
  const runSec = steps.filter((s) => s.type === "run").reduce((sum, step) => sum + step.durationSec, 0);
  const raw = runSec / 240 + totalSec / 900 + week / 7;
  return clampLoad(raw);
}

function parseTargetTimeSec(targetTime?: string): number | null {
  if (!targetTime) return null;
  const parts = targetTime.split(":").map((part) => Number(part));
  if (parts.some((part) => !Number.isFinite(part) || part < 0)) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

function defaultGoalTimeSec(distance: Goal["distance"]): number {
  if (distance === "5K") return 30 * 60;
  if (distance === "10K") return 60 * 60;
  if (distance === "Halvmaraton") return 1 * 3600 + 55 * 60;
  return 4 * 3600;
}

function resolveTrainingDays(goal: Goal, sessionsPerWeek: number): WorkoutSession["dayOfWeek"][] {
  const preferred = goal.availableTrainingDays?.length ? DAYS.filter((day) => goal.availableTrainingDays?.includes(day)) : [];
  const source = preferred.length > 0 ? preferred : DAYS;
  return Array.from({ length: sessionsPerWeek }).map((_, index) => source[index % source.length]);
}

function buildIntervalSession(params: {
  week: number;
  dayIndex: number;
  weeks: number;
  goal: Goal;
  recoveryWeek: boolean;
}): WorkoutSession {
  const { week, dayIndex, weeks, goal, recoveryWeek } = params;
  const factor = distanceFactor(goal.distance);
  const progression = week / weeks;
  const repeatsBase = 3 + Math.floor(progression * 4);
  const repeats = recoveryWeek ? Math.max(3, repeatsBase - 1) : repeatsBase;
  const runSecBase = normalizeStepDuration((60 + progression * 120) * factor);
  const walkSec = normalizeStepDuration(Math.max(30, 120 - progression * 60));
  const runSec = recoveryWeek ? normalizeStepDuration(runSecBase * 0.9) : runSecBase;

  const steps: WorkoutStep[] = [{ type: "warmup", label: "Rask gang", durationSec: 5 * 60, cue: "Varm op i roligt tempo." }];
  for (let i = 0; i < repeats; i += 1) {
    steps.push({
      type: "run",
      label: `Løb ${i + 1}`,
      durationSec: runSec,
      cue: progression > 0.7 ? "Løb tæt på målfart i kontrolleret tempo." : "Løb i kontrolleret tempo.",
    });
    if (i < repeats - 1 || progression < 0.85) {
      steps.push({ type: "walk", label: `Gang ${i + 1}`, durationSec: walkSec, cue: "Sænk tempoet og find rolig vejrtrækning." });
    }
  }
  steps.push({ type: "cooldown", label: "Nedkøling", durationSec: 5 * 60, cue: "Afslut med let gang." });

  return {
    id: `w${week}-d${dayIndex + 1}`,
    title: `Uge ${week} - Intervalpas ${dayIndex + 1}`,
    week,
    dayOfWeek: "Tirsdag",
    notes: recoveryWeek ? "Restitutionsuge: hold fokus på teknik og rolig belastning." : undefined,
    loadScore: deriveLoadScore(steps, week),
    steps,
  };
}

function buildSteadySession(params: { week: number; dayIndex: number; weeks: number; goal: Goal; recoveryWeek: boolean }): WorkoutSession {
  const { week, dayIndex, weeks, goal, recoveryWeek } = params;
  const factor = distanceFactor(goal.distance);
  const progression = week / weeks;
  const steadyRun = normalizeStepDuration((10 * 60 + progression * 12 * 60) * factor);
  const runSec = recoveryWeek ? normalizeStepDuration(steadyRun * 0.8) : steadyRun;

  const steps: WorkoutStep[] = [
    { type: "warmup", label: "Rask gang", durationSec: 5 * 60, cue: "Varm op i roligt tempo." },
    { type: "run", label: "Roligt kontinuerligt løb", durationSec: runSec, cue: "Hold jævnt tempo, hvor du stadig kan føre en samtale." },
    { type: "cooldown", label: "Nedkøling", durationSec: 5 * 60, cue: "Lad pulsen falde gradvist." },
  ];

  return {
    id: `w${week}-d${dayIndex + 1}`,
    title: `Uge ${week} - Roligt pas ${dayIndex + 1}`,
    week,
    dayOfWeek: "Torsdag",
    notes: recoveryWeek ? "Kortere roligt pas pga. restitutionsuge." : undefined,
    loadScore: deriveLoadScore(steps, week),
    steps,
  };
}

function buildLongOrGoalSession(params: {
  week: number;
  dayIndex: number;
  weeks: number;
  goal: Goal;
  recoveryWeek: boolean;
}): WorkoutSession {
  const { week, dayIndex, weeks, goal, recoveryWeek } = params;
  const progression = week / weeks;
  const isFinalWeek = week === weeks;
  const baseGoalSec = parseTargetTimeSec(goal.targetTime) ?? defaultGoalTimeSec(goal.distance);

  if (isFinalWeek) {
    const finalRunSec = normalizeStepDuration(baseGoalSec);
    const title = goal.distance === "5K" ? "Måldag — 5 km" : goal.distance === "10K" ? "Måldag — 10 km" : goal.distance === "Halvmaraton" ? "Måldag — Halvmaraton" : "Måldag — Maraton";
    const steps: WorkoutStep[] = [
      { type: "warmup", label: "Opvarmning", durationSec: 8 * 60, cue: "Varm op roligt og kontrolleret." },
      { type: "run", label: title, durationSec: finalRunSec, cue: "Løb efter planlagt disponering og hold stabil rytme." },
      { type: "cooldown", label: "Nedkøling", durationSec: 6 * 60, cue: "Afslut roligt." },
    ];
    return {
      id: `w${week}-d${dayIndex + 1}`,
      title,
      week,
      dayOfWeek: "Lordag",
      notes: "Finale: mål-specifikt pas.",
      loadScore: deriveLoadScore(steps, week),
      steps,
    };
  }

  const longRunSecBase = normalizeStepDuration((20 * 60 + progression * 22 * 60) * distanceFactor(goal.distance));
  const longRunSec = recoveryWeek ? normalizeStepDuration(longRunSecBase * 0.8) : longRunSecBase;
  const steps: WorkoutStep[] = [
    { type: "warmup", label: "Rask gang", durationSec: 5 * 60, cue: "Varm op i roligt tempo." },
    { type: "run", label: "Udholdenhedsløb", durationSec: longRunSec, cue: "Hold roligt, stabilt tempo." },
    { type: "cooldown", label: "Nedkøling", durationSec: 5 * 60, cue: "Afslut med let gang." },
  ];

  return {
    id: `w${week}-d${dayIndex + 1}`,
    title: `Uge ${week} - Udholdenhedspas ${dayIndex + 1}`,
    week,
    dayOfWeek: "Lordag",
    notes: recoveryWeek ? "Kortere udholdenhedspas pga. restitutionsuge." : undefined,
    loadScore: deriveLoadScore(steps, week),
    steps,
  };
}

function buildSession(params: { week: number; dayIndex: number; weeks: number; goal: Goal; sessionsPerWeek: number }): WorkoutSession {
  const { week, dayIndex, weeks, goal, sessionsPerWeek } = params;
  const recoveryWeek = week % 4 === 0 && week !== weeks;
  const isLastSessionOfWeek = dayIndex === sessionsPerWeek - 1;

  if (isLastSessionOfWeek) {
    return buildLongOrGoalSession({ week, dayIndex, weeks, goal, recoveryWeek });
  }
  if (dayIndex === 0) {
    return buildIntervalSession({ week, dayIndex, weeks, goal, recoveryWeek });
  }
  return buildSteadySession({ week, dayIndex, weeks, goal, recoveryWeek });
}

export function generateFallbackPlan(profile: RunnerProfile, goal: Goal): TrainingPlan {
  const weeks = clampWeeks(goal.weeks);
  const sessionsPerWeek =
    profile.activityLevel === "meget_lav"
      ? 2
      : profile.activityLevel === "lav"
        ? 3
        : profile.activityLevel === "moderat"
          ? 3
          : profile.activityLevel === "høj"
            ? 4
            : 5;
  const sessions: WorkoutSession[] = [];
  const trainingDays = resolveTrainingDays(goal, sessionsPerWeek);

  for (let week = 1; week <= weeks; week += 1) {
    for (let dayIndex = 0; dayIndex < sessionsPerWeek; dayIndex += 1) {
      const session = buildSession({ week, dayIndex, weeks, goal, sessionsPerWeek });
      session.dayOfWeek = trainingDays[dayIndex];
      sessions.push(session);
    }
  }

  return {
    summary: `Komplet baseline-program til ${goal.distance} over ${weeks} uger med tydelig progression, restitutionsuger og måldag.`,
    weeks,
    sessionsPerWeek,
    sessions,
  };
}

export function normalizeTrainingPlan(raw: unknown, fallbackProfile: RunnerProfile, fallbackGoal: Goal): TrainingPlan {
  const fallback = generateFallbackPlan(fallbackProfile, fallbackGoal);

  if (!raw || typeof raw !== "object") {
    return fallback;
  }

  const parsed = raw as Partial<TrainingPlan>;
  const sessions = Array.isArray(parsed.sessions)
    ? parsed.sessions
        .map((session, idx) => {
          if (!session || typeof session !== "object") return null;
          const s = session as Partial<WorkoutSession>;
          const rawSteps = Array.isArray(s.steps) ? s.steps : [];
          const steps = rawSteps
            .map((step) => {
              if (!step || typeof step !== "object") return null;
              const st = step as Partial<WorkoutStep>;
              const durationSec = Number(st.durationSec);
              if (!Number.isFinite(durationSec) || durationSec <= 0) return null;
              return {
                type: st.type ?? "walk",
                label: st.label ?? "Interval",
                durationSec: normalizeStepDuration(Math.round(durationSec)),
                cue: st.cue ?? "Hold et komfortabelt tempo.",
              } as WorkoutStep;
            })
            .filter(Boolean) as WorkoutStep[];

          if (steps.length === 0) return null;

          return {
            id: s.id ?? `session-${idx + 1}`,
            title: s.title ?? `Traeningspas ${idx + 1}`,
            week: Number.isFinite(Number(s.week)) ? Math.max(1, Math.round(Number(s.week))) : 1,
            dayOfWeek: (s.dayOfWeek as WorkoutSession["dayOfWeek"]) ?? "Tirsdag",
            notes: s.notes,
            loadScore: clampLoad(Number(s.loadScore ?? deriveLoadScore(steps, Number(s.week ?? 1)))),
            steps,
          };
        })
        .filter(Boolean) as WorkoutSession[]
    : [];

  if (sessions.length === 0) {
    return fallback;
  }

  return {
    summary: parsed.summary ?? fallback.summary,
    weeks: clampWeeks(Number(parsed.weeks ?? fallback.weeks)),
    sessionsPerWeek: Math.min(5, Math.max(2, Number(parsed.sessionsPerWeek ?? fallback.sessionsPerWeek))),
    sessions,
  };
}
