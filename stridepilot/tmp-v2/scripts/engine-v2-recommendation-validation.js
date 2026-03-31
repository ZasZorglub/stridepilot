"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const engine_v2_1 = require("../src/lib/engine-v2");
const fixtures = [
    {
        name: "true_beginner_5k_no_walk",
        input: {
            raceDistance: "5K",
            goalType: "finish_without_walking",
            startDate: "2026-03-23",
            currentContinuousRunMin: 0,
            currentWeeklyRuns: 0,
            currentWeeklyVolumeKm: 0,
            longestRecentRunMin: 0,
            recentConsistency: 0.05,
            availableTrainingDays: ["tuesday", "thursday", "sunday"],
            typicalAvailableTimeMin: 30,
            trainingStylePreference: "conservative",
            ambitionPreference: "standard",
            experienceLevel: "none",
            injuryConcern: "low",
            externalTrainingLoad: "none",
            confidence: 2,
        },
    },
    {
        name: "beginner_plus_10k_finish",
        input: {
            raceDistance: "10K",
            goalType: "finish",
            startDate: "2026-03-23",
            currentContinuousRunMin: 20,
            currentWeeklyRuns: 3,
            currentWeeklyVolumeKm: 16,
            longestRecentRunMin: 28,
            recentConsistency: 0.58,
            availableTrainingDays: ["tuesday", "thursday", "sunday"],
            typicalAvailableTimeMin: 45,
            trainingStylePreference: "balanced",
            ambitionPreference: "standard",
            experienceLevel: "recreational",
            injuryConcern: "low",
            externalTrainingLoad: "light",
            confidence: 3,
        },
    },
    {
        name: "marathon_finish_low_availability",
        input: {
            raceDistance: "Marathon",
            goalType: "finish",
            startDate: "2026-03-23",
            currentContinuousRunMin: 50,
            currentWeeklyRuns: 3,
            currentWeeklyVolumeKm: 28,
            longestRecentRunMin: 85,
            recentConsistency: 0.62,
            availableTrainingDays: ["tuesday", "thursday", "sunday"],
            typicalAvailableTimeMin: 65,
            trainingStylePreference: "balanced",
            ambitionPreference: "standard",
            experienceLevel: "recreational",
            injuryConcern: "low",
            externalTrainingLoad: "moderate",
            confidence: 3,
        },
    },
    {
        name: "intermediate_10k_improve_ambitious_request",
        input: {
            raceDistance: "10K",
            goalType: "improve_time",
            startDate: "2026-03-23",
            requestedDurationWeeks: 8,
            currentContinuousRunMin: 40,
            currentWeeklyRuns: 4,
            currentWeeklyVolumeKm: 30,
            longestRecentRunMin: 55,
            recentConsistency: 0.82,
            availableTrainingDays: ["monday", "wednesday", "friday", "sunday"],
            typicalAvailableTimeMin: 60,
            trainingStylePreference: "performance",
            ambitionPreference: "ambitious",
            experienceLevel: "intermediate",
            injuryConcern: "low",
            confidence: 4,
        },
    },
];
for (const fixture of fixtures) {
    const classification = (0, engine_v2_1.classifyRunner)(fixture.input);
    const { goalClassification, recommendation } = (0, engine_v2_1.buildTimelineRecommendation)(fixture.input, classification);
    const plan = (0, engine_v2_1.generateEngineV2Plan)(fixture.input);
    console.log(`\n=== ${fixture.name} ===`);
    console.log(`classification=${classification.traits.primaryRunnerType} | level=${classification.traits.runnerLevel} | consistency=${classification.traits.consistencyProfile} | risk=${classification.traits.injuryRiskScore}`);
    console.log(`goal=${goalClassification.demand} | complexity=${goalClassification.recommendedComplexity} | specificity=${goalClassification.specificityNeed}`);
    console.log(`timeline=recommended:${recommendation.recommendedDurationWeeks}w final:${recommendation.finalDurationWeeks}w realism:${recommendation.realism} progression:${recommendation.recommendedProgressionMode}`);
    console.log(`sessions=start:${recommendation.startingSessionsPerWeek} rec:${recommendation.recommendedSessionsPerWeek} peak:${recommendation.peakSessionsPerWeek}`);
    console.log(`summary=${recommendation.explanation.summary}`);
    console.log(`warnings=${recommendation.warnings.length > 0 ? recommendation.warnings.join(" | ") : "none"}`);
    console.log(`materialized_plan=goalDate:${plan.resolvedInput.goalDate} weeks:${plan.phasePlan.totalWeeks} planType:${plan.planTypeDecision.planType}`);
}
