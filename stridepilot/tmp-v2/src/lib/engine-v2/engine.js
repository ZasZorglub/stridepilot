"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateEngineV2Plan = generateEngineV2Plan;
const explanationEngine_1 = require("./explanationEngine");
const phaseEngine_1 = require("./phaseEngine");
const planTypes_1 = require("./planTypes");
const progressionCurves_1 = require("./progressionCurves");
const runnerClassification_1 = require("./runnerClassification");
const sessionBuilder_1 = require("./sessionBuilder");
const sessionValidation_1 = require("./sessionValidation");
const validation_1 = require("./validation");
const workoutSelection_1 = require("./workoutSelection");
const weeklyStructure_1 = require("./weeklyStructure");
function weekFocus(phase, isCutback) {
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
function generateEngineV2Plan(input) {
    const classification = (0, runnerClassification_1.classifyRunner)(input);
    const planTypeDecision = (0, planTypes_1.choosePlanType)(input, classification);
    const phasePlan = (0, phaseEngine_1.buildPhasePlan)(input, classification, planTypeDecision.planType);
    const curves = (0, progressionCurves_1.buildProgressionCurves)(input, classification, phasePlan, planTypeDecision.planType);
    const weeks = phasePlan.weeks.map((phaseWeek) => {
        const structure = (0, weeklyStructure_1.buildWeeklyStructure)(input, classification, phaseWeek.phase, planTypeDecision.planType, phaseWeek.weekIndex, curves);
        const primaryLoadDimension = curves.primaryLoadDimension[phaseWeek.weekIndex - 1] ?? "stabilize";
        const selections = (0, workoutSelection_1.chooseWorkoutSelections)(structure, phaseWeek.phase, planTypeDecision.planType, classification, curves.intensityCurve[phaseWeek.weekIndex - 1], primaryLoadDimension);
        const sessions = selections.map((selection) => (0, sessionBuilder_1.buildSession)(input, classification, planTypeDecision.planType, phaseWeek.phase, curves, selection));
        const validationIssues = (0, sessionValidation_1.validateWeeklySessions)(sessions, selections, structure, classification, planTypeDecision.planType);
        return {
            weekIndex: phaseWeek.weekIndex,
            phase: phaseWeek.phase,
            isCutback: phaseWeek.isCutback,
            volumeTargetMin: curves.weeklyVolumeCurve[phaseWeek.weekIndex - 1],
            longRunTargetMin: curves.longRunCurve[phaseWeek.weekIndex - 1],
            intensityTarget: curves.intensityCurve[phaseWeek.weekIndex - 1],
            focus: weekFocus(phaseWeek.phase, phaseWeek.isCutback),
            sessions,
            workoutSelections: selections,
            validationIssues,
        };
    });
    for (const issue of (0, sessionValidation_1.validateSessionSeries)(weeks, classification, planTypeDecision.planType)) {
        const targetWeek = issue.weekIndex ? weeks.find((week) => week.weekIndex === issue.weekIndex) : weeks[weeks.length - 1];
        if (targetWeek) {
            targetWeek.validationIssues = [...(targetWeek.validationIssues ?? []), issue];
        }
    }
    const plan = {
        input,
        classification,
        planTypeDecision,
        phasePlan,
        curves,
        weeks,
        explanation: { planWhy: [], weekWhy: [] },
    };
    plan.explanation = (0, explanationEngine_1.buildCoachExplanation)(plan);
    const issues = (0, validation_1.validateEnginePlan)(plan);
    if (issues.some((issue) => issue.severity === "critical")) {
        plan.explanation.weekWhy.push(`Validation flagged ${issues.length} issue(s), including at least one critical quality concern.`);
    }
    return plan;
}
