"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.determineRunnerLevel = determineRunnerLevel;
const runnerClassification_1 = require("../runnerClassification");
function determineRunnerLevel(profile) {
    return (0, runnerClassification_1.classifyRunner)(profile);
}
