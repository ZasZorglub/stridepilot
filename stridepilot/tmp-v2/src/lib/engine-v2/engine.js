"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateEngineV2Plan = generateEngineV2Plan;
const buildPlan_1 = require("./engine/buildPlan");
function generateEngineV2Plan(input) {
    return (0, buildPlan_1.buildFullPlan)(input);
}
