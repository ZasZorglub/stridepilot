import { PlanAdjustment, RunnerProfile, TrainingPlan } from "./types";

function archetypeLead(profile: RunnerProfile): string {
  if (profile.archetype === "nervous_beginner") return "Du starter roligt, så kroppen og hovedet kan følge med fra begyndelsen.";
  if (profile.archetype === "motivated_novice") return "Du har motivationen med dig, så planen bygger videre på den uden at gøre for meget for tidligt.";
  if (profile.archetype === "fit_but_inexperienced") return "Du har et godt fysisk udgangspunkt, men planen holder løbespecifik belastning kontrolleret i starten.";
  if (profile.archetype === "returning_runner") return "Du bygger op igen fra et kendt udgangspunkt, men med lidt ekstra respekt for pausen bag dig.";
  return "Du får et program med tydelig struktur, så ambitionen kan omsættes til stabil fremgang.";
}

export function generatePlanExplanation(profile: RunnerProfile, plan: TrainingPlan): string[] {
  const firstWeeksNeedRunWalk = plan.weeks.slice(0, 2).some((week) => week.sessions.some((session) => session.type === "run-walk"));
  const loadGuard =
    profile.injurySensitivity >= 4 || profile.confidence <= 2
      ? "Progressionen holdes bevidst rolig, så belastningen forbliver realistisk."
      : "Progressionen stiger gradvist uge for uge, så du kan bygge videre med overskud.";

  return [
    archetypeLead(profile),
    firstWeeksNeedRunWalk
      ? "Du starter med run-walk fordi det bygger løbetolerance uden at overbelaste kroppen."
      : "Du starter med rolige, sammenhængende pas fordi dit nuværende niveau kan bære det.",
    "De første uger handler om rytme, kontinuitet og tryg progression frem mod mere sammenhængende løb.",
    loadGuard,
  ];
}

export function explainPlanAdjustment(adjustment: PlanAdjustment): string {
  if (adjustment.effect === "insert_recovery") {
    return "Jeg lagde mere restitution ind, så kroppen får plads til at absorbere træningen.";
  }
  if (adjustment.effect === "reduce_load") {
    return "Jeg dæmpede belastningen lidt, så progressionen bliver mere stabil.";
  }
  if (adjustment.effect === "increase") {
    return "Jeg byggede en smule videre her, fordi den seneste udvikling peger på overskud.";
  }
  return "Jeg holder denne del stabil, så du kan bygge videre uden at forcere noget.";
}
