import { chooseLongRunDay } from "../weeklyStructure";
import type { DayOfWeek, RunnerInput, WeeklyStructure, WeeklyRole, WeeklySlot } from "../models";

const DAY_ORDER: DayOfWeek[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DEFAULT_DAYS: DayOfWeek[] = ["tuesday", "thursday", "sunday"];

function sortDays(days: DayOfWeek[]): DayOfWeek[] {
  return [...days].sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
}

function pickClosestIndex(days: DayOfWeek[], target: number, used: Set<number>): number {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < days.length; index += 1) {
    if (used.has(index)) continue;
    const distance = Math.abs(index - target);
    if (distance < bestDistance || (distance === bestDistance && index > bestIndex)) {
      bestIndex = index;
      bestDistance = distance;
    }
  }
  return bestIndex;
}

function patternTargets(count: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [0.6];
  if (count === 2) return [0.2, 0.6];
  if (count === 3) return [0, 0.4, 0.8];
  if (count === 4) return [0, 0.2, 0.6, 0.8];
  return Array.from({ length: count }, (_, index) => index / (count - 1));
}

function pickPatternDays(days: DayOfWeek[], count: number): DayOfWeek[] {
  if (count <= 0) return [];
  if (count >= days.length) return [...days];
  const used = new Set<number>();
  const picked = patternTargets(count).map((fraction) => {
    const target = fraction * Math.max(days.length - 1, 0);
    const chosenIndex = pickClosestIndex(days, target, used);
    used.add(chosenIndex);
    return chosenIndex;
  });
  return picked.sort((a, b) => a - b).map((index) => days[index]!);
}

function rolePriority(role: WeeklyRole): number {
  if (role === "quality") return 0;
  if (role === "aerobic_support") return 1;
  if (role === "recovery") return 2;
  return 3;
}

function preferredSupportDayIndex(role: WeeklyRole, totalDays: number): number {
  if (totalDays <= 1) return 0;
  if (role === "quality") return totalDays - 1;
  if (role === "aerobic_support") return Math.min(totalDays - 1, Math.ceil((totalDays - 1) * 0.5));
  if (role === "recovery") return totalDays - 1;
  return 0;
}

function assignSupportDays(slots: WeeklySlot[], supportDays: DayOfWeek[]): WeeklySlot[] {
  const remaining = supportDays.map((day, index) => ({ day, index }));
  const assignments = Array<DayOfWeek>(slots.length);
  const ordered = slots
    .map((slot, index) => ({ role: slot.role, index }))
    .sort((left, right) => {
      const priorityDiff = rolePriority(left.role) - rolePriority(right.role);
      if (priorityDiff !== 0) return priorityDiff;
      return left.index - right.index;
    });

  for (const entry of ordered) {
    const targetIndex = preferredSupportDayIndex(entry.role, supportDays.length);
    const chosen =
      [...remaining].sort((left, right) => {
        const distanceDiff = Math.abs(left.index - targetIndex) - Math.abs(right.index - targetIndex);
        if (distanceDiff !== 0) return distanceDiff;
        return right.index - left.index;
      })[0] ?? remaining[0];
    assignments[entry.index] = chosen.day;
    const removeIndex = remaining.findIndex((candidate) => candidate.day === chosen.day);
    if (removeIndex >= 0) remaining.splice(removeIndex, 1);
  }

  return slots.map((slot, index) => ({
    ...slot,
    day: assignments[index] ?? supportDays[index] ?? slot.day,
  }));
}

function chooseKeyDay(availableDays: DayOfWeek[], preferredLongRunDay: DayOfWeek): DayOfWeek {
  if (availableDays.includes(preferredLongRunDay)) return preferredLongRunDay;
  if (availableDays.includes("sunday")) return "sunday";
  if (availableDays.includes("saturday")) return "saturday";
  return availableDays[availableDays.length - 1] ?? preferredLongRunDay;
}

function redistributeWeekSlots(week: WeeklyStructure, input: RunnerInput): WeeklyStructure {
  const availableDays = sortDays(input.availableTrainingDays.length > 0 ? input.availableTrainingDays : DEFAULT_DAYS);
  if (week.slots.length <= 1 || availableDays.length <= 1 || week.slots.length > availableDays.length) return week;

  const preferredLongRunDay = chooseLongRunDay(input);
  const keyDay = chooseKeyDay(availableDays, preferredLongRunDay);
  const longRunIndex = week.slots.findIndex((slot) => slot.role === "long_run");
  const keySlotIndex =
    longRunIndex >= 0
      ? longRunIndex
      : week.slots.reduce((bestIndex, slot, index, slots) => {
          const best = slots[bestIndex];
          const bestLoad = best?.targetDurationMin ?? 0;
          const slotLoad = slot.targetDurationMin ?? 0;
          if (slot.role === "quality" && best?.role !== "quality") return index;
          return slotLoad > bestLoad ? index : bestIndex;
        }, 0);

  const targetDays =
    week.slots.length >= availableDays.length
      ? availableDays
      : (() => {
          const beforeKey = availableDays.filter((day) => DAY_ORDER.indexOf(day) < DAY_ORDER.indexOf(keyDay));
          const fallbackDays = availableDays.filter((day) => day !== keyDay);
          const supportCount = Math.max(0, week.slots.length - 1);
          const supportDays = pickPatternDays(beforeKey.length >= supportCount ? beforeKey : fallbackDays, supportCount);
          return sortDays([...supportDays, keyDay]);
        })();

  const supportSlots = week.slots.filter((_, index) => index !== keySlotIndex);
  const supportDays = targetDays.filter((day) => day !== keyDay);
  const reassignedSupportSlots = assignSupportDays(supportSlots, supportDays);
  let supportPointer = 0;
  const slots = week.slots.map((slot, index) => {
    if (index === keySlotIndex) return { ...slot, day: keyDay };
    const reassigned = reassignedSupportSlots[supportPointer] ?? slot;
    supportPointer += 1;
    return reassigned;
  });

  return {
    ...week,
    longRunDay: slots.find((slot) => slot.role === "long_run")?.day ?? week.longRunDay,
    qualityDays: slots.filter((slot) => slot.role === "quality").map((slot) => slot.day),
    easyDays: slots.filter((slot) => slot.role === "easy" || slot.role === "aerobic_support").map((slot) => slot.day),
    recoveryDays: slots.filter((slot) => slot.role === "recovery").map((slot) => slot.day),
    slots,
  };
}

export function placeSessionsOnDays(weeklyStructures: WeeklyStructure[], input: RunnerInput): WeeklyStructure[] {
  return weeklyStructures.map((week) => redistributeWeekSlots(week, input));
}
