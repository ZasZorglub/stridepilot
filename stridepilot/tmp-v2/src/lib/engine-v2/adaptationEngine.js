"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateRunnerStatus = evaluateRunnerStatus;
exports.decideAdaptation = decideAdaptation;
exports.adaptPlan = adaptPlan;
exports.adaptTrainingPlan = adaptTrainingPlan;
exports.updatePlanAfterFeedback = updatePlanAfterFeedback;
exports.adaptCurvesFromFeedback = adaptCurvesFromFeedback;
function average(values) {
    return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}
function normalizePain(pain) {
    return pain <= 3 ? pain : Math.min(3, Math.round(pain / 1.5));
}
function effortToRpe(entry) {
    if (typeof entry.rpe === "number")
        return entry.rpe;
    if (typeof entry.effort === "number")
        return 1 + entry.effort * 1.5;
    if (entry.perceivedDifficulty === "too_hard")
        return 9;
    if (entry.perceivedDifficulty === "hard")
        return 7.5;
    if (entry.perceivedDifficulty === "too_easy")
        return 3.5;
    return 5.5;
}
function scaleCurve(curve, startWeekIndex, factor, step = 0.5) {
    return curve.map((value, index) => {
        if (index + 1 < startWeekIndex)
            return value;
        const scaled = value * factor;
        return step > 0 ? Math.round(scaled / step) * step : scaled;
    });
}
function scaleIntensityCurve(curve, startWeekIndex, factor) {
    return scaleCurve(curve, startWeekIndex, factor, 0.01).map((value) => Math.max(0, Math.min(1, value)));
}
function withScaledCurves(plan, startWeekIndex, factors) {
    return {
        ...plan.curves,
        longRunCurve: scaleCurve(plan.curves.longRunCurve, startWeekIndex, factors.long),
        weeklyVolumeCurve: scaleCurve(plan.curves.weeklyVolumeCurve, startWeekIndex, factors.volume),
        intensityCurve: scaleIntensityCurve(plan.curves.intensityCurve, startWeekIndex, factors.intensity),
    };
}
function likelyBreakInTraining(recentWorkouts) {
    if (recentWorkouts.length < 3)
        return false;
    const trailing = recentWorkouts.slice(-3);
    return trailing.filter((entry) => (entry.completed === false) || entry.completionPct < 35).length >= 2;
}
function completionRateFromRecent(recent) {
    return average(recent.map((entry) => entry.completionPct / 100));
}
function fatigueScoreFromRecent(recent) {
    return average(recent.map((entry) => {
        const rpeLoad = effortToRpe(entry) / 10;
        const energyPenalty = (5 - entry.energy) / 4;
        return (rpeLoad + energyPenalty) * 5;
    }));
}
function painScoreFromRecent(recent) {
    return average(recent.map((entry) => normalizePain(entry.pain)));
}
function statusToMode(status) {
    if (status === "progressing_well" || status === "undertraining")
        return "progress";
    if (status === "struggling")
        return "repeat_week";
    if (status === "overreaching" || status === "injury_risk")
        return "recovery_week";
    if (status === "inconsistent")
        return "repeat_week";
    return "hold";
}
function evaluateRunnerStatus(recentWorkouts, plan, runnerProfile) {
    const recent = recentWorkouts.slice(-6);
    if (recent.length === 0) {
        return {
            status: "inconsistent",
            reason: "Der er endnu ikke nok gennemført træning til at vurdere en stabil status, så profilen behandles som inkonsistent indtil mere feedback er tilgængelig.",
        };
    }
    const completionRate = completionRateFromRecent(recent);
    const fatigueScore = fatigueScoreFromRecent(recent);
    const averageRpe = average(recent.map((entry) => effortToRpe(entry)));
    const averageEnergy = average(recent.map((entry) => entry.energy));
    const painScore = Math.max(painScoreFromRecent(recent), ...recent.map((entry) => normalizePain(entry.pain)));
    const lowCompletionCount = recent.filter((entry) => (entry.completed === false) || entry.completionPct < 70).length;
    const highRpeCount = recent.filter((entry) => effortToRpe(entry) >= 8 || entry.perceivedDifficulty === "too_hard").length;
    const easyPositiveCount = recent.filter((entry) => effortToRpe(entry) <= 5 && entry.energy >= 4 && normalizePain(entry.pain) <= 1 && entry.completionPct >= 90).length;
    const longRunStruggles = recent.filter((entry) => entry.sessionFamily === "long_run" && (effortToRpe(entry) >= 8 || entry.energy <= 2 || normalizePain(entry.pain) >= 2)).length;
    const lowProgressionTolerance = runnerProfile.traits.progressionTolerance <= 0.35;
    const plannedSessions = plan.weeks
        .slice(0, Math.min(3, plan.weeks.length))
        .reduce((sum, week) => sum + week.sessions.length, 0);
    if (painScore >= 3 || (runnerProfile.traits.injuryRiskFlag && painScore >= 2)) {
        return {
            status: "injury_risk",
            reason: "Smerte- og risikoprofilen peger på, at træningen bør beskyttes mere aktivt lige nu.",
        };
    }
    if ((highRpeCount >= 3 && averageEnergy <= 1.75) || (fatigueScore >= 8 && lowCompletionCount >= 2) || (longRunStruggles >= 2 && averageEnergy <= 2)) {
        return {
            status: "overreaching",
            reason: "De seneste pas ser ud til at koste mere, end planen bør koste, så kroppen har brug for en tydeligere aflastning.",
        };
    }
    if (likelyBreakInTraining(recent) || lowCompletionCount >= 3 || completionRate < 0.6) {
        return {
            status: "inconsistent",
            reason: "Træningsrytmen har været for ujævn til at bygge videre normalt, så planen bør stabiliseres før næste progression.",
        };
    }
    if ((averageRpe >= 7 && averageEnergy <= 3) || (lowProgressionTolerance && averageRpe >= 6.8) || longRunStruggles >= 1) {
        return {
            status: "struggling",
            reason: "Planen ser lige nu lidt for tung ud i forhold til overskud og absorbering, så progressionen bør dæmpes kortvarigt.",
        };
    }
    if (completionRate >= 0.98 && averageRpe <= 4 && averageEnergy >= 4.8 && recent.length >= 4) {
        return {
            status: "undertraining",
            reason: "Passene ser så lette ud, at planen sandsynligvis kan tåle lidt mere arbejde uden at miste bæredygtighed.",
        };
    }
    if (completionRate >= 0.9 && easyPositiveCount >= 3 && averageRpe <= 5.5 && averageEnergy >= 4 && plannedSessions >= 8) {
        return {
            status: "progressing_well",
            reason: "Træningen bliver absorberet godt med højt gennemførselsniveau og lav oplevet belastning.",
        };
    }
    return {
        status: "progressing_well",
        reason: "Træningen ser stabil og bæredygtig ud, og planen kan fortsætte med rolig progression.",
    };
}
function decideAdaptation(input) {
    const recent = input.recentWorkouts.slice(-6);
    if (recent.length === 0) {
        return {
            mode: "hold",
            reason: "Der er endnu ikke nok feedback til at ændre progressionen.",
        };
    }
    const completionRate = input.completionRate;
    const averageRpe = average(recent.map((entry) => effortToRpe(entry)));
    const averageEnergy = average(recent.map((entry) => entry.energy));
    const painScore = Math.max(input.painScore, ...recent.map((entry) => normalizePain(entry.pain)));
    const highRpeCount = recent.filter((entry) => effortToRpe(entry) >= 8 || entry.perceivedDifficulty === "too_hard" || entry.perceivedDifficulty === "hard").length;
    const missedCount = recent.filter((entry) => (entry.completed === false) || entry.completionPct < 70).length;
    const lowEnergyCount = recent.filter((entry) => entry.energy <= 2).length;
    const easyPositiveCount = recent.filter((entry) => effortToRpe(entry) <= 5 && entry.energy >= 4 && normalizePain(entry.pain) <= 1 && entry.completionPct >= 90).length;
    if (painScore >= 3) {
        return {
            mode: "recovery_week",
            reason: "Smerter i den seneste feedback peger på, at planen skal gå i en mere beskyttende uge.",
        };
    }
    if (likelyBreakInTraining(recent)) {
        return {
            mode: "resume_build",
            reason: "Der har været et tydeligt brud i træningen, så planen bør genoptage opbygningen roligt i stedet for at fortsætte som normalt.",
        };
    }
    if (missedCount >= 3 || completionRate < 0.65) {
        return {
            mode: "repeat_week",
            reason: "For mange missede eller afkortede pas tyder på, at samme uge bør gentages, før progressionen fortsætter.",
        };
    }
    if (highRpeCount >= 3 || (averageRpe >= 7.5 && lowEnergyCount >= 2) || input.fatigueScore >= 7) {
        return {
            mode: "down_shift",
            reason: "Belastningen ser for høj ud lige nu, så den næste del af planen bør lettes en smule.",
        };
    }
    if (completionRate >= 0.9 && averageRpe <= 5.5 && averageEnergy >= 4 && painScore <= 1 && easyPositiveCount >= 3) {
        return {
            mode: "progress",
            reason: "Du absorberer træningen godt med lav oplevet belastning og god energi, så planen kan bygges en smule videre.",
        };
    }
    return {
        mode: "hold",
        reason: "Træningsbelastningen ser passende ud, så planen kan fortsætte uændret.",
    };
}
function adaptPlan(plan, status) {
    const startWeekIndex = 2;
    let updatedCurves = plan.curves;
    let reason = "Planen fortsætter uændret.";
    if (status === "progressing_well") {
        reason = "Runneren absorberer træningen godt, så planen kan bygges lidt videre med en kontrolleret stigning.";
        updatedCurves = withScaledCurves(plan, startWeekIndex, { long: 1.05, volume: 1.08, intensity: 1.04 });
    }
    else if (status === "undertraining") {
        reason = "Belastningen ser lidt for let ud, så planen får en moderat stigning og mere samlet arbejde.";
        updatedCurves = withScaledCurves(plan, startWeekIndex, { long: 1.06, volume: 1.1, intensity: 1.06 });
        updatedCurves.sessionsPerWeekCurve = updatedCurves.sessionsPerWeekCurve.map((value, index) => index + 1 >= startWeekIndex ? Math.min(value + 1, 5) : value);
    }
    else if (status === "struggling") {
        reason = "Runneren kæmper med at absorbere belastningen, så næste uge bør gentages i en lettere version med mindre kvalitet.";
        updatedCurves = withScaledCurves(plan, startWeekIndex, { long: 0.92, volume: 0.9, intensity: 0.78 });
        updatedCurves.intensityCurve = scaleIntensityCurve(updatedCurves.intensityCurve, startWeekIndex, 0.82);
    }
    else if (status === "overreaching") {
        reason = "Tegn på overreaching udløser en tydeligere recovery-uge med lavere volumen og uden skarp kvalitet.";
        updatedCurves = withScaledCurves(plan, startWeekIndex, { long: 0.8, volume: 0.74, intensity: 0.68 });
        updatedCurves.intensityCurve = scaleIntensityCurve(updatedCurves.intensityCurve, startWeekIndex, 0.72);
    }
    else if (status === "injury_risk") {
        reason = "Skadesrisikoen vurderes forhøjet, så planen beskytter kroppen med markant lavere belastning og mindre langtur.";
        updatedCurves = withScaledCurves(plan, startWeekIndex, { long: 0.75, volume: 0.65, intensity: 0.6 });
        updatedCurves.intensityCurve = scaleIntensityCurve(updatedCurves.intensityCurve, startWeekIndex, 0.65);
    }
    else if (status === "inconsistent") {
        reason = "Ujævn træningsrytme betyder, at planen bør gentage eller holde progressionen tilbage i den næste blok.";
        updatedCurves = withScaledCurves(plan, startWeekIndex, { long: 0.92, volume: 0.9, intensity: 0.82 });
    }
    return {
        mode: statusToMode(status),
        reason,
        updatedCurves,
        reasons: [reason],
    };
}
function adaptTrainingPlan(plan, status) {
    return adaptPlan(plan, status);
}
function updatePlanAfterFeedback(plan, recentWorkouts) {
    const evaluation = evaluateRunnerStatus(recentWorkouts, plan, plan.classification);
    const adapted = adaptTrainingPlan(plan, evaluation.status);
    return {
        ...adapted,
        reason: evaluation.reason,
        reasons: [evaluation.reason, ...adapted.reasons.filter((reason) => reason !== evaluation.reason)],
        status: evaluation.status,
    };
}
function adaptCurvesFromFeedback(plan, feedback) {
    const recent = feedback.slice(-6);
    const completionRate = completionRateFromRecent(recent);
    const fatigueScore = fatigueScoreFromRecent(recent);
    const painScore = painScoreFromRecent(recent);
    const decision = decideAdaptation({
        recentWorkouts: recent,
        fatigueScore,
        completionRate,
        painScore,
    });
    const startWeekIndex = recent.length > 0 ? Math.max(2, Math.min(...recent.map((entry) => entry.weekIndex))) : 2;
    let updatedCurves = plan.curves;
    if (decision.mode === "recovery_week") {
        updatedCurves = withScaledCurves(plan, startWeekIndex, { long: 0.8, volume: 0.8, intensity: 0.72 });
    }
    else if (decision.mode === "repeat_week") {
        updatedCurves = withScaledCurves(plan, startWeekIndex, { long: 0.94, volume: 0.94, intensity: 0.9 });
    }
    else if (decision.mode === "down_shift") {
        updatedCurves = withScaledCurves(plan, startWeekIndex, { long: 0.9, volume: 0.92, intensity: 0.86 });
    }
    else if (decision.mode === "progress") {
        updatedCurves = withScaledCurves(plan, startWeekIndex, { long: 1.04, volume: 1.05, intensity: 1.06 });
    }
    else if (decision.mode === "resume_build") {
        updatedCurves = withScaledCurves(plan, startWeekIndex, { long: 0.96, volume: 0.96, intensity: 0.92 });
    }
    return {
        mode: decision.mode,
        reason: decision.reason,
        updatedCurves,
        reasons: [decision.reason],
    };
}
