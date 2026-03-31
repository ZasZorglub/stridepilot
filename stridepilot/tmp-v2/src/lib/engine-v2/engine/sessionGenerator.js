"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSessions = generateSessions;
const sessionBuilder_1 = require("../sessionBuilder");
const sessionValidation_1 = require("../sessionValidation");
const workoutSelection_1 = require("../workoutSelection");
function weekFocus(phase, timelinePhase, isCutback) {
    if (timelinePhase === "race")
        return "måluge med friskhed, rytme og klarhed frem mod løbet";
    if (isCutback)
        return "stabilisering og absorption";
    if (phase === "base")
        return "stabilisere base og skabe rytme";
    if (phase === "build")
        return "bygge volumen og udholdenhed";
    if (phase === "specific")
        return "mere målrettet race-relevant arbejde";
    if (phase === "peak")
        return "planens skarpeste og mest specifikke uger";
    return "friskhed og rytme frem mod målet";
}
function generateSessions(params) {
    const weeks = params.weeklyStructures.map((structure) => {
        const selections = (0, workoutSelection_1.chooseWorkoutSelections)(structure, structure.phase, params.planType, params.input.goalType, params.classification, params.curves.backboneType);
        const sessions = selections.map((selection) => (0, sessionBuilder_1.buildSession)(params.input, params.classification, params.planType, structure.phase, params.curves, selection));
        const validationIssues = (0, sessionValidation_1.validateWeeklySessions)(sessions, selections, structure, params.classification, params.planType);
        return {
            weekIndex: structure.weekIndex,
            phase: structure.phase,
            timelinePhase: structure.isRaceWeek ? "race" : structure.phase,
            isCutback: params.curves.cutbackWeeks.includes(structure.weekIndex),
            isRaceWeek: Boolean(structure.isRaceWeek),
            volumeTargetMin: structure.weeklyVolumeTargetMin,
            longRunTargetMin: structure.longRunTargetMin,
            intensityTarget: structure.intensityTarget,
            focus: weekFocus(structure.phase, structure.isRaceWeek ? "race" : structure.phase, params.curves.cutbackWeeks.includes(structure.weekIndex)),
            sessions,
            workoutSelections: selections,
            validationIssues,
        };
    });
    for (const issue of (0, sessionValidation_1.validateSessionSeries)(weeks, params.classification, params.planType)) {
        const targetWeek = issue.weekIndex ? weeks.find((week) => week.weekIndex === issue.weekIndex) : weeks[weeks.length - 1];
        if (targetWeek) {
            targetWeek.validationIssues = [...(targetWeek.validationIssues ?? []), issue];
        }
    }
    return weeks;
}
