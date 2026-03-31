"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPlausibleMaxHeartRate = isPlausibleMaxHeartRate;
exports.parseMaxHeartRateInput = parseMaxHeartRateInput;
exports.buildPulseGuidanceSummary = buildPulseGuidanceSummary;
exports.buildPulseGuidanceWarning = buildPulseGuidanceWarning;
function isPlausibleMaxHeartRate(value) {
    return typeof value === "number" && Number.isFinite(value) && value >= 120 && value <= 240;
}
function parseMaxHeartRateInput(value) {
    const trimmed = value.trim();
    if (!trimmed)
        return null;
    if (!/^\d{2,3}$/.test(trimmed))
        return null;
    const parsed = Number(trimmed);
    return isPlausibleMaxHeartRate(parsed) ? parsed : null;
}
function buildPulseGuidanceSummary(settings) {
    if (!settings.enabled) {
        return "Puls er slået fra som ekstra guide.";
    }
    if (isPlausibleMaxHeartRate(settings.maxHeartRate)) {
        return `Puls bruges som ekstra guide med makspuls ${settings.maxHeartRate}.`;
    }
    return "Puls bruges som ekstra guide, når du vil tilføje din makspuls.";
}
function buildPulseGuidanceWarning(value, enabled) {
    if (!enabled || !value.trim())
        return null;
    if (/^\d$/.test(value.trim()))
        return null;
    if (parseMaxHeartRateInput(value) !== null)
        return null;
    return "Makspuls skal være et realistisk tal mellem 120 og 240.";
}
