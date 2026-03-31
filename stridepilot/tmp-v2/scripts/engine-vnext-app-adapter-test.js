"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const benchmark_1 = require("../src/lib/engine-v2/benchmark");
const engineAdapter_1 = require("../src/lib/engine-vnext/app/engineAdapter");
const runAdaptivePass_1 = require("../src/lib/engine-vnext/adaptation/runAdaptivePass");
const vnextPlanRepository_1 = require("../src/lib/engine-vnext/persistence/vnextPlanRepository");
const beginnerInput = {
    raceDistance: "5K",
    goalType: "finish",
    startDate: "2026-03-23",
    goalDate: "2026-06-28",
    currentContinuousRunMin: 18,
    currentWeeklyRuns: 3,
    currentWeeklyVolumeKm: 14,
    longestRecentRunMin: 24,
    recentConsistency: 0.6,
    availableTrainingDays: ["tuesday", "thursday", "sunday"],
    typicalAvailableTimeMin: 40,
    trainingStylePreference: "balanced",
    experienceLevel: "new",
    injuryConcern: "low",
    externalTrainingLoad: "light",
    confidence: 3,
};
function fakeClient(outputText) {
    return {
        responses: {
            async create() {
                return { output_text: outputText };
            },
        },
    };
}
async function main() {
    {
        const result = (0, engineAdapter_1.generatePlanForApp)(beginnerInput);
        strict_1.default.equal(result.ok, true, "Plan generation adapter should return stable success shape");
        if (result.ok) {
            strict_1.default.equal(result.data.plan.planTypeDecision.planType.length > 0, true);
            strict_1.default.equal(typeof result.data.validation.passed, "boolean");
            strict_1.default.equal(result.data.version?.versionNumber, 1);
            strict_1.default.equal(result.data.meta.flow, "plan_generation");
            strict_1.default.equal(result.data.meta.engineVersion, "vnext");
        }
    }
    {
        const generated = (0, engineAdapter_1.generatePlanForApp)(beginnerInput);
        strict_1.default.equal(generated.ok, true, "Expected generated plan for adaptive pass test");
        if (!generated.ok)
            throw new Error("Plan generation failed");
        const originalVersion = generated.data.plan.versionMetadata?.versionNumber;
        const originalHistoryLength = generated.data.plan.mutationHistory?.length ?? 0;
        const originalWeekCount = generated.data.plan.weeks.length;
        const originalVolumeTargets = generated.data.plan.weeks.map((week) => week.volumeTargetMin);
        const cutbackWeek = generated.data.plan.weeks.find((week) => week.isCutback);
        strict_1.default.ok(cutbackWeek, "Expected cutback week for adaptive pass");
        const result = (0, engineAdapter_1.runAdaptivePassForApp)(generated.data.plan, {
            targetWeekIndex: cutbackWeek.weekIndex,
            sessionsCompleted: 1,
            sessionsPlanned: cutbackWeek.sessions.length,
            fatigue: "moderate",
            painFlag: false,
            confidence: "normal",
        });
        strict_1.default.equal(result.ok, true, "Adaptive pass adapter should return stable success shape");
        if (result.ok) {
            strict_1.default.equal(result.data.decision.action, "repeat_current_week");
            strict_1.default.equal(typeof result.data.status.applied, "boolean");
            strict_1.default.equal(typeof result.data.historyEntry.entryId, "string");
            strict_1.default.equal(result.data.meta.flow, "adaptive_pass");
        }
        strict_1.default.equal(generated.data.plan.versionMetadata?.versionNumber, originalVersion, "Adapter layer should not bump version on the original plan");
        strict_1.default.equal(generated.data.plan.mutationHistory?.length ?? 0, originalHistoryLength, "Adapter layer should not append mutation history to the original plan");
        strict_1.default.equal(generated.data.plan.weeks.length, originalWeekCount, "Adapter layer should not change original plan length");
        strict_1.default.deepEqual(generated.data.plan.weeks.map((week) => week.volumeTargetMin), originalVolumeTargets, "Adapter layer should not alter original weekly load targets");
    }
    {
        const repository = new vnextPlanRepository_1.InMemoryVNextPlanRepository();
        const generated = (0, engineAdapter_1.generatePlanForApp)(beginnerInput);
        if (!generated.ok)
            throw new Error("Plan generation failed");
        await repository.saveGeneratedPlan({
            userId: "app_adapter_user",
            profileId: "profile_app_adapter",
            runnerProfile: {
                heightCm: 175,
                weightKg: 72,
                age: 36,
                activityLevel: "lav",
                runningExperience: "nybegynder",
                currentRunningAbility: "ti_femten_min",
            },
            goal: {
                distance: "5K",
                goalType: "complete",
                weeks: 10,
                startDate: "2026-03-23",
            },
            plan: generated.data.plan,
        });
        const latest = await (0, engineAdapter_1.getLatestOwnedVNextPlanForApp)("app_adapter_user", repository);
        strict_1.default.equal(latest.ok, true, "latest owned current vNext plan should be readable through the app adapter");
        if (latest.ok) {
            strict_1.default.equal(latest.data.meta.flow, "persisted_plan_read");
            strict_1.default.equal(typeof latest.data.meta.debug.currentVersionNumber, "number");
        }
    }
    {
        const generated = (0, engineAdapter_1.generatePlanForApp)(beginnerInput);
        if (!generated.ok)
            throw new Error("Plan generation failed");
        const result = await (0, engineAdapter_1.renderPlanExplanationForApp)(generated.data.plan, {
            client: fakeClient(JSON.stringify({
                title: "Plan overview",
                summary: "This explanation stays grounded in the deterministic plan payload.",
                bullets: ["The plan shape is preserved.", "The adapter only renders explanation text."],
                tone: "analytical",
            })),
            model: "gpt-test",
        });
        strict_1.default.equal(result.ok, true, "Plan explanation adapter should return stable success shape");
        if (result.ok) {
            strict_1.default.equal(result.data.payloadKind, "plan_summary");
            strict_1.default.equal(result.data.source, "openai");
            strict_1.default.equal(result.data.explanation.title, "Plan overview");
            strict_1.default.equal(result.data.meta.flow, "plan_explanation");
        }
    }
    {
        const generated = (0, engineAdapter_1.generatePlanForApp)(beginnerInput);
        if (!generated.ok)
            throw new Error("Plan generation failed");
        const result = await (0, engineAdapter_1.renderWeekExplanationForApp)(generated.data.plan, generated.data.plan.weeks[0].weekIndex, {
            client: fakeClient("{\"bad\":true}"),
            model: "gpt-test",
        });
        strict_1.default.equal(result.ok, true, "Week explanation adapter should still return stable shape on fallback");
        if (result.ok) {
            strict_1.default.equal(result.data.source, "fallback");
            strict_1.default.equal(result.data.fallbackReason, "invalid_output");
            strict_1.default.equal(result.data.payloadKind, "week_summary");
            strict_1.default.equal(result.data.meta.status, "fallback");
        }
    }
    {
        const generated = (0, engineAdapter_1.generatePlanForApp)(beginnerInput);
        if (!generated.ok)
            throw new Error("Plan generation failed");
        const cutbackWeek = generated.data.plan.weeks.find((week) => week.isCutback);
        strict_1.default.ok(cutbackWeek, "Expected cutback week");
        const adaptivePass = (0, runAdaptivePass_1.runVNextAdaptivePass)(generated.data.plan, {
            targetWeekIndex: cutbackWeek.weekIndex,
            sessionsCompleted: Math.max(1, cutbackWeek.sessions.length - 1),
            sessionsPlanned: cutbackWeek.sessions.length,
            fatigue: "high",
            painFlag: false,
            confidence: "normal",
        });
        const frozenAdaptivePass = JSON.stringify(adaptivePass);
        const result = await (0, engineAdapter_1.renderAdaptationExplanationForApp)(adaptivePass, {
            client: fakeClient(JSON.stringify({
                title: "Recovery adjustment",
                summary: "The adapter explains the local recovery change without altering plan logic.",
                bullets: ["The decision remains deterministic.", "Fallback would be surfaced clearly if needed."],
                tone: "calm",
            })),
            model: "gpt-test",
        });
        strict_1.default.equal(result.ok, true, "Adaptation explanation adapter should return stable success shape");
        if (result.ok) {
            strict_1.default.equal(result.data.payloadKind, "adaptation_summary");
            strict_1.default.equal(result.data.explanation.tone, "calm");
            strict_1.default.equal(typeof result.data.meta.debug.explanationFallback, "boolean");
        }
        strict_1.default.equal(JSON.stringify(adaptivePass), frozenAdaptivePass, "Explanation adapter should not mutate adaptive pass results");
    }
    {
        const benchmark = (0, benchmark_1.evaluateBenchmarkRunner)(benchmark_1.referenceRunnerBenchmarks[0]);
        strict_1.default.ok(benchmark.summaryScore >= 0, "Benchmark flow should still run after app adapter addition");
    }
    console.log("engine-vnext app adapter tests passed");
}
void main();
