"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WORKOUT_LIBRARY = void 0;
exports.estimateSessionLoad = estimateSessionLoad;
exports.sumDuration = sumDuration;
exports.buildRunWalkWorkout = buildRunWalkWorkout;
exports.buildEasyWorkout = buildEasyWorkout;
exports.buildLongWorkout = buildLongWorkout;
exports.buildIntervalWorkout = buildIntervalWorkout;
exports.buildTempoWorkout = buildTempoWorkout;
exports.buildStridesWorkout = buildStridesWorkout;
exports.buildSteadyWorkout = buildSteadyWorkout;
exports.buildFartlekWorkout = buildFartlekWorkout;
exports.buildHillWorkout = buildHillWorkout;
exports.buildProgressionWorkout = buildProgressionWorkout;
exports.buildRaceSpecificWorkout = buildRaceSpecificWorkout;
exports.buildRecoveryWorkout = buildRecoveryWorkout;
exports.buildBenchmarkWorkout = buildBenchmarkWorkout;
exports.WORKOUT_LIBRARY = {
    "run-walk": {
        type: "run-walk",
        purpose: "Bygger løbetolerance og tryghed uden at overbelaste kroppen for tidligt.",
        progressionNotes: ["Længere løbeblokke", "Kortere gangpauser", "Flere samlede løbeminutter"],
    },
    easy: {
        type: "easy",
        purpose: "Skaber kontinuitet og rolig aerob opbygning.",
        progressionNotes: ["Lidt længere varighed", "Mere sammenhængende løb", "Stabil intensitet"],
    },
    long: {
        type: "long",
        purpose: "Udvider den rolige kapacitet og gør 5K mere overkommeligt.",
        progressionNotes: ["Lidt længere samlet tid", "Stabilt roligt tempo", "Kontrolleret belastning"],
    },
    interval: {
        type: "interval",
        purpose: "Gør det lettere at arbejde med fart i små doser.",
        progressionNotes: ["Længere intervaller", "Færre pauser", "Lidt mere samlet kvalitetsarbejde"],
    },
    tempo: {
        type: "tempo",
        purpose: "Træner rytme og jævn belastning omkring 5K-indsats.",
        progressionNotes: ["Længere tempoblokke", "Mindre pause mellem blokke", "Mere stabil indsats"],
    },
    strides: {
        type: "strides",
        purpose: "Skærper teknik og let fart uden at gøre passet tungt.",
        progressionNotes: ["Flere gentagelser", "Lidt længere strides", "Samme rolige ramme"],
    },
    recovery: {
        type: "recovery",
        purpose: "Holder kroppen i gang på en meget let dag.",
        progressionNotes: ["Små justeringer i tid", "Samme rolige intensitet", "Plads til restitution"],
    },
    steady: {
        type: "steady",
        purpose: "Bygger robust aerob rytme i et jævnt, kontrolleret tempo.",
        progressionNotes: ["Længere steady-blok", "Mere sammenhængende arbejde", "Bedre rytmekontrol"],
    },
    fartlek: {
        type: "fartlek",
        purpose: "Giver mere fri kvalitetsvariation uden et tungt intervalpræg.",
        progressionNotes: ["Flere fartskift", "Lidt længere arbejdsblokke", "Samme kontrollerede ramme"],
    },
    "hill-reps": {
        type: "hill-reps",
        purpose: "Bygger styrke og løbeøkonomi via korte kontrollerede bakkeindsatser.",
        progressionNotes: ["Flere bakkeindsatser", "Lidt længere bakker", "Samme kontrollerede teknik"],
    },
    progression: {
        type: "progression",
        purpose: "Træner evnen til at afslutte stærkere uden at åbne for hårdt.",
        progressionNotes: ["Længere progression", "Mere tydelig afslutning", "Bedre tempokontrol"],
    },
    "race-specific": {
        type: "race-specific",
        purpose: "Lægger blokke ind, som ligner kravene i måldistancen mere direkte.",
        progressionNotes: ["Mere målspecifik blok", "Mindre pause", "Større rytmetryghed"],
    },
    benchmark: {
        type: "benchmark",
        purpose: "Giver en rolig status på udviklingen uden at overdramatisere passet.",
        progressionNotes: ["Mere sammenhængende løb", "Tydeligere 5K-følelse", "Bruges sparsomt"],
    },
};
function runnerCategory(profile) {
    return profile.runnerCategory ?? "recreational";
}
function easyJogMinutes(profile, fallback = 6) {
    if (profile.typicalWorkoutMinutes >= 60 || profile.currentWeeklyVolumeKm >= 35)
        return Math.max(7, fallback);
    if (profile.currentWeeklyVolumeKm >= 18 || profile.longestRunMinutes >= 35)
        return Math.max(6, fallback);
    return fallback;
}
function warmupSegments(context, quality = false) {
    const category = runnerCategory(context.profile);
    if (category === "true_beginner" || category === "run_walk_beginner") {
        return [{ type: "walk", label: "Rask gang opvarmning", durationMin: quality ? 6 : 5 }];
    }
    if (category === "continuous_beginner") {
        return [
            { type: "walk", label: "Rolig gang", durationMin: 3 },
            { type: "recovery", label: "Let jog", durationMin: quality ? 4 : 3 },
        ];
    }
    return [{ type: "recovery", label: "Let jog opvarmning", durationMin: easyJogMinutes(context.profile, quality ? 7 : 6) }];
}
function cooldownSegments(context) {
    const category = runnerCategory(context.profile);
    if (category === "true_beginner" || category === "run_walk_beginner") {
        return [{ type: "walk", label: "Rolig gang ned", durationMin: 5 }];
    }
    if (category === "continuous_beginner") {
        return [
            { type: "recovery", label: "Let jog", durationMin: 2 },
            { type: "walk", label: "Gang ned", durationMin: 3 },
        ];
    }
    return [
        { type: "recovery", label: "Let jog ned", durationMin: 3 },
        { type: "walk", label: "Rolig afslutning", durationMin: 2 },
    ];
}
function distanceLabel(goal) {
    return goal.goalDistance === "5K" ? "5K" : goal.goalDistance === "10K" ? "10 km" : goal.goalDistance === "Halvmaraton" ? "halvmaraton" : "maraton";
}
function readinessBand(profile) {
    if (profile.currentWeeklyVolumeKm >= 35 || (profile.currentRunsPerWeek >= 4 && profile.longestRunMinutes >= 60))
        return "high";
    if (profile.currentWeeklyVolumeKm >= 18 || (profile.currentRunsPerWeek >= 3 && profile.longestRunMinutes >= 35))
        return "moderate";
    return "low";
}
function intervalRunCap(context) {
    const readiness = readinessBand(context.profile);
    if (context.goal.goalDistance === "5K")
        return readiness === "high" ? 32 : readiness === "moderate" ? 26 : 20;
    if (context.goal.goalDistance === "10K")
        return readiness === "high" ? 36 : readiness === "moderate" ? 30 : 22;
    if (context.goal.goalDistance === "Halvmaraton")
        return readiness === "high" ? 38 : readiness === "moderate" ? 30 : 20;
    return readiness === "high" ? 34 : readiness === "moderate" ? 28 : 18;
}
function tempoRunCap(context) {
    const readiness = readinessBand(context.profile);
    if (context.goal.goalDistance === "5K")
        return readiness === "high" ? 30 : readiness === "moderate" ? 24 : 18;
    if (context.goal.goalDistance === "10K")
        return readiness === "high" ? 38 : readiness === "moderate" ? 30 : 22;
    if (context.goal.goalDistance === "Halvmaraton")
        return readiness === "high" ? 44 : readiness === "moderate" ? 34 : 24;
    return readiness === "high" ? 48 : readiness === "moderate" ? 36 : 24;
}
function benchmarkRunCap(context) {
    if (context.goal.goalDistance === "5K")
        return 24;
    if (context.goal.goalDistance === "10K")
        return 35;
    if (context.goal.goalDistance === "Halvmaraton")
        return 45;
    return 60;
}
function roundToHalf(value) {
    return Math.round(value * 2) / 2;
}
function estimateSessionLoad(durationMin, type, profile) {
    const intensity = type === "recovery"
        ? 0.65
        : type === "easy" || type === "run-walk"
            ? 0.8
            : type === "long"
                ? 0.95
                : type === "strides"
                    ? 0.9
                    : type === "interval"
                        ? 1.15
                        : type === "tempo" || type === "benchmark"
                            ? 1.08
                            : 1;
    const sensitivityModifier = profile.injurySensitivity >= 4 ? 0.96 : 1;
    return roundToHalf(durationMin * intensity * sensitivityModifier);
}
function sumDuration(structure) {
    return structure.reduce((sum, segment) => {
        const repeats = segment.repeats ?? 1;
        const recover = segment.recoverMin ?? 0;
        return sum + segment.durationMin * repeats + recover * Math.max(repeats - 1, 0);
    }, 0);
}
function baseSession(context, type, title, description, intent, effortGuidance, structure) {
    const durationMin = roundToHalf(sumDuration(structure));
    return {
        id: `${context.weekNumber}-${context.dayOfWeek}-${type}`,
        week: context.weekNumber,
        dayOfWeek: context.dayOfWeek,
        date: context.date,
        type,
        title,
        description,
        durationMin,
        structure,
        intent,
        effortGuidance,
        estimatedLoad: estimateSessionLoad(durationMin, type, context.profile),
    };
}
function buildRunWalkWorkout(context) {
    const structure = [
        ...warmupSegments(context),
        {
            type: "run",
            label: "Løb/gang blok",
            durationMin: context.intervalRunMin,
            repeats: context.repeats,
            recoverMin: context.walkBreakMin,
        },
        ...cooldownSegments(context),
    ];
    return baseSession(context, "run-walk", "Run-walk", "Et roligt pas hvor løb og gang skiftes, så du bygger tolerance uden at forcere.", "Skabe tryg rytme og løbetolerance.", "Løb roligt. Du skal hele tiden kunne falde til ro i pauserne.", structure);
}
function buildEasyWorkout(context) {
    const structure = [
        ...warmupSegments(context),
        { type: "steady", label: "Roligt løb", durationMin: context.continuousRunMin },
        ...cooldownSegments(context),
    ];
    return baseSession(context, "easy", "Roligt løb", "Et jævnt pas hvor du finder rytme og bygger rolig kapacitet.", "Skabe kontinuitet og overskud.", "Hold et tempo hvor du stadig kan føre en kort samtale.", structure);
}
function buildLongWorkout(context) {
    const structure = [
        ...warmupSegments(context),
        { type: "steady", label: "Lang rolig blok", durationMin: context.longRunMin },
        ...cooldownSegments(context),
    ];
    return baseSession(context, "long", "Langt roligt pas", "Den længste rolige træning i ugen, hvor du samler tid på benene uden jagt på fart.", `Udvide den rolige kapacitet frem mod ${distanceLabel(context.goal)}.`, "Hold det bevidst roligt. Du skal gerne slutte med lidt overskud.", structure);
}
function buildIntervalWorkout(context) {
    const totalRunCap = intervalRunCap(context);
    const repeats = Math.max(3, Math.min(context.repeats, Math.floor(totalRunCap / Math.max(1, context.intervalRunMin))));
    const intervalDuration = roundToHalf(Math.min(context.intervalRunMin, totalRunCap / repeats));
    const structure = [
        ...warmupSegments(context, true),
        {
            type: "run",
            label: "Interval",
            durationMin: intervalDuration,
            repeats,
            recoverMin: Math.max(1, context.walkBreakMin - 0.5),
        },
        ...cooldownSegments(context),
    ];
    return baseSession(context, "interval", "Intervalpas", "Et kontrolleret kvalitetspas med tydelige pauser mellem blokkene.", "Arbejde med fart i små doser.", "Løb kontrolleret og rytmisk. Du skal ikke sprinte dig gennem blokkene.", structure);
}
function buildTempoWorkout(context) {
    const blockDuration = roundToHalf(Math.min(Math.max(6, context.continuousRunMin * 0.6), tempoRunCap(context) / 2));
    const structure = [
        ...warmupSegments(context, true),
        { type: "tempo", label: "Tempoblok", durationMin: blockDuration, repeats: 2, recoverMin: 2 },
        ...cooldownSegments(context),
    ];
    return baseSession(context, "tempo", "Tempopas", `Et jævnt pas tættere på den rytme du skal kunne holde mod ${distanceLabel(context.goal)}, men stadig under kontrol.`, "Bygge stabil fartkontrol og arbejde omkring tærskel.", "Løb fast og fokuseret, men undgå at gå i rødt.", structure);
}
function buildStridesWorkout(context) {
    const structure = [
        ...warmupSegments(context),
        { type: "steady", label: "Let løb", durationMin: Math.max(10, context.continuousRunMin * 0.7) },
        { type: "stride", label: "Strides", durationMin: 0.25, repeats: 6, recoverMin: 0.75 },
        ...cooldownSegments(context),
    ];
    return baseSession(context, "strides", "Roligt løb med strides", "Et let pas hvor du slutter med korte hurtige indslag for rytme og teknik.", "Skærpe rytme uden at gøre ugen tungere.", "Det meste skal føles let. Strides er korte og kontrollerede.", structure);
}
function buildSteadyWorkout(context) {
    const steadyMinutes = roundToHalf(Math.min(Math.max(16, context.continuousRunMin * 0.85), tempoRunCap(context)));
    const structure = [
        ...warmupSegments(context, true),
        { type: "steady", label: "Steady-blok", durationMin: steadyMinutes },
        ...cooldownSegments(context),
    ];
    return baseSession(context, "steady", "Steady-pas", "Et kontrolleret pas i jævn rytme, tydeligere end et roligt løb men uden at blive et hårdt tempopas.", `Bygge robust 10 km-rytme og aerob styrke frem mod ${distanceLabel(context.goal)}.`, "Løb fast og roligt kontrolleret. Du må gerne arbejde, men du skal ikke i rødt.", structure);
}
function buildFartlekWorkout(context) {
    const workMinutes = roundToHalf(Math.min(Math.max(3, context.intervalRunMin), 6));
    const repeats = Math.max(4, Math.min(context.repeats, 6));
    const structure = [
        ...warmupSegments(context, true),
        { type: "run", label: "Fartlek-blok", durationMin: workMinutes, repeats, recoverMin: Math.max(1.5, context.walkBreakMin) },
        ...cooldownSegments(context),
    ];
    return baseSession(context, "fartlek", "Fartlek", "Et mere legende kvalitetspas med kontrollerede fartskift, så du bygger styrke uden stiv intervalfølelse.", "Udvikle rytmeskift og aerob robusthed.", "Hold fartskiftene kontrollerede. De skal føles som arbejde, ikke sprint.", structure);
}
function buildHillWorkout(context) {
    const hillMinutes = roundToHalf(Math.min(Math.max(1, context.intervalRunMin * 0.5), 2.5));
    const repeats = Math.max(5, Math.min(context.repeats + 1, 8));
    const structure = [
        ...warmupSegments(context, true),
        { type: "run", label: "Bakkedrag", durationMin: hillMinutes, repeats, recoverMin: 1.5 },
        ...cooldownSegments(context),
    ];
    return baseSession(context, "hill-reps", "Bakkepas", "Korte bakkedrag med rolig pause imellem for at bygge styrke og teknik.", "Styrke, rytme og løbeøkonomi.", "Løb kontrolleret opad med god holdning. Hold igen nok til at alle drag bliver ens.", structure);
}
function buildProgressionWorkout(context) {
    const firstBlock = roundToHalf(Math.max(10, context.continuousRunMin * 0.45));
    const secondBlock = roundToHalf(Math.max(8, Math.min(context.continuousRunMin * 0.4, tempoRunCap(context) * 0.55)));
    const structure = [
        ...warmupSegments(context, true),
        { type: "steady", label: "Rolig åbningsblok", durationMin: firstBlock },
        { type: "tempo", label: "Fremadbyggende afslutning", durationMin: secondBlock },
        ...cooldownSegments(context),
    ];
    return baseSession(context, "progression", "Progressionspas", "Et pas der åbner roligt og slutter mere fokuseret, så du træner kontrol frem for bare fart.", "Bygge tempokontrol og stærkere afslutning.", "Start tydeligt roligt og arbejd dig gradvist frem. Afslut stærkt, men ikke presset.", structure);
}
function buildRaceSpecificWorkout(context) {
    const blockDuration = roundToHalf(Math.min(Math.max(8, context.intervalRunMin * 1.5), tempoRunCap(context) * 0.6));
    const structure = [
        ...warmupSegments(context, true),
        { type: "tempo", label: `${distanceLabel(context.goal)}-blok`, durationMin: blockDuration, repeats: 2, recoverMin: 2 },
        ...cooldownSegments(context),
    ];
    return baseSession(context, "race-specific", `${distanceLabel(context.goal)}-specifikt pas`, "Et pas med blokke tættere på selve måldistancens rytme og krav.", `Gøre dig mere tryg ved rytmen mod ${distanceLabel(context.goal)}.`, "Hold fokus på jævn rytme og kontrol. Du skal føle dig skarp, ikke færdig.", structure);
}
function buildRecoveryWorkout(context) {
    const structure = [
        ...warmupSegments(context),
        { type: "recovery", label: "Meget let bevægelse", durationMin: Math.max(12, context.continuousRunMin * 0.65) },
        ...cooldownSegments(context),
    ];
    return baseSession(context, "recovery", "Recovery-pas", "Et meget let pas som holder kroppen i gang uden at fylde meget i den samlede belastning.", "Give bevægelse uden at stjæle restitution.", "Hold det let fra start til slut.", structure);
}
function buildBenchmarkWorkout(context) {
    const benchmarkDuration = Math.min(Math.max(12, context.continuousRunMin), benchmarkRunCap(context));
    const structure = [
        ...warmupSegments(context, true),
        { type: "tempo", label: context.phase === "race_preparation" || context.phase === "taper" ? `${distanceLabel(context.goal)}-kontrolblok` : "Benchmark-blok", durationMin: benchmarkDuration },
        ...cooldownSegments(context),
    ];
    return baseSession(context, "benchmark", context.phase === "race_preparation" || context.phase === "taper" ? `${distanceLabel(context.goal)}-benchmark` : "Benchmark-pas", "Et kontrolleret statuspas, så du kan mærke din udvikling uden at det bliver et alt-eller-intet testløb.", "Måle udviklingen roligt og realistisk.", "Start kontrolleret og hold igen i første halvdel.", structure);
}
