"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
function runWalkRecipe(currentContinuousMin, targetContinuousMin, runnerLevel, longRun, conservative) {
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
    const totalRunTarget = longRun
        ? Math.max(targetContinuousMin * (stage >= 3 ? 1.25 : 1.15), currentContinuousMin + (stage >= 3 ? 8 : 6), 16)
        : Math.max(targetContinuousMin * (stage >= 3 ? 1.05 : 1), currentContinuousMin + (stage >= 4 ? 6 : 3), 10);
    const repeats = stage >= 4 ? 2 : Math.max(longRun ? 3 : 4, Math.round(totalRunTarget / runMin));
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
        const recipe = runWalkRecipe(continuousMin * 0.6, continuousMin, runnerLevel, selection.role === "long_run", selection.conservative);
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
function buildMainSet(blueprint, selection, phase, continuousMin, longRunMin, runnerLevel) {
    if (blueprint.structureType === "run_walk_blocks" || blueprint.structureType === "long_run_run_walk") {
        const recipe = runWalkRecipe(continuousMin * 0.6, continuousMin, runnerLevel, blueprint.structureType === "long_run_run_walk", selection.conservative);
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
        const settle = Math.max(8, roundHalf(continuousMin * 0.24));
        const steady = Math.max(14, roundHalf(continuousMin * (phase === "taper" ? 0.34 : 0.48)));
        return {
            segments: [
                { kind: "main", label: "Rolig indløbning", durationMin: settle },
                { kind: "main", label: "Steady-blok", durationMin: steady },
            ],
            purposeText: "Skabe stærkere aerob rytme uden at gøre passet til et hårdt tempoløb.",
            cues: ["Steady-delen skal føles fokuseret, men kontrolleret.", "Du må ikke drive ind i threshold eller race effort."],
            longRunContribution: 0,
        };
    }
    if (blueprint.structureType === "tempo_block") {
        return {
            segments: [{ kind: "main", label: "Tempoblok", durationMin: Math.max(14, roundHalf(continuousMin * 0.55)) }],
            purposeText: "Udvikle tærskel og rytmekontrol i en sammenhængende blok.",
            cues: ["Kontrolleret hårdt, ikke maks.", "Hold rytmen jævn fra start til slut."],
            longRunContribution: 0,
        };
    }
    if (blueprint.structureType === "tempo_intervals") {
        const work = Math.max(8, roundHalf(continuousMin * 0.28));
        const repeats = work >= 10 ? 2 : 3;
        return {
            segments: [{ kind: "main", label: "Tempointerval", durationMin: work, repeats, recoverMin: 2.5 }],
            purposeText: "Udvikle tempo/threshold på en mere kontrolleret måde end ét langt sammenhængende tempoløb.",
            cues: ["Hold hver blok stabil.", "Pauserne er korte og kontrollerede."],
            longRunContribution: 0,
        };
    }
    if (blueprint.structureType === "interval_repeats") {
        const work = Math.max(2, Math.min(5, roundHalf(continuousMin * 0.12)));
        const repeats = blueprint.family === "fartlek" ? Math.max(5, Math.round(continuousMin / 6)) : Math.max(5, Math.round(continuousMin / 8));
        return {
            segments: [{ kind: "main", label: blueprint.family === "fartlek" ? "Fartskift" : "Interval", durationMin: work, repeats, recoverMin: 2 }],
            purposeText: blueprint.family === "fartlek" ? "Udvikle fartkontrol i et mere flydende kvalitetspas." : "Udvikle fart og iltoptagelse med tydelig repeat-logik.",
            cues: ["Kvalitet vigtigere end rå fart.", "Lad pauserne gøre gode gentagelser mulige."],
            longRunContribution: 0,
        };
    }
    if (blueprint.structureType === "progression_blocks") {
        const first = Math.max(10, roundHalf(continuousMin * (phase === "taper" ? 0.36 : 0.42)));
        const second = Math.max(8, roundHalf(continuousMin * (phase === "taper" ? 0.2 : 0.28)));
        return {
            segments: [
                { kind: "main", label: "Rolig åbningsblok", durationMin: first },
                { kind: "main", label: "Fremadbyggende afslutning", durationMin: second },
            ],
            purposeText: "Lære kroppen at åbne under kontrol og afslutte stærkere uden at miste rytme.",
            cues: ["Første del skal føles tilbageholdt.", "Sidste del må være fokuseret, men stadig ren i formen."],
            longRunContribution: 0,
        };
    }
    if (blueprint.structureType === "long_run_continuous") {
        const longBlock = roundHalf(longRunMin * (phase === "taper" ? 0.82 : 1));
        return {
            segments: [{ kind: "main", label: "Lang rolig blok", durationMin: longBlock }],
            purposeText: "Bygge udholdenhed og gøre den samlede plan mere robust.",
            cues: ["Det skal føles bæredygtigt, ikke heroisk.", "Hold fokus på tid på benene."],
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
function buildSession(input, classification, planType, phase, curves, selection) {
    const weekIndex = selection.weekIndex;
    const continuousMin = curves.continuousCurve[weekIndex - 1] || input.currentContinuousRunMin;
    const longRunMin = curves.longRunCurve[weekIndex - 1] || input.longestRecentRunMin;
    const intensity = curves.intensityCurve[weekIndex - 1] || 0.2;
    const sessionBlueprint = blueprintForSelection(selection, phase, continuousMin, longRunMin, intensity, classification.traits.runnerLevel);
    const quality = selection.role === "quality";
    const main = buildMainSet(sessionBlueprint, selection, phase, continuousMin, longRunMin, classification.traits.runnerLevel);
    const structure = [...warmupSegments(sessionBlueprint.warmupType, quality), ...main.segments, ...cooldownSegments(sessionBlueprint.warmupType)];
    const weekMonday = (0, calendar_week_1.planStartWeekMonday)(input.startDate);
    const date = addDays(weekMonday, (weekIndex - 1) * 7 + dayOffset(selection.day));
    const durationMin = sumDuration(structure);
    const summary = sessionBlueprint.structureType === "run_walk_blocks" || sessionBlueprint.structureType === "long_run_run_walk"
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
        title: titleForFamily(selection.family),
        purpose: main.purposeText,
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
            ...main.cues,
            phase === "taper" ? "Kom ud med friske ben, ikke træthed." : "Lad passet passe til ugens rolle, ikke til dagsformen alene.",
        ],
    };
}
