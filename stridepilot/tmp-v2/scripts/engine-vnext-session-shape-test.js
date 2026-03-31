"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const mapToAppPlan_1 = require("../src/lib/coach/mapToAppPlan");
const plan_1 = require("../src/lib/plan");
function countAdjacentIdenticalRunBlocks(session) {
    let count = 0;
    for (let index = 1; index < session.steps.length; index += 1) {
        const previous = session.steps[index - 1];
        const current = session.steps[index];
        if (previous.type === "run" && current.type === "run" && previous.cue === current.cue) {
            count += 1;
        }
    }
    return count;
}
{
    const merged = (0, mapToAppPlan_1.expandStructure)([
        { type: "recovery", label: "Let jog opvarmning", durationMin: 6 },
        { type: "steady", label: "Lang rolig blok", durationMin: 28 },
        { type: "recovery", label: "Let jog ned", durationMin: 3 },
        { type: "walk", label: "Rolig afslutning", durationMin: 2 },
    ]);
    strict_1.default.deepEqual(merged.map((step) => [step.type, step.durationSec]), [
        ["warmup", 6 * 60],
        ["run", 28 * 60],
        ["cooldown", 3 * 60],
        ["walk", 2 * 60],
    ], "continuous runs should not be split into consecutive run blocks just because warmup/cooldown jogs are present");
}
{
    const runWalk = (0, mapToAppPlan_1.expandStructure)([
        { type: "walk", label: "Rask gang opvarmning", durationMin: 5 },
        { type: "run", label: "Løb/gang blok", durationMin: 4, repeats: 4, recoverMin: 2 },
        { type: "walk", label: "Rolig gang ned", durationMin: 4 },
    ], "run-walk");
    strict_1.default.ok(runWalk.filter((step) => step.type === "run").every((step) => step.heartRateGuidance?.zoneLabel === "Zone 2"), "beginner and comeback run-walk sessions should keep aerobic zone guidance on the run blocks");
}
{
    const merged = (0, mapToAppPlan_1.expandStructure)([
        { type: "recovery", label: "Let jog opvarmning", durationMin: 7 },
        { type: "run", label: "Interval", durationMin: 4, repeats: 4, recoverMin: 2 },
        { type: "cooldown", label: "Rolig nedkøling", durationMin: 4 },
    ]);
    strict_1.default.equal(merged.filter((step) => step.type === "run").length, 4, "real interval sessions should keep distinct work reps");
    strict_1.default.equal(merged.filter((step) => step.type === "walk").length, 3, "real interval sessions should keep distinct recovery blocks");
    strict_1.default.ok(merged.filter((step) => step.type === "run").every((step) => step.heartRateGuidance?.zoneLabel === "Zone 4"), "real interval sessions should preserve stronger guidance where the workout semantics are genuinely quality-focused");
}
{
    const merged = (0, mapToAppPlan_1.mergeAdjacentWorkoutSteps)([
        { type: "walk", label: "Rask gang opvarmning", durationSec: 180, cue: "Gå roligt og få vejret tilbage." },
        { type: "run", label: "Roligt løb", durationSec: 1200, cue: "Løb roligt og kontrolleret." },
        { type: "walk", label: "Rolig gang ned", durationSec: 300, cue: "Gå roligt og få vejret tilbage." },
    ]);
    strict_1.default.deepEqual(merged.map((step) => step.type), ["walk", "run", "walk"], "walk/run/walk structures should remain intact when the behavior genuinely changes");
}
const benchmarkProfiles = [
    {
        id: "returning_beginner_2x",
        runnerProfile: {
            firstName: "Nora",
            heightCm: 168,
            weightKg: 66,
            age: 34,
            activityLevel: "lav",
            runningExperience: "nybegynder",
            currentRunningAbility: "fem_min",
            userTrainingContext: "Tilbage efter pause og vil bygge roligt op.",
            currentWeeklyVolumeKm: 6,
            currentRunsPerWeek: 2,
            longestCurrentRunMin: 12,
            recentRaceTimes: [],
            injuryHistory: "Let følsom akillessene tidligere.",
            weakPoints: "",
            realisticTrainingDaysPerWeek: 2,
            typicalWorkoutMinutes: 35,
            otherTraining: "",
            preferredGuidance: "simple",
        },
        goal: {
            distance: "5K",
            goalType: "run_without_walking",
            weeks: 12,
            startDate: "2026-03-31",
            availableTrainingDays: ["Tirsdag", "Lordag"],
        },
    },
    {
        id: "first_5k_3x",
        runnerProfile: {
            firstName: "Maja",
            heightCm: 170,
            weightKg: 64,
            age: 29,
            activityLevel: "moderat",
            runningExperience: "nybegynder",
            currentRunningAbility: "ti_femten_min",
            userTrainingContext: "Vil frem mod min første 5 km.",
            currentWeeklyVolumeKm: 10,
            currentRunsPerWeek: 3,
            longestCurrentRunMin: 18,
            recentRaceTimes: [],
            injuryHistory: "",
            weakPoints: "",
            realisticTrainingDaysPerWeek: 3,
            typicalWorkoutMinutes: 40,
            otherTraining: "Lidt styrke en gang om ugen.",
            preferredGuidance: "simple",
        },
        goal: {
            distance: "5K",
            goalType: "complete",
            weeks: 12,
            startDate: "2026-03-31",
            availableTrainingDays: ["Tirsdag", "Torsdag", "Sondag"],
        },
    },
    {
        id: "novice_10k_3x",
        runnerProfile: {
            firstName: "Jonas",
            heightCm: 181,
            weightKg: 77,
            age: 37,
            activityLevel: "moderat",
            runningExperience: "let_ovet",
            currentRunningAbility: "tyve_tredive_min",
            userTrainingContext: "Vil bygge videre mod 10 km uden at det bliver for hårdt.",
            currentWeeklyVolumeKm: 18,
            currentRunsPerWeek: 3,
            longestCurrentRunMin: 35,
            recentRaceTimes: [],
            injuryHistory: "",
            weakPoints: "",
            realisticTrainingDaysPerWeek: 3,
            typicalWorkoutMinutes: 50,
            otherTraining: "",
            preferredGuidance: "flexible",
        },
        goal: {
            distance: "10K",
            goalType: "complete",
            weeks: 14,
            startDate: "2026-03-31",
            availableTrainingDays: ["Mandag", "Onsdag", "Lordag"],
        },
    },
    {
        id: "intermediate_10k_improve_4x",
        runnerProfile: {
            firstName: "Lars",
            heightCm: 178,
            weightKg: 73,
            age: 41,
            activityLevel: "høj",
            runningExperience: "ovet",
            currentRunningAbility: "mere_end_tredive_min",
            userTrainingContext: "Vil forbedre min 10 km tid på en kontrolleret måde.",
            currentWeeklyVolumeKm: 32,
            currentRunsPerWeek: 4,
            longestCurrentRunMin: 60,
            recentRaceTimes: [{ distance: "10K", time: "48:30" }],
            injuryHistory: "",
            weakPoints: "",
            realisticTrainingDaysPerWeek: 4,
            typicalWorkoutMinutes: 60,
            otherTraining: "Cykler let et par gange om ugen.",
            preferredGuidance: "performance_oriented",
        },
        goal: {
            distance: "10K",
            goalType: "pr",
            weeks: 16,
            startDate: "2026-03-31",
            availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"],
        },
    },
    {
        id: "half_marathon_4x",
        runnerProfile: {
            firstName: "Signe",
            heightCm: 172,
            weightKg: 62,
            age: 33,
            activityLevel: "moderat",
            runningExperience: "ovet",
            currentRunningAbility: "mere_end_tredive_min",
            userTrainingContext: "Vil bygge mod halvmaraton med stabil progression.",
            currentWeeklyVolumeKm: 28,
            currentRunsPerWeek: 4,
            longestCurrentRunMin: 75,
            recentRaceTimes: [{ distance: "10K", time: "52:10" }],
            injuryHistory: "",
            weakPoints: "",
            realisticTrainingDaysPerWeek: 4,
            typicalWorkoutMinutes: 65,
            otherTraining: "",
            preferredGuidance: "flexible",
        },
        goal: {
            distance: "Halvmaraton",
            goalType: "complete",
            weeks: 18,
            startDate: "2026-03-31",
            availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"],
        },
    },
    {
        id: "cautious_comeback_3x",
        runnerProfile: {
            firstName: "Anne",
            heightCm: 167,
            weightKg: 68,
            age: 45,
            activityLevel: "lav",
            runningExperience: "let_ovet",
            currentRunningAbility: "fem_min",
            userTrainingContext: "På vej tilbage og vil have meget rolig progression.",
            currentWeeklyVolumeKm: 8,
            currentRunsPerWeek: 2,
            longestCurrentRunMin: 15,
            recentRaceTimes: [],
            injuryHistory: "Tidligere knæirritation.",
            weakPoints: "Knæet må ikke presses for hurtigt.",
            realisticTrainingDaysPerWeek: 3,
            typicalWorkoutMinutes: 35,
            otherTraining: "Let mobilitet.",
            preferredGuidance: "simple",
        },
        goal: {
            distance: "5K",
            goalType: "run_without_walking",
            weeks: 14,
            startDate: "2026-03-31",
            availableTrainingDays: ["Tirsdag", "Torsdag", "Sondag"],
        },
    },
];
for (const benchmark of benchmarkProfiles) {
    const plan = (0, plan_1.generateFallbackPlan)(benchmark.runnerProfile, benchmark.goal);
    strict_1.default.ok(plan.weeks >= 6, `${benchmark.id} should still produce a meaningful multi-week plan`);
    strict_1.default.ok(plan.sessions.length >= plan.weeks * 2, `${benchmark.id} should produce a viable weekly structure`);
    strict_1.default.ok(plan.sessions.length <= plan.weeks * 4, `${benchmark.id} should stay within sane session counts`);
    for (const session of plan.sessions) {
        strict_1.default.equal(countAdjacentIdenticalRunBlocks(session), 0, `${benchmark.id} should not produce nonsensical adjacent identical run blocks in ${session.title}`);
        strict_1.default.ok(session.steps.length >= 1, `${benchmark.id} should keep readable session shapes`);
    }
}
console.log("engine-vnext session shape tests passed");
