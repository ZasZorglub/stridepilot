"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.interpretRunnerProfile = interpretRunnerProfile;
exports.interpretWorkoutFeedback = interpretWorkoutFeedback;
exports.generateCoachingExplanation = generateCoachingExplanation;
exports.summarizePlanRationale = summarizePlanRationale;
exports.summarizeAdaptationRationale = summarizeAdaptationRationale;
const openai_1 = __importDefault(require("openai"));
function extractJsonObject(text) {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
        throw new Error("Model response did not contain JSON");
    }
    return JSON.parse(text.slice(start, end + 1));
}
function clampSessionsPerWeek(distance, suggested) {
    const min = distance === "5K" ? 2 : 3;
    return Math.max(min, Math.min(5, Math.round(suggested)));
}
function fallbackRunnerProfileInsights(input) {
    const text = (input.onboardingText ?? "").toLowerCase();
    const injuryCaution = /(skade|smerte|ondt|knæ|akilles|hofte|ryg|genoptræning)/i.test(text);
    const confidence = input.currentAbility === "helt_ny"
        ? "low"
        : input.currentAbility === "mere_end_tredive_min"
            ? "high"
            : "medium";
    const motivationRisk = /(svært at holde fast|mister motivation|komme i gang igen|ustabil|travlt|stress)/i.test(text)
        ? "high"
        : /(nervøs|usikker|bekymret|tvivl)/i.test(text)
            ? "medium"
            : "low";
    const experience = input.currentAbility === "mere_end_tredive_min"
        ? "advanced"
        : input.currentAbility === "tyve_tredive_min" || input.currentAbility === "ti_femten_min"
            ? "intermediate"
            : "beginner";
    const conservativeSignals = injuryCaution || confidence === "low" || motivationRisk === "high" || input.activityLevel === "meget_lav";
    const aggressiveSignals = experience === "advanced" && confidence === "high" && !injuryCaution && input.activityLevel !== "meget_lav" && Boolean(input.goalTime);
    const style = conservativeSignals ? "conservative" : aggressiveSignals ? "aggressive" : "balanced";
    const targetSessionsPerWeek = input.goalDistance === "5K"
        ? experience === "beginner"
            ? 2
            : 3
        : input.goalDistance === "10K"
            ? experience === "advanced"
                ? 4
                : 3
            : experience === "advanced"
                ? 4
                : 3;
    return {
        runnerProfile: {
            experience,
            confidence,
            injuryCaution,
            motivationRisk,
        },
        progressionStrategy: {
            style,
            preferEarlyWins: experience === "beginner" || confidence === "low" || motivationRisk !== "low",
            avoidRapidLoadIncrease: style !== "aggressive" || injuryCaution,
        },
        trainingRecommendations: {
            targetSessionsPerWeek: clampSessionsPerWeek(input.goalDistance, targetSessionsPerWeek),
            preferShortIntervalsInitially: experience === "beginner" || input.currentAbility === "helt_ny" || input.currentAbility === "fem_min" || injuryCaution,
        },
        coachTone: {
            style: injuryCaution || motivationRisk === "high" ? "calm" : confidence === "low" ? "encouraging" : "analytical",
        },
    };
}
function fallbackWorkoutFeedbackInsights(input) {
    if (input.pain >= 6) {
        return {
            adjustment: "insert_recovery",
            severity: input.pain >= 8 ? "strong" : "moderate",
            progressionPauseWeeks: input.pain >= 8 ? 2 : 1,
            coachTone: "calm",
        };
    }
    if (input.completion < 70) {
        return {
            adjustment: "hold_progression",
            severity: input.completion < 50 ? "moderate" : "mild",
            progressionPauseWeeks: 1,
            coachTone: "supportive",
        };
    }
    if (input.RPE >= 9 || input.energy <= 2) {
        return {
            adjustment: "reduce_load",
            severity: input.RPE >= 9 && input.energy <= 2 ? "strong" : "moderate",
            progressionPauseWeeks: 1,
            coachTone: "calm",
        };
    }
    if (input.RPE <= 5 && input.energy >= 4 && input.completion >= 95 && input.pain <= 2) {
        return {
            adjustment: "increase_load",
            severity: "mild",
            progressionPauseWeeks: 0,
            coachTone: "motivating",
        };
    }
    return {
        adjustment: "hold_progression",
        severity: "mild",
        progressionPauseWeeks: 0,
        coachTone: "supportive",
    };
}
async function interpretWithModel(systemPrompt, payload, fallback) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey)
        return fallback;
    try {
        const client = new openai_1.default({ apiKey });
        const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
        const completion = await client.chat.completions.create({
            model,
            temperature: 0.2,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: JSON.stringify(payload) },
            ],
        });
        const content = completion.choices[0]?.message?.content;
        if (!content)
            return fallback;
        return extractJsonObject(content);
    }
    catch {
        return fallback;
    }
}
async function interpretRunnerProfile(input) {
    const fallback = fallbackRunnerProfileInsights(input);
    return interpretWithModel([
        "Du er StridePilots AI-fortolker for løbeprofiler.",
        "Du må ikke generere et træningsprogram.",
        "Du skal kun returnere strukturerede signaler, som træningsmotoren kan bruge.",
        "Vurder erfaring, selvtillid, skadeshensyn, motivationsrisiko, progressionstype, behov for tidlige succeser, sessions pr. uge, korte intervaller i starten og coach-tone.",
        "Returner kun gyldigt JSON med felterne runnerProfile, progressionStrategy, trainingRecommendations og coachTone.",
    ].join(" "), input, fallback);
}
async function interpretWorkoutFeedback(input) {
    const fallback = fallbackWorkoutFeedbackInsights(input);
    return interpretWithModel([
        "Du er StridePilots AI-fortolker for feedback efter løbepas.",
        "Du må ikke generere eller omskrive hele planen.",
        "Du skal kun vurdere hvordan træningsmotoren bør reagere med felterne adjustment, severity, progressionPauseWeeks og coachTone.",
        "Returner kun gyldigt JSON.",
    ].join(" "), input, fallback);
}
function generateCoachingExplanation(params) {
    const { adjustment, severity, userFeedback } = params;
    const intro = userFeedback.pain >= 6
        ? "Tak for din feedback. Jeg vurderer, at kroppen har brug for lidt mere ro."
        : userFeedback.RPE >= 8
            ? "Tak for din feedback. Passet virkede hårdere end planlagt."
            : userFeedback.completion < 70
                ? "Tak for din feedback. Passet blev ikke helt gennemført som planlagt."
                : "Tak for din feedback.";
    if (adjustment === "insert_recovery") {
        return `${intro} Derfor lægger jeg mere restitution ind, før progressionen fortsætter.`;
    }
    if (adjustment === "reduce_load") {
        return `${intro} Derfor gør jeg næste træning ${severity === "strong" ? "tydeligt" : "lidt"} kortere og roligere.`;
    }
    if (adjustment === "increase_load") {
        return `${intro} Det så bæredygtigt ud, så jeg skruer en anelse op i næste pas.`;
    }
    return `${intro} Derfor holder jeg progressionen stabil, så du kan bygge videre uden at forcere noget.`;
}
async function summarizePlanRationale(params) {
    const fallback = params.fallbackLines.slice(0, 4);
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || !params.rationale?.plan)
        return fallback;
    const prompt = {
        instruction: "Omskriv kun den givne rationale til 3-4 korte, coach-like forklaringslinjer på dansk. Bevar årsagerne, opfind ikke nye. Vær konkret, ærlig og kortfattet.",
        rationale: params.rationale,
    };
    try {
        const client = new openai_1.default({ apiKey });
        const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
        const completion = await client.chat.completions.create({
            model,
            temperature: 0.2,
            messages: [
                { role: "system", content: "Du omskriver kun struktureret løbe-rationale til korte forklaringslinjer. Du må ikke ændre træningsbeslutninger eller tilføje nye årsager." },
                { role: "user", content: JSON.stringify(prompt) },
            ],
        });
        const content = completion.choices[0]?.message?.content;
        if (!content)
            return fallback;
        const parsed = extractJsonObject(content);
        return Array.isArray(parsed.lines) && parsed.lines.length > 0 ? parsed.lines.slice(0, 4) : fallback;
    }
    catch {
        return fallback;
    }
}
async function summarizeAdaptationRationale(params) {
    const fallback = params.fallback;
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || !params.rationale)
        return fallback;
    const prompt = {
        instruction: "Omskriv kun denne adaptationsrationale til tre korte felter: interpretation, adjustmentExplanation og runnerFocus. Hold dig til de givne ændringer og årsager. Ingen ekstra coaching-fluff.",
        rationale: params.rationale,
    };
    try {
        const client = new openai_1.default({ apiKey });
        const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
        const completion = await client.chat.completions.create({
            model,
            temperature: 0.2,
            messages: [
                { role: "system", content: "Du omskriver kun struktureret adaptationsrationale til kort, tillidsvækkende dansk. Du må ikke opfinde nye ændringer eller årsager." },
                { role: "user", content: JSON.stringify(prompt) },
            ],
        });
        const content = completion.choices[0]?.message?.content;
        if (!content)
            return fallback;
        const parsed = extractJsonObject(content);
        return {
            interpretation: parsed.interpretation ?? fallback.interpretation,
            adjustmentExplanation: parsed.adjustmentExplanation ?? fallback.adjustmentExplanation,
            runnerFocus: parsed.runnerFocus ?? fallback.runnerFocus,
        };
    }
    catch {
        return fallback;
    }
}
