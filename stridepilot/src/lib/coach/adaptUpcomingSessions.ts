import { TrainingPlan } from "../types";
import { AdaptationMode, CapabilityState } from "./capability";
import { AdaptationDecision } from "./adaptationMode";
import { CoachDecision } from "./coachDecision";

type SessionKind = "interval" | "tempo" | "easy" | "long" | "recovery" | "benchmark" | "other";
type PlanDistance = "5K" | "10K" | "Halvmaraton" | "Marathon";

function clonePlan(plan: TrainingPlan): TrainingPlan {
  return {
    ...plan,
    sessions: plan.sessions.map((session) => ({
      ...session,
      steps: session.steps.map((step) => ({ ...step })),
    })),
  };
}

function normalizeAdaptiveDuration(seconds: number, min = 30, max = 4 * 60 * 60): number {
  const raw = Number.isFinite(seconds) ? seconds : min;
  const clamped = Math.max(min, Math.min(max, raw));
  return Math.round(clamped / 30) * 30;
}

function inferDistance(plan: TrainingPlan): PlanDistance {
  const combined = plan.sessions.map((session) => `${session.title} ${session.notes ?? ""}`.toLowerCase()).join(" ");
  if (combined.includes("maraton")) return "Marathon";
  if (combined.includes("halvmaraton")) return "Halvmaraton";
  if (combined.includes("10 km")) return "10K";
  if (combined.includes("5k")) return "5K";

  const longestRunMinutes = Math.max(
    0,
    ...plan.sessions.map((session) =>
      session.steps.filter((step) => step.type === "run").reduce((sum, step) => sum + step.durationSec / 60, 0),
    ),
  );
  if (longestRunMinutes >= 110) return "Marathon";
  if (longestRunMinutes >= 80) return "Halvmaraton";
  if (longestRunMinutes >= 55) return "10K";
  return "5K";
}

function classifySession(session: TrainingPlan["sessions"][number]): SessionKind {
  const title = `${session.title} ${session.notes ?? ""}`.toLowerCase();
  if (/benchmark/.test(title)) return "benchmark";
  if (/interval/.test(title)) return "interval";
  if (/tempo/.test(title)) return "tempo";
  if (/udholdenhed|lang|long/.test(title)) return "long";
  if (/recovery/.test(title)) return "recovery";
  if (/roligt|easy|strides/.test(title) || session.loadScore <= 5) return "easy";
  return "other";
}

function planSpecificity(plan: TrainingPlan, distance: PlanDistance): "high" | "moderate" | "low" {
  const qualityCount = plan.sessions.filter((session) => {
    const kind = classifySession(session);
    return kind === "interval" || kind === "tempo";
  }).length;

  if (distance === "5K") {
    return qualityCount >= 2 ? "high" : qualityCount === 1 ? "moderate" : "low";
  }
  if (distance === "Halvmaraton" || distance === "Marathon") {
    return qualityCount >= 1 ? "moderate" : "low";
  }
  return qualityCount >= 1 ? "moderate" : "low";
}

function scaleRunSteps(
  session: TrainingPlan["sessions"][number],
  factor: number,
  minimumRunMinutes = 8,
): TrainingPlan["sessions"][number] {
  const next = {
    ...session,
    steps: session.steps.map((step) => ({ ...step })),
  };

  const sessionLabel = `${session.title} ${session.notes ?? ""}`.toLowerCase();
  const minimumPerRunMinutes = sessionLabel.includes("strides")
    ? 0.5
    : sessionLabel.includes("run-walk")
      ? 1.5
      : sessionLabel.includes("interval")
        ? 2
        : sessionLabel.includes("tempo")
          ? 4
          : minimumRunMinutes;

  next.steps = next.steps.map((step) =>
    step.type === "run"
      ? {
          ...step,
          durationSec: normalizeAdaptiveDuration(
            Math.max(
              factor < 1 ? Math.min(step.durationSec, minimumPerRunMinutes * 60) : minimumPerRunMinutes * 60,
              step.durationSec * factor,
            ),
          ),
        }
      : step,
  );

  next.loadScore = Math.max(1, Math.min(10, Math.round(session.loadScore * factor)));
  return next;
}

function sessionRunMinutes(session: TrainingPlan["sessions"][number]): number {
  return session.steps.filter((step) => step.type === "run").reduce((sum, step) => sum + step.durationSec / 60, 0);
}

function capSessionRunMinutes(
  session: TrainingPlan["sessions"][number],
  maxRunMinutes: number,
): TrainingPlan["sessions"][number] {
  const currentRunMinutes = sessionRunMinutes(session);
  if (currentRunMinutes <= maxRunMinutes) return session;
  const factor = maxRunMinutes / Math.max(1, currentRunMinutes);
  return scaleRunSteps(session, factor, 4);
}

function setSessionIdentity(
  session: TrainingPlan["sessions"][number],
  params: {
    title: string;
    notes: string;
    loadFactor: number;
  },
): TrainingPlan["sessions"][number] {
  return {
    ...scaleRunSteps(session, params.loadFactor),
    title: `Uge ${session.week} - ${params.title}`,
    notes: params.notes,
  };
}

function softenQualityForDistance(
  session: TrainingPlan["sessions"][number],
  distance: PlanDistance,
  mode: AdaptationMode,
): TrainingPlan["sessions"][number] {
  if (distance === "5K") {
    return capSessionRunMinutes(
      setSessionIdentity(session, {
      title: mode === "recovery_microcycle" ? "Roligt pas med lette strides" : "Roligt løb med strides",
      notes:
        mode === "recovery_microcycle"
          ? "Hold passet let og kontrolleret med kun få korte fartberøringer."
          : "Passet er gjort lettere, men bevarer lidt 5K-rytme med korte, ukomplicerede fartberøringer.",
      loadFactor: mode === "recovery_microcycle" ? 0.64 : 0.76,
    }),
      mode === "recovery_microcycle" ? 24 : 30,
    );
  }

  if (distance === "Halvmaraton" || distance === "Marathon") {
    return capSessionRunMinutes(
      setSessionIdentity(session, {
      title: "Kontrolleret tempopas",
      notes:
        mode === "recovery_microcycle"
          ? "Et kortere og roligere steady-pas, så du bevarer rytmen uden at presse systemet."
          : "Et lidt kortere steady/tempo-pas, så ugeprofilen stadig passer til måldistancen.",
      loadFactor: mode === "recovery_microcycle" ? 0.72 : 0.84,
    }),
      mode === "recovery_microcycle" ? 32 : distance === "Marathon" ? 42 : 36,
    );
  }

  return capSessionRunMinutes(
    setSessionIdentity(session, {
    title: "Roligt løb med let tempo",
    notes: "Passet er gjort mere kontrolleret, men bevarer lidt race-specifik rytme.",
    loadFactor: mode === "recovery_microcycle" ? 0.7 : 0.82,
  }),
    mode === "recovery_microcycle" ? 28 : 32,
  );
}

function upgradeEasyToSpecific(
  session: TrainingPlan["sessions"][number],
  distance: PlanDistance,
  mode: "restore" | "advance",
): TrainingPlan["sessions"][number] {
  if (distance === "5K") {
    return capSessionRunMinutes(
      setSessionIdentity(session, {
        title: mode === "advance" ? "Intervalpas" : "Roligt løb med strides",
        notes:
          mode === "advance"
            ? "Passet er gjort lidt mere specifikt for at give en kontrolleret 5K-stimulus med klarere fartarbejde."
            : "Passet får lidt mere rytme igen efter en lettere periode.",
        loadFactor: mode === "advance" ? 1.06 : 0.96,
      }),
      mode === "advance" ? 30 : 28,
    );
  }

  return capSessionRunMinutes(
    setSessionIdentity(session, {
      title: "Kontrolleret tempopas",
      notes:
        mode === "advance"
          ? "Passet får en lidt tydeligere steady/tempo-profil, men stadig under kontrol."
          : "Passet vender forsigtigt tilbage til en mere specifik steady-rytme.",
      loadFactor: mode === "advance" ? 1.04 : 0.95,
    }),
    distance === "Marathon" ? 45 : 38,
  );
}

function totalWeekLoad(sessions: TrainingPlan["sessions"]): number {
  return sessions.reduce((sum, session) => sum + session.loadScore, 0);
}

function traitValue(value: number | undefined, fallback = 3): number {
  return Number.isFinite(value) ? (value as number) : fallback;
}

function nextWeekNumbers(plan: TrainingPlan): number[] {
  const weeks = [...new Set(plan.sessions.map((session) => session.week))].sort((a, b) => a - b);
  return weeks.slice(0, 2);
}

function scaleWeek(
  sessions: TrainingPlan["sessions"],
  params: {
    distance: PlanDistance;
    baselineSpecificity: "high" | "moderate" | "low";
    overallFactor: number;
    longFactor: number;
    mode: AdaptationMode;
    qualityStrategy: "hold" | "trim" | "convert" | "restore" | "advance";
  },
): TrainingPlan["sessions"] {
  const originalLoad = totalWeekLoad(sessions);
  const nextSessions = sessions.map((session) => scaleRunSteps(session, params.overallFactor));
  const qualityIndexes = nextSessions
    .map((session, index) => ({ index, kind: classifySession(session) }))
    .filter((item) => item.kind === "interval" || item.kind === "tempo");
  const stridesIndex = nextSessions.findIndex((session) => `${session.title} ${session.notes ?? ""}`.toLowerCase().includes("strides"));
  const longIndex = nextSessions.findIndex((session) => classifySession(session) === "long");

  if (longIndex >= 0) {
    nextSessions[longIndex] = scaleRunSteps(nextSessions[longIndex], params.longFactor, 12);
    if (params.mode === "recovery_microcycle") {
      nextSessions[longIndex] = {
        ...nextSessions[longIndex],
        notes: "Langturen er bevidst kortet lidt ned denne uge for at holde belastningen kontrolleret.",
      };
    }
  }

  if (params.qualityStrategy === "convert") {
    qualityIndexes.forEach(({ index }) => {
      nextSessions[index] = softenQualityForDistance(nextSessions[index], params.distance, params.mode);
    });
  } else if (params.qualityStrategy === "trim") {
    if (qualityIndexes.length > 1) {
      const secondaryQuality = qualityIndexes[qualityIndexes.length - 1];
      nextSessions[secondaryQuality.index] = softenQualityForDistance(nextSessions[secondaryQuality.index], params.distance, params.mode);
    } else if (qualityIndexes.length === 1) {
      const primary = qualityIndexes[0];
      nextSessions[primary.index] = softenQualityForDistance(nextSessions[primary.index], params.distance, "down_shift");
    }
  } else if (params.qualityStrategy === "restore" || params.qualityStrategy === "advance") {
    if (qualityIndexes.length > 0) {
      const factor =
        params.qualityStrategy === "advance"
          ? params.distance === "5K"
            ? 1.1
            : params.distance === "Marathon"
              ? 1.06
              : 1.08
          : 1.04;
      nextSessions[qualityIndexes[0].index] = capSessionRunMinutes(
        scaleRunSteps(nextSessions[qualityIndexes[0].index], factor, 8),
        params.distance === "5K" ? 34 : params.distance === "Marathon" ? 48 : 40,
      );
      nextSessions[qualityIndexes[0].index] = {
        ...nextSessions[qualityIndexes[0].index],
        notes:
          params.qualityStrategy === "advance"
            ? params.distance === "5K"
              ? "Passet er skruet lidt op med en tydeligere 5K-stimulus, fordi de seneste signaler peger på godt overskud."
              : params.distance === "Marathon"
                ? "Passet er skruet lidt op med mere marathon-steady arbejde, fordi de seneste signaler peger på godt overskud."
                : "Passet er skruet en anelse op med mere specifik kvalitet, fordi de seneste signaler peger på godt overskud."
            : "Passet får lidt mere normal progression igen efter en lettere periode.",
      };
      if (params.qualityStrategy === "advance" && params.distance === "5K" && params.baselineSpecificity !== "low" && stridesIndex >= 0) {
        nextSessions[stridesIndex] = capSessionRunMinutes(scaleRunSteps(nextSessions[stridesIndex], 1.02), 26);
      }
    } else {
      if (params.distance === "5K" && stridesIndex >= 0 && params.qualityStrategy !== "advance") {
        nextSessions[stridesIndex] = capSessionRunMinutes(scaleRunSteps(nextSessions[stridesIndex], 1.02), 28);
      } else {
        const easyIndex = nextSessions.findIndex((session) => classifySession(session) === "easy");
        if (easyIndex >= 0) {
          nextSessions[easyIndex] = upgradeEasyToSpecific(nextSessions[easyIndex], params.distance, params.qualityStrategy);
        }
        if (params.distance === "5K" && stridesIndex >= 0) {
          nextSessions[stridesIndex] = capSessionRunMinutes(scaleRunSteps(nextSessions[stridesIndex], 1.02), 20);
        }
      }
    }
  }

  if (params.qualityStrategy === "advance" && totalWeekLoad(nextSessions) < originalLoad) {
    const primaryIndex = nextSessions.findIndex((session) => {
      const kind = classifySession(session);
      return kind === "interval" || kind === "tempo";
    });
    if (primaryIndex >= 0) {
      nextSessions[primaryIndex] = capSessionRunMinutes(scaleRunSteps(nextSessions[primaryIndex], 1.08, 6), params.distance === "5K" ? 36 : params.distance === "Marathon" ? 50 : 42);
      nextSessions[primaryIndex] = {
        ...nextSessions[primaryIndex],
        loadScore: Math.min(10, Math.max(nextSessions[primaryIndex].loadScore, sessions[primaryIndex]?.loadScore ?? nextSessions[primaryIndex].loadScore)),
      };
    }
  }

  return nextSessions.map((session) => ({
    ...session,
    loadScore: Math.max(1, Math.min(10, Math.round(session.loadScore))),
  }));
}

function rebuildMicrocycle(plan: TrainingPlan, capability: CapabilityState, mode: AdaptationMode): TrainingPlan {
  const nextPlan = clonePlan(plan);
  if (nextPlan.sessions.length === 0) return nextPlan;

  const distance = inferDistance(nextPlan);
  const baselineSpecificity = planSpecificity(nextPlan, distance);
  const durabilityTrend = traitValue(capability.traits?.durabilityTrend);
  const complianceTrend = traitValue(capability.traits?.complianceTrend);
  const qualityTolerance = traitValue(capability.traits?.qualityTolerance);
  const longRunTolerance = traitValue(capability.traits?.longRunTolerance);
  const progressionTolerance = traitValue(capability.traits?.progressionTolerance);
  const cautionTrend = traitValue(capability.traits?.cautionTrend);
  const [nextWeek, followingWeek] = nextWeekNumbers(nextPlan);
  const qualityBaseline = nextPlan.sessions.some((session) => {
    const kind = classifySession(session);
    return kind === "interval" || kind === "tempo";
  });

  const weeks = new Map<number, TrainingPlan["sessions"]>();
  nextPlan.sessions.forEach((session) => {
    const existing = weeks.get(session.week) ?? [];
    existing.push(session);
    weeks.set(session.week, existing);
  });

  if (nextWeek === undefined) return nextPlan;

  if (mode === "hold") {
    return nextPlan;
  }

  if (mode === "down_shift") {
    weeks.set(
      nextWeek,
      scaleWeek(weeks.get(nextWeek) ?? [], {
        distance,
        baselineSpecificity,
        overallFactor: cautionTrend >= 4 || durabilityTrend <= 2.4 ? 0.88 : 0.92,
        longFactor: longRunTolerance <= 2.5 ? 0.8 : 0.88,
        mode,
        qualityStrategy: qualityBaseline ? (qualityTolerance <= 2.5 ? "convert" : "trim") : "hold",
      }),
    );
  }

  if (mode === "recovery_microcycle") {
    weeks.set(
      nextWeek,
      scaleWeek(weeks.get(nextWeek) ?? [], {
        distance,
        baselineSpecificity,
        overallFactor: cautionTrend >= 4 ? 0.8 : 0.84,
        longFactor: longRunTolerance <= 2.5 ? 0.72 : 0.78,
        mode,
        qualityStrategy: qualityBaseline ? "convert" : "hold",
      }),
    );

    if (followingWeek !== undefined) {
      weeks.set(
        followingWeek,
        scaleWeek(weeks.get(followingWeek) ?? [], {
          distance,
          baselineSpecificity,
          overallFactor: cautionTrend >= 4 ? 0.9 : 0.94,
          longFactor: longRunTolerance <= 2.5 ? 0.84 : 0.9,
          mode: "down_shift",
          qualityStrategy: qualityBaseline ? (qualityTolerance <= 2.5 ? "convert" : "trim") : "hold",
        }),
      );
    }
  }

  if (mode === "resume_build") {
    weeks.set(
      nextWeek,
      scaleWeek(weeks.get(nextWeek) ?? [], {
        distance,
        baselineSpecificity,
        overallFactor: progressionTolerance >= 4 && complianceTrend >= 3.5 ? 1.05 : 1.03,
        longFactor: distance === "5K" ? 1 : longRunTolerance >= 3.8 ? 1.05 : 1.02,
        mode,
        qualityStrategy: qualityTolerance >= 3 ? "restore" : "hold",
      }),
    );
  }

  if (mode === "progress") {
    weeks.set(
      nextWeek,
      scaleWeek(weeks.get(nextWeek) ?? [], {
        distance,
        baselineSpecificity,
        overallFactor: progressionTolerance >= 4 && durabilityTrend >= 3.7 ? 1.06 : 1.04,
        longFactor: distance === "5K" ? 1 : longRunTolerance >= 3.8 ? 1.05 : 1.01,
        mode,
        qualityStrategy: qualityTolerance >= 3 ? "advance" : qualityBaseline ? "restore" : "hold",
      }),
    );
  }

  return {
    ...nextPlan,
    sessions: nextPlan.sessions.map((session) => {
      const weekSessions = weeks.get(session.week);
      return weekSessions?.find((item) => item.id === session.id) ?? session;
    }),
  };
}

export function adaptUpcomingSessions(
  plan: TrainingPlan,
  capability: CapabilityState,
  decision?: AdaptationDecision | CoachDecision,
): TrainingPlan {
  const normalizedDecision = decision;
  const mode =
    normalizedDecision && "mode" in normalizedDecision
      ? normalizedDecision.mode
      : normalizedDecision?.type === "progress"
        ? "progress"
        : normalizedDecision?.type === "reduce_load"
          ? "down_shift"
          : normalizedDecision?.type === "recovery_block"
            ? "recovery_microcycle"
            : normalizedDecision?.type === "confidence_build"
              ? "down_shift"
              : "hold";
  const resolvedMode = mode ?? capability.lastAdaptationMode ?? "hold";
  return rebuildMicrocycle(plan, capability, resolvedMode);
}

export function summarizeNextWeekShift(before: TrainingPlan, after: TrainingPlan): { beforeLoad: number; afterLoad: number } {
  const nextWeek = nextWeekNumbers(before)[0];
  if (nextWeek === undefined) {
    return { beforeLoad: 0, afterLoad: 0 };
  }

  const beforeWeek = before.sessions.filter((session) => session.week === nextWeek);
  const afterWeek = after.sessions.filter((session) => session.week === nextWeek);
  return {
    beforeLoad: totalWeekLoad(beforeWeek),
    afterLoad: totalWeekLoad(afterWeek),
  };
}
