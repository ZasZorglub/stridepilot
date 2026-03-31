import { generateEngineV2Plan } from "../../engine-v2/engine";
import type {
  EnginePlan,
  RunnerInput,
  VNextAdaptivePassResult,
  VNextAdaptationFeedback,
} from "../../engine-v2/models";
import { runVNextAdaptivePass } from "../adaptation/runAdaptivePass";
import {
  createPrismaVNextPlanRepository,
  type PersistedVNextCurrentPlan,
  type VNextPlanRepository,
} from "../persistence/vnextPlanRepository";
import {
  buildAdaptationExplanationPayload,
  buildPlanExplanationPayload,
  buildWeekExplanationPayload,
} from "../explanations/buildExplanationPayload";
import {
  renderAdaptationExplanation,
  renderPlanExplanation,
  renderWeekExplanation,
  type ExplanationRenderOptions,
} from "../explanations/renderExplanation";

interface AdapterError {
  code: string;
  message: string;
}

interface AdapterValidationSummary {
  passed: boolean;
  warningCount: number;
  hardFailCount: number;
}

interface AdapterMeta {
  flow: "plan_generation" | "adaptive_pass" | "persisted_plan_read" | "plan_explanation" | "week_explanation" | "adaptation_explanation";
  engineVersion: "vnext";
  status: "success" | "fallback" | "not_found";
  debug: {
    currentVersionNumber?: number;
    persistedPlanId?: string;
    fallback?: boolean;
    explanationFallback?: boolean;
    protectedRunner?: boolean;
  };
}

interface PlanAppData {
  plan: EnginePlan;
  validation: AdapterValidationSummary;
  version: EnginePlan["versionMetadata"];
  status: {
    protectedRunner: boolean;
    adaptationReady: boolean;
    returnToRunningActive: boolean;
  };
  meta: AdapterMeta;
}

interface AdaptivePassAppData {
  plan: EnginePlan;
  decision: VNextAdaptivePassResult["decision"];
  mutation: VNextAdaptivePassResult["mutation"];
  historyEntry: VNextAdaptivePassResult["historyEntry"];
  validation: VNextAdaptivePassResult["finalValidation"];
  status: {
    applied: boolean;
    fallback: boolean;
    protectedRunner: boolean;
  };
  meta: AdapterMeta;
}

interface ExplanationAppData {
  payloadKind: "plan_summary" | "week_summary" | "adaptation_summary";
  explanation: Awaited<ReturnType<typeof renderPlanExplanation>>["explanation"];
  source: Awaited<ReturnType<typeof renderPlanExplanation>>["source"];
  fallbackReason?: Awaited<ReturnType<typeof renderPlanExplanation>>["fallbackReason"];
  model?: Awaited<ReturnType<typeof renderPlanExplanation>>["model"];
  meta: AdapterMeta;
}

interface PersistedPlanAppData {
  persistedPlanId: string;
  plan: PersistedVNextCurrentPlan["plan"];
  versionMetadata: PersistedVNextCurrentPlan["versionMetadata"];
  currentVersionNumber: number;
  historySummary: PersistedVNextCurrentPlan["historySummary"];
  status: {
    found: boolean;
  };
  meta: AdapterMeta;
}

export type AdapterResponse<TData> =
  | { ok: true; data: TData }
  | { ok: false; error: AdapterError };

function validationSummary(plan: EnginePlan): AdapterValidationSummary {
  return {
    passed: (plan.vNextValidation?.hardFailCount ?? 0) === 0,
    warningCount: plan.vNextValidation?.warningCount ?? 0,
    hardFailCount: plan.vNextValidation?.hardFailCount ?? 0,
  };
}

function safeError(code: string, error: unknown): AdapterResponse<never> {
  return {
    ok: false,
    error: {
      code,
      message: error instanceof Error ? error.message : "Unknown adapter error",
    },
  };
}

export function generatePlanForApp(input: RunnerInput): AdapterResponse<PlanAppData> {
  try {
    const plan = generateEngineV2Plan(input);
    return {
      ok: true,
      data: {
        plan,
        validation: validationSummary(plan),
        version: plan.versionMetadata,
        status: {
          protectedRunner: Boolean(plan.adaptationHooks?.protectedRunner),
          adaptationReady: Boolean(plan.adaptationHooks?.adaptationReady),
          returnToRunningActive: Boolean(plan.returnToRunningState?.active),
        },
        meta: {
          flow: "plan_generation",
          engineVersion: "vnext",
          status: "success",
          debug: {
            currentVersionNumber: plan.versionMetadata?.versionNumber,
            protectedRunner: Boolean(plan.adaptationHooks?.protectedRunner),
          },
        },
      },
    };
  } catch (error) {
    return safeError("plan_generation_failed", error);
  }
}

export function runAdaptivePassForApp(
  plan: EnginePlan,
  feedback: VNextAdaptationFeedback,
): AdapterResponse<AdaptivePassAppData> {
  try {
    const result = runVNextAdaptivePass(plan, feedback);
    return {
      ok: true,
      data: {
        plan: result.finalPlan,
        decision: result.decision,
        mutation: result.mutation,
        historyEntry: result.historyEntry,
        validation: result.finalValidation,
        status: {
          applied: result.applied,
          fallback: result.fallback,
          protectedRunner: result.originalPlanMeta.protectedRunner,
        },
        meta: {
          flow: "adaptive_pass",
          engineVersion: "vnext",
          status: result.fallback ? "fallback" : "success",
          debug: {
            currentVersionNumber: result.finalPlan.versionMetadata?.versionNumber,
            fallback: result.fallback,
            protectedRunner: result.originalPlanMeta.protectedRunner,
          },
        },
      },
    };
  } catch (error) {
    return safeError("adaptive_pass_failed", error);
  }
}

export async function getPersistedPlanForApp(
  persistedPlanId: string,
  ownerUserId: string,
  repository: VNextPlanRepository = createPrismaVNextPlanRepository(),
): Promise<AdapterResponse<PersistedPlanAppData>> {
  try {
    const persisted = await repository.getCurrentPlan(persistedPlanId, ownerUserId);
    if (!persisted) {
      return {
        ok: false,
        error: {
          code: "persisted_plan_not_found",
          message: "Persisted vNext plan not found",
        },
      };
    }

    return {
      ok: true,
      data: {
        persistedPlanId: persisted.persistedPlanId,
        plan: persisted.plan,
        versionMetadata: persisted.versionMetadata,
        currentVersionNumber: persisted.currentVersionNumber,
        historySummary: persisted.historySummary,
        status: {
          found: true,
        },
        meta: {
          flow: "persisted_plan_read",
          engineVersion: "vnext",
          status: "success",
          debug: {
            persistedPlanId: persisted.persistedPlanId,
            currentVersionNumber: persisted.currentVersionNumber,
          },
        },
      },
    };
  } catch (error) {
    return safeError("persisted_plan_read_failed", error);
  }
}

export async function getLatestOwnedVNextPlanForApp(
  ownerUserId: string,
  repository: VNextPlanRepository = createPrismaVNextPlanRepository(),
): Promise<AdapterResponse<PersistedPlanAppData>> {
  try {
    const persisted = await repository.getLatestCurrentPlanForUser(ownerUserId);
    if (!persisted) {
      return {
        ok: false,
        error: {
          code: "vnext_current_plan_not_found",
          message: "No current owned vNext plan found",
        },
      };
    }

    return {
      ok: true,
      data: {
        persistedPlanId: persisted.persistedPlanId,
        plan: persisted.plan,
        versionMetadata: persisted.versionMetadata,
        currentVersionNumber: persisted.currentVersionNumber,
        historySummary: persisted.historySummary,
        status: {
          found: true,
        },
        meta: {
          flow: "persisted_plan_read",
          engineVersion: "vnext",
          status: "success",
          debug: {
            persistedPlanId: persisted.persistedPlanId,
            currentVersionNumber: persisted.currentVersionNumber,
          },
        },
      },
    };
  } catch (error) {
    return safeError("persisted_plan_read_failed", error);
  }
}

export async function renderPlanExplanationForApp(
  plan: EnginePlan,
  options?: ExplanationRenderOptions,
): Promise<AdapterResponse<ExplanationAppData>> {
  try {
    const payload = buildPlanExplanationPayload(plan);
    const rendered = await renderPlanExplanation(payload, options);
    return {
      ok: true,
      data: {
        payloadKind: payload.kind,
        explanation: rendered.explanation,
        source: rendered.source,
        fallbackReason: rendered.fallbackReason,
        model: rendered.model,
        meta: {
          flow: "plan_explanation",
          engineVersion: "vnext",
          status: rendered.source === "fallback" ? "fallback" : "success",
          debug: {
            explanationFallback: rendered.source === "fallback",
          },
        },
      },
    };
  } catch (error) {
    return safeError("plan_explanation_failed", error);
  }
}

export async function renderWeekExplanationForApp(
  plan: EnginePlan,
  weekIndex: number,
  options?: ExplanationRenderOptions,
): Promise<AdapterResponse<ExplanationAppData>> {
  try {
    const payload = buildWeekExplanationPayload(plan, weekIndex);
    const rendered = await renderWeekExplanation(payload, options);
    return {
      ok: true,
      data: {
        payloadKind: payload.kind,
        explanation: rendered.explanation,
        source: rendered.source,
        fallbackReason: rendered.fallbackReason,
        model: rendered.model,
        meta: {
          flow: "week_explanation",
          engineVersion: "vnext",
          status: rendered.source === "fallback" ? "fallback" : "success",
          debug: {
            explanationFallback: rendered.source === "fallback",
          },
        },
      },
    };
  } catch (error) {
    return safeError("week_explanation_failed", error);
  }
}

export async function renderAdaptationExplanationForApp(
  result: VNextAdaptivePassResult,
  options?: ExplanationRenderOptions,
): Promise<AdapterResponse<ExplanationAppData>> {
  try {
    const payload = buildAdaptationExplanationPayload(result);
    const rendered = await renderAdaptationExplanation(payload, options);
    return {
      ok: true,
      data: {
        payloadKind: payload.kind,
        explanation: rendered.explanation,
        source: rendered.source,
        fallbackReason: rendered.fallbackReason,
        model: rendered.model,
        meta: {
          flow: "adaptation_explanation",
          engineVersion: "vnext",
          status: rendered.source === "fallback" ? "fallback" : "success",
          debug: {
            explanationFallback: rendered.source === "fallback",
            fallback: result.fallback,
          },
        },
      },
    };
  } catch (error) {
    return safeError("adaptation_explanation_failed", error);
  }
}
