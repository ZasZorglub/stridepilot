"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.benchmarkReportFixtures = void 0;
exports.buildBenchmarkReport = buildBenchmarkReport;
exports.buildBenchmarkReports = buildBenchmarkReports;
exports.buildPlanQualitySummary = buildPlanQualitySummary;
exports.formatBenchmarkRunTimestamp = formatBenchmarkRunTimestamp;
exports.createTimestampedBenchmarkOutputDir = createTimestampedBenchmarkOutputDir;
exports.writeBenchmarkReports = writeBenchmarkReports;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const build5kPlan_1 = require("./build5kPlan");
const interpreter_1 = require("./interpreter");
const mapToAppPlan_1 = require("./mapToAppPlan");
const DEFAULT_START_DATE = "2026-03-31";
const WARNING_TYPES = [
    "missing_destination_session",
    "race_day_too_short",
    "late_plan_collapse",
    "taper_too_aggressive",
    "goal_week_shape_mismatch",
    "session_shape_mismatch",
];
function profileFixture(profileId, profileName, runnerProfile, goal) {
    return {
        profileId,
        profileName,
        runnerProfile: {
            heightCm: 172,
            weightKg: 68,
            age: 36,
            activityLevel: "moderat",
            runningExperience: "let_ovet",
            currentRunningAbility: "tyve_tredive_min",
            userTrainingContext: "",
            currentWeeklyVolumeKm: 18,
            currentRunsPerWeek: 3,
            longestCurrentRunMin: 35,
            recentRaceTimes: [],
            injuryHistory: "",
            weakPoints: "",
            realisticTrainingDaysPerWeek: 3,
            typicalWorkoutMinutes: 45,
            otherTraining: "",
            preferredGuidance: "flexible",
            ...runnerProfile,
        },
        goal: {
            distance: "10K",
            goalType: "complete",
            weeks: 14,
            startDate: DEFAULT_START_DATE,
            availableTrainingDays: ["Tirsdag", "Torsdag", "Sondag"],
            ...goal,
        },
    };
}
const foundationalFixtures = [
    profileFixture("profile-01", "Returning beginner, 2x/week", { runningExperience: "nybegynder", currentRunningAbility: "fem_min", currentRunsPerWeek: 2, currentWeeklyVolumeKm: 6, longestCurrentRunMin: 12, realisticTrainingDaysPerWeek: 2, typicalWorkoutMinutes: 35, userTrainingContext: "Tilbage efter pause og vil bygge roligt op." }, { distance: "5K", goalType: "run_without_walking", availableTrainingDays: ["Tirsdag", "Lordag"] }),
    profileFixture("profile-02", "Beginner, 3x/week, first 5K", { runningExperience: "nybegynder", currentRunningAbility: "ti_femten_min", currentWeeklyVolumeKm: 10, longestCurrentRunMin: 18, userTrainingContext: "Vil frem mod min forste 5 km." }, { distance: "5K", goalType: "complete", weeks: 12 }),
    profileFixture("profile-03", "Cautious beginner, 3x/week", { runningExperience: "nybegynder", currentRunningAbility: "fem_min", currentRunsPerWeek: 2, currentWeeklyVolumeKm: 7, longestCurrentRunMin: 14, activityLevel: "lav", injuryHistory: "Tidligere skinnebensirritation.", userTrainingContext: "Har brug for ekstra rolig progression." }, { distance: "5K", goalType: "run_without_walking", weeks: 12 }),
    profileFixture("profile-04", "Novice 10K, 3x/week", { currentRunningAbility: "tyve_tredive_min", currentWeeklyVolumeKm: 18, longestCurrentRunMin: 35, userTrainingContext: "Vil bygge mod 10 km uden at det bliver for hardt." }, { distance: "10K", goalType: "complete", weeks: 14 }),
    profileFixture("profile-05", "Beginner 10K, 2x/week", { currentRunningAbility: "ti_femten_min", currentRunsPerWeek: 2, currentWeeklyVolumeKm: 11, longestCurrentRunMin: 24, realisticTrainingDaysPerWeek: 2, typicalWorkoutMinutes: 40 }, { distance: "10K", goalType: "complete", weeks: 16, availableTrainingDays: ["Onsdag", "Sondag"] }),
    profileFixture("profile-06", "Recreational 10K PR, 4x/week", { runningExperience: "ovet", currentRunningAbility: "mere_end_tredive_min", currentRunsPerWeek: 4, currentWeeklyVolumeKm: 32, longestCurrentRunMin: 60, realisticTrainingDaysPerWeek: 4, typicalWorkoutMinutes: 60, recentRaceTimes: [{ distance: "10K", time: "48:30" }], preferredGuidance: "performance_oriented" }, { distance: "10K", goalType: "pr", weeks: 14, availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"] }),
    profileFixture("profile-07", "Recreational 10K target time", { runningExperience: "ovet", currentRunningAbility: "mere_end_tredive_min", currentRunsPerWeek: 4, currentWeeklyVolumeKm: 30, longestCurrentRunMin: 55, realisticTrainingDaysPerWeek: 4, typicalWorkoutMinutes: 60 }, { distance: "10K", goalType: "target_time", targetTime: "47:30", weeks: 14, availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"] }),
    profileFixture("profile-08", "Comeback 5K, 3x/week", { runningExperience: "let_ovet", currentRunningAbility: "fem_min", currentRunsPerWeek: 2, currentWeeklyVolumeKm: 8, longestCurrentRunMin: 15, injuryHistory: "Tidligere knairritation.", activityLevel: "lav", userTrainingContext: "Pa vej tilbage og vil have meget rolig progression." }, { distance: "5K", goalType: "run_without_walking", weeks: 12 }),
    profileFixture("profile-09", "Half marathon finish, 4x/week", { runningExperience: "ovet", currentRunningAbility: "mere_end_tredive_min", currentRunsPerWeek: 4, currentWeeklyVolumeKm: 28, longestCurrentRunMin: 75, realisticTrainingDaysPerWeek: 4, typicalWorkoutMinutes: 65, recentRaceTimes: [{ distance: "10K", time: "52:10" }] }, { distance: "Halvmaraton", goalType: "complete", weeks: 18, availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"] }),
    profileFixture("profile-10", "Half marathon improve, 4x/week", { runningExperience: "ovet", currentRunningAbility: "mere_end_tredive_min", currentRunsPerWeek: 4, currentWeeklyVolumeKm: 36, longestCurrentRunMin: 85, realisticTrainingDaysPerWeek: 4, typicalWorkoutMinutes: 70, recentRaceTimes: [{ distance: "Halvmaraton", time: "1:49:00" }], preferredGuidance: "performance_oriented" }, { distance: "Halvmaraton", goalType: "pr", weeks: 18, availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"] }),
    profileFixture("profile-11", "Half marathon cautious, 3x/week", { runningExperience: "let_ovet", currentRunningAbility: "tyve_tredive_min", currentRunsPerWeek: 3, currentWeeklyVolumeKm: 22, longestCurrentRunMin: 55, realisticTrainingDaysPerWeek: 3, typicalWorkoutMinutes: 55, injuryHistory: "Har brug for stabil progression." }, { distance: "Halvmaraton", goalType: "complete", weeks: 18 }),
    profileFixture("profile-12", "Fit but inexperienced half, 4x/week", { runningExperience: "let_ovet", currentRunningAbility: "tyve_tredive_min", currentRunsPerWeek: 4, currentWeeklyVolumeKm: 24, longestCurrentRunMin: 50, realisticTrainingDaysPerWeek: 4, otherTraining: "Lidt cykling og styrke." }, { distance: "Halvmaraton", goalType: "complete", weeks: 18, availableTrainingDays: ["Mandag", "Tirsdag", "Torsdag", "Sondag"] }),
    profileFixture("profile-13", "Marathon finish, 4x/week", { runningExperience: "ovet", currentRunningAbility: "mere_end_tredive_min", currentRunsPerWeek: 4, currentWeeklyVolumeKm: 40, longestCurrentRunMin: 100, realisticTrainingDaysPerWeek: 4, typicalWorkoutMinutes: 75 }, { distance: "Marathon", goalType: "complete", weeks: 20, availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"] }),
    profileFixture("profile-14", "Marathon improve, 4x/week", { runningExperience: "ovet", currentRunningAbility: "mere_end_tredive_min", currentRunsPerWeek: 4, currentWeeklyVolumeKm: 52, longestCurrentRunMin: 125, realisticTrainingDaysPerWeek: 4, typicalWorkoutMinutes: 80, recentRaceTimes: [{ distance: "Marathon", time: "3:42:00" }], preferredGuidance: "performance_oriented" }, { distance: "Marathon", goalType: "pr", weeks: 20, availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"] }),
    profileFixture("profile-15", "Experienced 5K target time", { runningExperience: "ovet", currentRunningAbility: "mere_end_tredive_min", currentRunsPerWeek: 4, currentWeeklyVolumeKm: 34, longestCurrentRunMin: 55, realisticTrainingDaysPerWeek: 4, typicalWorkoutMinutes: 55, recentRaceTimes: [{ distance: "5K", time: "23:15" }] }, { distance: "5K", goalType: "target_time", targetTime: "22:15", weeks: 12, availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"] }),
    profileFixture("profile-16", "Recreational 5K PR, 3x/week", { runningExperience: "let_ovet", currentRunningAbility: "tyve_tredive_min", currentRunsPerWeek: 3, currentWeeklyVolumeKm: 19, longestCurrentRunMin: 38, recentRaceTimes: [{ distance: "5K", time: "27:40" }] }, { distance: "5K", goalType: "pr", weeks: 12 }),
    profileFixture("profile-17", "Older cautious 10K, 3x/week", { age: 54, runningExperience: "let_ovet", currentRunningAbility: "tyve_tredive_min", currentRunsPerWeek: 3, currentWeeklyVolumeKm: 16, longestCurrentRunMin: 32, injuryHistory: "Achilles og laeg vil have konservativ progression.", activityLevel: "lav" }, { distance: "10K", goalType: "complete", weeks: 14 }),
    profileFixture("profile-18", "Return to running 10K, 2x/week", { runningExperience: "let_ovet", currentRunningAbility: "fem_min", currentRunsPerWeek: 2, currentWeeklyVolumeKm: 7, longestCurrentRunMin: 14, realisticTrainingDaysPerWeek: 2, activityLevel: "lav", injuryHistory: "Lang pause fra lob." }, { distance: "10K", goalType: "complete", weeks: 16, availableTrainingDays: ["Tirsdag", "Sondag"] }),
    profileFixture("profile-19", "Intermediate 10K improve, 4x/week", { runningExperience: "ovet", currentRunningAbility: "mere_end_tredive_min", currentRunsPerWeek: 4, currentWeeklyVolumeKm: 36, longestCurrentRunMin: 65, realisticTrainingDaysPerWeek: 4, typicalWorkoutMinutes: 65 }, { distance: "10K", goalType: "pr", weeks: 14, availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"] }),
    profileFixture("profile-20", "Advanced marathon target time", { runningExperience: "ovet", currentRunningAbility: "mere_end_tredive_min", currentRunsPerWeek: 4, currentWeeklyVolumeKm: 58, longestCurrentRunMin: 135, realisticTrainingDaysPerWeek: 4, typicalWorkoutMinutes: 85, recentRaceTimes: [{ distance: "Marathon", time: "3:28:00" }], preferredGuidance: "performance_oriented" }, { distance: "Marathon", goalType: "target_time", targetTime: "3:20:00", weeks: 20, availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"] }),
];
const expandedFixtures = [
    profileFixture("profile-21", "Nervous 5K complete, 2x/week", { runningExperience: "nybegynder", currentRunningAbility: "fem_min", currentRunsPerWeek: 2, currentWeeklyVolumeKm: 5, longestCurrentRunMin: 10, realisticTrainingDaysPerWeek: 2, activityLevel: "lav", userTrainingContext: "Har brug for meget tryg og enkel progression." }, { distance: "5K", goalType: "complete", weeks: 12, availableTrainingDays: ["Onsdag", "Sondag"] }),
    profileFixture("profile-22", "Beginner 5K target time, 4x/week", { runningExperience: "let_ovet", currentRunningAbility: "tyve_tredive_min", currentRunsPerWeek: 4, currentWeeklyVolumeKm: 20, longestCurrentRunMin: 38, realisticTrainingDaysPerWeek: 4 }, { distance: "5K", goalType: "target_time", targetTime: "26:30", weeks: 12, availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"] }),
    profileFixture("profile-23", "Motivated 5K PR, 4x/week", { runningExperience: "ovet", currentRunningAbility: "mere_end_tredive_min", currentRunsPerWeek: 4, currentWeeklyVolumeKm: 30, longestCurrentRunMin: 48, realisticTrainingDaysPerWeek: 4, preferredGuidance: "performance_oriented" }, { distance: "5K", goalType: "pr", weeks: 12, availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"] }),
    profileFixture("profile-24", "Comeback 5K complete, 3x/week", { runningExperience: "let_ovet", currentRunningAbility: "ti_femten_min", currentRunsPerWeek: 3, currentWeeklyVolumeKm: 12, longestCurrentRunMin: 20, injuryHistory: "Tilbage efter mindre skadespause." }, { distance: "5K", goalType: "complete", weeks: 12 }),
    profileFixture("profile-25", "Cautious 10K complete, 3x/week", { runningExperience: "nybegynder", currentRunningAbility: "ti_femten_min", currentRunsPerWeek: 3, currentWeeklyVolumeKm: 12, longestCurrentRunMin: 22, injuryHistory: "Vil holde progressionen meget rolig." }, { distance: "10K", goalType: "complete", weeks: 16 }),
    profileFixture("profile-26", "Steady 10K complete, 4x/week", { runningExperience: "let_ovet", currentRunningAbility: "tyve_tredive_min", currentRunsPerWeek: 4, currentWeeklyVolumeKm: 24, longestCurrentRunMin: 42, realisticTrainingDaysPerWeek: 4 }, { distance: "10K", goalType: "complete", weeks: 14, availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"] }),
    profileFixture("profile-27", "Balanced 10K target time, 3x/week", { runningExperience: "ovet", currentRunningAbility: "mere_end_tredive_min", currentRunsPerWeek: 3, currentWeeklyVolumeKm: 26, longestCurrentRunMin: 50, realisticTrainingDaysPerWeek: 3 }, { distance: "10K", goalType: "target_time", targetTime: "49:00", weeks: 14 }),
    profileFixture("profile-28", "Older 10K PR, 4x/week", { age: 57, runningExperience: "ovet", currentRunningAbility: "mere_end_tredive_min", currentRunsPerWeek: 4, currentWeeklyVolumeKm: 34, longestCurrentRunMin: 58, realisticTrainingDaysPerWeek: 4, userTrainingContext: "Vil gerne forbedre mig uden at forcere." }, { distance: "10K", goalType: "pr", weeks: 14, availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"] }),
    profileFixture("profile-29", "Comeback 10K complete, 2x/week", { runningExperience: "let_ovet", currentRunningAbility: "ti_femten_min", currentRunsPerWeek: 2, currentWeeklyVolumeKm: 10, longestCurrentRunMin: 20, realisticTrainingDaysPerWeek: 2, injuryHistory: "Tilbage efter lang pause." }, { distance: "10K", goalType: "complete", weeks: 16, availableTrainingDays: ["Tirsdag", "Sondag"] }),
    profileFixture("profile-30", "Stronger 10K target time, 4x/week", { runningExperience: "ovet", currentRunningAbility: "mere_end_tredive_min", currentRunsPerWeek: 4, currentWeeklyVolumeKm: 40, longestCurrentRunMin: 72, realisticTrainingDaysPerWeek: 4, preferredGuidance: "performance_oriented" }, { distance: "10K", goalType: "target_time", targetTime: "43:30", weeks: 14, availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"] }),
    profileFixture("profile-31", "Half finish cautious, 3x/week", { runningExperience: "let_ovet", currentRunningAbility: "tyve_tredive_min", currentRunsPerWeek: 3, currentWeeklyVolumeKm: 20, longestCurrentRunMin: 48, injuryHistory: "Fungerer bedst med lidt ekstra margin." }, { distance: "Halvmaraton", goalType: "complete", weeks: 18 }),
    profileFixture("profile-32", "Half target time, 4x/week", { runningExperience: "ovet", currentRunningAbility: "mere_end_tredive_min", currentRunsPerWeek: 4, currentWeeklyVolumeKm: 38, longestCurrentRunMin: 88, realisticTrainingDaysPerWeek: 4, preferredGuidance: "performance_oriented" }, { distance: "Halvmaraton", goalType: "target_time", targetTime: "1:42:00", weeks: 18, availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"] }),
    profileFixture("profile-33", "Half complete durable, 2x/week", { runningExperience: "let_ovet", currentRunningAbility: "tyve_tredive_min", currentRunsPerWeek: 2, currentWeeklyVolumeKm: 18, longestCurrentRunMin: 50, realisticTrainingDaysPerWeek: 2, typicalWorkoutMinutes: 60 }, { distance: "Halvmaraton", goalType: "complete", weeks: 20, availableTrainingDays: ["Onsdag", "Sondag"] }),
    profileFixture("profile-34", "Half PR strong, 4x/week", { runningExperience: "ovet", currentRunningAbility: "mere_end_tredive_min", currentRunsPerWeek: 4, currentWeeklyVolumeKm: 44, longestCurrentRunMin: 95, realisticTrainingDaysPerWeek: 4, preferredGuidance: "performance_oriented" }, { distance: "Halvmaraton", goalType: "pr", weeks: 18, availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"] }),
    profileFixture("profile-35", "Half comeback finish, 4x/week", { runningExperience: "let_ovet", currentRunningAbility: "ti_femten_min", currentRunsPerWeek: 3, currentWeeklyVolumeKm: 16, longestCurrentRunMin: 30, realisticTrainingDaysPerWeek: 4, userTrainingContext: "Vil tilbage til stabile længere ture." }, { distance: "Halvmaraton", goalType: "complete", weeks: 20, availableTrainingDays: ["Mandag", "Tirsdag", "Torsdag", "Sondag"] }),
    profileFixture("profile-36", "Marathon durable finish, 3x/week", { runningExperience: "ovet", currentRunningAbility: "mere_end_tredive_min", currentRunsPerWeek: 3, currentWeeklyVolumeKm: 34, longestCurrentRunMin: 90, realisticTrainingDaysPerWeek: 3, typicalWorkoutMinutes: 75 }, { distance: "Marathon", goalType: "complete", weeks: 20 }),
    profileFixture("profile-37", "Marathon cautious complete, 2x/week", { runningExperience: "let_ovet", currentRunningAbility: "tyve_tredive_min", currentRunsPerWeek: 2, currentWeeklyVolumeKm: 24, longestCurrentRunMin: 70, realisticTrainingDaysPerWeek: 2, typicalWorkoutMinutes: 75, injuryHistory: "Vil hellere underbygge end forcere." }, { distance: "Marathon", goalType: "complete", weeks: 22, availableTrainingDays: ["Onsdag", "Sondag"] }),
    profileFixture("profile-38", "Marathon target time, 4x/week", { runningExperience: "ovet", currentRunningAbility: "mere_end_tredive_min", currentRunsPerWeek: 4, currentWeeklyVolumeKm: 56, longestCurrentRunMin: 130, realisticTrainingDaysPerWeek: 4, typicalWorkoutMinutes: 85, preferredGuidance: "performance_oriented" }, { distance: "Marathon", goalType: "target_time", targetTime: "3:25:00", weeks: 20, availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"] }),
    profileFixture("profile-39", "Marathon PR experienced, 4x/week", { runningExperience: "ovet", currentRunningAbility: "mere_end_tredive_min", currentRunsPerWeek: 4, currentWeeklyVolumeKm: 60, longestCurrentRunMin: 140, realisticTrainingDaysPerWeek: 4, typicalWorkoutMinutes: 90, preferredGuidance: "performance_oriented" }, { distance: "Marathon", goalType: "pr", weeks: 20, availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"] }),
    profileFixture("profile-40", "Older 5K PR, 3x/week", { age: 59, runningExperience: "let_ovet", currentRunningAbility: "tyve_tredive_min", currentRunsPerWeek: 3, currentWeeklyVolumeKm: 18, longestCurrentRunMin: 34 }, { distance: "5K", goalType: "pr", weeks: 12 }),
    profileFixture("profile-41", "Nervous 10K beginner, 3x/week", { runningExperience: "nybegynder", currentRunningAbility: "fem_min", currentRunsPerWeek: 2, currentWeeklyVolumeKm: 6, longestCurrentRunMin: 12, activityLevel: "lav", userTrainingContext: "Vil frem mod en tryg 10 km progression." }, { distance: "10K", goalType: "complete", weeks: 16 }),
    profileFixture("profile-42", "Fit but inexperienced half, 4x/week (extended)", { runningExperience: "let_ovet", currentRunningAbility: "tyve_tredive_min", currentRunsPerWeek: 4, currentWeeklyVolumeKm: 26, longestCurrentRunMin: 55, otherTraining: "Cykler lidt ved siden af." }, { distance: "Halvmaraton", goalType: "complete", weeks: 20, availableTrainingDays: ["Mandag", "Tirsdag", "Torsdag", "Sondag"] }),
    profileFixture("profile-43", "Advanced marathon complete, 4x/week", { runningExperience: "ovet", currentRunningAbility: "mere_end_tredive_min", currentRunsPerWeek: 4, currentWeeklyVolumeKm: 62, longestCurrentRunMin: 145, realisticTrainingDaysPerWeek: 4, typicalWorkoutMinutes: 90 }, { distance: "Marathon", goalType: "complete", weeks: 22, availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"] }),
    profileFixture("profile-44", "5K target time comeback, 3x/week", { runningExperience: "let_ovet", currentRunningAbility: "ti_femten_min", currentRunsPerWeek: 3, currentWeeklyVolumeKm: 14, longestCurrentRunMin: 24, injuryHistory: "Tilbage efter vinterpause." }, { distance: "5K", goalType: "target_time", targetTime: "27:30", weeks: 12 }),
];
exports.benchmarkReportFixtures = [...foundationalFixtures, ...expandedFixtures];
function addDaysToIsoDate(dateIso, days) {
    const date = new Date(`${dateIso}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}
function goalIntent(goal) {
    if (goal.goalType === "target_time")
        return "target_time";
    if (goal.goalType === "pr")
        return "improve";
    if (goal.goalType === "run_without_walking")
        return "finish_comfortably";
    return "finish";
}
function toCoachGoalConfig(goal, profile) {
    const requestedRuns = goal.availableTrainingDays?.length || profile.realisticTrainingDaysPerWeek || profile.currentRunsPerWeek || 3;
    const preferredTrainingDays = goal.availableTrainingDays?.map((day) => {
        if (day === "Mandag")
            return "monday";
        if (day === "Tirsdag")
            return "tuesday";
        if (day === "Onsdag")
            return "wednesday";
        if (day === "Torsdag")
            return "thursday";
        if (day === "Fredag")
            return "friday";
        if (day === "Lordag")
            return "saturday";
        return "sunday";
    });
    return {
        goalDistance: goal.distance,
        goalIntent: goalIntent(goal),
        targetDate: goal.endDate ?? addDaysToIsoDate(goal.startDate, Math.max(1, goal.weeks - 1) * 7),
        trainingDaysPerWeek: Math.max(2, Math.min(4, requestedRuns)),
        startDate: goal.startDate,
        targetTime: goal.targetTime,
        preferredTrainingDays,
        preferredLongRunDay: goal.preferredLongRunDay === "saturday" || goal.preferredLongRunDay === "sunday" ? goal.preferredLongRunDay : "flexible",
    };
}
function buildCoachPlan(fixture) {
    const coachProfile = (0, interpreter_1.interpretRunnerProfile)({
        onboardingText: fixture.runnerProfile.userTrainingContext,
        injuryHistory: fixture.runnerProfile.injuryHistory,
        weakPoints: fixture.runnerProfile.weakPoints,
        otherTraining: fixture.runnerProfile.otherTraining,
        currentAbility: fixture.runnerProfile.currentRunningAbility,
        goalDistance: fixture.goal.distance,
        goalTime: fixture.goal.targetTime,
        goalType: fixture.goal.goalType,
        activityLevel: fixture.runnerProfile.activityLevel,
        currentRunsPerWeek: fixture.runnerProfile.currentRunsPerWeek,
        currentWeeklyVolumeKm: fixture.runnerProfile.currentWeeklyVolumeKm,
        longestRunMinutes: fixture.runnerProfile.longestCurrentRunMin,
        realisticTrainingDaysPerWeek: fixture.runnerProfile.realisticTrainingDaysPerWeek,
        typicalWorkoutMinutes: fixture.runnerProfile.typicalWorkoutMinutes,
        preferredGuidance: fixture.runnerProfile.preferredGuidance,
    });
    const coachPlan = (0, build5kPlan_1.buildGoalPlan)(coachProfile, toCoachGoalConfig(fixture.goal, fixture.runnerProfile));
    return {
        coachPlan,
        appPlan: (0, mapToAppPlan_1.mapCoachPlanToAppPlan)(coachPlan, coachPlan.goal),
        coachProfile,
    };
}
function stepSummary(step) {
    const minutes = Math.round((step.durationSec / 60) * 10) / 10;
    const type = step.type === "warmup" ? "Warmup" : step.type === "cooldown" ? "Cooldown" : step.type === "walk" ? "Walk" : "Run";
    return `${type} ${Number.isInteger(minutes) ? minutes : minutes.toFixed(1)} min`;
}
function structureSummary(session) {
    return session.steps.map(stepSummary).join(" / ");
}
function isIntervalType(type) {
    return ["interval", "tempo", "strides", "fartlek", "hill-reps", "benchmark", "race-specific"].includes(type);
}
function shouldFlagShortWork(type) {
    return ["interval", "tempo", "fartlek", "hill-reps", "benchmark", "race-specific"].includes(type);
}
function aggressiveHeartRateZone(zoneLabel) {
    if (!zoneLabel)
        return false;
    return zoneLabel.includes("Zone 4") || zoneLabel.includes("Zone 5");
}
function hasOddAdjacentIdenticalBlocks(steps) {
    for (let index = 1; index < steps.length; index += 1) {
        const prev = steps[index - 1];
        const current = steps[index];
        if (prev.type === current.type && prev.cue === current.cue && prev.type === "run")
            return true;
    }
    return false;
}
function analyzeSessionShape(appSession, coachSession) {
    const isIntervalSession = isIntervalType(coachSession.type);
    const workBlocks = appSession.steps.filter((step) => step.type === "run").map((step) => ({
        label: step.label,
        durationSec: step.durationSec,
        zoneLabel: step.heartRateGuidance?.zoneLabel,
    }));
    const recoveryBlocks = appSession.steps.filter((step) => step.type === "walk").map((step) => ({
        label: step.label,
        durationSec: step.durationSec,
        zoneLabel: step.heartRateGuidance?.zoneLabel,
    }));
    const notes = [];
    const hasCoachingMismatch = (coachSession.type === "run-walk" && workBlocks.some((block) => aggressiveHeartRateZone(block.zoneLabel))) ||
        (!isIntervalSession && coachSession.type !== "run-walk" && workBlocks.some((block) => aggressiveHeartRateZone(block.zoneLabel)));
    if (shouldFlagShortWork(coachSession.type) && workBlocks.every((block) => block.durationSec <= 90)) {
        notes.push("Arbejdsblokkene er meget korte.");
    }
    if (shouldFlagShortWork(coachSession.type) && recoveryBlocks.some((block) => block.durationSec < 45)) {
        notes.push("Recovery-blokkene er meget korte.");
    }
    if (!isIntervalSession && hasOddAdjacentIdenticalBlocks(appSession.steps))
        notes.push("Sammenhaengende loeb er delt op pa en unaturlig made.");
    if (hasCoachingMismatch)
        notes.push("Puls-guidance matcher ikke sessionens rolige intention.");
    return {
        isIntervalSession,
        workBlocks,
        recoveryBlocks,
        hasCoachingMismatch,
        notes,
    };
}
function currentLevelLabel(ability) {
    if (ability === "helt_ny")
        return "Helt ny";
    if (ability === "fem_min")
        return "Ca. 5 min sammenhaengende";
    if (ability === "ti_femten_min")
        return "Ca. 10-15 min sammenhaengende";
    if (ability === "tyve_tredive_min")
        return "Ca. 20-30 min sammenhaengende";
    return "30+ min sammenhaengende";
}
function roundTenth(value) {
    return Math.round(value * 10) / 10;
}
function runningMinutes(steps) {
    return roundTenth(steps.filter((step) => step.type !== "walk").reduce((sum, step) => sum + step.durationSec / 60, 0));
}
function totalWeekRunningMinutes(sessions) {
    return roundTenth(sessions.reduce((sum, session) => sum + session.runMinutes, 0));
}
function slugify(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function distanceSignal(distance) {
    if (distance === "5K")
        return "5 km";
    if (distance === "10K")
        return "10 km";
    if (distance === "Halvmaraton")
        return "halvmaraton";
    return "marathon";
}
function hasExplicitDestinationSemantics(session, distance) {
    const title = session.coachSession.title.toLowerCase();
    return (session.coachSession.type === "benchmark" ||
        session.coachSession.type === "race-specific" ||
        title.includes("benchmark") ||
        title.includes("specifikt") ||
        title.includes(distanceSignal(distance)));
}
function isKeyWorkout(type) {
    return type === "long" || isIntervalType(type) || type === "progression" || type === "steady";
}
function destinationSessionRatio(distance) {
    if (distance === "5K")
        return 0.58;
    if (distance === "10K")
        return 0.65;
    if (distance === "Halvmaraton")
        return 0.72;
    return 0.8;
}
function taperWeekRatio(distance) {
    if (distance === "5K")
        return 0.28;
    if (distance === "10K")
        return 0.32;
    if (distance === "Halvmaraton")
        return 0.38;
    return 0.42;
}
function evaluatePlanWarnings(fixture, finalWeekSessions, priorSessions) {
    const explicitDestination = [...finalWeekSessions].reverse().find((session) => hasExplicitDestinationSemantics(session, fixture.goal.distance)) ?? null;
    const destinationSession = explicitDestination ?? finalWeekSessions[finalWeekSessions.length - 1] ?? null;
    const longestPriorRunMin = roundTenth(Math.max(0, ...priorSessions.map((session) => session.runMinutes)));
    const longestPriorKeyRunMin = roundTenth(Math.max(0, ...priorSessions.filter((session) => session.report.isKeyWorkout).map((session) => session.runMinutes)));
    const goalDayRunMin = destinationSession ? destinationSession.runMinutes : 0;
    const priorWeekTotals = new Map();
    priorSessions.forEach((session) => {
        const existing = priorWeekTotals.get(session.weekIndex) ?? 0;
        priorWeekTotals.set(session.weekIndex, existing + session.runMinutes);
    });
    const peakPriorWeekRunMin = roundTenth(Math.max(0, ...priorWeekTotals.values()));
    const goalWeekRunMin = totalWeekRunningMinutes(finalWeekSessions);
    const lateWindow = [...priorWeekTotals.entries()].filter(([weekIndex]) => weekIndex >= Math.max(1, finalWeekSessions[0]?.weekIndex - 2));
    const lateWindowPeak = roundTenth(Math.max(0, ...lateWindow.map(([, total]) => total)));
    const warnings = new Set();
    if (!explicitDestination)
        warnings.add("missing_destination_session");
    const comparisonRunMin = Math.max(longestPriorRunMin, longestPriorKeyRunMin);
    if (comparisonRunMin >= 20 && goalDayRunMin > 0 && goalDayRunMin < comparisonRunMin * destinationSessionRatio(fixture.goal.distance)) {
        warnings.add("race_day_too_short");
    }
    if (peakPriorWeekRunMin >= 40 && goalWeekRunMin < peakPriorWeekRunMin * taperWeekRatio(fixture.goal.distance)) {
        warnings.add("taper_too_aggressive");
    }
    if (peakPriorWeekRunMin >= 35 && lateWindowPeak < peakPriorWeekRunMin * 0.72) {
        warnings.add("late_plan_collapse");
    }
    const finalWeekKeySessions = finalWeekSessions.filter((session) => session.report.isKeyWorkout);
    if (finalWeekKeySessions.length > 2 ||
        (destinationSession && finalWeekKeySessions.some((session) => session !== destinationSession && isIntervalType(session.coachSession.type)))) {
        warnings.add("goal_week_shape_mismatch");
    }
    if (finalWeekSessions.some((session) => session.report.intervalAnalysis.notes.length > 0) ||
        (destinationSession?.report.intervalAnalysis.notes.length ?? 0) > 0) {
        warnings.add("session_shape_mismatch");
    }
    return {
        warnings: [...warnings],
        diagnostics: {
            goalWeek: finalWeekSessions[0]?.weekIndex ?? 0,
            destinationSessionSummary: destinationSession ? `${destinationSession.coachSession.title} — ${destinationSession.report.structureSummary}` : null,
            finalWeekSessionSummaries: finalWeekSessions.map((session) => `${session.coachSession.title} (${session.coachSession.type}) — ${session.report.structureSummary}`),
            longestPriorRunMin,
            longestPriorKeyRunMin,
            goalDayRunMin,
            goalDaySessionType: destinationSession?.coachSession.type ?? null,
        },
    };
}
function buildBenchmarkReport(fixture) {
    const { coachPlan, appPlan, coachProfile } = buildCoachPlan(fixture);
    const sessionMap = new Map(appPlan.sessions.map((session) => [session.id, session]));
    const phaseSequence = coachPlan.weeks.map((week) => week.phase).filter((phase, index, phases) => index === 0 || phases[index - 1] !== phase);
    const weeklySessionCounts = coachPlan.weeks.map((week) => week.sessions.length);
    const longestWorkoutMin = Math.max(...coachPlan.sessions.map((session) => session.durationMin));
    const weekBundles = coachPlan.weeks.map((week) => ({
        weekIndex: week.weekNumber,
        phase: week.phase,
        sessions: week.sessions.map((coachSession, sessionIndex) => {
            const appSession = sessionMap.get(coachSession.id);
            if (!appSession)
                throw new Error(`Missing mapped app session for ${fixture.profileId}:${coachSession.id}`);
            const report = {
                sessionIndex: sessionIndex + 1,
                sessionType: coachSession.type,
                sessionLabel: coachSession.title,
                durationMin: coachSession.durationMin,
                isKeyWorkout: isKeyWorkout(coachSession.type),
                structureSummary: structureSummary(appSession),
                steps: appSession.steps.map((step) => ({
                    type: step.type,
                    label: step.label,
                    durationSec: step.durationSec,
                    cue: step.cue,
                    heartRateGuidance: step.heartRateGuidance,
                })),
                intervalAnalysis: analyzeSessionShape(appSession, coachSession),
            };
            return {
                weekIndex: week.weekNumber,
                coachSession,
                appSession,
                report,
                runMinutes: runningMinutes(appSession.steps),
            };
        }),
    }));
    const weeks = weekBundles.map((week) => ({
        weekIndex: week.weekIndex,
        phase: week.phase,
        sessions: week.sessions.map((session) => session.report),
    }));
    const allSessions = weekBundles.flatMap((week) => week.sessions);
    const finalWeekSessions = weekBundles[weekBundles.length - 1]?.sessions ?? [];
    const priorSessions = allSessions.filter((session) => session.weekIndex < (finalWeekSessions[0]?.weekIndex ?? 0));
    const { warnings, diagnostics } = evaluatePlanWarnings(fixture, finalWeekSessions, priorSessions);
    return {
        profileId: fixture.profileId,
        profileName: fixture.profileName,
        profileSummary: {
            goalDistance: fixture.goal.distance,
            goalType: fixture.goal.goalType ?? "complete",
            daysPerWeek: fixture.goal.availableTrainingDays?.length ?? fixture.runnerProfile.realisticTrainingDaysPerWeek ?? fixture.runnerProfile.currentRunsPerWeek ?? 3,
            currentLevel: currentLevelLabel(fixture.runnerProfile.currentRunningAbility),
            archetype: coachProfile.archetype,
            notes: fixture.runnerProfile.userTrainingContext || "Ingen ekstra noter.",
        },
        planSummary: {
            totalWeeks: coachPlan.weeks.length,
            phaseSequence,
            weeklySessionCounts,
            longestWorkoutMin,
            hasIntervals: coachPlan.sessions.some((session) => isIntervalType(session.type)),
        },
        qualityDiagnostics: diagnostics,
        warnings,
        weeks,
        flags: {
            hasOddAdjacentIdenticalBlocks: allSessions.some((session) => session.report.intervalAnalysis.notes.includes("Sammenhaengende loeb er delt op pa en unaturlig made.")),
            hasVeryShortWorkIntervals: allSessions.some((session) => shouldFlagShortWork(session.coachSession.type) && session.report.intervalAnalysis.workBlocks.some((block) => block.durationSec < 60)),
            hasVeryShortRecoveries: allSessions.some((session) => shouldFlagShortWork(session.coachSession.type) && session.report.intervalAnalysis.recoveryBlocks.some((block) => block.durationSec < 45)),
            hasCoachingMismatch: allSessions.some((session) => session.report.intervalAnalysis.hasCoachingMismatch),
            hasSuspiciousSessionShapes: allSessions.some((session) => session.report.intervalAnalysis.notes.length > 0),
        },
    };
}
function buildBenchmarkReports(fixtures = exports.benchmarkReportFixtures) {
    return fixtures.map(buildBenchmarkReport);
}
function buildPlanQualitySummary(reports) {
    const warningTypes = Object.fromEntries(WARNING_TYPES.map((type) => [type, 0]));
    reports.forEach((report) => {
        report.warnings.forEach((warning) => {
            warningTypes[warning] += 1;
        });
    });
    return {
        profilesTested: reports.length,
        profilesWithWarnings: reports.filter((report) => report.warnings.length > 0).length,
        warningTypes,
        profiles: reports.map((report) => ({
            profileId: report.profileId,
            profileName: report.profileName,
            goalDistance: report.profileSummary.goalDistance,
            goalType: report.profileSummary.goalType,
            daysPerWeek: report.profileSummary.daysPerWeek,
            archetype: report.profileSummary.archetype,
            warnings: report.warnings,
            planSummary: {
                totalWeeks: report.planSummary.totalWeeks,
                goalWeek: report.qualityDiagnostics.goalWeek,
                longestPriorRunMin: report.qualityDiagnostics.longestPriorRunMin,
                longestPriorKeyRunMin: report.qualityDiagnostics.longestPriorKeyRunMin,
                goalDayRunMin: report.qualityDiagnostics.goalDayRunMin,
            },
            destinationSessionSummary: report.qualityDiagnostics.destinationSessionSummary,
            finalWeekSessionSummaries: report.qualityDiagnostics.finalWeekSessionSummaries,
        })),
    };
}
function padTimestampPart(value) {
    return `${value}`.padStart(2, "0");
}
function formatBenchmarkRunTimestamp(date = new Date()) {
    const year = date.getFullYear();
    const month = padTimestampPart(date.getMonth() + 1);
    const day = padTimestampPart(date.getDate());
    const hours = padTimestampPart(date.getHours());
    const minutes = padTimestampPart(date.getMinutes());
    const seconds = padTimestampPart(date.getSeconds());
    return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}
function createTimestampedBenchmarkOutputDir(rootDir, date = new Date()) {
    fs_1.default.mkdirSync(rootDir, { recursive: true });
    let attempt = 0;
    let outputDir = path_1.default.join(rootDir, formatBenchmarkRunTimestamp(date));
    while (fs_1.default.existsSync(outputDir)) {
        attempt += 1;
        outputDir = path_1.default.join(rootDir, `${formatBenchmarkRunTimestamp(date)}_${String(attempt).padStart(2, "0")}`);
    }
    fs_1.default.mkdirSync(outputDir, { recursive: true });
    return outputDir;
}
function writeBenchmarkReports(outputDir, fixtures = exports.benchmarkReportFixtures) {
    const reports = buildBenchmarkReports(fixtures);
    const summary = buildPlanQualitySummary(reports);
    fs_1.default.mkdirSync(outputDir, { recursive: true });
    const index = reports.map((report, index) => ({
        profileId: report.profileId,
        profileName: report.profileName,
        file: `profile-${String(index + 1).padStart(2, "0")}-${slugify(report.profileName)}.json`,
        hasIntervals: report.planSummary.hasIntervals,
        warnings: report.warnings,
        flags: report.flags,
    }));
    index.forEach((entry, reportIndex) => {
        fs_1.default.writeFileSync(path_1.default.join(outputDir, entry.file), `${JSON.stringify(reports[reportIndex], null, 2)}\n`, "utf8");
    });
    fs_1.default.writeFileSync(path_1.default.join(outputDir, "index.json"), `${JSON.stringify(index, null, 2)}\n`, "utf8");
    fs_1.default.writeFileSync(path_1.default.join(outputDir, "plan-quality-summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    return reports;
}
