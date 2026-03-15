"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";
import { CurrentRunningAbility, FeedbackInsights, Goal, RunnerProfile, RunnerProfileInsights, TrainingPlan, WorkoutFeedbackInput, WorkoutSession, WorkoutStep } from "@/lib/types";
import { APP_NAME } from "@/lib/app-config";
import { cancelCue, initSpeech, isSpeechSupported, speakCue } from "@/lib/speech-coach";
import { EMPTY_INSIGHTS } from "@/lib/insights";
import { normalizeStepDuration } from "@/lib/duration";
import { buildWeeklyLoad } from "@/lib/plan";

type Stage = "welcome" | "auth" | "intro" | "profile" | "intermezzo" | "program" | "workout";
type AuthMode = "signup" | "login";
type AudioMode = "off" | "short" | "coach";
type ThemePref = "system" | "dark" | "light";
type InfoField = "targetTime" | "runningExperience" | "activityLevel" | "availableTrainingDays" | "weeks" | "currentRunningAbility" | "graph" | null;
type OnboardingSelectionState = {
  runningAbility: boolean;
  goalDistance: boolean;
  activityLevel: boolean;
};

type QuickFeedbackOption = NonNullable<WorkoutFeedbackInput["quickFeedback"]>;

interface AuthUser {
  id: string;
  email: string;
  isDemo?: boolean;
}

const WEEK_DAY_NAMES: WorkoutSession["dayOfWeek"][] = [
  "Mandag",
  "Tirsdag",
  "Onsdag",
  "Torsdag",
  "Fredag",
  "Lordag",
  "Sondag",
];

const DAY_INDEX: Record<WorkoutSession["dayOfWeek"], number> = {
  Mandag: 1,
  Tirsdag: 2,
  Onsdag: 3,
  Torsdag: 4,
  Fredag: 5,
  Lordag: 6,
  Sondag: 0,
};

const DAY_LABEL: Record<WorkoutSession["dayOfWeek"], string> = {
  Mandag: "Mandag",
  Tirsdag: "Tirsdag",
  Onsdag: "Onsdag",
  Torsdag: "Torsdag",
  Fredag: "Fredag",
  Lordag: "Lørdag",
  Sondag: "Søndag",
};

const ACTIVITY_LEVEL_INFO: Record<RunnerProfile["activityLevel"], string> = {
  meget_lav: "Meget lav: stillesiddende hverdag med næsten ingen træning.",
  lav: "Lav: let aktiv, fx 1-2 korte træninger om ugen.",
  moderat: "Moderat: stabil aktivitet, typisk 2-4 træninger om ugen.",
  høj: "Høj: du træner ofte og har god daglig bevægelse.",
  meget_høj: "Meget høj: meget aktiv hverdag med hyppig træning.",
};

const CURRENT_RUNNING_ABILITY_OPTIONS: Array<{ value: CurrentRunningAbility; label: string }> = [
  { value: "helt_ny", label: "Jeg er helt ny og kan ikke løbe sammenhængende endnu" },
  { value: "fem_min", label: "Jeg kan løbe 5 minutter" },
  { value: "ti_femten_min", label: "Jeg kan løbe 10–15 minutter" },
  { value: "tyve_tredive_min", label: "Jeg kan løbe 20–30 minutter" },
  { value: "mere_end_tredive_min", label: "Jeg kan løbe mere end 30 minutter" },
];

const GOAL_DISTANCE_OPTIONS: Array<{ value: Goal["distance"]; label: string }> = [
  { value: "5K", label: "5 km" },
  { value: "10K", label: "10 km" },
  { value: "Halvmaraton", label: "Halvmaraton" },
  { value: "Marathon", label: "Maraton" },
];

const ACTIVITY_LEVEL_OPTIONS: Array<{ value: RunnerProfile["activityLevel"]; label: string }> = [
  { value: "meget_lav", label: "Meget lav" },
  { value: "lav", label: "Lav" },
  { value: "moderat", label: "Moderat" },
  { value: "høj", label: "Høj" },
  { value: "meget_høj", label: "Meget høj" },
];

const GENDER_OPTIONS: Array<{ value: NonNullable<RunnerProfile["gender"]>; label: string }> = [
  { value: "kvinde", label: "Kvinde" },
  { value: "mand", label: "Mand" },
  { value: "andet", label: "Andet" },
  { value: "vil_ikke_oplyse", label: "Ønsker ikke at oplyse" },
];

const QUICK_FEEDBACK_OPTIONS: Array<{ value: QuickFeedbackOption; label: string }> = [
  { value: "very_easy", label: "Meget let" },
  { value: "good", label: "Passende" },
  { value: "hard", label: "Lidt hårdt" },
  { value: "too_hard", label: "For hårdt" },
];

const INFO_TEXT: Record<Exclude<InfoField, null>, string> = {
  targetTime: "Valgfrit. Brug dette felt hvis du har en konkret sluttid, fx 5 km på 30:00.",
  runningExperience: "Vælg det niveau der bedst matcher din løbeerfaring lige nu.",
  activityLevel: "Dette hjælper StridePilot med at vurdere din samlede belastning i hverdagen.",
  availableTrainingDays: "Vælg de dage hvor du realistisk kan træne fast.",
  weeks: "Antallet af uger påvirker hvor hurtigt programmet skal bygge op mod dit mål.",
  currentRunningAbility: "Dette hjælper med at placere dit første niveau og gøre planen realistisk fra dag 1.",
  graph: "Den grå kurve viser planen fra start. Den blå kurve viser, hvordan jeg har tilpasset den undervejs.",
};

function requiredRunsPerWeek(distance: Goal["distance"]): number {
  if (distance === "5K") return 2;
  if (distance === "10K") return 3;
  return 3;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatClock(totalSec: number): string {
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function clampDuration(sec: number): number {
  return normalizeStepDuration(sec);
}

function startOfIsoWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function sessionDateFromPlan(startDateIso: string, session: WorkoutSession): Date {
  const startDate = new Date(`${startDateIso}T00:00:00`);
  const weekAnchor = new Date(startDate);
  weekAnchor.setDate(startDate.getDate() + (session.week - 1) * 7);
  const monday = startOfIsoWeek(weekAnchor);
  const offset = DAY_INDEX[session.dayOfWeek] === 0 ? 6 : DAY_INDEX[session.dayOfWeek] - 1;
  const sessionDate = new Date(monday);
  sessionDate.setDate(monday.getDate() + offset);

  // Keep week 1 aligned with the chosen onboarding start date instead of drifting into the past.
  if (sessionDate < startDate) {
    sessionDate.setDate(sessionDate.getDate() + 7);
  }

  return sessionDate;
}

function formatDanishDateWithWeekday(date: Date): string {
  const datePart = date.toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" });
  const weekDay = date.toLocaleDateString("da-DK", { weekday: "long" }).toLowerCase();
  return `${datePart}: ${weekDay}`;
}

function isValidTargetTime(value: string): boolean {
  if (!value) return true;
  return /^(\d{1,2}:\d{2}|\d{1,2}:\d{2}:\d{2})$/.test(value);
}

function isValidIsoDate(value: string): boolean {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function formatStepDuration(step: WorkoutStep): string {
  if (step.durationSec % 60 === 0) {
    const min = step.durationSec / 60;
    return `${min} ${min === 1 ? "minut" : "minutter"}`;
  }
  return `${step.durationSec} sekunder`;
}

function stepCueText(step: WorkoutStep): string {
  if (step.type === "warmup") return `Rask gang i ${formatStepDuration(step)}`;
  if (step.type === "run") return `Løb i ${formatStepDuration(step)}`;
  if (step.type === "walk") return `Gå i ${formatStepDuration(step)}`;
  return `Nedkøling i ${formatStepDuration(step)}`;
}

function shortSessionTitle(title: string): string {
  return title.replace(/^Uge \d+\s*-\s*/i, "").trim();
}

function phaseName(step: WorkoutStep): string {
  if (step.type === "run") return "Løb";
  if (step.type === "walk") return "Gang";
  if (step.type === "warmup") return "Rask gang";
  return "Nedkøling";
}

function intensityFromLoad(loadScore: number): string {
  if (loadScore <= 3) return "Let intensitet";
  if (loadScore <= 6) return "Moderat intensitet";
  return "Høj intensitet";
}

function coachingHint(step: WorkoutStep): string {
  if (step.type === "warmup") return "Gå i rask tempo og bliv varm i kroppen.";
  if (step.type === "run") return "Løb i kontrolleret tempo. Du skal kunne tale i korte sætninger.";
  if (step.type === "walk") return "Sænk tempoet og træk vejret roligt.";
  return "Lad pulsen falde roligt og hold kroppen i bevægelse.";
}

function buildCue(step: WorkoutStep, mode: AudioMode): string {
  const shortCue = stepCueText(step);
  if (mode === "coach") {
    return `${shortCue}. ${coachingHint(step)}`;
  }
  return shortCue;
}

function introSeenKey(userId: string): string {
  return `stridepilotIntroSeen:${userId}`;
}

function programSeenKey(userId: string): string {
  return `stridepilotProgramSeen:${userId}`;
}

function firstNameKey(userId: string): string {
  return `stridepilotFirstName:${userId}`;
}

function setupKey(userId: string): string {
  return `runnerCoachHasSetup:${userId}`;
}

function profileKey(userId: string): string {
  return `runnerCoachProfileId:${userId}`;
}

function sessionShortDescription(session: WorkoutSession): string {
  if (/interval/i.test(session.title)) {
    return "Intervalpas med korte løbeintervaller og rolige gangpauser.";
  }
  if (/udholdenhed/i.test(session.title)) {
    return "Roligt udholdenhedspas med fokus på kontinuitet og roligt tempo.";
  }
  if (/roligt/i.test(session.title)) {
    return "Roligt pas med jævnt tempo og fokus på komfortabel rytme.";
  }
  if (/måldag|test/i.test(session.title)) {
    return "Målspecifikt pas hvor du afprøver den form, du har bygget op.";
  }
  return "Et guidet løbepas tilpasset dit nuværende program.";
}

function formatMinutesLabel(totalSec: number): string {
  if (totalSec <= 0) return "0 min";
  const minutes = totalSec / 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const rest = Math.round(minutes % 60);
    return rest > 0 ? `${hours} t ${rest} min` : `${hours} t`;
  }
  if (minutes % 1 === 0) return `${minutes} min`;
  return `${minutes.toFixed(1).replace(".", ",")} min`;
}

function linePath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

function sessionTotalDurationSec(session: WorkoutSession): number {
  return session.steps.reduce((sum, step) => sum + step.durationSec, 0);
}

function intervalSummary(session: WorkoutSession): string {
  const runSteps = session.steps.filter((step) => step.type === "run");
  const walkSteps = session.steps.filter((step) => step.type === "walk");
  if (runSteps.length > 1) {
    const runDuration = formatClock(runSteps[0].durationSec).replace(/^00:/, "");
    const walkDuration = walkSteps[0] ? ` · ${formatClock(walkSteps[0].durationSec).replace(/^00:/, "")} gangpause` : "";
    return `${runSteps.length} × ${runDuration} løb${walkDuration}`;
  }
  if (runSteps.length === 1) {
    return `${formatMinutesLabel(runSteps[0].durationSec)} sammenhængende løb`;
  }
  return "Let bevægelse og rolig rytme";
}

function recommendedTrainingDays(params: {
  distance: Goal["distance"];
  targetTime?: string;
  runningExperience: RunnerProfile["runningExperience"];
  currentRunningAbility: RunnerProfile["currentRunningAbility"];
  weeks: number;
}): { recommendedDays: number; message: string; caution?: string } {
  const { distance, targetTime, runningExperience, currentRunningAbility, weeks } = params;
  let recommendedDays = distance === "5K" ? 2 : 3;

  if (distance === "Halvmaraton" || distance === "Marathon") recommendedDays = 3;
  if (runningExperience === "ovet") recommendedDays = Math.max(2, recommendedDays);
  if (currentRunningAbility === "helt_ny" || currentRunningAbility === "fem_min") {
    recommendedDays = Math.max(recommendedDays, 3);
  }
  if (targetTime) {
    recommendedDays += 1;
  }
  if (weeks <= 10) {
    recommendedDays += 1;
  }

  recommendedDays = Math.min(5, recommendedDays);

  let message = `Anbefaling: ${recommendedDays} træningsdage om ugen passer godt til dit mål.`;
  if (recommendedDays <= 2) {
    message = "2 træningsdage kan fungere, men vil sandsynligvis kræve en længere tidshorisont.";
  } else if (recommendedDays >= 4) {
    message = `For at nå dit mål anbefaler jeg mindst ${recommendedDays} faste træningsdage.`;
  }

  const caution =
    currentRunningAbility === "helt_ny" && weeks <= 12
      ? "Du starter fra et lavt niveau, så faste træningsdage gør det lettere at bygge kontinuitet sikkert op."
      : undefined;

  return { recommendedDays, message, caution };
}

function inferRunningExperience(ability: CurrentRunningAbility): RunnerProfile["runningExperience"] {
  if (ability === "mere_end_tredive_min" || ability === "tyve_tredive_min") return "let_ovet";
  return "nybegynder";
}

function runningAbilityLabel(value: CurrentRunningAbility): string {
  return CURRENT_RUNNING_ABILITY_OPTIONS.find((option) => option.value === value)?.label ?? "dit nuværende niveau";
}

function intermezzoSummary(params: {
  runnerProfile: RunnerProfile;
  goal: Goal;
  insights: RunnerProfileInsights | null;
  recommendation: { recommendedDays: number };
  planFeasibilityStatus: "feasible" | "feasible_with_adjustments" | "not_feasible";
  planTradeoff: string | null;
}): {
  title: string;
  summary: string;
  rationale: string;
  bullets: Array<{ label: string; value: string }>;
} {
  const { runnerProfile, goal, insights, recommendation, planFeasibilityStatus, planTradeoff } = params;
  const name = runnerProfile.firstName?.trim();
  const goalLabel = goal.targetTime ? `${goal.distance} på ${goal.targetTime}` : goal.distance;
  const abilityLabel = runningAbilityLabel(runnerProfile.currentRunningAbility);
  const strategyStyle = insights?.progressionStrategy.style ?? "balanced";

  const title = name ? `Tak ${name} — her er mit udgangspunkt for din plan` : "Her er mit udgangspunkt for din plan";

  const focusText =
    strategyStyle === "conservative"
      ? "rolig og tryg progression"
      : strategyStyle === "aggressive"
        ? "målrettet progression i et kontrolleret tempo"
        : "stabil progression med fokus på kontinuitet";

  const cautionText =
    planFeasibilityStatus === "feasible_with_adjustments" && planTradeoff
      ? planTradeoff
      : runnerProfile.currentRunningAbility === "helt_ny"
        ? "du er stadig i gang med at bygge dit løbegrundlag op"
        : goal.targetTime
          ? "du har et konkret ambitionsniveau, som kræver stabil opbygning"
          : "det vigtigste er at bygge stabilitet og gode vaner op";

  const summary = name
    ? `${name}, du vil gerne frem mod ${goalLabel}, og lige nu kan du realistisk løbe på et niveau svarende til: ${abilityLabel.toLowerCase()}. Jeg lægger derfor planen an med fokus på ${focusText}.`
    : `Du vil gerne frem mod ${goalLabel}, og dit nuværende niveau peger på, at planen skal bygges op med fokus på ${focusText}.`;

  const rationale =
    strategyStyle === "conservative"
      ? "Jeg starter dig roligt ud, så du får succesoplevelser tidligt og kan bygge formen stabilt op uden at presse for hårdt for tidligt."
      : strategyStyle === "aggressive"
        ? "Jeg bygger videre på det, du allerede kan, men holder progressionen kontrolleret, så ambitionen bliver omsat til stabil fremgang."
        : "Jeg starter på et niveau, hvor du kan bygge videre på det, du allerede kan, uden at træningen bliver unødigt hård fra begyndelsen.";

  const bullets = [
    { label: "Mål", value: goalLabel },
    { label: "Fokus", value: focusText },
    { label: "Særligt hensyn", value: cautionText },
    { label: "Min strategi", value: `ca. ${recommendation.recommendedDays} træningsdage om ugen og løbende justering ud fra din feedback` },
  ];

  return { title, summary, rationale, bullets };
}

function quickFeedbackPreset(value: QuickFeedbackOption): Pick<WorkoutFeedbackInput, "effort" | "completionPct" | "energy" | "painLevel"> {
  if (value === "very_easy") {
    return { effort: 3, completionPct: 100, energy: 5, painLevel: 1 };
  }
  if (value === "good") {
    return { effort: 6, completionPct: 100, energy: 4, painLevel: 1 };
  }
  if (value === "hard") {
    return { effort: 8, completionPct: 90, energy: 3, painLevel: 2 };
  }
  return { effort: 9, completionPct: 75, energy: 2, painLevel: 4 };
}

function programWhySummary(params: {
  runnerProfile: RunnerProfile;
  goal: Goal;
  insights: RunnerProfileInsights | null;
  planTradeoff: string | null;
}): string[] {
  const { runnerProfile, goal, insights, planTradeoff } = params;
  const strategyStyle = insights?.progressionStrategy.style ?? "balanced";

  const firstLine =
    runnerProfile.currentRunningAbility === "helt_ny"
      ? "Du starter med korte intervaller, fordi dit nuværende niveau stadig er under opbygning."
      : runnerProfile.currentRunningAbility === "fem_min"
        ? "Planen begynder med korte, kontrollerede blokke, så du kan bygge videre på det, du allerede kan."
        : "Planen tager udgangspunkt i dit nuværende niveau, så du kan udvikle dig uden at hoppe for hurtigt frem.";

  const secondLine =
    strategyStyle === "conservative"
      ? "Jeg øger gradvist løbetiden uge for uge, så progressionen bliver tryg, realistisk og stabil."
      : strategyStyle === "aggressive"
        ? "Jeg bygger progressionen lidt mere målrettet op, men stadig i et tempo hvor kroppen kan følge med."
        : "Jeg lader løbetiden vokse gradvist, så du kan finde rytme og overskud i træningen.";

  const lines = [firstLine, secondLine];

  if (planTradeoff) {
    lines.push(planTradeoff);
  } else if (goal.targetTime) {
    lines.push(`Dit mål om ${goal.distance} på ${goal.targetTime} er tænkt ind, men planen prioriterer stadig stabil opbygning først.`);
  }

  return lines;
}

function coachAdjustmentCopy(text: string): string {
  const cleaned = text.replace(/\ber er\b/gi, "er").replace(/\s+/g, " ").trim();
  const variant = Array.from(cleaned).reduce((sum, char) => sum + char.charCodeAt(0), 0);

  if (/fordi/i.test(cleaned)) return cleaned;
  if (/restitution/i.test(cleaned)) {
    const variants = [
      "Jeg lagde mere restitution ind her, så kroppen får bedre plads til at absorbere træningen.",
      "Jeg holder denne del roligere, så du får lidt mere restitution mellem passene.",
    ];
    return variants[variant % variants.length];
  }
  if (/holder progressionen|holde progressionen/i.test(cleaned)) {
    const variants = [
      "Jeg holder ugen stabil, så du kan bygge videre med lidt mere overskud.",
      "Jeg lader progressionen stå mere roligt her, så belastningen forbliver realistisk.",
    ];
    return variants[variant % variants.length];
  }
  if (/dæmper|lettere|smule/i.test(cleaned)) {
    const variants = [
      "Jeg dæmpede denne del en smule, så progressionen ikke bliver for stejl.",
      "Jeg holder intensiteten rolig her, så træningen stadig føles kontrolleret.",
    ];
    return variants[variant % variants.length];
  }
  if (/skruer|øger|anelse op/i.test(cleaned)) {
    const variants = [
      "Jeg øger her en smule, fordi de seneste pas tyder på overskud.",
      "Jeg bygger lidt videre her, fordi kroppen ser ud til at følge fint med.",
    ];
    return variants[variant % variants.length];
  }
  const fallback = [
    "Jeg justerede programmet let, så det passer bedre til din aktuelle rytme.",
    "Jeg finjusterede denne del, så planen bliver ved med at føles realistisk.",
  ];
  return fallback[variant % fallback.length];
}

function postWorkoutCoachMessage(params: {
  firstName?: string;
  session: WorkoutSession | null;
}): { title: string; body: string } {
  const { firstName, session } = params;
  const title = firstName?.trim() ? `Godt arbejde, ${firstName.trim()}` : "Godt arbejde";

  if (!session) {
    return {
      title,
      body: "Du har gennemført passet. Det giver os et godt udgangspunkt for næste skridt i programmet.",
    };
  }

  if (session.loadScore >= 7) {
    return {
      title,
      body: "Det var et mere krævende pas i dag. Derfor holder jeg næste skridt kontrolleret, så du kan bygge videre med overskud.",
    };
  }

  if (session.loadScore >= 4) {
    return {
      title,
      body: "Du kom godt gennem passet i dag. Det tyder på, at du bygger formen op i et tempo, der giver mening.",
    };
  }

  return {
    title,
    body: "Du gennemførte et roligt og stabilt pas i dag. Det er præcis sådan, vi bygger kontinuitet og gode vaner op.",
  };
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("welcome");
  const [authMode, setAuthMode] = useState<AuthMode>("signup");
  const [hasSetup, setHasSetup] = useState(false);
  const [displayWeek, setDisplayWeek] = useState(1);
  const [appearance, setAppearance] = useState<ThemePref>("system");
  const [effectiveTheme, setEffectiveTheme] = useState<"dark" | "light">("dark");
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [onboardingSelections, setOnboardingSelections] = useState<OnboardingSelectionState>({
    runningAbility: false,
    goalDistance: false,
    activityLevel: false,
  });

  const [runnerProfile, setRunnerProfile] = useState<RunnerProfile>({
    firstName: "",
    heightCm: 175,
    weightKg: 75,
    age: 30,
    activityLevel: "moderat",
    runningExperience: "nybegynder",
    currentRunningAbility: "helt_ny",
    gender: undefined,
    userTrainingContext: "",
  });
  const [goal, setGoal] = useState<Goal>({
    distance: "5K",
    weeks: 12,
    startDate: todayIso(),
    reminderTime: "13:00",
    targetTime: "",
    availableTrainingDays: ["Tirsdag", "Torsdag", "Lordag"],
  });

  const [profileDraft, setProfileDraft] = useState({
    heightCm: "175",
    weightKg: "75",
    age: "30",
  });
  const [goalWeeksDraft, setGoalWeeksDraft] = useState("12");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [openInfoField, setOpenInfoField] = useState<InfoField>(null);

  const [profileId, setProfileId] = useState<string>("");
  const [baselinePlan, setBaselinePlan] = useState<TrainingPlan | null>(null);
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [runnerProfileInsights, setRunnerProfileInsights] = useState<RunnerProfileInsights | null>(null);
  const [, setFeedbackInsights] = useState<FeedbackInsights | null>(null);
  const [adjustmentLog, setAdjustmentLog] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [isRunning, setIsRunning] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(false);
  const [audioMode, setAudioMode] = useState<AudioMode>("coach");
  const [ttsSupported, setTtsSupported] = useState(false);
  const [cueFallbackText, setCueFallbackText] = useState("");
  const [stepIndex, setStepIndex] = useState(0);
  const [remainingSec, setRemainingSec] = useState(0);
  const [workoutCompleted, setWorkoutCompleted] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [stepNotice, setStepNotice] = useState("");
  const [safetyAdjustments, setSafetyAdjustments] = useState<string[]>([]);
  const [planWarnings, setPlanWarnings] = useState<string[]>([]);
  const [showAllSafety, setShowAllSafety] = useState(false);
  const [planTradeoff, setPlanTradeoff] = useState<string | null>(null);
  const [planFeasibilityStatus, setPlanFeasibilityStatus] = useState<"feasible" | "feasible_with_adjustments" | "not_feasible">("feasible");
  const [feedbackConfirmation, setFeedbackConfirmation] = useState<{
    title: string;
    message: string;
    interpretation: string;
    adjustment: string;
    bullets: string[];
  } | null>(null);
  const [feedbackSubmitState, setFeedbackSubmitState] = useState<"idle" | "submitting" | "success">("idle");
  const [showProgramIntro, setShowProgramIntro] = useState(false);
  const [isProgramTransitioning, setIsProgramTransitioning] = useState(false);
  const [showDetailedFeedback, setShowDetailedFeedback] = useState(false);

  const [feedback, setFeedback] = useState<WorkoutFeedbackInput>({
    quickFeedback: undefined,
    effort: 6,
    completionPct: 100,
    energy: 3,
    painLevel: 1,
    notes: "",
  });
  const [feedbackDraft, setFeedbackDraft] = useState({
    effort: "6",
    completionPct: "100",
    energy: "3",
    painLevel: "1",
  });

  const lastSpokenStepKey = useRef<string>("");
  const thirtySecCueKey = useRef<string>("");
  const feedbackSuccessTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const programWeekRef = useRef<HTMLDivElement | null>(null);
  const todayPrimaryCtaRef = useRef<HTMLButtonElement | null>(null);
  const [restDayPrompt, setRestDayPrompt] = useState<{ dateLabel: string; showIdeas: boolean } | null>(null);
  const [showStickyProgramCta, setShowStickyProgramCta] = useState(true);

  const resetProgramState = useCallback(() => {
    setHasSetup(false);
    setProfileId("");
    setBaselinePlan(null);
    setPlan(null);
    setRunnerProfileInsights(null);
    setFeedbackInsights(null);
    setAdjustmentLog([]);
    setSelectedSessionId("");
    setPlanTradeoff(null);
    setPlanWarnings([]);
    setSafetyAdjustments([]);
    setShowProgramIntro(false);
    setFeedbackConfirmation(null);
    setWorkoutCompleted(false);
    setCompletedSteps([]);
    setStepNotice("");
    setDisplayWeek(1);
  }, []);

  const activeSession = useMemo(
    () => plan?.sessions.find((session) => session.id === selectedSessionId) ?? null,
    [plan, selectedSessionId],
  );
  const currentStep = activeSession?.steps[stepIndex];
  const activeUserId = authUser?.id ?? (isDemoMode ? "demo-user" : profileId || "");
  const goalDestinationSession = useMemo(() => {
    if (!plan?.sessions.length) return null;
    return plan.sessions.find((session) => /Måldag|test/i.test(session.title)) ?? plan.sessions[plan.sessions.length - 1];
  }, [plan]);
  const trainingDayRecommendation = useMemo(
    () =>
      recommendedTrainingDays({
        distance: goal.distance,
        targetTime: goal.targetTime,
        runningExperience: runnerProfile.runningExperience,
        currentRunningAbility: runnerProfile.currentRunningAbility,
        weeks: goal.weeks,
      }),
    [goal.distance, goal.targetTime, goal.weeks, runnerProfile.currentRunningAbility, runnerProfile.runningExperience],
  );
  const feedbackSubmitted = Boolean(feedbackConfirmation);
  const baselineWeeklyLoad = useMemo(() => (baselinePlan ? buildWeeklyLoad(baselinePlan) : []), [baselinePlan]);
  const currentWeeklyLoad = useMemo(() => (plan ? buildWeeklyLoad(plan) : []), [plan]);
  const maxWeeklyLoad = useMemo(() => {
    const allLoads = [...baselineWeeklyLoad, ...currentWeeklyLoad].map((point) => point.load);
    return allLoads.length ? Math.max(...allLoads, 1) : 1;
  }, [baselineWeeklyLoad, currentWeeklyLoad]);
  const longestRunNow = currentWeeklyLoad.reduce((longest, point) => Math.max(longest, point.longestContinuousRunSec), 0);
  const currentWeekLoad = currentWeeklyLoad.find((point) => point.week === displayWeek) ?? currentWeeklyLoad[0] ?? null;
  const graphSeries = useMemo(() => {
    const chartWidth = 300;
    const chartHeight = 120;
    const padding = 18;

    function toPoints(series: typeof currentWeeklyLoad) {
      if (series.length === 0) return [];
      return series.map((point, index) => ({
        x: padding + (index / Math.max(series.length - 1, 1)) * (chartWidth - padding * 2),
        y: chartHeight - padding - (point.load / maxWeeklyLoad) * (chartHeight - padding * 2),
      }));
    }

    return {
      width: chartWidth,
      height: chartHeight,
      baselinePath: linePath(toPoints(baselineWeeklyLoad)),
      currentPath: linePath(toPoints(currentWeeklyLoad)),
    };
  }, [baselineWeeklyLoad, currentWeeklyLoad, maxWeeklyLoad]);
  const finishWorkout = useCallback(() => {
    cancelCue();
    setIsRunning(false);
    setWorkoutCompleted(true);
    const cue = "Godt løbet. Passet er gennemført.";
    setCueFallbackText(cue);
    if (audioMode !== "off" && ttsSupported && speechEnabled) {
      speakCue(cue);
    }
  }, [audioMode, speechEnabled, ttsSupported]);

  useEffect(() => {
    return () => {
      if (feedbackSuccessTimeout.current) {
        clearTimeout(feedbackSuccessTimeout.current);
      }
    };
  }, []);

  const weekNumber = useMemo(() => {
    if (!plan) return 1;
    const start = new Date(`${goal.startDate}T00:00:00`);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(1, Math.min(plan.weeks, Math.floor(diffDays / 7) + 1));
  }, [goal.startDate, plan]);

  const calendarWeekDates = useMemo(() => {
    const startDate = new Date(`${goal.startDate}T00:00:00`);
    const weekStart = new Date(startDate);
    weekStart.setDate(startDate.getDate() + (displayWeek - 1) * 7);

    return Array.from({ length: 7 }).map((_, index) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + index);
      return date;
    });
  }, [goal.startDate, displayWeek]);

  const sessionsByDate = useMemo(() => {
    if (!plan) return new Map<string, WorkoutSession>();
    const byDate = new Map<string, WorkoutSession>();
    const weekSessions = plan.sessions.filter((s) => s.week === displayWeek);
    weekSessions.forEach((session) => {
      byDate.set(sessionDateFromPlan(goal.startDate, session).toISOString().slice(0, 10), session);
    });
    return byDate;
  }, [goal.startDate, plan, displayWeek]);

  const nextSession = useMemo(() => {
    if (!plan) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sorted = [...plan.sessions].sort((a, b) => {
      return sessionDateFromPlan(goal.startDate, a).getTime() - sessionDateFromPlan(goal.startDate, b).getTime();
    });

    const upcoming = sorted.find((session) => sessionDateFromPlan(goal.startDate, session).getTime() >= today.getTime());
    return upcoming ?? null;
  }, [goal.startDate, plan]);
  const todaySession = useMemo(() => {
    if (!plan) return null;
    const today = new Date();
    return (
      plan.sessions.find((session) => sessionDateFromPlan(goal.startDate, session).toDateString() === today.toDateString()) ?? null
    );
  }, [goal.startDate, plan]);

  const stepProgress = useMemo(() => {
    if (!activeSession || !currentStep) return 0;

    const totalSessionSec = activeSession.steps.reduce((sum, step) => sum + step.durationSec, 0);
    const completedBeforeCurrent = activeSession.steps.slice(0, stepIndex).reduce((sum, step) => sum + step.durationSec, 0);
    const currentCompleted = currentStep.durationSec - remainingSec;

    return Math.min(100, Math.max(0, ((completedBeforeCurrent + currentCompleted) / totalSessionSec) * 100));
  }, [activeSession, currentStep, stepIndex, remainingSec]);

  const hydrateProgramState = useCallback(
    async (currentProfileId: string) => {
      const res = await fetch("/api/plan/current");
      if (!res.ok) return false;

      const data = (await res.json()) as {
        plan?: TrainingPlan;
        baselinePlan?: TrainingPlan;
        goal?: Goal;
        profile?: Partial<RunnerProfile>;
      };

      if (!data.plan) return false;

      setPlan(data.plan);
      setBaselinePlan(data.baselinePlan ?? data.plan);
      setSelectedSessionId(data.plan.sessions[0]?.id ?? "");
      if (data.goal) {
        setGoal((current) => ({
          ...current,
          ...data.goal,
        }));
      }
      if (data.profile) {
        setRunnerProfile((current) => ({
          ...current,
          ...data.profile,
        }));
      }

      const userKey = activeUserId || currentProfileId;
      if (userKey) {
        const savedName = window.localStorage.getItem(firstNameKey(userKey));
        if (savedName) {
          setRunnerProfile((current) => ({ ...current, firstName: savedName }));
        }
      }

      return true;
    },
    [activeUserId],
  );

  useEffect(() => {
    const savedAudioMode = window.localStorage.getItem("stridepilotAudioMode");
    const savedAppearance = window.localStorage.getItem("stridepilotAppearance");
    if (savedAudioMode === "off" || savedAudioMode === "short" || savedAudioMode === "coach") {
      setAudioMode(savedAudioMode);
    }
    if (savedAppearance === "dark" || savedAppearance === "light" || savedAppearance === "system") {
      setAppearance(savedAppearance);
    }
    setTtsSupported(isSpeechSupported());

    async function bootstrapAuth() {
      const meRes = await fetch("/api/auth/me");
      if (!meRes.ok) return;

      const meData = (await meRes.json()) as {
        authenticated: boolean;
        user?: AuthUser;
        profileId?: string | null;
      };

      if (meData.authenticated && meData.user) {
        setAuthUser(meData.user);
        window.localStorage.removeItem("stridepilotDemoMode");
        const savedName = window.localStorage.getItem(firstNameKey(meData.user.id));
        if (savedName) {
          setRunnerProfile((current) => ({ ...current, firstName: savedName }));
        }
        const hasProfile = Boolean(meData.profileId);
        setHasSetup(hasProfile);
        if (hasProfile && meData.profileId) {
          setProfileId(meData.profileId);
          window.localStorage.setItem(profileKey(meData.user.id), meData.profileId);
          window.localStorage.setItem(setupKey(meData.user.id), "1");
          const hasPlan = await hydrateProgramState(meData.profileId);
          setStage(hasPlan ? "program" : "profile");
        } else {
          window.localStorage.removeItem(setupKey(meData.user.id));
          window.localStorage.removeItem(profileKey(meData.user.id));
          setStage(window.localStorage.getItem(introSeenKey(meData.user.id)) === "1" ? "profile" : "intro");
        }
      }
    }

    bootstrapAuth().catch(() => undefined);

    const demoMode = window.localStorage.getItem("stridepilotDemoMode") === "1";
    if (demoMode) {
      const demoSetupDone = window.localStorage.getItem(setupKey("demo-user")) === "1";
      const localProfileId = window.localStorage.getItem(profileKey("demo-user")) ?? "demo-profile";
      setIsDemoMode(true);
      setAuthUser({ id: "demo-user", email: "demo@stridepilot.app", isDemo: true });
      setProfileId(localProfileId);
      setHasSetup(demoSetupDone);
      const savedName = window.localStorage.getItem(firstNameKey("demo-user"));
      if (savedName) {
        setRunnerProfile((current) => ({ ...current, firstName: savedName }));
      }
      setStage(demoSetupDone ? "program" : window.localStorage.getItem(introSeenKey("demo-user")) === "1" ? "profile" : "intro");
    }
  }, [hydrateProgramState]);

  useEffect(() => {
    window.localStorage.setItem("stridepilotAudioMode", audioMode);
    if (audioMode === "off") {
      cancelCue();
    }
  }, [audioMode]);

  useEffect(() => {
    window.localStorage.setItem("stridepilotAppearance", appearance);
  }, [appearance]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
    const applyTheme = () => {
      setEffectiveTheme(appearance === "system" ? (mediaQuery.matches ? "light" : "dark") : appearance);
    };

    applyTheme();
    mediaQuery.addEventListener("change", applyTheme);
    return () => mediaQuery.removeEventListener("change", applyTheme);
  }, [appearance]);

  useEffect(() => {
    if (!plan) return;
    setDisplayWeek(weekNumber);
  }, [plan, weekNumber]);

  useEffect(() => {
    if (stage === "program") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [stage, plan, displayWeek]);

  useEffect(() => {
    if (!activeUserId) return;
    if (runnerProfile.firstName?.trim()) {
      window.localStorage.setItem(firstNameKey(activeUserId), runnerProfile.firstName.trim());
    }
  }, [activeUserId, runnerProfile.firstName]);

  useEffect(() => {
    if (stage !== "program" || !activeUserId) return;
    const seen = window.localStorage.getItem(programSeenKey(activeUserId)) === "1";
    setShowProgramIntro(!seen);
    if (!seen) {
      window.localStorage.setItem(programSeenKey(activeUserId), "1");
    }
  }, [stage, activeUserId]);

  useEffect(() => {
    if (stage === "profile") {
      setOnboardingStep(1);
      setOnboardingSelections({
        runningAbility: hasSetup,
        goalDistance: hasSetup,
        activityLevel: hasSetup,
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [stage, hasSetup]);

  useEffect(() => {
    setProfileDraft({
      heightCm: String(runnerProfile.heightCm),
      weightKg: String(runnerProfile.weightKg),
      age: String(runnerProfile.age),
    });
  }, [runnerProfile.heightCm, runnerProfile.weightKg, runnerProfile.age]);

  useEffect(() => {
    setRunnerProfile((current) => {
      const inferred = inferRunningExperience(current.currentRunningAbility);
      return current.runningExperience === inferred ? current : { ...current, runningExperience: inferred };
    });
  }, [runnerProfile.currentRunningAbility]);

  useEffect(() => {
    setGoalWeeksDraft(String(goal.weeks));
  }, [goal.weeks]);

  useEffect(() => {
    setFeedbackDraft({
      effort: String(feedback.effort),
      completionPct: String(feedback.completionPct),
      energy: String(feedback.energy),
      painLevel: String(feedback.painLevel),
    });
  }, [feedback.effort, feedback.completionPct, feedback.energy, feedback.painLevel]);

  useEffect(() => {
    if (!plan || plan.sessions.length === 0) return;
    if (!selectedSessionId) {
      setSelectedSessionId(plan.sessions[0].id);
    }
  }, [plan, selectedSessionId]);

  useEffect(() => {
    if (!activeSession) return;
    setStepIndex(0);
    setRemainingSec(activeSession.steps[0].durationSec);
    setIsRunning(false);
    setWorkoutCompleted(false);
    setCompletedSteps([]);
    setStepNotice("");
    setFeedbackConfirmation(null);
    setFeedbackSubmitState("idle");
    setShowDetailedFeedback(false);
    lastSpokenStepKey.current = "";
    thirtySecCueKey.current = "";
  }, [activeSession]);

  useEffect(() => {
    if (!stepNotice) return;
    const timeout = window.setTimeout(() => setStepNotice(""), 1200);
    return () => window.clearTimeout(timeout);
  }, [stepNotice]);

  useEffect(() => {
    if (stage !== "workout") {
      cancelCue();
    }
  }, [stage]);

  useEffect(() => {
    if (!isRunning || !activeSession) return;
    const interval = window.setInterval(() => {
      setRemainingSec((prev) => Math.max(prev - 1, 0));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isRunning, activeSession]);

  useEffect(() => {
    if (!activeSession || !currentStep || audioMode === "off") return;
    const key = `${activeSession.id}-${stepIndex}`;
    if (lastSpokenStepKey.current === key) return;

    lastSpokenStepKey.current = key;
    const cue = buildCue(currentStep, audioMode);
    setCueFallbackText(cue);

    if (!ttsSupported || !speechEnabled) return;
    if (!speakCue(cue)) {
      setCueFallbackText(cue);
    }
  }, [activeSession, currentStep, speechEnabled, stepIndex, audioMode, ttsSupported]);

  useEffect(() => {
    if (!activeSession || !currentStep || audioMode === "off" || remainingSec !== 30) return;

    const key = `${activeSession.id}-${stepIndex}`;
    if (thirtySecCueKey.current === key) return;

    thirtySecCueKey.current = key;
    const cue = audioMode === "coach" ? "30 sekunder tilbage. Hold fokus på rytmen." : "30 sekunder tilbage";
    setCueFallbackText(cue);
    if (ttsSupported && speechEnabled) {
      speakCue(cue);
    }
  }, [activeSession, currentStep, remainingSec, speechEnabled, stepIndex, audioMode, ttsSupported]);

  useEffect(() => {
    if (!activeSession || remainingSec > 0) return;

    const nextStep = stepIndex + 1;
    setCompletedSteps((prev) => (prev.includes(stepIndex) ? prev : [...prev, stepIndex]));
    if (nextStep >= activeSession.steps.length) {
      finishWorkout();
      return;
    }

    setStepIndex(nextStep);
    setRemainingSec(activeSession.steps[nextStep].durationSec);
  }, [remainingSec, stepIndex, activeSession, finishWorkout]);

  function startFlow() {
    setError(null);
    if (!hasSetup || !authUser) {
      setStage("auth");
      return;
    }
    setStage("program");
  }

  async function register() {
    setError(null);
    if (password.length < 8) {
      setError("Adgangskoden skal være mindst 8 tegn.");
      return;
    }

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (res.status === 409) {
        setError("Der findes allerede en konto med denne e-mail. Prøv at logge ind.");
        return;
      }
      if (res.status === 400) {
        setError("Ugyldig e-mail eller adgangskode. Adgangskoden skal være mindst 8 tegn.");
        return;
      }
      setError(payload?.error ? `Kunne ikke oprette konto: ${payload.error}` : "Kunne ikke oprette konto lige nu.");
      return;
    }

    const data = (await res.json()) as { user: AuthUser };
    resetProgramState();
    setIsDemoMode(false);
    setAuthUser(data.user);
    window.localStorage.removeItem("stridepilotDemoMode");
    window.localStorage.removeItem(setupKey(data.user.id));
    window.localStorage.removeItem(profileKey(data.user.id));
    setStage(window.localStorage.getItem(introSeenKey(data.user.id)) === "1" ? "profile" : "intro");
  }

  async function login() {
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      setError("Login fejlede.");
      return;
    }

    const data = (await res.json()) as { user: AuthUser };
    resetProgramState();
    setIsDemoMode(false);
    setAuthUser(data.user);
    window.localStorage.removeItem("stridepilotDemoMode");
    const savedName = window.localStorage.getItem(firstNameKey(data.user.id));
    if (savedName) {
      setRunnerProfile((current) => ({ ...current, firstName: savedName }));
    }

    let hasProfile = false;
    let hasPlan = false;
    const meRes = await fetch("/api/auth/me");
    if (meRes.ok) {
      const meData = (await meRes.json()) as { profileId?: string | null };
      if (meData.profileId) {
        hasProfile = true;
        setProfileId(meData.profileId);
        window.localStorage.setItem(profileKey(data.user.id), meData.profileId);
        window.localStorage.setItem(setupKey(data.user.id), "1");
        hasPlan = await hydrateProgramState(meData.profileId);
      }
    }

    setHasSetup(hasProfile);
    if (!hasProfile) {
      window.localStorage.removeItem(setupKey(data.user.id));
      window.localStorage.removeItem(profileKey(data.user.id));
    }
    setStage(hasProfile ? (hasPlan ? "program" : "profile") : window.localStorage.getItem(introSeenKey(data.user.id)) === "1" ? "profile" : "intro");
  }

  async function logout() {
    setError(null);
    if (!isDemoMode) {
      await fetch("/api/auth/logout", { method: "POST" });
    }
    const userId = authUser?.id;
    resetProgramState();
    setAuthUser(null);
    setIsDemoMode(false);
    if (userId) {
      window.localStorage.removeItem(setupKey(userId));
      window.localStorage.removeItem(profileKey(userId));
    }
    window.localStorage.removeItem(setupKey("demo-user"));
    window.localStorage.removeItem(profileKey("demo-user"));
    window.localStorage.removeItem("stridepilotDemoMode");
    setStage("auth");
  }

  function startDemoMode() {
    setError(null);
    resetProgramState();
    setAuthUser({ id: "demo-user", email: "demo@stridepilot.app", isDemo: true });
    setIsDemoMode(true);
    setProfileId("demo-profile");
    window.localStorage.setItem("stridepilotDemoMode", "1");
    window.localStorage.removeItem(setupKey("demo-user"));
    window.localStorage.setItem(profileKey("demo-user"), "demo-profile");
    setStage(window.localStorage.getItem(introSeenKey("demo-user")) === "1" ? "profile" : "intro");
  }

  async function generatePlan() {
    setError(null);
    setFeedbackConfirmation(null);
    setPlanTradeoff(null);
    const trimmedFirstName = runnerProfile.firstName?.trim() ?? "";

    if (trimmedFirstName !== runnerProfile.firstName) {
      setRunnerProfile((current) => ({ ...current, firstName: trimmedFirstName }));
    }

    if (!isValidTargetTime(goal.targetTime ?? "")) {
      setError("Ugyldigt tidsformat. Brug mm:ss eller hh:mm:ss, fx 30:00 eller 1:55:00.");
      return;
    }

    if (!goal.availableTrainingDays || goal.availableTrainingDays.length === 0) {
      setError("Vælg mindst én træningsdag for at generere programmet.");
      return;
    }

    if (!isValidIsoDate(goal.startDate)) {
      setError("Vælg en gyldig startdato, før jeg bygger programmet.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runnerProfile,
          goal,
          profileId: isDemoMode ? undefined : profileId || undefined,
          runsPerWeek: goal.availableTrainingDays.length,
          demoMode: isDemoMode,
        }),
      });

      if (!res.ok) {
        const problem = (await res.json().catch(() => null)) as { message?: string; warnings?: string[] } | null;
        if (problem?.message) {
          const warningText = problem.warnings?.length ? ` ${problem.warnings.join(" ")}` : "";
          setError(`${problem.message}${warningText}`);
          return;
        }
        throw new Error("Fejl under generering af plan.");
      }

      const data = (await res.json()) as {
        plan: TrainingPlan;
        baselinePlan?: TrainingPlan;
        currentPlanView?: TrainingPlan;
        runnerProfileInsights?: RunnerProfileInsights;
        feedbackInsights?: FeedbackInsights[];
        persistence?: { profileId?: string };
        warnings?: string[];
        safetyAdjustments?: Array<{ type: string; detail: string }>;
        feasibleStatus?: "feasible" | "feasible_with_adjustments" | "not_feasible";
        tradeoffExplanation?: string;
      };

      const nextBaseline = data.baselinePlan ?? data.plan;
      const nextCurrent = data.currentPlanView ?? data.plan;
      setBaselinePlan(nextBaseline);
      setPlan(nextCurrent);
      setRunnerProfileInsights(data.runnerProfileInsights ?? null);
      setFeedbackInsights(data.feedbackInsights?.[0] ?? null);
      setAdjustmentLog([]);
      setPlanWarnings(data.warnings ?? []);
      setSafetyAdjustments((data.safetyAdjustments ?? []).map((entry) => entry.detail));
      setShowAllSafety(false);
      setPlanTradeoff(data.tradeoffExplanation ?? null);
      setPlanFeasibilityStatus(data.feasibleStatus ?? "feasible");
      setSelectedSessionId(nextCurrent.sessions[0]?.id ?? "");
      const storageUserId = authUser?.id ?? (isDemoMode ? "demo-user" : data.persistence?.profileId ?? profileId);

      if (data.persistence?.profileId) {
        setProfileId(data.persistence.profileId);
        if (storageUserId) {
          window.localStorage.setItem(profileKey(storageUserId), data.persistence.profileId);
        }
      }

      if (storageUserId && trimmedFirstName) {
        window.localStorage.setItem(firstNameKey(storageUserId), trimmedFirstName);
      }
      if (storageUserId) {
        window.localStorage.removeItem(programSeenKey(storageUserId));
      }

      setHasSetup(true);
      if (storageUserId) {
        window.localStorage.setItem(setupKey(storageUserId), "1");
      }
      setStage("intermezzo");
    } catch {
      setError("Kunne ikke generere plan lige nu.");
    } finally {
      setIsLoading(false);
    }
  }

  function applyLocalAdaptation(factor: number, insights?: FeedbackInsights | null) {
    if (!plan || !activeSession) return;

    const currentSessionIdx = plan.sessions.findIndex((s) => s.id === activeSession.id);
    if (currentSessionIdx === -1) return;
    const pauseWeeks = insights?.progressionPauseWeeks ?? 0;
    const targetWeekLimit = pauseWeeks > 0 ? activeSession.week + pauseWeeks : activeSession.week + 1;
    const currentLongestRun = Math.max(
      ...activeSession.steps.filter((step) => step.type === "run").map((step) => step.durationSec),
      30,
    );

    const updated: TrainingPlan = {
      ...plan,
      sessions: plan.sessions.map((session, sessionIdx) => {
        if (sessionIdx <= currentSessionIdx) return session;
        if (session.week > targetWeekLimit) return session;

        return {
          ...session,
          loadScore:
            insights?.adjustment === "hold_progression"
              ? Math.min(session.loadScore, activeSession.loadScore)
              : clampInt(session.loadScore * factor, 1, 10),
          steps: session.steps.map((step) => {
            if (step.type !== "run") return step;
            return {
              ...step,
              durationSec:
                insights?.adjustment === "hold_progression"
                  ? clampDuration(Math.min(step.durationSec, currentLongestRun))
                  : clampDuration(step.durationSec * factor),
            };
          }),
        };
      }),
    };

    setPlan(updated);
    setAdjustmentLog((prev) => [
      ...prev,
      insights?.adjustment === "insert_recovery"
        ? "Jeg lægger mere restitution ind i de kommende pas, så kroppen kan følge med."
        : insights?.adjustment === "hold_progression"
          ? "Jeg holder progressionen lidt tilbage, så du kan bygge videre uden at forcere noget."
          : factor < 1
            ? "Jeg dæmper de kommende pas en smule, så du kan holde en god rytme i træningen."
            : factor > 1
              ? "Jeg skruer en anelse op i de kommende pas, fordi kroppen ser ud til at følge med."
              : "Jeg lader planen fortsætte som planlagt.",
    ]);
  }

  async function submitFeedback() {
    if (!activeSession || !profileId) {
      setError("Mangler aktivt pas eller profil.");
      return;
    }

    if (feedbackSubmitState === "submitting") return;

    setError(null);
    setFeedbackSubmitState("submitting");
    try {
      const res = await fetch("/api/workout-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId,
          workoutSessionId: activeSession.id,
          quickFeedback: feedback.quickFeedback,
          ...feedback,
          notes: feedback.notes?.trim() ?? "",
          demoMode: isDemoMode,
        }),
      });

      if (!res.ok) {
        setFeedbackSubmitState("idle");
        setError("Kunne ikke gemme feedback.");
        return;
      }

      const data = (await res.json()) as {
        adaptationFactor: number;
        feedbackInsights?: FeedbackInsights;
        note?: string;
        confirmation?: { title?: string };
        interpretation?: string;
        adjustmentExplanation?: string;
        adjustmentSummary?: string[];
      };
      setFeedbackInsights(data.feedbackInsights ?? null);
      applyLocalAdaptation(data.adaptationFactor, data.feedbackInsights ?? null);
      setFeedbackConfirmation({
        title:
          runnerProfile.firstName?.trim()
            ? `Tak for din feedback, ${runnerProfile.firstName.trim()}.`
            : data.confirmation?.title ?? "Tak for din feedback.",
        message: "",
        interpretation: data.interpretation ?? "Jeg vurderer passet ud fra din feedback.",
        adjustment: data.adjustmentExplanation ?? "Derfor holder jeg progressionen stabil lige nu.",
        bullets: [],
      });
      if (data.adjustmentSummary?.length) {
        setAdjustmentLog((prev) => [...prev, ...(data.adjustmentSummary ?? [])]);
      }
      setFeedback({ quickFeedback: undefined, effort: 6, completionPct: 100, energy: 3, painLevel: 1, notes: "" });
      setShowDetailedFeedback(false);
      setFeedbackSubmitState("success");
      if (feedbackSuccessTimeout.current) {
        clearTimeout(feedbackSuccessTimeout.current);
      }
      feedbackSuccessTimeout.current = setTimeout(() => {
        setFeedbackSubmitState("idle");
      }, 2400);
    } catch {
      setFeedbackSubmitState("idle");
      setError("Kunne ikke gemme feedback.");
    }
  }

  async function downloadIcs() {
    if (!plan) return;

    const res = await fetch("/api/calendar/ics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plan,
        startDate: goal.startDate,
        startTime: goal.reminderTime ?? "13:00",
        calendarName: `Løbeplan ${goal.distance}`,
      }),
    });

    if (!res.ok) {
      setError("Kunne ikke oprette kalenderfil.");
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "stridepilot-plan.ics";
    link.click();
    URL.revokeObjectURL(url);
  }

  const canOpenAuthenticatedPages = Boolean(authUser);
  const canOpenProgram = Boolean(authUser && hasSetup);
  const canOpenWorkout = Boolean(plan);

  function completeIntro() {
    if (authUser?.id) {
      window.localStorage.setItem(introSeenKey(authUser.id), "1");
    }
    setStage("profile");
  }

  function openProgramFromIntermezzo() {
    const storageUserId = authUser?.id ?? (isDemoMode ? "demo-user" : profileId || "");
    setIsProgramTransitioning(true);
    window.setTimeout(() => {
      if (storageUserId) {
        window.localStorage.setItem(programSeenKey(storageUserId), "1");
      }
      setShowProgramIntro(false);
      setStage("program");
      setIsProgramTransitioning(false);
    }, 700);
  }

  function openStage(nextStage: Stage) {
    setStage(nextStage);
    setMenuOpen(false);
  }

  function openWorkoutSession(sessionId: string) {
    setSelectedSessionId(sessionId);
    setStage("workout");
  }

  function toggleTrainingDay(day: WorkoutSession["dayOfWeek"]) {
    setGoal((current) => {
      const currentDays = current.availableTrainingDays ?? [];
      const exists = currentDays.includes(day);
      if (exists) {
        return { ...current, availableTrainingDays: currentDays.filter((item) => item !== day) };
      }
      return { ...current, availableTrainingDays: [...currentDays, day] };
    });
  }

  function goToStep(index: number) {
    if (!activeSession) return;
    const safeIndex = clampInt(index, 0, activeSession.steps.length - 1);
    setIsRunning(false);
    cancelCue();
    setStepIndex(safeIndex);
    setRemainingSec(activeSession.steps[safeIndex].durationSec);
    setWorkoutCompleted(false);
    setCueFallbackText(buildCue(activeSession.steps[safeIndex], audioMode));
    lastSpokenStepKey.current = "";
    thirtySecCueKey.current = "";
  }

  function nextStep() {
    if (!activeSession) return;
    const wasRunning = isRunning;
    setCompletedSteps((prev) => (prev.includes(stepIndex) ? prev : [...prev, stepIndex]));
    if (stepIndex >= activeSession.steps.length - 1) {
      finishWorkout();
      return;
    }
    cancelCue();
    const next = stepIndex + 1;
    setStepNotice("Interval afsluttet");
    setStepIndex(next);
    setRemainingSec(activeSession.steps[next].durationSec);
    setCueFallbackText(buildCue(activeSession.steps[next], audioMode));
    lastSpokenStepKey.current = "";
    thirtySecCueKey.current = "";
    setIsRunning(wasRunning);
  }

  function previousStep() {
    if (!activeSession) return;
    goToStep(Math.max(stepIndex - 1, 0));
  }

  function setVisibleWeek(nextWeek: number, options?: { scrollIntoView?: boolean }) {
    setDisplayWeek(nextWeek);

    if (options?.scrollIntoView) {
      window.setTimeout(() => {
        programWeekRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 0);
    }
  }

  const contextualHeader =
    stage === "program"
      ? { title: "Dit program", subtitle: `Uge ${weekNumber}` }
      : stage === "workout"
        ? {
            title: activeSession ? `Uge ${activeSession.week} · ${shortSessionTitle(activeSession.title)}` : "Intervalpas",
            subtitle: "Fokusér på næste interval",
          }
        : stage === "auth"
          ? {
              title: `Velkommen til ${APP_NAME}`,
              subtitle: "Dit adaptive løbeprogram der udvikler sig sammen med dig",
            }
        : {
            title: APP_NAME,
            subtitle: "Din AI løbecoach",
          };
  const programAdjustments = [...safetyAdjustments, ...adjustmentLog];
  const visibleSafetyAdjustments = showAllSafety ? programAdjustments : programAdjustments.slice(0, 3);
  const hasMoreSafetyAdjustments = programAdjustments.length > 3;
  const isLastWorkoutStep = Boolean(activeSession && stepIndex === activeSession.steps.length - 1);
  const nextStepLabel = isLastWorkoutStep ? "Afslut pas" : "Næste interval";
  const onboardingSteps = 5;
  const goalSummaryDate =
    goalDestinationSession &&
    sessionDateFromPlan(goal.startDate, goalDestinationSession).toLocaleDateString("da-DK", {
      day: "numeric",
      month: "short",
    });
  const todayDuration = todaySession ? Math.round(sessionTotalDurationSec(todaySession) / 60) : 0;
  const nextDuration = nextSession ? Math.round(sessionTotalDurationSec(nextSession) / 60) : 0;
  const profileInsightSummary =
    runnerProfileInsights?.progressionStrategy.style === "conservative"
      ? "Jeg har lagt planen roligt ud, så du kan bygge sikkert op fra start."
      : runnerProfileInsights?.progressionStrategy.style === "aggressive"
        ? "Jeg har lagt planen an med lidt mere fart i progressionen, men stadig inden for en kontrolleret ramme."
        : runnerProfileInsights
          ? "Jeg har lagt planen an med en stabil progression, der passer til dit udgangspunkt."
          : null;
  const greeting = runnerProfile.firstName?.trim() ? `Hej ${runnerProfile.firstName.trim()}` : "Hej";
  const stickyProgramCtaLabel = todaySession || nextSession ? "Start næste pas" : null;
  const whyPlanLines = useMemo(
    () =>
      programWhySummary({
        runnerProfile,
        goal,
        insights: runnerProfileInsights,
        planTradeoff,
      }),
    [goal, planTradeoff, runnerProfile, runnerProfileInsights],
  );
  const planIntermezzo = useMemo(
    () =>
      intermezzoSummary({
        runnerProfile,
        goal,
        insights: runnerProfileInsights,
        recommendation: trainingDayRecommendation,
        planFeasibilityStatus,
        planTradeoff,
      }),
    [goal, planFeasibilityStatus, planTradeoff, runnerProfile, runnerProfileInsights, trainingDayRecommendation],
  );
  const isOnboardingStepValid =
    onboardingStep === 2
      ? onboardingSelections.runningAbility
      : onboardingStep === 3
        ? onboardingSelections.goalDistance && isValidTargetTime(goal.targetTime ?? "")
        : onboardingStep === 4
          ? onboardingSelections.activityLevel && Boolean(goal.availableTrainingDays?.length) && isValidIsoDate(goal.startDate)
          : true;
  const completedWorkoutCoach = useMemo(
    () =>
      postWorkoutCoachMessage({
        firstName: runnerProfile.firstName,
        session: activeSession,
      }),
    [activeSession, runnerProfile.firstName],
  );

  useEffect(() => {
    if (stage !== "program" || !stickyProgramCtaLabel) {
      setShowStickyProgramCta(false);
      return;
    }

    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(max-width: 720px)");
    const ctaNode = todayPrimaryCtaRef.current;

    if (!mediaQuery.matches) {
      setShowStickyProgramCta(false);
      return;
    }

    if (!ctaNode) {
      setShowStickyProgramCta(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        const shouldShow = !entry.isIntersecting;
        setShowStickyProgramCta((current) => (current === shouldShow ? current : shouldShow));
      },
      {
        root: null,
        rootMargin: "0px 0px 120px 0px",
        threshold: 0.12,
      },
    );

    observer.observe(ctaNode);

    function syncStickyVisibility(matches: boolean) {
      if (!matches) {
        setShowStickyProgramCta(false);
        return;
      }
      if (!ctaNode) {
        setShowStickyProgramCta(true);
        return;
      }
      const rect = ctaNode.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const shouldShow = rect.top > viewportHeight - 120 || rect.bottom < 0;
      setShowStickyProgramCta((current) => (current === shouldShow ? current : shouldShow));
    }

    function handleMediaChange(event: MediaQueryListEvent) {
      syncStickyVisibility(event.matches);
    }

    syncStickyVisibility(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleMediaChange);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener("change", handleMediaChange);
    };
  }, [stage, stickyProgramCtaLabel, todaySession?.id, nextSession?.id]);

  return (
    <main className={`${styles.page} ${effectiveTheme === "light" ? styles.pageLight : styles.pageDark}`}>
      <section className={styles.menuContainer}>
        <button
          className={styles.burgerBtn}
          aria-label="Åbn menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          ☰
        </button>
        {menuOpen && (
          <div className={styles.menuDropdown}>
            <button className={stage === "welcome" ? styles.menuBtnActive : styles.menuBtn} onClick={() => openStage("welcome")}>
              Velkomst
            </button>
            <button className={stage === "auth" ? styles.menuBtnActive : styles.menuBtn} onClick={() => openStage("auth")}>
              Konto
            </button>
            <button
              className={stage === "profile" ? styles.menuBtnActive : styles.menuBtn}
              onClick={() => openStage("profile")}
              disabled={!canOpenAuthenticatedPages}
            >
              Rediger profil og mål
            </button>
            <button
              className={stage === "program" ? styles.menuBtnActive : styles.menuBtn}
              onClick={() => openStage("program")}
              disabled={!canOpenProgram}
            >
              Program
            </button>
            <button
              className={stage === "workout" ? styles.menuBtnActive : styles.menuBtn}
              onClick={() => openStage("workout")}
              disabled={!canOpenWorkout}
            >
              Pas
            </button>
            <div className={styles.audioSettings}>
              <p className={styles.menuLabel}>Tale-cues</p>
              <div className={styles.audioModeRow}>
                <button className={audioMode === "off" ? styles.audioModeActive : styles.audioModeBtn} onClick={() => setAudioMode("off")} type="button">
                  Off
                </button>
                <button className={audioMode === "short" ? styles.audioModeActive : styles.audioModeBtn} onClick={() => setAudioMode("short")} type="button">
                  Short
                </button>
                <button className={audioMode === "coach" ? styles.audioModeActive : styles.audioModeBtn} onClick={() => setAudioMode("coach")} type="button">
                  Coach
                </button>
              </div>
            </div>
            <div className={styles.audioSettings}>
              <p className={styles.menuLabel}>Udseende</p>
              <div className={styles.audioModeRow}>
                <button className={appearance === "light" ? styles.audioModeActive : styles.audioModeBtn} onClick={() => setAppearance("light")} type="button">
                  Lys
                </button>
                <button className={appearance === "dark" ? styles.audioModeActive : styles.audioModeBtn} onClick={() => setAppearance("dark")} type="button">
                  Mørk
                </button>
                <button className={appearance === "system" ? styles.audioModeActive : styles.audioModeBtn} onClick={() => setAppearance("system")} type="button">
                  Automatisk
                </button>
              </div>
            </div>
            <button
              className={styles.menuBtn}
              onClick={() => {
                downloadIcs();
                setMenuOpen(false);
              }}
              disabled={!plan}
            >
              Download .ics
            </button>
            {authUser && (
              <button
                className={styles.menuBtn}
                onClick={() => {
                  logout();
                  setMenuOpen(false);
                }}
              >
                Log ud
              </button>
            )}
          </div>
        )}
      </section>

      {stage !== "welcome" && stage !== "auth" && stage !== "intro" && stage !== "workout" && stage !== "program" && (
        <section className={styles.hero}>
          <h1>{contextualHeader.title}</h1>
          <p className={styles.heroSub}>{contextualHeader.subtitle}</p>
          {isDemoMode && <p className={styles.demoBadge}>Demo-tilstand · data gemmes ikke permanent</p>}
        </section>
      )}

      {stage === "welcome" && (
        <section className={styles.welcomeHero}>
          <div className={styles.welcomeOverlay}>
            <div className={styles.welcomeBody}>
              <h1>{APP_NAME}</h1>
              <p>Din AI løbecoach</p>
              <button className={styles.primaryBtn} onClick={startFlow}>
                Kom i gang
              </button>
              <button className={styles.secondaryBtn} onClick={startDemoMode}>
                Prøv demo
              </button>
              <p className={styles.subtleInline}>Test appen uden at oprette en konto.</p>
            </div>
          </div>
        </section>
      )}

      {stage === "auth" && (
        <section className={styles.authHero}>
          <div className={styles.authOverlay}>
            <section className={styles.centerCard}>
              <h2>Velkommen til {APP_NAME}</h2>
              <p className={styles.subtle}>Dit adaptive løbeprogram der udvikler sig sammen med dig</p>

              <div className={styles.formGrid}>
                <label>
                  E-mailadresse
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </label>
                <label>
                  Adgangskode
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </label>
              </div>

              {authMode === "signup" ? (
                <div className={styles.authActions}>
                  <button className={styles.primaryBtn} onClick={register}>
                    Opret gratis konto
                  </button>
                  <p className={styles.authDivider}>eller</p>
                  <button className={styles.secondaryBtn} onClick={startDemoMode}>
                    Prøv demo
                  </button>
                  <p className={styles.subtleInline}>Test StridePilot uden at oprette en konto</p>
                  <p className={styles.subtleInline}>
                    Har du allerede en konto?{" "}
                    <button className={styles.textBtn} onClick={() => setAuthMode("login")}>
                      Log ind
                    </button>
                  </p>
                </div>
              ) : (
                <div className={styles.authActions}>
                  <button className={styles.primaryBtn} onClick={login}>
                    Log ind
                  </button>
                  <p className={styles.authDivider}>eller</p>
                  <button className={styles.secondaryBtn} onClick={startDemoMode}>
                    Prøv demo
                  </button>
                  <p className={styles.subtleInline}>Test StridePilot uden at oprette en konto</p>
                  <p className={styles.subtleInline}>
                    Ny her?{" "}
                    <button className={styles.textBtn} onClick={() => setAuthMode("signup")}>
                      Opret gratis konto
                    </button>
                  </p>
                </div>
              )}
            </section>
          </div>
        </section>
      )}

      {stage === "intro" && (
        <section className={styles.centerCard}>
          <h2>Velkommen til StridePilot</h2>
          <p className={styles.subtle}>StridePilot bygger dit løbeprogram fra dag 1 og justerer det løbende efter din feedback.</p>
          <ul className={styles.bulletList}>
            <li>Du får et samlet program frem mod dit mål</li>
            <li>Programmet tilpasses efter dine træningspas</li>
            <li>Appen guider dig gennem hvert interval</li>
          </ul>
          <div className={styles.topActions}>
            <button className={styles.primaryBtn} onClick={completeIntro}>
              Kom i gang
            </button>
          </div>
        </section>
      )}

      {stage === "profile" && (
        <section className={`${styles.card} ${styles.onboardingCard}`}>
          <div className={styles.onboardingHeader}>
            <h2>Byg dit personlige løbeprogram</h2>
            <p className={styles.onboardingIntro}>Et par hurtige svar, så laver {APP_NAME} et program, der passer til dig.</p>
          </div>
          <div className={styles.onboardingProgress}>
            <p className={styles.nextLabel}>Trin {onboardingStep} af {onboardingSteps}</p>
            <div className={styles.progressTrack}>
              <div className={styles.progressFill} style={{ width: `${(onboardingStep / onboardingSteps) * 100}%` }} />
            </div>
          </div>

          {onboardingStep === 1 && (
            <div className={styles.sectionBlock}>
              <h3>Fortæl lidt om dig selv</h3>
              <p className={styles.subtleInline}>Hvor er du i din løbetræning lige nu, og hvad vil du gerne opnå?</p>
              <div className={styles.formGrid}>
                <label>
                  <span>Hvad skal jeg kalde dig?</span>
                  <input
                    type="text"
                    value={runnerProfile.firstName ?? ""}
                    onChange={(e) => setRunnerProfile((current) => ({ ...current, firstName: e.target.value.trimStart() }))}
                    onBlur={(e) => setRunnerProfile((current) => ({ ...current, firstName: e.target.value.trim() }))}
                    placeholder="Fx Anders"
                  />
                  <small className={styles.fieldHint}>Jeg bruger navnet i coach-oplevelsen i appen.</small>
                </label>
                <label>
                  <span>Din situation lige nu</span>
                  <textarea
                    rows={5}
                    value={runnerProfile.userTrainingContext ?? ""}
                    onChange={(e) => setRunnerProfile((p) => ({ ...p, userTrainingContext: e.target.value }))}
                    placeholder="Skriv kort om dine mål, udfordringer eller hvad du gerne vil blive bedre til."
                  />
                  <small className={styles.fieldHint}>Du kan skrive frit. Det hjælper StridePilot med at forstå dine mål og udfordringer.</small>
                </label>
              </div>
            </div>
          )}

          {onboardingStep === 2 && (
            <div className={styles.sectionBlock}>
              <h3>Hvad kan du realistisk løbe lige nu?</h3>
              <div className={styles.abilityGrid}>
                {CURRENT_RUNNING_ABILITY_OPTIONS.map((option) => {
                  const active = onboardingSelections.runningAbility && runnerProfile.currentRunningAbility === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={active ? styles.abilityCardActive : styles.abilityCard}
                      onClick={() => {
                        setRunnerProfile((p) => ({ ...p, currentRunningAbility: option.value }));
                        setOnboardingSelections((current) => ({ ...current, runningAbility: true }));
                      }}
                    >
                      <span className={styles.choiceCheck} aria-hidden="true">{active ? "✓" : ""}</span>
                      <span className={styles.choiceText}>{option.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className={styles.infoRow}>
                <button type="button" className={styles.infoBtn} onClick={() => setOpenInfoField((field) => (field === "currentRunningAbility" ? null : "currentRunningAbility"))}>
                  i
                </button>
                <span>Hvordan bruges det?</span>
              </div>
              {openInfoField === "currentRunningAbility" && <small className={styles.infoTextBox}>{INFO_TEXT.currentRunningAbility}</small>}
            </div>
          )}

          {onboardingStep === 3 && (
            <div className={styles.sectionBlock}>
              <h3>Dit mål</h3>
              <p className={styles.subtleInline}>Vælg den distance, du træner frem imod, og tilføj en tid hvis du har et konkret mål.</p>
              <div className={styles.choiceGrid}>
                {GOAL_DISTANCE_OPTIONS.map((option) => {
                  const active = onboardingSelections.goalDistance && goal.distance === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={active ? styles.choiceCardActive : styles.choiceCard}
                      onClick={() => {
                        setGoal((g) => ({ ...g, distance: option.value }));
                        setOnboardingSelections((current) => ({ ...current, goalDistance: true }));
                      }}
                    >
                      <span className={styles.choiceCheck} aria-hidden="true">{active ? "✓" : ""}</span>
                      <span className={styles.choiceText}>{option.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className={styles.formGrid}>
                <label>
                  <span className={styles.labelRow}>
                    Mål-tid (mm:ss eller hh:mm:ss)
                    <button type="button" className={styles.infoBtn} onClick={() => setOpenInfoField((field) => (field === "targetTime" ? null : "targetTime"))}>
                      i
                    </button>
                  </span>
                  <input
                    type="text"
                    placeholder="fx 30:00 eller 1:55:00"
                    value={goal.targetTime ?? ""}
                    onChange={(e) => setGoal((g) => ({ ...g, targetTime: e.target.value }))}
                  />
                  <small className={styles.fieldHint}>Valgfrit — skriv din ønskede sluttid, hvis du har et konkret mål.</small>
                  {openInfoField === "targetTime" && <small className={styles.infoTextBox}>{INFO_TEXT.targetTime}</small>}
                </label>
              </div>
              {goal.targetTime && !isValidTargetTime(goal.targetTime) && <p className={styles.warningText}>Brug formatet mm:ss eller hh:mm:ss.</p>}
            </div>
          )}

          {onboardingStep === 4 && (
            <div className={styles.sectionBlock}>
              <h3>Træningsrammer</h3>
              <p className={styles.subtleInline}>Her fastlægger du, hvor hurtigt programmet skal bygges op, og hvornår du realistisk kan træne.</p>
              <div className={styles.formGrid}>
                <label>
                  <span className={styles.labelRow}>
                    Antal uger
                    <button type="button" className={styles.infoBtn} onClick={() => setOpenInfoField((field) => (field === "weeks" ? null : "weeks"))}>
                      i
                    </button>
                  </span>
                  <input
                    type="number"
                    min={12}
                    max={52}
                    value={goalWeeksDraft}
                    onChange={(e) => {
                      const value = e.target.value;
                      setGoalWeeksDraft(value);
                      if (value !== "") setGoal((g) => ({ ...g, weeks: clampInt(Number(value), 12, 52) }));
                    }}
                    onBlur={() => {
                      if (goalWeeksDraft === "") setGoalWeeksDraft(String(goal.weeks));
                    }}
                  />
                  {openInfoField === "weeks" && <small className={styles.infoTextBox}>{INFO_TEXT.weeks}</small>}
                </label>
                <label>
                  Startdato
                  <input
                    type="date"
                    value={goal.startDate}
                    onChange={(e) => setGoal((g) => ({ ...g, startDate: e.target.value }))}
                    aria-invalid={!isValidIsoDate(goal.startDate)}
                  />
                  <small className={styles.fieldHint}>Programmet starter fra denne dato, og uge 1 tager udgangspunkt i den.</small>
                </label>
                <label>
                  Foretrukket tidspunkt
                  <input type="time" value={goal.reminderTime ?? "13:00"} onChange={(e) => setGoal((g) => ({ ...g, reminderTime: e.target.value }))} />
                </label>
              </div>
              <div className={styles.trainingDays}>
                <p className={styles.daysLabel}>
                  Aktivitetsniveau
                  <button type="button" className={styles.infoBtn} onClick={() => setOpenInfoField((field) => (field === "activityLevel" ? null : "activityLevel"))}>
                    i
                  </button>
                </p>
                <div className={styles.choiceGrid}>
                  {ACTIVITY_LEVEL_OPTIONS.map((option) => {
                    const active = onboardingSelections.activityLevel && runnerProfile.activityLevel === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={active ? styles.choiceCardActive : styles.choiceCard}
                        onClick={() => {
                          setRunnerProfile((p) => ({ ...p, activityLevel: option.value }));
                          setOnboardingSelections((current) => ({ ...current, activityLevel: true }));
                        }}
                      >
                        <span className={styles.choiceCheck} aria-hidden="true">{active ? "✓" : ""}</span>
                        <span className={styles.choiceText}>{option.label}</span>
                      </button>
                    );
                  })}
                </div>
                <small className={styles.fieldHint}>{ACTIVITY_LEVEL_INFO[runnerProfile.activityLevel]}</small>
                {openInfoField === "activityLevel" && <small className={styles.infoTextBox}>{INFO_TEXT.activityLevel}</small>}
              </div>
              <div className={styles.trainingDays}>
                <p className={styles.daysLabel}>
                  Tilgængelige træningsdage
                  <button type="button" className={styles.infoBtn} onClick={() => setOpenInfoField((field) => (field === "availableTrainingDays" ? null : "availableTrainingDays"))}>
                    i
                  </button>
                </p>
                <p className={styles.subtleInline}>Vælg de dage hvor du realistisk kan træne.</p>
                <p className={styles.recommendationText}>{trainingDayRecommendation.message}</p>
                {trainingDayRecommendation.caution && <p className={styles.fieldHint}>{trainingDayRecommendation.caution}</p>}
                {openInfoField === "availableTrainingDays" && <small className={styles.infoTextBox}>{INFO_TEXT.availableTrainingDays}</small>}
                <div className={styles.daysGrid}>
                  {WEEK_DAY_NAMES.map((day) => {
                    const active = goal.availableTrainingDays?.includes(day);
                    return (
                      <button key={`day-${day}`} type="button" className={active ? styles.dayChipActive : styles.dayChip} onClick={() => toggleTrainingDay(day)}>
                        <span className={styles.choiceCheck} aria-hidden="true">{active ? "✓" : ""}</span>
                        <span className={styles.choiceText}>{DAY_LABEL[day]}</span>
                      </button>
                    );
                  })}
                </div>
                {(goal.availableTrainingDays?.length ?? 0) < requiredRunsPerWeek(goal.distance) && (
                  <p className={styles.warningText}>Du har valgt færre træningsdage end programmet normalt kræver. Programmet kan blive mindre effektivt eller kræve en længere tidshorisont.</p>
                )}
                {(goal.availableTrainingDays?.length ?? 0) < trainingDayRecommendation.recommendedDays && (
                  <p className={styles.warningText}>Du har valgt færre træningsdage end den aktuelle anbefaling. Programmet kan stadig fungere, men vil ofte kræve mere tid eller en roligere progression.</p>
                )}
                {!isValidIsoDate(goal.startDate) && <p className={styles.warningText}>Vælg en gyldig startdato for at gå videre.</p>}
              </div>
            </div>
          )}

          {onboardingStep === 5 && (
            <div className={styles.sectionBlock}>
              <h3>Personlige oplysninger</h3>
              <p className={styles.subtleInline}>Disse oplysninger hjælper med at gøre belastning og progression mere realistisk.</p>
              <div className={styles.formGrid}>
                <label>
                  Højde (cm)
                  <input
                    type="number"
                    value={profileDraft.heightCm}
                    onChange={(e) => {
                      const value = e.target.value;
                      setProfileDraft((d) => ({ ...d, heightCm: value }));
                      if (value !== "") setRunnerProfile((p) => ({ ...p, heightCm: clampInt(Number(value), 1, 300) }));
                    }}
                    onBlur={() => {
                      if (profileDraft.heightCm === "") setProfileDraft((d) => ({ ...d, heightCm: String(runnerProfile.heightCm) }));
                    }}
                  />
                </label>
                <label>
                  Vægt (kg)
                  <input
                    type="number"
                    value={profileDraft.weightKg}
                    onChange={(e) => {
                      const value = e.target.value;
                      setProfileDraft((d) => ({ ...d, weightKg: value }));
                      if (value !== "") setRunnerProfile((p) => ({ ...p, weightKg: clampInt(Number(value), 1, 400) }));
                    }}
                    onBlur={() => {
                      if (profileDraft.weightKg === "") setProfileDraft((d) => ({ ...d, weightKg: String(runnerProfile.weightKg) }));
                    }}
                  />
                </label>
                <label>
                  Alder
                  <input
                    type="number"
                    value={profileDraft.age}
                    onChange={(e) => {
                      const value = e.target.value;
                      setProfileDraft((d) => ({ ...d, age: value }));
                      if (value !== "") setRunnerProfile((p) => ({ ...p, age: clampInt(Number(value), 1, 120) }));
                    }}
                    onBlur={() => {
                      if (profileDraft.age === "") setProfileDraft((d) => ({ ...d, age: String(runnerProfile.age) }));
                    }}
                  />
                </label>
              </div>
              <div className={styles.trainingDays}>
                <p className={styles.daysLabel}>Køn (valgfrit)</p>
                <div className={styles.choiceGrid}>
                  {GENDER_OPTIONS.map((option) => {
                    const active = runnerProfile.gender === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={active ? styles.choiceCardActive : styles.choiceCard}
                        onClick={() => setRunnerProfile((p) => ({ ...p, gender: active ? undefined : option.value }))}
                      >
                        <span className={styles.choiceCheck} aria-hidden="true">{active ? "✓" : ""}</span>
                        <span className={styles.choiceText}>{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div className={styles.onboardingNav}>
            <button className={styles.secondaryBtn} type="button" onClick={() => setOnboardingStep((step) => Math.max(1, step - 1))} disabled={onboardingStep === 1}>
              Forrige
            </button>
            {onboardingStep < onboardingSteps ? (
              <button className={styles.primaryBtn} type="button" onClick={() => setOnboardingStep((step) => Math.min(onboardingSteps, step + 1))} disabled={!isOnboardingStepValid}>
                Næste
              </button>
            ) : (
              <button className={styles.primaryBtn} onClick={generatePlan} disabled={isLoading}>
                {isLoading ? "Genererer program..." : "Start mit program"}
              </button>
            )}
          </div>
        </section>
      )}

      {stage === "intermezzo" && (
        <section className={`${styles.centerCard} ${styles.intermezzoCard}`}>
          <p className={styles.nextLabel}>Jeg har forstået dit udgangspunkt sådan her</p>
          <h2>{planIntermezzo.title}</h2>
          <p className={styles.subtle}>{planIntermezzo.summary}</p>

          <div className={styles.intermezzoReason}>
            <h3>Derfor starter planen her</h3>
            <p className={styles.subtleInline}>{planIntermezzo.rationale}</p>
          </div>

          <div className={styles.intermezzoGrid}>
            {planIntermezzo.bullets.map((item) => (
              <div key={item.label} className={styles.intermezzoItem}>
                <p>{item.label}</p>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>

          <p className={styles.subtleInline}>Jeg justerer løbende programmet ud fra din feedback, så progressionen bliver ved med at give mening.</p>

          <div className={styles.topActions}>
            <button
              className={styles.secondaryBtn}
              onClick={() => {
                setStage("profile");
              }}
            >
              Ret min profil
            </button>
            <button className={styles.primaryBtn} onClick={openProgramFromIntermezzo}>
              Se mit program
            </button>
          </div>
        </section>
      )}

      {stage === "program" && (
        <section className={styles.grid}>
          <article className={styles.card}>
            {plan && (
              <>
                <div className={styles.programHeaderBlock}>
                  <p className={styles.nextLabel}>Dit program</p>
                  <h2>Uge {weekNumber} af {plan.weeks}</h2>
                  <p className={styles.subtle}>{goal.distance} · {goalSummaryDate ?? "Måldag"}</p>
                  <div className={styles.progressTrack}><div className={styles.progressFill} style={{ width: `${(weekNumber / plan.weeks) * 100}%` }} /></div>
                  <p className={styles.subtleInline}>Du træner frem mod {goal.distance} {goalSummaryDate ? `· ${goalSummaryDate}` : ""}</p>
                  {isDemoMode && <p className={styles.demoBadge}>Demo-mode aktiv</p>}
                </div>
                {showProgramIntro && (
                  <div className={styles.programIntroBlock}>
                    <p className={styles.subtleInline}>Her er dit samlede program frem mod målet.</p>
                    {profileInsightSummary && <p className={styles.subtleInline}>{profileInsightSummary}</p>}
                    {baselinePlan && <p className={styles.subtleInline}>Programmet er oprettet fra dag 1 og danner grundlaget for din træning.</p>}
                  </div>
                )}
                <div className={styles.planWhyCard}>
                  <h3>Hvorfor planen ser sådan ud</h3>
                  {whyPlanLines.map((line, index) => (
                    <p key={`why-${index}`} className={styles.subtleInline}>
                      {line}
                    </p>
                  ))}
                </div>
                {planFeasibilityStatus === "feasible_with_adjustments" && planTradeoff && (
                  <div className={styles.tradeoffCard}>
                    <h3>Planen er tilpasset dine rammer</h3>
                    <p className={styles.subtleInline}>{planTradeoff}</p>
                  </div>
                )}
              </>
            )}

            <div className={styles.todayCard}>
              <p className={styles.todayGreeting}>{greeting}</p>
              <p className={styles.nextLabel}>I dag skal du</p>
              <h3 className={!todaySession ? styles.restDayTitle : undefined}>{todaySession ? shortSessionTitle(todaySession.title) : "Hviledag"}</h3>
              {todaySession ? (
                <>
                  <p className={styles.todayMeta}>{todayDuration} min</p>
                  <p className={styles.todayDescription}>{intervalSummary(todaySession)}</p>
                  <p className={styles.todaySupport}>{sessionShortDescription(todaySession)}</p>
                </>
              ) : (
                <>
                  <p className={styles.restDayBadge}>Restitution</p>
                  <p className={styles.todayDescription}>I dag er en restitutionsdag.</p>
                  <p className={styles.todaySupport}>Ingen planlagt løbetræning. Brug dagen til restitution eller let bevægelse.</p>
                </>
              )}
              {todaySession ? (
                <button
                  ref={todayPrimaryCtaRef}
                  className={styles.primaryBtn}
                  onClick={() => {
                    openWorkoutSession(todaySession.id);
                  }}
                >
                  Start næste pas
                </button>
              ) : nextSession ? (
                <button
                  ref={todayPrimaryCtaRef}
                  className={styles.primaryBtn}
                  onClick={() => {
                    openWorkoutSession(nextSession.id);
                  }}
                >
                  Start næste pas
                </button>
              ) : null}
            </div>

            {nextSession && (
              <div className={styles.nextCard}>
                <p className={styles.nextLabel}>Næste pas</p>
                <p className={styles.subtleInline}>{formatDanishDateWithWeekday(sessionDateFromPlan(goal.startDate, nextSession))}</p>
                <h3>{shortSessionTitle(nextSession.title)} · {nextDuration} min</h3>
                <p className={styles.subtleInline}>{intervalSummary(nextSession)}</p>
                <p className={styles.subtle}>{sessionShortDescription(nextSession)}</p>
                <button
                  className={styles.primaryBtn}
                  onClick={() => {
                    openWorkoutSession(nextSession.id);
                  }}
                >
                  Start næste pas
                </button>
              </div>
            )}

            {plan && (
              <div className={styles.progressSummaryGrid}>
                <div className={styles.valueCard}>
                  <p>Ugens træningsload</p>
                  <strong>{currentWeekLoad ? currentWeekLoad.load.toFixed(1).replace(".", ",") : "0,0"}</strong>
                </div>
                <div className={styles.valueCard}>
                  <p>Længste sammenhængende løb</p>
                  <strong>{formatMinutesLabel(longestRunNow)}</strong>
                </div>
                <div className={styles.valueCard}>
                  <p>Måldag</p>
                  <strong>{goalDestinationSession ? shortSessionTitle(goalDestinationSession.title) : "—"}</strong>
                </div>
              </div>
            )}

            {plan && currentWeeklyLoad.length > 0 && (
              <div className={styles.chartCard}>
                <div className={styles.labelRow}>
                  <h3>Sådan udvikler programmet sig</h3>
                  <button type="button" className={styles.infoBtn} onClick={() => setOpenInfoField((field) => (field === "graph" ? null : "graph"))}>
                    i
                  </button>
                </div>
                {openInfoField === "graph" && <p className={styles.infoText}>{INFO_TEXT.graph}</p>}
                <div className={styles.chartMetaRow}>
                  <span className={styles.chartActiveWeek}>Valgt uge: U{displayWeek}</span>
                  <span className={styles.chartMetaHint}>Tryk på en uge for at åbne den i programmet</span>
                </div>
                <div className={styles.barRow}>
                  {currentWeeklyLoad.map((point) => (
                    <button
                      key={`load-${point.week}`}
                      type="button"
                      className={point.week === displayWeek ? styles.barColActive : styles.barCol}
                      onClick={() => setVisibleWeek(point.week, { scrollIntoView: true })}
                      aria-pressed={point.week === displayWeek}
                      aria-current={point.week === displayWeek ? "true" : undefined}
                      aria-label={`Vis uge ${point.week}`}
                      title={`Vis uge ${point.week}`}
                    >
                      <div className={styles.barTrackMini}>
                        <div className={styles.barFillMini} style={{ height: `${(point.load / maxWeeklyLoad) * 100}%` }} />
                      </div>
                      <span className={point.week === displayWeek ? styles.barLabelActive : undefined}>U{point.week}</span>
                    </button>
                  ))}
                </div>
                <svg viewBox={`0 0 ${graphSeries.width} ${graphSeries.height}`} className={styles.lineChart} role="img" aria-label="Oprindelig og nuværende plan">
                  <path d={graphSeries.baselinePath} className={styles.baselinePath} />
                  <path d={graphSeries.currentPath} className={styles.currentPath} />
                </svg>
                <div className={styles.chartLegend}>
                  <span className={styles.chartLegendItem}>
                    <i className={styles.baselineDot} />
                    <span>
                      <strong className={styles.chartLegendLabel}>Oprindelig plan</strong>
                      <small className={styles.chartLegendHint}>Programmet som det så ud fra start</small>
                    </span>
                  </span>
                  <span className={styles.chartLegendItem}>
                    <i className={styles.currentDot} />
                    <span>
                      <strong className={styles.chartLegendLabel}>Nuværende plan</strong>
                      <small className={styles.chartLegendHint}>Planen efter dine justeringer</small>
                    </span>
                  </span>
                </div>
              </div>
            )}

            {plan && (
              <div ref={programWeekRef}>
              <div className={styles.topActions}>
                <button className={styles.secondaryBtn} onClick={() => setVisibleWeek(Math.max(1, displayWeek - 1))} disabled={displayWeek <= 1}>
                  Forrige uge
                </button>
                <span className={styles.weekLabel}>Uge {displayWeek}</span>
                <button className={styles.secondaryBtn} onClick={() => setVisibleWeek(Math.min(plan.weeks, displayWeek + 1))} disabled={displayWeek >= plan.weeks}>
                  Næste uge
                </button>
              </div>
              </div>
            )}

            <div className={styles.weekCalendar}>
              {calendarWeekDates.map((date) => {
                const daySession = sessionsByDate.get(date.toISOString().slice(0, 10));
                const isToday = date.toDateString() === new Date().toDateString();
                const isGoalDay = Boolean(daySession && /Måldag|test/i.test(daySession.title));
                return (
                  <button
                    key={date.toISOString()}
                    className={isGoalDay ? styles.dayCardGoal : isToday ? styles.dayCardToday : styles.dayCard}
                    onClick={() => {
                      if (daySession) {
                        setSelectedSessionId(daySession.id);
                        setStage("workout");
                      } else {
                        setRestDayPrompt({ dateLabel: formatDanishDateWithWeekday(date), showIdeas: false });
                      }
                    }}
                  >
                    <strong>{formatDanishDateWithWeekday(date)}</strong>
                    {daySession ? (
                      <span>
                        {daySession.title} · {intensityFromLoad(daySession.loadScore)}
                        {daySession.week % 4 === 0 ? " · Restitutionsuge" : ""}
                        {/Måldag|test/i.test(daySession.title) ? " · Måldag" : ""}
                      </span>
                    ) : (
                      <span>Hvile</span>
                    )}
                  </button>
                );
              })}
            </div>

            {restDayPrompt && (
              <div className={styles.tradeoffCard}>
                <h3>Hviledag</h3>
                <p className={styles.subtleInline}>I dag er planlagt som hviledag. Vil du have forslag til andre gode aktiviteter?</p>
                <p className={styles.subtleInline}>{restDayPrompt.dateLabel}</p>
                <div className={styles.topActions}>
                  <button className={styles.secondaryBtn} type="button" onClick={() => setRestDayPrompt({ ...restDayPrompt, showIdeas: true })}>
                    Ja
                  </button>
                  <button className={styles.secondaryBtn} type="button" onClick={() => setRestDayPrompt(null)}>
                    Nej
                  </button>
                </div>
                {restDayPrompt.showIdeas && (
                  <ul className={styles.bulletList}>
                    <li>Gåtur</li>
                    <li>Mobilitet</li>
                    <li>Let styrketræning</li>
                    <li>Rolig cykling</li>
                  </ul>
                )}
              </div>
            )}

            {(planWarnings.length > 0 || programAdjustments.length > 0) && (
              <div className={styles.safetyCard}>
                <h3>Programjusteringer</h3>
                <p className={styles.subtleInline}>Her kan du se de vigtigste ændringer, der er lavet i dit program.</p>
                {programAdjustments.length > 0 && (
                  <p className={styles.subtleInline}>
                    {programAdjustments.length} justering{programAdjustments.length === 1 ? "" : "er"} er lavet undervejs.
                  </p>
                )}
                {planWarnings.length > 0 && (
                  <ul className={styles.bulletList}>
                    {planWarnings.map((warning, index) => (
                      <li key={`warning-${index}`}>{warning}</li>
                    ))}
                  </ul>
                )}
                {visibleSafetyAdjustments.length > 0 && (
                  <ul className={styles.bulletList}>
                    {visibleSafetyAdjustments.map((item, index) => (
                      <li key={`safety-${index}`}>{coachAdjustmentCopy(item)}</li>
                    ))}
                  </ul>
                )}
                {hasMoreSafetyAdjustments && (
                  <button className={styles.textBtn} type="button" onClick={() => setShowAllSafety((value) => !value)}>
                    {showAllSafety ? "Vis mindre" : "Vis mere"}
                  </button>
                )}
              </div>
            )}

            <div className={styles.insightCard}>
              <h3>Indsigter (kommer snart)</h3>
              <p className={styles.subtleInline}>VO2max-estimat: {EMPTY_INSIGHTS.vo2maxEstimate ?? "—"}</p>
              <p className={styles.subtleInline}>Fatigue score: {EMPTY_INSIGHTS.fatigueScore ?? "—"}</p>
              <p className={styles.subtleInline}>Progression prediction: {EMPTY_INSIGHTS.progressionPrediction ?? "—"}</p>
            </div>
          </article>

          {stickyProgramCtaLabel && (
            <div className={`${styles.programStickyCta} ${!showStickyProgramCta ? styles.programStickyCtaHidden : ""}`}>
              <div className={styles.programStickyInner}>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={() => {
                    if (todaySession) {
                      openWorkoutSession(todaySession.id);
                      return;
                    }
                    if (nextSession) {
                      openWorkoutSession(nextSession.id);
                    }
                  }}
                >
                  {stickyProgramCtaLabel}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {stage === "workout" && (
        <section className={styles.workoutHero}>
          <div className={styles.workoutOverlay}>
        <section className={styles.grid}>
          <article className={styles.card}>
            {!activeSession && <p>Vælg et pas i programmet først.</p>}
            {activeSession && currentStep && !workoutCompleted && (
              <>
                <h2>{`Uge ${activeSession.week} · ${shortSessionTitle(activeSession.title)}`}</h2>
                <p className={styles.ttsStatus}>
                  {audioMode === "off" ? "Tale-cues er slået fra." : ttsSupported ? "Tale-cues aktive." : "Tale-cues ikke tilgængelige. Viser tekst-cues."}
                </p>
                <div className={styles.workoutPrimaryAction}>
                  <button
                    className={styles.primaryBtn}
                    onClick={() => {
                      setIsRunning((v) => {
                        const next = !v;
                        if (!next) cancelCue();
                        if (next && !speechEnabled && audioMode !== "off") {
                          const initialized = initSpeech();
                          setSpeechEnabled(initialized);
                          setTtsSupported(isSpeechSupported());
                        }
                        if (audioMode === "off") {
                          setSpeechEnabled(false);
                        }
                        return next;
                      });
                    }}
                  >
                    {isRunning ? "Pause" : "Start"}
                  </button>
                </div>
                <p className={styles.phaseLabel}>{phaseName(currentStep).toUpperCase()}</p>
                <div className={styles.timerBig}>{formatClock(remainingSec)}</div>
                <p className={styles.instruction}>{coachingHint(currentStep)}</p>
                {audioMode !== "off" && cueFallbackText && (!ttsSupported || !speechEnabled) && <p className={styles.cueFallback}>{cueFallbackText}</p>}

                <div className={styles.progressTrack}>
                  <div className={styles.progressFill} style={{ width: `${stepProgress}%` }} />
                </div>
                <p className={styles.subtleStrong}>
                  Interval {stepIndex + 1} / {activeSession.steps.length}
                  {isLastWorkoutStep && <span className={styles.finalStepTag}>Sidste interval</span>}
                </p>
                {stepNotice && <p className={styles.stepNotice}>{stepNotice}</p>}

                <ul className={styles.stepOverview}>
                  {activeSession.steps.map((step, index) => {
                    const done = completedSteps.includes(index);
                    const marker = done ? "✓" : index === stepIndex ? "●" : "○";
                    return (
                      <li
                        key={`${step.label}-${index}`}
                        className={done ? styles.stepDone : index === stepIndex ? styles.stepCurrent : ""}
                      >
                        <button
                          type="button"
                          className={styles.stepJumpBtn}
                          onClick={() => goToStep(index)}
                          aria-label={`Gå til interval ${index + 1}`}
                          aria-current={index === stepIndex ? "step" : undefined}
                        >
                          <span>{marker}</span>
                          <span>{phaseName(step)}</span>
                          <span>{formatClock(step.durationSec)}</span>
                          <span>{index === stepIndex ? "Aktiv" : done ? "Udført" : "Kommende"}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>

                <div className={styles.topActions}>
                  <button className={styles.secondaryBtn} onClick={previousStep} disabled={stepIndex === 0}>
                    Forrige interval
                  </button>
                  <button
                    className={isLastWorkoutStep ? styles.completeWorkoutBtn : styles.secondaryBtn}
                    onClick={nextStep}
                  >
                    {nextStepLabel}
                  </button>
                </div>
              </>
            )}
            {activeSession && workoutCompleted && (
              <div className={styles.completedWorkoutCard}>
                <p className={styles.confirmationBadge}>Pas afsluttet</p>
                <h2>Godt arbejde — passet er gennemført</h2>
                <p className={styles.subtle}>Fortæl kort hvordan passet føltes, så jeg kan justere det næste skridt i programmet.</p>
                <div className={styles.postWorkoutCoachCard}>
                  <h3>{completedWorkoutCoach.title}</h3>
                  <p className={styles.subtleInline}>{completedWorkoutCoach.body}</p>
                </div>
                <div className={styles.completedWorkoutStats}>
                  <span>{shortSessionTitle(activeSession.title)}</span>
                  <span>{activeSession.steps.length} intervaller gennemført</span>
                </div>
              </div>
            )}
          </article>

          {workoutCompleted && (
            <article className={styles.card}>
              <p className={styles.confirmationBadge}>{feedbackSubmitted ? "Coach-respons" : "Din feedback"}</p>
              <h2>{feedbackSubmitted ? feedbackConfirmation?.title ?? "Tak for din feedback." : "Hvordan føltes passet?"}</h2>
              <p className={styles.subtle}>
                {feedbackSubmitted ? "Jeg har set din feedback og tilpasset den næste del af planen." : "Din feedback hjælper mig med at tilpasse programmet."}
              </p>
              {feedbackConfirmation && (
                <div className={styles.confirmationCard}>
                  <p className={styles.subtleInline}>{feedbackConfirmation.interpretation}</p>
                  <p className={styles.subtleInline}>{feedbackConfirmation.adjustment}</p>
                  <div className={styles.confirmationActions}>
                    <button
                      type="button"
                      className={styles.primaryBtn}
                      onClick={() => {
                        setIsRunning(false);
                        setStage("program");
                      }}
                    >
                      Se opdateret program
                    </button>
                  </div>
                </div>
              )}

              {!feedbackSubmitted && (
              <>
              <div className={styles.quickFeedbackGrid}>
                {QUICK_FEEDBACK_OPTIONS.map((option) => {
                  const active = feedback.quickFeedback === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={active ? styles.quickFeedbackCardActive : styles.quickFeedbackCard}
                      onClick={() => {
                        const preset = quickFeedbackPreset(option.value);
                        setFeedback((current) => ({
                          ...current,
                          quickFeedback: option.value,
                          ...preset,
                        }));
                        setFeedbackDraft((draft) => ({
                          ...draft,
                          effort: String(preset.effort),
                          completionPct: String(preset.completionPct),
                          energy: String(preset.energy),
                          painLevel: String(preset.painLevel),
                        }));
                      }}
                    >
                      <span className={styles.choiceCheck} aria-hidden="true">{active ? "✓" : ""}</span>
                      <span className={styles.choiceText}>{option.label}</span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                className={styles.textBtn}
                onClick={() => setShowDetailedFeedback((current) => !current)}
              >
                {showDetailedFeedback ? "Skjul detaljer" : "Tilføj flere detaljer"}
              </button>

              {showDetailedFeedback && (
              <div className={styles.formGrid}>
              <label>
                Oplevet belastning (1–10)
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={feedbackDraft.effort}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFeedbackDraft((d) => ({ ...d, effort: value }));
                    if (value !== "") setFeedback((f) => ({ ...f, effort: clampInt(Number(value), 1, 10) }));
                  }}
                  onBlur={() => {
                    if (feedbackDraft.effort === "") setFeedbackDraft((d) => ({ ...d, effort: String(feedback.effort) }));
                  }}
                />
              </label>
              <label>
                Gennemført %
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={feedbackDraft.completionPct}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFeedbackDraft((d) => ({ ...d, completionPct: value }));
                    if (value !== "") setFeedback((f) => ({ ...f, completionPct: clampInt(Number(value), 0, 100) }));
                  }}
                  onBlur={() => {
                    if (feedbackDraft.completionPct === "") setFeedbackDraft((d) => ({ ...d, completionPct: String(feedback.completionPct) }));
                  }}
                />
              </label>
              <label>
                Energi (1–5)
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={feedbackDraft.energy}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFeedbackDraft((d) => ({ ...d, energy: value }));
                    if (value !== "") setFeedback((f) => ({ ...f, energy: clampInt(Number(value), 1, 5) }));
                  }}
                  onBlur={() => {
                    if (feedbackDraft.energy === "") setFeedbackDraft((d) => ({ ...d, energy: String(feedback.energy) }));
                  }}
                />
              </label>
              <label>
                Smerte (1–10)
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={feedbackDraft.painLevel}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFeedbackDraft((d) => ({ ...d, painLevel: value }));
                    if (value !== "") setFeedback((f) => ({ ...f, painLevel: clampInt(Number(value), 1, 10) }));
                  }}
                  onBlur={() => {
                    if (feedbackDraft.painLevel === "") setFeedbackDraft((d) => ({ ...d, painLevel: String(feedback.painLevel) }));
                  }}
                />
              </label>
              <label>
                Noter
                <input type="text" value={feedback.notes} onChange={(e) => setFeedback((f) => ({ ...f, notes: e.target.value }))} placeholder="Kort note om passet" />
              </label>
              </div>
              )}

              <div className={styles.topActions}>
                <button
                  className={styles.primaryBtn}
                  onClick={submitFeedback}
                  disabled={!activeSession || !profileId || !workoutCompleted || feedbackSubmitState === "submitting" || !feedback.quickFeedback}
                >
                  {feedbackSubmitState === "submitting" && <span className={styles.buttonSpinner} aria-hidden="true" />}
                  {feedbackSubmitState === "submitting"
                    ? "Gemmer..."
                    : feedbackSubmitState === "success"
                      ? "Feedback gemt ✓"
                      : "Gem feedback"}
                </button>
              </div>
              </>
              )}
            </article>
          )}
        </section>
          </div>
        </section>
      )}

      {(isLoading || isProgramTransitioning) && (
        <section className={styles.loadingHero}>
          <div className={styles.loadingOverlay}>
            <div className={styles.spinner} />
            <p>{isProgramTransitioning ? "Jeg bygger dit program..." : "Jeg samler dit program..."}</p>
            <small>{isProgramTransitioning ? "Gør den sidste coach-opsummering klar." : "Jeg lægger dine første uger på plads ud fra dit mål og dit nuværende niveau."}</small>
          </div>
        </section>
      )}
      {error && <p className={styles.error}>{error}</p>}
    </main>
  );
}
