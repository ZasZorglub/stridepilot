"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const vnextPlanRepository_1 = require("../src/lib/engine-vnext/persistence/vnextPlanRepository");
const routeHandlers_1 = require("../src/lib/engine-vnext/app/routeHandlers");
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
const beginnerInputBody = {
    engineVersion: "vnext",
    profileId: "profile_persist_test",
    runnerProfile,
    goal,
};
async function main() {
    const repository = new vnextPlanRepository_1.InMemoryVNextPlanRepository();
    const generated = await (0, routeHandlers_1.handleVNextPlanGenerationRequest)(beginnerInputBody, {
        persist: true,
        userId: "user_persist_test",
        repository,
    });
    strict_1.default.equal(generated.body.ok, true, "Generated vNext plan should persist successfully");
    if (!generated.body.ok)
        throw new Error("Plan generation failed");
    strict_1.default.equal(generated.body.data.persistence.saved, true);
    strict_1.default.equal(generated.body.data.persistence.currentVersionNumber, 1);
    strict_1.default.ok(generated.body.data.persistence.persistedPlanId);
    const persistedAfterGenerate = await repository.getPlanState(generated.body.data.persistence.persistedPlanId);
    strict_1.default.ok(persistedAfterGenerate, "Persisted plan should be queryable after generation");
    strict_1.default.equal(persistedAfterGenerate?.currentVersionNumber, 1);
    const cutbackWeek = generated.body.data.plan.weeks.find((week) => week.isCutback) ?? generated.body.data.plan.weeks[1];
    const appliedAdaptive = await (0, routeHandlers_1.handleVNextAdaptivePassRequest)({
        engineVersion: "vnext",
        persistedPlanId: generated.body.data.persistence.persistedPlanId,
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
        userId: "user_persist_test",
        repository,
    });
    strict_1.default.equal(appliedAdaptive.body.ok, true, "Adaptive mutation should persist successfully");
    if (!appliedAdaptive.body.ok)
        throw new Error("Adaptive mutation failed");
    strict_1.default.equal(appliedAdaptive.body.data.persistence.saved, true);
    strict_1.default.ok((appliedAdaptive.body.data.persistence.currentVersionNumber ?? 0) >= 1);
    const persistedAfterAdaptive = await repository.getPlanState(generated.body.data.persistence.persistedPlanId);
    strict_1.default.ok(persistedAfterAdaptive, "Persisted plan should still be queryable after adaptation");
    strict_1.default.equal(persistedAfterAdaptive?.latestHistoryEntryId, appliedAdaptive.body.data.historyEntry.entryId, "Applied adaptive pass should persist the latest history entry");
    const foreignAdaptive = await (0, routeHandlers_1.handleVNextAdaptivePassRequest)({
        engineVersion: "vnext",
        persistedPlanId: generated.body.data.persistence.persistedPlanId,
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
        userId: "other_user",
        repository,
    });
    strict_1.default.equal(foreignAdaptive.body.ok, false, "Non-owner should not mutate another user's persisted vNext plan");
    if (!foreignAdaptive.body.ok) {
        strict_1.default.equal(foreignAdaptive.body.error.code, "persisted_plan_not_found");
    }
    const noOpAdaptive = await (0, routeHandlers_1.handleVNextAdaptivePassRequest)({
        engineVersion: "vnext",
        persistedPlanId: generated.body.data.persistence.persistedPlanId,
        plan: generated.body.data.plan,
        feedback: {
            targetWeekIndex: generated.body.data.plan.weeks.at(-1)?.weekIndex ?? generated.body.data.plan.weeks.length,
            sessionsCompleted: generated.body.data.plan.weeks.at(-1)?.sessions.length ?? 1,
            sessionsPlanned: generated.body.data.plan.weeks.at(-1)?.sessions.length ?? 1,
            fatigue: "low",
            painFlag: false,
            confidence: "high",
        },
    }, {
        persist: true,
        userId: "user_persist_test",
        repository,
    });
    strict_1.default.equal(noOpAdaptive.body.ok, true, "No-op adaptive pass should still persist history");
    if (!noOpAdaptive.body.ok)
        throw new Error("No-op adaptive pass failed");
    strict_1.default.equal(noOpAdaptive.body.data.persistence.saved, true);
    strict_1.default.equal(typeof noOpAdaptive.body.data.historyEntry.entryId, "string");
    const unauthorizedGenerate = await (0, routeHandlers_1.handleVNextPlanGenerationRequest)(beginnerInputBody, {
        persist: true,
        repository,
    });
    strict_1.default.equal(unauthorizedGenerate.body.ok, false, "Persisted generation should require authentication");
    if (!unauthorizedGenerate.body.ok) {
        strict_1.default.equal(unauthorizedGenerate.body.error.code, "unauthorized");
    }
    console.log("engine-vnext persistence tests passed");
}
void main();
