import OpenAI from "openai";
import { ActivityLevel, CurrentRunningAbility, FeedbackInsights, GoalDistance, RunnerProfileInsights } from "@/lib/types";

interface InterpretRunnerProfileInput {
  onboardingText?: string;
  currentAbility: CurrentRunningAbility;
  goalDistance: GoalDistance;
  goalTime?: string;
  activityLevel: ActivityLevel;
}

interface InterpretWorkoutFeedbackInput {
  RPE: number;
  energy: number;
  pain: number;
  completion: number;
  notes?: string | null;
}

function extractJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model response did not contain JSON");
  }
  return JSON.parse(text.slice(start, end + 1));
}

function clampSessionsPerWeek(distance: GoalDistance, suggested: number): number {
  const min = distance === "5K" ? 2 : 3;
  return Math.max(min, Math.min(5, Math.round(suggested)));
}

function fallbackRunnerProfileInsights(input: InterpretRunnerProfileInput): RunnerProfileInsights {
  const text = (input.onboardingText ?? "").toLowerCase();
  const injuryCaution = /(skade|smerte|ondt|knæ|akilles|hofte|ryg|genoptræning)/i.test(text);
  const confidence =
    input.currentAbility === "helt_ny"
      ? "low"
      : input.currentAbility === "mere_end_tredive_min"
        ? "high"
        : "medium";
  const motivationRisk = /(svært at holde fast|mister motivation|komme i gang igen|ustabil|travlt|stress)/i.test(text)
    ? "high"
    : /(nervøs|usikker|bekymret|tvivl)/i.test(text)
      ? "medium"
      : "low";
  const experience =
    input.currentAbility === "mere_end_tredive_min"
      ? "advanced"
      : input.currentAbility === "tyve_tredive_min" || input.currentAbility === "ti_femten_min"
        ? "intermediate"
        : "beginner";

  const conservativeSignals =
    injuryCaution || confidence === "low" || motivationRisk === "high" || input.activityLevel === "meget_lav";
  const aggressiveSignals =
    experience === "advanced" && confidence === "high" && !injuryCaution && input.activityLevel !== "meget_lav" && Boolean(input.goalTime);

  const style = conservativeSignals ? "conservative" : aggressiveSignals ? "aggressive" : "balanced";
  const targetSessionsPerWeek =
    input.goalDistance === "5K"
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

function fallbackWorkoutFeedbackInsights(input: InterpretWorkoutFeedbackInput): FeedbackInsights {
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

async function interpretWithModel<T>(systemPrompt: string, payload: object, fallback: T): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallback;

  try {
    const client = new OpenAI({ apiKey });
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
    if (!content) return fallback;
    return extractJsonObject(content) as T;
  } catch {
    return fallback;
  }
}

export async function interpretRunnerProfile(input: InterpretRunnerProfileInput): Promise<RunnerProfileInsights> {
  const fallback = fallbackRunnerProfileInsights(input);

  return interpretWithModel<RunnerProfileInsights>(
    [
      "Du er StridePilots AI-fortolker for løbeprofiler.",
      "Du må ikke generere et træningsprogram.",
      "Du skal kun returnere strukturerede signaler, som træningsmotoren kan bruge.",
      "Vurder erfaring, selvtillid, skadeshensyn, motivationsrisiko, progressionstype, behov for tidlige succeser, sessions pr. uge, korte intervaller i starten og coach-tone.",
      "Returner kun gyldigt JSON med felterne runnerProfile, progressionStrategy, trainingRecommendations og coachTone.",
    ].join(" "),
    input,
    fallback,
  );
}

export async function interpretWorkoutFeedback(input: InterpretWorkoutFeedbackInput): Promise<FeedbackInsights> {
  const fallback = fallbackWorkoutFeedbackInsights(input);

  return interpretWithModel<FeedbackInsights>(
    [
      "Du er StridePilots AI-fortolker for feedback efter løbepas.",
      "Du må ikke generere eller omskrive hele planen.",
      "Du skal kun vurdere hvordan træningsmotoren bør reagere med felterne adjustment, severity, progressionPauseWeeks og coachTone.",
      "Returner kun gyldigt JSON.",
    ].join(" "),
    input,
    fallback,
  );
}

export function generateCoachingExplanation(params: {
  adjustment: FeedbackInsights["adjustment"];
  severity: FeedbackInsights["severity"];
  userFeedback: {
    RPE: number;
    energy: number;
    pain: number;
    completion: number;
    notes?: string | null;
  };
}): string {
  const { adjustment, severity, userFeedback } = params;
  const intro =
    userFeedback.pain >= 6
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
