import { CapabilityState, WorkoutFeedback } from "../capability";
import { PlanAdjustment } from "../types";
import { CoachInterpretation } from "./types";

function makeInterpretationId(feedback: WorkoutFeedback): string {
  return `interp-${feedback.sessionId}`;
}

function difficultyCopy(feedback: WorkoutFeedback): string {
  if (feedback.difficulty === "very_hard") return "passet så ud til at være meget krævende";
  if (feedback.difficulty === "hard") return "passet så ud til at være hårdere end ønsket";
  if (feedback.difficulty === "easy") return "passet så ud til at føles let";
  return "passet så ud til at ramme et moderat niveau";
}

function painCopy(feedback: WorkoutFeedback): string | null {
  if (feedback.pain === "high") return "Du rapporterede høj smerte";
  if (feedback.pain === "moderate") return "Du rapporterede moderat smerte";
  if (feedback.pain === "mild") return "Du nævnte let ubehag";
  return null;
}

function capabilityReasoning(capability: CapabilityState): string {
  if (capability.recoveryDebt >= 6) {
    return "Jeg holder lidt ekstra igen, fordi kroppen ser ud til at have brug for mere restitution.";
  }
  if (capability.fatigueIndex >= 6) {
    return "Jeg holder næste skridt lidt roligere, så træthed ikke får lov at bygge sig op.";
  }
  if (capability.weeklyLoad > 0 && capability.consistencyScore >= 6) {
    return "Jeg læner mig mod en stabil progression, fordi din træning ser ud til at være godt på vej ind i rytme.";
  }
  return "Jeg holder planen rolig og forudsigelig, så du kan bygge videre med overskud.";
}

function suggestedAdjustmentSummary(adjustments: PlanAdjustment[]): string | undefined {
  const nextAdjustment = adjustments[0];
  if (!nextAdjustment) return undefined;
  return nextAdjustment.summary;
}

function buildMessage(feedback: WorkoutFeedback, adjustments: PlanAdjustment[]): string {
  const painMessage = painCopy(feedback);
  if (painMessage && adjustments[0]?.summary) {
    return `${painMessage}, så den næste del af planen bliver justeret lidt.`;
  }
  if (feedback.energy === "low" && adjustments[0]?.summary) {
    return "Du rapporterede lav energi, så den næste session bliver justeret lidt.";
  }
  if (adjustments[0]?.summary) {
    return `Jeg vurderer, at ${difficultyCopy(feedback)}, så den næste del af planen bliver justeret lidt.`;
  }
  if (painMessage) {
    return `${painMessage}, så jeg holder progressionen mere rolig lige nu.`;
  }
  if (feedback.energy === "low") {
    return "Du rapporterede lav energi, så jeg holder næste skridt mere roligt.";
  }
  return `Jeg vurderer, at ${difficultyCopy(feedback)}, så planen kan fortsætte i et roligt og realistisk tempo.`;
}

export function createInterpretation(
  capability: CapabilityState,
  feedback: WorkoutFeedback,
  adjustments: PlanAdjustment[],
): CoachInterpretation {
  return {
    id: makeInterpretationId(feedback),
    message: buildMessage(feedback, adjustments),
    reasoning: capabilityReasoning(capability),
    suggestedAdjustment: suggestedAdjustmentSummary(adjustments),
    createdAt: new Date().toISOString(),
  };
}
