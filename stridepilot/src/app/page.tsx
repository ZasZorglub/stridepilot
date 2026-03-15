"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";
import { CurrentRunningAbility, Goal, RunnerProfile, TrainingPlan, WorkoutFeedbackInput, WorkoutSession, WorkoutStep } from "@/lib/types";
import { APP_NAME } from "@/lib/app-config";
import { cancelCue, initSpeech, isSpeechSupported, speakCue } from "@/lib/speech-coach";
import { EMPTY_INSIGHTS } from "@/lib/insights";
import { normalizeStepDuration } from "@/lib/duration";
import { buildWeeklyLoad } from "@/lib/plan";

type Stage = "welcome" | "auth" | "intro" | "profile" | "program" | "workout";
type AuthMode = "signup" | "login";
type AudioMode = "off" | "short" | "coach";
type ThemePref = "system" | "dark" | "light";
type InfoField = "targetTime" | "runningExperience" | "activityLevel" | "availableTrainingDays" | "weeks" | "currentRunningAbility" | "graph" | null;

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

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);

  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }

  return output;
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
  monday.setDate(monday.getDate() + offset);
  return monday;
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

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("welcome");
  const [authMode, setAuthMode] = useState<AuthMode>("signup");
  const [hasSetup, setHasSetup] = useState(false);
  const [displayWeek, setDisplayWeek] = useState(1);
  const [appearance, setAppearance] = useState<ThemePref>("system");
  const [effectiveTheme, setEffectiveTheme] = useState<"dark" | "light">("dark");
  const [onboardingStep, setOnboardingStep] = useState(1);

  const [runnerProfile, setRunnerProfile] = useState<RunnerProfile>({
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
  const [adjustmentLog, setAdjustmentLog] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");

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

  const [feedback, setFeedback] = useState<WorkoutFeedbackInput>({
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
  const feedbackCardRef = useRef<HTMLElement | null>(null);
  const [restDayPrompt, setRestDayPrompt] = useState<{ dateLabel: string; showIdeas: boolean } | null>(null);

  const activeSession = useMemo(
    () => plan?.sessions.find((session) => session.id === selectedSessionId) ?? null,
    [plan, selectedSessionId],
  );
  const currentStep = activeSession?.steps[stepIndex];
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
    const weekAnchor = new Date(startDate);
    weekAnchor.setDate(startDate.getDate() + (displayWeek - 1) * 7);
    const monday = startOfIsoWeek(weekAnchor);

    return Array.from({ length: 7 }).map((_, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      return date;
    });
  }, [goal.startDate, displayWeek]);

  const sessionsByDay = useMemo(() => {
    if (!plan) return new Map<WorkoutSession["dayOfWeek"], WorkoutSession>();
    const byDay = new Map<WorkoutSession["dayOfWeek"], WorkoutSession>();
    const weekSessions = plan.sessions.filter((s) => s.week === displayWeek);
    weekSessions.forEach((session) => byDay.set(session.dayOfWeek, session));
    return byDay;
  }, [plan, displayWeek]);

  const nextSession = useMemo(() => {
    if (!plan) return null;

    const today = new Date();
    const todayDay = today.getDay();

    const sorted = [...plan.sessions].sort((a, b) => {
      if (a.week !== b.week) return a.week - b.week;
      return DAY_INDEX[a.dayOfWeek] - DAY_INDEX[b.dayOfWeek];
    });

    const upcoming = sorted.find((s) => s.week > weekNumber || (s.week === weekNumber && DAY_INDEX[s.dayOfWeek] >= todayDay));
    return upcoming ?? sorted[0] ?? null;
  }, [plan, weekNumber]);
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

  useEffect(() => {
    const setupDone = window.localStorage.getItem("runnerCoachHasSetup") === "1";
    setHasSetup(setupDone);
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
        const hasProfile = Boolean(meData.profileId);
        setHasSetup(hasProfile);
        if (hasProfile && meData.profileId) {
          setProfileId(meData.profileId);
          window.localStorage.setItem("runnerCoachProfileId", meData.profileId);
          window.localStorage.setItem("runnerCoachHasSetup", "1");
          setStage("program");
        } else {
          window.localStorage.removeItem("runnerCoachHasSetup");
          setStage(window.localStorage.getItem(introSeenKey(meData.user.id)) === "1" ? "profile" : "intro");
        }
      }
    }

    bootstrapAuth().catch(() => undefined);

    const localProfileId = window.localStorage.getItem("runnerCoachProfileId") ?? "";
    if (localProfileId) {
      setProfileId(localProfileId);
    }

    const demoMode = window.localStorage.getItem("stridepilotDemoMode") === "1";
    if (demoMode) {
      setIsDemoMode(true);
      setAuthUser({ id: "demo-user", email: "demo@stridepilot.app", isDemo: true });
      setProfileId("demo-profile");
      setStage(setupDone ? "program" : window.localStorage.getItem(introSeenKey("demo-user")) === "1" ? "profile" : "intro");
    }
  }, []);

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
    if (stage === "profile") {
      setOnboardingStep(1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [stage]);

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
    setAuthUser(data.user);
    setStatus("Konto oprettet.");
    setHasSetup(false);
    window.localStorage.removeItem("runnerCoachHasSetup");
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
    setAuthUser(data.user);

    let hasProfile = false;
    const meRes = await fetch("/api/auth/me");
    if (meRes.ok) {
      const meData = (await meRes.json()) as { profileId?: string | null };
      if (meData.profileId) {
        hasProfile = true;
        setProfileId(meData.profileId);
        window.localStorage.setItem("runnerCoachProfileId", meData.profileId);
        window.localStorage.setItem("runnerCoachHasSetup", "1");
      }
    }

    setStatus("Logget ind.");
    setHasSetup(hasProfile);
    if (!hasProfile) {
      window.localStorage.removeItem("runnerCoachHasSetup");
    }
    setStage(hasProfile ? "program" : window.localStorage.getItem(introSeenKey(data.user.id)) === "1" ? "profile" : "intro");
  }

  async function logout() {
    setError(null);
    if (!isDemoMode) {
      await fetch("/api/auth/logout", { method: "POST" });
    }
    setAuthUser(null);
    setIsDemoMode(false);
    setHasSetup(false);
    setProfileId("");
    window.localStorage.removeItem("runnerCoachHasSetup");
    window.localStorage.removeItem("runnerCoachProfileId");
    window.localStorage.removeItem("stridepilotDemoMode");
    setStatus("Logget ud.");
    setStage("auth");
  }

  function startDemoMode() {
    setError(null);
    setStatus("Demo-tilstand aktiv.");
    setAuthUser({ id: "demo-user", email: "demo@stridepilot.app", isDemo: true });
    setIsDemoMode(true);
    setHasSetup(false);
    setProfileId("demo-profile");
    setBaselinePlan(null);
    setPlan(null);
    setAdjustmentLog([]);
    setFeedbackConfirmation(null);
    setPlanTradeoff(null);
    setPlanWarnings([]);
    setSafetyAdjustments([]);
    setSelectedSessionId("");
    window.localStorage.setItem("stridepilotDemoMode", "1");
    window.localStorage.removeItem("runnerCoachHasSetup");
    window.localStorage.removeItem("runnerCoachProfileId");
    setStage(window.localStorage.getItem(introSeenKey("demo-user")) === "1" ? "profile" : "intro");
  }

  async function generatePlan() {
    setError(null);
    setStatus("");
    setFeedbackConfirmation(null);
    setPlanTradeoff(null);

    if (!isValidTargetTime(goal.targetTime ?? "")) {
      setError("Ugyldigt tidsformat. Brug mm:ss eller hh:mm:ss, fx 30:00 eller 1:55:00.");
      return;
    }

    if (!goal.availableTrainingDays || goal.availableTrainingDays.length === 0) {
      setError("Vælg mindst én træningsdag for at generere programmet.");
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
      setAdjustmentLog([]);
      setPlanWarnings(data.warnings ?? []);
      setSafetyAdjustments((data.safetyAdjustments ?? []).map((entry) => entry.detail));
      setShowAllSafety(false);
      setPlanTradeoff(data.tradeoffExplanation ?? null);
      setPlanFeasibilityStatus(data.feasibleStatus ?? "feasible");
      setSelectedSessionId(nextCurrent.sessions[0]?.id ?? "");

      if (data.persistence?.profileId) {
        setProfileId(data.persistence.profileId);
        window.localStorage.setItem("runnerCoachProfileId", data.persistence.profileId);
      }

      setHasSetup(true);
      window.localStorage.setItem("runnerCoachHasSetup", "1");
      setStage("program");
    } catch {
      setError("Kunne ikke generere plan lige nu.");
    } finally {
      setIsLoading(false);
    }
  }

  function applyLocalAdaptation(factor: number) {
    if (!plan || !activeSession) return;

    const currentSessionIdx = plan.sessions.findIndex((s) => s.id === activeSession.id);
    if (currentSessionIdx === -1) return;

    const updated: TrainingPlan = {
      ...plan,
      sessions: plan.sessions.map((session, sessionIdx) => {
        if (sessionIdx <= currentSessionIdx) return session;

        return {
          ...session,
          loadScore: clampInt(session.loadScore * factor, 1, 10),
          steps: session.steps.map((step) => {
            if (step.type !== "run") return step;
            return {
              ...step,
              durationSec: clampDuration(step.durationSec * factor),
            };
          }),
        };
      }),
    };

    setPlan(updated);
    setAdjustmentLog((prev) => [
      ...prev,
      factor < 1
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
        note?: string;
        confirmation?: { title?: string; message?: string };
        interpretation?: string;
        adjustmentExplanation?: string;
        adjustmentSummary?: string[];
      };
      applyLocalAdaptation(data.adaptationFactor);
      setFeedbackConfirmation({
        title: data.confirmation?.title ?? "Tak — din feedback er modtaget",
        message: data.confirmation?.message ?? "Jeg har opdateret dit program ud fra din feedback.",
        interpretation:
          data.interpretation ?? "Jeg bruger din feedback til at vurdere den næste træning.",
        adjustment:
          data.adjustmentExplanation ?? "Jeg har justeret programmet ud fra din belastning, energi og gennemførelse.",
        bullets:
          data.adjustmentSummary && data.adjustmentSummary.length > 0
            ? data.adjustmentSummary
            : [data.note ?? "Din feedback er modtaget. Der var ikke behov for at ændre næste pas."],
      });
      if (data.adjustmentSummary?.length) {
        setAdjustmentLog((prev) => [...prev, ...(data.adjustmentSummary ?? [])]);
      }
      setStatus("");
      setFeedback({ effort: 6, completionPct: 100, energy: 3, painLevel: 1, notes: "" });
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

  async function subscribePush() {
    setError(null);

    if (!profileId) {
      setError("Generer en plan for at oprette profil først.");
      return;
    }

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setError("Din browser understøtter ikke Web Push.");
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setError("Push-tilladelse blev ikke givet.");
      return;
    }

    try {
      const keyRes = await fetch("/api/push/vapid-public-key");
      if (!keyRes.ok) throw new Error("Manglende public key");
      const { publicKey } = (await keyRes.json()) as { publicKey: string };

      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(publicKey) as BufferSource,
      });

      const saveRes = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, subscription }),
      });

      if (!saveRes.ok) throw new Error("Kunne ikke gemme subscription");
      setStatus("Reminders er aktiveret på denne enhed.");
    } catch {
      setError("Kunne ikke aktivere reminders.");
    }
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

  function openStage(nextStage: Stage) {
    setStage(nextStage);
    setMenuOpen(false);
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

      {stage !== "welcome" && stage !== "auth" && stage !== "intro" && stage !== "workout" && (
        <section className={styles.hero}>
          <p className={styles.eyebrow}>{APP_NAME}</p>
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
        <section className={styles.card}>
          <h2>Byg dit personlige løbeprogram</h2>
          <p className={styles.subtle}>Svar på et par enkle spørgsmål — så laver {APP_NAME} et program, der passer til dig.</p>
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
          )}

          {onboardingStep === 2 && (
            <div className={styles.sectionBlock}>
              <h3>Hvad kan du realistisk løbe lige nu?</h3>
              <div className={styles.abilityGrid}>
                {CURRENT_RUNNING_ABILITY_OPTIONS.map((option) => {
                  const active = runnerProfile.currentRunningAbility === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={active ? styles.abilityCardActive : styles.abilityCard}
                      onClick={() => setRunnerProfile((p) => ({ ...p, currentRunningAbility: option.value }))}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <div className={styles.labelRow}>
                <span>Hvordan bruges det?</span>
                <button type="button" className={styles.infoBtn} onClick={() => setOpenInfoField((field) => (field === "currentRunningAbility" ? null : "currentRunningAbility"))}>
                  i
                </button>
              </div>
              {openInfoField === "currentRunningAbility" && <small className={styles.infoText}>{INFO_TEXT.currentRunningAbility}</small>}
            </div>
          )}

          {onboardingStep === 3 && (
            <div className={styles.sectionBlock}>
              <h3>Dit mål</h3>
              <p className={styles.subtleInline}>Vælg den distance, du træner frem imod, og tilføj en tid hvis du har et konkret mål.</p>
              <div className={styles.formGrid}>
                <label>
                  Distance
                  <select value={goal.distance} onChange={(e) => setGoal((g) => ({ ...g, distance: e.target.value as Goal["distance"] }))}>
                    <option value="5K">5 km</option>
                    <option value="10K">10 km</option>
                    <option value="Halvmaraton">Halvmaraton</option>
                    <option value="Marathon">Marathon</option>
                  </select>
                </label>
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
                  {openInfoField === "targetTime" && <small className={styles.infoText}>{INFO_TEXT.targetTime}</small>}
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
                  {openInfoField === "weeks" && <small className={styles.infoText}>{INFO_TEXT.weeks}</small>}
                </label>
                <label>
                  Hvor aktiv er du i hverdagen?
                  <select value={runnerProfile.activityLevel} onChange={(e) => setRunnerProfile((p) => ({ ...p, activityLevel: e.target.value as RunnerProfile["activityLevel"] }))}>
                    <option value="meget_lav">Meget lav</option>
                    <option value="lav">Lav</option>
                    <option value="moderat">Moderat</option>
                    <option value="høj">Høj</option>
                    <option value="meget_høj">Meget høj</option>
                  </select>
                  <small className={styles.fieldHint}>{ACTIVITY_LEVEL_INFO[runnerProfile.activityLevel]}</small>
                </label>
                <label>
                  Startdato
                  <input type="date" value={goal.startDate} onChange={(e) => setGoal((g) => ({ ...g, startDate: e.target.value }))} />
                  <small className={styles.fieldHint}>Programmet starter fra denne dato.</small>
                </label>
                <label>
                  Reminder
                  <input type="time" value={goal.reminderTime ?? "13:00"} onChange={(e) => setGoal((g) => ({ ...g, reminderTime: e.target.value }))} />
                </label>
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
                {openInfoField === "availableTrainingDays" && <small className={styles.infoText}>{INFO_TEXT.availableTrainingDays}</small>}
                <div className={styles.daysGrid}>
                  {WEEK_DAY_NAMES.map((day) => {
                    const active = goal.availableTrainingDays?.includes(day);
                    return (
                      <button key={`day-${day}`} type="button" className={active ? styles.dayChipActive : styles.dayChip} onClick={() => toggleTrainingDay(day)}>
                        {DAY_LABEL[day]}
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
                  Køn (valgfrit)
                  <select
                    value={runnerProfile.gender ?? ""}
                    onChange={(e) => setRunnerProfile((p) => ({ ...p, gender: e.target.value ? (e.target.value as RunnerProfile["gender"]) : undefined }))}
                  >
                    <option value="">Vælg hvis du vil</option>
                    <option value="kvinde">Kvinde</option>
                    <option value="mand">Mand</option>
                    <option value="andet">Andet</option>
                    <option value="vil_ikke_oplyse">Ønsker ikke at oplyse</option>
                  </select>
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
            </div>
          )}

          <div className={styles.onboardingNav}>
            <button className={styles.secondaryBtn} type="button" onClick={() => setOnboardingStep((step) => Math.max(1, step - 1))} disabled={onboardingStep === 1}>
              Forrige
            </button>
            {onboardingStep < onboardingSteps ? (
              <button className={styles.primaryBtn} type="button" onClick={() => setOnboardingStep((step) => Math.min(onboardingSteps, step + 1))}>
                Næste
              </button>
            ) : (
              <button className={styles.primaryBtn} onClick={generatePlan} disabled={isLoading}>
                {isLoading ? "Genererer program..." : "Start mit program"}
              </button>
            )}
          </div>
          <div className={styles.topActions}>
            <button className={styles.secondaryBtn} onClick={subscribePush} disabled={!profileId || isDemoMode}>
              Aktiver reminders
            </button>
          </div>
        </section>
      )}

      {stage === "program" && (
        <section className={styles.grid}>
          <article className={styles.card}>
            <h2>Dit program</h2>
            {plan && (
              <>
                <p className={styles.subtleStrong}>Uge {weekNumber} af {plan.weeks}</p>
                <p className={styles.subtle}>{goal.distance} · {goalSummaryDate ?? "Måldag"}</p>
                <p className={styles.subtle}>{plan.weeks} uger · {plan.sessionsPerWeek} pas om ugen</p>
                <div className={styles.progressTrack}><div className={styles.progressFill} style={{ width: `${(weekNumber / plan.weeks) * 100}%` }} /></div>
                <p className={styles.subtleInline}>Her er dit samlede program frem mod målet.</p>
                <p className={styles.subtleInline}>Jeg tilpasser det løbende ud fra din feedback.</p>
                {goalDestinationSession && (
                  <p className={styles.subtleInline}>
                    Du træner frem mod {goal.distance.toLowerCase()} · {formatDanishDateWithWeekday(sessionDateFromPlan(goal.startDate, goalDestinationSession))}
                  </p>
                )}
                {baselinePlan && <p className={styles.subtleInline}>Programmet er oprettet fra dag 1 og danner grundlaget for din træning.</p>}
                {adjustmentLog.length > 0 && <p className={styles.subtleInline}>Jeg har lavet {adjustmentLog.length} programjusteringer undervejs.</p>}
                {planFeasibilityStatus === "feasible_with_adjustments" && planTradeoff && (
                  <div className={styles.tradeoffCard}>
                    <h3>Planen er tilpasset dine rammer</h3>
                    <p className={styles.subtleInline}>{planTradeoff}</p>
                  </div>
                )}
              </>
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
                <div className={styles.barRow}>
                  {currentWeeklyLoad.map((point) => (
                    <div key={`load-${point.week}`} className={styles.barCol}>
                      <div className={styles.barTrackMini}>
                        <div className={styles.barFillMini} style={{ height: `${(point.load / maxWeeklyLoad) * 100}%` }} />
                      </div>
                      <span>U{point.week}</span>
                    </div>
                  ))}
                </div>
                <svg viewBox={`0 0 ${graphSeries.width} ${graphSeries.height}`} className={styles.lineChart} role="img" aria-label="Oprindelig og nuværende plan">
                  <path d={graphSeries.baselinePath} className={styles.baselinePath} />
                  <path d={graphSeries.currentPath} className={styles.currentPath} />
                </svg>
                <div className={styles.chartLegend}>
                  <span><i className={styles.baselineDot} /> Oprindelig plan</span>
                  <span><i className={styles.currentDot} /> Nuværende plan</span>
                </div>
              </div>
            )}

            <div className={styles.todayCard}>
              <p className={styles.nextLabel}>I dag</p>
              <h3>I dag skal du: {todaySession ? shortSessionTitle(todaySession.title) : "Hvile"}</h3>
              {todaySession ? (
                <>
                  <p className={styles.subtleInline}>{shortSessionTitle(todaySession.title)} · {todayDuration} min</p>
                  <p className={styles.subtleInline}>{intervalSummary(todaySession)}</p>
                  <p className={styles.subtleInline}>{sessionShortDescription(todaySession)}</p>
                </>
              ) : (
                <p className={styles.subtleInline}>Ingen planlagt løbetræning i dag. Brug dagen til restitution eller let bevægelse.</p>
              )}
              {todaySession ? (
                <button
                  className={styles.primaryBtn}
                  onClick={() => {
                    setSelectedSessionId(todaySession.id);
                    setStage("workout");
                  }}
                >
                  Start næste pas
                </button>
              ) : null}
            </div>

            {nextSession && (
              <div className={styles.nextCard}>
                <p className={styles.nextLabel}>Næste pas</p>
                <h3>Næste pas er {sessionDateFromPlan(goal.startDate, nextSession).toLocaleDateString("da-DK", { weekday: "long" }).toLowerCase()}</h3>
                <p className={styles.subtleInline}>{formatDanishDateWithWeekday(sessionDateFromPlan(goal.startDate, nextSession))}</p>
                <p className={styles.subtleInline}>{shortSessionTitle(nextSession.title)} · {nextDuration} min</p>
                <p className={styles.subtleInline}>{intervalSummary(nextSession)}</p>
                <p className={styles.subtle}>{sessionShortDescription(nextSession)}</p>
                <button
                  className={styles.primaryBtn}
                  onClick={() => {
                    setSelectedSessionId(nextSession.id);
                    setStage("workout");
                  }}
                >
                  Start næste pas
                </button>
              </div>
            )}

            {plan && (
              <div className={styles.topActions}>
                <button className={styles.secondaryBtn} onClick={() => setDisplayWeek((w) => Math.max(1, w - 1))} disabled={displayWeek <= 1}>
                  Forrige uge
                </button>
                <span className={styles.weekLabel}>Uge {displayWeek}</span>
                <button className={styles.secondaryBtn} onClick={() => setDisplayWeek((w) => Math.min(plan.weeks, w + 1))} disabled={displayWeek >= plan.weeks}>
                  Næste uge
                </button>
              </div>
            )}

            <div className={styles.weekCalendar}>
              {calendarWeekDates.map((date, idx) => {
                const dayName = WEEK_DAY_NAMES[idx];
                const daySession = sessionsByDay.get(dayName);
                const isToday = date.toDateString() === new Date().toDateString();
                const isGoalDay = Boolean(daySession && /Måldag|test/i.test(daySession.title));
                return (
                  <button
                    key={`${dayName}-${date.toISOString()}`}
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
                      <li key={`safety-${index}`}>{item}</li>
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
                <h2>Godt løbet — passet er gennemført</h2>
                <p className={styles.subtle}>Du kan nu give feedback, så {APP_NAME} kan justere dit program.</p>
                <div className={styles.completedWorkoutStats}>
                  <span>{shortSessionTitle(activeSession.title)}</span>
                  <span>{activeSession.steps.length} intervaller gennemført</span>
                </div>
                <div className={styles.confirmationActions}>
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    onClick={() => feedbackCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  >
                    Giv feedback
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={() => {
                      setIsRunning(false);
                      setStage("program");
                    }}
                  >
                    Tilbage til program
                  </button>
                </div>
              </div>
            )}
          </article>

          {workoutCompleted && (
            <article className={styles.card} ref={feedbackCardRef}>
              <p className={styles.confirmationBadge}>{feedbackSubmitted ? "Feedback sendt" : "Næste fase"}</p>
              <h2>{feedbackSubmitted ? "Tak — din feedback er modtaget" : "Hvordan gik passet?"}</h2>
              <p className={styles.subtle}>
                {feedbackSubmitted
                  ? `${APP_NAME} har opdateret dit program ud fra din feedback.`
                  : `Din feedback hjælper ${APP_NAME} med at tilpasse programmet.`}
              </p>
              {feedbackConfirmation && (
                <div className={styles.confirmationCard}>
                  <p className={styles.confirmationBadge}>Feedback gemt ✓</p>
                  <h3>{feedbackConfirmation.title}</h3>
                  <p className={styles.subtleInline}>{feedbackConfirmation.message}</p>
                  <p className={styles.subtleInline}>{feedbackConfirmation.interpretation}</p>
                  <p className={styles.subtleInline}>{feedbackConfirmation.adjustment}</p>
                  <ul className={styles.bulletList}>
                    {feedbackConfirmation.bullets.map((item, index) => (
                      <li key={`confirm-${index}`}>{item}</li>
                    ))}
                  </ul>
                  <p className={styles.subtleInline}>Dit program er nu opdateret ud fra din feedback.</p>
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
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      onClick={() => {
                        setIsRunning(false);
                        setStage("program");
                      }}
                    >
                      Tilbage til program
                    </button>
                  </div>
                </div>
              )}

              {!feedbackSubmitted && (
              <>
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

              <div className={styles.topActions}>
                <button
                  className={styles.primaryBtn}
                  onClick={submitFeedback}
                  disabled={!activeSession || !profileId || !workoutCompleted || feedbackSubmitState === "submitting"}
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

      {isLoading && (
        <section className={styles.loadingHero}>
          <div className={styles.loadingOverlay}>
            <div className={styles.spinner} />
            <p>Indlæser træning...</p>
          </div>
        </section>
      )}

      {status && <p className={styles.hint}>{status}</p>}
      {error && <p className={styles.error}>{error}</p>}
    </main>
  );
}
