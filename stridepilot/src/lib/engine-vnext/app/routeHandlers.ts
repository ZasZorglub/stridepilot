import type { Goal, PlanAmbition, PlanRecommendationOption, RunnerProfile } from "../../types";
import { buildEngineV2RunnerInput } from "../../engine-v2/appAdapter";
import type {
  EnginePlan,
  VNextAdaptivePassResult,
  VNextAdaptationFeedback,
} from "../../engine-v2/models";
import {
  generatePlanForApp,
  getLatestOwnedVNextPlanForApp,
  getPersistedPlanForApp,
  runAdaptivePassForApp,
  type AdapterResponse,
} from "./engineAdapter";
import {
  createPrismaVNextPlanRepository,
  type PersistedVNextPlanSummary,
  type VNextPlanRepository,
} from "../persistence/vnextPlanRepository";

export interface VNextGeneratePlanRouteBody {
  engineVersion?: "vnext";
  runnerProfile?: RunnerProfile;
  goal?: Goal;
  profileId?: string;
  ambition?: PlanAmbition;
  recommendationSelection?: Pick<PlanRecommendationOption, "mode" | "goalDate" | "durationWeeks">;
}

export interface VNextAdaptiveRouteBody {
  engineVersion?: "vnext";
  profileId?: string;
  persistedPlanId?: string;
  plan?: EnginePlan;
  feedback?: VNextAdaptationFeedback;
}

export interface VNextCurrentPlanReadQuery {
  persistedPlanId?: string;
}

export interface RouteHandlerResult<TData> {
  status: number;
  body: AdapterResponse<TData>;
}

type BasePlanRouteData = Extract<ReturnType<typeof generatePlanForApp>, { ok: true }>["data"];
type BaseAdaptiveRouteData = Extract<ReturnType<typeof runAdaptivePassForApp>, { ok: true }>["data"];

export interface VNextPersistenceStatus {
  saved: boolean;
  persistedPlanId?: string;
  profileId?: string;
  goalId?: string;
  currentVersionNumber?: number;
  latestHistoryEntryId?: string;
}

export type PlanRouteData = BasePlanRouteData & { persistence: VNextPersistenceStatus };
export type AdaptiveRouteData = BaseAdaptiveRouteData & { persistence: VNextPersistenceStatus };
export type PersistedReadRouteData = Extract<Awaited<ReturnType<typeof getPersistedPlanForApp>>, { ok: true }>["data"];

export interface RouteHandlerOptions {
  userId?: string | null;
  repository?: VNextPlanRepository;
  persist?: boolean;
}

function badRequest<TData>(message: string): RouteHandlerResult<TData> {
  return {
    status: 400,
    body: {
      ok: false,
      error: {
        code: "bad_request",
        message,
      },
    },
  };
}

function unauthorized<TData>(message = "Authentication required"): RouteHandlerResult<TData> {
  return {
    status: 401,
    body: {
      ok: false,
      error: {
        code: "unauthorized",
        message,
      },
    },
  };
}

function statusForError(code: string): number {
  if (code === "bad_request") return 400;
  if (code === "unauthorized") return 401;
  if (code === "persisted_plan_not_found") return 404;
  if (code === "vnext_current_plan_not_found") return 404;
  return 500;
}

function repositoryError<TData>(code: string, message: string): RouteHandlerResult<TData> {
  return {
    status: statusForError(code),
    body: {
      ok: false,
      error: {
        code,
        message,
      },
    },
  };
}

function persistenceStatusFromSummary(summary: PersistedVNextPlanSummary): VNextPersistenceStatus {
  return {
    saved: true,
    persistedPlanId: summary.persistedPlanId,
    profileId: summary.profileId,
    goalId: summary.goalId,
    currentVersionNumber: summary.currentVersionNumber,
    latestHistoryEntryId: summary.latestHistoryEntryId,
  };
}

async function maybePersistGeneratedPlan(params: {
  body: VNextGeneratePlanRouteBody;
  response: Extract<ReturnType<typeof generatePlanForApp>, { ok: true }>;
  options?: RouteHandlerOptions;
}): Promise<VNextPersistenceStatus> {
  if (!params.options?.persist || !params.body.runnerProfile || !params.body.goal) {
    return { saved: false };
  }
  if (!params.options.userId) {
    throw new Error("Authentication required for persisted vNext plan generation");
  }

  const repository = params.options.repository ?? createPrismaVNextPlanRepository();
  const saved = await repository.saveGeneratedPlan({
    userId: params.options.userId,
    profileId: params.body.profileId,
    runnerProfile: params.body.runnerProfile,
    goal: params.body.goal,
    plan: params.response.data.plan,
  });

  return persistenceStatusFromSummary(saved);
}

function buildAdaptivePassResult(params: {
  body: VNextAdaptiveRouteBody;
  response: Extract<ReturnType<typeof runAdaptivePassForApp>, { ok: true }>;
}): VNextAdaptivePassResult {
  return {
    originalPlanMeta: {
      totalWeeks: params.body.plan?.weeks.length ?? params.response.data.plan.weeks.length,
      protectedRunner: params.response.data.status.protectedRunner,
      planType: params.response.data.plan.planTypeDecision.planType,
      targetWeekIndex: params.body.feedback?.targetWeekIndex ?? 1,
    },
    feedback: params.body.feedback!,
    decision: params.response.data.decision,
    mutation: params.response.data.mutation,
    historyEntry: params.response.data.historyEntry,
    finalPlan: params.response.data.plan,
    finalValidation: params.response.data.validation,
    applied: params.response.data.status.applied,
    fallback: params.response.data.status.fallback,
  };
}

async function maybePersistAdaptivePass(params: {
  body: VNextAdaptiveRouteBody;
  response: Extract<ReturnType<typeof runAdaptivePassForApp>, { ok: true }>;
  options?: RouteHandlerOptions;
}): Promise<VNextPersistenceStatus> {
  if (!params.options?.persist || !params.body.persistedPlanId) {
    return { saved: false };
  }
  if (!params.options.userId) {
    throw new Error("Authentication required for persisted vNext adaptive pass");
  }

  const repository = params.options.repository ?? createPrismaVNextPlanRepository();
  const saved = await repository.saveAdaptivePass({
    persistedPlanId: params.body.persistedPlanId,
    ownerUserId: params.options.userId,
    result: buildAdaptivePassResult({
      body: params.body,
      response: params.response,
    }),
  });

  return persistenceStatusFromSummary(saved);
}

export async function handleVNextPlanGenerationRequest(
  body: VNextGeneratePlanRouteBody,
  options?: RouteHandlerOptions,
): Promise<RouteHandlerResult<PlanRouteData>> {
  if (!body.runnerProfile || !body.goal) {
    return badRequest("Missing runnerProfile or goal");
  }
  if (options?.persist && !options.userId) {
    return unauthorized("Authentication required for persisted vNext plan generation");
  }

  const input = buildEngineV2RunnerInput({
    runnerProfile: body.runnerProfile,
    goal: body.goal,
    ambition: body.recommendationSelection?.mode ?? body.ambition,
    resolvedGoalDate: body.recommendationSelection?.goalDate,
    resolvedDurationWeeks: body.recommendationSelection?.durationWeeks,
  });

  const response = generatePlanForApp(input);
  if (!response.ok) {
    return {
      status: statusForError(response.error.code),
      body: response,
    };
  }

  let persistence: VNextPersistenceStatus;
  try {
    persistence = await maybePersistGeneratedPlan({ body, response, options });
  } catch (error) {
    return repositoryError("plan_generation_failed", error instanceof Error ? error.message : "Could not persist vNext plan");
  }
  return {
    status: 200,
    body: {
      ok: true,
      data: {
        ...response.data,
        persistence,
      },
    },
  };
}

export async function handleVNextAdaptivePassRequest(
  body: VNextAdaptiveRouteBody,
  options?: RouteHandlerOptions,
): Promise<RouteHandlerResult<AdaptiveRouteData>> {
  if (!body.plan || !body.feedback) {
    return badRequest("Missing plan or feedback");
  }
  if (options?.persist && !options.userId) {
    return unauthorized("Authentication required for persisted vNext adaptive pass");
  }

  const response = runAdaptivePassForApp(body.plan, body.feedback);
  if (!response.ok) {
    return {
      status: statusForError(response.error.code),
      body: response,
    };
  }

  let persistence: VNextPersistenceStatus;
  try {
    persistence = await maybePersistAdaptivePass({ body, response, options });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not persist vNext adaptive pass";
    const code = /not found/i.test(message) ? "persisted_plan_not_found" : "adaptive_pass_failed";
    return repositoryError(code, message);
  }
  return {
    status: 200,
    body: {
      ok: true,
      data: {
        ...response.data,
        persistence,
      },
    },
  };
}

export async function handleVNextCurrentPlanReadRequest(
  query: VNextCurrentPlanReadQuery,
  options?: RouteHandlerOptions,
): Promise<RouteHandlerResult<PersistedReadRouteData>> {
  if (!options?.userId) {
    return unauthorized("Authentication required for persisted vNext plan read");
  }

  const repository = options?.repository ?? createPrismaVNextPlanRepository();
  const response = query.persistedPlanId
    ? await getPersistedPlanForApp(query.persistedPlanId, options.userId, repository)
    : await getLatestOwnedVNextPlanForApp(options.userId, repository);
  if (!response.ok) {
    return {
      status: statusForError(response.error.code),
      body: response,
    };
  }

  return {
    status: 200,
    body: response,
  };
}
