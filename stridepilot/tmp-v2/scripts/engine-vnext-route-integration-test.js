"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const benchmark_1 = require("../src/lib/engine-v2/benchmark");
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
async function main() {
    const repository = new vnextPlanRepository_1.InMemoryVNextPlanRepository();
    {
        const result = await (0, routeHandlers_1.handleVNextPlanGenerationRequest)({
            engineVersion: "vnext",
            runnerProfile,
            goal,
            profileId: "profile_route_test",
        }, {
            persist: true,
            userId: "user_route_test",
            repository,
        });
        strict_1.default.equal(result.status, 200, "Plan route/controller should return success status for vNext generation");
        strict_1.default.equal(result.body.ok, true, "Plan route/controller should use stable adapter response shape");
        if (result.body.ok) {
            strict_1.default.equal(typeof result.body.data.validation.passed, "boolean");
            strict_1.default.equal(result.body.data.version?.versionNumber, 1);
            strict_1.default.equal(typeof result.body.data.status.adaptationReady, "boolean");
            strict_1.default.equal(result.body.data.persistence.saved, true);
            strict_1.default.equal(typeof result.body.data.persistence.persistedPlanId, "string");
            strict_1.default.equal(result.body.data.meta.flow, "plan_generation");
        }
    }
    {
        const result = await (0, routeHandlers_1.handleVNextPlanGenerationRequest)({
            engineVersion: "vnext",
            goal,
        });
        strict_1.default.equal(result.status, 400, "Missing runner profile should be a machine-readable bad request");
        strict_1.default.equal(result.body.ok, false);
        if (!result.body.ok) {
            strict_1.default.equal(result.body.error.code, "bad_request");
        }
    }
    {
        const generated = await (0, routeHandlers_1.handleVNextPlanGenerationRequest)({
            engineVersion: "vnext",
            runnerProfile,
            goal,
            profileId: "profile_route_test_adapt",
        }, {
            persist: true,
            userId: "user_route_test_adapt",
            repository,
        });
        strict_1.default.equal(generated.body.ok, true, "Expected plan generation success before adaptive route test");
        if (!generated.body.ok)
            throw new Error("Plan generation failed");
        const cutbackWeek = generated.body.data.plan.weeks.find((week) => week.isCutback) ?? generated.body.data.plan.weeks[1];
        const adaptive = await (0, routeHandlers_1.handleVNextAdaptivePassRequest)({
            engineVersion: "vnext",
            persistedPlanId: generated.body.data.persistence.persistedPlanId,
            plan: generated.body.data.plan,
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
            userId: "user_route_test_adapt",
            repository,
        });
        strict_1.default.equal(adaptive.status, 200, "Adaptive route/controller should return success status for vNext adaptive pass");
        strict_1.default.equal(adaptive.body.ok, true, "Adaptive route/controller should use stable adapter response shape");
        if (adaptive.body.ok) {
            strict_1.default.equal(typeof adaptive.body.data.status.applied, "boolean");
            strict_1.default.equal(typeof adaptive.body.data.validation.passed, "boolean");
            strict_1.default.equal(typeof adaptive.body.data.historyEntry.entryId, "string");
            strict_1.default.equal(adaptive.body.data.persistence.saved, true);
            strict_1.default.equal(adaptive.body.data.meta.flow, "adaptive_pass");
        }
    }
    {
        const generated = await (0, routeHandlers_1.handleVNextPlanGenerationRequest)({
            engineVersion: "vnext",
            runnerProfile,
            goal,
            profileId: "profile_route_test_read",
        }, {
            persist: true,
            userId: "user_route_test_read",
            repository,
        });
        if (!generated.body.ok)
            throw new Error("Plan generation failed for current-read route test");
        const currentRead = await (0, routeHandlers_1.handleVNextCurrentPlanReadRequest)({}, {
            userId: "user_route_test_read",
            repository,
        });
        strict_1.default.equal(currentRead.status, 200, "Current-plan route should support latest owned vNext read without persistedPlanId");
        strict_1.default.equal(currentRead.body.ok, true);
        if (currentRead.body.ok) {
            strict_1.default.equal(currentRead.body.data.persistedPlanId, generated.body.data.persistence.persistedPlanId);
            strict_1.default.equal(currentRead.body.data.meta.flow, "persisted_plan_read");
        }
    }
    {
        const adaptive = await (0, routeHandlers_1.handleVNextAdaptivePassRequest)({
            engineVersion: "vnext",
            feedback: {
                targetWeekIndex: 2,
                sessionsCompleted: 1,
                sessionsPlanned: 3,
                fatigue: "high",
                painFlag: true,
                confidence: "low",
            },
        });
        strict_1.default.equal(adaptive.status, 400, "Missing plan should preserve machine-readable error path");
        strict_1.default.equal(adaptive.body.ok, false);
        if (!adaptive.body.ok) {
            strict_1.default.equal(adaptive.body.error.code, "bad_request");
        }
    }
    {
        const benchmark = (0, benchmark_1.evaluateBenchmarkRunner)(benchmark_1.referenceRunnerBenchmarks[0]);
        strict_1.default.ok(benchmark.summaryScore >= 0, "Benchmark flow should still run after route/controller adapter wiring");
    }
    console.log("engine-vnext route integration tests passed");
}
void main();
