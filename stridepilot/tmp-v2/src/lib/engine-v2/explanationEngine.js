"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.explainTrainingPlan = explainTrainingPlan;
exports.explainWeek = explainWeek;
exports.explainWorkout = explainWorkout;
exports.explainAdaptation = explainAdaptation;
exports.raceStrategy = raceStrategy;
exports.injuryPreventionAdvice = injuryPreventionAdvice;
exports.motivationMessage = motivationMessage;
exports.buildCoachExplanation = buildCoachExplanation;
function goalLabel(plan) {
    const distance = plan.input.raceDistance === "HalfMarathon" ? "halvmaraton" : plan.input.raceDistance === "Marathon" ? "maraton" : plan.input.raceDistance.toLowerCase();
    if (plan.input.goalType === "finish_without_walking")
        return `${distance} uden stop`;
    if (plan.input.goalType === "improve_time")
        return `${distance} med fokus på at forbedre tiden`;
    if (plan.input.goalType === "target_time")
        return `${distance} mod en bestemt måltid`;
    if (plan.input.goalType === "return_to_running")
        return `at komme godt tilbage til løb`;
    return `${distance} som gennemførselsmål`;
}
function phaseFocusLabel(phase) {
    if (phase === "base")
        return "bygge rytme og base";
    if (phase === "build")
        return "bygge volumen og robusthed";
    if (phase === "specific")
        return "gøre træningen mere målspecifik";
    if (phase === "peak")
        return "ramme de skarpeste træningsuger uden at tippe over";
    return "skabe friskhed og holde rytmen skarp";
}
function formatGoalTime(goalTime) {
    if (!goalTime)
        return undefined;
    return goalTime.includes(":") ? goalTime : `${goalTime}`;
}
function explainTrainingPlan(plan, runnerProfile = plan.classification) {
    const longRunStart = plan.curves.longRunCurve[0];
    const longRunPeak = Math.max(...plan.curves.longRunCurve);
    const sessionsStart = plan.curves.sessionsPerWeekCurve[0];
    const sessionsPeak = Math.max(...plan.curves.sessionsPerWeekCurve);
    const runnerLevel = runnerProfile.traits.runnerLevel;
    const profileText = runnerLevel === "true_beginner" || runnerLevel === "beginner_plus"
        ? "Planen holder bevidst starten enkel, så du kan bygge kontinuitet før intensitet."
        : plan.input.goalType === "improve_time" || plan.input.goalType === "target_time"
            ? "Planen lægger lidt mere vægt på specifikke kvalitetspas, men stadig med kontrolleret samlet belastning."
            : "Planen prioriterer stabil udvikling, så du kan bygge videre uden at presse mere end nødvendigt.";
    return `Planen er bygget til ${goalLabel(plan)} ud fra dit nuværende niveau. Vi starter med ${sessionsStart} pas om ugen og bygger op mod ${sessionsPeak}, mens langturen går fra cirka ${longRunStart} til ${longRunPeak} minutter. ${profileText} Strukturen er bevidst rolig i starten, får mere retning undervejs og slipper belastning igen før måldagen, så du kan udvikle dig uden at samle unødig træthed.`;
}
function explainWeek(week, phase = week.phase) {
    const qualityCount = week.sessions.filter((session) => session.role === "quality").length;
    const longRunText = week.longRunTargetMin > 0 ? `Langturen ligger omkring ${Math.round(week.longRunTargetMin)} minutter.` : "Denne uge handler ikke om en klassisk langtur.";
    const qualityText = qualityCount === 0
        ? "Ugen holder intensiteten nede, så du kan absorbere arbejdet."
        : qualityCount === 1
            ? "Der er ét mere fokuseret pas, men resten af ugen beskytter friskheden."
            : "Der er to mere fokuserede pas, så de rolige dage bliver ekstra vigtige.";
    return `Denne uge handler om at ${phaseFocusLabel(phase)}. ${longRunText} ${qualityText}`;
}
function explainWorkout(workout) {
    return `Det her pas er med for at ${workout.purpose.toLowerCase()}. Strukturen er valgt, så du får den rigtige træningseffekt uden at gøre passet hårdere end det behøver være.`;
}
function explainAdaptation(adaptationReason) {
    const reason = typeof adaptationReason === "string" ? adaptationReason : adaptationReason.reason;
    return `Planen er blevet justeret, fordi din seneste feedback peger på, at ${reason.charAt(0).toLowerCase()}${reason.slice(1)}`;
}
function raceStrategy(raceDistance, goalTime) {
    const distance = raceDistance === "HalfMarathon" ? "halvmaraton" : raceDistance === "Marathon" ? "maraton" : raceDistance;
    const timeText = formatGoalTime(goalTime);
    if (timeText) {
        return `Til ${distance} med mål om ${timeText} skal du åbne kontrolleret, finde rytmen tidligt og først bygge tryk på, når du er sikker på, at du kan holde det hele vejen ind. Den første del af løbet skal føles disciplineret, ikke heroisk.`;
    }
    return `Til ${distance} er strategien at starte roligt, løbe med kontrol gennem midterdelen og gemme beslutningen om at presse til den sidste del af løbet. Et roligt første afsnit giver dig et stærkere løb samlet set.`;
}
function injuryPreventionAdvice() {
    return "Hold de rolige dage rolige, tag små signaler fra kroppen alvorligt, og justér tidligt hvis smerte begynder at ændre dit løb. Den bedste måde at beskytte fremgang på er at dæmpe belastningen, før irritation bliver til skade.";
}
function motivationMessage(runnerProfile, progress) {
    if ((progress.completionRate ?? 0) >= 0.9) {
        return "Du bygger noget stabilt lige nu. Det vigtigste er ikke at jage mere end nødvendigt, men at fortsætte den gode rytme uge efter uge.";
    }
    if (progress.moodTrend === "wobbly" || (progress.consistency ?? 1) < 0.6) {
        return "Det er helt normalt, at træningen svinger lidt. Fokus lige nu er ikke perfektion, men at finde tilbage til en rytme, der føles overkommelig og stabil.";
    }
    if ((progress.longRunProgressMin ?? 0) > 0 || (progress.continuousProgressMin ?? 0) > 0) {
        return "Der er tydelig fremgang i det arbejde, du allerede lægger. Hold fast i tålmodigheden, for den slags udvikling bliver stærk, når den får lov at bygge roligt videre.";
    }
    return runnerProfile.traits.runnerLevel === "true_beginner" || runnerProfile.traits.runnerLevel === "beginner_plus"
        ? "Du behøver ikke bevise noget i hvert pas. Det vigtigste lige nu er at gøre løb til noget, kroppen kan vende tilbage til med ro og tillid."
        : "Planen virker bedst, når du holder rytmen og lader de enkelte uger bygge på hinanden. Den stille kontinuitet er ofte det, der giver de største løft.";
}
function buildCoachExplanation(plan) {
    const week1 = plan.weeks[0];
    const lastWeek = plan.weeks.at(-1);
    return {
        planWhy: [
            explainTrainingPlan(plan, plan.classification),
            ...plan.classification.reasons.slice(0, 1),
        ],
        weekWhy: [
            explainWeek(week1, week1.phase),
            lastWeek ? explainWeek(lastWeek, lastWeek.phase) : "Den sidste uge holder belastningen nede, så du kan stå frisk på måldagen.",
        ],
    };
}
