"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ONBOARDING_STEP_COUNT = exports.ONBOARDING_STEPS = void 0;
exports.getSuggestedPlanStartDate = getSuggestedPlanStartDate;
exports.buildPlanStartDateHelpText = buildPlanStartDateHelpText;
exports.buildRecommendationLeadCopy = buildRecommendationLeadCopy;
exports.getOnboardingStepDefinition = getOnboardingStepDefinition;
exports.getGoalTypeOptions = getGoalTypeOptions;
exports.isGoalTypeAllowed = isGoalTypeAllowed;
exports.mapAbilityToRunningExperience = mapAbilityToRunningExperience;
exports.deriveBaselineLoadFromAbility = deriveBaselineLoadFromAbility;
exports.hasRecentRaceEntry = hasRecentRaceEntry;
exports.recentRaceDraftFromEntries = recentRaceDraftFromEntries;
exports.isCompleteRecentRaceTime = isCompleteRecentRaceTime;
exports.recentRaceTimePartsFromString = recentRaceTimePartsFromString;
exports.buildRecentRaceTimeFromParts = buildRecentRaceTimeFromParts;
exports.buildRecentRaceTimes = buildRecentRaceTimes;
exports.recentRaceSummaryLabel = recentRaceSummaryLabel;
exports.recentRaceDraftSummaryLabel = recentRaceDraftSummaryLabel;
const GOAL_TYPE_LABELS = {
    complete: "Gennemføre",
    run_without_walking: "Løbe uden gangpauser",
    target_time: "Løbe i et bestemt tempo",
    pr: "Sæt PR",
};
const ABILITY_RANK = {
    helt_ny: 0,
    fem_min: 1,
    ti_femten_min: 2,
    tyve_tredive_min: 3,
    mere_end_tredive_min: 4,
};
exports.ONBOARDING_STEPS = [
    {
        index: 1,
        id: "intro",
        title: "Lad os starte roligt",
        subtitle: "Kun det vigtigste først.",
        nextLabel: "Fortsæt",
    },
    {
        index: 2,
        id: "running_level",
        title: "Hvad kan du løbe i dag?",
        subtitle: "Vælg det, der føles realistisk lige nu.",
        nextLabel: "Fortsæt",
    },
    {
        index: 3,
        id: "target_distance",
        title: "Hvad træner du frem mod?",
        subtitle: "Vælg den distance, du gerne vil bygge op til.",
        nextLabel: "Fortsæt",
    },
    {
        index: 4,
        id: "goal_type",
        title: "Hvad vil du gerne kunne?",
        subtitle: "Jeg viser kun de mål, der passer til dit udgangspunkt.",
        nextLabel: "Fortsæt",
    },
    {
        index: 5,
        id: "weekly_structure",
        title: "Hvordan skal ugen passe ind?",
        subtitle: "Kun de rammer, der betyder mest i hverdagen.",
        nextLabel: "Fortsæt",
    },
    {
        index: 6,
        id: "plan_style",
        title: "Hvordan skal planen bygges?",
        subtitle: "Vælg tempoet i planen og tag højde for resten af din hverdag.",
        nextLabel: "Fortsæt",
    },
    {
        index: 7,
        id: "constraints",
        title: "Noget jeg skal tage hensyn til?",
        subtitle: "Valgfrit. Et par korte noter er nok.",
        nextLabel: "Fortsæt",
    },
    {
        index: 8,
        id: "extra_profile",
        title: "Ekstra detaljer",
        subtitle: "Valgfrit. Kun hvis du vil finjustere anbefalingen.",
        nextLabel: "Se min plan",
        optional: true,
    },
];
exports.ONBOARDING_STEP_COUNT = exports.ONBOARDING_STEPS.length;
function getSuggestedPlanStartDate(referenceDate = new Date()) {
    const localDate = new Date(referenceDate.getTime() - referenceDate.getTimezoneOffset() * 60000);
    return localDate.toISOString().slice(0, 10);
}
function buildPlanStartDateHelpText(startDateIso, todayDateIso) {
    if (!startDateIso) {
        return "Vælg den dag, du helst vil begynde med uge 1.";
    }
    if (startDateIso === todayDateIso) {
        return "Jeg lægger uge 1 fra i dag, så du kan komme roligt i gang med det samme.";
    }
    return "Jeg lægger uge 1 fra den dato, så planen starter, når det passer dig bedst.";
}
function buildRecommendationLeadCopy(summary, planLevelExplanation) {
    const trimmedSummary = summary.trim();
    const trimmedExplanation = planLevelExplanation?.trim();
    if (!trimmedExplanation) {
        return trimmedSummary;
    }
    if (!trimmedSummary) {
        return trimmedExplanation;
    }
    const normalizedSummary = trimmedSummary.toLowerCase();
    const normalizedExplanation = trimmedExplanation.toLowerCase();
    if (normalizedSummary.includes(normalizedExplanation) ||
        normalizedExplanation.includes(normalizedSummary)) {
        return trimmedSummary.length >= trimmedExplanation.length ? trimmedSummary : trimmedExplanation;
    }
    if (trimmedSummary.length >= 70) {
        return trimmedSummary;
    }
    return `${trimmedSummary} ${trimmedExplanation}`;
}
function getOnboardingStepDefinition(stepIndex) {
    return exports.ONBOARDING_STEPS.find((step) => step.index === stepIndex) ?? exports.ONBOARDING_STEPS[0];
}
function getGoalTypeOptions(distance, ability) {
    const abilityRank = ABILITY_RANK[ability];
    const options = ["complete"];
    if ((distance === "5K" || distance === "10K") && abilityRank < 4) {
        options.push("run_without_walking");
    }
    const targetTimeThreshold = {
        "5K": 1,
        "10K": 2,
        Halvmaraton: 3,
        Marathon: 4,
    };
    const prThreshold = {
        "5K": 2,
        "10K": 3,
        Halvmaraton: 4,
        Marathon: 4,
    };
    if (abilityRank >= targetTimeThreshold[distance]) {
        options.push("target_time");
    }
    if (abilityRank >= prThreshold[distance]) {
        options.push("pr");
    }
    return options.map((value) => ({ value, label: GOAL_TYPE_LABELS[value] }));
}
function isGoalTypeAllowed(distance, ability, goalType) {
    if (!goalType)
        return false;
    return getGoalTypeOptions(distance, ability).some((option) => option.value === goalType);
}
function mapAbilityToRunningExperience(ability) {
    if (ability === "mere_end_tredive_min")
        return "ovet";
    if (ability === "tyve_tredive_min" || ability === "ti_femten_min")
        return "let_ovet";
    return "nybegynder";
}
function deriveBaselineLoadFromAbility(ability) {
    switch (ability) {
        case "helt_ny":
            return { currentWeeklyVolumeKm: 0, currentRunsPerWeek: 0, longestCurrentRunMin: 0 };
        case "fem_min":
            return { currentWeeklyVolumeKm: 4, currentRunsPerWeek: 2, longestCurrentRunMin: 8 };
        case "ti_femten_min":
            return { currentWeeklyVolumeKm: 8, currentRunsPerWeek: 2, longestCurrentRunMin: 15 };
        case "tyve_tredive_min":
            return { currentWeeklyVolumeKm: 14, currentRunsPerWeek: 3, longestCurrentRunMin: 30 };
        case "mere_end_tredive_min":
            return { currentWeeklyVolumeKm: 22, currentRunsPerWeek: 3, longestCurrentRunMin: 45 };
    }
}
function hasRecentRaceEntry(recentRaceTimes) {
    return Boolean(recentRaceTimes?.[0]?.distance && recentRaceTimes?.[0]?.time);
}
function recentRaceDraftFromEntries(recentRaceTimes) {
    const firstEntry = recentRaceTimes?.[0];
    return firstEntry
        ? { distance: firstEntry.distance, time: firstEntry.time }
        : { distance: "", time: "" };
}
function clampPickerPart(value, min, max) {
    return Math.max(min, Math.min(max, Math.floor(value)));
}
function isCompleteRecentRaceTime(value) {
    return /^\d{1,2}:\d{2}(?::\d{2})?$/.test(value.trim());
}
function recentRaceTimePartsFromString(value) {
    if (!value || !isCompleteRecentRaceTime(value)) {
        return { hours: 0, minutes: 0, seconds: 0 };
    }
    const parts = value.split(":").map((part) => Number(part));
    if (parts.length === 2) {
        return {
            hours: 0,
            minutes: clampPickerPart(parts[0] ?? 0, 0, 59),
            seconds: clampPickerPart(parts[1] ?? 0, 0, 59),
        };
    }
    return {
        hours: clampPickerPart(parts[0] ?? 0, 0, 9),
        minutes: clampPickerPart(parts[1] ?? 0, 0, 59),
        seconds: clampPickerPart(parts[2] ?? 0, 0, 59),
    };
}
function buildRecentRaceTimeFromParts(parts) {
    const hours = clampPickerPart(parts.hours, 0, 9);
    const minutes = clampPickerPart(parts.minutes, 0, 59);
    const seconds = clampPickerPart(parts.seconds, 0, 59);
    if (hours === 0 && minutes === 0 && seconds === 0)
        return "";
    if (hours > 0)
        return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
function buildRecentRaceTimes(distance, time) {
    const normalizedTime = buildRecentRaceTimeFromParts(recentRaceTimePartsFromString(time));
    return distance && isCompleteRecentRaceTime(normalizedTime) ? [{ distance, time: normalizedTime }] : [];
}
function recentRaceSummaryLabel(recentRaceTimes) {
    const firstEntry = recentRaceTimes?.[0];
    if (!firstEntry?.distance || !firstEntry.time)
        return null;
    return `${firstEntry.distance} · ${firstEntry.time}`;
}
function recentRaceDraftSummaryLabel(draft) {
    return recentRaceSummaryLabel(buildRecentRaceTimes(draft.distance, draft.time));
}
