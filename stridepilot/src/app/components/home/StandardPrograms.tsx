"use client";

import type { SiteLocale } from "@/lib/site-variant";
import styles from "./StandardPrograms.module.css";

export type StandardProgramId = "habit" | "beginner5k" | "comeback";

export interface StandardProgramsProps {
  locale: SiteLocale;
  selectedId?: StandardProgramId | null;
  onSelect: (id: StandardProgramId) => void;
  onBack: () => void;
}

interface ProgramCopy {
  id: StandardProgramId;
  title: string;
  description: string;
}

function buildPrograms(locale: SiteLocale): ProgramCopy[] {
  const en = locale === "en";
  return [
    {
      id: "habit",
      title: en ? "Get started" : "Kom i gang",
      description: en
        ? "For you who want to build the habit of running and walking at a calm pace."
        : "For dig der vil opbygge vanen med løb og gang i et roligt tempo.",
    },
    {
      id: "beginner5k",
      title: en ? "Beginner 5K" : "Begynder 5K",
      description: en
        ? "For you who want to work toward running 5 km in a sustainable way."
        : "For dig der vil arbejde mod at kunne løbe 5 km på en bæredygtig måde.",
    },
    {
      id: "comeback",
      title: en ? "Back after a break" : "Tilbage efter pause",
      description: en
        ? "For you who have run before but want to ease back in gently."
        : "For dig der har løbet før, men vil starte forsigtigt igen.",
    },
  ];
}

function ChevronIcon() {
  return (
    <svg
      className={styles.chevron}
      viewBox="0 0 24 24"
      width={18}
      height={18}
      aria-hidden="true"
    >
      <path
        d="M9 6l6 6-6 6"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StandardPrograms({
  locale,
  selectedId,
  onSelect,
  onBack,
}: StandardProgramsProps) {
  const en = locale === "en";
  const programs = buildPrograms(locale);

  return (
    <section
      className={styles.screen}
      aria-label={en ? "Standard programs" : "Standardprogrammer"}
    >
      <div className={styles.inner}>
        <header className={styles.header}>
          <button type="button" className={styles.backBtn} onClick={onBack}>
            <span className={styles.backArrow} aria-hidden="true">
              ←
            </span>
            {en ? "Home" : "Hjem"}
          </button>
          <p className={styles.eyebrow}>{en ? "Standard programs" : "Standardprogrammer"}</p>
          <h1 className={styles.title}>
            {en ? "Choose a program" : "Vælg et standardprogram"}
          </h1>
          <p className={styles.lead}>
            {en
              ? "Pick the starting point that fits you. You can adjust it next."
              : "Vælg det udgangspunkt der passer dig. Du kan tilpasse det bagefter."}
          </p>
        </header>

        <div className={styles.cards}>
          {programs.map((program) => (
            <button
              key={program.id}
              type="button"
              className={styles.card}
              data-selected={program.id === selectedId || undefined}
              onClick={() => onSelect(program.id)}
            >
              <span className={styles.cardText}>
                <span className={styles.cardTitle}>{program.title}</span>
                <span className={styles.cardBody}>{program.description}</span>
              </span>
              <ChevronIcon />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
