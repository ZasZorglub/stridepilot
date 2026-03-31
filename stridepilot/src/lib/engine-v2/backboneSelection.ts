import type { BackboneSelection, GoalClassification, RunnerClassification, RunnerInput } from "./models";

export function selectBackbone(
  input: RunnerInput,
  classification: RunnerClassification,
  goalClassification: GoalClassification,
): BackboneSelection {
  const reasons: string[] = [];
  const veryLowContinuousCapacity = input.currentContinuousRunMin <= 8;
  const lowContinuousCapacity = input.currentContinuousRunMin <= 25;
  const continuityFocusedGoal = goalClassification.demand === "continuity_first" || goalClassification.demand === "reentry" || goalClassification.demand === "consistency_first";
  const returningRunner = input.goalType === "return_to_running" || classification.traits.primaryRunnerType === "return_to_running";
  const trueBeginner = classification.traits.runnerLevel === "true_beginner";
  const beginnerPlus = classification.traits.runnerLevel === "beginner_plus";
  const shortBeginnerGoal = input.raceDistance === "5K" && (input.goalType === "finish_without_walking" || input.goalType === "finish" || input.goalType === "build_consistency");
  const continuityLed10kFinish =
    input.raceDistance === "10K" &&
    input.goalType === "finish" &&
    (trueBeginner || beginnerPlus || lowContinuousCapacity);

  if (returningRunner || goalClassification.demand === "reentry" || goalClassification.demand === "consistency_first") {
    reasons.push("Runneren er i et comeback- eller vaneopbyggende forløb, så sammenhængende løbetid er den vigtigste progression-driver.");
    return {
      type: "continuous_backbone",
      primaryMetric: "continuous_running",
      reasons,
    };
  }

  if ((trueBeginner || veryLowContinuousCapacity || continuityFocusedGoal) && shortBeginnerGoal) {
    if (trueBeginner) reasons.push("Runneren er en ægte begynder, så progressionen skal styres af sammenhængende løbetid før andet.");
    if (veryLowContinuousCapacity) reasons.push("Den nuværende sammenhængende løbekapacitet er lav, så continuity er den mest stabile primære driver.");
    if (continuityFocusedGoal) reasons.push("Målet handler primært om kontinuitet og sikker opbygning frem for distance-specifik belastning.");
    return {
      type: "continuous_backbone",
      primaryMetric: "continuous_running",
      reasons,
    };
  }

  if (continuityLed10kFinish) {
    if (trueBeginner || beginnerPlus) reasons.push("Runneren er stadig tæt nok på beginner-niveau til, at 10K-forløbet skal bygges som en længere continuity-progression.");
    if (lowContinuousCapacity) reasons.push("Den sammenhængende løbekapacitet er stadig begrænset, så 10K-planen bør ligne et gradvist Couch-to-10K-forløb mere end et erfarent distanceprogram.");
    reasons.push("Derfor skal sammenhængende løbetid være den primære driver, mens langturen støtter opbygningen i baggrunden.");
    return {
      type: "continuous_backbone",
      primaryMetric: "continuous_running",
      reasons,
    };
  }

  reasons.push("Planen er distanceorienteret nok til, at langturen skal være den primære progression-driver.");
  reasons.push("Ugentlig volumen og støtteløb skal derfor afledes af langturens opbygning frem mod målet.");
  return {
    type: "long_run_backbone",
    primaryMetric: "long_run",
    reasons,
  };
}
