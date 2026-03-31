"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateRunnerState = evaluateRunnerState;
function evaluateRunnerState(state, trend) {
    if (trend?.fatigueTrend === "rising" && trend.painTrend === "rising") {
        return {
            type: "recovery_block",
            reason: "Træthed og smerte er begge på vej op, så vi lægger en kort recovery-periode ind.",
        };
    }
    if (trend?.fatigueTrend === "rising" && trend.loadTrend === "rising") {
        return {
            type: "reduce_load",
            reason: "Belastning og træthed stiger samtidig, så vi holder progressionen mere kontrolleret.",
        };
    }
    if (trend?.fatigueTrend === "falling" && trend.loadTrend === "stable" && state.injuryRisk <= 4) {
        return {
            type: "progress",
            reason: "Trætheden falder igen, og planen ser stabil ud, så vi kan bygge lidt videre.",
        };
    }
    if (state.injuryRisk >= 8) {
        return {
            type: "recovery_block",
            reason: "Der er tegn på at kroppen er presset, så vi lægger en kort recovery-periode ind.",
        };
    }
    if (state.injuryRisk >= 6) {
        return {
            type: "reduce_load",
            reason: "Belastningen begynder at samle sig, så vi holder progressionen lidt mere kontrolleret.",
        };
    }
    if (state.confidence <= 3) {
        return {
            type: "confidence_build",
            reason: "Det vigtigste lige nu er at bygge rytme og overskud.",
        };
    }
    if (state.trainingMomentum >= 7 && state.injuryRisk <= 4) {
        return {
            type: "progress",
            reason: "Du virker stabil og har godt momentum, så vi kan begynde at bygge lidt mere på.",
        };
    }
    return {
        type: "maintain",
        reason: "Planen ser balanceret ud, så vi fortsætter i samme tempo.",
    };
}
