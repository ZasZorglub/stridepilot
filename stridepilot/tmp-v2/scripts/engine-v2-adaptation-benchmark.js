"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const engine_v2_1 = require("../src/lib/engine-v2");
function pctDelta(next, base) {
    if (base === 0)
        return 0;
    return (next - base) / base;
}
function roundPct(value) {
    return `${Math.round(value * 100)}%`;
}
function buildFeedback(plan, overrides) {
    const sessions = plan.weeks.flatMap((week) => week.sessions.map((session) => ({
        weekIndex: week.weekIndex,
        sessionFamily: session.family,
    })));
    return overrides.map((override, index) => {
        const session = sessions[index] ?? sessions.at(-1) ?? { weekIndex: 1, sessionFamily: "easy_run" };
        const completed = override.completed ?? true;
        const effort = override.effort ?? 3;
        const energy = override.energy ?? 3;
        const pain = override.pain ?? 0;
        return {
            weekIndex: override.weekIndex ?? session.weekIndex,
            sessionFamily: override.sessionFamily ?? session.sessionFamily,
            completed,
            completionPct: override.completionPct ?? (completed ? 100 : 0),
            effort,
            rpe: override.rpe,
            perceivedDifficulty: override.perceivedDifficulty ??
                (effort <= 2 ? "too_easy" : effort >= 5 ? "too_hard" : effort >= 4 ? "hard" : "appropriate"),
            energy,
            pain,
            comment: override.comment ?? "",
            workoutDuration: override.workoutDuration,
            plannedDuration: override.plannedDuration,
        };
    });
}
function summarizeScenario(plan, feedback) {
    const evaluation = (0, engine_v2_1.evaluateRunnerStatus)(feedback, plan, plan.classification);
    const adapted = (0, engine_v2_1.updatePlanAfterFeedback)(plan, feedback);
    const baseIndex = 1;
    return {
        status: evaluation.status,
        mode: adapted.mode,
        volumeDeltaPct: pctDelta(adapted.updatedCurves.weeklyVolumeCurve[baseIndex] ?? 0, plan.curves.weeklyVolumeCurve[baseIndex] ?? 1),
        longRunDeltaPct: pctDelta(adapted.updatedCurves.longRunCurve[baseIndex] ?? 0, plan.curves.longRunCurve[baseIndex] ?? 1),
        intensityDeltaPct: pctDelta(adapted.updatedCurves.intensityCurve[baseIndex] ?? 0, plan.curves.intensityCurve[baseIndex] ?? 1),
        sessionsDelta: (adapted.updatedCurves.sessionsPerWeekCurve[baseIndex] ?? 0) - (plan.curves.sessionsPerWeekCurve[baseIndex] ?? 0),
    };
}
const baseInput = engine_v2_1.referenceRunnerBenchmarks.find((fixture) => fixture.id === "recreational_10k_improve")?.input ??
    engine_v2_1.referenceRunnerBenchmarks[2].input;
const plan = (0, engine_v2_1.generateEngineV2Plan)(baseInput);
const scenarios = [
    {
        name: "Scenario 1 – Runner progressing well",
        feedback: buildFeedback(plan, [
            { completed: true, effort: 3, energy: 4, pain: 0, completionPct: 100 },
            { completed: true, effort: 3, energy: 4, pain: 0, completionPct: 100 },
            { completed: true, effort: 3, energy: 4, pain: 0, completionPct: 100, sessionFamily: "long_run" },
            { completed: true, effort: 3, energy: 4, pain: 0, completionPct: 100 },
        ]),
        expectedStatus: "progressing_well",
        checks: [
            { label: "volume up", pass: (summary) => summary.volumeDeltaPct >= 0.04 },
            { label: "long run up", pass: (summary) => summary.longRunDeltaPct >= 0.04 },
            { label: "intensity up", pass: (summary) => summary.intensityDeltaPct > 0 },
        ],
    },
    {
        name: "Scenario 2 – Runner struggling",
        feedback: buildFeedback(plan, [
            { completed: true, effort: 5, energy: 2, pain: 0, completionPct: 92, sessionFamily: "intervals" },
            { completed: false, effort: 5, energy: 2, pain: 0, completionPct: 0 },
            { completed: true, effort: 5, energy: 2, pain: 1, completionPct: 88, sessionFamily: "long_run" },
            { completed: true, effort: 4, energy: 2, pain: 0, completionPct: 90, sessionFamily: "easy_run" },
        ]),
        expectedStatus: "struggling",
        checks: [
            { label: "volume down 10-15%", pass: (summary) => summary.volumeDeltaPct <= -0.08 && summary.volumeDeltaPct >= -0.16 },
            { label: "long run down", pass: (summary) => summary.longRunDeltaPct < 0 },
            { label: "intensity down", pass: (summary) => summary.intensityDeltaPct < -0.1 },
        ],
    },
    {
        name: "Scenario 3 – Overreaching",
        feedback: buildFeedback(plan, [
            { completed: true, effort: 5, energy: 1, pain: 1, completionPct: 78, sessionFamily: "intervals" },
            { completed: false, effort: 5, energy: 1, pain: 1, completionPct: 0 },
            { completed: true, effort: 5, energy: 1, pain: 1, completionPct: 70, sessionFamily: "long_run", comment: "Performance declining" },
            { completed: false, effort: 5, energy: 1, pain: 1, completionPct: 20 },
        ]),
        expectedStatus: "overreaching",
        checks: [
            { label: "volume down 20-30%", pass: (summary) => summary.volumeDeltaPct <= -0.2 && summary.volumeDeltaPct >= -0.3 },
            { label: "long run down", pass: (summary) => summary.longRunDeltaPct <= -0.18 },
            { label: "intensity clearly down", pass: (summary) => summary.intensityDeltaPct <= -0.2 },
        ],
    },
    {
        name: "Scenario 4 – Injury risk",
        feedback: buildFeedback(plan, [
            { completed: true, effort: 4, energy: 2, pain: 2, completionPct: 85, sessionFamily: "intervals" },
            { completed: true, effort: 4, energy: 2, pain: 3, completionPct: 80, sessionFamily: "long_run" },
            { completed: true, effort: 3, energy: 2, pain: 2, completionPct: 90 },
        ]),
        expectedStatus: "injury_risk",
        checks: [
            { label: "volume down 30-40%", pass: (summary) => summary.volumeDeltaPct <= -0.3 && summary.volumeDeltaPct >= -0.4 },
            { label: "long run down strongly", pass: (summary) => summary.longRunDeltaPct <= -0.22 },
            { label: "recovery mode", pass: (summary) => summary.mode === "recovery_week" },
        ],
    },
    {
        name: "Scenario 5 – Undertraining",
        feedback: buildFeedback(plan, [
            { completed: true, effort: 2, energy: 5, pain: 0, completionPct: 100 },
            { completed: true, effort: 2, energy: 5, pain: 0, completionPct: 100 },
            { completed: true, effort: 2, energy: 5, pain: 0, completionPct: 100, sessionFamily: "long_run" },
            { completed: true, effort: 2, energy: 5, pain: 0, completionPct: 100 },
        ]),
        expectedStatus: "undertraining",
        checks: [
            { label: "volume up ~10%", pass: (summary) => summary.volumeDeltaPct >= 0.08 },
            { label: "long run up", pass: (summary) => summary.longRunDeltaPct >= 0.05 },
            { label: "sessions can increase", pass: (summary) => summary.sessionsDelta >= 0 },
        ],
    },
];
let failed = 0;
console.log("StridePilot Adaptation Benchmark v1");
console.log(`basePlan=${plan.planTypeDecision.planType}`);
for (const scenario of scenarios) {
    const summary = summarizeScenario(plan, scenario.feedback);
    const statusPass = summary.status === scenario.expectedStatus;
    const checks = scenario.checks.map((check) => ({ label: check.label, pass: check.pass(summary) }));
    const passed = statusPass && checks.every((check) => check.pass);
    if (!passed)
        failed += 1;
    console.log(`\n=== ${scenario.name} ===`);
    console.log(`status=${summary.status} | expected=${scenario.expectedStatus} | mode=${summary.mode}`);
    console.log(`deltas: volume=${roundPct(summary.volumeDeltaPct)} | long_run=${roundPct(summary.longRunDeltaPct)} | intensity=${roundPct(summary.intensityDeltaPct)} | sessions=${summary.sessionsDelta >= 0 ? "+" : ""}${summary.sessionsDelta}`);
    console.log(`statusCheck=${statusPass ? "pass" : "fail"}`);
    console.log(`checks=${checks.map((check) => `${check.label}:${check.pass ? "pass" : "fail"}`).join(" | ")}`);
}
if (failed > 0) {
    console.error(`\nAdaptation benchmark failed: ${failed} scenario(s) did not meet expectations.`);
    process.exit(1);
}
console.log("\nAdaptation benchmark passed.");
