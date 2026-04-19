import { RunnerProfileInsights, TrainingPlan as AppTrainingPlan, WorkoutHeartRateGuidance, WorkoutStep } from "@/lib/types";
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

function segmentToStepType(
  segment: WorkoutStructureSegment,
  index: number,
  structure: WorkoutStructureSegment[],
): WorkoutStep["type"] {
  if (segment.type === "warmup") return "warmup";
  if (segment.type === "cooldown") return "cooldown";
  if (segment.type === "walk") return "walk";
  if (segment.type === "recovery") {
    const label = segment.label.toLowerCase();
    if (label.includes("opvarmning")) return "warmup";
    if (label.includes("ned") || label.includes("afslutning")) return "cooldown";

    const hasEarlierWork = structure.slice(0, index).some((entry) => entry.type === "run" || entry.type === "steady" || entry.type === "tempo" || entry.type === "stride");
    const hasLaterWork = structure.slice(index + 1).some((entry) => entry.type === "run" || entry.type === "steady" || entry.type === "tempo" || entry.type === "stride");
    if (!hasEarlierWork && hasLaterWork) return "warmup";
    if (hasEarlierWork && !hasLaterWork) return "cooldown";
  }
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

export function segmentHeartRateGuidance(segment: WorkoutStructureSegment): WorkoutHeartRateGuidance | undefined {
  if (segment.type === "walk") return undefined;
  if (segment.type === "warmup") {
    return {
      zoneLabel: "Zone 1-2",
      summary: "Start roligt i zone 1-2.",
    };
  }
  if (segment.type === "cooldown") {
    return {
      zoneLabel: "Zone 1-2",
      summary: "Lad pulsen falde tilbage mod zone 1-2.",
    };
  }
  if (segment.type === "recovery") {
    return {
      zoneLabel: "Zone 2",
      summary: "Hold det roligt i zone 2.",
    };
  }
  if (segment.type === "steady") {
    return {
      zoneLabel: "Ovre zone 2",
      summary: "Sigt efter ovre zone 2.",
    };
  }
  if (segment.type === "tempo") {
    return {
      zoneLabel: "Zone 3",
      summary: "Arbejd op mod zone 3 med kontrol.",
    };
  }
  if (segment.type === "stride") {
    return {
      zoneLabel: "Zone 4",
      summary: "Kort op i zone 4 pa dragene.",
    };
  }
  if (segment.repeats && segment.repeats > 1 && segment.recoverMin) {
    return {
      zoneLabel: "Zone 4",
      summary: "Kort op i zone 4 pa arbejdsdelene.",
    };
  }
  return {
    zoneLabel: "Zone 2",
    summary: "Hold dig i zone 2.",
  };
}

function sessionAwareHeartRateGuidance(
  segment: WorkoutStructureSegment,
  sessionType?: CoachWorkoutSession["type"],
): WorkoutHeartRateGuidance | undefined {
  if (segment.type === "walk") return undefined;
  if (sessionType === "run-walk") {
    if (segment.type === "run") {
      return {
        zoneLabel: "Zone 2",
        summary: "Hold dig i zone 2 pa lobeblokkene.",
      };
    }
    if (segment.type === "recovery" || segment.type === "warmup" || segment.type === "cooldown") {
      return {
        zoneLabel: "Zone 1-2",
        summary: "Hold det roligt i zone 1-2.",
      };
    }
  }
  if (sessionType === "recovery") {
    return {
      zoneLabel: "Zone 1-2",
      summary: "Hold det meget roligt i zone 1-2.",
    };
  }
  if (sessionType === "easy" || sessionType === "long") {
    if (segment.type === "run" || segment.type === "steady" || segment.type === "recovery") {
      return {
        zoneLabel: "Zone 2",
        summary: segment.type === "steady" ? "Sigt efter ovre zone 2." : "Hold dig i zone 2.",
      };
    }
  }
  if (sessionType === "race-specific" || sessionType === "benchmark") {
    if (segment.type === "warmup" || segment.type === "cooldown" || segment.type === "recovery") {
      return {
        zoneLabel: "Zone 1-2",
        summary: segment.type === "cooldown" ? "Lad pulsen falde tilbage mod zone 1-2." : "Start roligt i zone 1-2.",
      };
    }
    if (segment.type === "tempo" || segment.type === "steady" || segment.type === "run") {
      return {
        zoneLabel: "Zone 3",
        summary: "Løb i kontrolleret tempo. Du skal kunne tale i korte sætninger.",
      };
    }
  }
  return segmentHeartRateGuidance(segment);
}

function mergedStepLabel(type: WorkoutStep["type"], left: string, right: string): string {
  if (left === right) return left;
  if (type === "warmup") return "Opvarmning";
  if (type === "cooldown") return "Nedkøling";
  if (type === "walk") return "Gang";
  return "Sammenhængende løb";
}

export function mergeAdjacentWorkoutSteps(steps: WorkoutStep[]): WorkoutStep[] {
  return steps.reduce<WorkoutStep[]>((merged, step) => {
    const previous = merged[merged.length - 1];
    if (!previous) {
      merged.push(step);
      return merged;
    }

    if (
      previous.type !== step.type ||
      previous.cue !== step.cue ||
      previous.heartRateGuidance?.summary !== step.heartRateGuidance?.summary
    ) {
      merged.push(step);
      return merged;
    }

    merged[merged.length - 1] = {
      ...previous,
      label: mergedStepLabel(previous.type, previous.label, step.label),
      durationSec: previous.durationSec + step.durationSec,
    };
    return merged;
  }, []);
}

export function expandStructure(
  structure: WorkoutStructureSegment[],
  sessionType?: CoachWorkoutSession["type"],
): WorkoutStep[] {
  const steps: WorkoutStep[] = [];

  function pushStepWithWalkLimit(step: WorkoutStep) {
    if (step.type !== "walk" || step.durationSec <= 5 * 60) {
      steps.push(step);
      return;
    }

    let remaining = step.durationSec;
    let partIndex = 1;
    while (remaining > 0) {
      const chunk = Math.min(remaining, 5 * 60);
      steps.push({
        ...step,
        label: remaining > 5 * 60 ? `${step.label} ${partIndex}` : step.label,
        durationSec: chunk,
      });
      remaining -= chunk;
      partIndex += 1;
    }
  }

  structure.forEach((segment, segmentIndex) => {
    const repeats = segment.repeats ?? 1;
    for (let index = 0; index < repeats; index += 1) {
      const stepType = segmentToStepType(segment, segmentIndex, structure);
      const rawDurationSec = Math.max(15, Math.round(segment.durationMin * 60));
      pushStepWithWalkLimit({
        type: stepType,
        label: repeats > 1 ? `${segment.label} ${index + 1}` : segment.label,
        durationSec: rawDurationSec,
        cue: segmentCue(segment),
        heartRateGuidance: sessionAwareHeartRateGuidance(segment, sessionType),
      });

      if (segment.recoverMin && index < repeats - 1) {
        pushStepWithWalkLimit({
          type: "walk",
          label: "Pause",
          durationSec: Math.max(15, Math.round(segment.recoverMin * 60)),
          cue: "Brug pausen til at falde til ro igen.",
        });
      }
    }
  });

  return mergeAdjacentWorkoutSteps(steps);
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
      steps: expandStructure(session.structure, session.type),
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
