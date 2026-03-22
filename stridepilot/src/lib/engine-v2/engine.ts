import { buildCoachExplanation } from "./explanationEngine";
import { buildPhasePlan } from "./phaseEngine";
import { choosePlanType } from "./planTypes";
import { buildProgressionCurves } from "./progressionCurves";
import { classifyRunner } from "./runnerClassification";
import { buildSession } from "./sessionBuilder";
import { validateSessionSeries, validateWeeklySessions } from "./sessionValidation";
import { validateEnginePlan } from "./validation";
import { chooseWorkoutSelections } from "./workoutSelection";
import { buildWeeklyStructure } from "./weeklyStructure";
import type { BuiltWeek, EnginePlan, RunnerInput } from "./models";

function weekFocus(phase: BuiltWeek["phase"], isCutback: boolean): string {
  if (isCutback) return "stabilisering og absorption";
  if (phase === "base") return "stabilisere base og skabe rytme";
  if (phase === "build") return "bygge volumen og udholdenhed";
  if (phase === "specific") return "mere målrettet race-relevant arbejde";
  if (phase === "peak") return "planens skarpeste og mest specifikke uger";
  return "friskhed og rytme frem mod målet";
}

export function generateEngineV2Plan(input: RunnerInput): EnginePlan {
  const classification = classifyRunner(input);
  const planTypeDecision = choosePlanType(input, classification);
  const phasePlan = buildPhasePlan(input, classification, planTypeDecision.planType);
  const curves = buildProgressionCurves(input, classification, phasePlan, planTypeDecision.planType);

  const weeks: BuiltWeek[] = phasePlan.weeks.map((phaseWeek) => {
    const structure = buildWeeklyStructure(input, classification, phaseWeek.phase, planTypeDecision.planType, phaseWeek.weekIndex, curves);
    const primaryLoadDimension = curves.primaryLoadDimension[phaseWeek.weekIndex - 1] ?? "stabilize";
    const selections = chooseWorkoutSelections(
      structure,
      phaseWeek.phase,
      planTypeDecision.planType,
      classification,
      curves.intensityCurve[phaseWeek.weekIndex - 1],
      primaryLoadDimension,
    );
    const sessions = selections.map((selection) => buildSession(input, classification, planTypeDecision.planType, phaseWeek.phase, curves, selection));
    const validationIssues = validateWeeklySessions(sessions, selections, structure, classification, planTypeDecision.planType);

    return {
      weekIndex: phaseWeek.weekIndex,
      phase: phaseWeek.phase,
      isCutback: phaseWeek.isCutback,
      volumeTargetMin: curves.weeklyVolumeCurve[phaseWeek.weekIndex - 1],
      longRunTargetMin: curves.longRunCurve[phaseWeek.weekIndex - 1],
      intensityTarget: curves.intensityCurve[phaseWeek.weekIndex - 1],
      focus: weekFocus(phaseWeek.phase, phaseWeek.isCutback),
      sessions,
      workoutSelections: selections,
      validationIssues,
    };
  });

  for (const issue of validateSessionSeries(weeks, classification, planTypeDecision.planType)) {
    const targetWeek = issue.weekIndex ? weeks.find((week) => week.weekIndex === issue.weekIndex) : weeks[weeks.length - 1];
    if (targetWeek) {
      targetWeek.validationIssues = [...(targetWeek.validationIssues ?? []), issue];
    }
  }

  const plan: EnginePlan = {
    input,
    classification,
    planTypeDecision,
    phasePlan,
    curves,
    weeks,
    explanation: { planWhy: [], weekWhy: [] },
  };

  plan.explanation = buildCoachExplanation(plan);

  const issues = validateEnginePlan(plan);
  if (issues.some((issue) => issue.severity === "critical")) {
    plan.explanation.weekWhy.push(`Validation flagged ${issues.length} issue(s), including at least one critical quality concern.`);
  }

  return plan;
}
