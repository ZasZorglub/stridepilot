import { classifyRunner } from "../runnerClassification";
import type { RunnerClassification, RunnerInput } from "../models";

export function determineRunnerLevel(profile: RunnerInput): RunnerClassification {
  return classifyRunner(profile);
}
