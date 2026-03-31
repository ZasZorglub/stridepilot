"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const routeHandlers_1 = require("../src/lib/engine-vnext/app/routeHandlers");
const vnextPlanRepository_1 = require("../src/lib/engine-vnext/persistence/vnextPlanRepository");
const runnerProfile = {
    heightCm: 176,
    weightKg: 73,
    age: 34,
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
async function main() {
    const repository = new vnextPlanRepository_1.InMemoryVNextPlanRepository();
    const userId = "user_beta_smoke";
    const generated = await (0, routeHandlers_1.handleVNextPlanGenerationRequest)({
        engineVersion: "vnext",
        runnerProfile,
        goal,
        profileId: "profile_beta_smoke",
    }, {
        persist: true,
        userId,
        repository,
    });
    strict_1.default.equal(generated.status, 200, "generate should succeed");
    strict_1.default.equal(generated.body.ok, true, "generate should return stable success shape");
    if (!generated.body.ok)
        throw new Error("Generate failed");
    strict_1.default.equal(generated.body.data.meta.flow, "plan_generation");
    strict_1.default.equal(generated.body.data.persistence.saved, true);
    const firstRead = await (0, routeHandlers_1.handleVNextCurrentPlanReadRequest)({}, {
        userId,
        repository,
    });
    strict_1.default.equal(firstRead.status, 200, "latest-owned read should succeed after generation");
    strict_1.default.equal(firstRead.body.ok, true);
    if (!firstRead.body.ok)
        throw new Error("First read failed");
    strict_1.default.equal(firstRead.body.data.currentVersionNumber, 1);
    strict_1.default.equal(firstRead.body.data.historySummary.length, 0);
    const cutbackWeek = firstRead.body.data.plan.weeks.find((week) => week.isCutback) ?? firstRead.body.data.plan.weeks[1];
    const adaptive = await (0, routeHandlers_1.handleVNextAdaptivePassRequest)({
        engineVersion: "vnext",
        persistedPlanId: firstRead.body.data.persistedPlanId,
        plan: firstRead.body.data.plan,
        feedback: {
            targetWeekIndex: cutbackWeek.weekIndex,
            sessionsCompleted: Math.max(1, cutbackWeek.sessions.length - 1),
            sessionsPlanned: cutbackWeek.sessions.length,
            fatigue: "moderate",
            painFlag: false,
            confidence: "normal",
        },
    }, {
        persist: true,
        userId,
        repository,
    });
    strict_1.default.equal(adaptive.status, 200, "adaptive pass should succeed");
    strict_1.default.equal(adaptive.body.ok, true, "adaptive pass should return stable success shape");
    if (!adaptive.body.ok)
        throw new Error("Adaptive pass failed");
    strict_1.default.equal(adaptive.body.data.meta.flow, "adaptive_pass");
    strict_1.default.equal(adaptive.body.data.persistence.saved, true);
    strict_1.default.equal(typeof adaptive.body.data.historyEntry.entryId, "string");
    const secondRead = await (0, routeHandlers_1.handleVNextCurrentPlanReadRequest)({}, {
        userId,
        repository,
    });
    strict_1.default.equal(secondRead.status, 200, "latest-owned read should still succeed after adaptation");
    strict_1.default.equal(secondRead.body.ok, true);
    if (!secondRead.body.ok)
        throw new Error("Second read failed");
    strict_1.default.equal(secondRead.body.data.persistedPlanId, firstRead.body.data.persistedPlanId);
    strict_1.default.equal(secondRead.body.data.meta.flow, "persisted_plan_read");
    strict_1.default.equal(secondRead.body.data.currentVersionNumber, adaptive.body.data.persistence.currentVersionNumber, "current version should reflect the persisted adaptive result");
    strict_1.default.equal(secondRead.body.data.historySummary[0]?.entryId, adaptive.body.data.historyEntry.entryId, "recent history summary should include the adaptive pass result");
    strict_1.default.equal(typeof secondRead.body.data.meta.debug.currentVersionNumber, "number");
    console.log("engine-vnext beta smoke tests passed");
}
void main();
