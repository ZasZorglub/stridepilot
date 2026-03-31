import OpenAI from "openai";
import type { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";
import type {
  AdaptationExplanationPayload,
  PlanExplanationPayload,
  WeekExplanationPayload,
} from "./buildExplanationPayload";
import {
  buildAdaptationExplanationPromptContract,
  buildPlanExplanationPromptContract,
  buildWeekExplanationPromptContract,
  type ExplanationPromptContract,
} from "./promptContracts";
import {
  explanationJsonSchema,
  parseRenderedExplanation,
  type ExplanationRenderResult,
  type RenderedExplanation,
} from "./explanationSchemas";

type ExplanationPayload = PlanExplanationPayload | WeekExplanationPayload | AdaptationExplanationPayload;

interface OpenAIResponsesClientLike {
  responses: {
    create(params: ResponseCreateParamsNonStreaming): Promise<{ output_text?: string }>;
  };
}

export interface ExplanationRenderOptions {
  client?: OpenAIResponsesClientLike;
  model?: string;
}

function explanationToneForPayload(payload: ExplanationPayload): RenderedExplanation["tone"] {
  if (payload.kind === "adaptation_summary" && payload.adaptationContext.conservativeBias) return "calm";
  if (
    payload.kind === "plan_summary" &&
    (payload.runnerContext.protectedRunner || payload.safetySummary.returnToRunningActive)
  ) {
    return "calm";
  }
  return payload.kind === "week_summary" ? "encouraging" : "analytical";
}

function buildFallbackExplanation(payload: ExplanationPayload): RenderedExplanation {
  if (payload.kind === "plan_summary") {
    return {
      title: `Plan for ${payload.runnerContext.goalType} ${payload.runnerContext.raceDistance}`,
      summary: `This plan spans ${payload.progressionSummary.totalWeeks} weeks, starts at ${payload.progressionSummary.sessionsPerWeekStart} sessions per week, and peaks at ${payload.progressionSummary.sessionsPerWeekPeak}. It stays grounded in the current runner level and safety profile.`,
      bullets: [
        `Long run progression moves from ${payload.progressionSummary.longRunStartMin} to ${payload.progressionSummary.longRunPeakMin} minutes.`,
        `Phase sequence: ${payload.progressionSummary.phaseSequence.join(" -> ")}.`,
        payload.runnerContext.protectedRunner || payload.safetySummary.returnToRunningActive
          ? "This plan uses a more protective progression style."
          : "This plan uses standard deterministic progression rules.",
      ],
      tone: explanationToneForPayload(payload),
      warnings: payload.safetySummary.validationWarnings > 0 ? [`Validation warnings: ${payload.safetySummary.validationWarnings}`] : undefined,
    };
  }

  if (payload.kind === "week_summary") {
    return {
      title: `Week ${payload.weekContext.weekIndex} overview`,
      summary: `This ${payload.weekContext.phase} week contains ${payload.structureSummary.sessionCount} sessions and keeps the focus on ${payload.weekContext.focus.toLowerCase()}.`,
      bullets: [
        `Volume target: ${payload.weekContext.volumeTargetMin} minutes.`,
        payload.weekContext.longRunTargetMin > 0
          ? `Long run target: ${payload.weekContext.longRunTargetMin} minutes.`
          : "There is no normal long run target this week.",
        `Quality sessions: ${payload.structureSummary.qualityCount}.`,
      ],
      tone: explanationToneForPayload(payload),
      warnings: payload.weekContext.isRaceWeek ? ["Race week should feel lighter and simpler than a normal training week."] : undefined,
    };
  }

  return {
    title: `Adaptation: ${payload.adaptationContext.action}`,
    summary: payload.adaptationContext.applied
      ? `The engine applied ${payload.adaptationContext.mutationType} for week ${payload.adaptationContext.targetWeekIndex} using deterministic safety rules.`
      : `The engine kept the plan unchanged after evaluating ${payload.adaptationContext.action}.`,
    bullets: [
      `Applied: ${payload.adaptationContext.applied}.`,
      `Fallback: ${payload.adaptationContext.fallback}.`,
      `Version transition: ${payload.mutationSummary.sourceVersionNumber} -> ${payload.mutationSummary.resultingVersionNumber}.`,
    ],
    tone: explanationToneForPayload(payload),
    warnings: payload.validationSummary.vNextWarningCount > 0 ? [`Validation warnings: ${payload.validationSummary.vNextWarningCount}`] : undefined,
  };
}

function getPromptContract(payload: ExplanationPayload): ExplanationPromptContract<ExplanationPayload> {
  if (payload.kind === "plan_summary") return buildPlanExplanationPromptContract(payload);
  if (payload.kind === "week_summary") return buildWeekExplanationPromptContract(payload);
  return buildAdaptationExplanationPromptContract(payload);
}

export function buildExplanationRequest(
  payload: ExplanationPayload,
  model: string,
): ResponseCreateParamsNonStreaming {
  const contract = getPromptContract(payload);

  return {
    model,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: [
              contract.systemInstruction,
              ...contract.outputGoals,
              ...contract.immutabilityRules,
              "Return only structured JSON matching the required schema.",
            ].join("\n"),
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify({
              promptType: contract.promptType,
              payload: contract.payload,
            }),
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: explanationJsonSchema.name,
        schema: explanationJsonSchema.schema,
        strict: explanationJsonSchema.strict,
      },
    },
  };
}

function getClient(options?: ExplanationRenderOptions): OpenAIResponsesClientLike | undefined {
  if (options?.client) return options.client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return undefined;
  return new OpenAI({ apiKey });
}

function getModel(options?: ExplanationRenderOptions): string {
  return options?.model ?? process.env.OPENAI_EXPLANATION_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
}

async function renderWithPayload(
  payload: ExplanationPayload,
  options?: ExplanationRenderOptions,
): Promise<ExplanationRenderResult> {
  const fallback = buildFallbackExplanation(payload);
  const client = getClient(options);
  const model = getModel(options);

  if (!client) {
    return {
      explanation: fallback,
      source: "fallback",
      fallbackReason: "missing_api_key",
      model,
    };
  }

  try {
    const response = await client.responses.create(buildExplanationRequest(payload, model));
    const text = response.output_text;
    if (!text) {
      return {
        explanation: fallback,
        source: "fallback",
        fallbackReason: "invalid_output",
        model,
      };
    }
    const parsed = parseRenderedExplanation(JSON.parse(text));
    if (!parsed) {
      return {
        explanation: fallback,
        source: "fallback",
        fallbackReason: "invalid_output",
        model,
      };
    }
    return {
      explanation: parsed,
      source: "openai",
      model,
    };
  } catch {
    return {
      explanation: fallback,
      source: "fallback",
      fallbackReason: "model_error",
      model,
    };
  }
}

export async function renderPlanExplanation(
  payload: PlanExplanationPayload,
  options?: ExplanationRenderOptions,
): Promise<ExplanationRenderResult> {
  return renderWithPayload(payload, options);
}

export async function renderWeekExplanation(
  payload: WeekExplanationPayload,
  options?: ExplanationRenderOptions,
): Promise<ExplanationRenderResult> {
  return renderWithPayload(payload, options);
}

export async function renderAdaptationExplanation(
  payload: AdaptationExplanationPayload,
  options?: ExplanationRenderOptions,
): Promise<ExplanationRenderResult> {
  return renderWithPayload(payload, options);
}
