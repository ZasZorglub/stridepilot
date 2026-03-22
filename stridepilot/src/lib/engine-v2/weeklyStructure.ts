import type { DayOfWeek, Phase, PlanType, ProgressionCurves, RunnerClassification, RunnerInput, WeeklyEmphasis, WeeklyRole, WeeklyStructure } from "./models";

const DAY_ORDER: DayOfWeek[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

function latestDay(days: DayOfWeek[]): DayOfWeek {
  return [...days].sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b)).at(-1) ?? "sunday";
}

export function chooseLongRunDay(input: RunnerInput): DayOfWeek {
  const days: DayOfWeek[] = input.availableTrainingDays.length > 0 ? input.availableTrainingDays : ["tuesday", "thursday", "sunday"];
  if (input.preferredLongRunDay === "saturday" && days.includes("saturday")) return "saturday";
  if (input.preferredLongRunDay === "sunday" && days.includes("sunday")) return "sunday";
  if (input.preferredLongRunDay === "weekday") {
    return latestDay(days.filter((day) => day !== "saturday" && day !== "sunday"));
  }
  if (days.includes("sunday")) return "sunday";
  if (days.includes("saturday")) return "saturday";
  return latestDay(days);
}

function rolesForFrequency(days: number, phase: Phase, planType: PlanType, classification: RunnerClassification): WeeklyRole[] {
  const beginner = classification.traits.runnerLevel === "true_beginner" || classification.traits.runnerLevel === "beginner_plus";
  if (days <= 2) return [beginner ? "easy" : phase === "base" ? "aerobic_support" : "quality", "long_run"];
  if (days === 3) {
    if (beginner && (planType === "5k_finish" || planType === "5k_finish_no_walk" || planType === "10k_finish")) {
      return ["easy", phase === "base" ? "easy" : "quality", "long_run"];
    }
    if (planType === "10k_finish") return [phase === "base" ? "easy" : "aerobic_support", "quality", "long_run"];
    return ["quality", "easy", "long_run"];
  }
  if (days === 4) return ["quality", phase === "base" ? "easy" : "aerobic_support", "recovery", "long_run"];
  return ["quality", "aerobic_support", "easy", "recovery", "long_run"];
}

function weeklyEmphasis(phase: Phase, intensity: number, isCutback: boolean): WeeklyEmphasis {
  if (phase === "taper") return "taper_freshness";
  if (isCutback) return "recovery_absorption";
  if (phase === "base") return "base_support";
  if (phase === "build") return "durability_build";
  if (phase === "specific") return "specific_development";
  return intensity >= 0.5 ? "peak_specificity" : "specific_development";
}

export function buildWeeklyStructure(
  input: RunnerInput,
  classification: RunnerClassification,
  phase: Phase,
  planType: PlanType,
  weekIndex: number,
  curves: ProgressionCurves,
): WeeklyStructure {
  const availableDays: DayOfWeek[] = input.availableTrainingDays.length > 0 ? input.availableTrainingDays : ["tuesday", "thursday", "sunday"];
  const longRunDay = chooseLongRunDay(input);
  const remainingDays = availableDays.filter((day) => day !== longRunDay).sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
  const roles = rolesForFrequency(availableDays.length, phase, planType, classification);
  const intensity = curves.intensityCurve[weekIndex - 1] ?? 0.2;
  const isCutback = curves.cutbackWeeks.includes(weekIndex);
  const slots = roles.map((role, index) => {
    if (role === "long_run") return { role, day: longRunDay, qualityBias: "none" as const, protected: true };
    const day = remainingDays[index] ?? availableDays[index] ?? longRunDay;
    const qualityBias =
      role === "quality"
        ? intensity < 0.22
          ? ("intro" as const)
          : intensity < 0.42
            ? ("moderate" as const)
            : ("specific" as const)
        : ("none" as const);
    return { role, day, qualityBias, protected: role === "recovery" };
  });
  return {
    weekIndex,
    phase,
    totalRuns: slots.length,
    weeklyEmphasis: weeklyEmphasis(phase, intensity, isCutback),
    longRunDay,
    qualityDays: slots.filter((slot) => slot.role === "quality").map((slot) => slot.day),
    easyDays: slots.filter((slot) => slot.role === "easy" || slot.role === "aerobic_support").map((slot) => slot.day),
    recoveryDays: slots.filter((slot) => slot.role === "recovery").map((slot) => slot.day),
    longRunTargetMin: curves.longRunCurve[weekIndex - 1] ?? 0,
    weeklyVolumeTargetMin: curves.weeklyVolumeCurve[weekIndex - 1] ?? 0,
    intensityTarget: intensity,
    continuousTargetMin: curves.continuousCurve[weekIndex - 1] ?? input.currentContinuousRunMin,
    slots,
  };
}
