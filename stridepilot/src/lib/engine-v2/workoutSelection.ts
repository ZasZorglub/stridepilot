import type {
  BackboneType,
  GoalType,
  Phase,
  PhaseStructureRole,
  PlanType,
  RunnerClassification,
  RunnerLevel,
  SessionType,
  WorkoutPurpose,
  WorkoutSelection,
  WorkoutFamily,
  WeeklyStructure,
} from "./models";

function purposeForFamily(family: WorkoutFamily): WorkoutPurpose {
  if (family === "run_walk_progression") return "build_tolerance";
  if (family === "easy_run") return "build_consistency";
  if (family === "recovery_run") return "support_recovery";
  if (family === "development_run") return "build_aerobic_base";
  if (family === "steady_run") return "build_aerobic_base";
  if (family === "tempo_run") return "improve_threshold";
  if (family === "intervals" || family === "hill_reps" || family === "strides_session") return "improve_speed_support";
  if (family === "progression_run" || family === "fartlek") return "improve_rhythm";
  if (family === "race_specific") return "build_race_specific_endurance";
  return "build_long_run_durability";
}

function roleForSlot(
  role: WeeklyStructure["slots"][number]["role"],
  qualityBias: WeeklyStructure["slots"][number]["qualityBias"],
  phase: Phase,
  goalType: GoalType,
  backboneType: BackboneType,
): PhaseStructureRole {
  if (role === "long_run") {
    if (qualityBias === "specific") return "long_with_segments";
    if (qualityBias === "short") return "long_short";
    return "long_run";
  }
  if (role === "recovery") return role;
  if (role === "easy") return qualityBias === "sharpen" ? "strides" : "easy";
  if (role === "aerobic_support") {
    if (backboneType === "continuous_backbone") return phase === "base" ? "support" : "steady";
    if (phase === "base") return "support";
    if (phase === "specific" || phase === "peak") return goalType === "target_time" || goalType === "improve_time" ? "steady" : "support";
    return "steady";
  }
  if (qualityBias === "short") return phase === "peak" ? "short_quality" : "race_pace_short";
  if (qualityBias === "specific") return goalType === "finish" || goalType === "finish_without_walking" ? "race_pace" : "intervals";
  if (qualityBias === "moderate") return goalType === "target_time" || goalType === "improve_time" ? "threshold" : "quality";
  if (qualityBias === "intro") return backboneType === "continuous_backbone" ? "quality" : "steady";
  return "quality";
}

function familyForSessionType(sessionType: SessionType): WorkoutFamily {
  if (sessionType === "easy_run") return "easy_run";
  if (sessionType === "steady_run") return "steady_run";
  if (sessionType === "progression_run") return "progression_run";
  if (sessionType === "strides_session") return "strides_session";
  if (sessionType === "run_walk" || sessionType === "run_walk_long") return "run_walk_progression";
  if (sessionType === "threshold_intervals") return "tempo_run";
  if (sessionType === "vo2_intervals") return "intervals";
  if (sessionType === "race_pace_blocks") return "race_specific";
  if (sessionType === "recovery_jog") return "recovery_run";
  if (sessionType === "continuous_build" || sessionType === "development_run") return "development_run";
  return "long_run";
}

export function getSessionType(params: {
  role: PhaseStructureRole;
  runnerLevel: RunnerLevel;
  goalType: GoalType;
  phase: Phase;
  backboneType: BackboneType;
  returnToRunningState?: WeeklyStructure["returnToRunningState"];
}): SessionType {
  const { role, runnerLevel, goalType, phase, backboneType, returnToRunningState } = params;
  const beginner = runnerLevel === "true_beginner" || runnerLevel === "beginner_plus";
  const advanced = runnerLevel === "advanced";
  const performanceGoal = goalType === "target_time" || goalType === "improve_time";
  const finishGoal =
    goalType === "finish" || goalType === "finish_without_walking" || goalType === "build_consistency" || goalType === "return_to_running";
  const returnLike = goalType === "return_to_running";

  if (returnLike) {
    if (role === "recovery") return "recovery_jog";
    if (role === "strides") return returnToRunningState?.continuityGatePassed ? "strides_session" : "easy_run";
    if (role === "long_run" || role === "long_short" || role === "long_with_segments") {
      return returnToRunningState?.runWalkPreferred ? "run_walk_long" : "long_run_easy";
    }
    if (role === "easy" || role === "support") {
      return returnToRunningState?.runWalkPreferred ? "run_walk" : "easy_run";
    }
    if (role === "steady" || role === "quality" || role === "threshold" || role === "intervals" || role === "race_pace" || role === "race_pace_short" || role === "short_quality") {
      return returnToRunningState?.continuityGatePassed ? "development_run" : "run_walk";
    }
  }

  if (role === "recovery") return "recovery_jog";
  if (role === "strides") return "strides_session";

  if (backboneType === "continuous_backbone") {
    if (role === "long_run" || role === "long_short" || role === "long_with_segments") {
      if (role === "long_short") return "long_run_easy";
      if (role === "long_with_segments") return performanceGoal || phase === "specific" ? "long_run_with_blocks" : "long_run_progressive";
      if (beginner && (phase === "base" || phase === "build")) return "run_walk_long";
      if (beginner && finishGoal && phase === "specific") return "long_run_easy";
      if (beginner && finishGoal && phase === "taper") return "run_walk_long";
      return "long_run_easy";
    }
    if (role === "easy") return beginner && phase !== "specific" ? "run_walk" : "easy_run";
    if (role === "support") return "development_run";
    if (role === "steady") return beginner ? "continuous_build" : "steady_run";
    if (role === "quality") return beginner ? (phase === "base" ? "development_run" : "continuous_build") : "continuous_build";
    if (role === "threshold") return beginner ? "development_run" : "threshold_intervals";
    if (role === "intervals") return beginner ? "continuous_build" : performanceGoal ? "vo2_intervals" : "threshold_intervals";
    if (role === "race_pace" || role === "race_pace_short") return beginner ? "continuous_build" : performanceGoal ? "race_pace_blocks" : role === "race_pace_short" ? "progression_run" : "race_pace_blocks";
    if (role === "short_quality") return beginner ? "development_run" : "progression_run";
  }

  if (role === "long_run" || role === "long_short" || role === "long_with_segments") {
    if (role === "long_short" || phase === "taper") return "long_run_easy";
    if (role === "long_with_segments") return performanceGoal ? "long_run_with_blocks" : "long_run_progressive";
    if (advanced && phase === "specific") return "long_run_with_blocks";
    if ((runnerLevel === "intermediate" || advanced) && phase === "specific") return performanceGoal ? "long_run_with_blocks" : "long_run_progressive";
    if ((runnerLevel === "intermediate" || advanced) && phase === "peak") return "long_run_progressive";
    return "long_run_easy";
  }

  if (role === "easy") return "easy_run";
  if (role === "support") return advanced ? "steady_run" : runnerLevel === "recreational" || runnerLevel === "intermediate" ? "steady_run" : "development_run";
  if (role === "steady") return "steady_run";
  if (role === "quality") {
    if (phase === "peak" || phase === "taper") return performanceGoal ? "threshold_intervals" : "progression_run";
    if (advanced && performanceGoal && phase === "specific") return "vo2_intervals";
    if (runnerLevel === "recreational" || runnerLevel === "intermediate" || advanced) return "threshold_intervals";
    return finishGoal ? "development_run" : "continuous_build";
  }
  if (role === "short_quality") return goalType === "target_time" ? "vo2_intervals" : performanceGoal ? "threshold_intervals" : "progression_run";
  if (role === "threshold") return phase === "taper" ? (goalType === "target_time" ? "race_pace_blocks" : "progression_run") : "threshold_intervals";
  if (role === "intervals") return advanced || performanceGoal ? "vo2_intervals" : "threshold_intervals";
  if (role === "race_pace") return phase === "specific" || phase === "peak" || phase === "taper" || goalType === "target_time" ? "race_pace_blocks" : "progression_run";
  if (role === "race_pace_short") return goalType === "target_time" || goalType === "improve_time" ? "race_pace_blocks" : "progression_run";
  return beginner ? "run_walk" : "easy_run";
}

function intensityCapForFamily(family: WorkoutFamily): WorkoutSelection["intensityCap"] {
  if (family === "recovery_run") return "very_easy";
  if (family === "easy_run" || family === "run_walk_progression" || family === "long_run") return "easy";
  if (family === "development_run" || family === "steady_run" || family === "strides_session") return "steady";
  if (family === "fartlek" || family === "progression_run" || family === "hill_reps") return "moderate";
  if (family === "tempo_run" || family === "race_specific") return "comfortably_hard";
  return "hard";
}

export function chooseWorkoutSelections(
  structure: WeeklyStructure,
  phase: Phase,
  planType: PlanType,
  goalType: GoalType,
  classification: RunnerClassification,
  backboneType: BackboneType,
): WorkoutSelection[] {
  return structure.slots.map((slot, index) => {
    const sessionRole = roleForSlot(
      slot.role,
      slot.qualityBias,
      phase,
      goalType,
      backboneType,
    );
    const isRaceEvent = structure.isRaceWeek === true && index === structure.slots.length - 1;
    const sessionType = getSessionType({
      role: sessionRole,
      runnerLevel: classification.traits.runnerLevel,
      goalType,
      phase,
      backboneType,
      returnToRunningState: structure.returnToRunningState,
    });
    const family = familyForSessionType(sessionType);
    const notes: string[] = [];
    if (slot.role === "quality" && structure.weeklyEmphasis === "taper_freshness") {
      notes.push("Keep this quality touch compact and rhythm-focused.");
    }
    if (sessionType === "long_run_progressive") {
      notes.push("Keep the long run gently progressive rather than turning it into a second quality workout.");
    }
    if (sessionType === "long_run_with_blocks") {
      notes.push("Use only a small amount of structure inside the long run and protect the overall durability purpose.");
    }
    if ((family === "development_run" || sessionType === "continuous_build") && classification.traits.runnerLevel !== "intermediate" && classification.traits.runnerLevel !== "advanced") {
      notes.push("Use this session to build continuity without making it feel like a full quality workout.");
    }
    if (planType === "hm_finish" && family === "progression_run") {
      notes.push("Keep the progression controlled and practical rather than threshold-heavy.");
    }
    if (planType.includes("marathon") && slot.role === "aerobic_support") {
      notes.push("This support day should complement the long run, not turn into a second long effort.");
    }
    if (isRaceEvent) {
      notes.push("This is race day. Keep everything before it freshness-oriented.");
    }
    return {
      sessionType,
      family,
      role: slot.role,
      day: slot.day,
      weekIndex: structure.weekIndex,
      isRaceWeek: structure.isRaceWeek,
      isRaceEvent,
      purpose: purposeForFamily(family),
      protected: slot.protected ?? (slot.role === "recovery" || slot.role === "long_run"),
      progressive: slot.role === "quality" || slot.role === "long_run",
      conservative: structure.weeklyEmphasis === "recovery_absorption" || structure.weeklyEmphasis === "taper_freshness",
      intensityCap: intensityCapForFamily(family),
      notes: notes.length > 0 ? notes : undefined,
    };
  });
}
