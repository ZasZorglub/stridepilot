"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAdaptationHooks = buildAdaptationHooks;
function weekValidationSeverity(plan, weekIndex) {
    const results = plan.vNextValidation?.results.filter((result) => result.weekIndex === weekIndex) ?? [];
    if (results.some((result) => result.severity === "hard_fail"))
        return "hard_fail";
    if (results.some((result) => result.severity === "warning" || result.severity === "auto_adjust"))
        return "warning";
    return "none";
}
function isProtectedRunner(plan) {
    return Boolean(plan.returnToRunningState?.active ||
        plan.input.goalType === "return_to_running" ||
        plan.classification.traits.primaryRunnerType === "return_to_running" ||
        plan.classification.traits.primaryRunnerType === "injury_sensitive");
}
function progressionGateForWeek(plan, weekIndex) {
    const week = plan.weeks[weekIndex - 1];
    const validation = weekValidationSeverity(plan, weekIndex);
    const returnWeekState = plan.returnToRunningState?.weeklyStates.find((entry) => entry.weekIndex === weekIndex);
    if (!week)
        return "restricted";
    if (week.isRaceWeek || week.phase === "taper")
        return "restricted";
    if (validation === "hard_fail")
        return "restricted";
    if (week.isCutback)
        return "hold";
    if (returnWeekState && !returnWeekState.continuityGatePassed)
        return "restricted";
    if (validation === "warning")
        return "hold";
    if (week.phase === "peak")
        return "hold";
    return "open";
}
function buildBoundaryKinds(plan, weekIndex) {
    const week = plan.weeks[weekIndex - 1];
    const previous = plan.weeks[weekIndex - 2];
    const kinds = [];
    if (!week)
        return kinds;
    if (!previous || previous.phase !== week.phase)
        kinds.push("phase_start");
    if (week.phase === "build" && previous?.phase === "base")
        kinds.push("pre_specific");
    if (previous?.isCutback)
        kinds.push("post_cutback");
    if (previous?.isRaceWeek)
        kinds.push("post_race");
    if (plan.returnToRunningState?.active) {
        const returnWeekState = plan.returnToRunningState.weeklyStates.find((entry) => entry.weekIndex === weekIndex);
        if (returnWeekState && !returnWeekState.continuityGatePassed)
            kinds.push("protected_hold");
    }
    const next = plan.weeks[weekIndex];
    if (!next || next.phase !== week.phase)
        kinds.push("phase_end");
    return kinds;
}
function buildWeekHooks(plan, weekIndex) {
    const week = plan.weeks[weekIndex - 1];
    const gate = progressionGateForWeek(plan, weekIndex);
    const protectedRunner = isProtectedRunner(plan);
    const returnWeekState = plan.returnToRunningState?.weeklyStates.find((entry) => entry.weekIndex === weekIndex);
    const qualitySessionCount = week.sessions.filter((session) => session.role === "quality").length;
    const boundaryKinds = buildBoundaryKinds(plan, weekIndex);
    const validation = weekValidationSeverity(plan, weekIndex);
    const continuityGatePassed = returnWeekState?.continuityGatePassed ?? true;
    const repeatWeekCandidate = week.isCutback ||
        gate === "hold" ||
        validation === "warning" ||
        (protectedRunner && !continuityGatePassed);
    const recoveryMicrocycleCandidate = week.isCutback ||
        week.phase === "taper" ||
        validation !== "none" ||
        (protectedRunner && week.phase === "build" && !continuityGatePassed);
    return {
        progressionGate: gate,
        longRunAdvanceEligible: gate === "open" && !week.isCutback && !week.isRaceWeek,
        qualityAdvanceEligible: gate === "open" &&
            !week.isRaceWeek &&
            week.phase !== "taper" &&
            !protectedRunner &&
            (returnWeekState?.qualityEligible ?? true) &&
            qualitySessionCount <= 1,
        sessionCountAdvanceEligible: gate === "open" &&
            !week.isRaceWeek &&
            week.phase !== "taper" &&
            !(protectedRunner && (returnWeekState?.maxSessionsAllowed ?? 99) <= week.sessions.length),
        repeatWeekCandidate,
        recoveryMicrocycleCandidate,
        protectedRunnerBias: protectedRunner,
        boundaryKinds,
        safeReplanBoundaryBefore: boundaryKinds.includes("phase_start") || boundaryKinds.includes("post_cutback") || boundaryKinds.includes("protected_hold"),
        safeReplanBoundaryAfter: boundaryKinds.includes("phase_end") || week.isCutback || week.isRaceWeek,
    };
}
function buildPlanBoundaries(plan) {
    const boundaries = [];
    for (const week of plan.weeks) {
        const hooks = week.adaptationHooks;
        if (!hooks)
            continue;
        for (const kind of hooks.boundaryKinds) {
            boundaries.push({
                weekIndex: week.weekIndex,
                kind,
                label: kind === "phase_start"
                    ? `Start of ${week.phase}`
                    : kind === "phase_end"
                        ? `End of ${week.phase}`
                        : kind === "post_cutback"
                            ? "Week after cutback"
                            : kind === "pre_specific"
                                ? "Early build transition"
                                : kind === "post_race"
                                    ? "Post-race recovery boundary"
                                    : "Protected hold point",
            });
        }
    }
    return boundaries;
}
function buildAdaptationHooks(plan) {
    for (const week of plan.weeks) {
        week.adaptationHooks = buildWeekHooks(plan, week.weekIndex);
    }
    const protectedRunner = isProtectedRunner(plan);
    const repeatableWeekIndices = plan.weeks.filter((week) => week.adaptationHooks?.repeatWeekCandidate).map((week) => week.weekIndex);
    const recoveryCandidateWeekIndices = plan.weeks
        .filter((week) => week.adaptationHooks?.recoveryMicrocycleCandidate)
        .map((week) => week.weekIndex);
    const boundaryWeeks = buildPlanBoundaries(plan);
    return {
        adaptationReady: true,
        protectedRunner,
        progressionMode: protectedRunner ? "conservative" : "standard",
        eligibleForStandardProgression: !protectedRunner,
        qualityProgressionEligible: plan.weeks.some((week) => week.adaptationHooks?.qualityAdvanceEligible),
        containsRepeatCandidates: repeatableWeekIndices.length > 0,
        containsRecoveryCandidates: recoveryCandidateWeekIndices.length > 0,
        containsProtectedHoldPoints: boundaryWeeks.some((boundary) => boundary.kind === "protected_hold"),
        repeatableWeekIndices,
        recoveryCandidateWeekIndices,
        boundaryWeeks,
    };
}
