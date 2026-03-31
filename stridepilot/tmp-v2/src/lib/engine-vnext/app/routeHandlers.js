"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleVNextPlanGenerationRequest = handleVNextPlanGenerationRequest;
exports.handleVNextAdaptivePassRequest = handleVNextAdaptivePassRequest;
exports.handleVNextCurrentPlanReadRequest = handleVNextCurrentPlanReadRequest;
const appAdapter_1 = require("../../engine-v2/appAdapter");
const engineAdapter_1 = require("./engineAdapter");
const vnextPlanRepository_1 = require("../persistence/vnextPlanRepository");
function badRequest(message) {
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
function unauthorized(message = "Authentication required") {
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
function statusForError(code) {
    if (code === "bad_request")
        return 400;
    if (code === "unauthorized")
        return 401;
    if (code === "persisted_plan_not_found")
        return 404;
    if (code === "vnext_current_plan_not_found")
        return 404;
    return 500;
}
function repositoryError(code, message) {
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
function persistenceStatusFromSummary(summary) {
    return {
        saved: true,
        persistedPlanId: summary.persistedPlanId,
        profileId: summary.profileId,
        goalId: summary.goalId,
        currentVersionNumber: summary.currentVersionNumber,
        latestHistoryEntryId: summary.latestHistoryEntryId,
    };
}
async function maybePersistGeneratedPlan(params) {
    if (!params.options?.persist || !params.body.runnerProfile || !params.body.goal) {
        return { saved: false };
    }
    if (!params.options.userId) {
        throw new Error("Authentication required for persisted vNext plan generation");
    }
    const repository = params.options.repository ?? (0, vnextPlanRepository_1.createPrismaVNextPlanRepository)();
    const saved = await repository.saveGeneratedPlan({
        userId: params.options.userId,
        profileId: params.body.profileId,
        runnerProfile: params.body.runnerProfile,
        goal: params.body.goal,
        plan: params.response.data.plan,
    });
    return persistenceStatusFromSummary(saved);
}
function buildAdaptivePassResult(params) {
    return {
        originalPlanMeta: {
            totalWeeks: params.body.plan?.weeks.length ?? params.response.data.plan.weeks.length,
            protectedRunner: params.response.data.status.protectedRunner,
            planType: params.response.data.plan.planTypeDecision.planType,
            targetWeekIndex: params.body.feedback?.targetWeekIndex ?? 1,
        },
        feedback: params.body.feedback,
        decision: params.response.data.decision,
        mutation: params.response.data.mutation,
        historyEntry: params.response.data.historyEntry,
        finalPlan: params.response.data.plan,
        finalValidation: params.response.data.validation,
        applied: params.response.data.status.applied,
        fallback: params.response.data.status.fallback,
    };
}
async function maybePersistAdaptivePass(params) {
    if (!params.options?.persist || !params.body.persistedPlanId) {
        return { saved: false };
    }
    if (!params.options.userId) {
        throw new Error("Authentication required for persisted vNext adaptive pass");
    }
    const repository = params.options.repository ?? (0, vnextPlanRepository_1.createPrismaVNextPlanRepository)();
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
async function handleVNextPlanGenerationRequest(body, options) {
    if (!body.runnerProfile || !body.goal) {
        return badRequest("Missing runnerProfile or goal");
    }
    if (options?.persist && !options.userId) {
        return unauthorized("Authentication required for persisted vNext plan generation");
    }
    const input = (0, appAdapter_1.buildEngineV2RunnerInput)({
        runnerProfile: body.runnerProfile,
        goal: body.goal,
        ambition: body.recommendationSelection?.mode ?? body.ambition,
        resolvedGoalDate: body.recommendationSelection?.goalDate,
        resolvedDurationWeeks: body.recommendationSelection?.durationWeeks,
    });
    const response = (0, engineAdapter_1.generatePlanForApp)(input);
    if (!response.ok) {
        return {
            status: statusForError(response.error.code),
            body: response,
        };
    }
    let persistence;
    try {
        persistence = await maybePersistGeneratedPlan({ body, response, options });
    }
    catch (error) {
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
async function handleVNextAdaptivePassRequest(body, options) {
    if (!body.plan || !body.feedback) {
        return badRequest("Missing plan or feedback");
    }
    if (options?.persist && !options.userId) {
        return unauthorized("Authentication required for persisted vNext adaptive pass");
    }
    const response = (0, engineAdapter_1.runAdaptivePassForApp)(body.plan, body.feedback);
    if (!response.ok) {
        return {
            status: statusForError(response.error.code),
            body: response,
        };
    }
    let persistence;
    try {
        persistence = await maybePersistAdaptivePass({ body, response, options });
    }
    catch (error) {
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
async function handleVNextCurrentPlanReadRequest(query, options) {
    if (!options?.userId) {
        return unauthorized("Authentication required for persisted vNext plan read");
    }
    const repository = options?.repository ?? (0, vnextPlanRepository_1.createPrismaVNextPlanRepository)();
    const response = query.persistedPlanId
        ? await (0, engineAdapter_1.getPersistedPlanForApp)(query.persistedPlanId, options.userId, repository)
        : await (0, engineAdapter_1.getLatestOwnedVNextPlanForApp)(options.userId, repository);
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
