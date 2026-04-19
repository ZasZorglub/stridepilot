"use client";

import posthog from "posthog-js";
import type { Goal, OnboardingTrack, WorkoutSession } from "@/lib/types";
import type { SiteLocale } from "@/lib/site-variant";

export type AnalyticsEventName =
  | "landing_view"
  | "signup_started"
  | "signup_completed"
  | "onboarding_started"
  | "onboarding_completed"
  | "plan_generated"
  | "workout_started"
  | "workout_completed"
  | "checkin_submitted";

type AnalyticsValue = string | number | boolean | null | undefined;
export type AnalyticsProperties = Record<string, AnalyticsValue>;

let initialized = false;

function cleanProperties(properties: AnalyticsProperties): Record<string, string | number | boolean> {
  return Object.fromEntries(
    Object.entries(properties).filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined && entry[1] !== null),
  );
}

function posthogKey(): string | undefined {
  return process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() || undefined;
}

function posthogHost(): string {
  return process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "https://eu.i.posthog.com";
}

export function initAnalytics(): void {
  if (initialized || typeof window === "undefined") return;
  const key = posthogKey();
  if (!key) return;

  posthog.init(key, {
    api_host: posthogHost(),
    person_profiles: "identified_only",
    capture_pageview: false,
    autocapture: false,
    capture_pageleave: true,
    persistence: "localStorage+cookie",
    loaded: (instance) => {
      instance.register({
        app_name: "stridepilot",
        app_env: process.env.NODE_ENV ?? "development",
      });
    },
  });
  initialized = true;
}

function posthogReady(): boolean {
  return Boolean(posthogKey());
}

export function captureAppEvent(event: AnalyticsEventName, properties: AnalyticsProperties = {}): void {
  initAnalytics();
  if (!posthogReady()) return;
  posthog.capture(
    event,
    cleanProperties({
      host: typeof window !== "undefined" ? window.location.host : undefined,
      ...properties,
    }),
  );
}

export function identifyAnalyticsUser(userId: string, properties: AnalyticsProperties = {}): void {
  initAnalytics();
  if (!posthogReady()) return;
  posthog.identify(userId, cleanProperties(properties));
}

export function resetAnalyticsUser(): void {
  if (!posthogReady()) return;
  posthog.reset();
}

export function buildAnalyticsPlanProperties(params: {
  locale: SiteLocale;
  goal: Goal;
  track?: OnboardingTrack;
  durationWeeks?: number | null;
}): AnalyticsProperties {
  return {
    locale: params.locale,
    goal_type: params.goal.goalType ?? null,
    goal_distance: params.goal.distance,
    track: params.track ?? null,
    weekly_days: params.goal.availableTrainingDays?.length ?? 0,
    duration_weeks: params.durationWeeks ?? params.goal.weeks,
  };
}

export function sessionAnalyticsType(session: WorkoutSession | null | undefined): string | null {
  if (!session) return null;
  const identity = `${session.title} ${session.notes ?? ""}`.toLowerCase();
  if (identity.includes("måldag") || identity.includes("race day")) return "goal_event";
  if (identity.includes("interval")) return "interval";
  if (identity.includes("tempo")) return "tempo";
  if (identity.includes("progress")) return "progression";
  if (identity.includes("steady")) return "steady";
  if (identity.includes("lang")) return "long_run";
  if (identity.includes("recovery")) return "recovery";
  return "workout";
}
