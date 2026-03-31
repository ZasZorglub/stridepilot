import { buildFullPlan } from "./engine/buildPlan";
import type { EnginePlan, RunnerInput } from "./models";

export function generateEngineV2Plan(input: RunnerInput): EnginePlan {
  return buildFullPlan(input);
}
