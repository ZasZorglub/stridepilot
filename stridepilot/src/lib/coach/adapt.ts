import { TrainingPlan } from "../types";
import { explainPlanAdjustment } from "./explanations";
import { buildAdaptationRationale } from "./explanations";
import { decideAdaptationMode } from "./adaptationMode";
import { adaptUpcomingSessions } from "./adaptUpcomingSessions";
import { CapabilityState, FeedbackSessionKind, WorkoutFeedback, createInitialCapabilityState, defaultRunnerTraits } from "./capability";
import { AdaptationRationale } from "./types";
import { updateCapability } from "./updateCapability";

function hydrateCapabilityState(plan: TrainingPlan, capability?: CapabilityState | null): CapabilityState {
  const seed = capability ?? createInitialCapabilityState(plan);
  return {
    ...seed,
    recentFeedback: seed.recentFeedback ?? [],
    traits: seed.traits ?? defaultRunnerTraits(),
    lastAdaptationMode: seed.lastAdaptationMode ?? "hold",
    lastAdaptationReason: seed.lastAdaptationReason,
  };
}

function sessionKind(session?: TrainingPlan["sessions"][number]): FeedbackSessionKind {
  if (!session) return "other";
  const text = `${session.title} ${session.notes ?? ""}`.toLowerCase();
  if (text.includes("interval") || text.includes("tempo")) return "quality";
  if (text.includes("lang") || text.includes("udholdenhed") || text.includes("long")) return "long";
  if (text.includes("easy") || text.includes("roligt") || text.includes("recovery") || text.includes("strides") || text.includes("run-walk")) return "easy";
  return "other";
}

function sessionRunMinutes(session?: TrainingPlan["sessions"][number]): number {
  if (!session) return 0;
  return Math.round(session.steps.filter((step) => step.type === "run").reduce((sum, step) => sum + step.durationSec, 0) / 60);
}

export function adaptPlanFromFeedback(
  plan: TrainingPlan,
  feedback: WorkoutFeedback,
  capability?: CapabilityState | null,
): { capability: CapabilityState; plan: TrainingPlan; rationale: AdaptationRationale } {
  const currentCapability = hydrateCapabilityState(plan, capability);
  const matchedSession = plan.sessions.find((session) => session.id === feedback.sessionId);
  const enrichedFeedback: WorkoutFeedback = {
    ...feedback,
    sessionKind: feedback.sessionKind ?? sessionKind(matchedSession),
    runMinutes: feedback.runMinutes ?? sessionRunMinutes(matchedSession),
  };
  const nextCapability = updateCapability(currentCapability, enrichedFeedback);
  const adaptationDecision = decideAdaptationMode(nextCapability);
  const updatedPlan = adaptUpcomingSessions(plan, nextCapability, adaptationDecision);
  const nextWeek = Math.min(...plan.sessions.map((session) => session.week));
  const summarizeSession = (session: TrainingPlan["sessions"][number]) => ({
    title: session.title,
    loadScore: session.loadScore,
    runMinutes: Math.round(session.steps.filter((step) => step.type === "run").reduce((sum, step) => sum + step.durationSec, 0) / 60),
  });
  const rationale = buildAdaptationRationale({
    mode: adaptationDecision.mode,
    reason: adaptationDecision.reason,
    nextWeekBefore: plan.sessions.filter((session) => session.week === nextWeek).map(summarizeSession),
    nextWeekAfter: updatedPlan.sessions.filter((session) => session.week === nextWeek).map(summarizeSession),
    traits: nextCapability.traits,
  });

  return {
    capability: {
      ...nextCapability,
      lastAdaptationMode: adaptationDecision.mode,
      lastAdaptationReason: adaptationDecision.reason,
    },
    plan: updatedPlan,
    rationale,
  };
}

export function createAdjustment(params: {
  weekNumber: number;
  sessionId?: string;
  reason: string;
  effect: "reduce_load" | "hold" | "increase" | "insert_recovery";
}) {
  return {
    id: `${params.weekNumber}-${params.sessionId ?? "week"}`,
    weekNumber: params.weekNumber,
    sessionId: params.sessionId,
    reason: params.reason,
    effect: params.effect,
    summary: explainPlanAdjustment({
      id: `${params.weekNumber}-${params.sessionId ?? "week"}`,
      weekNumber: params.weekNumber,
      sessionId: params.sessionId,
      reason: params.reason,
      effect: params.effect,
      summary: "",
    }),
  };
}

export { explainPlanAdjustment };
