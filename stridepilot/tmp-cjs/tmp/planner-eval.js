"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const build5kPlan_1 = require("../src/lib/coach/build5kPlan");
const interpreter_1 = require("../src/lib/coach/interpreter");
const mapToAppPlan_1 = require("../src/lib/coach/mapToAppPlan");
function deriveCoachGoal(goal, profile) {
    const requestedRuns = goal.availableTrainingDays?.length || profile.realisticTrainingDaysPerWeek || profile.currentRunsPerWeek || 3;
    return {
        goalDistance: goal.distance,
        goalIntent: goal.goalType === "target_time"
            ? "target_time"
            : goal.goalType === "pr"
                ? "improve"
                : goal.goalType === "run_without_walking"
                    ? "finish_comfortably"
                    : "finish",
        targetDate: goal.endDate ?? goal.startDate,
        trainingDaysPerWeek: Math.max(2, Math.min(4, requestedRuns)),
        startDate: goal.startDate,
        targetTime: goal.targetTime,
    };
}
function totalRunMinutes(session) {
    return Math.round(session.steps.filter((step) => step.type === "run").reduce((sum, step) => sum + step.durationSec, 0) / 60);
}
function sessionType(session) {
    const text = `${session.title} ${session.notes ?? ""}`.toLowerCase();
    if (text.includes("interval"))
        return "interval";
    if (text.includes("tempo"))
        return "tempo";
    if (text.includes("benchmark"))
        return "benchmark";
    if (text.includes("langt") || text.includes("udholdenhed"))
        return "long";
    if (text.includes("recovery"))
        return "recovery";
    if (text.includes("strides"))
        return "strides";
    if (text.includes("run-walk"))
        return "run-walk";
    return "easy";
}
function summarizeAppPlan(appPlan) {
    const weeks = Array.from({ length: appPlan.weeks }, (_, index) => index + 1).map((week) => {
        const sessions = appPlan.sessions.filter((session) => session.week === week);
        return {
            week,
            sessions: sessions.map((session) => ({
                title: session.title,
                day: session.dayOfWeek,
                runMin: totalRunMinutes(session),
                type: sessionType(session),
            })),
            totalRunMin: sessions.reduce((sum, session) => sum + totalRunMinutes(session), 0),
            longestRunMin: Math.max(...sessions.map((session) => totalRunMinutes(session)), 0),
        };
    });
    return {
        weeks,
        firstWeek: weeks[0],
        secondWeek: weeks[1],
        fourthWeek: weeks[3],
        peakWeek: [...weeks].sort((a, b) => b.totalRunMin - a.totalRunMin)[0],
        finalWeek: weeks[weeks.length - 1],
        workoutTypeCounts: appPlan.sessions.reduce((acc, session) => {
            const type = sessionType(session);
            acc[type] = (acc[type] ?? 0) + 1;
            return acc;
        }, {}),
    };
}
const personas = [
    {
        name: "1. True beginner, low fitness, 5K finish goal",
        runnerProfile: {
            age: 39,
            heightCm: 168,
            weightKg: 84,
            activityLevel: "lav",
            runningExperience: "nybegynder",
            currentRunsPerWeek: 0,
            currentWeeklyVolumeKm: 0,
            longestCurrentRunMin: 0,
            realisticTrainingDaysPerWeek: 3,
            typicalWorkoutMinutes: 35,
            currentRunningAbility: "helt_ny",
            injuryHistory: "",
            weakPoints: "",
            userTrainingContext: "Jeg bliver hurtigt forpustet og har aldrig rigtig løbet før.",
        },
        goal: {
            distance: "5K",
            goalType: "complete",
            weeks: 10,
            startDate: "2026-04-01",
            endDate: "2026-06-10",
            availableTrainingDays: ["Tirsdag", "Torsdag", "Lordag"],
        },
    },
    {
        name: "2. Beginner wants 5K without walking",
        runnerProfile: {
            age: 31,
            heightCm: 175,
            weightKg: 76,
            activityLevel: "moderat",
            runningExperience: "nybegynder",
            currentRunsPerWeek: 2,
            currentWeeklyVolumeKm: 8,
            longestCurrentRunMin: 18,
            realisticTrainingDaysPerWeek: 3,
            typicalWorkoutMinutes: 40,
            currentRunningAbility: "ti_femten_min",
            injuryHistory: "",
            weakPoints: "Jeg mister hurtigt rytmen hvis passene bliver for hårde.",
            userTrainingContext: "Jeg kan løbe korte ture men vil gerne kunne løbe en hel 5 km uden gang.",
        },
        goal: {
            distance: "5K",
            goalType: "run_without_walking",
            weeks: 10,
            startDate: "2026-04-01",
            endDate: "2026-06-10",
            availableTrainingDays: ["Tirsdag", "Torsdag", "Lordag"],
        },
    },
    {
        name: "3. Light intermediate runner aiming to improve 5K",
        runnerProfile: {
            age: 29,
            heightCm: 180,
            weightKg: 73,
            activityLevel: "moderat",
            runningExperience: "let_ovet",
            currentRunsPerWeek: 3,
            currentWeeklyVolumeKm: 18,
            longestCurrentRunMin: 40,
            realisticTrainingDaysPerWeek: 3,
            typicalWorkoutMinutes: 50,
            currentRunningAbility: "mere_end_tredive_min",
            injuryHistory: "",
            weakPoints: "",
            userTrainingContext: "Jeg løber stabilt og vil gerne forbedre min 5 km tid uden at overdrive.",
        },
        goal: {
            distance: "5K",
            goalType: "pr",
            weeks: 10,
            startDate: "2026-04-01",
            endDate: "2026-06-10",
            availableTrainingDays: ["Tirsdag", "Torsdag", "Lordag"],
            targetTime: "23:30",
        },
    },
    {
        name: "4. Experienced runner, decent volume, 5K target time",
        runnerProfile: {
            age: 36,
            heightCm: 182,
            weightKg: 74,
            activityLevel: "høj",
            runningExperience: "ovet",
            currentRunsPerWeek: 5,
            currentWeeklyVolumeKm: 48,
            longestCurrentRunMin: 85,
            realisticTrainingDaysPerWeek: 4,
            typicalWorkoutMinutes: 70,
            currentRunningAbility: "mere_end_tredive_min",
            injuryHistory: "",
            weakPoints: "Lidt stramme lægge efter hårde banepas.",
            userTrainingContext: "Jeg har løbet i flere år og vil gerne løbe 5 km markant hurtigere.",
        },
        goal: {
            distance: "5K",
            goalType: "target_time",
            weeks: 8,
            startDate: "2026-04-01",
            endDate: "2026-05-27",
            availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"],
            targetTime: "19:30",
        },
    },
    {
        name: "5. Beginner/intermediate runner aiming for 10K finish",
        runnerProfile: {
            age: 41,
            heightCm: 170,
            weightKg: 78,
            activityLevel: "lav",
            runningExperience: "let_ovet",
            currentRunsPerWeek: 2,
            currentWeeklyVolumeKm: 12,
            longestCurrentRunMin: 35,
            realisticTrainingDaysPerWeek: 3,
            typicalWorkoutMinutes: 45,
            currentRunningAbility: "tyve_tredive_min",
            injuryHistory: "",
            weakPoints: "",
            userTrainingContext: "Jeg har gennemført 5 km et par gange og vil gerne kunne klare 10 km på en god måde.",
        },
        goal: {
            distance: "10K",
            goalType: "complete",
            weeks: 12,
            startDate: "2026-04-01",
            endDate: "2026-06-24",
            availableTrainingDays: ["Tirsdag", "Torsdag", "Lordag"],
        },
    },
    {
        name: "6. Intermediate runner aiming for half marathon",
        runnerProfile: {
            age: 34,
            heightCm: 177,
            weightKg: 71,
            activityLevel: "moderat",
            runningExperience: "let_ovet",
            currentRunsPerWeek: 4,
            currentWeeklyVolumeKm: 32,
            longestCurrentRunMin: 75,
            realisticTrainingDaysPerWeek: 4,
            typicalWorkoutMinutes: 65,
            currentRunningAbility: "mere_end_tredive_min",
            injuryHistory: "",
            weakPoints: "Kan blive træt i baglårene hvis progressionen bliver for stejl.",
            userTrainingContext: "Jeg vil gerne løbe halvmaraton stærkt men stadig med god kontrol.",
        },
        goal: {
            distance: "Halvmaraton",
            goalType: "pr",
            weeks: 14,
            startDate: "2026-04-01",
            endDate: "2026-07-08",
            availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"],
            targetTime: "1:42:00",
        },
    },
    {
        name: "7. Experienced runner aiming for marathon",
        runnerProfile: {
            age: 38,
            heightCm: 185,
            weightKg: 79,
            activityLevel: "høj",
            runningExperience: "ovet",
            currentRunsPerWeek: 5,
            currentWeeklyVolumeKm: 58,
            longestCurrentRunMin: 120,
            realisticTrainingDaysPerWeek: 4,
            typicalWorkoutMinutes: 80,
            currentRunningAbility: "mere_end_tredive_min",
            injuryHistory: "",
            weakPoints: "Bliver stiv i hofterne efter meget stillesiddende arbejde.",
            userTrainingContext: "Jeg har løbet flere halvmaraton og vil bygge mod maraton på en stabil måde.",
        },
        goal: {
            distance: "Marathon",
            goalType: "complete",
            weeks: 18,
            startDate: "2026-04-01",
            endDate: "2026-08-05",
            availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"],
        },
    },
    {
        name: "8. Overly ambitious runner with unrealistic target/timeframe",
        runnerProfile: {
            age: 27,
            heightCm: 179,
            weightKg: 77,
            activityLevel: "lav",
            runningExperience: "nybegynder",
            currentRunsPerWeek: 2,
            currentWeeklyVolumeKm: 10,
            longestCurrentRunMin: 25,
            realisticTrainingDaysPerWeek: 3,
            typicalWorkoutMinutes: 40,
            currentRunningAbility: "ti_femten_min",
            injuryHistory: "Ingen skader",
            weakPoints: "",
            userTrainingContext: "Jeg vil gerne løbe et hurtigt halvmaraton snart selv om jeg stadig er ret ny.",
        },
        goal: {
            distance: "Halvmaraton",
            goalType: "target_time",
            weeks: 6,
            startDate: "2026-04-01",
            endDate: "2026-05-13",
            availableTrainingDays: ["Tirsdag", "Torsdag", "Lordag"],
            targetTime: "1:28:00",
        },
    },
];
for (const persona of personas) {
    const coachProfile = (0, interpreter_1.interpretRunnerProfile)({
        onboardingText: persona.runnerProfile.userTrainingContext,
        injuryHistory: persona.runnerProfile.injuryHistory,
        weakPoints: persona.runnerProfile.weakPoints,
        otherTraining: persona.runnerProfile.otherTraining,
        currentAbility: persona.runnerProfile.currentRunningAbility,
        goalDistance: persona.goal.distance,
        goalTime: persona.goal.targetTime,
        goalType: persona.goal.goalType,
        activityLevel: persona.runnerProfile.activityLevel,
        currentRunsPerWeek: persona.runnerProfile.currentRunsPerWeek,
        currentWeeklyVolumeKm: persona.runnerProfile.currentWeeklyVolumeKm,
        longestRunMinutes: persona.runnerProfile.longestCurrentRunMin,
        realisticTrainingDaysPerWeek: persona.runnerProfile.realisticTrainingDaysPerWeek,
        typicalWorkoutMinutes: persona.runnerProfile.typicalWorkoutMinutes,
        preferredGuidance: persona.runnerProfile.preferredGuidance,
    });
    const plan = (0, build5kPlan_1.buildGoalPlan)(coachProfile, deriveCoachGoal(persona.goal, persona.runnerProfile));
    const appPlan = (0, mapToAppPlan_1.mapCoachPlanToAppPlan)(plan, plan.goal);
    const summary = summarizeAppPlan(appPlan);
    console.log(`\n=== ${persona.name} ===`);
    console.log(JSON.stringify({
        coachProfile,
        plannerGoal: plan.goal,
        summary: {
            firstWeek: summary.firstWeek,
            secondWeek: summary.secondWeek,
            fourthWeek: summary.fourthWeek,
            peakWeek: summary.peakWeek,
            finalWeek: summary.finalWeek,
            workoutTypeCounts: summary.workoutTypeCounts,
        },
    }, null, 2));
}
