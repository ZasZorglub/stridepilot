"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePlanFeasibility = validatePlanFeasibility;
exports.applyPlanSafety = applyPlanSafety;
const duration_1 = require("./duration");
const plan_1 = require("./plan");
const MIN_WEEKS = {
    "5K": { beginner: 8, experienced: 4 },
    "10K": { beginner: 10, experienced: 6 },
    Halvmaraton: { beginner: 12, experienced: 8 },
    Marathon: { beginner: 16, experienced: 12 },
};
const MIN_RUNS_PER_WEEK = {
    "5K": 2,
    "10K": 3,
    Halvmaraton: 3,
    Marathon: 3,
};
const TARGET_TIME_FLOOR_SEC = {
    "5K": { beginner: 22 * 60, experienced: 17 * 60 },
    "10K": { beginner: 48 * 60, experienced: 38 * 60 },
    Halvmaraton: { beginner: 105 * 60, experienced: 90 * 60 },
    Marathon: { beginner: 240 * 60, experienced: 200 * 60 },
};
function isBeginner(experience) {
    return experience === "nybegynder";
}
function abilityPressure(ability) {
    if (ability === "helt_ny")
        return 1.15;
    if (ability === "fem_min")
        return 1.1;
    if (ability === "ti_femten_min")
        return 1.05;
    if (ability === "mere_end_tredive_min")
        return 0.95;
    return 1;
}
function targetTimeFlexibility(profile, runsPerWeek) {
    let modifier = 1;
    if (profile.runningExperience === "ovet")
        modifier *= 0.96;
    if ((profile.currentWeeklyVolumeKm ?? 0) >= 35)
        modifier *= 0.96;
    if ((profile.currentWeeklyVolumeKm ?? 0) >= 50)
        modifier *= 0.94;
    if ((profile.currentRunsPerWeek ?? runsPerWeek) >= 4)
        modifier *= 0.97;
    if (profile.currentRunningAbility === "mere_end_tredive_min")
        modifier *= 0.97;
    return Math.max(0.82, modifier);
}
function parseTargetTimeToSec(value) {
    if (!value)
        return null;
    const parts = value.split(":").map((part) => Number(part));
    if (parts.some((part) => !Number.isFinite(part) || part < 0))
        return null;
    if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
    }
    if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return null;
}
function sessionRunSec(session) {
    return session.steps.filter((step) => step.type === "run").reduce((sum, step) => sum + step.durationSec, 0);
}
function scaleSessionRunSteps(session, factor) {
    const nextSteps = session.steps.map((step) => {
        if (step.type !== "run")
            return step;
        return {
            ...step,
            durationSec: (0, duration_1.normalizeStepDuration)(step.durationSec * factor),
        };
    });
    return {
        ...session,
        steps: nextSteps,
        loadScore: Math.max(1, Math.min(10, Math.round(session.loadScore * factor))),
    };
}
function validatePlanFeasibility(params) {
    const { goal, runnerProfile, runsPerWeek } = params;
    const minWeeksRequired = isBeginner(runnerProfile.runningExperience)
        ? MIN_WEEKS[goal.distance].beginner
        : MIN_WEEKS[goal.distance].experienced;
    const abilityModifier = abilityPressure(runnerProfile.currentRunningAbility);
    const warnings = [];
    let status = "feasible";
    let explanation;
    const minRuns = MIN_RUNS_PER_WEEK[goal.distance];
    if (runsPerWeek < minRuns) {
        warnings.push(`Minimum for ${goal.distance} er ${minRuns} pas om ugen.`);
        status = "feasible_with_adjustments";
    }
    const selectedDays = goal.availableTrainingDays?.length ?? 0;
    if (selectedDays > 0 && selectedDays < minRuns) {
        warnings.push("Du har valgt færre træningsdage end programmet normalt kræver. Programmet kan blive mindre effektivt eller kræve en længere tidshorisont.");
        explanation =
            "StridePilot holder sig til dine valgte træningsdage. For at gøre planen realistisk bliver progressionen derfor mere konservativ, og et længere forløb eller flere træningsdage kan være et bedre alternativ.";
        status = "feasible_with_adjustments";
    }
    if (goal.weeks < Math.ceil(minWeeksRequired * abilityModifier)) {
        return {
            feasible: false,
            status: "not_feasible",
            warnings,
            minWeeksRequired: Math.ceil(minWeeksRequired * abilityModifier),
            explanation,
        };
    }
    const targetTimeSec = parseTargetTimeToSec(goal.targetTime);
    if (targetTimeSec !== null) {
        const floor = isBeginner(runnerProfile.runningExperience)
            ? TARGET_TIME_FLOOR_SEC[goal.distance].beginner
            : TARGET_TIME_FLOOR_SEC[goal.distance].experienced;
        const pressureModifier = runsPerWeek < minRuns || goal.weeks <= minWeeksRequired + 1 ? 1.08 * abilityModifier : abilityModifier;
        const flexibilityModifier = targetTimeFlexibility(runnerProfile, runsPerWeek);
        const realisticFloor = floor * flexibilityModifier;
        if (targetTimeSec < realisticFloor / pressureModifier) {
            return {
                feasible: false,
                status: "not_feasible",
                warnings,
                minWeeksRequired,
                explanation,
            };
        }
    }
    return {
        feasible: true,
        status,
        warnings,
        minWeeksRequired,
        explanation,
    };
}
function applyWeeklyProgressionCap(plan, startDateIso, adjustments) {
    const weeks = (0, plan_1.buildWeeklyLoad)(plan, startDateIso);
    let sessions = [...plan.sessions];
    for (let i = 1; i < weeks.length; i += 1) {
        const prevWeek = weeks[i - 1];
        const currWeek = weeks[i];
        const prevLoad = prevWeek.load;
        const currLoad = currWeek.load;
        const maxAllowed = prevLoad * 1.05;
        if (prevLoad > 0 && currLoad > maxAllowed) {
            const factor = maxAllowed / currLoad;
            sessions = sessions.map((session) => (session.week === currWeek.week ? scaleSessionRunSteps(session, factor) : session));
            adjustments.push({
                type: "progression_cap",
                detail: `Jeg dæmpede uge ${currWeek.week} en smule for at holde progressionen stabil.`,
            });
        }
    }
    return { ...plan, sessions };
}
function applySessionSpikeProtection(plan, adjustments) {
    const ordered = [...plan.sessions].sort((a, b) => (a.week === b.week ? a.id.localeCompare(b.id) : a.week - b.week));
    const out = [];
    let prevLongest = 0;
    for (const session of ordered) {
        const runSec = sessionRunSec(session);
        const maxAllowed = prevLongest > 0 ? Math.round(prevLongest * 1.3) : runSec;
        if (prevLongest > 0 && runSec > maxAllowed) {
            const factor = maxAllowed / runSec;
            out.push(scaleSessionRunSteps(session, factor));
            adjustments.push({
                type: "session_spike_protection",
                detail: `Jeg justerede et pas i uge ${session.week}, så belastningen ikke sprang for hurtigt.`,
            });
        }
        else {
            out.push(session);
        }
        prevLongest = Math.max(prevLongest, sessionRunSec(out[out.length - 1]));
    }
    return { ...plan, sessions: out };
}
function applyRecoveryWeek(plan, adjustments) {
    const weeks = [...new Set(plan.sessions.map((s) => s.week))].sort((a, b) => a - b);
    let sessions = [...plan.sessions];
    for (const week of weeks) {
        if (week % 4 !== 0)
            continue;
        sessions = sessions.map((session) => (session.week === week ? scaleSessionRunSteps(session, 0.8) : session));
        adjustments.push({
            type: "recovery_week",
            detail: `Uge ${week} er gjort lettere, så du får en roligere restitutionsuge.`,
        });
    }
    return { ...plan, sessions };
}
function applyFeedbackSafety(plan, recentFeedback, adjustments) {
    const latest = recentFeedback[0];
    if (!latest || plan.sessions.length === 0)
        return plan;
    const sessions = [...plan.sessions];
    const first = sessions[0];
    if (latest.painLevel >= 6) {
        sessions[0] = scaleSessionRunSteps(first, 0.85);
        adjustments.push({ type: "pain_guardrail", detail: "Jeg gør næste pas roligere, fordi du rapporterede smerte." });
    }
    if (latest.effort >= 9) {
        sessions[0] = scaleSessionRunSteps(sessions[0], 0.9);
        adjustments.push({ type: "rpe_guardrail", detail: "Jeg dæmper intensiteten i næste pas, fordi det føltes hårdere end planlagt." });
    }
    if (latest.completionPct < 70 && sessions[1]) {
        sessions[1] = {
            ...sessions[1],
            steps: sessions[0].steps.map((step) => ({ ...step })),
            loadScore: sessions[0].loadScore,
            notes: "Gentagelsespas efter lav gennemførelse.",
        };
        adjustments.push({ type: "completion_repeat", detail: "Jeg lader næste pas ligne det forrige, så du får en mere stabil opbygning." });
    }
    if (latest.energy <= 2) {
        sessions[0] = scaleSessionRunSteps(sessions[0], 0.9);
        adjustments.push({ type: "energy_guardrail", detail: "Jeg prioriterer mere ro i næste pas, fordi energien var lav." });
    }
    return { ...plan, sessions };
}
function goalSpecificFinalSession(plan, goal, adjustments) {
    if (plan.sessions.length === 0)
        return plan;
    const sessions = [...plan.sessions];
    const idx = sessions.length - 1;
    const last = sessions[idx];
    const simulationTitle = goal.distance === "5K"
        ? "Måldag — 5 km"
        : goal.distance === "10K"
            ? "Måldag — 10 km"
            : goal.distance === "Halvmaraton"
                ? "Måldag — Halvmaraton"
                : "Måldag — Maraton";
    sessions[idx] = {
        ...last,
        title: simulationTitle,
        notes: `${simulationTitle} som afslutning på forløbet.`,
    };
    adjustments.push({
        type: "goal_specific_final_phase",
        detail: "Jeg gør slutugen målspecifik, så du slutter med en tydelig måldag.",
    });
    return { ...plan, sessions };
}
function applyPlanSafety(params) {
    const { goal, recentFeedback } = params;
    const adjustments = [];
    let plan = params.plan;
    plan = applyWeeklyProgressionCap(plan, goal.startDate, adjustments);
    plan = applySessionSpikeProtection(plan, adjustments);
    plan = applyRecoveryWeek(plan, adjustments);
    plan = applyFeedbackSafety(plan, recentFeedback, adjustments);
    plan = goalSpecificFinalSession(plan, goal, adjustments);
    return { plan, adjustments };
}
