"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const benchmark_1 = require("../src/lib/engine-v2/benchmark");
const engine_1 = require("../src/lib/engine-v2/engine");
const adaptation_1 = require("../src/lib/engine-v2/engine/adaptation");
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
const returnInput = {
    raceDistance: "5K",
    goalType: "return_to_running",
    startDate: "2026-03-23",
    goalDate: "2026-06-28",
    currentContinuousRunMin: 8,
    currentWeeklyRuns: 2,
    currentWeeklyVolumeKm: 8,
    longestRecentRunMin: 15,
    recentConsistency: 0.42,
    availableTrainingDays: ["tuesday", "thursday", "sunday"],
    typicalAvailableTimeMin: 35,
    trainingStylePreference: "conservative",
    experienceLevel: "new",
    injuryConcern: "moderate",
    externalTrainingLoad: "light",
    confidence: 2,
};
function repeatDecision(weekIndex) {
    return {
        action: "repeat_current_week",
        reasonCodes: ["repeat_candidate_available"],
        targetWeekIndex: weekIndex,
        conservativeBias: false,
    };
}
function downshiftDecision(weekIndex, nearestBoundaryWeekIndex, conservativeBias = false) {
    return {
        action: "downshift_next_week",
        reasonCodes: ["low_compliance"],
        targetWeekIndex: weekIndex,
        nearestBoundaryWeekIndex,
        conservativeBias,
    };
}
function recoveryDecision(weekIndex, nearestBoundaryWeekIndex, conservativeBias = false) {
    return {
        action: "insert_recovery_microcycle",
        reasonCodes: ["high_fatigue", "recovery_candidate_available"],
        targetWeekIndex: weekIndex,
        nearestBoundaryWeekIndex,
        conservativeBias,
    };
}
{
    const plan = (0, engine_1.generateEngineV2Plan)(beginnerInput);
    const sourceWeek = plan.weeks.find((week) => week.phase === "build" && !week.isCutback && !week.isRaceWeek && week.adaptationHooks?.safeReplanBoundaryAfter);
    strict_1.default.ok(sourceWeek, "Expected a normal week that can be repeated");
    const result = (0, adaptation_1.applyVNextAdaptationDecision)(plan, repeatDecision(sourceWeek.weekIndex));
    strict_1.default.equal(result.mutation.applied, true, "Normal non-endgame week should be repeatable");
    strict_1.default.equal(result.mutation.mutationType, "repeat_current_week");
    strict_1.default.equal(result.mutation.sourceWeekIndex, sourceWeek.weekIndex);
    strict_1.default.equal(result.mutation.targetWeekIndex, sourceWeek.weekIndex + 1);
    strict_1.default.equal(result.plan.weeks[sourceWeek.weekIndex].volumeTargetMin, sourceWeek.volumeTargetMin, "Next week should inherit repeated load");
}
{
    const plan = (0, engine_1.generateEngineV2Plan)(beginnerInput);
    const sourceWeek = plan.weeks.find((week) => week.phase === "build" && !week.isRaceWeek);
    strict_1.default.ok(sourceWeek, "Expected a normal source week for downshift");
    const originalTarget = plan.weeks.find((week) => week.weekIndex === sourceWeek.weekIndex + 1);
    strict_1.default.ok(originalTarget, "Expected a next week to downshift");
    const result = (0, adaptation_1.applyVNextAdaptationDecision)(plan, downshiftDecision(sourceWeek.weekIndex));
    strict_1.default.equal(result.mutation.applied, true, "Normal non-endgame week should be downshiftable");
    strict_1.default.equal(result.mutation.mutationType, "downshift_next_week");
    strict_1.default.equal(result.plan.weeks[originalTarget.weekIndex - 1].volumeTargetMin < originalTarget.volumeTargetMin, true, "Downshift should reduce weekly load");
}
{
    const plan = (0, engine_1.generateEngineV2Plan)(beginnerInput);
    const sourceWeek = plan.weeks.find((week) => week.phase === "build" && !week.isRaceWeek);
    strict_1.default.ok(sourceWeek, "Expected source week for quality downshift");
    const targetWeek = plan.weeks.find((week) => week.weekIndex === sourceWeek.weekIndex + 1);
    strict_1.default.ok(targetWeek, "Expected target week");
    const beforeQualityCount = targetWeek.sessions.filter((session) => session.role === "quality").length;
    const result = (0, adaptation_1.applyVNextAdaptationDecision)(plan, downshiftDecision(sourceWeek.weekIndex));
    const afterWeek = result.plan.weeks[targetWeek.weekIndex - 1];
    const afterQualityCount = afterWeek.sessions.filter((session) => session.role === "quality").length;
    strict_1.default.ok(afterQualityCount <= beforeQualityCount, "Downshift should reduce or remove quality");
}
{
    const plan = (0, engine_1.generateEngineV2Plan)(beginnerInput);
    const sourceWeek = plan.weeks.find((week) => week.phase === "build" && !week.isRaceWeek);
    strict_1.default.ok(sourceWeek, "Expected source week for recovery microcycle");
    const targetWeek = plan.weeks.find((week) => week.weekIndex === sourceWeek.weekIndex + 1);
    strict_1.default.ok(targetWeek, "Expected target week for recovery microcycle");
    const result = (0, adaptation_1.applyVNextAdaptationDecision)(plan, recoveryDecision(sourceWeek.weekIndex));
    strict_1.default.equal(result.mutation.applied, true, "Normal non-endgame week should support a recovery microcycle");
    strict_1.default.equal(result.mutation.mutationType, "insert_recovery_microcycle");
    strict_1.default.ok(result.plan.weeks[targetWeek.weekIndex - 1].volumeTargetMin < targetWeek.volumeTargetMin, "Recovery microcycle should reduce weekly load");
}
{
    const plan = (0, engine_1.generateEngineV2Plan)(beginnerInput);
    const sourceWeek = plan.weeks.find((week) => week.phase === "build" && !week.isRaceWeek);
    strict_1.default.ok(sourceWeek, "Expected source week for recovery-vs-downshift comparison");
    const targetWeek = plan.weeks.find((week) => week.weekIndex === sourceWeek.weekIndex + 1);
    strict_1.default.ok(targetWeek, "Expected target week");
    const downshift = (0, adaptation_1.applyVNextAdaptationDecision)(plan, downshiftDecision(sourceWeek.weekIndex));
    const recovery = (0, adaptation_1.applyVNextAdaptationDecision)(plan, recoveryDecision(sourceWeek.weekIndex));
    strict_1.default.ok(recovery.plan.weeks[targetWeek.weekIndex - 1].volumeTargetMin < downshift.plan.weeks[targetWeek.weekIndex - 1].volumeTargetMin, "Recovery microcycle should be more conservative than a normal downshift");
}
{
    const plan = (0, engine_1.generateEngineV2Plan)(beginnerInput);
    const sourceWeek = plan.weeks.find((week) => week.phase === "build" && !week.isRaceWeek);
    strict_1.default.ok(sourceWeek, "Expected source week for recovery quality reduction");
    const targetWeek = plan.weeks.find((week) => week.weekIndex === sourceWeek.weekIndex + 1);
    strict_1.default.ok(targetWeek, "Expected target week");
    const result = (0, adaptation_1.applyVNextAdaptationDecision)(plan, recoveryDecision(sourceWeek.weekIndex));
    const afterWeek = result.plan.weeks[targetWeek.weekIndex - 1];
    strict_1.default.equal(afterWeek.sessions.some((session) => session.role === "quality"), false, "Recovery microcycle should remove quality sessions");
}
{
    const plan = (0, engine_1.generateEngineV2Plan)(beginnerInput);
    const taperWeek = plan.weeks.find((week) => week.phase === "taper");
    strict_1.default.ok(taperWeek, "Expected taper week");
    const result = (0, adaptation_1.applyVNextAdaptationDecision)(plan, repeatDecision(taperWeek.weekIndex));
    strict_1.default.equal(result.mutation.applied, false, "Taper week should not be repeated blindly");
    strict_1.default.equal(result.mutation.mutationType, "noop");
}
{
    const plan = (0, engine_1.generateEngineV2Plan)(beginnerInput);
    const raceWeek = plan.weeks.find((week) => week.isRaceWeek);
    strict_1.default.ok(raceWeek, "Expected race week");
    const result = (0, adaptation_1.applyVNextAdaptationDecision)(plan, repeatDecision(raceWeek.weekIndex));
    strict_1.default.equal(result.mutation.applied, false, "Race week should not be repeated");
    strict_1.default.equal(result.mutation.mutationType, "noop");
}
{
    const plan = (0, engine_1.generateEngineV2Plan)(returnInput);
    const protectedWeek = plan.weeks.find((week) => week.adaptationHooks?.boundaryKinds.includes("protected_hold"));
    strict_1.default.ok(protectedWeek, "Expected protected hold point for return-to-running");
    const result = (0, adaptation_1.applyVNextAdaptationDecision)(plan, repeatDecision(protectedWeek.weekIndex));
    strict_1.default.equal(result.mutation.applied, false, "Protected runner hold points should block repeat mutation");
}
{
    const plan = (0, engine_1.generateEngineV2Plan)(returnInput);
    const sourceWeek = plan.weeks.find((week) => (week.phase === "base" || week.phase === "build") &&
        !week.adaptationHooks?.boundaryKinds.includes("protected_hold"));
    strict_1.default.ok(sourceWeek, "Expected source week for protected downshift");
    const targetWeek = plan.weeks.find((week) => week.weekIndex === sourceWeek.weekIndex + 1 && !week.isRaceWeek && week.phase !== "taper");
    strict_1.default.ok(targetWeek, "Expected target week for protected downshift");
    const result = (0, adaptation_1.applyVNextAdaptationDecision)(plan, downshiftDecision(sourceWeek.weekIndex, undefined, true));
    strict_1.default.equal(result.mutation.applied, true, "Protected runner should still allow conservative downshift when local mutation is safe");
    strict_1.default.equal(result.mutation.conservativeBiasApplied, true, "Mutation metadata should expose protected-runner downshift bias");
    strict_1.default.ok(result.plan.weeks[targetWeek.weekIndex - 1].volumeTargetMin <= Math.round(targetWeek.volumeTargetMin * 0.82), "Protected downshift should cut load more aggressively");
}
{
    const plan = (0, engine_1.generateEngineV2Plan)(returnInput);
    const sourceWeek = plan.weeks.find((week) => (week.phase === "base" || week.phase === "build") &&
        !week.adaptationHooks?.boundaryKinds.includes("protected_hold"));
    strict_1.default.ok(sourceWeek, "Expected source week for protected recovery microcycle");
    const downshift = (0, adaptation_1.applyVNextAdaptationDecision)(plan, downshiftDecision(sourceWeek.weekIndex, undefined, true));
    const recovery = (0, adaptation_1.applyVNextAdaptationDecision)(plan, recoveryDecision(sourceWeek.weekIndex, undefined, true));
    strict_1.default.equal(recovery.mutation.applied, true, "Protected runner should allow conservative recovery microcycle when local mutation is safe");
    strict_1.default.equal(downshift.mutation.applied, true, "Protected runner should allow conservative downshift for comparison");
    strict_1.default.ok(downshift.mutation.targetWeekIndex, "Downshift should expose a target week");
    strict_1.default.ok(recovery.mutation.targetWeekIndex, "Recovery should expose a target week");
    const downshiftOriginalWeek = plan.weeks[downshift.mutation.targetWeekIndex - 1];
    const recoveryOriginalWeek = plan.weeks[recovery.mutation.targetWeekIndex - 1];
    const downshiftMutatedWeek = downshift.plan.weeks[downshift.mutation.targetWeekIndex - 1];
    const recoveryMutatedWeek = recovery.plan.weeks[recovery.mutation.targetWeekIndex - 1];
    const downshiftReductionRatio = downshiftMutatedWeek.volumeTargetMin / downshiftOriginalWeek.volumeTargetMin;
    const recoveryReductionRatio = recoveryMutatedWeek.volumeTargetMin / recoveryOriginalWeek.volumeTargetMin;
    strict_1.default.ok(recoveryReductionRatio <= downshiftReductionRatio, "Protected recovery microcycle should be at least as conservative as protected downshift");
}
{
    const plan = (0, engine_1.generateEngineV2Plan)(beginnerInput);
    const decision = (0, adaptation_1.decideVNextAdaptation)(plan, {
        targetWeekIndex: 4,
        sessionsCompleted: 1,
        sessionsPlanned: 3,
        fatigue: "moderate",
        painFlag: false,
        confidence: "normal",
    });
    const result = (0, adaptation_1.applyVNextAdaptationDecision)(plan, decision);
    strict_1.default.equal(typeof result.mutation.reason, "string", "Mutation metadata should be machine-readable");
    strict_1.default.equal(typeof result.mutation.fallback, "boolean", "Mutation metadata should expose fallback/no-op");
}
{
    const plan = (0, engine_1.generateEngineV2Plan)(beginnerInput);
    const taperSource = plan.weeks.find((week) => week.phase === "build" && plan.weeks.some((candidate) => candidate.weekIndex === week.weekIndex + 1 && candidate.phase === "taper"));
    if (taperSource) {
        const result = (0, adaptation_1.applyVNextAdaptationDecision)(plan, downshiftDecision(taperSource.weekIndex));
        strict_1.default.equal(result.mutation.applied, false, "Downshift should not mutate into taper week");
        strict_1.default.equal(result.mutation.mutationType, "noop");
    }
    const raceSource = plan.weeks.find((week) => week.phase === "taper" && plan.weeks.some((candidate) => candidate.weekIndex === week.weekIndex + 1 && candidate.isRaceWeek));
    if (raceSource) {
        const result = (0, adaptation_1.applyVNextAdaptationDecision)(plan, downshiftDecision(raceSource.weekIndex));
        strict_1.default.equal(result.mutation.applied, false, "Downshift should not mutate into race week");
    }
    if (taperSource) {
        const result = (0, adaptation_1.applyVNextAdaptationDecision)(plan, recoveryDecision(taperSource.weekIndex));
        strict_1.default.equal(result.mutation.applied, false, "Recovery microcycle should not mutate into taper week");
    }
    if (raceSource) {
        const result = (0, adaptation_1.applyVNextAdaptationDecision)(plan, recoveryDecision(raceSource.weekIndex));
        strict_1.default.equal(result.mutation.applied, false, "Recovery microcycle should not mutate into race week");
    }
}
{
    const plan = (0, engine_1.generateEngineV2Plan)(beginnerInput);
    const sourceWeek = plan.weeks.find((week) => week.phase === "build" && !week.isCutback && !week.isRaceWeek && week.adaptationHooks?.safeReplanBoundaryAfter);
    strict_1.default.ok(sourceWeek, "Expected repeatable source week");
    const result = (0, adaptation_1.applyVNextAdaptationDecision)(plan, repeatDecision(sourceWeek.weekIndex));
    strict_1.default.ok(result.plan.vNextValidation, "Validator should still run on mutated plan");
    strict_1.default.equal((result.plan.vNextValidation?.hardFailCount ?? 0) === 0, true, "Repeated-week plan should not introduce hard fails");
    const benchmark = (0, benchmark_1.evaluateBenchmarkRunner)(benchmark_1.referenceRunnerBenchmarks[0]);
    strict_1.default.ok(benchmark.summaryScore >= 0, "Benchmark flow should still run after mutation support is added");
}
{
    const plan = (0, engine_1.generateEngineV2Plan)(beginnerInput);
    const sourceWeek = plan.weeks.find((week) => week.phase === "build" && !week.isRaceWeek);
    strict_1.default.ok(sourceWeek, "Expected source week for validator-backed downshift");
    const result = (0, adaptation_1.applyVNextAdaptationDecision)(plan, downshiftDecision(sourceWeek.weekIndex));
    strict_1.default.ok(result.plan.vNextValidation, "Validator should still run on downshifted plan");
    strict_1.default.equal((result.plan.vNextValidation?.hardFailCount ?? 0) === 0, true, "Downshifted plan should not introduce hard fails");
}
{
    const plan = (0, engine_1.generateEngineV2Plan)(beginnerInput);
    const sourceWeek = plan.weeks.find((week) => week.phase === "build" && !week.isRaceWeek);
    strict_1.default.ok(sourceWeek, "Expected source week for validator-backed recovery mutation");
    const result = (0, adaptation_1.applyVNextAdaptationDecision)(plan, recoveryDecision(sourceWeek.weekIndex));
    strict_1.default.ok(result.plan.vNextValidation, "Validator should still run on recovery-mutated plan");
    strict_1.default.equal((result.plan.vNextValidation?.hardFailCount ?? 0) === 0, true, "Recovery-mutated plan should not introduce hard fails");
    strict_1.default.equal(typeof result.mutation.recoveryCandidateUsed, "boolean", "Recovery mutation metadata should expose whether a recovery candidate was used");
}
console.log("engine-vnext repeat mutation tests passed");
