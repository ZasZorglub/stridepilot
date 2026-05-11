import type { CSSProperties } from "react";
import styles from "./LiveWorkoutCardPreview.module.css";

type LiveWorkoutCardPreviewData = {
  state: "run";
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
}: LiveWorkoutCardProps) {
  const normalizedProgress = Math.min(Math.max(progress, 0), 1);
  const hasHeartRate = heartRate !== undefined && heartRate !== null && heartRate !== "" && Boolean(heartRateLabel);

  return (
    <section className={styles.card} data-state={state} aria-label="Live workout">
      {notice && <p className={styles.notice}>{notice}</p>}
      <header className={styles.header}>
        <span className={styles.now}>NU</span>
        <h2>{title}</h2>
      </header>

      <div
        className={styles.liveCapsule}
        style={{ "--progress": normalizedProgress } as CSSProperties}
      >
        <span className={styles.capsuleAccent} aria-hidden="true" />
        <div className={`${styles.liveCapsuleContent} ${hasHeartRate ? "" : styles.liveCapsuleContentSolo}`.trim()}>
          <div className={styles.timeBlock}>
            <span>{remainingTime}</span>
          </div>
          {hasHeartRate && (
            <>
              <span className={styles.divider} aria-hidden="true" />
              <div className={styles.heartRateBlock}>
                <span className={styles.heartRow}>
                  <HeartIcon />
                  <strong>{heartRate}</strong>
                </span>
                <span className={styles.heartRateLabel}>{heartRateLabel}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {cue && <p className={styles.cue}>{cue}</p>}
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
