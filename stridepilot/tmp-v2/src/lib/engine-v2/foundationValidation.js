"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRunnerClassification = validateRunnerClassification;
exports.validatePlanTypeDecision = validatePlanTypeDecision;
exports.validatePhasePlan = validatePhasePlan;
function validateRunnerClassification(input, classification) {
    const issues = [];
    if (input.currentContinuousRunMin === 0 && input.currentWeeklyRuns === 0 && input.currentWeeklyVolumeKm === 0 && classification.traits.runnerLevel !== "true_beginner") {
        issues.push({ severity: "critical", area: "safety", message: "Zero-base runner did not classify as true_beginner." });
    }
    if (input.currentContinuousRunMin >= 40 && input.currentWeeklyRuns >= 4 && input.recentConsistency >= 0.75 && classification.traits.runnerLevel === "beginner_plus") {
        issues.push({ severity: "critical", area: "specificity", message: "Robust runner was misclassified as beginner_plus." });
    }
    if (input.goalType === "return_to_running" && classification.traits.primaryRunnerType !== "return_to_running") {
        issues.push({ severity: "important", area: "structure", message: "Return-to-running intent was not preserved in primary runner type." });
    }
    if (classification.traits.consistencyProfile === "sporadic" && classification.traits.progressionTolerance > 0.75) {
        issues.push({ severity: "important", area: "progression", message: "Progression tolerance looks too high for a sporadic runner." });
    }
    if (input.injuryConcern === "high" && classification.traits.injuryRiskScore < 0.45) {
        issues.push({ severity: "important", area: "safety", message: "High injury concern is not strongly reflected in injury-risk scoring." });
    }
    if ((input.availableTrainingDays.length <= 2 || input.typicalAvailableTimeMin <= 35) && classification.traits.scheduleConstraintLevel === "low") {
        issues.push({ severity: "important", area: "structure", message: "Low availability is not reflected in schedule constraint level." });
    }
    if (input.trainingStylePreference === "performance" &&
        (input.goalType === "improve_time" || input.goalType === "target_time") &&
        classification.traits.runnerLevel !== "true_beginner" &&
        !classification.traits.modifiers.includes("performance_bias")) {
        issues.push({ severity: "minor", area: "specificity", message: "Performance intent is not visible in runner modifiers." });
    }
    return issues;
}
function validatePlanTypeDecision(input, classification, decision) {
    const issues = [];
    if (input.goalType === "target_time" && decision.planType.includes("finish")) {
        issues.push({ severity: "critical", area: "specificity", message: "Target-time goal mapped to a finish-oriented plan type." });
    }
    if (input.goalType === "build_consistency" && decision.planType !== "consistency_builder") {
        issues.push({ severity: "important", area: "structure", message: "Consistency-first goal should usually map to consistency_builder." });
    }
    if (input.raceDistance === "10K" &&
        input.goalType === "finish_without_walking" &&
        classification.traits.runnerLevel !== "true_beginner" &&
        decision.planType === "5k_finish_no_walk") {
        issues.push({ severity: "critical", area: "specificity", message: "Continuous 10K runner was pushed back into a 5K-style beginner plan type." });
    }
    return issues;
}
function validatePhasePlan(input, classification, decision, phasePlan) {
    const issues = [];
    const totalFromBlocks = phasePlan.blocks.reduce((sum, block) => sum + block.weeks, 0);
    if (totalFromBlocks !== phasePlan.totalWeeks) {
        issues.push({ severity: "critical", area: "structure", message: "Phase block weeks do not sum to total plan weeks." });
    }
    const taperWeeks = phasePlan.blocks.filter((block) => block.phase === "taper").reduce((sum, block) => sum + block.weeks, 0);
    if ((decision.planType.includes("marathon") || decision.planType.includes("hm")) && taperWeeks === 0) {
        issues.push({ severity: "critical", area: "progression", message: "Longer-distance plan is missing a taper." });
    }
    const specificWeeks = phasePlan.blocks.filter((block) => block.phase === "specific" || block.phase === "peak").reduce((sum, block) => sum + block.weeks, 0);
    if ((classification.traits.runnerLevel === "true_beginner" || classification.traits.runnerLevel === "beginner_plus") && specificWeeks > Math.ceil(phasePlan.totalWeeks * 0.35)) {
        issues.push({ severity: "important", area: "safety", message: "Beginner-oriented plan overemphasizes specific/peak weeks." });
    }
    const baseWeeks = phasePlan.blocks.filter((block) => block.phase === "base").reduce((sum, block) => sum + block.weeks, 0);
    const buildWeeks = phasePlan.blocks.filter((block) => block.phase === "build").reduce((sum, block) => sum + block.weeks, 0);
    if (decision.planType.includes("marathon") && (baseWeeks < 4 || buildWeeks < 4)) {
        issues.push({ severity: "important", area: "progression", message: "Marathon plan should contain meaningful base and build time." });
    }
    if (decision.planType === "return_to_running" && specificWeeks > Math.ceil(phasePlan.totalWeeks * 0.2)) {
        issues.push({ severity: "important", area: "safety", message: "Return-to-running plan should stay base-heavy and low-specificity." });
    }
    if (input.goalType === "target_time" && taperWeeks < 1) {
        issues.push({ severity: "important", area: "progression", message: "Target-time plans should preserve a real taper phase." });
    }
    return issues;
}
