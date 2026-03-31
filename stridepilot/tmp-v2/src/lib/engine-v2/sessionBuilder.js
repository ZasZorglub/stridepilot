"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.progressIntervalWorkout = progressIntervalWorkout;
exports.progressTempoWorkout = progressTempoWorkout;
exports.progressLongRunWorkout = progressLongRunWorkout;
exports.buildSession = buildSession;
const calendar_week_1 = require("../calendar-week");
function roundHalf(value) {
    return Math.round(value * 2) / 2;
}
function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}
function toIsoDate(date) {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
}
function dayOffset(day) {
    return ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].indexOf(day);
}
function warmupSegments(type, quality) {
    if (type === "brisk_walk")
        return [{ kind: "warmup", label: "Rask gang", durationMin: quality ? 6 : 5 }];
    if (type === "walk_jog") {
        return [
            { kind: "warmup", label: "Rolig gang", durationMin: 3 },
            { kind: "warmup", label: "Let jog", durationMin: quality ? 4 : 3 },
        ];
    }
    return [{ kind: "warmup", label: "Let jog", durationMin: quality ? 8 : 6 }];
}
function cooldownSegments(type) {
    if (type === "brisk_walk")
        return [{ kind: "cooldown", label: "Rolig gang", durationMin: 5 }];
    if (type === "walk_jog") {
        return [
            { kind: "cooldown", label: "Let jog", durationMin: 2 },
            { kind: "cooldown", label: "Gang ned", durationMin: 3 },
        ];
    }
    return [
        { kind: "cooldown", label: "Let jog ned", durationMin: 3 },
        { kind: "cooldown", label: "Rolig afslutning", durationMin: 2 },
    ];
}
function mergeConsecutiveSegments(segments) {
    if (segments.length <= 1)
        return segments;
    const merged = [];
    for (const segment of segments) {
        const previous = merged.at(-1);
        const mergeable = previous &&
            previous.kind === segment.kind &&
            (previous.repeats ?? 1) === 1 &&
            (segment.repeats ?? 1) === 1 &&
            !previous.recoverMin &&
            !segment.recoverMin;
        if (mergeable) {
            previous.durationMin = roundHalf(previous.durationMin + segment.durationMin);
            previous.label =
                previous.kind === "main"
                    ? previous.label.includes("Progression") || segment.label.includes("afslutning")
                        ? "Progressionsblok"
                        : previous.label.includes("Steady") || segment.label.includes("Steady")
                            ? "Steady-blok"
                            : previous.label
                    : previous.label;
            continue;
        }
        merged.push({ ...segment });
    }
    return merged;
}
function intensityMultiplier(level) {
    if (level === "very_easy")
        return 0.68;
    if (level === "easy")
        return 0.8;
    if (level === "steady")
        return 0.92;
    if (level === "moderate")
        return 1;
    if (level === "comfortably_hard")
        return 1.1;
    return 1.18;
}
function titleForFamily(family) {
    if (family === "easy_run")
        return "Roligt løb";
    if (family === "recovery_run")
        return "Recovery-løb";
    if (family === "development_run")
        return "Udviklingspas";
    if (family === "steady_run")
        return "Steady-pas";
    if (family === "tempo_run")
        return "Tempopas";
    if (family === "intervals")
        return "Intervalpas";
    if (family === "fartlek")
        return "Fartlek";
    if (family === "hill_reps")
        return "Bakkeintervaller";
    if (family === "progression_run")
        return "Progressionspas";
    if (family === "strides_session")
        return "Roligt løb med strides";
    if (family === "race_specific")
        return "Målspecifikt pas";
    if (family === "run_walk_progression")
        return "Run/walk-udvikling";
    return "Lang tur";
}
function raceTitleForDistance(raceDistance) {
    if (raceDistance === "5K")
        return "5 km måldag";
    if (raceDistance === "10K")
        return "10 km måldag";
    if (raceDistance === "HalfMarathon")
        return "Halvmaraton måldag";
    return "Maraton måldag";
}
function raceEventRunTarget(raceDistance, continuousMin, longRunMin, runnerLevel, goalType) {
    const conservative5k10k = (runnerLevel === "true_beginner" || runnerLevel === "beginner_plus") &&
        (goalType === "finish" || goalType === "finish_without_walking" || goalType === "return_to_running");
    if (raceDistance === "5K") {
        if (conservative5k10k) {
            return roundHalf(Math.max(28, Math.min(42, Math.max(continuousMin * 1.04, longRunMin * 0.76))));
        }
        return roundHalf(Math.max(24, Math.min(40, Math.max(continuousMin * 0.95, longRunMin * 0.68))));
    }
    if (raceDistance === "10K") {
        if (conservative5k10k) {
            return roundHalf(Math.max(46, Math.min(80, Math.max(continuousMin * 1.1, longRunMin * 0.92))));
        }
        return roundHalf(Math.max(42, Math.min(76, Math.max(continuousMin * 1.02, longRunMin * 0.84))));
    }
    if (raceDistance === "HalfMarathon") {
        return roundHalf(Math.max(82, Math.min(150, Math.max(continuousMin * 1.24, longRunMin * 0.88))));
    }
    return roundHalf(Math.max(132, Math.min(230, Math.max(continuousMin * 1.52, longRunMin * 0.94))));
}
function isBeginnerNoWalkRaceWeek(selection, planType, runnerLevel) {
    return (selection.isRaceWeek === true &&
        selection.role === "long_run" &&
        runnerLevel === "true_beginner" &&
        (planType === "5k_finish" || planType === "5k_finish_no_walk"));
}
function notesForSelection(selection, planType) {
    const notes = [...(selection.notes ?? [])];
    if (selection.family === "run_walk_progression") {
        notes.push("Continuous target should govern whether run blocks lengthen, walk breaks shorten, or both.");
    }
    if (planType.includes("target_time") && selection.role === "quality") {
        notes.push("This session should preserve specificity without turning the week into an all-out effort.");
    }
    return notes.length > 0 ? notes : undefined;
}
function beginnerProgressStage(targetContinuousMin) {
    if (targetContinuousMin >= 14)
        return 4;
    if (targetContinuousMin >= 10)
        return 3;
    if (targetContinuousMin >= 7)
        return 2;
    return 1;
}
function runWalkRecipe(currentContinuousMin, targetContinuousMin, runnerLevel, longRun, conservative, desiredTotalMinutes) {
    const cautious = runnerLevel === "true_beginner";
    const stage = beginnerProgressStage(targetContinuousMin);
    const runMin = stage === 1
        ? cautious
            ? 1
            : 2
        : stage === 2
            ? cautious
                ? 2
                : 3.5
            : stage === 3
                ? cautious
                    ? 4
                    : 6
                : cautious
                    ? 6
                    : Math.max(8, roundHalf(targetContinuousMin * 0.72));
    const walkMin = stage === 1 ? (cautious ? 2 : 1.5) : stage === 2 ? 1.5 : stage === 3 ? 1 : conservative ? 1 : 0.5;
    const fallbackTotal = longRun
        ? Math.max(targetContinuousMin * (stage >= 3 ? 1.15 : 1.05), currentContinuousMin + (stage >= 3 ? 8 : 6), 18)
        : Math.max(targetContinuousMin * (stage >= 3 ? 1.05 : 1), currentContinuousMin + (stage >= 4 ? 6 : 3), 14);
    const totalSessionTarget = desiredTotalMinutes ?? fallbackTotal;
    const setupAllowance = longRun ? 10 : 8;
    const mainTarget = Math.max(totalSessionTarget - setupAllowance, longRun ? 10 : 8);
    const cycleDuration = runMin + walkMin;
    const repeats = stage >= 4
        ? 2
        : Math.max(longRun ? 4 : 4, Math.ceil((mainTarget + (longRun ? walkMin : 0)) / cycleDuration));
    return {
        runMin: roundHalf(runMin),
        walkMin: roundHalf(walkMin),
        repeats,
        title: longRun ? "Lang run/walk-tur" : "Run/walk-udvikling",
        longRunContribution: roundHalf(runMin * repeats),
        structureType: longRun ? "long_run_run_walk" : "run_walk_blocks",
    };
}
function blueprintForSelection(selection, phase, continuousMin, longRunMin, intensity, runnerLevel) {
    const warmupType = runnerLevel === "true_beginner" ? "brisk_walk" : runnerLevel === "beginner_plus" ? "walk_jog" : "easy_jog";
    const qualityLike = selection.role === "quality";
    const warmupDuration = warmupType === "easy_jog" ? (qualityLike ? 8 : 6) : warmupType === "walk_jog" ? (qualityLike ? 7 : 6) : qualityLike ? 6 : 5;
    const cooldownDuration = warmupType === "easy_jog" ? 5 : 5;
    if (selection.family === "run_walk_progression") {
        const recipe = runWalkRecipe(continuousMin * 0.6, continuousMin, runnerLevel, selection.role === "long_run", selection.conservative, selection.role === "long_run" ? longRunMin : undefined);
        const walkRecoveries = recipe.structureType === "long_run_run_walk" ? Math.max(recipe.repeats - 1, 1) : Math.max(recipe.repeats - 1, 0);
        return {
            family: selection.family,
            structureType: recipe.structureType,
            purpose: selection.purpose,
            intensityLevel: selection.intensityCap,
            primaryLoadDimension: selection.role === "long_run" ? "long_run" : "continuous_running",
            warmupType,
            estimatedTotalMinutes: roundHalf(warmupDuration + cooldownDuration + recipe.runMin * recipe.repeats + recipe.walkMin * walkRecoveries),
            notes: selection.notes,
        };
    }
    if (selection.family === "long_run") {
        return {
            family: selection.family,
            structureType: "long_run_continuous",
            purpose: selection.purpose,
            intensityLevel: selection.intensityCap,
            primaryLoadDimension: "long_run",
            warmupType,
            estimatedTotalMinutes: roundHalf(warmupDuration + cooldownDuration + longRunMin),
            notes: selection.notes,
        };
    }
    if (selection.family === "recovery_run") {
        return {
            family: selection.family,
            structureType: "continuous_easy",
            purpose: selection.purpose,
            intensityLevel: selection.intensityCap,
            primaryLoadDimension: "stabilize",
            warmupType,
            estimatedTotalMinutes: roundHalf(warmupDuration + cooldownDuration + Math.max(14, continuousMin * (phase === "taper" ? 0.42 : 0.56))),
            notes: selection.notes,
        };
    }
    if (selection.family === "easy_run") {
        return {
            family: selection.family,
            structureType: "continuous_easy",
            purpose: selection.purpose,
            intensityLevel: selection.intensityCap,
            primaryLoadDimension: "weekly_volume",
            warmupType,
            estimatedTotalMinutes: roundHalf(warmupDuration + cooldownDuration + Math.max(phase === "taper" ? 12 : 20, continuousMin * (phase === "taper" ? 0.46 : selection.conservative ? 0.82 : 0.9))),
            notes: selection.notes,
        };
    }
    if (selection.family === "development_run") {
        const beginnerish = runnerLevel === "true_beginner" || runnerLevel === "beginner_plus";
        return {
            family: selection.family,
            structureType: beginnerish || phase === "taper" || selection.role === "aerobic_support" ? "development_blocks" : "continuous_easy",
            purpose: selection.purpose,
            intensityLevel: selection.intensityCap,
            primaryLoadDimension: "weekly_volume",
            warmupType,
            estimatedTotalMinutes: roundHalf(warmupDuration + cooldownDuration + Math.max(phase === "taper" ? 16 : 20, continuousMin * (phase === "taper" ? 0.54 : 0.82))),
            notes: selection.notes,
        };
    }
    if (selection.family === "steady_run") {
        return {
            family: selection.family,
            structureType: "continuous_steady",
            purpose: selection.purpose,
            intensityLevel: selection.intensityCap,
            primaryLoadDimension: selection.role === "quality" ? "intensity" : "weekly_volume",
            warmupType,
            estimatedTotalMinutes: roundHalf(warmupDuration + cooldownDuration + Math.max(20, continuousMin * (phase === "taper" ? 0.72 : 0.9))),
            notes: selection.notes,
        };
    }
    if (selection.family === "tempo_run") {
        const useIntervals = continuousMin >= 34 || intensity < 0.3;
        return {
            family: selection.family,
            structureType: useIntervals ? "tempo_intervals" : "tempo_block",
            purpose: selection.purpose,
            intensityLevel: selection.intensityCap,
            primaryLoadDimension: "intensity",
            warmupType,
            estimatedTotalMinutes: roundHalf(warmupDuration + cooldownDuration + Math.max(22, continuousMin * (phase === "taper" ? 0.64 : 0.78))),
            notes: selection.notes,
        };
    }
    if (selection.family === "intervals") {
        return {
            family: selection.family,
            structureType: "interval_repeats",
            purpose: selection.purpose,
            intensityLevel: selection.intensityCap,
            primaryLoadDimension: "intensity",
            warmupType,
            estimatedTotalMinutes: roundHalf(warmupDuration + cooldownDuration + Math.max(24, continuousMin * (phase === "taper" ? 0.62 : 0.74))),
            notes: selection.notes,
        };
    }
    if (selection.family === "fartlek") {
        return {
            family: selection.family,
            structureType: "interval_repeats",
            purpose: selection.purpose,
            intensityLevel: selection.intensityCap,
            primaryLoadDimension: "intensity",
            warmupType,
            estimatedTotalMinutes: roundHalf(warmupDuration + cooldownDuration + Math.max(22, continuousMin * (phase === "taper" ? 0.66 : 0.8))),
            notes: selection.notes,
        };
    }
    if (selection.family === "hill_reps") {
        return {
            family: selection.family,
            structureType: "hill_repeat_structure",
            purpose: selection.purpose,
            intensityLevel: selection.intensityCap,
            primaryLoadDimension: "intensity",
            warmupType,
            estimatedTotalMinutes: roundHalf(warmupDuration + cooldownDuration + Math.max(22, continuousMin * (phase === "taper" ? 0.62 : 0.72))),
            notes: selection.notes,
        };
    }
    if (selection.family === "progression_run") {
        return {
            family: selection.family,
            structureType: "progression_blocks",
            purpose: selection.purpose,
            intensityLevel: selection.intensityCap,
            primaryLoadDimension: selection.role === "quality" ? "intensity" : "weekly_volume",
            warmupType,
            estimatedTotalMinutes: roundHalf(warmupDuration + cooldownDuration + Math.max(22, continuousMin * (phase === "taper" ? 0.68 : 0.8))),
            notes: selection.notes,
        };
    }
    if (selection.family === "strides_session") {
        return {
            family: selection.family,
            structureType: "strides_after_easy",
            purpose: selection.purpose,
            intensityLevel: selection.intensityCap,
            primaryLoadDimension: "intensity",
            warmupType,
            estimatedTotalMinutes: roundHalf(warmupDuration + cooldownDuration + Math.max(18, continuousMin * 0.64)),
            notes: selection.notes,
        };
    }
    return {
        family: selection.family,
        structureType: "race_specific_blocks",
        purpose: selection.purpose,
        intensityLevel: selection.intensityCap,
        primaryLoadDimension: selection.role === "long_run" ? "long_run" : "intensity",
        warmupType,
        estimatedTotalMinutes: roundHalf(warmupDuration + cooldownDuration + Math.max(20, continuousMin * (phase === "taper" ? 0.62 : 0.78))),
        notes: selection.notes,
    };
}
function buildMainSet(input, blueprint, selection, phase, continuousMin, longRunMin, runnerLevel, goalType, totalWeeks, intervalTargetMin) {
    if (selection.isRaceEvent) {
        const raceDuration = raceEventRunTarget(input.raceDistance, continuousMin, longRunMin, runnerLevel, goalType);
        return {
            segments: [{ kind: "main", label: `${raceTitleForDistance(input.raceDistance)} i rolig, jævn rytme`, durationMin: raceDuration }],
            purposeText: "Lade måldagen være den klare kulmination af planen med en samlet indsats, der stadig bygger på friskhed og kontrol.",
            cues: ["Start kontrolleret og brug de første minutter til at finde rytmen.", "Lad indsatsen udvikle sig frem for at forcere åbningen."],
            longRunContribution: input.raceDistance === "5K" ? 0 : raceDuration,
        };
    }
    if (blueprint.structureType === "run_walk_blocks" || blueprint.structureType === "long_run_run_walk") {
        const recipe = runWalkRecipe(continuousMin * 0.6, continuousMin, runnerLevel, blueprint.structureType === "long_run_run_walk", selection.conservative, blueprint.structureType === "long_run_run_walk" ? longRunMin : undefined);
        return {
            segments: [{ kind: "main", label: blueprint.structureType === "long_run_run_walk" ? "Længere løb/gang blok" : "Løb/gang blok", durationMin: recipe.runMin, repeats: recipe.repeats, recoverMin: recipe.walkMin }],
            purposeText: blueprint.structureType === "long_run_run_walk"
                ? "Bygge langturstolerance med mere tid på benene uden at presse sammenhængende løb for tidligt."
                : "Flytte dig mod længere sammenhængende løb på en kontrolleret måde.",
            cues: recipe.runMin >= 6
                ? ["Lad løbeblokkene være rolige og sammenhængende.", "Brug de korte reset-pauser til at holde rytmen ren."]
                : ["Løb roligt i alle blokke.", "Lad pauserne gøre passet stabilt, ikke for let."],
            longRunContribution: recipe.longRunContribution,
        };
    }
    if (blueprint.structureType === "continuous_easy") {
        const baseDuration = blueprint.family === "recovery_run"
            ? Math.max(12, roundHalf(continuousMin * (phase === "taper" ? 0.38 : 0.5)))
            : blueprint.family === "easy_run"
                ? Math.max(phase === "taper" ? 12 : 18, roundHalf(continuousMin * (phase === "taper" ? 0.42 : selection.conservative ? 0.72 : 0.84)))
                : Math.max(18, roundHalf(continuousMin * 0.84));
        return {
            segments: [{ kind: "main", label: blueprint.family === "recovery_run" ? "Meget roligt løb" : "Roligt løb", durationMin: baseDuration }],
            purposeText: blueprint.family === "recovery_run"
                ? "Giv kroppen et meget let pas, som hjælper restitution og rytme uden at lægge nyt pres på ugen."
                : blueprint.family === "easy_run"
                    ? "Vedligeholde aerob base med lav stress og god bevægelsesrytme."
                    : "Udvide rolig kapacitet og gøre sammenhængende løb mere naturligt.",
            cues: blueprint.family === "recovery_run"
                ? ["Dette skal føles markant lettere end ugens nøglepas.", "Afslut med mere overskud, end du startede med."]
                : blueprint.family === "easy_run"
                    ? ["Hold tempoet afslappet og kontrolleret.", "Løbet skal føles bæredygtigt fra start til slut."]
                    : ["Byg roligt gennem passet uden at jagte fart.", "Tænk kontinuitet frem for præstation."],
            longRunContribution: 0,
        };
    }
    if (blueprint.structureType === "development_blocks") {
        const first = Math.max(phase === "taper" ? 6 : 8, roundHalf(continuousMin * (phase === "taper" ? 0.28 : 0.38)));
        const second = Math.max(phase === "taper" ? 5 : 6, roundHalf(continuousMin * (phase === "taper" ? 0.18 : 0.24)));
        return {
            segments: [
                { kind: "main", label: "Rolig kontinuitetsblok", durationMin: first },
                { kind: "recovery", label: "Kort reset", durationMin: 1.5 },
                { kind: "main", label: "Ny rolig blok", durationMin: second },
            ],
            purposeText: "Bygge tolerance for længere sammenhængende løb med en enkel struktur, der stadig føles overkommelig.",
            cues: ["Første blok skal sætte en rolig rytme.", "Brug den korte reset til at samle dig, ikke til at starte forfra."],
            longRunContribution: 0,
        };
    }
    if (blueprint.structureType === "continuous_steady") {
        const steady = Math.max(18, roundHalf(continuousMin * (phase === "taper" ? 0.42 : 0.6)));
        return {
            segments: [{ kind: "main", label: "Steady-blok", durationMin: steady }],
            purposeText: "Skabe stærkere aerob rytme uden at gøre passet til et hårdt tempoløb.",
            cues: ["Steady-delen skal føles fokuseret, men kontrolleret.", "Du må ikke drive ind i threshold eller race effort."],
            longRunContribution: 0,
        };
    }
    if (blueprint.structureType === "tempo_block") {
        const progression = progressTempoWorkout({ duration: Math.max(14, roundHalf(continuousMin * 0.55)) }, selection.weekIndex, phase, goalType);
        return {
            segments: progression.blocks.map((block) => ({
                kind: "main",
                label: block.label,
                durationMin: block.duration,
                repeats: block.repeats,
                recoverMin: block.rest,
            })),
            purposeText: "Udvikle tærskel og rytmekontrol i en sammenhængende blok.",
            cues: ["Kontrolleret hårdt, ikke maks.", "Hold rytmen jævn fra start til slut."],
            longRunContribution: 0,
        };
    }
    if (blueprint.structureType === "tempo_intervals") {
        const progression = progressTempoWorkout({ duration: Math.max(8, roundHalf(continuousMin * 0.28)) }, selection.weekIndex, phase, goalType);
        return {
            segments: progression.blocks.map((block) => ({
                kind: "main",
                label: block.label,
                durationMin: block.duration,
                repeats: block.repeats,
                recoverMin: block.rest,
            })),
            purposeText: "Udvikle tempo/threshold på en mere kontrolleret måde end ét langt sammenhængende tempoløb.",
            cues: ["Hold hver blok stabil.", "Pauserne er korte og kontrollerede."],
            longRunContribution: 0,
        };
    }
    if (blueprint.structureType === "interval_repeats") {
        const progression = progressIntervalWorkout({ duration: Math.max(16, roundHalf(continuousMin * 0.12)) }, selection.weekIndex, totalWeeks, phase, goalType, intervalTargetMin);
        return {
            segments: [{
                    kind: "main",
                    label: blueprint.family === "fartlek" ? "Fartskift" : progression.label,
                    durationMin: progression.work,
                    repeats: progression.repeats,
                    recoverMin: progression.rest,
                }],
            purposeText: blueprint.family === "fartlek" ? "Udvikle fartkontrol i et mere flydende kvalitetspas." : "Udvikle fart og iltoptagelse med tydelig repeat-logik.",
            cues: ["Kvalitet vigtigere end rå fart.", "Lad pauserne gøre gode gentagelser mulige."],
            longRunContribution: 0,
        };
    }
    if (blueprint.structureType === "progression_blocks") {
        const first = Math.max(10, roundHalf(continuousMin * (phase === "taper" ? 0.36 : 0.42)));
        const second = Math.max(8, roundHalf(continuousMin * (phase === "taper" ? 0.2 : 0.28)));
        return {
            segments: [{ kind: "main", label: "Progressionsblok", durationMin: first + second }],
            purposeText: "Lære kroppen at åbne under kontrol og afslutte stærkere uden at miste rytme.",
            cues: ["Første del skal føles tilbageholdt.", "Sidste del må være fokuseret, men stadig ren i formen."],
            longRunContribution: 0,
        };
    }
    if (blueprint.structureType === "long_run_continuous") {
        if (isBeginnerNoWalkRaceWeek(selection, "5k_finish_no_walk", runnerLevel) || isBeginnerNoWalkRaceWeek(selection, "5k_finish", runnerLevel)) {
            const goalAttempt = roundHalf(Math.max(28, Math.min(38, continuousMin + 10)));
            return {
                segments: [{ kind: "main", label: "5 km måldag i rolig, jævn rytme", durationMin: goalAttempt }],
                purposeText: "Lade ugens weekendrolle blive et roligt, selvsikkert forsøg på at gennemføre målet uden normal langturstræthed.",
                cues: ["Start roligt og hold rytmen enkel.", "Målet er at gennemføre med kontrol, ikke at presse fart."],
                longRunContribution: goalAttempt,
            };
        }
        const longBlock = roundHalf(longRunMin * (phase === "taper" ? 0.82 : 1));
        const progression = progressLongRunWorkout({ duration: longBlock }, selection.weekIndex, phase, goalType);
        return {
            segments: progression.blocks.map((block) => ({
                kind: "main",
                label: block.type === "easy"
                    ? "Lang rolig blok"
                    : block.type === "progression"
                        ? "Progressiv afslutning"
                        : block.type === "threshold"
                            ? "Tempoblok i lang tur"
                            : "Race-pace blok i lang tur",
                durationMin: block.duration,
                repeats: block.repeats,
                recoverMin: block.rest,
            })),
            purposeText: progression.style === "easy"
                ? "Bygge udholdenhed og gøre den samlede plan mere robust."
                : progression.style === "progressive"
                    ? "Bygge udholdenhed og afslutte stærkere uden at gøre langturen til et hårdt pas."
                    : progression.style === "tempo_segments"
                        ? "Bygge udholdenhed med kontrollerede temposegmenter i langturen."
                        : progression.style === "race_pace_segments"
                            ? "Bygge målspecifik udholdenhed med race-pace segmenter i langturen."
                            : "Holde langturen kortere og lettere tættere på konkurrenceugen.",
            cues: progression.style === "easy"
                ? ["Det skal føles bæredygtigt, ikke heroisk.", "Hold fokus på tid på benene."]
                : progression.style === "progressive"
                    ? ["Første del skal være rolig og kontrolleret.", "Den progressive afslutning må ikke tippe over i et hårdt pas."]
                    : progression.style === "tempo_segments"
                        ? ["Segmenterne skal være kontrollerede.", "Resten af langturen skal stadig føles som en langtur."]
                        : progression.style === "race_pace_segments"
                            ? ["Løb segmenterne præcist, ikke aggressivt.", "Bevar langtursfølelsen mellem blokkene."]
                            : ["Hold passet kort og let.", "Målet er friskhed, ikke træningsstress."],
            longRunContribution: longBlock,
        };
    }
    if (blueprint.structureType === "strides_after_easy") {
        return {
            segments: [
                { kind: "main", label: "Roligt løb", durationMin: Math.max(18, roundHalf(continuousMin * 0.72)) },
                { kind: "main", label: "Strides", durationMin: 0.25, repeats: 6, recoverMin: 1 },
            ],
            purposeText: "Skærpe rytme og teknik uden at gøre passet tungt.",
            cues: ["Strides skal være lette og hurtige, ikke sprint.", "Hold resten af passet roligt."],
            longRunContribution: 0,
        };
    }
    if (blueprint.structureType === "hill_repeat_structure") {
        return {
            segments: [{ kind: "main", label: "Bakkedrag", durationMin: 1, repeats: 8, recoverMin: 2 }],
            purposeText: "Bygge styrke og løbeøkonomi via korte, kontrollerede bakkeindsatser.",
            cues: ["Løb op med god holdning.", "Jogg eller gå roligt ned som pause."],
            longRunContribution: 0,
        };
    }
    return {
        segments: [{ kind: "main", label: "Målspecifik blok", durationMin: Math.max(8, roundHalf(continuousMin * 0.32)), repeats: 2, recoverMin: 3 }],
        purposeText: "Skabe rytmetryghed tættere på de krav, måldistancen stiller.",
        cues: ["Løb kontrolleret og specifikt.", "Pasformen er vigtigere end pace-tallet."],
        longRunContribution: 0,
    };
}
function sumDuration(segments) {
    return roundHalf(segments.reduce((sum, segment) => sum + segment.durationMin * (segment.repeats ?? 1) + (segment.recoverMin ?? 0) * Math.max((segment.repeats ?? 1) - 1, 0), 0));
}
function easyWarmup(runnerLevel, quality) {
    if (runnerLevel === "true_beginner")
        return quality ? 6 : 5;
    if (runnerLevel === "beginner_plus")
        return quality ? 7 : 6;
    return quality ? 10 : 6;
}
function buildStructuredSession(params) {
    const { sessionType, duration, runnerLevel, phase, goalType } = params;
    const beginner = runnerLevel === "true_beginner" || runnerLevel === "beginner_plus";
    const performanceGoal = goalType === "improve_time" || goalType === "target_time";
    const total = Math.max(duration, 16);
    if (sessionType === "easy_run") {
        const warmup = easyWarmup(runnerLevel, false);
        const cooldown = 5;
        return {
            warmup,
            blocks: [{ type: "easy", duration: Math.max(8, roundHalf(total - warmup - cooldown)) }],
            cooldown,
            totalDuration: total,
        };
    }
    if (sessionType === "recovery_jog") {
        const warmup = beginner ? 5 : 6;
        const cooldown = 5;
        return {
            warmup,
            blocks: [{ type: "easy", duration: Math.max(6, roundHalf(total - warmup - cooldown)) }],
            cooldown,
            totalDuration: total,
        };
    }
    if (sessionType === "steady_run") {
        const warmup = easyWarmup(runnerLevel, true);
        const cooldown = 5;
        const main = Math.max(10, roundHalf(total - warmup - cooldown));
        const steady = roundHalf(main * 0.7);
        return {
            warmup,
            blocks: [
                { type: "steady", duration: steady },
                { type: "easy", duration: roundHalf(main - steady) },
            ],
            cooldown,
            totalDuration: total,
        };
    }
    if (sessionType === "progression_run") {
        const warmup = easyWarmup(runnerLevel, true);
        const cooldown = 5;
        const main = Math.max(12, roundHalf(total - warmup - cooldown));
        return {
            warmup,
            blocks: [
                { type: "easy", duration: roundHalf(main * 0.55) },
                { type: "progression", duration: roundHalf(main * 0.45) },
            ],
            cooldown,
            totalDuration: total,
        };
    }
    if (sessionType === "development_run" || sessionType === "continuous_build") {
        const warmup = beginner ? 5 : 6;
        const cooldown = 5;
        const main = Math.max(10, roundHalf(total - warmup - cooldown));
        if (beginner || sessionType === "continuous_build") {
            return {
                warmup,
                blocks: [
                    { type: "easy", duration: roundHalf(main * 0.6) },
                    { type: "run", duration: roundHalf(main * 0.4) },
                ],
                cooldown,
                totalDuration: total,
            };
        }
        return {
            warmup,
            blocks: [{ type: "steady", duration: main }],
            cooldown,
            totalDuration: total,
        };
    }
    if (sessionType === "run_walk" || sessionType === "run_walk_long") {
        const warmup = beginner ? 5 : 6;
        const cooldown = 5;
        const main = Math.max(10, roundHalf(total - warmup - cooldown));
        const runDuration = runnerLevel === "true_beginner"
            ? 1
            : runnerLevel === "beginner_plus"
                ? 2
                : 3;
        const walkDuration = sessionType === "run_walk_long" ? 1.5 : 1;
        const repeats = Math.max(4, Math.round(main / (runDuration + walkDuration)));
        return {
            warmup,
            blocks: [
                { type: "run", duration: runDuration, repeats, rest: walkDuration },
            ],
            cooldown,
            totalDuration: roundHalf(warmup + cooldown + repeats * runDuration + Math.max(repeats - 1, 0) * walkDuration),
        };
    }
    if (sessionType === "threshold_intervals") {
        const warmup = 10;
        const cooldown = 5;
        const main = Math.max(18, roundHalf(total - warmup - cooldown));
        const intervalDuration = clampInterval(roundHalf(main >= 30 ? 8 : 6), 6, 10);
        const repeats = Math.max(2, Math.min(4, Math.round(main / (intervalDuration + 2))));
        return {
            warmup,
            blocks: [{ type: "threshold", duration: intervalDuration, repeats, rest: 2 }],
            cooldown,
            totalDuration: roundHalf(warmup + cooldown + repeats * intervalDuration + Math.max(repeats - 1, 0) * 2),
        };
    }
    if (sessionType === "vo2_intervals") {
        const warmup = 10;
        const cooldown = 5;
        const main = Math.max(16, roundHalf(total - warmup - cooldown));
        const intervalDuration = clampInterval(roundHalf(main >= 24 ? 3 : 2), 2, 4);
        const repeats = Math.max(4, Math.min(8, Math.round(main / (intervalDuration + 2))));
        return {
            warmup,
            blocks: [{ type: "interval", duration: intervalDuration, repeats, rest: 2 }],
            cooldown,
            totalDuration: roundHalf(warmup + cooldown + repeats * intervalDuration + Math.max(repeats - 1, 0) * 2),
        };
    }
    if (sessionType === "race_pace_blocks") {
        const warmup = 10;
        const cooldown = 5;
        const main = Math.max(16, roundHalf(total - warmup - cooldown));
        if (phase === "taper") {
            return {
                warmup,
                blocks: [{ type: "race_pace", duration: Math.max(8, main) }],
                cooldown,
                totalDuration: total,
            };
        }
        return {
            warmup,
            blocks: [{ type: "race_pace", duration: Math.max(6, roundHalf(main * 0.45)), repeats: 2, rest: 3 }],
            cooldown,
            totalDuration: roundHalf(warmup + cooldown + Math.max(6, roundHalf(main * 0.45)) * 2 + 3),
        };
    }
    if (sessionType === "long_run_easy") {
        const warmup = 5;
        const cooldown = 5;
        return {
            warmup,
            blocks: [{ type: "easy", duration: Math.max(15, roundHalf(total - warmup - cooldown)) }],
            cooldown,
            totalDuration: total,
        };
    }
    if (sessionType === "long_run_progressive") {
        const warmup = 5;
        const cooldown = 5;
        const main = Math.max(20, roundHalf(total - warmup - cooldown));
        return {
            warmup,
            blocks: [
                { type: "easy", duration: roundHalf(main * 0.7) },
                { type: "progression", duration: roundHalf(main * 0.3) },
            ],
            cooldown,
            totalDuration: total,
        };
    }
    if (sessionType === "long_run_with_blocks") {
        const warmup = 5;
        const cooldown = 5;
        const main = Math.max(24, roundHalf(total - warmup - cooldown));
        const blockRepeats = performanceGoal ? 3 : 2;
        const blockDuration = roundHalf(Math.max(6, main * 0.15));
        const easyRemainder = Math.max(8, roundHalf(main - blockRepeats * blockDuration));
        return {
            warmup,
            blocks: [
                { type: "easy", duration: easyRemainder },
                { type: "race_pace", duration: blockDuration, repeats: blockRepeats, rest: 3 },
            ],
            cooldown,
            totalDuration: roundHalf(warmup + cooldown + easyRemainder + blockRepeats * blockDuration + Math.max(blockRepeats - 1, 0) * 3),
        };
    }
    const warmup = 6;
    const cooldown = 5;
    return {
        warmup,
        blocks: [{ type: "easy", duration: Math.max(10, roundHalf(total - warmup - cooldown)) }],
        cooldown,
        totalDuration: total,
    };
}
function clampInterval(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
function planProgress(weekNumber, totalWeeks) {
    if (totalWeeks <= 1)
        return 1;
    return Math.max(0, Math.min(1, (weekNumber - 1) / (totalWeeks - 1)));
}
function progressIntervalWorkout(workout, weekNumber, totalWeeks, phase, goalType, targetIntervalMin) {
    const progress = planProgress(weekNumber, totalWeeks);
    const targetLike = goalType === "target_time";
    const improveLike = goalType === "improve_time";
    const centralTarget = targetIntervalMin ? roundHalf(targetIntervalMin) : undefined;
    if (phase === "taper") {
        const work = clampInterval(centralTarget ?? (targetLike ? 2 : 3), 2, 4);
        return { work, repeats: targetLike ? 4 : 3, rest: 2, label: targetLike ? "Korte race-pace intervaller" : "Korte skarpe intervaller" };
    }
    if (phase === "base") {
        const work = clampInterval(centralTarget ?? (improveLike || targetLike ? 2 : 1), 1, 3);
        const repeats = work >= 3 ? 4 : work >= 2 ? 5 : 6;
        return { work, repeats, rest: 1.5, label: "Korte udviklingsintervaller" };
    }
    if (phase === "build") {
        const work = clampInterval(centralTarget ?? (progress > 0.45 ? 4 : 2), 2, 5);
        return work >= 4
            ? { work, repeats: 4, rest: 2, label: "Mellemlange intervaller" }
            : { work, repeats: 5, rest: 1.5, label: "Byggeintervaller" };
    }
    if (phase === "specific") {
        const work = clampInterval(centralTarget ?? (targetLike ? (progress > 0.7 ? 8 : 6) : progress > 0.65 ? 6 : 4), 4, 10);
        return targetLike
            ? { work, repeats: work >= 8 ? 3 : 4, rest: 2.5, label: "Målspecifikke intervaller" }
            : { work, repeats: work >= 6 ? 3 : 4, rest: 2, label: "Længere intervaller" };
    }
    const work = clampInterval(centralTarget ?? (targetLike ? 4 : 3), 3, 6);
    return { work, repeats: targetLike ? 4 : 3, rest: 2, label: targetLike ? "Peak race-pace intervaller" : "Peak intervaller" };
}
function progressTempoWorkout(workout, weekNumber, phase, goalType) {
    const targetLike = goalType === "target_time";
    if (phase === "taper") {
        return { blocks: [{ label: targetLike ? "Kort race-pace blok" : "Kort tempoblok", duration: 12 }] };
    }
    if (phase === "base") {
        return { blocks: [{ label: "Tempoblok", duration: 10 + (weekNumber % 2 === 0 ? 5 : 0) }] };
    }
    if (phase === "build") {
        return weekNumber % 2 === 0
            ? { blocks: [{ label: "Tempointerval", duration: 10, repeats: 2, rest: 2.5 }] }
            : { blocks: [{ label: "Tempoblok", duration: 20 }] };
    }
    if (phase === "specific") {
        return targetLike
            ? { blocks: [{ label: "Race-pace blok", duration: 10, repeats: 2, rest: 3 }] }
            : { blocks: [{ label: "Tempoblok", duration: 25 }] };
    }
    return { blocks: [{ label: targetLike ? "Race-pace blok" : "Tempoblok", duration: 15 }] };
}
function progressLongRunWorkout(workout, weekNumber, phase, goalType) {
    const finishLike = goalType === "finish" || goalType === "finish_without_walking" || goalType === "return_to_running" || goalType === "build_consistency";
    const targetLike = goalType === "target_time";
    const improveLike = goalType === "improve_time";
    const main = Math.max(20, roundHalf(workout.duration));
    if (phase === "taper")
        return { style: "short", blocks: [{ type: "easy", duration: main }] };
    if (finishLike || phase === "base")
        return { style: "easy", blocks: [{ type: "easy", duration: main }] };
    if (improveLike && phase === "specific") {
        const tempoBlock = Math.max(8, roundHalf(main * 0.16));
        return {
            style: "tempo_segments",
            blocks: [
                { type: "easy", duration: Math.max(20, roundHalf(main - tempoBlock * 2)) },
                { type: "threshold", duration: tempoBlock, repeats: 2, rest: 3 },
            ],
        };
    }
    if (targetLike && (phase === "specific" || phase === "peak")) {
        const raceBlock = phase === "peak" ? Math.max(12, roundHalf(main * 0.2)) : Math.max(10, roundHalf(main * 0.16));
        return {
            style: "race_pace_segments",
            blocks: [
                { type: "easy", duration: Math.max(18, roundHalf(main - raceBlock * (phase === "peak" ? 3 : 2))) },
                { type: "race_pace", duration: raceBlock, repeats: phase === "peak" ? 3 : 2, rest: 3 },
            ],
        };
    }
    return {
        style: "progressive",
        blocks: [
            { type: "easy", duration: roundHalf(main * 0.75) },
            { type: "progression", duration: roundHalf(main * 0.25) },
        ],
    };
}
function buildEngineSession(input, classification, planType, phase, curves, selection) {
    const weekIndex = selection.weekIndex;
    const continuousMin = curves.continuousCurve[weekIndex - 1] || input.currentContinuousRunMin;
    const longRunMin = curves.longRunCurve[weekIndex - 1] || input.longestRecentRunMin;
    const intervalTargetMin = curves.intervalDurationCurve[weekIndex - 1];
    const intensity = curves.intensityCurve[weekIndex - 1] || 0.2;
    const totalWeeks = curves.longRunCurve.length;
    const sessionBlueprint = blueprintForSelection(selection, phase, continuousMin, longRunMin, intensity, classification.traits.runnerLevel);
    const quality = selection.role === "quality";
    const main = buildMainSet(input, sessionBlueprint, selection, phase, continuousMin, longRunMin, classification.traits.runnerLevel, input.goalType, totalWeeks, intervalTargetMin);
    const structure = mergeConsecutiveSegments([...warmupSegments(sessionBlueprint.warmupType, quality), ...main.segments, ...cooldownSegments(sessionBlueprint.warmupType)]);
    const weekMonday = (0, calendar_week_1.planStartWeekMonday)(input.startDate);
    const date = addDays(weekMonday, (weekIndex - 1) * 7 + dayOffset(selection.day));
    const durationMin = sumDuration(structure);
    const beginnerRaceWeek = isBeginnerNoWalkRaceWeek(selection, planType, classification.traits.runnerLevel);
    const raceEvent = selection.isRaceEvent === true;
    const summary = beginnerRaceWeek
        ? "Kort og enkel måluge med et roligt 5 km-forsøg i stedet for en normal langtur"
        : raceEvent
            ? `Måldag i ${input.raceDistance} med fokus på friskhed, rytme og roligt opløb mod konkurrencen`
            : sessionBlueprint.structureType === "run_walk_blocks" || sessionBlueprint.structureType === "long_run_run_walk"
                ? `${titleForFamily(selection.family)} med tydelige løbe/gå-blokke`
                : `${titleForFamily(selection.family)} med ${main.segments.map((segment) => segment.label.toLowerCase()).join(" + ")}`;
    return {
        id: `${planType}-${weekIndex}-${selection.day}-${selection.family}`,
        weekIndex,
        day: selection.day,
        date: toIsoDate(date),
        role: selection.role,
        family: selection.family,
        structureType: sessionBlueprint.structureType,
        title: beginnerRaceWeek ? "5 km måldag" : raceEvent ? raceTitleForDistance(input.raceDistance) : titleForFamily(selection.family),
        purpose: raceEvent ? "Brug ugen til at møde startstregen frisk og klar til at gennemføre dagens mål." : main.purposeText,
        warmupType: sessionBlueprint.warmupType,
        durationMin,
        estimatedTotalMinutes: sessionBlueprint.estimatedTotalMinutes,
        longRunMinContribution: main.longRunContribution,
        intensityLoad: roundHalf(durationMin * intensityMultiplier(sessionBlueprint.intensityLevel)),
        primaryLoadDimension: sessionBlueprint.primaryLoadDimension,
        intensityLevel: sessionBlueprint.intensityLevel,
        summary,
        notes: notesForSelection(selection, planType),
        structure,
        coachingCues: [
            ...(raceEvent ? ["Hold optakten enkel og rolig.", "Start kontrolleret og lad løbet udvikle sig derfra."] : []),
            ...main.cues,
            phase === "taper" ? "Kom ud med friske ben, ikke træthed." : "Lad passet passe til ugens rolle, ikke til dagsformen alene.",
        ],
        isRaceEvent: raceEvent,
    };
}
function buildSession(arg1, classification, planType, phase, curves, selection) {
    if ("sessionType" in arg1) {
        return buildStructuredSession(arg1);
    }
    return buildEngineSession(arg1, classification, planType, phase, curves, selection);
}
