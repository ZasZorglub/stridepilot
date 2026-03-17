import { PlanAdjustment } from "../types";

export type CoachInterpretation = {
  id: string;
  message: string;
  reasoning: string;
  suggestedAdjustment?: string;
  createdAt: string;
};

export type CoachReply = {
  interpretationId: string;
  replyType: "agree" | "disagree" | "clarify";
  text?: string;
};

export type CoachDialogueContext = {
  interpretation: CoachInterpretation;
  reply?: CoachReply;
  interpretationConfirmed: boolean;
  adjustmentOverride: boolean;
  revertedSuggestedAdjustment?: string;
  clarificationNote?: string;
};

export type CoachInterpretationInput = {
  painSignal: "none" | "mild" | "moderate" | "high";
  difficultySignal: "easy" | "moderate" | "hard" | "very_hard";
  adjustment?: PlanAdjustment;
};
