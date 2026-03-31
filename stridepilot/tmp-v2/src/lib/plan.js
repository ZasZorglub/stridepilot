"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DAYS = void 0;
exports.sessionContinuousRunSec = sessionContinuousRunSec;
exports.sessionTrainingLoad = sessionTrainingLoad;
exports.generateFallbackPlan = generateFallbackPlan;
exports.buildWeeklyLoad = buildWeeklyLoad;
exports.enforceAvailableTrainingDays = enforceAvailableTrainingDays;
exports.normalizeTrainingPlan = normalizeTrainingPlan;
const duration_1 = require("./duration");
const coach_1 = require("./coach");
const calendar_week_1 = require("./calendar-week");
exports.DAYS = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lordag", "Sondag"];
function mapPreferredDays(days) {
    if (!days || days.length === 0)
        return undefined;
    return days.map((day) => {
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
}
function clampWeeks(weeks) {
    return Math.min(52, Math.max(12, Number.isFinite(weeks) ? Math.round(weeks) : 12));
}
function clampLoad(value) {
    return Math.max(1, Math.min(10, Math.round(value)));
}
function roundLoad(value) {
    return Math.round(value * 10) / 10;
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
    return {
        goalDistance: goal.distance,
        goalIntent: goalIntent(goal),
        targetDate: goal.endDate ?? goal.startDate,
        trainingDaysPerWeek: Math.max(2, Math.min(4, requestedRuns)),
        startDate: goal.startDate,
        targetTime: goal.targetTime,
        preferredTrainingDays: mapPreferredDays(goal.availableTrainingDays),
        preferredLongRunDay: goal.preferredLongRunDay === "both" || goal.preferredLongRunDay === "flexible" || !goal.preferredLongRunDay
            ? "flexible"
            : goal.preferredLongRunDay,
    };
}
function sessionContinuousRunSec(session) {
    let current = 0;
    let longest = 0;
    for (const step of session.steps) {
        if (step.type === "run") {
            current += step.durationSec;
            longest = Math.max(longest, current);
        }
        else {
            current = 0;
        }
    }
    return longest;
}
function sessionTrainingLoad(session) {
    const runSec = session.steps.filter((s) => s.type === "run").reduce((sum, step) => sum + step.durationSec, 0);
    const walkSec = session.steps.filter((s) => s.type === "walk").reduce((sum, step) => sum + step.durationSec, 0);
    const warmCoolSec = session.steps.filter((s) => s.type === "warmup" || s.type === "cooldown").reduce((sum, step) => sum + step.durationSec, 0);
    const continuousRunSec = sessionContinuousRunSec(session);
    const intervalCount = session.steps.filter((s) => s.type === "run").length;
    const intensityMultiplier = intervalCount >= 4 ? 1.18 : continuousRunSec >= 20 * 60 ? 1.08 : 1;
    const structureBonus = intervalCount >= 4 ? intervalCount * 0.18 : 0;
    const rawLoad = (runSec / 60) * intensityMultiplier + walkSec / 180 + warmCoolSec / 240 + structureBonus;
    return roundLoad(rawLoad);
}
function generateFallbackPlan(profile, goal, _signals) {
    void _signals;
    const coachProfile = (0, coach_1.interpretRunnerProfile)({
        onboardingText: profile.userTrainingContext,
        injuryHistory: profile.injuryHistory,
        weakPoints: profile.weakPoints,
        otherTraining: profile.otherTraining,
        currentAbility: profile.currentRunningAbility,
        goalDistance: goal.distance,
        goalTime: goal.targetTime,
        goalType: goal.goalType,
        activityLevel: profile.activityLevel,
        currentRunsPerWeek: profile.currentRunsPerWeek,
        currentWeeklyVolumeKm: profile.currentWeeklyVolumeKm,
        longestRunMinutes: profile.longestCurrentRunMin,
        realisticTrainingDaysPerWeek: profile.realisticTrainingDaysPerWeek,
        typicalWorkoutMinutes: profile.typicalWorkoutMinutes,
        preferredGuidance: profile.preferredGuidance,
    });
    const coachPlan = (0, coach_1.buildGoalPlan)(coachProfile, toCoachGoalConfig({ ...goal, weeks: clampWeeks(goal.weeks) }, profile));
    return (0, coach_1.mapCoachPlanToAppPlan)(coachPlan, coachPlan.goal);
}
function buildWeeklyLoad(plan, startDateIso) {
    const weeks = Array.from({ length: plan.weeks }, (_, index) => index + 1);
    const sessions = (0, calendar_week_1.visiblePlanSessions)(plan, startDateIso);
    return weeks.map((week) => {
        const weekSessions = sessions.filter((session) => {
            if (!startDateIso)
                return session.week === week;
            return (0, calendar_week_1.calendarWeekIndexFromDate)(startDateIso, (0, calendar_week_1.sessionDateFromCalendarWeek)(startDateIso, session)) === week;
        });
        const totalRunSec = weekSessions.reduce((sum, session) => sum + session.steps.filter((step) => step.type === "run").reduce((stepSum, step) => stepSum + step.durationSec, 0), 0);
        const longestContinuousRunSec = weekSessions.reduce((longest, session) => Math.max(longest, sessionContinuousRunSec(session)), 0);
        const load = roundLoad(weekSessions.reduce((sum, session) => sum + sessionTrainingLoad(session), 0));
        return {
            week,
            load,
            longestContinuousRunSec,
            totalRunSec,
        };
    });
}
function enforceAvailableTrainingDays(plan, preferredDays) {
    if (!preferredDays || preferredDays.length === 0) {
        return { plan, warnings: [] };
    }
    const normalizedPreferred = exports.DAYS.filter((day) => preferredDays.includes(day));
    if (normalizedPreferred.length === 0) {
        return { plan, warnings: [] };
    }
    const sessionsByWeek = new Map();
    for (const session of plan.sessions) {
        const bucket = sessionsByWeek.get(session.week) ?? [];
        bucket.push(session);
        sessionsByWeek.set(session.week, bucket);
    }
    let trimmedSessions = false;
    const alignedSessions = [];
    for (const [week, weekSessions] of [...sessionsByWeek.entries()].sort((a, b) => a[0] - b[0])) {
        const limitedSessions = weekSessions.slice(0, normalizedPreferred.length);
        if (weekSessions.length > normalizedPreferred.length) {
            trimmedSessions = true;
        }
        limitedSessions.forEach((session, index) => {
            alignedSessions.push({
                ...session,
                week,
                dayOfWeek: normalizedPreferred[index],
            });
        });
    }
    const warnings = trimmedSessions
        ? [
            "Planen er tilpasset dine valgte træningsdage. For at holde dig på disse dage er nogle uger gjort mere kompakte, og et længere forløb eller flere træningsdage kan give en stærkere progression.",
        ]
        : [];
    return {
        plan: {
            ...plan,
            sessionsPerWeek: Math.min(plan.sessionsPerWeek, normalizedPreferred.length),
            sessions: alignedSessions,
        },
        warnings,
    };
}
function normalizeTrainingPlan(raw, fallbackProfile, fallbackGoal) {
    const fallback = generateFallbackPlan(fallbackProfile, fallbackGoal);
    if (!raw || typeof raw !== "object") {
        return fallback;
    }
    const parsed = raw;
    const sessions = Array.isArray(parsed.sessions)
        ? parsed.sessions
            .map((session, idx) => {
            if (!session || typeof session !== "object")
                return null;
            const s = session;
            const rawSteps = Array.isArray(s.steps) ? s.steps : [];
            const steps = rawSteps
                .map((step) => {
                if (!step || typeof step !== "object")
                    return null;
                const st = step;
                const durationSec = Number(st.durationSec);
                if (!Number.isFinite(durationSec) || durationSec <= 0)
                    return null;
                return {
                    type: st.type ?? "walk",
                    label: st.label ?? "Interval",
                    durationSec: (0, duration_1.normalizeStepDuration)(Math.round(durationSec)),
                    cue: st.cue ?? "Hold et komfortabelt tempo.",
                };
            })
                .filter(Boolean);
            if (steps.length === 0)
                return null;
            return {
                id: s.id ?? `session-${idx + 1}`,
                title: s.title ?? `Traeningspas ${idx + 1}`,
                week: Number.isFinite(Number(s.week)) ? Math.max(1, Math.round(Number(s.week))) : 1,
                dayOfWeek: s.dayOfWeek ?? "Tirsdag",
                notes: s.notes,
                loadScore: clampLoad(Number(s.loadScore ?? 5)),
                steps,
            };
        })
            .filter(Boolean)
        : [];
    if (sessions.length === 0) {
        return fallback;
    }
    return {
        summary: parsed.summary ?? fallback.summary,
        weeks: clampWeeks(Number(parsed.weeks ?? fallback.weeks)),
        sessionsPerWeek: Math.min(5, Math.max(2, Number(parsed.sessionsPerWeek ?? fallback.sessionsPerWeek))),
        sessions,
    };
}
