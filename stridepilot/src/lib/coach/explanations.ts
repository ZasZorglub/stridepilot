import {
  AdaptationRationale,
  AmbitionAdjustmentRationale,
  GoalConfig,
  PlanAdjustment,
  PlanRationale,
  RunnerProfile,
  TrainingPlan,
  TrainingWeek,
  WeekRationale,
  WorkoutRationale,
  WorkoutSession,
} from "./types";
import { RunnerTraits } from "./capability";
import { SiteLocale } from "../site-variant";

function translateCoachExplanationLine(text: string, locale: SiteLocale = "da"): string {
  if (locale !== "en") return text;
  const normalized = text.trim();
  const exact: Record<string, string> = {
    "Du har håndteret den seneste progression stabilt, så planen kan bygge lidt mere tillidsfuldt videre.": "You have handled the recent progression steadily, so the plan can build a little more confidently.",
    "De seneste uger peger på, at kroppen reagerer bedst på lidt mere forsigtig progression.": "Recent weeks suggest that your body responds best to slightly more cautious progression.",
    "Dine seneste signaler peger på, at langturene skal bygges mere forsigtigt end resten af ugen.": "Your recent signals suggest that the long runs should build a little more cautiously than the rest of the week.",
    "Du har håndteret de længere ture godt, så langturen kan udvikles mere normalt igen.": "You have handled the longer runs well, so the long run can develop more normally again.",
    "Kvalitetspassene bliver holdt lidt mere kontrollerede, fordi de seneste signaler ikke peger på fuld tolerance endnu.": "The quality sessions are being kept a little more controlled because the recent signals do not point to full tolerance yet.",
    "Du har tålt den specifikke kvalitet godt, så planen kan bruge lidt mere målrettet kvalitet igen.": "You have handled the specific quality work well, so the plan can use a little more targeted quality again.",
    "Næste uge holder samme overordnede struktur som før.": "Next week keeps the same overall structure as before.",
    "Fokus nu er at komme tilbage med ro i kroppen og få rytmen tilbage uden at jage noget.": "The focus now is to come back with calm in the body and find your rhythm again without chasing anything.",
    "Fokus nu er at holde kvaliteten kontrolleret og få ugen til at føles mere bæredygtig.": "The focus now is to keep the quality controlled and make the week feel more sustainable.",
    "Fokus nu er at komme tilbage i normal rytme uden at hoppe direkte til den hårdeste progression.": "The focus now is to return to your normal rhythm without jumping straight back to the hardest progression.",
    "Fokus nu er at bruge overskuddet fornuftigt og ramme kvalitetspassene kontrolleret.": "The focus now is to use the surplus wisely and hit the quality sessions in a controlled way.",
    "Fokus nu er at fortsætte stabilt og lade kontinuiteten arbejde for dig.": "The focus now is to continue steadily and let consistency work for you.",
    "Du kom ikke helt gennem passet som planlagt.": "You did not get fully through the session as planned.",
    "Du afkortede passet undervejs.": "You shortened the session along the way.",
    "Det lød klart hårdere end det skulle være.": "It sounded clearly harder than it should have been.",
    "Passet lød hårdere end ønsket.": "The session sounded harder than intended.",
    "Energien var også lav.": "Energy was low as well.",
    "Du rapporterede desuden tydelig smerte eller uro.": "You also reported clear pain or discomfort.",
    "Der var også tegn på irritation eller forsigtighed.": "There were also signs of irritation or caution.",
    "Jeg gør næste uge klart lettere med mindre belastning og mere plads til restitution.": "I am making next week clearly lighter, with less load and more room for recovery.",
    "Jeg dæmper den næste uge lidt, så belastningen bliver mere bæredygtig.": "I am easing next week slightly so the load becomes more sustainable.",
    "Jeg bygger forsigtigt videre igen, men uden at hoppe direkte tilbage til fuld progression.": "I am building carefully again, but without jumping straight back to full progression.",
    "Jeg øger udfordringen en smule og holder den målrettet mod dit mål.": "I am increasing the challenge slightly and keeping it directed toward your goal.",
    "Jeg holder næste uge stabil, så planen fortsætter uden unødigt pres.": "I am keeping next week steady so the plan continues without unnecessary pressure.",
    "Næste skridt er en recovery-uge med mindre belastning og mere ro.": "Next comes a recovery week with less load and more calm.",
    "Næste skridt er en lidt lettere uge med mindre progressionstryk.": "Next comes a slightly lighter week with less progression pressure.",
    "Næste skridt er at komme tilbage i build på en kontrolleret måde.": "Next is a controlled return to building again.",
    "Næste skridt er en lidt mere målrettet uge, fordi de seneste signaler var stærke nok til det.": "Next is a slightly more targeted week because the recent signals were strong enough for that.",
    "Næste skridt er at holde rytmen og lade kontinuiteten arbejde.": "Next is to hold the rhythm and let consistency do the work.",
    "Passet så kontrolleret ud med fint overskud, så planen kan skrue lidt mere målrettet op.": "The session looked controlled with good headroom, so the plan can turn up slightly in a more targeted way.",
    "De seneste signaler peger på, at du er ved at finde rytmen igen.": "Recent signals suggest that you are finding your rhythm again.",
    "Passet ser samlet set ud til at passe godt ind i planen.": "Overall, the session looks like it fit the plan well.",
    "Næste skridt er at få kroppen tilbage i ro, før progressionen bygges videre.": "The next step is to let the body settle before progression builds again.",
    "Næste skridt er en mere forsigtig uge, så planen ikke accelererer på de forkerte signaler.": "The next step is a more cautious week so the plan does not accelerate on the wrong signals.",
  };
  if (exact[normalized]) return exact[normalized];
  return normalized
    .replace("Næste uge er gjort lettere samlet set", "Next week is lighter overall")
    .replace("Næste uge er gjort en smule mere krævende samlet set", "Next week is slightly more demanding overall")
    .replace("Langturen er kortet ned fra ca.", "The long run has been shortened from about")
    .replace("Langturen er justeret op fra ca.", "The long run has been adjusted up from about")
    .replace(" i loadscore", " in load score")
    .replace(" minutter.", " minutes.");
}

function abilityLine(profile: RunnerProfile): string {
  if (profile.currentRunsPerWeek >= 4 || profile.currentWeeklyVolumeKm >= 35) {
    return `Du kommer ind i planen med ${profile.currentRunsPerWeek} ugentlige pas og cirka ${profile.currentWeeklyVolumeKm} km om ugen, så åbningen ligger over begynderniveau.`;
  }
  if (profile.currentRunsPerWeek >= 3 || profile.longestRunMinutes >= 35) {
    return `Du løber allerede ${profile.currentRunsPerWeek} gange om ugen og tåler ture omkring ${profile.longestRunMinutes} minutter, så planen kan starte mere sammenhængende end for en ny løber.`;
  }
  if (profile.currentRunsPerWeek >= 1 || profile.currentWeeklyVolumeKm > 0) {
    return `Du har lidt løbeerfaring at bygge på, men planen holder stadig åbningen kontrolleret for at gøre rytmen stabil.`;
  }
  return "Løb er stadig nyt for dig, så planen starter roligt for at bygge tolerance, rytme og tryghed først.";
}

function structureLine(plan: TrainingPlan): string {
  const firstWeek = plan.weeks[0];
  const firstWeekTypes = new Set(firstWeek?.sessions.map((session) => session.type) ?? []);
  if (plan.planType === "TenKDistance") {
    return "Planen er bygget som et 10 km-distanceforløb med ét roligt basepas, ét kontrolleret udviklingspas og én længere tur, så du bygger reel 10 km-kapacitet uden at falde tilbage til begynderstruktur.";
  }
  if (plan.goal.goalDistance === "5K" && (plan.goal.goalIntent === "improve" || plan.goal.goalIntent === "target_time")) {
    return "Planen bygger mod 5K med en tydelig kombination af kvalitet, rolig støtte og en kontrolleret langtur, så farten udvikles uden at miste kontinuitet.";
  }
  if (plan.goal.goalDistance === "Halvmaraton" || plan.goal.goalDistance === "Marathon") {
    return "Planen lægger vægt på aerob styrke, steady/tempo-arbejde og en gradvis udvikling af langturen, så strukturen passer til den længere måldistance.";
  }
  if (firstWeekTypes.has("run-walk")) {
    return "Planen åbner med run-walk og rolige pas for at bygge kapacitet uden at gøre ugeprofilen for tung for tidligt.";
  }
  return "Planen er bygget med en rolig base først og derefter mere målrettet kvalitet, så progressionen bliver tydelig uden at blive brat.";
}

function safetyLine(profile: RunnerProfile, plan: TrainingPlan): string {
  if (profile.injurySensitivity >= 4) {
    return "Belastningen holdes mere forsigtig, fordi dine signaler peger på behov for lidt ekstra skadeshensyn og stabilitet.";
  }
  if (plan.adjustments.some((adjustment) => adjustment.reason.includes("stabiliseringsuge"))) {
    return "Der ligger roligere stabiliseringsuger i planen, så kroppen kan absorbere opbygningen i stedet for bare at akkumulere belastning.";
  }
  return "Progressionen stiger gradvist med lettere uger undervejs, så planen bliver bæredygtig og ikke bare ambitiøs på papiret.";
}

function weekShape(week: TrainingWeek, totalWeeks: number): WeekRationale["loadShape"] {
  if (week.isStabilizationWeek) return "stabilize";
  if (week.weekNumber >= totalWeeks - 1 || week.phase === "race_preparation" || week.phase === "taper") return "taper";
  return "build";
}

function weekSummary(goal: GoalConfig, week: TrainingWeek): string {
  if (week.isStabilizationWeek) {
    return "Ugen er lettere, så du kan samle overskud og få mere ud af den træning, du allerede har lavet.";
  }
  if (week.phase === "introduction") {
    return "Ugen handler om rytme, vane og at lande sikkert i planen.";
  }
  if (week.phase === "base") {
    return "Ugen bygger en mere stabil base under dig, så planen føles som rigtig træning uden at forcere tempo eller belastning.";
  }
  if (week.phase === "continuous_running") {
    return goal.goalDistance === "5K"
      ? "Ugen bygger mere sammenhængende løb og begynder at pege mod måldistancens krav."
      : "Ugen bygger aerob kontinuitet og mere robust rolig løbekapacitet.";
  }
  if (week.phase === "build") {
    return "Ugen bygger længere ture og mere samlet arbejde, men stadig i en kontrolleret struktur.";
  }
  if (week.phase === "capacity") {
    return goal.goalIntent === "finish" || goal.goalIntent === "finish_comfortably"
      ? "Ugen bygger mere kapacitet uden at ændre planens sikre karakter."
      : "Ugen lægger mere specifik belastning ind, så planen begynder at ligne selve målet tydeligere.";
  }
  if (week.phase === "specific") {
    return "Ugen gør træningen mere målspecifik med tydeligere rytme og mere relevant kvalitet.";
  }
  if (week.phase === "peak") {
    return "Ugen samler en af de stærkeste og mest målnære belastninger i forløbet.";
  }
  return "Ugen holder dig skarp og frisk, så du nærmer dig målet med bedre rytme og mindre unødig træthed.";
}

function workoutSummary(session: WorkoutSession, goal: GoalConfig): WorkoutRationale {
  if (session.type === "run-walk") {
    return {
      sessionId: session.id,
      summary: "Dette pas er valgt for at bygge løbetolerance sikkert uden at gøre belastningen unødigt tung tidligt i forløbet.",
      purpose: "Tryg opbygning af sammenhængende løb.",
    };
  }
  if (session.type === "interval") {
    return {
      sessionId: session.id,
      summary:
        goal.goalDistance === "5K"
          ? "Dette pas skærper 5K-specifik fart og gør det lettere at arbejde kontrolleret omkring den intensitet, dit mål kræver."
          : "Dette pas bruges som kontrolleret fartarbejde, men stadig som støtte til den samlede plan og ikke som hele planens identitet.",
      purpose: "Kontrolleret kvalitetsstimulus.",
    };
  }
  if (session.type === "tempo") {
    return {
      sessionId: session.id,
      summary:
        goal.goalDistance === "Halvmaraton" || goal.goalDistance === "Marathon"
          ? "Dette pas er valgt for at bygge steady/tempo-kapacitet, fordi den type arbejde er central for længere præstationsmål."
          : "Dette pas hjælper dig med at finde og holde en mere stabil, kontrolleret arbejdsrytme.",
      purpose: "Stabil fartkontrol og specifik kapacitet.",
    };
  }
  if (session.type === "steady" || session.type === "progression") {
    return {
      sessionId: session.id,
      summary: "Dette pas er valgt for at bygge stærkere aerob rytme og mere robust fartkontrol uden at gøre ugen tung som et hårdt intervalpas.",
      purpose: "Aerob udvikling og tempokontrol.",
    };
  }
  if (session.type === "fartlek" || session.type === "hill-reps") {
    return {
      sessionId: session.id,
      summary: "Dette pas giver en mere kontrolleret kvalitetsstimulus, hvor du arbejder med rytmeskift eller styrke uden at planen bliver aggressiv.",
      purpose: "Kontrolleret kvalitet og løbestyrke.",
    };
  }
  if (session.type === "race-specific") {
    return {
      sessionId: session.id,
      summary: "Dette pas lægger blokke ind, som ligner 10 km-kravet mere direkte, så du bliver tryg ved at holde rytmen længere sammenhængende.",
      purpose: "Målspecifik rytme og selvtillid.",
    };
  }
  if (session.type === "long") {
    return {
      sessionId: session.id,
      summary:
        goal.goalDistance === "5K"
          ? "Langturen er med som aerob støtte, men holdes som støttepas og ikke som planens hovedperson."
          : "Langturen er med for gradvist at udvide den rolige kapacitet, som måldistancen kræver.",
      purpose: "Rolig kapacitetsopbygning.",
    };
  }
  if (session.type === "recovery") {
    return {
      sessionId: session.id,
      summary: "Dette pas er valgt for at bevare rytmen i ugen uden at gøre samlet belastning for høj.",
      purpose: "Aktiv restitution.",
    };
  }
  if (session.type === "strides") {
    return {
      sessionId: session.id,
      summary: "Dette pas holder lidt fart og teknik ved lige uden at gøre ugen tungere end nødvendigt.",
      purpose: "Let fartberøring og teknik.",
    };
  }
  return {
    sessionId: session.id,
    summary: "Dette pas holder kontinuiteten i planen og støtter den samlede ugeprofil.",
    purpose: "Aerob kontinuitet.",
  };
}

export function buildPlanRationale(params: {
  profile: RunnerProfile;
  plan: TrainingPlan;
  ambitionAdjustment?: AmbitionAdjustmentRationale;
}): PlanRationale {
  const { profile, plan, ambitionAdjustment } = params;
  return {
    profileSummary: [abilityLine(profile)],
    structureSummary: [structureLine(plan)],
    safetySummary: [safetyLine(profile, plan)],
    ambitionAdjustment,
  };
}

export function buildWeekRationales(plan: TrainingPlan): WeekRationale[] {
  return plan.weeks.map((week) => ({
    weekNumber: week.weekNumber,
    summary: weekSummary(plan.goal, week),
    focus: week.focus,
    loadShape: weekShape(week, plan.weeks.length),
  }));
}

export function buildWorkoutRationales(plan: TrainingPlan): WorkoutRationale[] {
  return plan.sessions.map((session) => workoutSummary(session, plan.goal));
}

export function generatePlanExplanation(profile: RunnerProfile, plan: TrainingPlan, locale: SiteLocale = "da"): string[] {
  const rationale = plan.rationale?.plan ?? buildPlanRationale({ profile, plan });
  const lines = [...rationale.profileSummary, ...rationale.structureSummary, ...rationale.safetySummary];
  if (rationale.ambitionAdjustment?.applied) {
    lines.push(rationale.ambitionAdjustment.reason);
  }
  return lines.slice(0, 4).map((line) => translateCoachExplanationLine(line, locale));
}

export function explainPlanAdjustment(adjustment: PlanAdjustment, locale: SiteLocale = "da"): string {
  if (adjustment.effect === "insert_recovery") {
    return locale === "en" ? "I added more recovery so the body has room to absorb the training." : "Jeg lagde mere restitution ind, så kroppen får plads til at absorbere træningen.";
  }
  if (adjustment.effect === "reduce_load") {
    return locale === "en" ? "I eased the load a little so the progression becomes more stable." : "Jeg dæmpede belastningen lidt, så progressionen bliver mere stabil.";
  }
  if (adjustment.effect === "increase") {
    return locale === "en" ? "I built a little further here because recent development points to extra headroom." : "Jeg byggede en smule videre her, fordi den seneste udvikling peger på overskud.";
  }
  return locale === "en" ? "I am keeping this part steady so you can keep building without forcing anything." : "Jeg holder denne del stabil, så du kan bygge videre uden at forcere noget.";
}

export function buildAdaptationRationale(params: {
  mode: AdaptationRationale["mode"];
  reason: string;
  nextWeekBefore: Array<{ title: string; loadScore: number; runMinutes: number }>;
  nextWeekAfter: Array<{ title: string; loadScore: number; runMinutes: number }>;
  traits: RunnerTraits;
}): AdaptationRationale {
  const { mode, reason, nextWeekBefore, nextWeekAfter, traits } = params;
  const beforeLoad = nextWeekBefore.reduce((sum, session) => sum + session.loadScore, 0);
  const afterLoad = nextWeekAfter.reduce((sum, session) => sum + session.loadScore, 0);
  const longestBefore = Math.max(0, ...nextWeekBefore.map((session) => session.runMinutes));
  const longestAfter = Math.max(0, ...nextWeekAfter.map((session) => session.runMinutes));
  const changeSummary: string[] = [];
  const learnedTendencies: string[] = [];

  if (traits.progressionTolerance >= 3.8 && traits.complianceTrend >= 3.6) {
    learnedTendencies.push("Du har håndteret den seneste progression stabilt, så planen kan bygge lidt mere tillidsfuldt videre.");
  } else if (traits.cautionTrend >= 3.8) {
    learnedTendencies.push("De seneste uger peger på, at kroppen reagerer bedst på lidt mere forsigtig progression.");
  }

  if (traits.longRunTolerance <= 2.5) {
    learnedTendencies.push("Dine seneste signaler peger på, at langturene skal bygges mere forsigtigt end resten af ugen.");
  } else if (traits.longRunTolerance >= 3.8 && longestAfter >= longestBefore && longestAfter > 0) {
    learnedTendencies.push("Du har håndteret de længere ture godt, så langturen kan udvikles mere normalt igen.");
  }

  if (traits.qualityTolerance <= 2.5) {
    learnedTendencies.push("Kvalitetspassene bliver holdt lidt mere kontrollerede, fordi de seneste signaler ikke peger på fuld tolerance endnu.");
  } else if (traits.qualityTolerance >= 3.8 && (mode === "progress" || mode === "resume_build")) {
    learnedTendencies.push("Du har tålt den specifikke kvalitet godt, så planen kan bruge lidt mere målrettet kvalitet igen.");
  }

  if (afterLoad !== beforeLoad) {
    changeSummary.push(
      afterLoad < beforeLoad
        ? `Næste uge er gjort lettere samlet set (${beforeLoad} -> ${afterLoad} i loadscore).`
        : `Næste uge er gjort en smule mere krævende samlet set (${beforeLoad} -> ${afterLoad} i loadscore).`,
    );
  }

  if (longestAfter !== longestBefore) {
    changeSummary.push(
      longestAfter < longestBefore
        ? `Langturen er kortet ned fra ca. ${longestBefore} til ${longestAfter} minutter.`
        : `Langturen er justeret op fra ca. ${longestBefore} til ${longestAfter} minutter.`,
    );
  }

  if (changeSummary.length === 0) {
    changeSummary.push("Næste uge holder samme overordnede struktur som før.");
  }

  const runnerFocus =
    mode === "recovery_microcycle"
      ? "Fokus nu er at komme tilbage med ro i kroppen og få rytmen tilbage uden at jage noget."
      : mode === "down_shift"
        ? "Fokus nu er at holde kvaliteten kontrolleret og få ugen til at føles mere bæredygtig."
        : mode === "resume_build"
          ? "Fokus nu er at komme tilbage i normal rytme uden at hoppe direkte til den hårdeste progression."
          : mode === "progress"
            ? "Fokus nu er at bruge overskuddet fornuftigt og ramme kvalitetspassene kontrolleret."
            : "Fokus nu er at fortsætte stabilt og lade kontinuiteten arbejde for dig.";

  return {
    mode,
    reason,
    changeSummary,
    learnedTendencies: learnedTendencies.slice(0, 2),
    runnerFocus,
  };
}

type FeedbackResponseInput = {
  quickFeedback?: "very_easy" | "good" | "hard" | "too_hard";
  completionPct: number;
  effort: number;
  energy: number;
  painLevel: number;
};

type FeedbackResponseCopy = {
  interpretation: string;
  adjustmentExplanation: string;
  progressionPreview: string;
  runnerFocus: string;
  learnedInsights: string[];
};

function negativeFeedback(input: FeedbackResponseInput): boolean {
  return (
    input.completionPct < 95 ||
    input.quickFeedback === "hard" ||
    input.quickFeedback === "too_hard" ||
    input.effort >= 8 ||
    input.energy <= 2 ||
    input.painLevel >= 4
  );
}

function positiveReadinessLanguage(text: string): boolean {
  return /overskud|let(?:te|t)?\b|skrue op|bygge lidt mere|mere tillidsfuldt|stærk|god surplus|progression godt/i.test(text);
}

function negativeInterpretation(input: FeedbackResponseInput): string {
  const parts: string[] = [];
  if (input.completionPct < 80) {
    parts.push("Du kom ikke helt gennem passet som planlagt.");
  } else if (input.completionPct < 95) {
    parts.push("Du afkortede passet undervejs.");
  }
  if (input.quickFeedback === "too_hard" || input.effort >= 9) {
    parts.push("Det lød klart hårdere end det skulle være.");
  } else if (input.quickFeedback === "hard" || input.effort >= 8) {
    parts.push("Passet lød hårdere end ønsket.");
  }
  if (input.energy <= 2) {
    parts.push("Energien var også lav.");
  }
  if (input.painLevel >= 7) {
    parts.push("Du rapporterede desuden tydelig smerte eller uro.");
  } else if (input.painLevel >= 4) {
    parts.push("Der var også tegn på irritation eller forsigtighed.");
  }
  return parts.join(" ");
}

function defaultAdjustmentForMode(rationale: AdaptationRationale): string {
  if (rationale.mode === "recovery_microcycle") {
    return "Jeg gør næste uge klart lettere med mindre belastning og mere plads til restitution.";
  }
  if (rationale.mode === "down_shift") {
    return "Jeg dæmper den næste uge lidt, så belastningen bliver mere bæredygtig.";
  }
  if (rationale.mode === "resume_build") {
    return "Jeg bygger forsigtigt videre igen, men uden at hoppe direkte tilbage til fuld progression.";
  }
  if (rationale.mode === "progress") {
    return "Jeg øger udfordringen en smule og holder den målrettet mod dit mål.";
  }
  return "Jeg holder næste uge stabil, så planen fortsætter uden unødigt pres.";
}

function progressionPreviewForMode(rationale: AdaptationRationale): string {
  if (rationale.mode === "recovery_microcycle") {
    return "Næste skridt er en recovery-uge med mindre belastning og mere ro.";
  }
  if (rationale.mode === "down_shift") {
    return "Næste skridt er en lidt lettere uge med mindre progressionstryk.";
  }
  if (rationale.mode === "resume_build") {
    return "Næste skridt er at komme tilbage i build på en kontrolleret måde.";
  }
  if (rationale.mode === "progress") {
    return "Næste skridt er en lidt mere målrettet uge, fordi de seneste signaler var stærke nok til det.";
  }
  return "Næste skridt er at holde rytmen og lade kontinuiteten arbejde.";
}

export function buildFeedbackResponseCopy(params: {
  rationale: AdaptationRationale;
  feedback: FeedbackResponseInput;
  locale?: SiteLocale;
}): FeedbackResponseCopy {
  const { rationale, feedback } = params;
  const locale = params.locale ?? "da";
  const caution = negativeFeedback(feedback);

  let interpretation = caution
    ? negativeInterpretation(feedback)
    : rationale.mode === "progress"
      ? "Passet så kontrolleret ud med fint overskud, så planen kan skrue lidt mere målrettet op."
      : rationale.mode === "resume_build"
        ? "De seneste signaler peger på, at du er ved at finde rytmen igen."
        : rationale.mode === "hold"
          ? "Passet ser samlet set ud til at passe godt ind i planen."
          : rationale.reason;

  if (!interpretation) {
    interpretation = rationale.reason;
  }

  let adjustmentExplanation =
    rationale.changeSummary.find((line) => (caution ? !positiveReadinessLanguage(line) : true)) ?? defaultAdjustmentForMode(rationale);

  if (caution && positiveReadinessLanguage(adjustmentExplanation)) {
    adjustmentExplanation = defaultAdjustmentForMode(rationale);
  }

  const progressionPreview = caution
    ? rationale.mode === "recovery_microcycle"
      ? "Næste skridt er at få kroppen tilbage i ro, før progressionen bygges videre."
      : "Næste skridt er en mere forsigtig uge, så planen ikke accelererer på de forkerte signaler."
    : progressionPreviewForMode(rationale);

  const learnedInsights = (rationale.learnedTendencies ?? []).filter((line) => (caution ? !positiveReadinessLanguage(line) : true));

  return {
    interpretation: translateCoachExplanationLine(interpretation, locale),
    adjustmentExplanation: translateCoachExplanationLine(adjustmentExplanation, locale),
    progressionPreview: translateCoachExplanationLine(progressionPreview, locale),
    runnerFocus: translateCoachExplanationLine(rationale.runnerFocus, locale),
    learnedInsights: learnedInsights.map((line) => translateCoachExplanationLine(line, locale)),
  };
}
