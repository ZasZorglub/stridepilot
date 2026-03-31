"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPhaseForWeek = getPhaseForWeek;
exports.buildPhasePlan = buildPhasePlan;
const calendar_week_1 = require("../calendar-week");
function getPhaseForWeek(week, totalWeeks) {
    const boundedTotal = Math.max(6, totalWeeks);
    const boundedWeek = Math.max(1, Math.min(week, boundedTotal));
    if (boundedWeek === boundedTotal)
        return "race";
    const nonRaceWeeks = boundedTotal - 1;
    const taperWeeks = boundedTotal >= 16 ? 2 : 1;
    const peakWeeks = Math.max(1, Math.round(nonRaceWeeks * 0.1));
    const specificWeeks = Math.max(2, Math.round(nonRaceWeeks * 0.2));
    const buildWeeks = Math.max(2, Math.round(nonRaceWeeks * 0.35));
    const baseWeeks = Math.max(2, nonRaceWeeks - taperWeeks - peakWeeks - specificWeeks - buildWeeks);
    const baseEnd = baseWeeks;
    const buildEnd = baseEnd + buildWeeks;
    const specificEnd = buildEnd + specificWeeks;
    const peakEnd = specificEnd + peakWeeks;
    if (boundedWeek <= baseEnd)
        return "base";
    if (boundedWeek <= buildEnd)
        return "build";
    if (boundedWeek <= specificEnd)
        return "specific";
    if (boundedWeek <= peakEnd)
        return "peak";
    return "taper";
}
function normalizeAllocations(totalWeeks, raw) {
    const entries = [
        ["base", raw.base],
        ["build", raw.build],
        ["specific", raw.specific],
        ["peak", raw.peak],
        ["taper", raw.taper],
    ];
    let assigned = entries.reduce((sum, [, count]) => sum + count, 0);
    while (assigned < totalWeeks) {
        raw.build += 1;
        assigned += 1;
    }
    while (assigned > totalWeeks) {
        const key = ["build", "base", "specific", "peak"].find((phase) => raw[phase] > 1);
        if (!key)
            break;
        raw[key] -= 1;
        assigned -= 1;
    }
    return raw;
}
function phaseTargets(timelinePhase, phase, planType, runnerLevel, availableDays) {
    const beginner = runnerLevel === "true_beginner" || runnerLevel === "beginner_plus";
    const performance = planType.includes("improve") || planType.includes("target_time");
    const conservativeRuns = beginner ? 3 : Math.min(Math.max(3, availableDays), 5);
    if (timelinePhase === "race") {
        return {
            targetRuns: Math.min(Math.max(2, availableDays >= 3 ? 3 : 2), availableDays),
            targetQualitySessions: performance ? 1 : 0,
            notes: ["Race week should be structurally different from normal training weeks.", "Reduce fatigue and let the event replace the normal big weekend training role."],
        };
    }
    if (phase === "base") {
        return {
            targetRuns: Math.min(conservativeRuns, availableDays),
            targetQualitySessions: 0,
            notes: ["Base phase should prioritize consistency, easy running and repeatable structure."],
        };
    }
    if (phase === "build") {
        return {
            targetRuns: Math.min(conservativeRuns + (performance && availableDays >= 4 ? 1 : 0), availableDays),
            targetQualitySessions: 1,
            notes: ["Build phase should progress long run and weekly durability in controlled steps."],
        };
    }
    if (phase === "specific") {
        return {
            targetRuns: Math.min(conservativeRuns + (performance && availableDays >= 4 ? 1 : 0), availableDays),
            targetQualitySessions: performance && availableDays >= 4 ? 2 : 1,
            notes: ["Specific phase should introduce more goal-relevant rhythm without losing structural clarity."],
        };
    }
    if (phase === "peak") {
        return {
            targetRuns: Math.min(Math.max(2, conservativeRuns), availableDays),
            targetQualitySessions: performance ? Math.min(2, availableDays - 1) : 1,
            notes: ["Peak phase should carry the sharpest load, but still preserve recovery and clear structure."],
        };
    }
    return {
        targetRuns: Math.min(Math.max(2, conservativeRuns - 1), availableDays),
        targetQualitySessions: performance ? 1 : 0,
        notes: ["Taper should reduce load and complexity while keeping the runner fresh and confident."],
    };
}
function defaultAllocations(totalWeeks, planType, runnerLevel) {
    const returnLike = planType === "return_to_running" || planType === "consistency_builder";
    const targetTime = planType.includes("target_time");
    const performance = planType.includes("improve") || targetTime;
    const marathonLike = planType.includes("marathon");
    const beginner = runnerLevel === "true_beginner" || runnerLevel === "beginner_plus";
    if (returnLike) {
        const taper = totalWeeks >= 10 ? 1 : 0;
        const peak = 0;
        const base = Math.max(4, Math.round(totalWeeks * 0.45));
        const build = Math.max(2, totalWeeks - taper - base);
        const specific = 0;
        return normalizeAllocations(totalWeeks, { base, build, specific, peak, taper });
    }
    if ((planType === "5k_finish" || planType === "5k_finish_no_walk") && beginner) {
        const taper = totalWeeks >= 11 ? 2 : 1;
        const peak = 0;
        const base = Math.max(3, Math.round(totalWeeks * 0.34));
        const build = Math.max(3, Math.round(totalWeeks * 0.34));
        const specific = Math.max(1, totalWeeks - taper - peak - base - build);
        return normalizeAllocations(totalWeeks, { base, build, specific, peak, taper });
    }
    if (planType === "10k_finish") {
        const taper = totalWeeks >= 14 ? 2 : 1;
        const peak = totalWeeks >= 14 ? 1 : 0;
        const base = Math.max(3, Math.round(totalWeeks * 0.26));
        const build = Math.max(4, Math.round(totalWeeks * 0.36));
        const specific = Math.max(2, totalWeeks - taper - peak - base - build);
        return normalizeAllocations(totalWeeks, { base, build, specific, peak, taper });
    }
    if (planType === "hm_finish") {
        const taper = totalWeeks >= 15 ? 2 : 1;
        const peak = totalWeeks >= 14 ? 1 : 0;
        const base = Math.max(4, Math.round(totalWeeks * 0.28));
        const build = Math.max(4, Math.round(totalWeeks * 0.34));
        const specific = Math.max(3, totalWeeks - taper - peak - base - build);
        return normalizeAllocations(totalWeeks, { base, build, specific, peak, taper });
    }
    if (planType === "marathon_finish") {
        const taper = totalWeeks >= 18 ? 3 : 2;
        const peak = totalWeeks >= 16 ? 1 : 0;
        const base = Math.max(5, Math.round(totalWeeks * 0.32));
        const build = Math.max(5, Math.round(totalWeeks * 0.3));
        const specific = Math.max(3, totalWeeks - taper - peak - base - build);
        return normalizeAllocations(totalWeeks, { base, build, specific, peak, taper });
    }
    const taper = marathonLike ? Math.max(2, totalWeeks >= 18 ? 3 : 2) : totalWeeks >= 14 ? 2 : 1;
    const peak = marathonLike ? Math.max(1, Math.round(totalWeeks * 0.1)) : performance && totalWeeks >= 12 ? 2 : totalWeeks >= 16 ? 1 : 0;
    const base = beginner ? Math.max(3, Math.round(totalWeeks * 0.34)) : Math.max(2, Math.round(totalWeeks * (marathonLike ? 0.28 : 0.22)));
    const build = Math.max(3, Math.round(totalWeeks * (performance ? 0.28 : 0.34)));
    const specific = Math.max(performance || !beginner ? 2 : 1, totalWeeks - taper - peak - base - build);
    return normalizeAllocations(totalWeeks, { base, build, specific, peak, taper });
}
function phasePurpose(phase, planType, classification) {
    const beginner = classification.traits.runnerLevel === "true_beginner" || classification.traits.runnerLevel === "beginner_plus";
    const performance = planType.includes("improve") || planType.includes("target_time");
    if (phase === "base") {
        return {
            primaryObjective: beginner ? "Build basic durability and repeatable running rhythm." : "Stabilize aerobic base and repeatable weekly structure.",
            volumeEmphasis: 0.7,
            intensityEmphasis: 0.15,
            longRunEmphasis: 0.5,
            specificityEmphasis: 0.1,
            adaptationSensitivity: 0.8,
        };
    }
    if (phase === "build") {
        return {
            primaryObjective: "Increase total training load in a controlled way.",
            volumeEmphasis: 0.82,
            intensityEmphasis: 0.3,
            longRunEmphasis: 0.72,
            specificityEmphasis: 0.22,
            adaptationSensitivity: 0.72,
        };
    }
    if (phase === "specific") {
        return {
            primaryObjective: performance ? "Shift more load toward race-relevant work." : "Introduce more event-relevant rhythm without losing control.",
            volumeEmphasis: 0.62,
            intensityEmphasis: performance ? 0.62 : 0.38,
            longRunEmphasis: 0.66,
            specificityEmphasis: 0.7,
            adaptationSensitivity: 0.68,
        };
    }
    if (phase === "peak") {
        return {
            primaryObjective: "Deliver the strongest and most event-specific training weeks.",
            volumeEmphasis: 0.48,
            intensityEmphasis: performance ? 0.68 : 0.44,
            longRunEmphasis: 0.74,
            specificityEmphasis: 0.84,
            adaptationSensitivity: 0.74,
        };
    }
    return {
        primaryObjective: "Reduce fatigue while preserving confidence and rhythm.",
        volumeEmphasis: 0.22,
        intensityEmphasis: performance ? 0.36 : 0.24,
        longRunEmphasis: 0.2,
        specificityEmphasis: 0.52,
        adaptationSensitivity: 0.9,
    };
}
function buildBlocks(weeks, planType, classification) {
    const blocks = [];
    for (const week of weeks) {
        const current = blocks.at(-1);
        if (!current || current.phase !== week.phase || current.timelinePhase !== week.timelinePhase) {
            blocks.push({
                phase: week.phase,
                timelinePhase: week.timelinePhase,
                startWeekIndex: week.weekIndex,
                endWeekIndex: week.weekIndex,
                weeks: 1,
                purpose: phasePurpose(week.phase, planType, classification),
            });
        }
        else {
            current.endWeekIndex = week.weekIndex;
            current.weeks += 1;
        }
    }
    return blocks;
}
function buildPhasePlan(input, classification, planType) {
    const totalWeeks = Math.max(6, (0, calendar_week_1.deriveCalendarWeekCount)(input.startDate, input.goalDate) ?? 12);
    const hasRaceWeek = planType !== "return_to_running" && planType !== "consistency_builder";
    const nonRaceWeeks = hasRaceWeek ? totalWeeks - 1 : totalWeeks;
    const allocations = defaultAllocations(nonRaceWeeks, planType, classification.traits.runnerLevel);
    const weeks = [];
    const availableDays = Math.max(2, input.availableTrainingDays.length || 3);
    [
        ["base", allocations.base],
        ["build", allocations.build],
        ["specific", allocations.specific],
        ["peak", allocations.peak],
        ["taper", allocations.taper],
    ].forEach(([phase, count]) => {
        for (let index = 0; index < count; index += 1) {
            const targets = phaseTargets(phase, phase, planType, classification.traits.runnerLevel, availableDays);
            weeks.push({
                weekIndex: weeks.length + 1,
                phase,
                timelinePhase: phase,
                phaseProgress: count <= 1 ? 1 : index / (count - 1),
                isCutback: false,
                isRaceWeek: false,
                targetRuns: targets.targetRuns,
                targetQualitySessions: targets.targetQualitySessions,
                notes: targets.notes,
            });
        }
    });
    if (hasRaceWeek) {
        const targets = phaseTargets("race", "taper", planType, classification.traits.runnerLevel, availableDays);
        weeks.push({
            weekIndex: weeks.length + 1,
            phase: "taper",
            timelinePhase: "race",
            phaseProgress: 1,
            isCutback: false,
            isRaceWeek: true,
            targetRuns: targets.targetRuns,
            targetQualitySessions: targets.targetQualitySessions,
            notes: targets.notes,
        });
    }
    return {
        totalWeeks,
        weeks,
        blocks: buildBlocks(weeks, planType, classification),
        raceWeekIndex: hasRaceWeek ? totalWeeks : undefined,
    };
}
