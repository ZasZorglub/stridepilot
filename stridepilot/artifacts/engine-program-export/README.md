# Engine Program Export

Programs: 50
Fixed: 25
Stress: 25
Review weeks per program: 3

Diagnostic export
- Full 50-program artifact: /Users/anderschristiansloth/stridepilot/stridepilot/artifacts/engine-program-export/50-programs.json
- Fixed scenarios: 25
- Stress scenarios: 25
- Purpose: expose meaningful or missing variation across runner types without changing engine behavior.

## fixed:beginner-low-confidence-short:RunWalk5K
- Scenario: Complete beginner, low confidence, short sessions (fixed)
- Focus: Entry-level realism and calm starts for a hesitant beginner with very little training history.
- Plan: RunWalk5K · 5K finish · 12 weeks
- Inputs: true_beginner · 3 days/week · 0 km/week · longest 0m
- Flags: session=none | week=none

## fixed:beginner-run-walk:RunWalk5K
- Scenario: Beginner run-walk runner (fixed)
- Focus: Run-walk structure should stay clear, supportive, and not become filler-heavy.
- Plan: RunWalk5K · 5K finish · 12 weeks
- Inputs: run_walk_beginner · 3 days/week · 3 km/week · longest 8m
- Flags: session=none | week=none

## fixed:first-5k-beginner:Continuous5K
- Scenario: Beginner aiming for first 5K (fixed)
- Focus: Should feel like real first-5K coaching, not a passive shuffle plan.
- Plan: Continuous5K · 5K finish_comfortably · 14 weeks
- Inputs: continuous_beginner · 3 days/week · 6 km/week · longest 15m
- Flags: session=none | week=none

## fixed:returning-after-break:TenKDistance
- Scenario: Beginner returning after a break (fixed)
- Focus: Should protect the comeback runner without making every workout feel passive.
- Plan: TenKDistance · 10K finish · 18 weeks
- Inputs: continuous_beginner · 3 days/week · 7 km/week · longest 18m
- Flags: session=none | week=none

## fixed:two-day-runner:Continuous5K
- Scenario: Runner with only 2 training days per week (fixed)
- Focus: Two-day structure should stay coach-like and not collapse into weak filler sessions.
- Plan: Continuous5K · 5K finish · 12 weeks
- Inputs: continuous_beginner · 2 days/week · 10 km/week · longest 22m
- Flags: session=none | week=none

## fixed:four-day-runner:TenKDistance
- Scenario: Runner with 4 training days per week (fixed)
- Focus: Four-day weeks should show differentiated session roles early without becoming chaotic.
- Plan: TenKDistance · 10K finish · 17 weeks
- Inputs: recreational · 4 days/week · 24 km/week · longest 42m
- Flags: session=none | week=partial_first_week

## fixed:improving-runner-with-base:TenKPerformance
- Scenario: Improving runner with some base already (fixed)
- Focus: Should look like credible improvement coaching rather than beginner protection.
- Plan: TenKPerformance · 10K improve · 13 weeks
- Inputs: light_intermediate · 4 days/week · 28 km/week · longest 50m
- Flags: session=none | week=partial_first_week

## fixed:short-easy-recovery:Continuous5K
- Scenario: Short easy / recovery-focused runner (fixed)
- Focus: Short sessions should still feel like real training and not mostly transitions.
- Plan: Continuous5K · 5K finish · 10 weeks
- Inputs: continuous_beginner · 3 days/week · 8 km/week · longest 16m
- Flags: session=none | week=none

## fixed:interval-readiness:FiveKImprove
- Scenario: Interval-focused improvement runner (fixed)
- Focus: Quality work should look controlled and purposeful, not watered down or awkwardly padded.
- Plan: FiveKImprove · 5K improve · 11 weeks
- Inputs: recreational · 3 days/week · 20 km/week · longest 38m
- Flags: session=none | week=none

## fixed:partial-week-one-session:TenKDistance
- Scenario: Partial first week with one session (fixed)
- Focus: If week 1 is heavily truncated, the first surviving workout should still feel clearly introductory.
- Plan: TenKDistance · 10K finish · 17 weeks
- Inputs: recreational · 4 days/week · 24 km/week · longest 42m
- Flags: session=none | week=partial_first_week

## fixed:partial-week-two-sessions:TenKDistance
- Scenario: Partial first week with two sessions (fixed)
- Focus: When only two sessions fit in week 1, the first one should still open gently instead of inheriting full-week specificity.
- Plan: TenKDistance · 10K finish · 17 weeks
- Inputs: recreational · 4 days/week · 24 km/week · longest 42m
- Flags: session=none | week=partial_first_week

## fixed:passive-start-probe:Continuous5K
- Scenario: Passive-start regression probe (fixed)
- Focus: Designed to expose awkward walk + warmup openings and weak short-session structure.
- Plan: Continuous5K · 5K finish · 9 weeks
- Inputs: continuous_beginner · 3 days/week · 3 km/week · longest 10m
- Flags: session=none | week=none

## fixed:three-day-10k-beginner:TenKDistance
- Scenario: Three-day 10K beginner (fixed)
- Focus: A straightforward 10K beginner should feel calm but clearly purposeful over the first weeks.
- Plan: TenKDistance · 10K finish · 15 weeks
- Inputs: continuous_beginner · 3 days/week · 8 km/week · longest 20m
- Flags: session=none | week=none

## fixed:recent-running-state-trio-recent:Continuous5K
- Scenario: Recent-running-state trio: recent runner (fixed)
- Focus: Comparison runner for recentRunningState. Inputs stay fixed except freshness so week 1 can be compared directly.
- Plan: Continuous5K · 5K finish · 13 weeks
- Inputs: continuous_beginner · 3 days/week · 8 km/week · longest 18m
- Flags: session=none | week=partial_first_week

## fixed:recent-running-state-trio-returning:Continuous5K
- Scenario: Recent-running-state trio: returning runner (fixed)
- Focus: Comparison runner for recentRunningState. Inputs stay fixed except freshness so week 1 can be compared directly.
- Plan: Continuous5K · 5K finish · 13 weeks
- Inputs: recreational · 3 days/week · 8 km/week · longest 18m
- Flags: session=none | week=partial_first_week

## fixed:recent-running-state-trio-long-break:Continuous5K
- Scenario: Recent-running-state trio: long break or new runner (fixed)
- Focus: Comparison runner for recentRunningState. Inputs stay fixed except freshness so week 1 can be compared directly.
- Plan: Continuous5K · 5K finish · 13 weeks
- Inputs: continuous_beginner · 3 days/week · 8 km/week · longest 18m
- Flags: session=none | week=partial_first_week

## fixed:short-session-two-day-beginner:Continuous5K
- Scenario: Short-session two-day beginner (fixed)
- Focus: Two-day beginners with tight time windows should still get sessions with a visible main set.
- Plan: Continuous5K · 5K finish · 10 weeks
- Inputs: continuous_beginner · 2 days/week · 4 km/week · longest 12m
- Flags: session=none | week=none

## fixed:strong-runner-late-week-start:TenKPerformance
- Scenario: Stronger runner starting late in week (fixed)
- Focus: A stronger runner starting on a truncated week should still get a gentle first exposure before specificity resumes.
- Plan: TenKPerformance · 10K improve · 16 weeks
- Inputs: light_intermediate · 4 days/week · 30 km/week · longest 55m
- Flags: session=none | week=partial_first_week

## fixed:tenk-improve-runner:TenKPerformance
- Scenario: 10K improvement runner (fixed)
- Focus: An improving 10K runner should see purposeful early differentiation without awkward spikes.
- Plan: TenKPerformance · 10K improve · 14 weeks
- Inputs: light_intermediate · 4 days/week · 32 km/week · longest 58m
- Flags: session=none | week=partial_first_week

## fixed:fivek-target-time-runner:FiveKImprove
- Scenario: 5K target-time runner (fixed)
- Focus: A controlled 5K target-time plan should feel specific early without losing clarity.
- Plan: FiveKImprove · 5K target_time · 12 weeks
- Inputs: light_intermediate · 4 days/week · 26 km/week · longest 46m
- Flags: session=none | week=partial_first_week

## fixed:cautious-four-day-runner:TenKDistance
- Scenario: Cautious four-day recreational runner (fixed)
- Focus: A higher-frequency but cautious runner should still get a coach-like identity without a jumpy opening.
- Plan: TenKDistance · 10K finish_comfortably · 18 weeks
- Inputs: recreational · 4 days/week · 18 km/week · longest 34m
- Flags: session=none | week=partial_first_week

## fixed:long-run-framing-beginner:TenKDistance
- Scenario: Beginner long-run framing probe (fixed)
- Focus: Beginner long days should read as a run with light framing, not a walk wrapped around it.
- Plan: TenKDistance · 10K finish · 16 weeks
- Inputs: continuous_beginner · 3 days/week · 9 km/week · longest 18m
- Flags: session=none | week=none

## fixed:progression-sensitive-improver:TenKPerformance
- Scenario: Progression-sensitive improver (fixed)
- Focus: An improver with a base should get progression runs that read cleanly and still land in a smooth opening ramp.
- Plan: TenKPerformance · 10K improve · 14 weeks
- Inputs: light_intermediate · 4 days/week · 29 km/week · longest 52m
- Flags: session=none | week=partial_first_week

## fixed:partial-week-two-day-beginner:Continuous5K
- Scenario: Two-day beginner with partial opening week (fixed)
- Focus: A two-day beginner who starts late should still get a trustworthy first session instead of a compressed ramp.
- Plan: Continuous5K · 5K finish · 13 weeks
- Inputs: continuous_beginner · 2 days/week · 4 km/week · longest 12m
- Flags: session=none | week=partial_first_week

## fixed:strong-three-day-fivek-improve:FiveKImprove
- Scenario: Strong three-day 5K improver (fixed)
- Focus: A capable three-day runner should still feel clearly recognized in the opening block.
- Plan: FiveKImprove · 5K improve · 11 weeks
- Inputs: recreational · 3 days/week · 22 km/week · longest 40m
- Flags: session=none | week=none

## stress:stress-01-ultra-zero-2day:RunWalk5K
- Scenario: Stress: ultra-beginner two-day minimal history (stress)
- Focus: Probe the weakest onboarding shape with low confidence and tight weekly frequency.
- Plan: RunWalk5K · 5K finish · 9 weeks
- Inputs: true_beginner · 2 days/week · 0 km/week · longest 0m
- Flags: session=none | week=none

## stress:stress-02-runwalk-short-window:RunWalk5K
- Scenario: Stress: run-walk with very short windows (stress)
- Focus: Run-walk structure should survive under small session budgets.
- Plan: RunWalk5K · 5K finish · 8 weeks
- Inputs: run_walk_beginner · 3 days/week · 2 km/week · longest 6m
- Flags: session=none | week=none

## stress:stress-03-continuous-beginner-10k:TenKDistance
- Scenario: Stress: continuous beginner stretched to 10K (stress)
- Focus: A lightly ready beginner 10K plan should stay realistic and not become filler-heavy.
- Plan: TenKDistance · 10K finish · 19 weeks
- Inputs: continuous_beginner · 3 days/week · 7 km/week · longest 18m
- Flags: session=none | week=none

## stress:stress-04-returner-short-partial:Continuous5K
- Scenario: Stress: returning runner with truncated first week (stress)
- Focus: A returner starting late in the week should still get a safe first exposure.
- Plan: Continuous5K · 5K finish · 14 weeks
- Inputs: continuous_beginner · 3 days/week · 5 km/week · longest 12m
- Flags: session=none | week=partial_first_week

## stress:stress-05-low-confidence-4day:TenKDistance
- Scenario: Stress: low-confidence four-day runner (stress)
- Focus: Higher frequency with low confidence should not collapse into weak filler or abrupt ramps.
- Plan: TenKDistance · 10K finish · 17 weeks
- Inputs: continuous_beginner · 4 days/week · 14 km/week · longest 24m
- Flags: session=none | week=partial_first_week

## stress:stress-06-two-day-improver:FiveKImprove
- Scenario: Stress: two-day improver (stress)
- Focus: A limited-frequency improver should still get a recognizable training identity.
- Plan: FiveKImprove · 5K improve · 13 weeks
- Inputs: recreational · 2 days/week · 18 km/week · longest 36m
- Flags: session=none | week=none

## stress:stress-07-4day-target-time-5k:FiveKImprove
- Scenario: Stress: 4-day 5K target-time runner (stress)
- Focus: A moderately capable runner with a target-time goal should show early quality without load spikes.
- Plan: FiveKImprove · 5K target_time · 14 weeks
- Inputs: light_intermediate · 4 days/week · 30 km/week · longest 54m
- Flags: session=none | week=partial_first_week

## stress:stress-08-recovery-heavy-2day:Continuous5K
- Scenario: Stress: recovery-sensitive two-day returner (stress)
- Focus: A delicate two-day returner should still get meaningful work despite heavy recovery bias.
- Plan: Continuous5K · 5K finish · 11 weeks
- Inputs: continuous_beginner · 2 days/week · 6 km/week · longest 15m
- Flags: session=none | week=none

## stress:stress-09-partial-week-strong-finish:TenKPerformance
- Scenario: Stress: strong runner with one-session opening week (stress)
- Focus: A strong late-start case should still open with a trustworthy first session.
- Plan: TenKPerformance · 10K improve · 17 weeks
- Inputs: intermediate · 4 days/week · 38 km/week · longest 70m
- Flags: session=none | week=partial_first_week

## stress:stress-10-partial-week-strong-two-sessions:TenKDistance
- Scenario: Stress: strong runner with two-session opening week (stress)
- Focus: Two surviving sessions in week 1 should still avoid an over-compressed ramp.
- Plan: TenKDistance · 10K finish · 15 weeks
- Inputs: light_intermediate · 4 days/week · 34 km/week · longest 62m
- Flags: session=none | week=partial_first_week

## stress:stress-11-runwalk-10k-stretch:TenKDistance
- Scenario: Stress: run-walk runner stretched to 10K finish (stress)
- Focus: Run-walk logic should stay coach-like when the goal is a bit longer.
- Plan: TenKDistance · 10K finish · 20 weeks
- Inputs: run_walk_beginner · 3 days/week · 4 km/week · longest 10m
- Flags: session=none | week=none

## stress:stress-12-short-window-3day-5k:Continuous5K
- Scenario: Stress: 3-day 5K with short typical sessions (stress)
- Focus: Short windows should not erase workout identity or realism.
- Plan: Continuous5K · 5K finish_comfortably · 10 weeks
- Inputs: continuous_beginner · 3 days/week · 8 km/week · longest 16m
- Flags: session=none | week=none

## stress:stress-13-four-day-recreational-10k:TenKDistance
- Scenario: Stress: four-day recreational 10K finisher (stress)
- Focus: A balanced 10K finish plan should stay differentiated without becoming chaotic.
- Plan: TenKDistance · 10K finish · 19 weeks
- Inputs: recreational · 4 days/week · 22 km/week · longest 44m
- Flags: session=none | week=partial_first_week

## stress:stress-14-cautious-5k-improver:FiveKImprove
- Scenario: Stress: cautious 5K improver (stress)
- Focus: A cautious improver should get controlled quality without losing confidence.
- Plan: FiveKImprove · 5K improve · 12 weeks
- Inputs: recreational · 3 days/week · 15 km/week · longest 30m
- Flags: session=none | week=none

## stress:stress-15-strong-10k-performance:TenKPerformance
- Scenario: Stress: stronger 10K performance runner (stress)
- Focus: A more capable runner should show early identity and smooth load handling.
- Plan: TenKPerformance · 10K target_time · 18 weeks
- Inputs: intermediate · 4 days/week · 42 km/week · longest 75m
- Flags: session=none | week=partial_first_week

## stress:stress-16-returner-4day-late:TenKDistance
- Scenario: Stress: returning runner on 4 days starting late (stress)
- Focus: A higher-frequency returner with a late start should not get a jumpy onboarding week.
- Plan: TenKDistance · 10K finish_comfortably · 19 weeks
- Inputs: recreational · 4 days/week · 14 km/week · longest 28m
- Flags: session=none | week=partial_first_week

## stress:stress-17-beginner-two-day-late:RunWalk5K
- Scenario: Stress: beginner two-day starting late in week (stress)
- Focus: A tiny opening week should still feel like a real plan start, not a compression artifact.
- Plan: RunWalk5K · 5K finish · 11 weeks
- Inputs: true_beginner · 2 days/week · 0 km/week · longest 0m
- Flags: session=low_meaningful_running×1 | week=partial_first_week

## stress:stress-18-progression-sensitive-5k:FiveKImprove
- Scenario: Stress: progression-sensitive 5K improver (stress)
- Focus: Progression workouts should read cleanly when they appear early.
- Plan: FiveKImprove · 5K improve · 13 weeks
- Inputs: light_intermediate · 4 days/week · 27 km/week · longest 48m
- Flags: session=none | week=partial_first_week

## stress:stress-19-long-run-framing-10k:TenKDistance
- Scenario: Stress: 10K beginner long-run framing (stress)
- Focus: Long-run framing should stay light even with a longer target distance.
- Plan: TenKDistance · 10K finish_comfortably · 18 weeks
- Inputs: continuous_beginner · 3 days/week · 9 km/week · longest 20m
- Flags: session=none | week=none

## stress:stress-20-low-confidence-continuous:Continuous5K
- Scenario: Stress: low-confidence continuous beginner (stress)
- Focus: A continuous beginner with low confidence should still feel like they are doing real running training.
- Plan: Continuous5K · 5K finish_comfortably · 12 weeks
- Inputs: continuous_beginner · 3 days/week · 4 km/week · longest 10m
- Flags: session=none | week=none

## stress:stress-21-three-day-recreational-10k:TenKDistance
- Scenario: Stress: three-day recreational 10K runner (stress)
- Focus: A mid-capacity 10K runner should show clear session roles without overcomplication.
- Plan: TenKDistance · 10K finish · 16 weeks
- Inputs: recreational · 3 days/week · 20 km/week · longest 38m
- Flags: session=none | week=none

## stress:stress-22-first5k-short-plan:Continuous5K
- Scenario: Stress: first 5K on a shorter plan horizon (stress)
- Focus: A shorter runway should not turn the first weeks awkward or over-padded.
- Plan: Continuous5K · 5K finish · 8 weeks
- Inputs: continuous_beginner · 3 days/week · 6 km/week · longest 14m
- Flags: session=none | week=none

## stress:stress-23-interval-ready-4day:FiveKImprove
- Scenario: Stress: interval-ready runner on 4 days (stress)
- Focus: An interval-ready runner on higher frequency should still get a smooth first block.
- Plan: FiveKImprove · 5K improve · 14 weeks
- Inputs: light_intermediate · 4 days/week · 28 km/week · longest 48m
- Flags: session=none | week=partial_first_week

## stress:stress-24-cautious-recreational-3day:TenKDistance
- Scenario: Stress: cautious recreational three-day runner (stress)
- Focus: A cautious but not beginner runner should still get a credible opening identity.
- Plan: TenKDistance · 10K finish_comfortably · 17 weeks
- Inputs: recreational · 3 days/week · 16 km/week · longest 30m
- Flags: session=none | week=none

## stress:stress-25-goal-focused-late-start:FiveKImprove
- Scenario: Stress: goal-focused runner with late start and target pace (stress)
- Focus: A goal-focused runner starting late should still get a safe first workout before specificity ramps back in.
- Plan: FiveKImprove · 5K target_time · 13 weeks
- Inputs: recreational · 3 days/week · 24 km/week · longest 42m
- Flags: session=none | week=partial_first_week

