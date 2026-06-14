"use client";

import type { CSSProperties } from "react";
import styles from "./WorkoutRing.module.css";

export interface WorkoutRingProps {
  size?: number;
  stroke?: number;
  progress: number;
  color: string;
  base?: string;
  cap?: "round" | "butt";
  glow?: boolean;
  breathing?: boolean;
  breathingMs?: number;
  beatKey?: string | number;
  className?: string;
  style?: CSSProperties;
}

export function WorkoutRing({
  size = 320,
  stroke = 6,
  progress,
  color,
  base = "rgba(196, 211, 222, 0.10)",
  cap = "round",
  glow = false,
  breathing = false,
  breathingMs,
  beatKey,
  className,
  style,
}: WorkoutRingProps) {
  const radius = size / 2 - stroke - 1;
  const circumference = 2 * Math.PI * radius;
  const clampedProgress = Math.max(0, Math.min(1, progress));

  const composedStyle: CSSProperties = {
    ...style,
    ...(breathingMs
      ? ({ "--sp-breath-current": `${breathingMs}ms` } as CSSProperties)
      : {}),
  };

  return (
    <span
      key={beatKey != null ? `beat-${beatKey}` : undefined}
      className={[
        styles.beatWrap,
        beatKey != null ? styles.beatActive : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        className={[
          styles.ring,
          glow ? styles.glow : "",
          breathing ? styles.breathing : "",
          className ?? "",
        ]
          .filter(Boolean)
          .join(" ")}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={composedStyle}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={base}
          strokeWidth={stroke}
          strokeLinecap={cap}
        />
        <circle
          className={styles.progress}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap={cap}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clampedProgress)}
        />
      </svg>
    </span>
  );
}
