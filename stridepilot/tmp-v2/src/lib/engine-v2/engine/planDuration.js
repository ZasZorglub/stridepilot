"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.determinePlanDuration = determinePlanDuration;
const timelineRecommendation_1 = require("../timelineRecommendation");
function determinePlanDuration(profile, goal, classification) {
    const mergedInput = {
        ...profile,
        raceDistance: goal.raceDistance,
        goalType: goal.goalType,
    };
    const { goalClassification, recommendation } = (0, timelineRecommendation_1.buildTimelineRecommendation)(mergedInput, classification);
    return {
        goalClassification,
        timelineRecommendation: recommendation,
        resolvedInput: (0, timelineRecommendation_1.applyTimelineRecommendation)(mergedInput, recommendation),
    };
}
