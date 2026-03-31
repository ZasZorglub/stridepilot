"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRecentSessions = exports.updateSessionHistory = exports.createInitialSessionHistory = exports.updateTrainingBlock = exports.createInitialTrainingBlock = exports.evaluateTrainingTrend = exports.generateProgressionPreview = exports.generateCoachExplanation = exports.evaluateRunnerState = exports.updateRunnerState = exports.createInitialRunnerState = exports.decideAdaptationMode = exports.summarizeNextWeekShift = exports.adaptUpcomingSessions = exports.updateCapability = exports.createInitialCapabilityState = exports.capabilityStorageKey = exports.getWorkoutPurpose = void 0;
__exportStar(require("./types"), exports);
__exportStar(require("./classification"), exports);
__exportStar(require("./interpreter"), exports);
__exportStar(require("./workouts"), exports);
__exportStar(require("./build5kPlan"), exports);
__exportStar(require("./buildTenKDistancePlan"), exports);
__exportStar(require("./explanations"), exports);
__exportStar(require("./adapt"), exports);
__exportStar(require("./mapToAppPlan"), exports);
__exportStar(require("./dialogue/types"), exports);
__exportStar(require("./dialogue/createInterpretation"), exports);
__exportStar(require("./dialogue/applyUserReply"), exports);
var workoutPurpose_1 = require("./workoutPurpose");
Object.defineProperty(exports, "getWorkoutPurpose", { enumerable: true, get: function () { return workoutPurpose_1.getWorkoutPurpose; } });
var capability_1 = require("./capability");
Object.defineProperty(exports, "capabilityStorageKey", { enumerable: true, get: function () { return capability_1.capabilityStorageKey; } });
Object.defineProperty(exports, "createInitialCapabilityState", { enumerable: true, get: function () { return capability_1.createInitialCapabilityState; } });
var updateCapability_1 = require("./updateCapability");
Object.defineProperty(exports, "updateCapability", { enumerable: true, get: function () { return updateCapability_1.updateCapability; } });
var adaptUpcomingSessions_1 = require("./adaptUpcomingSessions");
Object.defineProperty(exports, "adaptUpcomingSessions", { enumerable: true, get: function () { return adaptUpcomingSessions_1.adaptUpcomingSessions; } });
Object.defineProperty(exports, "summarizeNextWeekShift", { enumerable: true, get: function () { return adaptUpcomingSessions_1.summarizeNextWeekShift; } });
var adaptationMode_1 = require("./adaptationMode");
Object.defineProperty(exports, "decideAdaptationMode", { enumerable: true, get: function () { return adaptationMode_1.decideAdaptationMode; } });
var runnerState_1 = require("./runnerState");
Object.defineProperty(exports, "createInitialRunnerState", { enumerable: true, get: function () { return runnerState_1.createInitialRunnerState; } });
Object.defineProperty(exports, "updateRunnerState", { enumerable: true, get: function () { return runnerState_1.updateRunnerState; } });
var coachDecision_1 = require("./coachDecision");
Object.defineProperty(exports, "evaluateRunnerState", { enumerable: true, get: function () { return coachDecision_1.evaluateRunnerState; } });
var coachExplanation_1 = require("./coachExplanation");
Object.defineProperty(exports, "generateCoachExplanation", { enumerable: true, get: function () { return coachExplanation_1.generateCoachExplanation; } });
var progressionPreview_1 = require("./progressionPreview");
Object.defineProperty(exports, "generateProgressionPreview", { enumerable: true, get: function () { return progressionPreview_1.generateProgressionPreview; } });
var trainingTrend_1 = require("./trainingTrend");
Object.defineProperty(exports, "evaluateTrainingTrend", { enumerable: true, get: function () { return trainingTrend_1.evaluateTrainingTrend; } });
var trainingBlock_1 = require("./trainingBlock");
Object.defineProperty(exports, "createInitialTrainingBlock", { enumerable: true, get: function () { return trainingBlock_1.createInitialTrainingBlock; } });
Object.defineProperty(exports, "updateTrainingBlock", { enumerable: true, get: function () { return trainingBlock_1.updateTrainingBlock; } });
var sessionHistory_1 = require("./sessionHistory");
Object.defineProperty(exports, "createInitialSessionHistory", { enumerable: true, get: function () { return sessionHistory_1.createInitialSessionHistory; } });
Object.defineProperty(exports, "updateSessionHistory", { enumerable: true, get: function () { return sessionHistory_1.updateSessionHistory; } });
Object.defineProperty(exports, "getRecentSessions", { enumerable: true, get: function () { return sessionHistory_1.getRecentSessions; } });
