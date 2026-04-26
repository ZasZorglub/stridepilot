# Capable Beginner Posture Review

Source: [50-programs.json](/Users/anderschristiansloth/stridepilot/stridepilot/artifacts/engine-program-export/50-programs.json:1)

## Review flags

- `passive_start`: `0`
- `low_meaningful_running`: `0`
- `long_passive_finish`: `0`
- `muddy_structure`: `0`

## 5K capable beginner check

### `diag-fixed-19`

This now exits repeated run-walk clearly earlier.

- Week 1: one calm `run-walk` opener
- Week 2+: `easy / easy / long`

Coach read:

- clearly less over-protected than before
- still calm and conservative
- good match for a runner with meaningful current capacity

## 10K capable beginner check

### `diag-fixed-05`

This also now exits run-walk early in a coach-credible way.

- Week 1: one `run-walk`
- Week 2+: `easy / easy / long`

This looks consistent with the intended policy.

### `diag-fixed-06`

This remains more protected.

- Weeks 1–5 still keep `run-walk` present

That looks intentional rather than wrong, because the interpreted profile is still materially weaker:

- `longestRunMinutes: 15`
- `confidence: 1`
- `injurySensitivity: 4`
- `currentRunsPerWeek: 1`

So this does not read like a 20+ minute capable runner being mishandled.

## Recent / returning vs long-break comparison

### Recent / capable

- `diag-fixed-19`: exits earlier
- `diag-fixed-05`: exits earlier
- `diag-stress-21`: exits earlier

### Long-break / more cautious

- `diag-fixed-06`: stays protected longer
- this remains coach-sound given the weaker interpreted profile

### Returning

- `diag-fixed-04` remains protected through weeks 3–5
- that also appears intentional because this interpreted profile is still only:
  - `longestRunMinutes: 12`
  - `confidence: 2`
  - `injurySensitivity: 4`

So the engine is not failing to distinguish a truly capable returner here. The exported profile is still cautious.

## Weak beginner protection check

Weak beginner cases remain protected:

- `diag-fixed-01`: still heavy early `run-walk`
- `diag-fixed-02`: still full protective `run-walk` onboarding
- `diag-fixed-03`: still protected, but without the previous pause-dominance problem

This is the right product split:

- capable beginners exit earlier
- weak beginners are not pulled forward with them

## Stronger-runner check

Stronger runners remain structurally unchanged.

Examples:

- `diag-fixed-12`: still `recovery / strides / long`, then `easy / recovery / strides / long`
- `diag-fixed-13`: still `recovery / strides / long`, then `easy / recovery / progression / long`

No spillover into stronger-runner behavior is visible.

## Recommendation

**accept current behavior**

