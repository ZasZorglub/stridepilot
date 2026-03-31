"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCoachExplanation = generateCoachExplanation;
const DECISION_VARIANTS = {
    progress: [
        "Du virker stabil lige nu, så vi kan godt bygge en smule videre.",
        "Der er ro og rytme i træningen, så jeg lægger lidt mere på næste skridt.",
        "Du ser ud til at have fint overskud, så vi kan udvikle planen en anelse herfra.",
        "Det ser stabilt ud, så vi kan begynde at bygge lidt mere på.",
    ],
    reduce_load: [
        "Det ser ud som om kroppen lige har brug for lidt mere luft nu.",
        "Vi holder lige tempoet en smule nede, så du kan bygge videre uden at blive presset.",
        "Jeg skruer lidt ned næste gang, så du stadig har overskud.",
        "Jeg holder den næste del lidt mere rolig, så belastningen ikke samler sig for meget.",
    ],
    recovery_block: [
        "Kroppen ser ud til at have brug for en kort roligere periode nu.",
        "Jeg lægger en kort recovery-periode ind, så du kan samle overskud igen.",
        "Lige nu giver det mest mening at skabe lidt mere ro omkring træningen.",
        "Jeg holder en kort pause i progressionen, så kroppen kan følge ordentligt med.",
    ],
    confidence_build: [
        "Det vigtigste lige nu er at skabe ro, rytme og gode oplevelser i træningen.",
        "Jeg vil hellere bygge lidt mere tryghed op først, så du får overskud med videre.",
        "Vi holder det enkelt næste gang, så du kan finde rytmen igen.",
        "Lige nu handler det mest om at bygge ro og overskud op i træningen.",
    ],
    maintain: [
        "Planen ser balanceret ud lige nu, så vi fortsætter i samme rolige tempo.",
        "Det ser stabilt ud, så jeg holder kursen som den er.",
        "Der er fin balance i det lige nu, så vi fortsætter uden at forcere noget.",
        "Jeg lader planen køre videre i samme tempo, fordi den ser godt afstemt ud.",
    ],
};
function hashSeed(input) {
    const seed = [
        input.decision.type,
        input.trend?.fatigueTrend ?? "none",
        input.trend?.loadTrend ?? "none",
        input.trend?.painTrend ?? "none",
        input.block?.phase ?? "none",
        String(input.block?.weekIndex ?? 0),
    ].join("|");
    return Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0);
}
function pickVariant(input) {
    const variants = DECISION_VARIANTS[input.decision.type];
    return variants[hashSeed(input) % variants.length];
}
function trendHint(trend) {
    if (!trend)
        return null;
    if (trend.fatigueTrend === "rising" && trend.painTrend === "rising") {
        return "De sidste par pas har kostet lidt mere, så vi holder det roligere næste gang.";
    }
    if (trend.fatigueTrend === "rising" && trend.loadTrend === "rising") {
        return "De sidste par pas har bygget på, så jeg holder lidt igen næste gang.";
    }
    if (trend.fatigueTrend === "falling" && trend.loadTrend === "stable") {
        return "Det ser ud til at kroppen falder lidt mere til ro igen.";
    }
    return null;
}
function blockHint(block) {
    if (!block)
        return null;
    if (block.phase === "recover") {
        return "Fokus er at samle lidt mere overskud nu.";
    }
    if (block.phase === "stabilize") {
        return "Målet er at holde rytmen stabil lige nu.";
    }
    return null;
}
function generateCoachExplanation(input) {
    const base = pickVariant(input);
    const hint = trendHint(input.trend) ?? blockHint(input.block);
    return hint ? `${hint} ${base}` : base;
}
