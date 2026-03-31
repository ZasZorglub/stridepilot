"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.determineBackboneType = determineBackboneType;
exports.buildBackboneProgression = buildBackboneProgression;
const backboneSelection_1 = require("../backboneSelection");
const progressionCurves_1 = require("../progressionCurves");
function determineBackboneType(profile, goal, classification) {
    return (0, backboneSelection_1.selectBackbone)(profile, classification, goal);
}
function buildBackboneProgression(params) {
    return (0, progressionCurves_1.buildProgressionCurves)(params.input, params.classification, params.goalClassification, params.backboneSelection, params.phasePlan, params.planType);
}
