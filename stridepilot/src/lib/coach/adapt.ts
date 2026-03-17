import { TrainingPlan } from "@/lib/types";
import { explainPlanAdjustment } from "./explanations";
import { adaptUpcomingSessions } from "./adaptUpcomingSessions";
import { CapabilityState, createInitialCapabilityState, WorkoutFeedback } from "./capability";
import { updateCapability } from "./updateCapability";

export function adaptPlanFromFeedback(
  plan: TrainingPlan,
  feedback: WorkoutFeedback,
  capability?: CapabilityState | null,
): { capability: CapabilityState; plan: TrainingPlan } {
  const currentCapability = capability ?? createInitialCapabilityState(plan);
  const nextCapability = updateCapability(currentCapability, feedback);
  const updatedPlan = adaptUpcomingSessions(plan, nextCapability);

  return {
    capability: nextCapability,
    plan: updatedPlan,
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
