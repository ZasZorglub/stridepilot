"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const benchmark_1 = require("../src/lib/engine-v2/benchmark");
const engineAdapter_1 = require("../src/lib/engine-vnext/app/engineAdapter");
const routeHandlers_1 = require("../src/lib/engine-vnext/app/routeHandlers");
const vnextPlanRepository_1 = require("../src/lib/engine-vnext/persistence/vnextPlanRepository");
const runnerProfile = {
    heightCm: 175,
    weightKg: 72,
    age: 36,
    activityLevel: "lav",
    runningExperience: "nybegynder",
    currentRunningAbility: "ti_femten_min",
    currentWeeklyVolumeKm: 12,
    currentRunsPerWeek: 3,
    longestCurrentRunMin: 22,
    typicalWorkoutMinutes: 40,
    preferredGuidance: "flexible",
};
const goal = {
    distance: "5K",
    goalType: "complete",
    weeks: 10,
    startDate: "2026-03-23",
    endDate: "2026-06-01",
    availableTrainingDays: ["Tirsdag", "Torsdag", "Sondag"],
    preferredLongRunDay: "sunday",
};
const body = {
    engineVersion: "vnext",
    profileId: "profile_read_test",
    runnerProfile,
    goal,
};
async function main() {
    const repository = new vnextPlanRepository_1.InMemoryVNextPlanRepository();
    const generated = await (0, routeHandlers_1.handleVNextPlanGenerationRequest)(body, {
        persist: true,
        userId: "user_read_test",
        repository,
    });
    strict_1.default.equal(generated.body.ok, true, "Persisted vNext plan should be created for read-path test");
    if (!generated.body.ok)
        throw new Error("Generation failed");
    const persistedPlanId = generated.body.data.persistence.persistedPlanId;
    strict_1.default.ok(persistedPlanId, "Generated plan should expose persistedPlanId");
    const readInitial = await (0, engineAdapter_1.getPersistedPlanForApp)(persistedPlanId, "user_read_test", repository);
    strict_1.default.equal(readInitial.ok, true, "Persisted plan should be readable");
    if (!readInitial.ok)
        throw new Error("Initial read failed");
    strict_1.default.equal(readInitial.data.currentVersionNumber, 1);
    strict_1.default.equal(readInitial.data.versionMetadata?.versionNumber, 1);
    strict_1.default.equal(Array.isArray(readInitial.data.historySummary), true);
    strict_1.default.equal(readInitial.data.meta.flow, "persisted_plan_read");
    const latestOwnedInitial = await (0, engineAdapter_1.getLatestOwnedVNextPlanForApp)("user_read_test", repository);
    strict_1.default.equal(latestOwnedInitial.ok, true, "Latest owned plan path should work without a persistedPlanId");
    if (!latestOwnedInitial.ok)
        throw new Error("Latest owned read failed");
    strict_1.default.equal(latestOwnedInitial.data.persistedPlanId, persistedPlanId);
    const cutbackWeek = generated.body.data.plan.weeks.find((week) => week.isCutback) ?? generated.body.data.plan.weeks[1];
    const adaptive = await (0, routeHandlers_1.handleVNextAdaptivePassRequest)({
        engineVersion: "vnext",
        persistedPlanId,
        plan: generated.body.data.plan,
        feedback: {
            targetWeekIndex: cutbackWeek.weekIndex,
            sessionsCompleted: 1,
            sessionsPlanned: cutbackWeek.sessions.length,
            fatigue: "moderate",
            painFlag: false,
            confidence: "normal",
        },
    }, {
        persist: true,
        userId: "user_read_test",
        repository,
    });
    strict_1.default.equal(adaptive.body.ok, true, "Adaptive pass should persist for read-path test");
    if (!adaptive.body.ok)
        throw new Error("Adaptive pass failed");
    const readAfterAdaptive = await (0, engineAdapter_1.getPersistedPlanForApp)(persistedPlanId, "user_read_test", repository);
    strict_1.default.equal(readAfterAdaptive.ok, true, "Updated persisted plan should remain readable");
    if (!readAfterAdaptive.ok)
        throw new Error("Post-adaptation read failed");
    strict_1.default.equal(readAfterAdaptive.data.currentVersionNumber, adaptive.body.data.persistence.currentVersionNumber, "Read path should expose the current active version number");
    strict_1.default.equal(readAfterAdaptive.data.historySummary.length >= 1, true, "Read path should expose recent adaptive history summary");
    strict_1.default.equal(readAfterAdaptive.data.meta.debug.persistedPlanId, persistedPlanId);
    const latestOwnedAfterAdaptive = await (0, engineAdapter_1.getLatestOwnedVNextPlanForApp)("user_read_test", repository);
    strict_1.default.equal(latestOwnedAfterAdaptive.ok, true, "Latest owned read should still work after adaptation");
    if (!latestOwnedAfterAdaptive.ok)
        throw new Error("Latest owned read after adaptation failed");
    strict_1.default.equal(latestOwnedAfterAdaptive.data.currentVersionNumber, readAfterAdaptive.data.currentVersionNumber);
    const notFound = await (0, engineAdapter_1.getPersistedPlanForApp)("missing_plan_id", "user_read_test", repository);
    strict_1.default.equal(notFound.ok, false, "Missing persisted plan should be machine-readable");
    if (!notFound.ok) {
        strict_1.default.equal(notFound.error.code, "persisted_plan_not_found");
    }
    const foreignRead = await (0, engineAdapter_1.getPersistedPlanForApp)(persistedPlanId, "other_user", repository);
    strict_1.default.equal(foreignRead.ok, false, "Non-owner should not read another user's persisted vNext plan");
    if (!foreignRead.ok) {
        strict_1.default.equal(foreignRead.error.code, "persisted_plan_not_found");
    }
    const noCurrentPlan = await (0, engineAdapter_1.getLatestOwnedVNextPlanForApp)("no_plan_user", repository);
    strict_1.default.equal(noCurrentPlan.ok, false, "No-plan latest read should be machine-readable");
    if (!noCurrentPlan.ok) {
        strict_1.default.equal(noCurrentPlan.error.code, "vnext_current_plan_not_found");
    }
    const benchmark = (0, benchmark_1.evaluateBenchmarkRunner)(benchmark_1.referenceRunnerBenchmarks[0]);
    strict_1.default.ok(benchmark.summaryScore >= 0, "Benchmark flow should still run after vNext persisted read support");
    console.log("engine-vnext persistence read tests passed");
}
void main();
