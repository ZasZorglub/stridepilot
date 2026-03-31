"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildTenKDistancePlan = buildTenKDistancePlan;
const workouts_1 = require("./workouts");
const explanations_1 = require("./explanations");
const classification_1 = require("./classification");
const week_structure_1 = require("./week-structure");
const calendar_week_1 = require("../calendar-week");
function roundHalf(value) {
    return Math.round(value * 2) / 2;
}
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
function toIsoDate(date) {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
}
function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}
function dayOffset(day) {
    if (day === "monday")
        return 0;
    if (day === "tuesday")
        return 1;
    if (day === "wednesday")
        return 2;
    if (day === "thursday")
        return 3;
    if (day === "friday")
        return 4;
    if (day === "saturday")
        return 5;
    return 6;
}
function deriveTotalWeeks(goal) {
    return Math.max(10, (0, calendar_week_1.deriveCalendarWeekCount)(goal.startDate, goal.targetDate) ?? 10);
}
function categoryValue(category) {
    if (category === "true_beginner")
        return 0;
    if (category === "run_walk_beginner")
        return 1;
    if (category === "continuous_beginner")
        return 2;
    if (category === "recreational")
        return 3;
    if (category === "light_intermediate")
        return 4;
    if (category === "intermediate")
        return 5;
    return 6;
}
function longRunStart(profile, category) {
    const longest = profile.longestRunMinutes;
    const typical = profile.typicalWorkoutMinutes || 40;
    if (categoryValue(category) <= 1)
        return 20;
    if (category === "continuous_beginner")
        return roundHalf(clamp(Math.max(24, Math.min(longest, typical * 0.9)), 24, 36));
    if (category === "recreational")
        return roundHalf(clamp(Math.max(34, longest * 0.9, typical), 32, 48));
    if (category === "light_intermediate")
        return roundHalf(clamp(Math.max(40, longest * 0.9, typical), 38, 58));
    if (category === "intermediate")
        return roundHalf(clamp(Math.max(50, longest * 0.92, typical), 46, 72));
    return roundHalf(clamp(Math.max(55, longest * 0.94, typical), 52, 80));
}
function weeklyVolumeStart(profile, category, longRunMin) {
    const volumeFromTraining = profile.currentWeeklyVolumeKm > 0 ? profile.currentWeeklyVolumeKm * 6.2 : 0;
    const frequencyAnchor = profile.currentRunsPerWeek >= 3 ? profile.currentRunsPerWeek * 18 : 0;
    if (category === "recreational") {
        return roundHalf(clamp(Math.max(longRunMin * 2.05, volumeFromTraining, frequencyAnchor, 82), 80, 120));
    }
    if (category === "light_intermediate") {
        return roundHalf(clamp(Math.max(longRunMin * 2.15, volumeFromTraining, frequencyAnchor, 92), 90, 145));
    }
    if (category === "intermediate" || category === "advanced") {
        return roundHalf(clamp(Math.max(longRunMin * 2.2, volumeFromTraining, frequencyAnchor, 110), 105, 180));
    }
    return roundHalf(clamp(Math.max(longRunMin * 1.9, volumeFromTraining, 60), 60, 100));
}
function longRunPeak(profile, category, start) {
    const upper = 90;
    if (category === "recreational")
        return roundHalf(clamp(Math.max(start + 18, profile.longestRunMinutes + 15), 55, upper));
    if (category === "light_intermediate")
        return roundHalf(clamp(Math.max(start + 20, profile.longestRunMinutes + 18), 62, upper));
    return roundHalf(clamp(Math.max(start + 22, profile.longestRunMinutes + 20), 68, upper));
}
function weeklyVolumePeak(profile, category, start) {
    const upper = category === "advanced" ? 240 : category === "intermediate" ? 210 : 180;
    const growth = category === "recreational" ? 32 : category === "light_intermediate" ? 38 : 46;
    return roundHalf(clamp(start + growth, start + 18, upper));
}
function phaseTimeline(totalWeeks) {
    const taperWeeks = totalWeeks >= 14 ? 2 : 1;
    const peakWeeks = totalWeeks >= 12 ? 2 : 1;
    const baseWeeks = Math.max(2, Math.round(totalWeeks * 0.22));
    const buildWeeks = Math.max(3, Math.round(totalWeeks * 0.32));
    const specificWeeks = Math.max(2, totalWeeks - taperWeeks - peakWeeks - baseWeeks - buildWeeks);
    const timeline = [];
    for (let i = 0; i < baseWeeks; i += 1)
        timeline.push("base");
    for (let i = 0; i < buildWeeks; i += 1)
        timeline.push("build");
    for (let i = 0; i < specificWeeks; i += 1)
        timeline.push("specific");
    for (let i = 0; i < peakWeeks; i += 1)
        timeline.push("peak");
    while (timeline.length < totalWeeks)
        timeline.push("taper");
    return timeline.slice(0, totalWeeks);
}
function phaseProgress(timeline, weekNumber) {
    const phase = timeline[weekNumber - 1];
    const phaseWeeks = timeline.filter((entry) => entry === phase);
    let indexInPhase = 0;
    for (let i = 0; i < weekNumber; i += 1) {
        if (timeline[i] === phase)
            indexInPhase += 1;
    }
    return phaseWeeks.length <= 1 ? 1 : (indexInPhase - 1) / (phaseWeeks.length - 1);
}
function phaseIntensity(phase, progress) {
    if (phase === "base")
        return 0.22 + progress * 0.06;
    if (phase === "build")
        return 0.34 + progress * 0.1;
    if (phase === "specific")
        return 0.5 + progress * 0.12;
    if (phase === "peak")
        return 0.68 + progress * 0.08;
    return 0.28 - progress * 0.08;
}
function curveBetween(start, peak, phase, progress) {
    if (phase === "base")
        return start + (peak - start) * 0.18 * progress;
    if (phase === "build")
        return start + (peak - start) * (0.18 + 0.38 * progress);
    if (phase === "specific")
        return start + (peak - start) * (0.56 + 0.22 * progress);
    if (phase === "peak")
        return start + (peak - start) * (0.8 + 0.18 * progress);
    return peak * (progress >= 1 ? 0.62 : 0.78);
}
function buildCurves(profile, goal, category, totalWeeks) {
    const timeline = phaseTimeline(totalWeeks);
    const longStart = longRunStart(profile, category);
    const volumeStart = weeklyVolumeStart(profile, category, longStart);
    const longPeak = longRunPeak(profile, category, longStart);
    const volumePeak = weeklyVolumePeak(profile, category, volumeStart);
    const cutbackEvery = (0, week_structure_1.cutbackInterval)(category, goal.trainingDaysPerWeek);
    return timeline.map((phase, index) => {
        const weekNumber = index + 1;
        const progress = phaseProgress(timeline, weekNumber);
        const isCutback = phase !== "taper" && phase !== "peak" && weekNumber > 1 && weekNumber % cutbackEvery === 0;
        let longRunMin = roundHalf(curveBetween(longStart, longPeak, phase, progress));
        let weeklyVolumeMin = roundHalf(curveBetween(volumeStart, volumePeak, phase, progress));
        let intensityScore = phaseIntensity(phase, progress);
        if (isCutback) {
            longRunMin = roundHalf(longRunMin * 0.88);
            weeklyVolumeMin = roundHalf(weeklyVolumeMin * 0.86);
            intensityScore *= 0.82;
        }
        if (phase === "taper") {
            intensityScore = Math.max(0.18, intensityScore);
        }
        return {
            weekNumber,
            phase,
            isCutback,
            longRunMin: roundHalf(clamp(longRunMin, longStart * 0.85, longPeak)),
            weeklyVolumeMin: roundHalf(clamp(weeklyVolumeMin, volumeStart * 0.9, volumePeak)),
            intensityScore: Math.round(intensityScore * 100) / 100,
        };
    });
}
function mapPhaseToPlanPhase(phase) {
    if (phase === "base")
        return "base";
    if (phase === "build")
        return "build";
    if (phase === "specific")
        return "specific";
    if (phase === "peak")
        return "peak";
    return "taper";
}
function focusForPhase(phase, isCutback) {
    if (isCutback) {
        return "Ugen er en bevidst stabiliseringsuge, så kroppen kan absorbere opbygningen uden at miste rytmen.";
    }
    if (phase === "base")
        return "Stabilisere den base du allerede har og gøre planen tryg, men stadig klart over begynderniveau.";
    if (phase === "build")
        return "Bygge længere rolige ture og mere samlet tid på benene uge for uge.";
    if (phase === "specific")
        return "Lægge mere 10 km-relevant steady, progression og kontrolleret kvalitet ind.";
    if (phase === "peak")
        return "Samle de stærkeste distance-uger med den længste langtur og den tydeligste 10 km-identitet.";
    return "Friske kroppen op, bevare rytmen og gå ind i slutugen med mere overskud.";
}
function weeklyTypes(trainingDaysPerWeek, phase, intensity, isCutback) {
    if (trainingDaysPerWeek === 2) {
        if (phase === "specific" || phase === "peak")
            return [intensity >= 0.56 ? "progression" : "steady", "long"];
        if (phase === "taper")
            return ["easy", "race-specific"];
        return ["steady", "long"];
    }
    if (trainingDaysPerWeek === 3) {
        if (phase === "base")
            return ["easy", "steady", "long"];
        if (phase === "build")
            return ["easy", isCutback ? "steady" : intensity >= 0.4 ? "fartlek" : "steady", "long"];
        if (phase === "specific")
            return ["easy", intensity >= 0.56 ? "progression" : "steady", "long"];
        if (phase === "peak")
            return ["easy", intensity >= 0.7 ? "race-specific" : "tempo", "long"];
        return ["easy", "steady", "race-specific"];
    }
    if (phase === "base")
        return ["easy", "recovery", "steady", "long"];
    if (phase === "build")
        return ["easy", "recovery", isCutback ? "steady" : "fartlek", "long"];
    if (phase === "specific")
        return ["easy", "recovery", intensity >= 0.56 ? "progression" : "steady", "long"];
    if (phase === "peak")
        return ["easy", "recovery", intensity >= 0.7 ? "race-specific" : "tempo", "long"];
    return ["easy", "recovery", "steady", "race-specific"];
}
function buildSessionByType(type, context) {
    if (type === "easy")
        return (0, workouts_1.buildEasyWorkout)(context);
    if (type === "recovery")
        return (0, workouts_1.buildRecoveryWorkout)(context);
    if (type === "long")
        return (0, workouts_1.buildLongWorkout)(context);
    if (type === "steady")
        return (0, workouts_1.buildSteadyWorkout)(context);
    if (type === "tempo")
        return (0, workouts_1.buildTempoWorkout)(context);
    if (type === "fartlek")
        return (0, workouts_1.buildFartlekWorkout)(context);
    if (type === "progression")
        return (0, workouts_1.buildProgressionWorkout)(context);
    if (type === "race-specific")
        return (0, workouts_1.buildRaceSpecificWorkout)(context);
    return (0, workouts_1.buildEasyWorkout)(context);
}
function sessionMinutes(curves, type, trainingDaysPerWeek) {
    const baseEasy = curves.weeklyVolumeMin * (trainingDaysPerWeek === 4 ? 0.22 : 0.26);
    const qualityShare = curves.intensityScore >= 0.68 ? 0.27 : curves.intensityScore >= 0.5 ? 0.24 : 0.2;
    const quality = roundHalf(clamp(curves.weeklyVolumeMin * qualityShare, 24, 52));
    const easy = roundHalf(clamp(baseEasy, 22, 52));
    const long = roundHalf(clamp(curves.longRunMin, 34, 90));
    const repeats = type === "fartlek" ? (curves.intensityScore >= 0.44 ? 6 : 5) : 4;
    return { continuous: type === "recovery" ? Math.max(16, easy * 0.68) : easy, quality, long, repeats };
}
function buildCurvesSummary(curves) {
    return {
        longRunCurve: curves.map((week) => week.longRunMin),
        weeklyVolumeCurve: curves.map((week) => week.weeklyVolumeMin),
        intensityCurve: curves.map((week) => week.intensityScore),
    };
}
function buildTenKDistancePlan(profile, goal) {
    const totalWeeks = deriveTotalWeeks(goal);
    const category = profile.runnerCategory ?? "recreational";
    const orderedDays = (0, week_structure_1.orderTrainingDaysForLongRun)(goal);
    const longRunDay = (0, week_structure_1.preferredLongRunDay)(goal);
    const startMonday = (0, calendar_week_1.planStartWeekMonday)(goal.startDate);
    const startDate = new Date(`${goal.startDate}T00:00:00`);
    const curves = buildCurves(profile, goal, category, totalWeeks);
    const weeks = [];
    for (const curveWeek of curves) {
        const types = weeklyTypes(goal.trainingDaysPerWeek, curveWeek.phase, curveWeek.intensityScore, curveWeek.isCutback);
        const weekDays = orderedDays.slice(0, types.length).map((day, idx) => (types[idx] === "long" ? longRunDay : day));
        const usedDays = new Set();
        const normalizedDays = weekDays.map((day) => {
            if (!usedDays.has(day)) {
                usedDays.add(day);
                return day;
            }
            const fallback = orderedDays.find((candidate) => !usedDays.has(candidate)) ?? day;
            usedDays.add(fallback);
            return fallback;
        });
        const weekMonday = addDays(startMonday, (curveWeek.weekNumber - 1) * 7);
        const sessions = types.flatMap((type, index) => {
            const day = normalizedDays[index];
            const date = addDays(weekMonday, dayOffset(day));
            if (curveWeek.weekNumber === 1 && date.getTime() < startDate.getTime()) {
                return [];
            }
            const minutes = sessionMinutes(curveWeek, type, goal.trainingDaysPerWeek);
            const continuousRunMin = type === "long"
                ? Math.max(24, Math.round(curveWeek.weeklyVolumeMin * 0.22))
                : type === "recovery"
                    ? Math.max(16, minutes.continuous * 0.72)
                    : type === "easy"
                        ? minutes.continuous
                        : Math.max(18, Math.min(minutes.quality, minutes.continuous + 6));
            return [
                buildSessionByType(type, {
                    weekNumber: curveWeek.weekNumber,
                    phase: mapPhaseToPlanPhase(curveWeek.phase),
                    profile,
                    goal,
                    dayOfWeek: day,
                    date: toIsoDate(date),
                    isStabilizationWeek: curveWeek.isCutback,
                    continuousRunMin: roundHalf(continuousRunMin),
                    longRunMin: minutes.long,
                    intervalRunMin: roundHalf(clamp(minutes.quality * 0.22, 3, 8)),
                    walkBreakMin: 2,
                    repeats: minutes.repeats,
                    isGoalSession: curveWeek.weekNumber === totalWeeks && index === types.length - 1,
                }),
            ];
        });
        const estimatedLoad = Math.round(sessions.reduce((sum, session) => sum + session.estimatedLoad, 0) * 10) / 10;
        weeks.push({
            weekNumber: curveWeek.weekNumber,
            phase: mapPhaseToPlanPhase(curveWeek.phase),
            focus: focusForPhase(curveWeek.phase, curveWeek.isCutback),
            sessions,
            estimatedLoad,
            isStabilizationWeek: curveWeek.isCutback,
        });
    }
    const sessions = weeks.flatMap((week) => week.sessions);
    const planSkeleton = {
        planType: "TenKDistance",
        goal,
        profile,
        weeks,
        sessions,
        adjustments: [],
        explanationSummary: [],
        curves: buildCurvesSummary(curves),
    };
    const rationale = {
        plan: (0, explanations_1.buildPlanRationale)({ profile, plan: planSkeleton }),
        weeks: (0, explanations_1.buildWeekRationales)(planSkeleton),
        workouts: (0, explanations_1.buildWorkoutRationales)(planSkeleton),
    };
    rationale.plan.profileSummary = [(0, classification_1.runnerCategoryReason)(profile, category), ...rationale.plan.profileSummary].slice(0, 2);
    rationale.plan.structureSummary = [
        `Planen er valgt som TenKDistance, fordi du allerede kan løbe sammenhængende og nu har brug for længere rolige ture, mere samlet volumen og kontrolleret 10 km-specifik udvikling frem for begynder-run-walk.`,
        `Langturen ligger på ${longRunDay === "sunday" ? "søndag" : longRunDay === "saturday" ? "lørdag" : "ugens seneste træningsdag"}, så ugeprofilen passer bedre til den dag de fleste løbere har bedst plads til den længste tur.`,
    ];
    return {
        ...planSkeleton,
        rationale,
        explanationSummary: (0, explanations_1.generatePlanExplanation)(profile, { ...planSkeleton, rationale }).slice(0, 4),
    };
}
