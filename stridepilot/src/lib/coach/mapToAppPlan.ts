import { RunnerProfileInsights, TrainingPlan as AppTrainingPlan, WorkoutStep } from "@/lib/types";
import { GoalConfig, RunnerProfile, TrainingPlan as CoachTrainingPlan, WorkoutSession as CoachWorkoutSession, WorkoutStructureSegment } from "./types";

const DAY_MAP: Record<CoachWorkoutSession["dayOfWeek"], AppTrainingPlan["sessions"][number]["dayOfWeek"]> = {
  monday: "Mandag",
  tuesday: "Tirsdag",
  wednesday: "Onsdag",
  thursday: "Torsdag",
  friday: "Fredag",
  saturday: "Lordag",
  sunday: "Sondag",
};

function clampLoadScore(value: number): number {
  return Math.max(1, Math.min(10, Math.round(value / 3.2)));
}

function segmentToStepType(segment: WorkoutStructureSegment): WorkoutStep["type"] {
  if (segment.type === "warmup") return "warmup";
  if (segment.type === "cooldown") return "cooldown";
  if (segment.type === "walk") return "walk";
  return "run";
}

function segmentCue(segment: WorkoutStructureSegment): string {
  if (segment.type === "warmup") return "Varm roligt op og find en god rytme.";
  if (segment.type === "cooldown") return "Lad tempoet falde roligt og afslut kontrolleret.";
  if (segment.type === "walk") return "Gå roligt og få vejret tilbage.";
  if (segment.type === "tempo") return "Løb i fast, kontrolleret tempo.";
  if (segment.type === "stride") return "Korte, lette accelerationer med ro imellem.";
  if (segment.type === "recovery") return "Hold det meget let fra start til slut.";
  return "Løb roligt og kontrolleret.";
}

function expandStructure(structure: WorkoutStructureSegment[]): WorkoutStep[] {
  const steps: WorkoutStep[] = [];

  structure.forEach((segment) => {
    const repeats = segment.repeats ?? 1;
    for (let index = 0; index < repeats; index += 1) {
      steps.push({
        type: segmentToStepType(segment),
        label: repeats > 1 ? `${segment.label} ${index + 1}` : segment.label,
        durationSec: Math.max(15, Math.round(segment.durationMin * 60)),
        cue: segmentCue(segment),
      });

      if (segment.recoverMin && index < repeats - 1) {
        steps.push({
          type: "walk",
          label: "Pause",
          durationSec: Math.max(15, Math.round(segment.recoverMin * 60)),
          cue: "Brug pausen til at falde til ro igen.",
        });
      }
    }
  });

  return steps;
}

export function mapCoachProfileToRunnerProfileInsights(profile: RunnerProfile): RunnerProfileInsights {
  const targetSessionsPerWeek = Math.max(
    2,
    Math.min(
      4,
      profile.realisticTrainingDaysPerWeek || profile.currentRunsPerWeek || (profile.archetype === "fit_but_inexperienced" ? 4 : 3),
    ),
  );

  return {
    runnerProfile: {
      experience: profile.runningSpecificity >= 4 ? "advanced" : profile.runningSpecificity >= 3 ? "intermediate" : "beginner",
      confidence: profile.confidence <= 2 ? "low" : profile.confidence >= 4 ? "high" : "medium",
      injuryCaution: profile.injurySensitivity >= 4,
      motivationRisk: profile.archetype === "overeager_runner" ? "high" : profile.archetype === "motivated_novice" ? "medium" : "low",
    },
    progressionStrategy: {
      style: profile.progressionStyle === "conservative" ? "conservative" : profile.progressionStyle === "steady" ? "balanced" : "balanced",
      preferEarlyWins: profile.confidence <= 3,
      avoidRapidLoadIncrease: profile.injurySensitivity >= 4 || profile.archetype === "overeager_runner",
    },
    trainingRecommendations: {
      targetSessionsPerWeek,
      preferShortIntervalsInitially: profile.archetype === "nervous_beginner" || profile.runningSpecificity <= 2,
    },
    coachTone: {
      style: profile.confidence <= 2 ? "calm" : profile.archetype === "fit_but_inexperienced" ? "analytical" : "encouraging",
    },
  };
}

export function mapCoachPlanToAppPlan(plan: CoachTrainingPlan, goal: GoalConfig): AppTrainingPlan {
  return {
    summary: `${plan.weeks.length} ugers program mod ${goal.goalDistance} med ${goal.trainingDaysPerWeek} træningsdage om ugen.`,
    weeks: plan.weeks.length,
    sessionsPerWeek: goal.trainingDaysPerWeek,
    sessions: plan.sessions.map((session) => ({
      id: session.id,
      title: `Uge ${session.week} - ${session.title}`,
      week: session.week,
      dayOfWeek: DAY_MAP[session.dayOfWeek],
      notes: `${session.description} ${session.intent}`.trim(),
      loadScore: clampLoadScore(session.estimatedLoad),
      steps: expandStructure(session.structure),
    })),
    rationale: plan.rationale
      ? {
          plan: plan.rationale.plan,
          weeks: plan.rationale.weeks,
          workouts: plan.rationale.workouts,
        }
      : undefined,
  };
}
