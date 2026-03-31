import { chooseLongRunDay } from "../weeklyStructure";
import type { RunnerInput, WeeklyStructure } from "../models";

export function placeSessionsOnDays(weeklyStructures: WeeklyStructure[], input: RunnerInput): WeeklyStructure[] {
  const preferredLongRunDay = chooseLongRunDay(input);
  return weeklyStructures.map((week) => ({
    ...week,
    longRunDay: week.slots.some((slot) => slot.role === "long_run" && slot.day === preferredLongRunDay) ? preferredLongRunDay : week.longRunDay,
  }));
}
