export const redditBetaPackage = {
  titleOptions: [
    "Built a calmer adaptive running app and I’m opening a small English beta",
    "Looking for runners to try a coach-like adaptive training beta",
    "Small beta: an adaptive running app that tries to feel more like a real coach",
  ],
  mainPost: `Hi, I’m building StridePilot: a calm, coach-like running app that adapts your plan as you train.

The short version is that I wanted something that felt less like a generic plan generator and more like a thoughtful coach:

- it starts from your real current level
- it adjusts from your workout feedback
- it explains changes in plain language
- it tries to stay safe for beginners without flattening stronger runners into the same middle-of-the-road plan

Under the hood it is deterministic first, not "ask an AI for a plan and hope for the best". The LLM layer is secondary. The important part is that the training logic should feel stable, believable, and coach-credible.

I’ve just opened a small English beta at [stridepilot.eu](https://stridepilot.eu).

Who it is probably best for right now:

- beginners who want a calmer start
- runners coming back after a break
- recreational runners training for 5K, 10K, half marathon, or marathon
- runners who care whether the plan actually feels sensible week to week

Who it is not for yet:

- anyone expecting a polished full commercial launch
- anyone who wants every feature already finished
- anyone who does not mind a beta being a beta

If you try it, the most useful feedback is:

- anything confusing in onboarding
- wording that feels weird or low-trust
- workouts or plan changes that do not feel like something a competent coach would give
- bugs, broken flows, or places where the app says one thing and shows another

If that sounds interesting, I’d genuinely value a few honest beta testers:
[stridepilot.eu](https://stridepilot.eu)

You do not need to be nice. Honest is much more useful.`,
  shortAlternatives: [
    `I’m opening a small English beta for StridePilot at [stridepilot.eu](https://stridepilot.eu).

It’s an adaptive running app designed to feel calmer and more coach-like than a generic plan builder. It starts from your actual level, adjusts from feedback, and tries to explain why the plan changes.

If you try it, I’d love feedback on clarity, trust, and whether the training actually feels credible.`,
    `Built a small running beta I’d love some honest feedback on:
[stridepilot.eu](https://stridepilot.eu)

It’s for runners who want a more grounded, coach-like adaptive plan rather than a flashy “AI coach” vibe. Still early, but the core idea is: realistic start point, calm progression, clear workout guidance, and visible plan adjustments.

If anything feels confusing, off, or not coach-credible, that is exactly the feedback I want.`,
  ],
} as const;

export const testerInstructions = {
  inAppNote: {
    title: "Small English beta",
    body: "Answer onboarding as honestly as you can from your real current level, not from your best week. The most useful feedback is anything confusing, low-trust, oddly worded, or coach-unclear.",
    bullets: [
      "Use your real current level, not your ideal level",
      "Notice whether the recommendation and first weeks feel believable",
      "Tell us if wording, pacing, or plan logic feels off",
      "If something looks wrong, send the exact screen or phrase if you can",
    ],
  },
  followUpMessage: `Thanks for trying StridePilot.

The best way to test it is to treat the onboarding honestly and judge the app like you would judge a real coach:

- does the starting level feel right?
- does the recommendation make sense?
- do the first workouts feel believable?
- if the plan adapts, does the explanation feel clear and reasonable?

The most useful feedback is concrete:

- exact wording that sounds strange
- places where the app feels confusing
- workouts or plan changes that do not feel credible
- bugs, mismatches, or broken flows

If something feels off, even in a small way, please say so. Those details are exactly what helps most before a wider launch.`,
} as const;

export const feedbackPromptPackage = {
  inAppPrompt: "What felt clear, confusing, broken, or not coach-credible?",
  formIntro: "Thanks for trying the beta. Short, concrete feedback is best. If possible, include the exact screen, phrase, or workout that felt off.",
  usefulFeedbackPrompt: "The most useful reports are bugs, confusing UX, weird wording, training advice that feels untrustworthy, or feature requests that would remove friction.",
  categories: [
    "Bug",
    "Confusing UX",
    "Low trust / weird wording",
    "Coaching / training-plan issue",
    "Feature request",
  ],
  bugTemplate: [
    "What happened?",
    "What did you expect instead?",
    "Which screen or step was it on?",
    "Can you reproduce it?",
  ],
  coachingQualityTemplate: [
    "Which workout, recommendation, or plan change felt off?",
    "What exactly felt wrong or low-trust?",
    "What would have felt more credible?",
    "Are you a beginner, returning runner, steady runner, or more goal-focused runner?",
  ],
} as const;

export const betaLaunchChecklist = {
  preLaunch: [
    "Open stridepilot.eu on desktop and mobile and verify the first-run flow stays English throughout welcome, onboarding, recommendation, program, and workout.",
    "Create one beginner-style test account and one stronger-runner test account and confirm the first recommendation feels believable in both cases.",
    "Check that race-day labels, session titles, and feedback responses are English on the .eu path.",
    "Verify signup, login, plan generation, workout start, feedback submission, and plan updates all work without manual intervention.",
    "Make sure there is one clear way for testers to send feedback.",
  ],
  firstDays: [
    "Check feedback for repeated wording issues, trust breaks, and onboarding confusion.",
    "Watch for reports where session structure and labels still do not match.",
    "Look for places where strong runners feel flattened or beginners feel rushed.",
    "Log repeated friction in onboarding before chasing small polish ideas.",
  ],
  urgent: [
    "Broken signup or login",
    "Broken plan generation",
    "Visible mixed-language trust surfaces on .eu",
    "Workout or plan data that is obviously wrong or self-contradictory",
    "Goal-event or adaptation wording that clearly breaks trust",
  ],
  canWait: [
    "Minor wording polish",
    "Small visual rough edges",
    "Non-blocking feature requests",
    "Nice-to-have settings or export improvements",
  ],
} as const;

export const landingSupportCopy = {
  betaBadge: "English beta",
  betaNote: "This is an early beta. The core experience is usable, but some edges are still rough.",
  feedbackNote: "If anything feels confusing, off, or not coach-credible, please tell us.",
  honestOnboarding: "The best plan starts from honest answers about your real current level.",
  ambitiousRunnerNote: "If you are an experienced or ambitious runner, pay extra attention to whether the training still feels specific enough.",
  beginnerNote: "If you are newer to running, pay attention to whether the plan feels calm, clear, and safe to begin.",
} as const;
