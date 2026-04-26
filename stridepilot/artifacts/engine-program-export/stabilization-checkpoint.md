# StridePilot Engine Stabilization Checkpoint

Accepted state after the current beginner hardening sequence:

- review flags remain at `0`
  - `passive_start`
  - `low_meaningful_running`
  - `long_passive_finish`
  - `muddy_structure`
- weak beginners remain protected by run-walk onboarding and conservative early progression
- beginner run-walk sessions keep meaningful running through weeks 3–6
- beginner easy sessions no longer collapse into token `5m` sessions after meaningful capacity has been established
- capable recent / returning beginners with real continuous capacity exit repeated early run-walk earlier
- cautious long-break / lower-confidence runners remain more protected than capable recent / returning beginners
- stronger-runner structure remains unchanged

Guardrail test coverage for the accepted state lives in:

- [scripts/coach-guardrails-test.ts](/Users/anderschristiansloth/stridepilot/stridepilot/scripts/coach-guardrails-test.ts:1)

Primary verification command:

```bash
cd /Users/anderschristiansloth/stridepilot/stridepilot
npm run test:coach-guardrails
```

This checkpoint is intended as the current fallback state for future engine work.
