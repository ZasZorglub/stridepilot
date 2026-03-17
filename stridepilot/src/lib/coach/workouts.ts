import { GoalConfig, PlanPhase, RunnerProfile, WorkoutSession, WorkoutStructureSegment, WorkoutTemplate, WorkoutType } from "./types";

export const WORKOUT_LIBRARY: Record<WorkoutType, WorkoutTemplate> = {
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
  benchmark: {
    type: "benchmark",
    purpose: "Giver en rolig status på udviklingen uden at overdramatisere passet.",
    progressionNotes: ["Mere sammenhængende løb", "Tydeligere 5K-følelse", "Bruges sparsomt"],
  },
};

export interface WorkoutBuildContext {
  weekNumber: number;
  phase: PlanPhase;
  profile: RunnerProfile;
  goal: GoalConfig;
  dayOfWeek: WorkoutSession["dayOfWeek"];
  date: string;
  isStabilizationWeek: boolean;
  continuousRunMin: number;
  longRunMin: number;
  intervalRunMin: number;
  walkBreakMin: number;
  repeats: number;
}

function roundToHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

export function estimateSessionLoad(durationMin: number, type: WorkoutType, profile: RunnerProfile): number {
  const intensity =
    type === "recovery"
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

export function sumDuration(structure: WorkoutStructureSegment[]): number {
  return structure.reduce((sum, segment) => {
    const repeats = segment.repeats ?? 1;
    const recover = segment.recoverMin ?? 0;
    return sum + segment.durationMin * repeats + recover * Math.max(repeats - 1, 0);
  }, 0);
}

function baseSession(
  context: WorkoutBuildContext,
  type: WorkoutType,
  title: string,
  description: string,
  intent: string,
  effortGuidance: string,
  structure: WorkoutStructureSegment[],
): WorkoutSession {
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

export function buildRunWalkWorkout(context: WorkoutBuildContext): WorkoutSession {
  const structure: WorkoutStructureSegment[] = [
    { type: "warmup", label: "Opvarmning", durationMin: 5 },
    {
      type: "run",
      label: "Løb/gang blok",
      durationMin: context.intervalRunMin,
      repeats: context.repeats,
      recoverMin: context.walkBreakMin,
    },
    { type: "cooldown", label: "Nedkøling", durationMin: 5 },
  ];

  return baseSession(
    context,
    "run-walk",
    "Run-walk",
    "Et roligt pas hvor løb og gang skiftes, så du bygger tolerance uden at forcere.",
    "Skabe tryg rytme og løbetolerance.",
    "Løb roligt. Du skal hele tiden kunne falde til ro i pauserne.",
    structure,
  );
}

export function buildEasyWorkout(context: WorkoutBuildContext): WorkoutSession {
  const structure: WorkoutStructureSegment[] = [
    { type: "warmup", label: "Opvarmning", durationMin: 5 },
    { type: "steady", label: "Roligt løb", durationMin: context.continuousRunMin },
    { type: "cooldown", label: "Nedkøling", durationMin: 5 },
  ];

  return baseSession(
    context,
    "easy",
    "Roligt løb",
    "Et jævnt pas hvor du finder rytme og bygger rolig kapacitet.",
    "Skabe kontinuitet og overskud.",
    "Hold et tempo hvor du stadig kan føre en kort samtale.",
    structure,
  );
}

export function buildLongWorkout(context: WorkoutBuildContext): WorkoutSession {
  const structure: WorkoutStructureSegment[] = [
    { type: "warmup", label: "Opvarmning", durationMin: 5 },
    { type: "steady", label: "Lang rolig blok", durationMin: context.longRunMin },
    { type: "cooldown", label: "Nedkøling", durationMin: 5 },
  ];

  return baseSession(
    context,
    "long",
    "Langt roligt pas",
    "Den længste rolige træning i ugen, hvor du samler tid på benene uden jagt på fart.",
    "Udvide den rolige kapacitet.",
    "Hold det bevidst roligt. Du skal gerne slutte med lidt overskud.",
    structure,
  );
}

export function buildIntervalWorkout(context: WorkoutBuildContext): WorkoutSession {
  const structure: WorkoutStructureSegment[] = [
    { type: "warmup", label: "Opvarmning", durationMin: 6 },
    {
      type: "run",
      label: "Interval",
      durationMin: context.intervalRunMin,
      repeats: context.repeats,
      recoverMin: Math.max(1, context.walkBreakMin - 0.5),
    },
    { type: "cooldown", label: "Nedkøling", durationMin: 5 },
  ];

  return baseSession(
    context,
    "interval",
    "Intervalpas",
    "Et kontrolleret kvalitetspas med tydelige pauser mellem blokkene.",
    "Arbejde med fart i små doser.",
    "Løb kontrolleret og rytmisk. Du skal ikke sprinte dig gennem blokkene.",
    structure,
  );
}

export function buildTempoWorkout(context: WorkoutBuildContext): WorkoutSession {
  const blockDuration = roundToHalf(Math.max(6, context.continuousRunMin * 0.6));
  const structure: WorkoutStructureSegment[] = [
    { type: "warmup", label: "Opvarmning", durationMin: 6 },
    { type: "tempo", label: "Tempoblok", durationMin: blockDuration, repeats: 2, recoverMin: 2 },
    { type: "cooldown", label: "Nedkøling", durationMin: 5 },
  ];

  return baseSession(
    context,
    "tempo",
    "Tempopas",
    "Et jævnt pas tættere på 5K-rytme, men stadig under kontrol.",
    "Bygge stabil fartkontrol.",
    "Løb fast og fokuseret, men undgå at gå i rødt.",
    structure,
  );
}

export function buildStridesWorkout(context: WorkoutBuildContext): WorkoutSession {
  const structure: WorkoutStructureSegment[] = [
    { type: "warmup", label: "Opvarmning", durationMin: 5 },
    { type: "steady", label: "Let løb", durationMin: Math.max(10, context.continuousRunMin * 0.7) },
    { type: "stride", label: "Strides", durationMin: 0.25, repeats: 6, recoverMin: 0.75 },
    { type: "cooldown", label: "Nedkøling", durationMin: 4 },
  ];

  return baseSession(
    context,
    "strides",
    "Roligt løb med strides",
    "Et let pas hvor du slutter med korte hurtige indslag for rytme og teknik.",
    "Skærpe rytme uden at gøre ugen tungere.",
    "Det meste skal føles let. Strides er korte og kontrollerede.",
    structure,
  );
}

export function buildRecoveryWorkout(context: WorkoutBuildContext): WorkoutSession {
  const structure: WorkoutStructureSegment[] = [
    { type: "warmup", label: "Rolig start", durationMin: 4 },
    { type: "recovery", label: "Meget let bevægelse", durationMin: Math.max(12, context.continuousRunMin * 0.65) },
    { type: "cooldown", label: "Nedkøling", durationMin: 4 },
  ];

  return baseSession(
    context,
    "recovery",
    "Recovery-pas",
    "Et meget let pas som holder kroppen i gang uden at fylde meget i den samlede belastning.",
    "Give bevægelse uden at stjæle restitution.",
    "Hold det let fra start til slut.",
    structure,
  );
}

export function buildBenchmarkWorkout(context: WorkoutBuildContext): WorkoutSession {
  const structure: WorkoutStructureSegment[] = [
    { type: "warmup", label: "Opvarmning", durationMin: 8 },
    { type: "tempo", label: context.phase === "race_preparation" ? "5K-kontrolblok" : "Benchmark-blok", durationMin: Math.max(12, context.continuousRunMin) },
    { type: "cooldown", label: "Nedkøling", durationMin: 6 },
  ];

  return baseSession(
    context,
    "benchmark",
    context.phase === "race_preparation" ? "5K-benchmark" : "Benchmark-pas",
    "Et kontrolleret statuspas, så du kan mærke din udvikling uden at det bliver et alt-eller-intet testløb.",
    "Måle udviklingen roligt og realistisk.",
    "Start kontrolleret og hold igen i første halvdel.",
    structure,
  );
}
