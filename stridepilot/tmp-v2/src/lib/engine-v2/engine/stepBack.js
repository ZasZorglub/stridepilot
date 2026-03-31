"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertStepBackWeeks = insertStepBackWeeks;
function insertStepBackWeeks(curves) {
    return {
        curves,
        stepBackWeeks: [...curves.cutbackWeeks],
    };
}
