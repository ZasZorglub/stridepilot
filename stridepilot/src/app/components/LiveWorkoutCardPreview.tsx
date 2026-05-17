import type { CSSProperties } from "react";
import styles from "./LiveWorkoutCardPreview.module.css";

type LiveWorkoutCardPreviewData = {
  state: "run" | "walk" | "warmup" | "cooldown";
  title: string;
  remainingTime: string;
  cue: string;
  heartRate?: number | string;
  heartRateLabel?: string;
  progress: number;
};

type LiveWorkoutCardProps = LiveWorkoutCardPreviewData & {
  finalHint?: string;
  notice?: string;
  transitionKey?: string | number;
};

const previewData: LiveWorkoutCardPreviewData = {
  state: "run",
  title: "Løb",
  remainingTime: "1:09",
  cue: "Løb roligt og kontrolleret.",
  heartRate: 168,
  heartRateLabel: "SLAG/MIN",
  progress: 0.35,
};

export function LiveWorkoutCardPreview() {
  return <LiveWorkoutCard {...previewData} />;
}

export function LiveWorkoutCard({
  state,
  title,
  remainingTime,
  cue,
  heartRate,
  heartRateLabel,
  progress,
  finalHint,
  notice,
  transitionKey,
}: LiveWorkoutCardProps) {
  const normalizedProgress = Math.min(Math.max(progress, 0), 1);
  const hasHeartRate = heartRate !== undefined && heartRate !== null && heartRate !== "" && Boolean(heartRateLabel);
  const contentTransitionKey = transitionKey ?? `${state}-${title}`;

  return (
    <section className={styles.circularCard} data-state={state} aria-label="Live workout">
      {notice && <p className={styles.notice}>{notice}</p>}
      <div className={styles.circularRingWrap}>
        <svg className={styles.circularRing} viewBox="0 0 220 220" aria-hidden="true">
          <circle className={styles.circularRingBase} cx="110" cy="110" r="91" pathLength="1" />
          <circle
            key={`progress-${contentTransitionKey}`}
            className={styles.circularRingProgress}
            cx="110"
            cy="110"
            r="91"
            pathLength="1"
            style={{ "--progress": normalizedProgress } as CSSProperties}
          />
        </svg>
        <div className={styles.circularCenter}>
          <span className={styles.circularNow}>NU</span>
          <h2 key={`title-${contentTransitionKey}`}>{title}</h2>
          <strong key={`time-${contentTransitionKey}`}>{remainingTime}</strong>
          {hasHeartRate && (
            <span className={styles.circularHeartRate}>
              <HeartIcon />
              <span>{heartRate}</span>
              <small>{heartRateLabel}</small>
            </span>
          )}
        </div>
      </div>

      {cue && <p key={`cue-${contentTransitionKey}`} className={styles.circularCue}>{cue}</p>}
      {finalHint && <p className={styles.finalHint}>{finalHint}</p>}
    </section>
  );
}

function HeartIcon() {
  return (
    <svg className={styles.heartIcon} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 20.2s-6.9-4.4-9-8.7C1.2 7.8 3.4 4.2 7.2 4.2c2 0 3.5 1 4.3 2.4.8-1.4 2.3-2.4 4.3-2.4 3.8 0 6 3.6 4.2 7.3-2.1 4.3-9 8.7-9 8.7Z"
        fill="currentColor"
      />
    </svg>
  );
}
