"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePlanForApp = generatePlanForApp;
exports.runAdaptivePassForApp = runAdaptivePassForApp;
exports.getPersistedPlanForApp = getPersistedPlanForApp;
exports.getLatestOwnedVNextPlanForApp = getLatestOwnedVNextPlanForApp;
exports.renderPlanExplanationForApp = renderPlanExplanationForApp;
exports.renderWeekExplanationForApp = renderWeekExplanationForApp;
exports.renderAdaptationExplanationForApp = renderAdaptationExplanationForApp;
const engine_1 = require("../../engine-v2/engine");
const runAdaptivePass_1 = require("../adaptation/runAdaptivePass");
const vnextPlanRepository_1 = require("../persistence/vnextPlanRepository");
const buildExplanationPayload_1 = require("../explanations/buildExplanationPayload");
const renderExplanation_1 = require("../explanations/renderExplanation");
function validationSummary(plan) {
    return {
        passed: (plan.vNextValidation?.hardFailCount ?? 0) === 0,
        warningCount: plan.vNextValidation?.warningCount ?? 0,
        hardFailCount: plan.vNextValidation?.hardFailCount ?? 0,
    };
}
function safeError(code, error) {
    return {
        ok: false,
        error: {
            code,
            message: error instanceof Error ? error.message : "Unknown adapter error",
        },
    };
}
function generatePlanForApp(input) {
    try {
        const plan = (0, engine_1.generateEngineV2Plan)(input);
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
    }
    catch (error) {
        return safeError("plan_generation_failed", error);
    }
}
function runAdaptivePassForApp(plan, feedback) {
    try {
        const result = (0, runAdaptivePass_1.runVNextAdaptivePass)(plan, feedback);
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
    }
    catch (error) {
        return safeError("adaptive_pass_failed", error);
    }
}
async function getPersistedPlanForApp(persistedPlanId, ownerUserId, repository = (0, vnextPlanRepository_1.createPrismaVNextPlanRepository)()) {
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
    }
    catch (error) {
        return safeError("persisted_plan_read_failed", error);
    }
}
async function getLatestOwnedVNextPlanForApp(ownerUserId, repository = (0, vnextPlanRepository_1.createPrismaVNextPlanRepository)()) {
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
    }
    catch (error) {
        return safeError("persisted_plan_read_failed", error);
    }
}
async function renderPlanExplanationForApp(plan, options) {
    try {
        const payload = (0, buildExplanationPayload_1.buildPlanExplanationPayload)(plan);
        const rendered = await (0, renderExplanation_1.renderPlanExplanation)(payload, options);
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
    }
    catch (error) {
        return safeError("plan_explanation_failed", error);
    }
}
async function renderWeekExplanationForApp(plan, weekIndex, options) {
    try {
        const payload = (0, buildExplanationPayload_1.buildWeekExplanationPayload)(plan, weekIndex);
        const rendered = await (0, renderExplanation_1.renderWeekExplanation)(payload, options);
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
    }
    catch (error) {
        return safeError("week_explanation_failed", error);
    }
}
async function renderAdaptationExplanationForApp(result, options) {
    try {
        const payload = (0, buildExplanationPayload_1.buildAdaptationExplanationPayload)(result);
        const rendered = await (0, renderExplanation_1.renderAdaptationExplanation)(payload, options);
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
    }
    catch (error) {
        return safeError("adaptation_explanation_failed", error);
    }
}
