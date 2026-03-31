import type { SelectWeeklyTemplateInput, WeeklyTemplateDefinition, WeeklySkeletonRole } from "../types";
import { getTaperStrategy } from "../phases/taperStrategies";
import { buildRaceWeekRoles } from "./raceWeekTemplates";
import { weeklyTemplates } from "./weeklyTemplates";

function simplifyForStepBack(roles: WeeklySkeletonRole[]): WeeklySkeletonRole[] {
  let qualityRemoved = false;

  return roles.map((role) => {
    if (role === "long_with_segments") return "long_short";
    if (role === "race_pace" || role === "intervals" || role === "threshold" || role === "short_quality") {
      if (!qualityRemoved) {
        qualityRemoved = true;
        return "steady";
      }
      return "easy";
    }
    if (role === "race_pace_short") return "easy";
    return role;
  });
}

function candidateSessionCounts(sessionsPerWeek: number): number[] {
  const unique = new Set<number>([
    sessionsPerWeek,
    Math.max(2, sessionsPerWeek - 1),
    Math.min(5, sessionsPerWeek + 1),
    3,
    4,
    5,
    2,
  ]);

  return [...unique];
}

export function selectWeeklyTemplate(input: SelectWeeklyTemplateInput): WeeklyTemplateDefinition {
  const phase = input.phase;
  const raceDistance = input.raceDistance ?? "10K";
  const goalType = input.goalType ?? input.archetype.goalType;

  if (phase === "race_week") {
    return {
      archetypeId: input.archetype.id,
      phase,
      sessionsPerWeek: input.sessionsPerWeek,
      roles: buildRaceWeekRoles({
        goalType,
        raceDistance,
        sessionsPerWeek: input.sessionsPerWeek,
      }),
    };
  }

  const candidates = candidateSessionCounts(input.sessionsPerWeek);

  const match =
    candidates
      .map((count) =>
        weeklyTemplates.find(
          (template) =>
            template.archetypeId === input.archetype.id &&
            template.phase === phase &&
            template.sessionsPerWeek === count,
        ),
      )
      .find(Boolean) ??
    weeklyTemplates.find(
      (template) => template.archetypeId === "beginner_finish" && template.phase === phase && template.sessionsPerWeek === 3,
    );

  if (!match) {
    return {
      archetypeId: input.archetype.id,
      phase,
      sessionsPerWeek: input.sessionsPerWeek,
      roles: input.sessionsPerWeek <= 2 ? ["easy", "long_run"] : ["easy", "support", "long_run"],
    };
  }

  let roles = input.isStepBackWeek ? simplifyForStepBack(match.roles) : match.roles;

  if (phase === "taper") {
    const strategy = getTaperStrategy({ goalType, raceDistance });
    roles = roles
      .map((role, index) => {
        if (role === "long_with_segments" || role === "long_run") return "long_short";
        if (role === "intervals" || role === "threshold" || role === "short_quality") {
          return strategy.allowSharpening && index === 1 && strategy.sharpeningFamily !== "none" ? strategy.sharpeningFamily : "easy";
        }
        if (role === "race_pace") return strategy.allowSharpening && strategy.sharpeningFamily !== "none" ? strategy.sharpeningFamily : "easy";
        return role;
      })
      .map((role, index, current) => {
        if (role === "race_pace_short" && !strategy.allowSharpening) return "easy";
        if (strategy.simplifyToSessionCount && current.length > strategy.simplifyToSessionCount && index < current.length - strategy.simplifyToSessionCount) {
          return "easy";
        }
        return role;
      });
  }

  return {
    ...match,
    sessionsPerWeek: input.sessionsPerWeek,
    roles,
  };
}
