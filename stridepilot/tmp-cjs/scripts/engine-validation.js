"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const coach_1 = require("../src/lib/coach");
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
function buildAppPlan(persona) {
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
    const coachGoal = deriveCoachGoal(persona.goal, persona.runnerProfile);
    return (0, mapToAppPlan_1.mapCoachPlanToAppPlan)((0, build5kPlan_1.buildGoalPlan)(coachProfile, coachGoal), coachGoal);
}
function sessionType(session) {
    const text = `${session.title} ${session.notes ?? ""}`.toLowerCase();
    if (text.includes("interval"))
        return "interval";
    if (text.includes("tempo"))
        return "tempo";
    if (text.includes("strides"))
        return "strides";
    if (text.includes("benchmark"))
        return "benchmark";
    if (text.includes("lang") || text.includes("udholdenhed") || text.includes("long"))
        return "long";
    if (text.includes("recovery"))
        return "recovery";
    if (text.includes("run-walk"))
        return "run-walk";
    return "easy";
}
function runMinutes(session) {
    return Math.round(session.steps.filter((step) => step.type === "run").reduce((sum, step) => sum + step.durationSec, 0) / 60);
}
function weekNumbers(plan) {
    return [...new Set(plan.sessions.map((session) => session.week))].sort((a, b) => a - b);
}
function weekSessions(plan, week) {
    return plan.sessions.filter((session) => session.week === week);
}
function weekLoad(plan, week) {
    return weekSessions(plan, week).reduce((sum, session) => sum + session.loadScore, 0);
}
function longRunMinutesForWeek(plan, week) {
    return Math.max(0, ...weekSessions(plan, week).filter((session) => sessionType(session) === "long").map(runMinutes));
}
function formatWeekMix(plan, week) {
    const sessions = weekSessions(plan, week);
    if (sessions.length === 0)
        return "ingen pas";
    return sessions.map((session) => `${sessionType(session)} ${runMinutes(session)}`).join(" · ");
}
function workoutCounts(plan) {
    return plan.sessions.reduce((acc, session) => {
        const type = sessionType(session);
        acc[type] = (acc[type] ?? 0) + 1;
        return acc;
    }, {});
}
function average(values) {
    if (values.length === 0)
        return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}
function severityRank(severity) {
    if (severity === "critical")
        return 0;
    if (severity === "important")
        return 1;
    return 2;
}
function expectedQualityDensity(persona) {
    const totalWeeks = weekNumbers(buildAppPlan(persona)).length;
    if (persona.goal.distance === "5K" && (persona.goal.goalType === "pr" || persona.goal.goalType === "target_time")) {
        return { minQualityWeeks: Math.max(3, Math.floor(totalWeeks * 0.45)), note: "5K performance should carry frequent specific quality." };
    }
    if ((persona.goal.distance === "Halvmaraton" || persona.goal.distance === "Marathon") && (persona.goal.goalType === "pr" || persona.goal.goalType === "target_time")) {
        return { minQualityWeeks: Math.max(4, Math.floor(totalWeeks * 0.5)), note: "Longer-distance performance plans should keep regular tempo/steady work." };
    }
    if (persona.goal.goalType === "complete" || persona.goal.goalType === "run_without_walking") {
        return { minQualityWeeks: 0, note: "Finish-oriented plans can stay mostly aerobic." };
    }
    return { minQualityWeeks: Math.max(2, Math.floor(totalWeeks * 0.3)), note: "Improvement plans should still show some specificity." };
}
function evaluatePlanQuality(persona, plan) {
    const findings = [];
    const counts = workoutCounts(plan);
    const weeks = weekNumbers(plan);
    const weekLoads = weeks.map((week) => weekLoad(plan, week));
    const longRuns = weeks.map((week) => longRunMinutesForWeek(plan, week));
    const qualityWeeks = weeks.filter((week) => weekSessions(plan, week).some((session) => ["interval", "tempo", "strides"].includes(sessionType(session)))).length;
    const performanceGoal = persona.goal.goalType === "pr" || persona.goal.goalType === "target_time";
    const strongBackground = persona.runnerProfile.runningExperience === "ovet" ||
        (persona.runnerProfile.currentWeeklyVolumeKm ?? 0) >= 35 ||
        ((persona.runnerProfile.currentRunsPerWeek ?? 0) >= 4 && (persona.runnerProfile.longestCurrentRunMin ?? 0) >= 60);
    const beginnerLike = persona.runnerProfile.runningExperience === "nybegynder" ||
        (persona.runnerProfile.currentWeeklyVolumeKm ?? 0) <= 10 ||
        persona.runnerProfile.currentRunningAbility === "helt_ny";
    if (strongBackground && (counts["run-walk"] ?? 0) > 0) {
        findings.push({ severity: "critical", area: "engine", summary: "Run-walk appears in a clearly strong-background plan.", scenarioId: persona.id });
    }
    if (persona.goal.distance === "10K" && persona.goal.goalType === "complete" && (persona.runnerProfile.longestCurrentRunMin ?? 0) >= 30 && (counts["run-walk"] ?? 0) > 0) {
        findings.push({ severity: "important", area: "engine", summary: "10K finish plan still uses run-walk despite meaningful running background.", scenarioId: persona.id });
    }
    if (strongBackground) {
        const absurdlyShort = plan.sessions.some((session) => {
            const type = sessionType(session);
            return ["easy", "tempo", "interval", "long"].includes(type) && runMinutes(session) < 18;
        });
        if (absurdlyShort) {
            findings.push({ severity: "important", area: "engine", summary: "One or more sessions are implausibly short for a strong runner.", scenarioId: persona.id });
        }
    }
    const tooLongQuality = plan.sessions.some((session) => {
        const type = sessionType(session);
        const minutes = runMinutes(session);
        if (type === "interval") {
            if (persona.goal.distance === "5K")
                return minutes > 50;
            if (persona.goal.distance === "10K")
                return minutes > 60;
            if (persona.goal.distance === "Halvmaraton")
                return minutes > 65;
            return minutes > 70;
        }
        if (type === "tempo") {
            if (persona.goal.distance === "5K")
                return minutes > 45;
            if (persona.goal.distance === "10K")
                return minutes > 55;
            if (persona.goal.distance === "Halvmaraton")
                return minutes > 65;
            return minutes > 75;
        }
        return false;
    });
    if (tooLongQuality) {
        findings.push({ severity: "critical", area: "engine", summary: "Quality session duration exceeds believable coaching limits.", scenarioId: persona.id });
    }
    const expected = expectedQualityDensity(persona);
    if (performanceGoal && qualityWeeks < expected.minQualityWeeks) {
        findings.push({ severity: "important", area: "engine", summary: `Quality density is low for the goal type. ${expected.note}`, scenarioId: persona.id });
    }
    if (persona.goal.distance === "Marathon" && performanceGoal && (counts.tempo ?? 0) < 3) {
        findings.push({ severity: "important", area: "engine", summary: "Marathon performance plan lacks enough marathon-steady / tempo support.", scenarioId: persona.id });
    }
    if (persona.goal.distance === "5K" && performanceGoal) {
        const peakWeek = weeks.reduce((best, week) => (weekLoad(plan, week) > weekLoad(plan, best) ? week : best), weeks[0]);
        const peakLong = longRunMinutesForWeek(plan, peakWeek);
        const peakQualityMinutes = weekSessions(plan, peakWeek)
            .filter((session) => ["interval", "tempo", "strides"].includes(sessionType(session)))
            .reduce((sum, session) => sum + runMinutes(session), 0);
        if (strongBackground && peakQualityMinutes < 45) {
            findings.push({ severity: "important", area: "engine", summary: "Strong 5K performance plan still lacks enough specific quality in peak week.", scenarioId: persona.id });
        }
        if (strongBackground && peakLong > 75) {
            findings.push({ severity: "important", area: "engine", summary: "Long run still dominates too much in a strong 5K plan.", scenarioId: persona.id });
        }
    }
    const weekLoadJumps = weekLoads.slice(1).filter((load, index) => weekLoads[index] > 0 && (load - weekLoads[index]) / weekLoads[index] > 0.28).length;
    if (weekLoadJumps > 0) {
        findings.push({ severity: "important", area: "engine", summary: "Weekly load shows one or more abrupt jumps.", scenarioId: persona.id });
    }
    const longRunJumps = longRuns.slice(1).filter((minutes, index) => longRuns[index] > 0 && (minutes - longRuns[index]) / longRuns[index] > 0.22).length;
    if (longRunJumps > 0) {
        findings.push({ severity: "important", area: "engine", summary: "Long-run progression includes one or more abrupt jumps.", scenarioId: persona.id });
    }
    if (beginnerLike && performanceGoal && (counts.interval ?? 0) >= 3 && (persona.runnerProfile.currentWeeklyVolumeKm ?? 0) < 15) {
        findings.push({ severity: "important", area: "engine", summary: "Beginner-like runner still receives a fairly aggressive quality mix.", scenarioId: persona.id });
    }
    const summaryParts = [
        `frequency ${average(weeks.map((week) => weekSessions(plan, week).length)).toFixed(1)} pas/uge`,
        `quality weeks ${qualityWeeks}/${weeks.length}`,
        `peak long run ${Math.max(0, ...longRuns)} min`,
        `mix ${Object.entries(counts)
            .map(([key, value]) => `${key}:${value}`)
            .join(", ")}`,
    ];
    return {
        summary: summaryParts.join(" · "),
        findings,
    };
}
function evaluateProgression(persona, plan) {
    const findings = [];
    const weeks = weekNumbers(plan);
    const weekLoads = weeks.map((week) => ({ week, load: weekLoad(plan, week) }));
    const peak = weekLoads.reduce((best, current) => (current.load > best.load ? current : best), weekLoads[0]);
    const checkpointCandidates = [
        { label: "week 1", week: weeks[0] },
        { label: "early build", week: weeks[Math.min(1, weeks.length - 1)] ?? weeks[0] },
        { label: "mid build", week: weeks[Math.floor((weeks.length - 1) / 2)] ?? weeks[0] },
        { label: "peak week", week: peak.week },
        { label: "final week", week: weeks[weeks.length - 1] },
    ];
    const checkpoints = checkpointCandidates
        .filter((item, index, array) => array.findIndex((other) => other.week === item.week) === index)
        .map((item) => ({
        label: item.label,
        week: item.week,
        load: weekLoad(plan, item.week),
        mix: formatWeekMix(plan, item.week),
        longRun: longRunMinutesForWeek(plan, item.week),
    }));
    const cutbackWeeks = weeks.filter((week, index) => index > 0 && weekLoad(plan, week) < weekLoad(plan, weeks[index - 1]) * 0.92);
    if (weeks.length >= 10 && cutbackWeeks.length === 0) {
        findings.push({ severity: "important", area: "engine", summary: "Longer block lacks a meaningful cutback / stabilization week.", scenarioId: persona.id });
    }
    if (peak.week === weeks[0]) {
        findings.push({ severity: "important", area: "engine", summary: "Peak week appears immediately instead of later in the block.", scenarioId: persona.id });
    }
    if (weeks.length >= 6 && weekLoad(plan, weeks[weeks.length - 1]) >= peak.load * 0.95 && persona.goal.goalType !== "complete") {
        findings.push({ severity: "important", area: "engine", summary: "Final week does not taper enough relative to peak load.", scenarioId: persona.id });
    }
    if (persona.goal.distance === "Halvmaraton" || persona.goal.distance === "Marathon") {
        const tempoAppearLater = checkpoints.some((checkpoint) => checkpoint.label !== "week 1" && checkpoint.mix.includes("tempo"));
        if (!tempoAppearLater && (persona.goal.goalType === "pr" || persona.goal.goalType === "target_time")) {
            findings.push({ severity: "important", area: "engine", summary: "Longer-distance performance plan does not become specific enough later in the block.", scenarioId: persona.id });
        }
    }
    const longRunProgression = checkpoints.map((checkpoint) => checkpoint.longRun);
    if (persona.goal.distance === "Marathon" && (persona.runnerProfile.longestCurrentRunMin ?? 0) >= 100 && Math.max(...longRunProgression) < 110) {
        findings.push({ severity: "important", area: "engine", summary: "Strong marathon plan does not build long run enough beyond the current background.", scenarioId: persona.id });
    }
    const summary = `cutbacks ${cutbackWeeks.length} · peak week ${peak.week} load ${peak.load} · final week load ${weekLoad(plan, weeks[weeks.length - 1])}`;
    return { summary, findings, checkpoints };
}
function selectSession(plan, target) {
    const sessions = [...plan.sessions].sort((a, b) => a.week - b.week);
    if (target === "long") {
        return sessions.find((session) => sessionType(session) === "long") ?? sessions[0];
    }
    if (target === "quality") {
        return sessions.find((session) => ["interval", "tempo", "strides"].includes(sessionType(session))) ?? sessions[0];
    }
    return sessions[0];
}
function raceSpecificityLooksPreserved(plan, persona) {
    const nextWeek = weekNumbers(plan)[0];
    const mix = formatWeekMix(plan, nextWeek);
    if (persona.goal.distance === "5K") {
        return mix.includes("interval") || mix.includes("tempo") || mix.includes("strides") ? "yes" : "partly";
    }
    if (persona.goal.distance === "Halvmaraton" || persona.goal.distance === "Marathon") {
        return mix.includes("tempo") || mix.includes("long") ? "yes" : "partly";
    }
    return mix.includes("long") ? "yes" : "partly";
}
function judgeAdaptation(mode, beforeMix, afterMix) {
    if (mode === "recovery_microcycle")
        return "Coach-like and clearly caution-oriented.";
    if (mode === "down_shift")
        return beforeMix !== afterMix ? "Coach-like and structurally lighter." : "A bit too cosmetic.";
    if (mode === "resume_build")
        return "Coach-like if the rebuild remains controlled.";
    if (mode === "progress")
        return "Useful if the extra challenge becomes more specific, not just more load.";
    return "Stable and acceptable if feedback was neutral.";
}
function runAdaptationPattern(persona, pattern) {
    let plan = buildAppPlan(persona);
    let capability = (0, coach_1.createInitialCapabilityState)(plan);
    let mode = "hold";
    let reason = "";
    let lastResult = null;
    const before = formatWeekMix(plan, weekNumbers(plan)[0]);
    for (const feedback of pattern.feedbacks) {
        const session = selectSession(plan, feedback.target);
        const result = (0, coach_1.adaptPlanFromFeedback)(plan, { ...feedback, sessionId: session.id }, capability);
        capability = result.capability;
        plan = result.plan;
        mode = capability.lastAdaptationMode;
        reason = capability.lastAdaptationReason ?? "";
        lastResult = result;
    }
    return {
        mode,
        reason,
        before,
        after: formatWeekMix(plan, weekNumbers(plan)[0]),
        specificity: raceSpecificityLooksPreserved(plan, persona),
        traits: capability.traits,
        rationale: lastResult?.rationale,
    };
}
function simulateDivergence(persona, feedbacks) {
    let plan = buildAppPlan(persona);
    let capability = (0, coach_1.createInitialCapabilityState)(plan);
    let lastResult = null;
    for (const feedback of feedbacks) {
        const session = selectSession(plan, feedback.target);
        const result = (0, coach_1.adaptPlanFromFeedback)(plan, { ...feedback, sessionId: session.id }, capability);
        capability = result.capability;
        plan = result.plan;
        lastResult = result;
    }
    return {
        plan,
        capability,
        nextWeekMix: formatWeekMix(plan, weekNumbers(plan)[0]),
        nextWeekLoad: weekLoad(plan, weekNumbers(plan)[0]),
        rationale: lastResult?.rationale,
    };
}
const personas = [
    {
        id: "beginner_5k_finish",
        name: "true beginner, 5K finish",
        category: "beginner",
        runnerProfile: { age: 39, heightCm: 168, weightKg: 84, activityLevel: "lav", runningExperience: "nybegynder", currentRunsPerWeek: 0, currentWeeklyVolumeKm: 0, longestCurrentRunMin: 0, realisticTrainingDaysPerWeek: 3, typicalWorkoutMinutes: 35, currentRunningAbility: "helt_ny", userTrainingContext: "Jeg bliver hurtigt forpustet og har aldrig rigtig løbet før." },
        goal: { distance: "5K", goalType: "complete", weeks: 10, startDate: "2026-04-01", endDate: "2026-06-10", availableTrainingDays: ["Tirsdag", "Torsdag", "Lordag"] },
    },
    {
        id: "beginner_5k_no_walk",
        name: "beginner, 5K without walking",
        category: "beginner",
        runnerProfile: { age: 31, heightCm: 175, weightKg: 76, activityLevel: "moderat", runningExperience: "nybegynder", currentRunsPerWeek: 2, currentWeeklyVolumeKm: 8, longestCurrentRunMin: 18, realisticTrainingDaysPerWeek: 3, typicalWorkoutMinutes: 40, currentRunningAbility: "ti_femten_min", weakPoints: "Jeg mister hurtigt rytmen hvis passene bliver for hårde.", userTrainingContext: "Jeg kan løbe korte ture men vil gerne kunne løbe en hel 5 km uden gang." },
        goal: { distance: "5K", goalType: "run_without_walking", weeks: 10, startDate: "2026-04-01", endDate: "2026-06-10", availableTrainingDays: ["Tirsdag", "Torsdag", "Lordag"] },
    },
    {
        id: "beginner_10k_finish",
        name: "beginner, 10K finish",
        category: "beginner",
        runnerProfile: { age: 42, heightCm: 172, weightKg: 79, activityLevel: "lav", runningExperience: "nybegynder", currentRunsPerWeek: 2, currentWeeklyVolumeKm: 10, longestCurrentRunMin: 25, realisticTrainingDaysPerWeek: 3, typicalWorkoutMinutes: 45, currentRunningAbility: "ti_femten_min", userTrainingContext: "Jeg vil gerne bygge roligt fra korte ture til 10 km." },
        goal: { distance: "10K", goalType: "complete", weeks: 12, startDate: "2026-04-01", endDate: "2026-06-24", availableTrainingDays: ["Tirsdag", "Torsdag", "Lordag"] },
    },
    {
        id: "fragile_beginner",
        name: "fragile beginner with pain/caution signals",
        category: "beginner",
        runnerProfile: { age: 45, heightCm: 169, weightKg: 82, activityLevel: "lav", runningExperience: "nybegynder", currentRunsPerWeek: 1, currentWeeklyVolumeKm: 5, longestCurrentRunMin: 15, realisticTrainingDaysPerWeek: 3, typicalWorkoutMinutes: 35, currentRunningAbility: "fem_min", injuryHistory: "Tidligere akillessene-irritation.", weakPoints: "Jeg bliver hurtigt øm i underbenene.", userTrainingContext: "Jeg vil gerne i gang, men er også lidt nervøs for at overdrive." },
        goal: { distance: "5K", goalType: "complete", weeks: 10, startDate: "2026-04-01", endDate: "2026-06-10", availableTrainingDays: ["Mandag", "Onsdag", "Lordag"] },
    },
    {
        id: "light_intermediate_5k",
        name: "light intermediate, 5K improver",
        category: "intermediate",
        runnerProfile: { age: 29, heightCm: 180, weightKg: 73, activityLevel: "moderat", runningExperience: "let_ovet", currentRunsPerWeek: 3, currentWeeklyVolumeKm: 18, longestCurrentRunMin: 40, realisticTrainingDaysPerWeek: 3, typicalWorkoutMinutes: 50, currentRunningAbility: "mere_end_tredive_min", userTrainingContext: "Jeg løber stabilt og vil gerne forbedre min 5 km tid uden at overdrive." },
        goal: { distance: "5K", goalType: "pr", weeks: 10, startDate: "2026-04-01", endDate: "2026-06-10", availableTrainingDays: ["Tirsdag", "Torsdag", "Lordag"], targetTime: "23:30" },
    },
    {
        id: "intermediate_10k_improve",
        name: "intermediate, 10K improver",
        category: "intermediate",
        runnerProfile: { age: 33, heightCm: 178, weightKg: 72, activityLevel: "moderat", runningExperience: "let_ovet", currentRunsPerWeek: 4, currentWeeklyVolumeKm: 26, longestCurrentRunMin: 55, realisticTrainingDaysPerWeek: 4, typicalWorkoutMinutes: 55, currentRunningAbility: "mere_end_tredive_min", userTrainingContext: "Jeg vil gerne flytte min 10 km tid, men stadig holde planen realistisk." },
        goal: { distance: "10K", goalType: "pr", weeks: 12, startDate: "2026-04-01", endDate: "2026-06-24", availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"], targetTime: "45:00" },
    },
    {
        id: "intermediate_hm_improve",
        name: "intermediate, HM improver",
        category: "intermediate",
        runnerProfile: { age: 34, heightCm: 177, weightKg: 71, activityLevel: "moderat", runningExperience: "let_ovet", currentRunsPerWeek: 4, currentWeeklyVolumeKm: 32, longestCurrentRunMin: 75, realisticTrainingDaysPerWeek: 4, typicalWorkoutMinutes: 65, currentRunningAbility: "mere_end_tredive_min", weakPoints: "Kan blive træt i baglårene hvis progressionen bliver for stejl.", userTrainingContext: "Jeg vil gerne løbe halvmaraton stærkt men stadig med god kontrol." },
        goal: { distance: "Halvmaraton", goalType: "pr", weeks: 14, startDate: "2026-04-01", endDate: "2026-07-08", availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"], targetTime: "1:42:00" },
    },
    {
        id: "intermediate_hm_inconsistent",
        name: "intermediate, HM runner with inconsistent compliance",
        category: "intermediate",
        runnerProfile: { age: 37, heightCm: 181, weightKg: 77, activityLevel: "moderat", runningExperience: "let_ovet", currentRunsPerWeek: 3, currentWeeklyVolumeKm: 24, longestCurrentRunMin: 65, realisticTrainingDaysPerWeek: 4, typicalWorkoutMinutes: 60, currentRunningAbility: "mere_end_tredive_min", weakPoints: "Travl hverdag og svært ved at ramme alle pas.", userTrainingContext: "Jeg vil gerne løbe halvmaraton igen, men jeg misser ofte et pas hist og her." },
        goal: { distance: "Halvmaraton", goalType: "complete", weeks: 14, startDate: "2026-04-01", endDate: "2026-07-08", availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"] },
    },
    {
        id: "experienced_5k_target",
        name: "experienced, 5K target-time runner",
        category: "experienced",
        runnerProfile: { age: 36, heightCm: 182, weightKg: 74, activityLevel: "høj", runningExperience: "ovet", currentRunsPerWeek: 5, currentWeeklyVolumeKm: 48, longestCurrentRunMin: 85, realisticTrainingDaysPerWeek: 4, typicalWorkoutMinutes: 70, currentRunningAbility: "mere_end_tredive_min", weakPoints: "Lidt stramme lægge efter hårde banepas.", userTrainingContext: "Jeg har løbet i flere år og vil gerne løbe 5 km markant hurtigere." },
        goal: { distance: "5K", goalType: "target_time", weeks: 8, startDate: "2026-04-01", endDate: "2026-05-27", availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"], targetTime: "19:30" },
    },
    {
        id: "experienced_hm_pr",
        name: "experienced, HM PR runner",
        category: "experienced",
        runnerProfile: { age: 35, heightCm: 183, weightKg: 72, activityLevel: "høj", runningExperience: "ovet", currentRunsPerWeek: 5, currentWeeklyVolumeKm: 52, longestCurrentRunMin: 95, realisticTrainingDaysPerWeek: 4, typicalWorkoutMinutes: 75, currentRunningAbility: "mere_end_tredive_min", userTrainingContext: "Jeg vil løbe en hurtigere halvmaraton og tåler en del træning allerede." },
        goal: { distance: "Halvmaraton", goalType: "pr", weeks: 14, startDate: "2026-04-01", endDate: "2026-07-08", availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"], targetTime: "1:29:00" },
    },
    {
        id: "experienced_marathon_finish",
        name: "experienced, Marathon finisher",
        category: "experienced",
        runnerProfile: { age: 38, heightCm: 185, weightKg: 79, activityLevel: "høj", runningExperience: "ovet", currentRunsPerWeek: 5, currentWeeklyVolumeKm: 58, longestCurrentRunMin: 120, realisticTrainingDaysPerWeek: 4, typicalWorkoutMinutes: 80, currentRunningAbility: "mere_end_tredive_min", userTrainingContext: "Jeg har løbet flere halvmaraton og vil bygge mod maraton på en stabil måde." },
        goal: { distance: "Marathon", goalType: "complete", weeks: 18, startDate: "2026-04-01", endDate: "2026-08-05", availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"] },
    },
    {
        id: "experienced_marathon_target",
        name: "experienced, Marathon target-oriented runner",
        category: "experienced",
        runnerProfile: { age: 40, heightCm: 179, weightKg: 70, activityLevel: "høj", runningExperience: "ovet", currentRunsPerWeek: 5, currentWeeklyVolumeKm: 65, longestCurrentRunMin: 130, realisticTrainingDaysPerWeek: 4, typicalWorkoutMinutes: 85, currentRunningAbility: "mere_end_tredive_min", userTrainingContext: "Jeg vil løbe en mere målrettet maraton og tåler relativt høj volumen." },
        goal: { distance: "Marathon", goalType: "target_time", weeks: 18, startDate: "2026-04-01", endDate: "2026-08-05", availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"], targetTime: "3:20:00" },
    },
    {
        id: "ambitious_short_timeframe",
        name: "unrealistic ambitious target in short timeframe",
        category: "edge",
        runnerProfile: { age: 28, heightCm: 176, weightKg: 75, activityLevel: "lav", runningExperience: "nybegynder", currentRunsPerWeek: 2, currentWeeklyVolumeKm: 10, longestCurrentRunMin: 25, realisticTrainingDaysPerWeek: 3, typicalWorkoutMinutes: 40, currentRunningAbility: "ti_femten_min", userTrainingContext: "Jeg vil gerne gå all-in og løbe en hurtig halvmaraton snart." },
        goal: { distance: "Halvmaraton", goalType: "target_time", weeks: 6, startDate: "2026-04-01", endDate: "2026-05-13", availableTrainingDays: ["Tirsdag", "Torsdag", "Lordag"], targetTime: "1:28:00" },
    },
    {
        id: "low_volume_aggressive_goal",
        name: "low-volume runner with aggressive goal intent",
        category: "edge",
        runnerProfile: { age: 32, heightCm: 174, weightKg: 74, activityLevel: "lav", runningExperience: "let_ovet", currentRunsPerWeek: 2, currentWeeklyVolumeKm: 14, longestCurrentRunMin: 35, realisticTrainingDaysPerWeek: 3, typicalWorkoutMinutes: 45, currentRunningAbility: "tyve_tredive_min", userTrainingContext: "Jeg vil gerne løbe hurtigere hurtigt, men har ikke så meget volumen lige nu." },
        goal: { distance: "10K", goalType: "target_time", weeks: 8, startDate: "2026-04-01", endDate: "2026-05-27", availableTrainingDays: ["Tirsdag", "Torsdag", "Lordag"], targetTime: "42:00" },
    },
    {
        id: "strong_runner_long_run_struggle",
        name: "strong runner with repeated long-run struggles",
        category: "edge",
        runnerProfile: { age: 41, heightCm: 181, weightKg: 73, activityLevel: "høj", runningExperience: "ovet", currentRunsPerWeek: 5, currentWeeklyVolumeKm: 55, longestCurrentRunMin: 110, realisticTrainingDaysPerWeek: 4, typicalWorkoutMinutes: 80, currentRunningAbility: "mere_end_tredive_min", weakPoints: "Long runs kan koste meget hvis progressionen bliver for stejl.", userTrainingContext: "Jeg er stærk generelt, men de lange ture er ofte det der knækker mig." },
        goal: { distance: "Marathon", goalType: "complete", weeks: 18, startDate: "2026-04-01", endDate: "2026-08-05", availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"] },
    },
    {
        id: "runner_too_easy_good_recovery",
        name: "runner with repeated too-easy signals and good recovery",
        category: "edge",
        runnerProfile: { age: 30, heightCm: 178, weightKg: 69, activityLevel: "høj", runningExperience: "let_ovet", currentRunsPerWeek: 4, currentWeeklyVolumeKm: 30, longestCurrentRunMin: 60, realisticTrainingDaysPerWeek: 4, typicalWorkoutMinutes: 60, currentRunningAbility: "mere_end_tredive_min", userTrainingContext: "Jeg tager tit mere overskud med ud af passene end forventet." },
        goal: { distance: "5K", goalType: "pr", weeks: 10, startDate: "2026-04-01", endDate: "2026-06-10", availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"], targetTime: "21:30" },
    },
];
const adaptationPatterns = [
    {
        name: "repeated too hard",
        personaId: "light_intermediate_5k",
        feedbacks: [
            { target: "quality", completed: true, difficulty: "hard", energy: "low", pain: "mild", completionPct: 92, effort: 8, adaptationFactor: 0.95, progressionPauseWeeks: 0, noteCaution: false },
            { target: "quality", completed: true, difficulty: "very_hard", energy: "low", pain: "mild", completionPct: 88, effort: 9, adaptationFactor: 0.92, progressionPauseWeeks: 1, noteCaution: true },
            { target: "quality", completed: true, difficulty: "hard", energy: "normal", pain: "mild", completionPct: 90, effort: 8, adaptationFactor: 0.94, progressionPauseWeeks: 0, noteCaution: false },
        ],
    },
    {
        name: "repeated too easy",
        personaId: "experienced_5k_target",
        feedbacks: [
            { target: "quality", completed: true, difficulty: "easy", energy: "high", pain: "none", completionPct: 100, effort: 4, adaptationFactor: 1.04, progressionPauseWeeks: 0, noteCaution: false },
            { target: "quality", completed: true, difficulty: "easy", energy: "high", pain: "none", completionPct: 100, effort: 4, adaptationFactor: 1.05, progressionPauseWeeks: 0, noteCaution: false },
            { target: "quality", completed: true, difficulty: "easy", energy: "high", pain: "none", completionPct: 98, effort: 4, adaptationFactor: 1.05, progressionPauseWeeks: 0, noteCaution: false },
        ],
    },
    {
        name: "repeated missed runs",
        personaId: "intermediate_hm_inconsistent",
        feedbacks: [
            { target: "any", completed: false, difficulty: "hard", energy: "low", pain: "mild", completionPct: 40, effort: 8, adaptationFactor: 0.92, progressionPauseWeeks: 1, noteCaution: true },
            { target: "any", completed: false, difficulty: "moderate", energy: "low", pain: "none", completionPct: 0, effort: 7, adaptationFactor: 0.9, progressionPauseWeeks: 1, noteCaution: true },
            { target: "any", completed: true, difficulty: "hard", energy: "low", pain: "mild", completionPct: 72, effort: 8, adaptationFactor: 0.94, progressionPauseWeeks: 1, noteCaution: true },
        ],
    },
    {
        name: "pain flag appearing",
        personaId: "fragile_beginner",
        feedbacks: [
            { target: "any", completed: true, difficulty: "hard", energy: "normal", pain: "moderate", completionPct: 84, effort: 8, adaptationFactor: 0.9, progressionPauseWeeks: 1, noteCaution: true },
            { target: "any", completed: true, difficulty: "hard", energy: "low", pain: "high", completionPct: 78, effort: 9, adaptationFactor: 0.85, progressionPauseWeeks: 2, noteCaution: true },
        ],
    },
    {
        name: "low-energy streak",
        personaId: "experienced_marathon_finish",
        feedbacks: [
            { target: "long", completed: true, difficulty: "moderate", energy: "low", pain: "none", completionPct: 95, effort: 7, adaptationFactor: 0.96, progressionPauseWeeks: 0, noteCaution: false },
            { target: "long", completed: true, difficulty: "hard", energy: "low", pain: "none", completionPct: 92, effort: 8, adaptationFactor: 0.94, progressionPauseWeeks: 0, noteCaution: false },
            { target: "any", completed: true, difficulty: "hard", energy: "low", pain: "none", completionPct: 90, effort: 8, adaptationFactor: 0.94, progressionPauseWeeks: 0, noteCaution: false },
        ],
    },
    {
        name: "one bad week followed by rebound",
        personaId: "intermediate_hm_improve",
        feedbacks: [
            { target: "quality", completed: true, difficulty: "very_hard", energy: "low", pain: "mild", completionPct: 82, effort: 9, adaptationFactor: 0.9, progressionPauseWeeks: 1, noteCaution: true },
            { target: "quality", completed: true, difficulty: "moderate", energy: "high", pain: "none", completionPct: 97, effort: 6, adaptationFactor: 1, progressionPauseWeeks: 0, noteCaution: false },
            { target: "any", completed: true, difficulty: "moderate", energy: "high", pain: "none", completionPct: 98, effort: 6, adaptationFactor: 1, progressionPauseWeeks: 0, noteCaution: false },
        ],
    },
    {
        name: "long-run struggles",
        personaId: "strong_runner_long_run_struggle",
        feedbacks: [
            { target: "long", completed: true, difficulty: "hard", energy: "low", pain: "mild", completionPct: 82, effort: 8, adaptationFactor: 0.94, progressionPauseWeeks: 0, noteCaution: true },
            { target: "long", completed: true, difficulty: "very_hard", energy: "low", pain: "moderate", completionPct: 76, effort: 9, adaptationFactor: 0.9, progressionPauseWeeks: 1, noteCaution: true },
            { target: "long", completed: true, difficulty: "hard", energy: "normal", pain: "mild", completionPct: 84, effort: 8, adaptationFactor: 0.95, progressionPauseWeeks: 0, noteCaution: true },
        ],
    },
    {
        name: "strong compliance + strong recovery",
        personaId: "runner_too_easy_good_recovery",
        feedbacks: [
            { target: "quality", completed: true, difficulty: "easy", energy: "high", pain: "none", completionPct: 100, effort: 4, adaptationFactor: 1.04, progressionPauseWeeks: 0, noteCaution: false },
            { target: "any", completed: true, difficulty: "moderate", energy: "high", pain: "none", completionPct: 100, effort: 5, adaptationFactor: 1.03, progressionPauseWeeks: 0, noteCaution: false },
            { target: "quality", completed: true, difficulty: "easy", energy: "high", pain: "none", completionPct: 100, effort: 4, adaptationFactor: 1.05, progressionPauseWeeks: 0, noteCaution: false },
        ],
    },
];
const beginnerSafetyScenarios = [
    {
        id: "cannot_run_1_min",
        label: "kan ikke løbe 1 minut sammenhængende",
        runnerProfile: {
            age: 41,
            heightCm: 171,
            weightKg: 86,
            activityLevel: "lav",
            runningExperience: "nybegynder",
            currentRunsPerWeek: 0,
            currentWeeklyVolumeKm: 0,
            longestCurrentRunMin: 0,
            realisticTrainingDaysPerWeek: 3,
            typicalWorkoutMinutes: 30,
            currentRunningAbility: "helt_ny",
            userTrainingContext: "Jeg kan ikke løbe et helt minut uden at stoppe og vil bare i gang stille og roligt.",
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
        id: "can_run_1_2_min",
        label: "kan løbe 1-2 minutter sammenhængende",
        runnerProfile: {
            age: 36,
            heightCm: 167,
            weightKg: 78,
            activityLevel: "lav",
            runningExperience: "nybegynder",
            currentRunsPerWeek: 0,
            currentWeeklyVolumeKm: 0,
            longestCurrentRunMin: 2,
            realisticTrainingDaysPerWeek: 3,
            typicalWorkoutMinutes: 30,
            currentRunningAbility: "helt_ny",
            userTrainingContext: "Jeg kan måske løbe et par minutter, men er meget tidligt i gang.",
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
        id: "can_run_5_min",
        label: "kan løbe cirka 5 minutter sammenhængende",
        runnerProfile: {
            age: 33,
            heightCm: 173,
            weightKg: 75,
            activityLevel: "lav",
            runningExperience: "nybegynder",
            currentRunsPerWeek: 1,
            currentWeeklyVolumeKm: 3,
            longestCurrentRunMin: 5,
            realisticTrainingDaysPerWeek: 3,
            typicalWorkoutMinutes: 35,
            currentRunningAbility: "fem_min",
            userTrainingContext: "Jeg kan løbe omkring fem minutter, men alt længere føles stadig nyt.",
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
];
const divergencePairs = [
    {
        name: "same 5K improver: one too easy, one too hard",
        personaId: "light_intermediate_5k",
        runnerA: {
            label: "repeatedly too easy",
            feedbacks: [
                { target: "quality", completed: true, difficulty: "easy", energy: "high", pain: "none", completionPct: 100, effort: 4, adaptationFactor: 1.04, progressionPauseWeeks: 0, noteCaution: false },
                { target: "quality", completed: true, difficulty: "easy", energy: "high", pain: "none", completionPct: 98, effort: 4, adaptationFactor: 1.05, progressionPauseWeeks: 0, noteCaution: false },
                { target: "quality", completed: true, difficulty: "easy", energy: "high", pain: "none", completionPct: 100, effort: 4, adaptationFactor: 1.05, progressionPauseWeeks: 0, noteCaution: false },
                { target: "quality", completed: true, difficulty: "moderate", energy: "high", pain: "none", completionPct: 100, effort: 5, adaptationFactor: 1.03, progressionPauseWeeks: 0, noteCaution: false },
            ],
        },
        runnerB: {
            label: "repeatedly too hard",
            feedbacks: [
                { target: "quality", completed: true, difficulty: "hard", energy: "low", pain: "mild", completionPct: 90, effort: 8, adaptationFactor: 0.95, progressionPauseWeeks: 0, noteCaution: false },
                { target: "quality", completed: true, difficulty: "very_hard", energy: "low", pain: "moderate", completionPct: 82, effort: 9, adaptationFactor: 0.9, progressionPauseWeeks: 1, noteCaution: true },
                { target: "quality", completed: true, difficulty: "hard", energy: "normal", pain: "mild", completionPct: 86, effort: 8, adaptationFactor: 0.94, progressionPauseWeeks: 0, noteCaution: true },
                { target: "quality", completed: true, difficulty: "hard", energy: "low", pain: "mild", completionPct: 84, effort: 8, adaptationFactor: 0.93, progressionPauseWeeks: 0, noteCaution: true },
            ],
        },
    },
    {
        name: "same HM runner: one completes, one misses",
        personaId: "intermediate_hm_improve",
        runnerA: {
            label: "consistent",
            feedbacks: [
                { target: "any", completed: true, difficulty: "moderate", energy: "high", pain: "none", completionPct: 98, effort: 6, adaptationFactor: 1, progressionPauseWeeks: 0, noteCaution: false },
                { target: "any", completed: true, difficulty: "moderate", energy: "normal", pain: "none", completionPct: 100, effort: 6, adaptationFactor: 1, progressionPauseWeeks: 0, noteCaution: false },
                { target: "any", completed: true, difficulty: "moderate", energy: "high", pain: "none", completionPct: 97, effort: 6, adaptationFactor: 1, progressionPauseWeeks: 0, noteCaution: false },
                { target: "any", completed: true, difficulty: "moderate", energy: "high", pain: "mild", completionPct: 96, effort: 6, adaptationFactor: 1, progressionPauseWeeks: 0, noteCaution: false },
            ],
        },
        runnerB: {
            label: "inconsistent",
            feedbacks: [
                { target: "any", completed: false, difficulty: "hard", energy: "low", pain: "mild", completionPct: 40, effort: 8, adaptationFactor: 0.92, progressionPauseWeeks: 1, noteCaution: true },
                { target: "any", completed: true, difficulty: "hard", energy: "low", pain: "mild", completionPct: 72, effort: 8, adaptationFactor: 0.95, progressionPauseWeeks: 1, noteCaution: true },
                { target: "any", completed: false, difficulty: "moderate", energy: "low", pain: "none", completionPct: 0, effort: 7, adaptationFactor: 0.9, progressionPauseWeeks: 1, noteCaution: true },
                { target: "any", completed: true, difficulty: "hard", energy: "normal", pain: "mild", completionPct: 78, effort: 8, adaptationFactor: 0.95, progressionPauseWeeks: 0, noteCaution: true },
            ],
        },
    },
    {
        name: "same Marathon runner: one handles long runs, one struggles",
        personaId: "experienced_marathon_finish",
        runnerA: {
            label: "long runs okay",
            feedbacks: [
                { target: "long", completed: true, difficulty: "moderate", energy: "normal", pain: "none", completionPct: 96, effort: 6, adaptationFactor: 1.01, progressionPauseWeeks: 0, noteCaution: false },
                { target: "long", completed: true, difficulty: "moderate", energy: "high", pain: "none", completionPct: 98, effort: 6, adaptationFactor: 1.02, progressionPauseWeeks: 0, noteCaution: false },
                { target: "long", completed: true, difficulty: "moderate", energy: "normal", pain: "mild", completionPct: 95, effort: 7, adaptationFactor: 1, progressionPauseWeeks: 0, noteCaution: false },
                { target: "long", completed: true, difficulty: "moderate", energy: "high", pain: "none", completionPct: 97, effort: 6, adaptationFactor: 1.02, progressionPauseWeeks: 0, noteCaution: false },
            ],
        },
        runnerB: {
            label: "long runs cost too much",
            feedbacks: [
                { target: "long", completed: true, difficulty: "hard", energy: "low", pain: "mild", completionPct: 82, effort: 8, adaptationFactor: 0.94, progressionPauseWeeks: 0, noteCaution: true },
                { target: "long", completed: true, difficulty: "very_hard", energy: "low", pain: "moderate", completionPct: 76, effort: 9, adaptationFactor: 0.9, progressionPauseWeeks: 1, noteCaution: true },
                { target: "long", completed: true, difficulty: "hard", energy: "low", pain: "mild", completionPct: 80, effort: 8, adaptationFactor: 0.93, progressionPauseWeeks: 1, noteCaution: true },
                { target: "long", completed: true, difficulty: "hard", energy: "normal", pain: "mild", completionPct: 84, effort: 8, adaptationFactor: 0.95, progressionPauseWeeks: 0, noteCaution: true },
            ],
        },
    },
    {
        name: "same beginner: one stabilizes, one becomes fragile",
        personaId: "beginner_5k_finish",
        runnerA: {
            label: "stabilizes",
            feedbacks: [
                { target: "any", completed: true, difficulty: "moderate", energy: "normal", pain: "none", completionPct: 92, effort: 6, adaptationFactor: 1, progressionPauseWeeks: 0, noteCaution: false },
                { target: "any", completed: true, difficulty: "moderate", energy: "high", pain: "none", completionPct: 95, effort: 6, adaptationFactor: 1.01, progressionPauseWeeks: 0, noteCaution: false },
                { target: "any", completed: true, difficulty: "moderate", energy: "normal", pain: "mild", completionPct: 94, effort: 6, adaptationFactor: 1, progressionPauseWeeks: 0, noteCaution: false },
                { target: "any", completed: true, difficulty: "easy", energy: "high", pain: "none", completionPct: 98, effort: 5, adaptationFactor: 1.02, progressionPauseWeeks: 0, noteCaution: false },
            ],
        },
        runnerB: {
            label: "fragile",
            feedbacks: [
                { target: "any", completed: true, difficulty: "hard", energy: "low", pain: "moderate", completionPct: 78, effort: 8, adaptationFactor: 0.92, progressionPauseWeeks: 1, noteCaution: true },
                { target: "any", completed: false, difficulty: "hard", energy: "low", pain: "moderate", completionPct: 40, effort: 8, adaptationFactor: 0.88, progressionPauseWeeks: 1, noteCaution: true },
                { target: "any", completed: true, difficulty: "hard", energy: "low", pain: "mild", completionPct: 75, effort: 8, adaptationFactor: 0.92, progressionPauseWeeks: 1, noteCaution: true },
                { target: "any", completed: true, difficulty: "hard", energy: "normal", pain: "moderate", completionPct: 80, effort: 8, adaptationFactor: 0.93, progressionPauseWeeks: 1, noteCaution: true },
            ],
        },
    },
];
function printSection(title) {
    console.log(`\n${title}`);
    console.log("-".repeat(title.length));
}
function personaProfileLine(persona) {
    return [
        `${persona.runnerProfile.runningExperience}`,
        `${persona.runnerProfile.currentRunsPerWeek ?? 0} pas/uge`,
        `${persona.runnerProfile.currentWeeklyVolumeKm ?? 0} km/uge`,
        `langtur ${persona.runnerProfile.longestCurrentRunMin ?? 0} min`,
        `${persona.goal.distance} ${persona.goal.goalType ?? "complete"}`,
        persona.goal.targetTime ? `mål ${persona.goal.targetTime}` : null,
    ]
        .filter(Boolean)
        .join(" · ");
}
function describeWeek(plan, week) {
    return formatWeekMix(plan, week);
}
function beginnerSafetyJudgment(plan) {
    const weekOne = weekSessions(plan, 1);
    const weekTwo = weekSessions(plan, 2);
    const firstRunWalk = weekOne.find((session) => sessionType(session) === "run-walk");
    const runSegment = firstRunWalk?.steps.find((step) => step.type === "run");
    const segmentMinutes = runSegment ? Math.round((runSegment.durationSec / 60) * 10) / 10 : null;
    const weekOneRunMinutes = weekOne.reduce((sum, session) => sum + runMinutes(session), 0);
    const weekTwoRunMinutes = weekTwo.reduce((sum, session) => sum + runMinutes(session), 0);
    if (segmentMinutes !== null && segmentMinutes <= 1 && weekOneRunMinutes <= 12 && weekTwoRunMinutes <= 18) {
        return "Tydeligt sikker og realistisk for en helt ny løber.";
    }
    if (segmentMinutes !== null && segmentMinutes <= 2 && weekOneRunMinutes <= 18 && weekTwoRunMinutes <= 24) {
        return "Forsigtig og troværdig for en meget tidlig begynder.";
    }
    if (segmentMinutes !== null && segmentMinutes <= 3 && weekOneRunMinutes <= 24 && weekTwoRunMinutes <= 30) {
        return "Rimelig for en begynder, der allerede kan løbe korte blokke.";
    }
    return "Stadig lidt for hård eller for stejl i åbningen.";
}
const findings = [];
const plans = new Map();
printSection("Scenario Matrix Tested");
for (const persona of personas) {
    const plan = buildAppPlan(persona);
    plans.set(persona.id, plan);
    console.log(`- ${persona.name}: ${personaProfileLine(persona)}`);
}
printSection("Beginner Safety Validation");
for (const scenario of beginnerSafetyScenarios) {
    const plan = buildAppPlan({
        id: scenario.id,
        name: scenario.label,
        category: "beginner",
        runnerProfile: scenario.runnerProfile,
        goal: scenario.goal,
    });
    console.log(`\n${scenario.label}`);
    console.log(`  Week 1: ${describeWeek(plan, 1)}`);
    console.log(`  Week 2: ${describeWeek(plan, 2)}`);
    console.log(`  Progression: uge 1 total ${weekLoad(plan, 1)} -> uge 2 total ${weekLoad(plan, 2)} · langtur ${longRunMinutesForWeek(plan, 1)} -> ${longRunMinutesForWeek(plan, 2)} min`);
    console.log(`  Coach judgment: ${beginnerSafetyJudgment(plan)}`);
}
printSection("Plan Quality Summary");
for (const persona of personas) {
    const plan = plans.get(persona.id) ?? buildAppPlan(persona);
    const quality = evaluatePlanQuality(persona, plan);
    const progression = evaluateProgression(persona, plan);
    findings.push(...quality.findings, ...progression.findings);
    const coachVerdict = quality.findings.some((finding) => finding.severity === "critical")
        ? "Not ready as-is."
        : quality.findings.some((finding) => finding.severity === "important")
            ? "Usable but with clear coaching caveats."
            : "Strong and believable.";
    console.log(`\n${persona.name}`);
    console.log(`  Structure: ${quality.summary}`);
    console.log(`  Checkpoints: ${progression.checkpoints.map((checkpoint) => `${checkpoint.label} W${checkpoint.week} (${checkpoint.mix})`).join(" | ")}`);
    console.log(`  Coach evaluation: ${coachVerdict}`);
    if (quality.findings.length + progression.findings.length > 0) {
        console.log("  Flags:");
        [...quality.findings, ...progression.findings]
            .sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
            .forEach((finding) => console.log(`    - [${finding.severity}] ${finding.summary}`));
    }
    else {
        console.log("  Flags: none obvious.");
    }
}
printSection("Progression Summary");
for (const persona of personas) {
    const plan = plans.get(persona.id) ?? buildAppPlan(persona);
    const progression = evaluateProgression(persona, plan);
    console.log(`\n${persona.name}`);
    progression.checkpoints.forEach((checkpoint) => {
        console.log(`  ${checkpoint.label}: week ${checkpoint.week} · load ${checkpoint.load} · mix ${checkpoint.mix} · long run ${checkpoint.longRun} min`);
    });
    console.log(`  Progression take: ${progression.summary}`);
}
printSection("Top Progression Failures");
const progressionFailures = findings.filter((finding) => finding.summary.toLowerCase().includes("progress") || finding.summary.toLowerCase().includes("cutback") || finding.summary.toLowerCase().includes("peak") || finding.summary.toLowerCase().includes("taper") || finding.summary.toLowerCase().includes("long-run"));
if (progressionFailures.length === 0) {
    console.log("No major progression failures were flagged by the heuristic checks.");
}
else {
    progressionFailures
        .sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
        .slice(0, 8)
        .forEach((finding) => console.log(`- [${finding.severity}] ${finding.scenarioId}: ${finding.summary}`));
}
printSection("Adaptation Summary");
for (const pattern of adaptationPatterns) {
    const persona = personas.find((entry) => entry.id === pattern.personaId);
    if (!persona)
        continue;
    const result = runAdaptationPattern(persona, pattern);
    console.log(`\n${pattern.name} (${persona.name})`);
    console.log(`  Mode: ${result.mode}`);
    console.log(`  Reason: ${result.reason}`);
    console.log(`  Next week before: ${result.before}`);
    console.log(`  Next week after: ${result.after}`);
    console.log(`  Race specificity preserved: ${result.specificity}`);
    console.log(`  Coach judgment: ${judgeAdaptation(result.mode, result.before, result.after)}`);
    if (result.rationale?.learnedTendencies?.length) {
        console.log(`  Learned insight: ${result.rationale.learnedTendencies.join(" / ")}`);
    }
}
printSection("Longitudinal Divergence Summary");
for (const pair of divergencePairs) {
    const persona = personas.find((entry) => entry.id === pair.personaId);
    if (!persona)
        continue;
    const a = simulateDivergence(persona, pair.runnerA.feedbacks);
    const b = simulateDivergence(persona, pair.runnerB.feedbacks);
    console.log(`\n${pair.name}`);
    console.log(`  Shared start: ${personaProfileLine(persona)}`);
    console.log(`  ${pair.runnerA.label}: mode ${a.capability.lastAdaptationMode} · traits durability ${a.capability.traits.durabilityTrend}, compliance ${a.capability.traits.complianceTrend}, quality ${a.capability.traits.qualityTolerance}, long-run ${a.capability.traits.longRunTolerance}, progression ${a.capability.traits.progressionTolerance}, caution ${a.capability.traits.cautionTrend}`);
    console.log(`    Next week: load ${a.nextWeekLoad} · ${a.nextWeekMix}`);
    if (a.rationale?.learnedTendencies?.length) {
        console.log(`    Learned insight: ${a.rationale.learnedTendencies.join(" / ")}`);
    }
    console.log(`  ${pair.runnerB.label}: mode ${b.capability.lastAdaptationMode} · traits durability ${b.capability.traits.durabilityTrend}, compliance ${b.capability.traits.complianceTrend}, quality ${b.capability.traits.qualityTolerance}, long-run ${b.capability.traits.longRunTolerance}, progression ${b.capability.traits.progressionTolerance}, caution ${b.capability.traits.cautionTrend}`);
    console.log(`    Next week: load ${b.nextWeekLoad} · ${b.nextWeekMix}`);
    if (b.rationale?.learnedTendencies?.length) {
        console.log(`    Learned insight: ${b.rationale.learnedTendencies.join(" / ")}`);
    }
}
printSection("Top 10 Issues Found");
const topFindings = findings
    .sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
    .slice(0, 10);
if (topFindings.length === 0) {
    console.log("No major issues were flagged by the current internal suite.");
}
else {
    topFindings.forEach((finding) => {
        console.log(`- [${finding.severity}] ${finding.scenarioId} (${finding.area}): ${finding.summary}`);
    });
}
printSection("Recommended Fix Buckets");
const critical = topFindings.filter((finding) => finding.severity === "critical");
const important = topFindings.filter((finding) => finding.severity === "important");
const minor = topFindings.filter((finding) => finding.severity === "minor");
console.log("Critical before real users:");
if (critical.length === 0) {
    console.log("- None surfaced as blockers in this pass.");
}
else {
    critical.forEach((finding) => console.log(`- ${finding.scenarioId}: ${finding.summary}`));
}
console.log("Important but can wait:");
if (important.length === 0) {
    console.log("- None surfaced beyond general refinement.");
}
else {
    important.forEach((finding) => console.log(`- ${finding.scenarioId}: ${finding.summary}`));
}
console.log("Nice to have:");
if (minor.length === 0) {
    console.log("- Nothing significant beyond polish.");
}
else {
    minor.forEach((finding) => console.log(`- ${finding.scenarioId}: ${finding.summary}`));
}
printSection("Final Verdict");
const hasCriticalBlockers = findings.some((finding) => finding.severity === "critical");
console.log(hasCriticalBlockers ? "needs one last focused patch first" : "safe to test with real users");
