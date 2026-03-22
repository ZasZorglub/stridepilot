import type { EnginePlan, ValidationIssue } from "./models";

export function validateEnginePlan(plan: EnginePlan): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const phases = new Set(plan.weeks.map((week) => week.phase));
  const longRunWeeks = plan.weeks.filter((week) => week.sessions.some((session) => session.role === "long_run"));
  const cutbackWeeks = plan.weeks.filter((week) => week.isCutback);
  const taperWeeks = plan.weeks.filter((week) => week.phase === "taper");

  if (longRunWeeks.length === 0) {
    issues.push({ severity: "critical", area: "structure", message: "Plan has no identifiable long run." });
  }
  if (plan.phasePlan.totalWeeks >= 10 && cutbackWeeks.length === 0) {
    issues.push({ severity: "important", area: "progression", message: "Longer plan has no cutback/stabilization week." });
  }
  if (!phases.has("taper")) {
    issues.push({ severity: "critical", area: "progression", message: "Plan has no taper phase." });
  }
  if (taperWeeks.length > 0) {
    const taperLoad = taperWeeks.reduce((sum, week) => sum + week.volumeTargetMin, 0) / taperWeeks.length;
    const peakLoad = Math.max(...plan.weeks.map((week) => week.volumeTargetMin));
    if (taperLoad >= peakLoad * 0.9) {
      issues.push({ severity: "important", area: "progression", message: "Taper is too shallow to feel like a real freshness phase." });
    }
  }

  const beginner = plan.classification.traits.runnerLevel === "true_beginner" || plan.classification.traits.runnerLevel === "beginner_plus";
  if (beginner) {
    const advancedFamily = plan.weeks.some((week) => week.sessions.some((session) => session.family === "intervals" || session.family === "hill_reps"));
    if (advancedFamily) {
      issues.push({ severity: "critical", area: "safety", message: "Beginner plan includes advanced quality too early." });
    }
  }

  if (!beginner && plan.weeks[0]?.sessions.some((session) => session.family === "run_walk_progression")) {
    issues.push({ severity: "important", area: "specificity", message: "Non-beginner plan still opens with run/walk." });
  }

  const repeatedFamilies = plan.weeks.some((week) => {
    if (plan.classification.traits.runnerLevel === "true_beginner" && week.weekIndex <= 2) return false;
    const families = week.sessions.map((session) => session.family);
    return new Set(families).size === 1 && families.length >= 3;
  });
  if (repeatedFamilies) {
    issues.push({ severity: "important", area: "structure", message: "One or more weeks make all sessions feel too similar." });
  }

  return issues;
}
