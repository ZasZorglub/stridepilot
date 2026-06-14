"use client";

import type { SiteLocale } from "@/lib/site-variant";
import styles from "./HomeEntry.module.css";

export type HomePlanState = "none" | "ready" | "active";

type PathRole = "primary" | "secondary" | "inProgress" | "disabled";

export interface HomeEntryProps {
  locale: SiteLocale;
  firstName?: string;
  planState: HomePlanState;
  continueHint?: string | null;
  onContinue: () => void;
  onStart: () => void;
  onChooseStandard: () => void;
}

interface PathCopy {
  title: string;
  recommendedEyebrow: string;
  ctaLabel: string;
  bodyByRole: Record<PathRole, string>;
}

function buildCopy(locale: SiteLocale, continueHint?: string | null) {
  const en = locale === "en";
  const recommended = en ? "Recommended" : "Anbefalet";

  const continueBody = continueHint?.trim()
    ? continueHint.trim()
    : en
      ? "Pick up where you left off."
      : "Tag det næste pas, hvor du slap.";

  const cont: PathCopy = {
    title: en ? "Continue my plan" : "Fortsæt min træningsplan",
    recommendedEyebrow: recommended,
    ctaLabel: en ? "Continue" : "Fortsæt",
    bodyByRole: {
      primary: continueBody,
      secondary: continueBody,
      inProgress: continueBody,
      disabled: en
        ? "Starts once your plan is underway."
        : "Bliver klar, når din plan er sat i gang.",
    },
  };

  const start: PathCopy = {
    title: en ? "Start my plan" : "Start min træningsplan",
    recommendedEyebrow: recommended,
    ctaLabel: en ? "Start" : "Start",
    bodyByRole: {
      primary: en
        ? "Your plan is ready whenever you are."
        : "Din plan er klar, når du er.",
      secondary: en
        ? "Your plan is already underway."
        : "Din plan er allerede i gang.",
      inProgress: en
        ? "Your plan is already underway."
        : "Din plan er allerede i gang.",
      disabled: en
        ? "Choose a program first, then start here."
        : "Vælg et program først — så starter du her.",
    },
  };

  const standard: PathCopy = {
    title: en ? "Choose a standard program" : "Vælg et standardprogram",
    recommendedEyebrow: recommended,
    ctaLabel: en ? "Choose program" : "Vælg program",
    bodyByRole: {
      primary: en
        ? "Get going with a ready-made plan."
        : "Kom i gang med et færdigt forløb.",
      secondary: en
        ? "Switch to a ready-made plan."
        : "Skift til et færdigt forløb.",
      inProgress: en
        ? "Switch to a ready-made plan."
        : "Skift til et færdigt forløb.",
      disabled: "",
    },
  };

  return { cont, start, standard };
}

function rolesFor(planState: HomePlanState): {
  cont: PathRole;
  start: PathRole;
  standard: PathRole;
} {
  switch (planState) {
    case "active":
      return { cont: "primary", start: "inProgress", standard: "secondary" };
    case "ready":
      return { cont: "disabled", start: "primary", standard: "secondary" };
    case "none":
    default:
      return { cont: "disabled", start: "disabled", standard: "primary" };
  }
}

function LockIcon() {
  return (
    <svg
      className={styles.lockIcon}
      viewBox="0 0 24 24"
      width={14}
      height={14}
      aria-hidden="true"
    >
      <path
        d="M6.5 10V8a5.5 5.5 0 0 1 11 0v2M5 10h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PathCard({
  copy,
  role,
  locale,
  onActivate,
}: {
  copy: PathCopy;
  role: PathRole;
  locale: SiteLocale;
  onActivate: () => void;
}) {
  const en = locale === "en";
  const body = copy.bodyByRole[role];
  const interactive = role === "primary" || role === "secondary" || role === "inProgress";

  const content = (
    <>
      <div className={styles.cardText}>
        {role === "primary" && (
          <span className={styles.recommendedTag}>{copy.recommendedEyebrow}</span>
        )}
        {role === "inProgress" && (
          <span className={styles.statusTag}>
            <span className={styles.statusDot} aria-hidden="true" />
            {en ? "In progress" : "I gang"}
          </span>
        )}
        {role === "disabled" && (
          <span className={styles.lockedTag}>
            <LockIcon />
            {en ? "Locked" : "Ikke klar"}
          </span>
        )}
        <span className={styles.cardTitle}>{copy.title}</span>
        {body && <span className={styles.cardBody}>{body}</span>}
      </div>
      {role === "primary" && (
        <span className={styles.primaryPill}>{copy.ctaLabel}</span>
      )}
      {(role === "secondary" || role === "inProgress") && (
        <span className={styles.ghostPill} aria-hidden="true">
          {role === "inProgress" ? (en ? "Open" : "Åbn") : copy.ctaLabel}
        </span>
      )}
    </>
  );

  if (!interactive) {
    return (
      <div className={styles.card} data-role={role} aria-disabled="true">
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={styles.card}
      data-role={role}
      onClick={onActivate}
    >
      {content}
    </button>
  );
}

export function HomeEntry({
  locale,
  firstName,
  planState,
  continueHint,
  onContinue,
  onStart,
  onChooseStandard,
}: HomeEntryProps) {
  const en = locale === "en";
  const copy = buildCopy(locale, continueHint);
  const roles = rolesFor(planState);
  const name = firstName?.trim();

  const greeting = name
    ? en
      ? `Hi, ${name}`
      : `Hej, ${name}`
    : en
      ? "Welcome back"
      : "Velkommen tilbage";

  return (
    <section className={styles.home} aria-label={en ? "Home" : "Hjem"}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>StridePilot</p>
          <h1 className={styles.greeting}>{greeting}</h1>
          <p className={styles.lead}>
            {en ? "What would you like to do?" : "Hvad vil du i dag?"}
          </p>
        </header>

        <div className={styles.paths}>
          <PathCard copy={copy.cont} role={roles.cont} locale={locale} onActivate={onContinue} />
          <PathCard copy={copy.start} role={roles.start} locale={locale} onActivate={onStart} />
          <PathCard
            copy={copy.standard}
            role={roles.standard}
            locale={locale}
            onActivate={onChooseStandard}
          />
        </div>
      </div>
    </section>
  );
}
