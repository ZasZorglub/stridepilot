import { CoachDialogueContext, CoachInterpretation, CoachReply } from "./types";

export function applyUserReply(interpretation: CoachInterpretation, reply: CoachReply): CoachDialogueContext {
  if (reply.interpretationId !== interpretation.id) {
    return {
      interpretation,
      reply,
      interpretationConfirmed: false,
      adjustmentOverride: false,
    };
  }

  if (reply.replyType === "agree") {
    return {
      interpretation,
      reply,
      interpretationConfirmed: true,
      adjustmentOverride: false,
    };
  }

  if (reply.replyType === "disagree") {
    return {
      interpretation: {
        ...interpretation,
        suggestedAdjustment: undefined,
      },
      reply,
      interpretationConfirmed: false,
      adjustmentOverride: true,
      revertedSuggestedAdjustment: interpretation.suggestedAdjustment,
    };
  }

  if (reply.replyType === "clarify") {
    return {
      interpretation,
      reply,
      interpretationConfirmed: false,
      adjustmentOverride: false,
      clarificationNote: reply.text?.trim() || undefined,
    };
  }

  return {
    interpretation,
    reply,
    interpretationConfirmed: false,
    adjustmentOverride: false,
  };
}
