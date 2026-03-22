"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chooseWorkoutSelections = chooseWorkoutSelections;
function purposeForFamily(family) {
    if (family === "run_walk_progression")
        return "build_tolerance";
    if (family === "easy_run")
        return "build_consistency";
    if (family === "recovery_run")
        return "support_recovery";
    if (family === "development_run")
        return "build_aerobic_base";
    if (family === "steady_run")
        return "build_aerobic_base";
    if (family === "tempo_run")
        return "improve_threshold";
    if (family === "intervals" || family === "hill_reps" || family === "strides_session")
        return "improve_speed_support";
    if (family === "progression_run" || family === "fartlek")
        return "improve_rhythm";
    if (family === "race_specific")
        return "build_race_specific_endurance";
    return "build_long_run_durability";
}
function beginnerStage(continuousTargetMin, phase) {
    if (phase === "taper" && continuousTargetMin >= 9)
        return 4;
    if (continuousTargetMin >= 14)
        return 4;
    if (continuousTargetMin >= 10)
        return 3;
    if (continuousTargetMin >= 7)
        return 2;
    return 1;
}
function familyForRole(role, phase, planType, classification, intensity, continuousTargetMin, weeklyEmphasis, primaryLoadDimension) {
    const beginner = classification.traits.runnerLevel === "true_beginner" || classification.traits.runnerLevel === "beginner_plus";
    const stage = beginnerStage(continuousTargetMin, phase);
    if (role === "long_run") {
        if (beginner && (stage <= 3 || phase === "base"))
            return "run_walk_progression";
        return "long_run";
    }
    if (role === "recovery")
        return "recovery_run";
    if (planType === "5k_finish" || planType === "5k_finish_no_walk") {
        if (beginner) {
            if (role === "quality") {
                if (phase === "taper")
                    return stage >= 3 ? "easy_run" : "development_run";
                if (stage >= 4)
                    return phase === "specific" || phase === "peak" ? "development_run" : "easy_run";
                if (stage >= 2 && phase !== "base")
                    return "development_run";
                return "run_walk_progression";
            }
            if (role === "easy") {
                if (phase === "taper")
                    return stage >= 3 ? "easy_run" : "development_run";
                if (stage >= 4)
                    return "easy_run";
                if (stage >= 3 || (stage === 2 && phase === "specific"))
                    return "development_run";
                return "run_walk_progression";
            }
            return "run_walk_progression";
        }
        if (role === "quality")
            return phase === "specific" ? "development_run" : "easy_run";
        return "easy_run";
    }
    if (planType === "5k_improve" || planType === "5k_target_time") {
        if (role === "quality") {
            if (phase === "base")
                return "strides_session";
            if (phase === "build")
                return intensity < 0.32 ? "fartlek" : "hill_reps";
            if (phase === "specific")
                return planType === "5k_target_time" ? "intervals" : "tempo_run";
            if (phase === "peak")
                return "race_specific";
            return "strides_session";
        }
        return role === "aerobic_support" ? "steady_run" : "easy_run";
    }
    if (planType === "10k_finish") {
        if (role === "quality") {
            if (phase === "base")
                return continuousTargetMin < 30 ? "development_run" : "steady_run";
            if (phase === "build")
                return weeklyEmphasis === "recovery_absorption" ? "development_run" : "steady_run";
            if (phase === "specific")
                return weeklyEmphasis === "recovery_absorption" ? "development_run" : "steady_run";
            if (phase === "peak")
                return "progression_run";
            return "development_run";
        }
        if (role === "aerobic_support")
            return phase === "taper" ? "easy_run" : "development_run";
        return "easy_run";
    }
    if (planType === "10k_improve" || planType === "10k_target_time") {
        if (role === "quality") {
            if (phase === "base")
                return "steady_run";
            if (phase === "build")
                return intensity >= 0.3 ? "tempo_run" : "fartlek";
            if (phase === "specific")
                return planType === "10k_target_time" ? "intervals" : "tempo_run";
            if (phase === "peak")
                return "race_specific";
            return "tempo_run";
        }
        return role === "aerobic_support" ? "steady_run" : "easy_run";
    }
    if (planType === "hm_finish") {
        if (role === "quality") {
            if (phase === "base")
                return "steady_run";
            if (phase === "build")
                return weeklyEmphasis === "recovery_absorption" ? "development_run" : "steady_run";
            if (phase === "specific")
                return "progression_run";
            if (phase === "peak")
                return "steady_run";
            return "development_run";
        }
        if (role === "aerobic_support")
            return phase === "specific" ? "development_run" : "easy_run";
        return role === "easy" ? "easy_run" : "recovery_run";
    }
    if (planType === "hm_improve" || planType === "hm_target_time") {
        if (role === "quality") {
            if (phase === "base")
                return "steady_run";
            if (phase === "build")
                return "tempo_run";
            if (phase === "specific")
                return planType === "hm_target_time" ? "tempo_run" : "progression_run";
            if (phase === "peak")
                return "race_specific";
            return "steady_run";
        }
        return role === "aerobic_support" ? "steady_run" : role === "easy" ? "easy_run" : "recovery_run";
    }
    if (planType === "marathon_finish" || planType === "marathon_improve" || planType === "marathon_target_time") {
        if (role === "quality") {
            if (phase === "base")
                return "steady_run";
            if (phase === "build")
                return "progression_run";
            if (phase === "specific")
                return "race_specific";
            if (phase === "peak")
                return planType === "marathon_target_time" ? "race_specific" : "progression_run";
            return "steady_run";
        }
        if (role === "aerobic_support") {
            if (phase === "base")
                return "development_run";
            if (phase === "build")
                return primaryLoadDimension === "long_run" ? "development_run" : "steady_run";
            if (phase === "specific" || phase === "peak")
                return "development_run";
            return "development_run";
        }
        return role === "easy" ? "easy_run" : "recovery_run";
    }
    return beginner ? "run_walk_progression" : "easy_run";
}
function intensityCapForFamily(family) {
    if (family === "recovery_run")
        return "very_easy";
    if (family === "easy_run" || family === "run_walk_progression" || family === "long_run")
        return "easy";
    if (family === "development_run" || family === "steady_run" || family === "strides_session")
        return "steady";
    if (family === "fartlek" || family === "progression_run" || family === "hill_reps")
        return "moderate";
    if (family === "tempo_run" || family === "race_specific")
        return "comfortably_hard";
    return "hard";
}
function chooseWorkoutSelections(structure, phase, planType, classification, intensity, primaryLoadDimension) {
    return structure.slots.map((slot) => {
        const family = familyForRole(slot.role, phase, planType, classification, intensity, structure.continuousTargetMin, structure.weeklyEmphasis, primaryLoadDimension);
        const notes = [];
        if (slot.role === "quality" && structure.weeklyEmphasis === "taper_freshness") {
            notes.push("Keep this quality touch compact and rhythm-focused.");
        }
        if (family === "development_run" && classification.traits.runnerLevel !== "intermediate" && classification.traits.runnerLevel !== "advanced") {
            notes.push("Use this session to build continuity without making it feel like a full quality workout.");
        }
        if (planType === "hm_finish" && family === "progression_run") {
            notes.push("Keep the progression controlled and practical rather than threshold-heavy.");
        }
        if (planType.includes("marathon") && slot.role === "aerobic_support") {
            notes.push("This support day should complement the long run, not turn into a second long effort.");
        }
        return {
            family,
            role: slot.role,
            day: slot.day,
            weekIndex: structure.weekIndex,
            purpose: purposeForFamily(family),
            protected: slot.protected ?? (slot.role === "recovery" || slot.role === "long_run"),
            progressive: slot.role === "quality" || slot.role === "long_run",
            conservative: structure.weeklyEmphasis === "recovery_absorption" || structure.weeklyEmphasis === "taper_freshness",
            intensityCap: intensityCapForFamily(family),
            notes: notes.length > 0 ? notes : undefined,
        };
    });
}
