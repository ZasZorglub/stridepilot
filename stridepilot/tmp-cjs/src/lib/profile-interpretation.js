"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.interpretProfileSignals = interpretProfileSignals;
exports.recommendTrainingDays = recommendTrainingDays;
exports.buildProfileExplanationSummary = buildProfileExplanationSummary;
function hasKeyword(text, keywords) {
    return keywords.some((keyword) => text.includes(keyword));
}
function hasInjuryConcernText(text) {
    const normalized = text.trim().toLowerCase();
    if (!normalized)
        return false;
    const explicitNoInjuryPhrases = [
        "ingen skader",
        "ingen skade",
        "ingen sårbare områder",
        "ingen sårbarheder",
        "ingen problemer",
        "ingen smerter",
        "ikke skadet",
        "ikke nogen skader",
        "ingen udfordringer",
    ];
    if (explicitNoInjuryPhrases.some((phrase) => normalized.includes(phrase))) {
        return false;
    }
    return hasKeyword(normalized, ["skade", "ondt", "knæ", "achilles", "hofte", "læg", "fod", "skinneben", "sårbar", "smerte"]);
}
function clampDays(value) {
    if (value <= 2)
        return 2;
    if (value >= 4)
        return 4;
    return 3;
}
function formatPace(secPerKm) {
    if (!secPerKm || secPerKm <= 0)
        return null;
    const minutes = Math.floor(secPerKm / 60);
    const seconds = secPerKm % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")} min/km`;
}
function goalTypeLabel(goalType, targetPaceSecPerKm) {
    if (goalType === "run_without_walking")
        return "løbe sammenhængende uden gangpauser";
    if (goalType === "target_time" && targetPaceSecPerKm)
        return `ramme omkring ${formatPace(targetPaceSecPerKm)}`;
    if (goalType === "pr" && targetPaceSecPerKm)
        return `sætte PR omkring ${formatPace(targetPaceSecPerKm)}`;
    if (goalType === "pr")
        return "jagte en personlig rekord";
    if (goalType === "target_time")
        return "løbe mod et konkret tempo";
    return "gennemføre målet på en god måde";
}
function guidanceLabel(preference) {
    if (preference === "simple")
        return "Du har også bedt om en enkel og overskuelig plan.";
    if (preference === "flexible")
        return "Planen er lagt, så den er lettere at tilpasse rundt om hverdagen.";
    if (preference === "performance_oriented")
        return "Planen er lagt lidt mere målrettet, fordi du gerne vil have tydelig fremgang.";
    return null;
}
function interpretProfileSignals(runnerProfile, goal) {
    const combinedText = [
        runnerProfile.userTrainingContext,
        runnerProfile.injuryHistory,
        runnerProfile.weakPoints,
        runnerProfile.otherTraining,
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
    const currentRunsPerWeek = runnerProfile.currentRunsPerWeek ?? 0;
    const weeklyVolume = runnerProfile.currentWeeklyVolumeKm ?? 0;
    const longestRun = runnerProfile.longestCurrentRunMin ?? 0;
    const activityLevel = runnerProfile.activityLevel;
    const guidance = runnerProfile.preferredGuidance;
    const explicitBeginner = hasKeyword(combinedText, ["helt ny", "aldrig løbet", "never run", "har aldrig løbet", "start fra nul", "ingen løbeerfaring"]);
    const returning = hasKeyword(combinedText, ["tilbage", "igen", "comeback", "efter pause", "tidligere", "før løbet"]);
    const injuryConcern = hasInjuryConcernText(runnerProfile.injuryHistory ?? "") || hasInjuryConcernText(runnerProfile.weakPoints ?? "");
    const lowConfidence = hasKeyword(combinedText, ["usikker", "nervøs", "bange", "tør ikke", "bekymret", "rolig start"]);
    const highMotivation = hasKeyword(combinedText, ["ambitiøs", "meget motiveret", "vil gerne presse", "vil forbedre", "vil løbe hurtigt", "målrettet"]);
    const limitedTime = hasKeyword(combinedText, ["travl", "lidt tid", "tidsmangel", "små børn", "kort tid"]) ||
        (runnerProfile.typicalWorkoutMinutes ?? 45) <= 35 ||
        (goal.availableTrainingDays?.length ?? 3) <= 2;
    const dislikesIntervals = hasKeyword(combinedText, ["hader intervaller", "kan ikke lide intervaller", "ikke så mange intervaller", "vil helst undgå intervaller"]);
    const prefersSimple = guidance === "simple" || hasKeyword(combinedText, ["enkelt", "simpel", "overskuelig", "bare det vigtigste"]);
    const prefersPerformance = guidance === "performance_oriented" || goal.goalType === "pr" || goal.goalType === "target_time";
    let experienceBand = "developing";
    if (explicitBeginner ||
        runnerProfile.currentRunningAbility === "helt_ny" ||
        (runnerProfile.currentRunningAbility === "fem_min" && currentRunsPerWeek <= 1) ||
        hasKeyword(combinedText, ["helt ny", "aldrig løbet", "nybegynder", "start fra nul"])) {
        experienceBand = "true_beginner";
    }
    else if (returning) {
        experienceBand = "returning";
    }
    else if (runnerProfile.runningExperience === "ovet" ||
        currentRunsPerWeek >= 3 ||
        weeklyVolume >= 20 ||
        hasKeyword(combinedText, ["har løbet før", "erfaren", "halvmaraton", "maraton", "konkurrence"])) {
        experienceBand = "experienced";
    }
    const fitButRunSpecificLow = (activityLevel === "høj" || activityLevel === "meget_høj") &&
        weeklyVolume <= 15 &&
        currentRunsPerWeek <= 2 &&
        longestRun <= 30;
    const otherTrainingLoad = hasKeyword(combinedText, ["crossfit", "cykler meget", "styrketræning 4", "mange kampe", "meget anden træning"])
        ? "high"
        : hasKeyword(combinedText, ["styrketræning", "cykling", "fodbold", "padel", "anden træning"])
            ? "moderate"
            : "low";
    return {
        experienceBand,
        injuryConcern,
        lowConfidence,
        highMotivation,
        limitedTime,
        prefersSimple,
        prefersPerformance,
        dislikesIntervals,
        fitButRunSpecificLow,
        otherTrainingLoad,
    };
}
function recommendTrainingDays(runnerProfile, goal) {
    const signals = interpretProfileSignals(runnerProfile, goal);
    const availability = goal.availableTrainingDays?.length ?? 3;
    const currentRuns = runnerProfile.currentRunsPerWeek ?? 0;
    const weeklyVolume = runnerProfile.currentWeeklyVolumeKm ?? 0;
    let recommended = goal.distance === "5K" ? 3 : 3;
    if (goal.goalType === "pr" || goal.goalType === "target_time")
        recommended = 4;
    if (signals.experienceBand === "true_beginner" || signals.injuryConcern)
        recommended = 3;
    if (signals.limitedTime && availability <= 2)
        recommended = 2;
    if (signals.otherTrainingLoad === "high" && recommended > 3)
        recommended = 3;
    if (currentRuns >= 4 || weeklyVolume >= 28)
        recommended = Math.max(recommended, 4);
    if (availability <= 2)
        recommended = 2;
    if (signals.prefersSimple && recommended > 3 && availability <= 3)
        recommended = 3;
    const recommendedDays = clampDays(Math.min(recommended, Math.max(2, Math.min(4, availability))));
    let reason = `Jeg anbefaler ${recommendedDays} træningsdage, fordi du lige nu løber ${currentRuns || 0} gange om ugen og har valgt ${availability} faste dage at træne på.`;
    if (signals.injuryConcern) {
        reason = `Jeg anbefaler ${recommendedDays} træningsdage, fordi du nævner skader eller sårbare områder, og planen derfor skal være lettere at holde stabil.`;
    }
    else if (signals.experienceBand === "true_beginner") {
        reason = `Jeg anbefaler ${recommendedDays} korte træningsdage, fordi du stadig bygger selve løbevanen op, og hyppighed er vigtigere end lange pas lige nu.`;
    }
    else if (goal.goalType === "pr" || goal.goalType === "target_time") {
        reason = `Jeg anbefaler ${recommendedDays} træningsdage, fordi du går efter et mere konkret præstationsmål og allerede har noget at bygge videre på.`;
    }
    else if (signals.limitedTime) {
        reason = `Jeg anbefaler ${recommendedDays} træningsdage, fordi planen også skal passe ind i en travl hverdag og stadig være realistisk at følge.`;
    }
    else if (weeklyVolume >= 20 || currentRuns >= 3) {
        reason = `Jeg anbefaler ${recommendedDays} træningsdage, fordi du allerede har en vis kontinuitet og derfor kan bære lidt mere rytme i ugen.`;
    }
    let caution;
    if ((goal.availableTrainingDays?.length ?? 0) < recommendedDays) {
        caution = "Du har valgt færre dage end den anbefalede rytme, så planen skal enten være roligere eller have lidt længere tid til målet.";
    }
    else if (signals.otherTrainingLoad === "high") {
        caution = "Jeg holder også øje med din øvrige træning, så løbeplanen ikke vælter den samlede belastning.";
    }
    return { recommendedDays, reason, caution };
}
function buildProfileExplanationSummary(runnerProfile, goal) {
    const signals = interpretProfileSignals(runnerProfile, goal);
    const recommendation = recommendTrainingDays(runnerProfile, goal);
    const paceLabel = formatPace(goal.targetPaceSecPerKm);
    const goalLabel = goal.goalType
        ? goalTypeLabel(goal.goalType, goal.targetPaceSecPerKm)
        : paceLabel
            ? `løbe ${goal.distance} omkring ${paceLabel}`
            : `nå ${goal.distance}`;
    const currentRuns = runnerProfile.currentRunsPerWeek ?? 0;
    const weeklyVolume = runnerProfile.currentWeeklyVolumeKm ?? 0;
    const longestRun = runnerProfile.longestCurrentRunMin ?? 0;
    let startPoint = `Du står et sted, hvor ${currentRuns > 0 ? `du allerede løber ${currentRuns} gange om ugen` : "løb stadig er nyt for dig"}, og målet er at ${goalLabel}.`;
    if (signals.experienceBand === "true_beginner") {
        startPoint = "Du starter roligt, fordi kroppen først skal vænne sig til selve løbebelastningen.";
    }
    else if (signals.experienceBand === "returning") {
        startPoint = "Du starter kontrolleret, fordi du har løbet før, men skal finde stabiliteten igen efter en pause.";
    }
    else if (signals.injuryConcern) {
        startPoint = "Planen er holdt mere forsigtig i starten, fordi du nævner skader eller sårbare områder.";
    }
    else if (signals.fitButRunSpecificLow) {
        startPoint = "Du har sandsynligvis god generel kapacitet, men planen starter stadig kontrolleret for at bygge løbespecifik tolerance.";
    }
    else if (signals.experienceBand === "experienced" && currentRuns <= 2) {
        startPoint = "Du starter kontrolleret, fordi du har erfaring, men mangler stabil kontinuitet lige nu.";
    }
    const frequencyLine = recommendation.reason;
    let openingPhase = "Planen starter bevidst lidt konservativt, så jeg først kan lære dig og din respons på træningen at kende. Hvis det går godt, kan vi altid skrue op undervejs.";
    if (signals.dislikesIntervals) {
        openingPhase = "Åbningen er lagt uden for meget fartarbejde, fordi du tydeligt signalerer, at planen skal være mere enkel og rolig at gå til.";
    }
    else if (signals.lowConfidence) {
        openingPhase = "Åbningen er holdt enkel, så du kan få gode, trygge pas tidligt og bygge selvtillid op undervejs.";
    }
    else if (signals.prefersPerformance && !signals.injuryConcern && signals.experienceBand !== "true_beginner") {
        openingPhase = "Planen starter stadig kontrolleret, så jeg kan se hvordan du responderer, men hvis kroppen følger fint med, kan vi hurtigt skrue progressionen op.";
    }
    else if (longestRun >= 40 || weeklyVolume >= 25) {
        openingPhase = "Planen starter kontrolleret, men ikke forsigtigt for forsigtighedens skyld, fordi du allerede har noget udholdenhed at bygge videre på. Hvis det går godt, kan vi øge intensiteten undervejs.";
    }
    const guidanceLine = guidanceLabel(runnerProfile.preferredGuidance);
    return guidanceLine ? [startPoint, frequencyLine, openingPhase, guidanceLine] : [startPoint, frequencyLine, openingPhase];
}
