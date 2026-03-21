"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInitialTrainingBlock = createInitialTrainingBlock;
exports.updateTrainingBlock = updateTrainingBlock;
function clampWeekIndex(value) {
    return Math.max(1, Math.round(value));
}
function createInitialTrainingBlock() {
    return {
        phase: "build",
        weekIndex: 1,
    };
}
function updateTrainingBlock(previous, decision) {
    if (decision.type === "recovery_block") {
        return {
            phase: "recover",
            weekIndex: 1,
        };
    }
    if (decision.type === "reduce_load") {
        return {
            phase: "stabilize",
            weekIndex: 1,
        };
    }
    if (decision.type === "progress") {
        const nextWeekIndex = clampWeekIndex(previous.weekIndex + 1);
        if (nextWeekIndex >= 4) {
            return {
                phase: "recover",
                weekIndex: 1,
            };
        }
        return {
            phase: previous.phase,
            weekIndex: nextWeekIndex,
        };
    }
    if (previous.weekIndex >= 4) {
        return {
            phase: "recover",
            weekIndex: 1,
        };
    }
    return {
        phase: previous.phase,
        weekIndex: clampWeekIndex(previous.weekIndex),
    };
}
