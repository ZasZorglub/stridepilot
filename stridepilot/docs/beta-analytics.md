# Beta Analytics

StridePilot uses three analytics layers in production:

- Vercel Web Analytics: traffic, pages, referrers, countries, devices
- Vercel Speed Insights: performance and Core Web Vitals
- PostHog: in-app beta usage events

## Vercel environment variables

Add these in Vercel for the project:

- `NEXT_PUBLIC_POSTHOG_KEY`
- `NEXT_PUBLIC_POSTHOG_HOST`

Recommended value for `NEXT_PUBLIC_POSTHOG_HOST`:

```txt
https://eu.i.posthog.com
```

If the PostHog variables are missing, the app still works. PostHog events simply stay disabled until the variables are added.

## Where to see the data

- Traffic data: Vercel project -> Analytics
- Performance data: Vercel project -> Speed Insights
- Product usage events: PostHog -> Events / Insights

## Events currently tracked

- `landing_view`
- `signup_started`
- `signup_completed`
- `onboarding_started`
- `onboarding_completed`
- `plan_generated`
- `workout_started`
- `workout_completed`
- `checkin_submitted`

Useful properties include:

- `host`
- `locale`
- `goal_type`
- `goal_distance`
- `track`
- `weekly_days`
- `duration_weeks`
- `session_type`

## Quick verification

1. Open `stridepilot.eu` and `stridepilot.dk`.
2. In Vercel, confirm page traffic appears in Analytics and Speed Insights.
3. In PostHog Live Events, go through signup/onboarding/plan/workout/check-in.
4. Confirm the expected events arrive with `host` and `locale`.
