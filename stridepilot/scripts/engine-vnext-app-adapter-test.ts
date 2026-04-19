import assert from "node:assert/strict";

import { evaluateBenchmarkRunner, referenceRunnerBenchmarks } from "../src/lib/engine-v2/benchmark";
import { buildTimelineRecommendation, classifyRunner } from "../src/lib/engine-v2";
import type { RunnerInput } from "../src/lib/engine-v2/models";
import {
  generatePlanForApp,
  getLatestOwnedVNextPlanForApp,
  renderAdaptationExplanationForApp,
  renderPlanExplanationForApp,
  renderWeekExplanationForApp,
  runAdaptivePassForApp,
} from "../src/lib/engine-vnext/app/engineAdapter";
import { runVNextAdaptivePass } from "../src/lib/engine-vnext/adaptation/runAdaptivePass";
import { InMemoryVNextPlanRepository } from "../src/lib/engine-vnext/persistence/vnextPlanRepository";
import { buildEngineV2RunnerInput } from "../src/lib/engine-v2/appAdapter";
import type { Goal, RunnerProfile } from "../src/lib/types";

const beginnerInput: RunnerInput = {
  raceDistance: "5K",
  goalType: "finish",
  startDate: "2026-03-23",
  goalDate: "2026-06-28",
  currentContinuousRunMin: 18,
  currentWeeklyRuns: 3,
  currentWeeklyVolumeKm: 14,
  longestRecentRunMin: 24,
  recentConsistency: 0.6,
  availableTrainingDays: ["tuesday", "thursday", "sunday"],
  typicalAvailableTimeMin: 40,
  trainingStylePreference: "balanced",
  experienceLevel: "new",
  injuryConcern: "low",
  externalTrainingLoad: "light",
  confidence: 3,
};

function fakeClient(outputText: string) {
  return {
    responses: {
      async create() {
        return { output_text: outputText };
      },
    },
  };
}

function buildRunnerProfile(overrides: Partial<RunnerProfile>): RunnerProfile {
  return {
    heightCm: 175,
    weightKg: 72,
    age: 36,
    activityLevel: "lav",
    runningExperience: "let_ovet",
    currentRunningAbility: "ti_femten_min",
    ...overrides,
  };
}

async function main() {
  {
    const gettingStarted = buildEngineV2RunnerInput({
      runnerProfile: {
        ...buildRunnerProfile({
        currentRunningAbility: "tyve_tredive_min",
        currentContinuousDistanceKm: 4,
        currentRunsPerWeek: 3,
        currentWeeklyVolumeKm: 18,
        longestCurrentRunMin: 30,
        onboardingTrack: "getting_started",
      }),
      },
      goal: {
        distance: "10K",
        goalType: "complete",
        weeks: 14,
        startDate: "2026-03-23",
        availableTrainingDays: ["Tirsdag", "Torsdag", "Sondag"],
      },
    });
    const runningConsistently = buildEngineV2RunnerInput({
      runnerProfile: {
        ...buildRunnerProfile({
        currentRunningAbility: "tyve_tredive_min",
        currentContinuousDistanceKm: 4,
        currentRunsPerWeek: 3,
        currentWeeklyVolumeKm: 18,
        longestCurrentRunMin: 30,
        onboardingTrack: "running_consistently",
      }),
      },
      goal: {
        distance: "10K",
        goalType: "complete",
        weeks: 14,
        startDate: "2026-03-23",
        availableTrainingDays: ["Tirsdag", "Torsdag", "Sondag"],
      },
    });
    assert.equal(gettingStarted.trainingStylePreference, "conservative", "getting-started runners should get a visibly more protective starting posture");
    assert.equal(runningConsistently.trainingStylePreference, "balanced", "consistent runners should not be pushed back into beginner-only conservative defaults");
    assert.ok(gettingStarted.recentConsistency < runningConsistently.recentConsistency, "track should materially change early consistency posture for similar inputs");
    assert.ok((gettingStarted.confidence ?? 0) < (runningConsistently.confidence ?? 0), "track should also affect confidence framing in the deterministic engine input");
  }

  {
    const returning = buildEngineV2RunnerInput({
      runnerProfile: {
        ...buildRunnerProfile({
        currentContinuousDistanceKm: 2,
        currentRunsPerWeek: 2,
        currentWeeklyVolumeKm: 10,
        longestCurrentRunMin: 18,
        onboardingTrack: "returning",
      }),
      },
      goal: {
        distance: "5K",
        goalType: "complete",
        weeks: 10,
        startDate: "2026-03-23",
        availableTrainingDays: ["Tirsdag", "Sondag"],
      },
    });
    const gettingStarted = buildEngineV2RunnerInput({
      runnerProfile: {
        ...buildRunnerProfile({
        currentContinuousDistanceKm: 2,
        currentRunsPerWeek: 2,
        currentWeeklyVolumeKm: 10,
        longestCurrentRunMin: 18,
        onboardingTrack: "getting_started",
      }),
      },
      goal: {
        distance: "5K",
        goalType: "complete",
        weeks: 10,
        startDate: "2026-03-23",
        availableTrainingDays: ["Tirsdag", "Sondag"],
      },
    });
    const returningClassification = classifyRunner(returning);
    assert.ok(returning.freeTextFlags?.includes("returning_runner"), "returning track should explicitly preserve comeback context in engine flags");
    assert.notEqual(returning.recentConsistency, gettingStarted.recentConsistency, "returning should not collapse all the way down into pure beginner posture");
    assert.equal(returningClassification.traits.primaryRunnerType, "return_to_running", "returning runners should classify distinctly from true getting-started runners when the rest of the profile is similar");
  }

  {
    const goalFocused = buildEngineV2RunnerInput({
      runnerProfile: {
        ...buildRunnerProfile({
        activityLevel: "moderat",
        runningExperience: "ovet",
        currentRunningAbility: "mere_end_tredive_min",
        currentContinuousDistanceKm: 10,
        currentRunsPerWeek: 4,
        currentWeeklyVolumeKm: 34,
        longestCurrentRunMin: 65,
        onboardingTrack: "goal_focused",
      }),
      },
      goal: {
        distance: "10K",
        goalType: "target_time",
        weeks: 14,
        startDate: "2026-03-23",
        availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"],
      },
    });
    const gettingStarted = buildEngineV2RunnerInput({
      runnerProfile: {
        ...buildRunnerProfile({
        activityLevel: "moderat",
        runningExperience: "ovet",
        currentRunningAbility: "mere_end_tredive_min",
        currentContinuousDistanceKm: 10,
        currentRunsPerWeek: 4,
        currentWeeklyVolumeKm: 34,
        longestCurrentRunMin: 65,
        onboardingTrack: "getting_started",
      }),
      },
      goal: {
        distance: "10K",
        goalType: "target_time",
        weeks: 14,
        startDate: "2026-03-23",
        availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"],
      },
    });
    const goalFocusedRecommendation = buildTimelineRecommendation(goalFocused, classifyRunner(goalFocused)).recommendation;
    const gettingStartedRecommendation = buildTimelineRecommendation(gettingStarted, classifyRunner(gettingStarted)).recommendation;
    assert.equal(goalFocused.trainingStylePreference, "performance", "goal-focused runners with a performance goal should get a more intentional training-style signal");
    assert.equal(goalFocused.baseProgramTrack, "goal_focused", "goal-focused onboarding should formalize into the dedicated base track");
    assert.ok(goalFocused.currentContinuousRunMin >= 60, "consistent stronger runners should keep a credible starting baseline instead of being pulled far down");
    assert.notEqual(
      goalFocusedRecommendation.recommendedProgressionMode,
      gettingStartedRecommendation.recommendedProgressionMode,
      "goal-focused and getting-started runners should not be recommended the same progression posture for otherwise similar stronger inputs",
    );
  }

  {
    const adapted = buildEngineV2RunnerInput({
      runnerProfile: {
        heightCm: 178,
        weightKg: 74,
        age: 34,
        activityLevel: "moderat",
        runningExperience: "ovet",
        currentRunningAbility: "mere_end_tredive_min",
        currentContinuousDistanceKm: 10,
        currentRunsPerWeek: 4,
        currentWeeklyVolumeKm: 32.8,
        longestCurrentRunMin: 63,
      },
      goal: {
        distance: "10K",
        goalType: "target_time",
        weeks: 14,
        startDate: "2026-03-23",
        availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"],
      },
    });
    assert.equal(adapted.currentContinuousRunMin, 63, "current-capacity distance should carry through to the engine adapter so stronger runners do not start far below baseline");
  }

  {
    const sharedGoal: Goal = {
      distance: "Halvmaraton" as const,
      goalType: "complete" as const,
      weeks: 18,
      startDate: "2026-03-23",
      availableTrainingDays: ["Mandag", "Onsdag", "Fredag", "Sondag"],
    };
    const gettingStarted = buildEngineV2RunnerInput({
      runnerProfile: buildRunnerProfile({
        onboardingTrack: "getting_started",
        currentRunningAbility: "ti_femten_min",
        currentContinuousDistanceKm: 3,
        currentRunsPerWeek: 3,
        currentWeeklyVolumeKm: 18,
        longestCurrentRunMin: 28,
      }),
      goal: sharedGoal,
    });
    const returning = buildEngineV2RunnerInput({
      runnerProfile: buildRunnerProfile({
        onboardingTrack: "returning",
        currentRunningAbility: "ti_femten_min",
        currentContinuousDistanceKm: 3,
        currentRunsPerWeek: 3,
        currentWeeklyVolumeKm: 18,
        longestCurrentRunMin: 28,
      }),
      goal: sharedGoal,
    });
    const steadyRunner = buildEngineV2RunnerInput({
      runnerProfile: buildRunnerProfile({
        onboardingTrack: "running_consistently",
        currentRunningAbility: "mere_end_tredive_min",
        currentContinuousDistanceKm: 8,
        currentRunsPerWeek: 4,
        currentWeeklyVolumeKm: 30,
        longestCurrentRunMin: 60,
      }),
      goal: sharedGoal,
    });
    const goalFocused = buildEngineV2RunnerInput({
      runnerProfile: buildRunnerProfile({
        onboardingTrack: "goal_focused",
        runningExperience: "ovet",
        currentRunningAbility: "mere_end_tredive_min",
        currentContinuousDistanceKm: 10,
        currentRunsPerWeek: 4,
        currentWeeklyVolumeKm: 36,
        longestCurrentRunMin: 70,
      }),
      goal: { ...sharedGoal, goalType: "target_time" },
    });
    const gettingStartedRecommendation = buildTimelineRecommendation(gettingStarted, classifyRunner(gettingStarted)).recommendation;
    const returningRecommendation = buildTimelineRecommendation(returning, classifyRunner(returning)).recommendation;
    const steadyRecommendation = buildTimelineRecommendation(steadyRunner, classifyRunner(steadyRunner)).recommendation;
    const goalFocusedRecommendation = buildTimelineRecommendation(goalFocused, classifyRunner(goalFocused)).recommendation;
    assert.equal(gettingStarted.baseProgramTrack, "getting_started");
    assert.equal(returning.baseProgramTrack, "returning");
    assert.equal(steadyRunner.baseProgramTrack, "steady_runner");
    assert.equal(goalFocused.baseProgramTrack, "goal_focused");
    assert.equal(gettingStartedRecommendation.recommendedProgressionMode, "conservative", "getting-started track should preserve beginner safety");
    assert.equal(returningRecommendation.recommendedProgressionMode, "conservative", "returning track should keep a comeback-oriented posture");
    assert.equal(steadyRecommendation.recommendedProgressionMode, "standard", "steady runners should retain a stable non-beginner posture");
    assert.ok(goalFocusedRecommendation.recommendedSessionsPerWeek >= steadyRecommendation.recommendedSessionsPerWeek, "goal-focused stronger runners should not be flattened below steady runners");
    assert.ok((goalFocused.confidence ?? 0) >= (steadyRunner.confidence ?? 0), "goal-focused stronger runners should keep a stronger deterministic confidence posture");
  }

  {
    const result = generatePlanForApp(beginnerInput);
    assert.equal(result.ok, true, "Plan generation adapter should return stable success shape");
    if (result.ok) {
      assert.equal(result.data.plan.planTypeDecision.planType.length > 0, true);
      assert.equal(typeof result.data.validation.passed, "boolean");
      assert.equal(result.data.version?.versionNumber, 1);
      assert.equal(result.data.meta.flow, "plan_generation");
      assert.equal(result.data.meta.engineVersion, "vnext");
    }
  }

  {
    const generated = generatePlanForApp(beginnerInput);
    assert.equal(generated.ok, true, "Expected generated plan for adaptive pass test");
    if (!generated.ok) throw new Error("Plan generation failed");
    const originalVersion = generated.data.plan.versionMetadata?.versionNumber;
    const originalHistoryLength = generated.data.plan.mutationHistory?.length ?? 0;
    const originalWeekCount = generated.data.plan.weeks.length;
    const originalVolumeTargets = generated.data.plan.weeks.map((week) => week.volumeTargetMin);
    const cutbackWeek = generated.data.plan.weeks.find((week) => week.isCutback);
    assert.ok(cutbackWeek, "Expected cutback week for adaptive pass");
    const result = runAdaptivePassForApp(generated.data.plan, {
      targetWeekIndex: cutbackWeek.weekIndex,
      sessionsCompleted: 1,
      sessionsPlanned: cutbackWeek.sessions.length,
      fatigue: "moderate",
      painFlag: false,
      confidence: "normal",
    });
    assert.equal(result.ok, true, "Adaptive pass adapter should return stable success shape");
    if (result.ok) {
      assert.equal(result.data.decision.action, "repeat_current_week");
      assert.equal(typeof result.data.status.applied, "boolean");
      assert.equal(typeof result.data.historyEntry.entryId, "string");
      assert.equal(result.data.meta.flow, "adaptive_pass");
    }
    assert.equal(generated.data.plan.versionMetadata?.versionNumber, originalVersion, "Adapter layer should not bump version on the original plan");
    assert.equal(generated.data.plan.mutationHistory?.length ?? 0, originalHistoryLength, "Adapter layer should not append mutation history to the original plan");
    assert.equal(generated.data.plan.weeks.length, originalWeekCount, "Adapter layer should not change original plan length");
    assert.deepEqual(
      generated.data.plan.weeks.map((week) => week.volumeTargetMin),
      originalVolumeTargets,
      "Adapter layer should not alter original weekly load targets",
    );
  }

  {
    const repository = new InMemoryVNextPlanRepository();
    const generated = generatePlanForApp(beginnerInput);
    if (!generated.ok) throw new Error("Plan generation failed");
    await repository.saveGeneratedPlan({
      userId: "app_adapter_user",
      profileId: "profile_app_adapter",
      runnerProfile: {
        heightCm: 175,
        weightKg: 72,
        age: 36,
        activityLevel: "lav",
        runningExperience: "nybegynder",
        currentRunningAbility: "ti_femten_min",
      },
      goal: {
        distance: "5K",
        goalType: "complete",
        weeks: 10,
        startDate: "2026-03-23",
      } as never,
      plan: generated.data.plan,
    });
    const latest = await getLatestOwnedVNextPlanForApp("app_adapter_user", repository);
    assert.equal(latest.ok, true, "latest owned current vNext plan should be readable through the app adapter");
    if (latest.ok) {
      assert.equal(latest.data.meta.flow, "persisted_plan_read");
      assert.equal(typeof latest.data.meta.debug.currentVersionNumber, "number");
    }
  }

  {
    const generated = generatePlanForApp(beginnerInput);
    if (!generated.ok) throw new Error("Plan generation failed");
    const result = await renderPlanExplanationForApp(generated.data.plan, {
      client: fakeClient(JSON.stringify({
        title: "Plan overview",
        summary: "This explanation stays grounded in the deterministic plan payload.",
        bullets: ["The plan shape is preserved.", "The adapter only renders explanation text."],
        tone: "analytical",
      })) as never,
      model: "gpt-test",
    });
    assert.equal(result.ok, true, "Plan explanation adapter should return stable success shape");
    if (result.ok) {
      assert.equal(result.data.payloadKind, "plan_summary");
      assert.equal(result.data.source, "openai");
      assert.equal(result.data.explanation.title, "Plan overview");
      assert.equal(result.data.meta.flow, "plan_explanation");
    }
  }

  {
    const generated = generatePlanForApp(beginnerInput);
    if (!generated.ok) throw new Error("Plan generation failed");
    const result = await renderWeekExplanationForApp(generated.data.plan, generated.data.plan.weeks[0].weekIndex, {
      client: fakeClient("{\"bad\":true}") as never,
      model: "gpt-test",
    });
    assert.equal(result.ok, true, "Week explanation adapter should still return stable shape on fallback");
    if (result.ok) {
      assert.equal(result.data.source, "fallback");
      assert.equal(result.data.fallbackReason, "invalid_output");
      assert.equal(result.data.payloadKind, "week_summary");
      assert.equal(result.data.meta.status, "fallback");
    }
  }

  {
    const generated = generatePlanForApp(beginnerInput);
    if (!generated.ok) throw new Error("Plan generation failed");
    const cutbackWeek = generated.data.plan.weeks.find((week) => week.isCutback);
    assert.ok(cutbackWeek, "Expected cutback week");
    const adaptivePass = runVNextAdaptivePass(generated.data.plan, {
      targetWeekIndex: cutbackWeek.weekIndex,
      sessionsCompleted: Math.max(1, cutbackWeek.sessions.length - 1),
      sessionsPlanned: cutbackWeek.sessions.length,
      fatigue: "high",
      painFlag: false,
      confidence: "normal",
    });
    const frozenAdaptivePass = JSON.stringify(adaptivePass);
    const result = await renderAdaptationExplanationForApp(adaptivePass, {
      client: fakeClient(JSON.stringify({
        title: "Recovery adjustment",
        summary: "The adapter explains the local recovery change without altering plan logic.",
        bullets: ["The decision remains deterministic.", "Fallback would be surfaced clearly if needed."],
        tone: "calm",
      })) as never,
      model: "gpt-test",
    });
    assert.equal(result.ok, true, "Adaptation explanation adapter should return stable success shape");
    if (result.ok) {
      assert.equal(result.data.payloadKind, "adaptation_summary");
      assert.equal(result.data.explanation.tone, "calm");
      assert.equal(typeof result.data.meta.debug.explanationFallback, "boolean");
    }
    assert.equal(JSON.stringify(adaptivePass), frozenAdaptivePass, "Explanation adapter should not mutate adaptive pass results");
  }

  {
    const benchmark = evaluateBenchmarkRunner(referenceRunnerBenchmarks[0]);
    assert.ok(benchmark.summaryScore >= 0, "Benchmark flow should still run after app adapter addition");
  }

  console.log("engine-vnext app adapter tests passed");
}

void main();
