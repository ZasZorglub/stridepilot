"use client";

import type { CSSProperties } from "react";
import type { LiveWorkoutCardProps, WorkoutPhaseKind } from "./types";
import { WorkoutRing } from "./WorkoutRing";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";
import styles from "./LiveWorkoutCard.module.css";
import tokens from "./workoutTokens.module.css";

const PHASE_ACCENT: Record<WorkoutPhaseKind, string> = {
  warmup: "var(--sp-accent-warmup)",
  run: "var(--sp-accent-run)",
  walk: "var(--sp-accent-walk)",
  cooldown: "var(--sp-accent-cooldown)",
};

const PHASE_CAP: Record<WorkoutPhaseKind, "round" | "butt"> = {
  warmup: "butt",
  run: "round",
  walk: "butt",
  cooldown: "butt",
};

const PHASE_RGB: Record<WorkoutPhaseKind, string> = {
  warmup: "198, 221, 233",
  run: "79, 190, 248",
  walk: "246, 250, 252",
  cooldown: "198, 221, 233",
};

const PHASE_SHORT: Record<WorkoutPhaseKind, string> = {
  warmup: "opvarmning",
  run: "roligt løb",
  walk: "gang",
  cooldown: "nedkøling",
};

export function LiveWorkoutCard({
  phase,
  phaseLabel,
  remainingTime,
  progress,
  cue,
  heartRate,
  paused = false,
  anticipating = false,
  anticipationNum = null,
  transitionKey,
  nextPhaseKind = null,
  resumeN = 0,
}: LiveWorkoutCardProps) {
  const reducedMotion = usePrefersReducedMotion();
  const transitionKeyValue = transitionKey ?? phase;
  const resuming = resumeN > 0;
  const ringColor = paused ? "rgba(196, 211, 222, 0.28)" : PHASE_ACCENT[phase];
  const previewIntensity =
    anticipating && anticipationNum != null
      ? Math.min(1, (4 - anticipationNum) / 3)
      : 0;
  const nextRgb = nextPhaseKind ? PHASE_RGB[nextPhaseKind] : null;

  return (
    <section
      className={[tokens.workoutScope, styles.card].join(" ")}
      data-phase={phase}
      data-paused={paused || undefined}
      data-anticipating={anticipating || undefined}
      data-resuming={resuming || undefined}
      data-reduced-motion={reducedMotion || undefined}
      aria-label={paused ? "Pas på pause" : "Live pas"}
    >
      <span
        key={`wash-${transitionKeyValue}`}
        className={styles.bgWash}
        style={
          {
            "--wash-color": `rgba(${PHASE_RGB[phase]}, 0.32)`,
          } as CSSProperties
        }
        aria-hidden="true"
      />

      <div className={styles.ringWrap}>
        {anticipating && nextRgb && !paused && previewIntensity > 0 && (
          <span
            className={styles.previewHalo}
            style={
              {
                "--preview-color": `rgba(${nextRgb}, 0.85)`,
                opacity: previewIntensity,
              } as CSSProperties
            }
            aria-hidden="true"
          />
        )}

        {paused && !resuming && (
          <span className={styles.frozenHalo} aria-hidden="true" />
        )}

        <WorkoutRing
          size={340}
          stroke={anticipating ? 7.5 : paused ? 4 : 6}
          progress={progress}
          color={ringColor}
          base="var(--sp-ring-base)"
          cap={PHASE_CAP[phase]}
          glow={!paused}
          breathing={!paused && !anticipating && !reducedMotion}
          beatKey={transitionKeyValue}
        />

        <div className={styles.centerStack}>
          {resuming ? (
            <ResumeCountback n={resumeN as 1 | 2 | 3} />
          ) : (
            <>
              <span
                key={`nu-${transitionKeyValue}-${paused}`}
                className={styles.nuLabel}
                data-paused={paused || undefined}
              >
                {paused ? "PAUSE" : anticipating ? "SKIFTER" : "NU"}
              </span>

              <span key={`phase-${transitionKeyValue}`} className={styles.phaseLabel}>
                {phaseLabel}
              </span>

              <span
                key={`time-${transitionKeyValue}`}
                className={styles.timer}
                data-paused={paused || undefined}
              >
                <TickingTimer mmss={remainingTime} paused={paused} />
              </span>

              {anticipating && anticipationNum != null && !paused && (
                <span
                  key={`anticipating-${anticipationNum}`}
                  className={styles.anticipationNum}
                  style={
                    {
                      color: nextPhaseKind
                        ? PHASE_ACCENT[nextPhaseKind]
                        : PHASE_ACCENT[phase],
                    } as CSSProperties
                  }
                  aria-live="polite"
                >
                  Snart {nextPhaseKind ? PHASE_SHORT[nextPhaseKind] : ""}
                </span>
              )}

              {!anticipating && heartRate != null && !paused && (
                <span className={styles.heartRate}>
                  <HeartIcon />
                  <span>{heartRate}</span>
                </span>
              )}
            </>
          )}
        </div>
      </div>

      <p
        key={`cue-${transitionKeyValue}-${paused ? "paused" : "running"}`}
        className={styles.cue}
        data-paused={paused || undefined}
        data-hidden={resuming || undefined}
        aria-live="polite"
      >
        {cue}
      </p>
    </section>
  );
}

function ResumeCountback({ n }: { n: 1 | 2 | 3 }) {
  return (
    <span key={`resume-${n}`} className={styles.resume} aria-live="assertive">
      <span className={styles.resumeEyebrow}>Klar</span>
      <span className={styles.resumeNum}>{n}</span>
    </span>
  );
}

function TickingTimer({ mmss, paused }: { mmss: string; paused: boolean }) {
  const chars = mmss.split("");
  const lastIndex = chars.length - 1;

  return (
    <>
      {chars.map((char, index) =>
        index === lastIndex ? (
          <span
            key={`${char}-${paused ? "paused" : "running"}`}
            className={styles.digitTick}
            data-paused={paused || undefined}
          >
            {char}
          </span>
        ) : (
          <span key={`${char}-${index}`} className={styles.digit}>
            {char}
          </span>
        ),
      )}
    </>
  );
}

function HeartIcon() {
  return (
    <svg
      className={styles.heartIcon}
      viewBox="0 0 24 24"
      width={11}
      height={11}
      aria-hidden="true"
    >
      <path
        d="M12 20.2s-6.9-4.4-9-8.7C1.2 7.8 3.4 4.2 7.2 4.2c2 0 3.5 1 4.3 2.4.8-1.4 2.3-2.4 4.3-2.4 3.8 0 6 3.6 4.2 7.3-2.1 4.3-9 8.7-9 8.7Z"
        fill="currentColor"
      />
    </svg>
  );
}
