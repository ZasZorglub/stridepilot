# 50-Program Diagnostic

Source: [50-programs.json](/Users/anderschristiansloth/stridepilot/stridepilot/artifacts/engine-program-export/50-programs.json:1)

## Snapshot

- Programs analyzed: `50`
- Remaining review flags:
  - `passive_start`: `0`
  - `low_meaningful_running`: `20`
  - `long_passive_finish`: `0`
  - `muddy_structure`: `0`
- Unique week-1 signatures: `37`
- Unique first-4-week signatures: `40`

## What Improved

- The beginner easy-session collapse is gone.
- No beginner program now regresses into a `5m` easy session after establishing meaningful capacity.
- No remaining `passive_start`, `long_passive_finish`, or `muddy_structure` flags appear in the export.

## Main Remaining Weakness

The remaining weakness is concentrated in `run-walk` sessions that are still too pause-heavy after onboarding.

Typical flagged pattern:

- `2.5m kort gangstart -> 2m løb/gang blok x5 -> 2.5m pause -> 1m kort gangafslutning`
- `23.5m` total with only `10m` running

This is safe, but it still reads slightly underpowered once the runner has already built some continuity.

## Unexpected Convergence Still Present

Largest convergence groups across the first 4 weeks:

1. `5` scenarios converge to the same 2-day 10K conservative opening
   - `diag-fixed-07`
   - `diag-fixed-21`
   - `diag-stress-08`
   - `diag-stress-09`
   - `diag-stress-10`

2. `4` scenarios converge to the same 3-day beginner 10K opening
   - `diag-fixed-20`
   - `diag-stress-21`
   - `diag-stress-22`
   - `diag-stress-23`

3. Smaller 2-scenario convergences remain in:
   - `diag-fixed-05` / `diag-fixed-06`
   - `diag-fixed-18` / `diag-stress-03`
   - `diag-fixed-23` / `diag-stress-07`

These do not look broken, but they suggest the engine still compresses multiple distinct onboarding contexts into the same early plan shape.

## Weakest Programs Right Now

From a coach-credibility perspective, the weakest current programs are:

1. `diag-stress-04` — low-confidence long-break beginner, three-day
2. `diag-fixed-02` — true beginner 5K, three-day, low confidence
3. `diag-stress-06` — long-break beginner, two-day, partial week
4. `diag-fixed-01` — true beginner 5K, two-day, long break
5. `diag-fixed-03` — beginner run-walk 5K, recent, two-day
6. `diag-stress-02` — low-confidence recent beginner, three-day
7. `diag-stress-05` — recent beginner, two-day, partial week
8. `diag-fixed-19` — recent beginner 20-minute capacity, 5K, three-day

Why these are weakest:

- They still accumulate `low_meaningful_running`
- They still rely on repeated run-walk templates with pause-heavy middle weeks
- Some “recent beginner” cases still look more protected than their stated capacity suggests

## Capacity Regression Check

- Beginner easy-session regression after meaningful capacity: `none found`
- Remaining weakness is now in `run-walk` ratio and repetition, not in easy-session collapse

## Recommended Next Fix

**Next fix: tighten the `run-walk` meaningful-running guardrail in weeks 3–6 for beginner-like plans.**

Why:

- It is now the dominant remaining source of review flags
- It affects both fixed and stress beginner scenarios
- It would improve trust without requiring a redesign of onboarding, progression, or stronger-runner logic

