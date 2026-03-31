import { buildSession } from "../sessionBuilder";
import { validateSessionSeries, validateWeeklySessions } from "../sessionValidation";
import { chooseWorkoutSelections } from "../workoutSelection";
import type { BuiltWeek, PlanType, ProgressionCurves, RunnerClassification, RunnerInput, WeeklyStructure } from "../models";

function weekFocus(phase: BuiltWeek["phase"], timelinePhase: BuiltWeek["timelinePhase"], isCutback: boolean): string {
  if (timelinePhase === "race") return "måluge med friskhed, rytme og klarhed frem mod løbet";
  if (isCutback) return "stabilisering og absorption";
  if (phase === "base") return "stabilisere base og skabe rytme";
  if (phase === "build") return "bygge volumen og udholdenhed";
  if (phase === "specific") return "mere målrettet race-relevant arbejde";
  if (phase === "peak") return "planens skarpeste og mest specifikke uger";
  return "friskhed og rytme frem mod målet";
}

export function generateSessions(params: {
  input: RunnerInput;
  classification: RunnerClassification;
  planType: PlanType;
  curves: ProgressionCurves;
  weeklyStructures: WeeklyStructure[];
}): BuiltWeek[] {
  const weeks = params.weeklyStructures.map((structure) => {
    const selections = chooseWorkoutSelections(
      structure,
      structure.phase,
      params.planType,
      params.input.goalType,
      params.classification,
      params.curves.backboneType,
    );
    const sessions = selections.map((selection) => buildSession(params.input, params.classification, params.planType, structure.phase, params.curves, selection));
    const validationIssues = validateWeeklySessions(sessions, selections, structure, params.classification, params.planType);

    return {
      weekIndex: structure.weekIndex,
      phase: structure.phase,
      timelinePhase: structure.isRaceWeek ? "race" : structure.phase,
      isCutback: params.curves.cutbackWeeks.includes(structure.weekIndex),
      isRaceWeek: Boolean(structure.isRaceWeek),
      volumeTargetMin: structure.weeklyVolumeTargetMin,
      longRunTargetMin: structure.longRunTargetMin,
      intensityTarget: structure.intensityTarget,
      focus: weekFocus(structure.phase, structure.isRaceWeek ? "race" : structure.phase, params.curves.cutbackWeeks.includes(structure.weekIndex)),
      sessions,
      workoutSelections: selections,
      validationIssues,
    } satisfies BuiltWeek;
  });

  for (const issue of validateSessionSeries(weeks, params.classification, params.planType)) {
    const targetWeek = issue.weekIndex ? weeks.find((week) => week.weekIndex === issue.weekIndex) : weeks[weeks.length - 1];
    if (targetWeek) {
      targetWeek.validationIssues = [...(targetWeek.validationIssues ?? []), issue];
    }
  }

  return weeks;
}
