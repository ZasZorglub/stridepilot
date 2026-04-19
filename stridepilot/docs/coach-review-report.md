# StridePilot Coach Review Report

This report is generated from the current app/engine logic without changing product behavior. It reuses the existing benchmark-report harness and maps the requested review profiles to the closest available benchmark fixtures when needed.

Exact fixture matches used: profile-48, profile-06, profile-14, profile-33
Approximated fixture matches used: profile-45, profile-04, profile-08, profile-26, profile-42, profile-10, profile-50, profile-49

## Summary table

| Profile | Track | Goal | Frequency | Overall impression | Warnings |
| --- | --- | --- | --- | --- | --- |
| 1. Beginner, low frequency (profile-45) | getting_started | 5K run_without_walking | 2/week | pass (10/10) | none |
| 2. Beginner, slightly ambitious (profile-04) | getting_started | 10K complete | 3/week | pass (10/10) | none |
| 3. Returning runner (profile-08) | returning | 5K run_without_walking | 3/week | pass (10/10) | none |
| 4. Returning runner, building confidence (profile-48) | returning | Halvmaraton complete | 3/week | pass (10/10) | none |
| 5. Steady runner (profile-26) | steady_runner | 10K complete | 4/week | pass (10/10) | none |
| 6. Steady runner, HM (profile-42) | running_consistently | Halvmaraton complete | 4/week | pass (10/10) | none |
| 7. Goal-focused, 10K (profile-06) | goal_focused | 10K pr | 4/week | pass (10/10) | none |
| 8. Goal-focused, half marathon (profile-10) | goal_focused | Halvmaraton pr | 4/week | pass (10/10) | none |
| 9. Goal-focused, marathon (profile-14) | goal_focused | Marathon pr | 4/week | pass (10/10) | none |
| 10. Goal-focused, marathon, higher frequency (profile-50) | goal_focused | Marathon pr | 4/week | borderline (9.6/10) | aggressive_progression_jump |
| 11. Faster/performance-oriented runner (profile-49) | goal_focused | Halvmaraton target_time | 4/week | fail (5.4/10) | race_day_too_short |
| 12. Edge-case ambitious profile (profile-33) | goal_focused | Halvmaraton complete | 2/week | pass (10/10) | none |

## Detailed profiles

### Profile 1 - Beginner, low frequency

- Fixture used: `profile-45` - Cautious 5K run without walking, 2x/week (approximate; Closest existing fixture is a cautious 5K run-without-walking starter at 2x/week.)
- Track / goal / frequency: unspecified / 5K run_without_walking / 2 days per week
- Key inputs surfaced: current level Ca. 5 min sammenhaengende; current continuous distance n/a km; notes: Vil gerne kunne lobe 5 km uden walk breaks i et trygt tempo.

**Plan summary**
- Duration: 12 weeks
- Sessions per week: 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2
- Long run presence: yes
- Quality workout presence: yes
- Notable structure: phases introduction -> continuous_running -> capacity -> race_preparation; 2 sessions in week 1; weekly counts across the plan: 2, 2, 2, 2, 2, 2; first key workouts: W1: Langt roligt pas (long, 30 min); W2: Langt roligt pas (long, 32 min); W3: Langt roligt pas (long, 32.5 min)

**Week 1 detail**
- 1. Run-walk | type: run-walk | duration: 41 min | feel: easy | structure: Walk 3 min / Warmup 3 min / Run 4 min / Walk 2.5 min / Run 4 min / Walk 2.5 min / Run 4 min / Walk 2.5 min / Run 4 min / Walk 2.5 min / Run 4 min / Cooldown 2 min / Walk 3 min | HR: Zone 1-2, Zone 2
- 2. Langt roligt pas | type: long | duration: 30 min | feel: long | structure: Walk 3 min / Warmup 3 min / Run 19 min / Cooldown 2 min / Walk 3 min | HR: Zone 2

**Early progression snapshot (weeks 1-4)**
- Week 1: 2 sessions, total load 1h 11m, longest session 41 min, key sessions Langt roligt pas
- Week 2: 2 sessions, total load 1h 13m, longest session 41 min, key sessions Langt roligt pas
- Week 3: 2 sessions, total load 56 min, longest session 32.5 min, key sessions Langt roligt pas
- Week 4: 2 sessions, total load 50.5 min, longest session 30 min, key sessions Langt roligt pas
- Long run progression: W1 30 min -> W2 32 min -> W3 32.5 min -> W4 30 min -> W5 36.5 min -> W6 38 min

**Goal-specific / readiness notes**
- 5K måldag — Walk 3 min / Warmup 3 min / Run 22.5 min / Cooldown 2 min / Walk 3 min; goal-day run time 27.5 min
- No interval-shape notes surfaced in the reviewed sessions

**Engine / benchmark warnings**
- Warnings: none
- Findings: none

### Profile 2 - Beginner, slightly ambitious

- Fixture used: `profile-04` - Novice 10K, 3x/week (approximate; Closest fixture is a novice 10K complete profile at 3x/week.)
- Track / goal / frequency: unspecified / 10K complete / 3 days per week
- Key inputs surfaced: current level Ca. 20-30 min sammenhaengende; current continuous distance n/a km; notes: Vil bygge mod 10 km uden at det bliver for hardt.

**Plan summary**
- Duration: 14 weeks
- Sessions per week: 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3
- Long run presence: yes
- Quality workout presence: yes
- Notable structure: phases base -> build -> specific -> peak -> taper; 3 sessions in week 1; weekly counts across the plan: 3, 3, 3, 3, 3, 3; first key workouts: W1: Steady-pas (steady, 32.5 min); W1: Langt roligt pas (long, 56 min); W2: Steady-pas (steady, 32.5 min)

**Week 1 detail**
- 1. Roligt løb | type: easy | duration: 40 min | feel: easy | structure: Warmup 6 min / Run 29 min / Cooldown 3 min / Walk 2 min | HR: Zone 2
- 2. Steady-pas | type: steady | duration: 32.5 min | feel: moderate | structure: Warmup 7 min / Run 20.5 min / Cooldown 3 min / Walk 2 min | HR: Zone 2, Ovre zone 2
- 3. Langt roligt pas | type: long | duration: 56 min | feel: long | structure: Warmup 6 min / Run 45 min / Cooldown 3 min / Walk 2 min | HR: Zone 2

**Early progression snapshot (weeks 1-4)**
- Week 1: 3 sessions, total load 2h 8.5m, longest session 56 min, key sessions Steady-pas; Langt roligt pas
- Week 2: 3 sessions, total load 2h 11m, longest session 57.5 min, key sessions Steady-pas; Langt roligt pas
- Week 3: 3 sessions, total load 2h 3m, longest session 53 min, key sessions Steady-pas; Langt roligt pas
- Week 4: 3 sessions, total load 1h 49m, longest session 47.5 min, key sessions Steady-pas; Langt roligt pas
- Long run progression: W1 56 min -> W2 57.5 min -> W3 53 min -> W4 47.5 min -> W5 1h 1.5m -> W6 57.5 min

**Goal-specific / readiness notes**
- 10 km måldag — Warmup 6 min / Run 41.5 min / Cooldown 3 min / Walk 2 min; goal-day run time 50.5 min
- No interval-shape notes surfaced in the reviewed sessions

**Engine / benchmark warnings**
- Warnings: none
- Findings: none

### Profile 3 - Returning runner

- Fixture used: `profile-08` - Comeback 5K, 3x/week (approximate; Closest fixture is a comeback 5K profile at 3x/week.)
- Track / goal / frequency: unspecified / 5K run_without_walking / 3 days per week
- Key inputs surfaced: current level Ca. 5 min sammenhaengende; current continuous distance n/a km; notes: Pa vej tilbage og vil have meget rolig progression.

**Plan summary**
- Duration: 12 weeks
- Sessions per week: 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3
- Long run presence: yes
- Quality workout presence: yes
- Notable structure: phases introduction -> continuous_running -> capacity -> race_preparation; 3 sessions in week 1; weekly counts across the plan: 3, 3, 3, 3, 3, 3; first key workouts: W1: Langt roligt pas (long, 30 min); W2: Langt roligt pas (long, 32 min); W3: Langt roligt pas (long, 32.5 min)

**Week 1 detail**
- 1. Run-walk | type: run-walk | duration: 41 min | feel: easy | structure: Walk 3 min / Warmup 3 min / Run 4 min / Walk 2.5 min / Run 4 min / Walk 2.5 min / Run 4 min / Walk 2.5 min / Run 4 min / Walk 2.5 min / Run 4 min / Cooldown 2 min / Walk 3 min | HR: Zone 1-2, Zone 2
- 2. Roligt løb | type: easy | duration: 22.5 min | feel: easy | structure: Walk 3 min / Warmup 3 min / Run 11.5 min / Cooldown 2 min / Walk 3 min | HR: Zone 2
- 3. Langt roligt pas | type: long | duration: 30 min | feel: long | structure: Walk 3 min / Warmup 3 min / Run 19 min / Cooldown 2 min / Walk 3 min | HR: Zone 2

**Early progression snapshot (weeks 1-4)**
- Week 1: 3 sessions, total load 1h 33.5m, longest session 41 min, key sessions Langt roligt pas
- Week 2: 3 sessions, total load 1h 36m, longest session 41 min, key sessions Langt roligt pas
- Week 3: 3 sessions, total load 1h 19m, longest session 32.5 min, key sessions Langt roligt pas
- Week 4: 3 sessions, total load 1h 11m, longest session 30 min, key sessions Langt roligt pas
- Long run progression: W1 30 min -> W2 32 min -> W3 32.5 min -> W4 30 min -> W5 35.5 min -> W6 38 min

**Goal-specific / readiness notes**
- 5K måldag — Walk 3 min / Warmup 3 min / Run 22.5 min / Cooldown 2 min / Walk 3 min; goal-day run time 27.5 min
- No interval-shape notes surfaced in the reviewed sessions

**Engine / benchmark warnings**
- Warnings: none
- Findings: none

### Profile 4 - Returning runner, building confidence

- Fixture used: `profile-48` - Comeback half complete, 3x/week (exact)
- Track / goal / frequency: unspecified / Halvmaraton complete / 3 days per week
- Key inputs surfaced: current level Ca. 10-15 min sammenhaengende; current continuous distance n/a km; notes: Vil bygge sikkert op til et halvmaraton igen uden at forcere.

**Plan summary**
- Duration: 20 weeks
- Sessions per week: 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3
- Long run presence: yes
- Quality workout presence: yes
- Notable structure: phases introduction -> continuous_running -> capacity -> race_preparation; 3 sessions in week 1; weekly counts across the plan: 3, 3, 3, 3, 3, 3; first key workouts: W1: Langt roligt pas (long, 36.5 min); W2: Langt roligt pas (long, 37 min); W3: Langt roligt pas (long, 39.5 min)

**Week 1 detail**
- 1. Roligt løb | type: easy | duration: 29 min | feel: easy | structure: Warmup 6 min / Run 18 min / Cooldown 3 min / Walk 2 min | HR: Zone 2
- 2. Roligt løb | type: easy | duration: 29 min | feel: easy | structure: Warmup 6 min / Run 18 min / Cooldown 3 min / Walk 2 min | HR: Zone 2
- 3. Langt roligt pas | type: long | duration: 36.5 min | feel: long | structure: Warmup 6 min / Run 25.5 min / Cooldown 3 min / Walk 2 min | HR: Zone 2

**Early progression snapshot (weeks 1-4)**
- Week 1: 3 sessions, total load 1h 34.5m, longest session 36.5 min, key sessions Langt roligt pas
- Week 2: 3 sessions, total load 1h 36m, longest session 37 min, key sessions Langt roligt pas
- Week 3: 3 sessions, total load 1h 34.5m, longest session 39.5 min, key sessions Langt roligt pas
- Week 4: 3 sessions, total load 1h 27m, longest session 35 min, key sessions Langt roligt pas
- Long run progression: W1 36.5 min -> W2 37 min -> W3 39.5 min -> W4 35 min -> W5 44 min -> W6 45.5 min

**Goal-specific / readiness notes**
- halvmaraton måldag — Warmup 6 min / Run 75 min / Cooldown 3 min / Walk 2 min; goal-day run time 1h 24m
- No interval-shape notes surfaced in the reviewed sessions

**Engine / benchmark warnings**
- Warnings: none
- Findings: none

### Profile 5 - Steady runner

- Fixture used: `profile-26` - Steady 10K complete, 4x/week (approximate; Closest fixture is a steady 10K complete profile with no explicit onboarding track set.)
- Track / goal / frequency: unspecified / 10K complete / 4 days per week
- Key inputs surfaced: current level Ca. 20-30 min sammenhaengende; current continuous distance n/a km; notes: Ingen ekstra noter.

**Plan summary**
- Duration: 14 weeks
- Sessions per week: 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4
- Long run presence: yes
- Quality workout presence: yes
- Notable structure: phases base -> build -> specific -> peak -> taper; 3 sessions in week 1; weekly counts across the plan: 3, 4, 4, 4, 4, 4; first key workouts: W1: Steady-pas (steady, 36.5 min); W1: Langt roligt pas (long, 43 min); W2: Steady-pas (steady, 30.5 min)

**Week 1 detail**
- 1. Recovery-pas | type: recovery | duration: 23 min | feel: easy | structure: Warmup 6 min / Run 12 min / Cooldown 3 min / Walk 2 min | HR: Zone 1-2
- 2. Steady-pas | type: steady | duration: 36.5 min | feel: moderate | structure: Warmup 7 min / Run 24.5 min / Cooldown 3 min / Walk 2 min | HR: Zone 2, Ovre zone 2
- 3. Langt roligt pas | type: long | duration: 43 min | feel: long | structure: Warmup 6 min / Run 32 min / Cooldown 3 min / Walk 2 min | HR: Zone 2

**Early progression snapshot (weeks 1-4)**
- Week 1: 3 sessions, total load 1h 42.5m, longest session 43 min, key sessions Steady-pas; Langt roligt pas
- Week 2: 4 sessions, total load 2h 11m, longest session 45.5 min, key sessions Steady-pas; Langt roligt pas
- Week 3: 4 sessions, total load 2h 41.5m, longest session 56 min, key sessions Steady-pas; Langt roligt pas
- Week 4: 4 sessions, total load 2h 9m, longest session 45 min, key sessions Steady-pas; Langt roligt pas
- Long run progression: W1 43 min -> W2 45.5 min -> W3 56 min -> W4 45 min -> W5 54 min -> W6 1h 4.5m

**Goal-specific / readiness notes**
- 10 km måldag — Warmup 6 min / Run 42.5 min / Cooldown 3 min / Walk 2 min; goal-day run time 51.5 min
- No interval-shape notes surfaced in the reviewed sessions

**Engine / benchmark warnings**
- Warnings: none
- Findings: none

### Profile 6 - Steady runner, HM

- Fixture used: `profile-42` - Fit but inexperienced half, 4x/week (extended) (approximate; Closest fixture uses the running_consistently track, which is the nearest current equivalent to steady_runner.)
- Track / goal / frequency: running_consistently / Halvmaraton complete / 4 days per week
- Key inputs surfaced: current level Ca. 20-30 min sammenhaengende; current continuous distance 9 km; notes: Ingen ekstra noter.

**Plan summary**
- Duration: 20 weeks
- Sessions per week: 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4
- Long run presence: yes
- Quality workout presence: yes
- Notable structure: phases introduction -> continuous_running -> capacity -> race_preparation; 4 sessions in week 1; weekly counts across the plan: 4, 4, 4, 4, 4, 4; first key workouts: W1: Steady-pas (steady, 40 min); W1: Langt roligt pas (long, 54 min); W2: Steady-pas (steady, 34.5 min)

**Week 1 detail**
- 1. Roligt løb | type: easy | duration: 44 min | feel: easy | structure: Warmup 6 min / Run 33 min / Cooldown 3 min / Walk 2 min | HR: Zone 2
- 2. Recovery-pas | type: recovery | duration: 32.5 min | feel: easy | structure: Warmup 6 min / Run 21.5 min / Cooldown 3 min / Walk 2 min | HR: Zone 1-2
- 3. Steady-pas | type: steady | duration: 40 min | feel: moderate | structure: Warmup 7 min / Run 28 min / Cooldown 3 min / Walk 2 min | HR: Zone 2, Ovre zone 2
- 4. Langt roligt pas | type: long | duration: 54 min | feel: long | structure: Warmup 6 min / Run 43 min / Cooldown 3 min / Walk 2 min | HR: Zone 2

**Early progression snapshot (weeks 1-4)**
- Week 1: 4 sessions, total load 2h 50.5m, longest session 54 min, key sessions Steady-pas; Langt roligt pas
- Week 2: 4 sessions, total load 2h 25m, longest session 45.5 min, key sessions Steady-pas; Langt roligt pas
- Week 3: 4 sessions, total load 3h 12m, longest session 1h 0.5m, key sessions Steady-pas; Langt roligt pas
- Week 4: 4 sessions, total load 2h 39m, longest session 48 min, key sessions Langt roligt pas
- Long run progression: W1 54 min -> W2 45.5 min -> W3 1h 0.5m -> W4 48 min -> W5 1h 1m -> W6 1h 4.5m

**Goal-specific / readiness notes**
- halvmaraton måldag — Warmup 6 min / Run 75 min / Cooldown 3 min / Walk 2 min; goal-day run time 1h 24m
- No interval-shape notes surfaced in the reviewed sessions

**Engine / benchmark warnings**
- Warnings: none
- Findings: duration_override_respected: Den valgte længere varighed er faktisk brugt i planen.

### Profile 7 - Goal-focused, 10K

- Fixture used: `profile-06` - Recreational 10K PR, 4x/week (exact)
- Track / goal / frequency: goal_focused / 10K pr / 4 days per week
- Key inputs surfaced: current level 30+ min sammenhaengende; current continuous distance 10 km; notes: Ingen ekstra noter.

**Plan summary**
- Duration: 14 weeks
- Sessions per week: 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4
- Long run presence: yes
- Quality workout presence: yes
- Notable structure: phases introduction -> continuous_running -> capacity -> race_preparation; 4 sessions in week 1; weekly counts across the plan: 4, 4, 4, 4, 4, 4; first key workouts: W1: Steady-pas (steady, 42.5 min); W1: Langt roligt pas (long, 59 min); W2: Progressionspas (progression, 36.5 min)

**Week 1 detail**
- 1. Roligt løb | type: easy | duration: 48 min | feel: easy | structure: Warmup 7 min / Run 36 min / Cooldown 3 min / Walk 2 min | HR: Zone 2
- 2. Recovery-pas | type: recovery | duration: 35.4 min | feel: easy | structure: Warmup 7 min / Run 23.4 min / Cooldown 3 min / Walk 2 min | HR: Zone 1-2
- 3. Steady-pas | type: steady | duration: 42.5 min | feel: moderate | structure: Warmup 7 min / Run 30.5 min / Cooldown 3 min / Walk 2 min | HR: Zone 2, Ovre zone 2
- 4. Langt roligt pas | type: long | duration: 59 min | feel: long | structure: Warmup 7 min / Run 47 min / Cooldown 3 min / Walk 2 min | HR: Zone 2

**Early progression snapshot (weeks 1-4)**
- Week 1: 4 sessions, total load 3h 4.9m, longest session 59 min, key sessions Steady-pas; Langt roligt pas
- Week 2: 4 sessions, total load 2h 38m, longest session 50.5 min, key sessions Progressionspas; Langt roligt pas
- Week 3: 4 sessions, total load 3h 29.5m, longest session 1h 7.5m, key sessions Progressionspas; Langt roligt pas
- Week 4: 4 sessions, total load 2h 55.5m, longest session 54.5 min, key sessions Langt roligt pas
- Long run progression: W1 59 min -> W2 50.5 min -> W3 1h 7.5m -> W4 54.5 min -> W5 1h 10.5m -> W6 1h 15m

**Goal-specific / readiness notes**
- 10 km måldag — Warmup 7 min / Run 60.5 min / Cooldown 3 min / Walk 2 min; goal-day run time 1h 10.5m
- No interval-shape notes surfaced in the reviewed sessions

**Engine / benchmark warnings**
- Warnings: none
- Findings: none

### Profile 8 - Goal-focused, half marathon

- Fixture used: `profile-10` - Half marathon improve, 4x/week (approximate; Closest fixture is a half-marathon PR profile at 4x/week with performance-oriented guidance.)
- Track / goal / frequency: unspecified / Halvmaraton pr / 4 days per week
- Key inputs surfaced: current level 30+ min sammenhaengende; current continuous distance n/a km; notes: Ingen ekstra noter.

**Plan summary**
- Duration: 18 weeks
- Sessions per week: 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4
- Long run presence: yes
- Quality workout presence: yes
- Notable structure: phases introduction -> continuous_running -> capacity -> race_preparation; 4 sessions in week 1; weekly counts across the plan: 4, 4, 4, 4, 4, 4; first key workouts: W1: Langt roligt pas (long, 1h 18.5m); W2: Langt roligt pas (long, 1h 6m); W3: Langt roligt pas (long, 1h 28m)

**Week 1 detail**
- 1. Roligt løb | type: easy | duration: 1h 3m | feel: easy | structure: Warmup 7 min / Run 51 min / Cooldown 3 min / Walk 2 min | HR: Zone 2
- 2. Recovery-pas | type: recovery | duration: 45.2 min | feel: easy | structure: Warmup 7 min / Run 33.2 min / Cooldown 3 min / Walk 2 min | HR: Zone 1-2
- 3. Roligt løb | type: easy | duration: 1h 3m | feel: easy | structure: Warmup 7 min / Run 51 min / Cooldown 3 min / Walk 2 min | HR: Zone 2
- 4. Langt roligt pas | type: long | duration: 1h 18.5m | feel: long | structure: Warmup 7 min / Run 66.5 min / Cooldown 3 min / Walk 2 min | HR: Zone 2

**Early progression snapshot (weeks 1-4)**
- Week 1: 4 sessions, total load 4h 9.7m, longest session 1h 18.5m, key sessions Langt roligt pas
- Week 2: 4 sessions, total load 3h 30.5m, longest session 1h 6m, key sessions Langt roligt pas
- Week 3: 4 sessions, total load 4h 42m, longest session 1h 28m, key sessions Langt roligt pas
- Week 4: 4 sessions, total load 3h 45m, longest session 1h 9.5m, key sessions Langt roligt pas
- Long run progression: W1 1h 18.5m -> W2 1h 6m -> W3 1h 28m -> W4 1h 9.5m -> W5 1h 30m -> W6 1h 36.5m

**Goal-specific / readiness notes**
- halvmaraton måldag — Warmup 7 min / Run 101.5 min / Cooldown 3 min / Walk 2 min; goal-day run time 1h 51.5m
- No interval-shape notes surfaced in the reviewed sessions

**Engine / benchmark warnings**
- Warnings: none
- Findings: none

### Profile 9 - Goal-focused, marathon

- Fixture used: `profile-14` - Marathon improve, 4x/week (exact)
- Track / goal / frequency: goal_focused / Marathon pr / 4 days per week
- Key inputs surfaced: current level 30+ min sammenhaengende; current continuous distance 18 km; notes: Ingen ekstra noter.

**Plan summary**
- Duration: 20 weeks
- Sessions per week: 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4
- Long run presence: yes
- Quality workout presence: yes
- Notable structure: phases introduction -> continuous_running -> capacity -> race_preparation; 4 sessions in week 1; weekly counts across the plan: 4, 4, 4, 4, 4, 4; first key workouts: W1: Steady-pas (steady, 1h); W1: Langt roligt pas (long, 1h 33.5m); W2: Tempopas (tempo, 49 min)

**Week 1 detail**
- 1. Roligt løb | type: easy | duration: 1h 14.5m | feel: easy | structure: Warmup 7 min / Run 62.5 min / Cooldown 3 min / Walk 2 min | HR: Zone 2
- 2. Recovery-pas | type: recovery | duration: 58.8 min | feel: easy | structure: Warmup 7 min / Run 46.8 min / Cooldown 3 min / Walk 2 min | HR: Zone 1-2
- 3. Steady-pas | type: steady | duration: 1h | feel: moderate | structure: Warmup 7 min / Run 48 min / Cooldown 3 min / Walk 2 min | HR: Zone 2, Ovre zone 2
- 4. Langt roligt pas | type: long | duration: 1h 33.5m | feel: long | structure: Warmup 7 min / Run 81.5 min / Cooldown 3 min / Walk 2 min | HR: Zone 2

**Early progression snapshot (weeks 1-4)**
- Week 1: 4 sessions, total load 4h 46.8m, longest session 1h 33.5m, key sessions Steady-pas; Langt roligt pas
- Week 2: 4 sessions, total load 4h 18m, longest session 1h 30m, key sessions Tempopas; Langt roligt pas
- Week 3: 4 sessions, total load 5h 48.8m, longest session 2h 2.5m, key sessions Tempopas; Langt roligt pas
- Week 4: 4 sessions, total load 4h 54.5m, longest session 1h 33m, key sessions Langt roligt pas
- Long run progression: W1 1h 33.5m -> W2 1h 30m -> W3 2h 2.5m -> W4 1h 33m -> W5 2h 1m -> W6 2h 12m

**Goal-specific / readiness notes**
- maraton måldag — Warmup 7 min / Run 180 min / Cooldown 3 min / Walk 2 min; goal-day run time 3h 10m
- No interval-shape notes surfaced in the reviewed sessions

**Engine / benchmark warnings**
- Warnings: none
- Findings: duration_override_respected: Den valgte længere varighed er faktisk brugt i planen.

### Profile 10 - Goal-focused, marathon, higher frequency

- Fixture used: `profile-50` - Experienced marathon PR, 4x/week (high volume) (approximate; No 5x/week marathon fixture exists; closest current fixture is the strongest 4x/week high-volume marathon PR profile.)
- Track / goal / frequency: goal_focused / Marathon pr / 4 days per week
- Key inputs surfaced: current level 30+ min sammenhaengende; current continuous distance 22 km; notes: Stabil erfaren lobertype med fokus pa en ny maraton-PR.

**Plan summary**
- Duration: 22 weeks
- Sessions per week: 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4
- Long run presence: yes
- Quality workout presence: yes
- Notable structure: phases introduction -> continuous_running -> capacity -> race_preparation; 4 sessions in week 1; weekly counts across the plan: 4, 4, 4, 4, 4, 4; first key workouts: W1: Steady-pas (steady, 1h); W1: Langt roligt pas (long, 1h 33.5m); W2: Tempopas (tempo, 49 min)

**Week 1 detail**
- 1. Roligt løb | type: easy | duration: 1h 14.5m | feel: easy | structure: Warmup 7 min / Run 62.5 min / Cooldown 3 min / Walk 2 min | HR: Zone 2
- 2. Recovery-pas | type: recovery | duration: 1h 5.3m | feel: easy | structure: Warmup 7 min / Run 53.3 min / Cooldown 3 min / Walk 2 min | HR: Zone 1-2
- 3. Steady-pas | type: steady | duration: 1h | feel: moderate | structure: Warmup 7 min / Run 48 min / Cooldown 3 min / Walk 2 min | HR: Zone 2, Ovre zone 2
- 4. Langt roligt pas | type: long | duration: 1h 33.5m | feel: long | structure: Warmup 7 min / Run 81.5 min / Cooldown 3 min / Walk 2 min | HR: Zone 2

**Early progression snapshot (weeks 1-4)**
- Week 1: 4 sessions, total load 4h 53.3m, longest session 1h 33.5m, key sessions Steady-pas; Langt roligt pas
- Week 2: 4 sessions, total load 4h 45.5m, longest session 1h 44.5m, key sessions Tempopas; Langt roligt pas
- Week 3: 4 sessions, total load 6h 18.3m, longest session 2h 15.5m, key sessions Tempopas; Langt roligt pas
- Week 4: 4 sessions, total load 5h 30m, longest session 1h 41m, key sessions Langt roligt pas
- Long run progression: W1 1h 33.5m -> W2 1h 44.5m -> W3 2h 15.5m -> W4 1h 41m -> W5 2h 17.5m -> W6 2h 30m

**Goal-specific / readiness notes**
- maraton måldag — Warmup 7 min / Run 199 min / Cooldown 3 min / Walk 2 min; goal-day run time 3h 29m
- No interval-shape notes surfaced in the reviewed sessions

**Engine / benchmark warnings**
- Warnings: aggressive_progression_jump
- Findings: aggressive_progression_jump: Der er mindst ét progressionstrin, som hopper for brat. | duration_override_respected: Den valgte længere varighed er faktisk brugt i planen.

### Profile 11 - Faster/performance-oriented runner

- Fixture used: `profile-49` - Ambitious half target pace, 4x/week (approximate; Closest current fixture is an ambitious half target-pace profile at 4x/week.)
- Track / goal / frequency: unspecified / Halvmaraton target_time / 4 days per week
- Key inputs surfaced: current level 30+ min sammenhaengende; current continuous distance n/a km; notes: Vil presse forsigtigt pa mod et hurtigt halvmaraton omkring 4:00 pr km.

**Plan summary**
- Duration: 18 weeks
- Sessions per week: 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4
- Long run presence: yes
- Quality workout presence: yes
- Notable structure: phases introduction -> continuous_running -> capacity -> race_preparation; 4 sessions in week 1; weekly counts across the plan: 4, 4, 4, 4, 4, 4; first key workouts: W1: Langt roligt pas (long, 1h 30.5m); W2: Langt roligt pas (long, 1h 15.5m); W3: Langt roligt pas (long, 1h 41m)

**Week 1 detail**
- 1. Roligt løb | type: easy | duration: 1h 12.5m | feel: easy | structure: Warmup 7 min / Run 60.5 min / Cooldown 3 min / Walk 2 min | HR: Zone 2
- 2. Recovery-pas | type: recovery | duration: 51.3 min | feel: easy | structure: Warmup 7 min / Run 39.3 min / Cooldown 3 min / Walk 2 min | HR: Zone 1-2
- 3. Roligt løb | type: easy | duration: 1h 12.5m | feel: easy | structure: Warmup 7 min / Run 60.5 min / Cooldown 3 min / Walk 2 min | HR: Zone 2
- 4. Langt roligt pas | type: long | duration: 1h 30.5m | feel: long | structure: Warmup 7 min / Run 78.5 min / Cooldown 3 min / Walk 2 min | HR: Zone 2

**Early progression snapshot (weeks 1-4)**
- Week 1: 4 sessions, total load 4h 46.8m, longest session 1h 30.5m, key sessions Langt roligt pas
- Week 2: 4 sessions, total load 4h, longest session 1h 15.5m, key sessions Langt roligt pas
- Week 3: 4 sessions, total load 5h 25m, longest session 1h 41m, key sessions Langt roligt pas
- Week 4: 4 sessions, total load 4h 16.5m, longest session 1h 18.5m, key sessions Langt roligt pas
- Long run progression: W1 1h 30.5m -> W2 1h 15.5m -> W3 1h 41m -> W4 1h 18.5m -> W5 1h 41.5m -> W6 1h 50m

**Goal-specific / readiness notes**
- halvmaraton måldag — Warmup 7 min / Run 84.5 min / Cooldown 3 min / Walk 2 min; goal-day run time 1h 34.5m
- No interval-shape notes surfaced in the reviewed sessions

**Engine / benchmark warnings**
- Warnings: race_day_too_short
- Findings: none

### Profile 12 - Edge-case ambitious profile

- Fixture used: `profile-33` - Half complete durable, 2x/week (exact)
- Track / goal / frequency: goal_focused / Halvmaraton complete / 2 days per week
- Key inputs surfaced: current level Ca. 20-30 min sammenhaengende; current continuous distance 7 km; notes: Ingen ekstra noter.

**Plan summary**
- Duration: 20 weeks
- Sessions per week: 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2
- Long run presence: yes
- Quality workout presence: yes
- Notable structure: phases introduction -> continuous_running -> capacity -> race_preparation; 2 sessions in week 1; weekly counts across the plan: 2, 2, 2, 2, 2, 2; first key workouts: W1: Langt roligt pas (long, 49.5 min); W2: Langt roligt pas (long, 52 min); W3: Langt roligt pas (long, 54 min)

**Week 1 detail**
- 1. Roligt løb | type: easy | duration: 38 min | feel: easy | structure: Warmup 7 min / Run 26 min / Cooldown 3 min / Walk 2 min | HR: Zone 2
- 2. Langt roligt pas | type: long | duration: 49.5 min | feel: long | structure: Warmup 7 min / Run 37.5 min / Cooldown 3 min / Walk 2 min | HR: Zone 2

**Early progression snapshot (weeks 1-4)**
- Week 1: 2 sessions, total load 1h 27.5m, longest session 49.5 min, key sessions Langt roligt pas
- Week 2: 2 sessions, total load 1h 31.5m, longest session 52 min, key sessions Langt roligt pas
- Week 3: 2 sessions, total load 1h 35m, longest session 54 min, key sessions Langt roligt pas
- Week 4: 2 sessions, total load 1h 22.5m, longest session 48.5 min, key sessions Langt roligt pas
- Long run progression: W1 49.5 min -> W2 52 min -> W3 54 min -> W4 48.5 min -> W5 1h -> W6 1h 2.5m

**Goal-specific / readiness notes**
- halvmaraton måldag — Warmup 7 min / Run 82 min / Cooldown 3 min / Walk 2 min; goal-day run time 1h 32m
- No interval-shape notes surfaced in the reviewed sessions

**Engine / benchmark warnings**
- Warnings: none
- Findings: low_frequency_ambitious_but_respected: Ambitiøst lav frekvensvalg er respekteret uden skjult frekvensinflation. | duration_override_respected: Den valgte kortere varighed er faktisk brugt i planen.

## Cross-profile observations

- Beginner/returning protection: profile-45=pass, profile-04=pass, profile-08=pass, profile-48=pass. These plans open with mostly easy sessions and 2-3 weekly touches, which keeps the early structure conservative.
- Stronger runner posture: profile-06=easy/recovery/steady/long; profile-10=easy/recovery/easy/long; profile-14=easy/recovery/steady/long; profile-50=easy/recovery/steady/long; profile-49=easy/recovery/easy/long; profile-33=easy/long. The stronger profiles do surface quality work early, but the harness still flags a few as not differentiated enough.
- Aggressive progression signals: profile-50 show benchmark warnings for progression jumps, so those are the first profiles to review for week-to-week load increases.
- HM/Marathon realism: profile-14 goal day 3h 10m; profile-50 goal day 3h 29m. Marathon goal events are now full-length in identity and duration, but the remaining warnings focus more on progression and track posture than on collapsed race-day structure.

