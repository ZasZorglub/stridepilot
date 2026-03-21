"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWorkoutPurpose = getWorkoutPurpose;
const PURPOSE_VARIANTS = {
    easy: [
        "Det her pas hjælper dig med at bygge en stabil base uden at presse kroppen for meget.",
        "Formålet er at holde kroppen i gang og opbygge rolig udholdenhed.",
        "Her bygger du stille og roligt videre på formen uden at gøre passet tungt.",
        "Det her pas giver dig rolig træning, så du kan holde en god rytme uge efter uge.",
    ],
    long: [
        "Det her pas gør dig mere robust, så du kan holde længere tid i bevægelse med ro i kroppen.",
        "Formålet er at udvide din udholdenhed i et tempo, der stadig føles kontrolleret.",
        "Her bygger du den længere base, som gør resten af planen lettere at bære.",
        "Det her pas hjælper dig med at stå stærkere, når den samlede tid på benene vokser.",
    ],
    interval: [
        "Her træner du din evne til at arbejde lidt hårdere i korte blokke.",
        "Det her pas skubber din kapacitet lidt opad uden at gøre hele træningen tung.",
        "Formålet er at vænne kroppen til lidt mere fart i overskuelige bidder.",
        "Her bygger du styrke og rytme ved at arbejde i korte, kontrollerede intervaller.",
    ],
    tempo: [
        "Det her pas hjælper dig med at finde et jævnt, stærkt tempo over lidt længere tid.",
        "Formålet er at gøre dig mere tryg ved at holde en stabil indsats.",
        "Her træner du evnen til at arbejde sammenhængende i et lidt mere udfordrende tempo.",
        "Det her pas bygger din farttolerance på en rolig og kontrolleret måde.",
    ],
    recovery: [
        "Det her pas er her for at holde dig i gang uden at samle unødig belastning.",
        "Formålet er at skabe bevægelse og overskud, så kroppen kan absorbere træningen.",
        "Her holder vi det let, så du kan komme frisk videre til de næste pas.",
        "Det her pas giver kroppen plads til at hente sig ind, mens du stadig holder rytmen.",
    ],
};
function classifySession(session) {
    const text = `${session.title} ${session.notes ?? ""}`.toLowerCase();
    if (/interval|fartlek|bakke|hill/.test(text))
        return "interval";
    if (/tempo|steady|progression|10 km-specifikt|race-specific/.test(text))
        return "tempo";
    if (/recovery|restitution|hvile|roligt/.test(text))
        return "recovery";
    if (/udholdenhed|lang|long/.test(text))
        return "long";
    return "easy";
}
function hashSeed(session, kind) {
    const seed = `${session.id}|${session.week}|${kind}|${session.title}`;
    return Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0);
}
function getWorkoutPurpose(session) {
    const kind = classifySession(session);
    const variants = PURPOSE_VARIANTS[kind];
    return variants[hashSeed(session, kind) % variants.length];
}
