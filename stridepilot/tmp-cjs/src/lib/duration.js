"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeStepDuration = normalizeStepDuration;
function normalizeStepDuration(seconds, min = 30, max = 20 * 60) {
    const raw = Number.isFinite(seconds) ? seconds : min;
    const clamped = Math.max(min, Math.min(max, raw));
    return Math.round(clamped / 30) * 30;
}
