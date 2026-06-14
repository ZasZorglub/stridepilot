"use client";

import type { CSSProperties } from "react";
import type { PhaseEntry, WorkoutPhaseKind } from "./types";
import styles from "./PhaseStrip.module.css";

const PHASE_RGB: Record<WorkoutPhaseKind, string> = {
  warmup: "198, 221, 233",
  run: "79, 190, 248",
  walk: "246, 250, 252",
  cooldown: "198, 221, 233",
};

export interface PhaseStripProps {
  phases: PhaseEntry[];
  currentIdx: number;
  positionInPhase: number;
  paused?: boolean;
  dim?: boolean;
  className?: string;
}

export function PhaseStrip({
  phases,
  currentIdx,
  positionInPhase,
  paused = false,
  dim = false,
  className,
}: PhaseStripProps) {
  if (!phases.length) return null;

  const safeCurrentIdx = Math.max(0, Math.min(currentIdx, phases.length - 1));
  const totalWeight = phases.reduce((sum, phase) => sum + phase.weight, 0);

  if (totalWeight <= 0) return null;

  const completedWeight = phases
    .slice(0, safeCurrentIdx)
    .reduce((sum, phase) => sum + phase.weight, 0);
  const currentWeight = phases[safeCurrentIdx].weight;
  const markerPct =
    ((completedWeight + currentWeight * clamp01(positionInPhase)) /
      totalWeight) *
    100;

  return (
    <div
      className={[styles.strip, className ?? ""].filter(Boolean).join(" ")}
      data-paused={paused || undefined}
      data-dim={dim || undefined}
      aria-hidden="true"
    >
      <div className={styles.cells}>
        {phases.map((phase, index) => {
          const state =
            index < safeCurrentIdx
              ? "done"
              : index === safeCurrentIdx
                ? "current"
                : "future";

          return (
            <span
              key={`${phase.kind}-${index}`}
              className={styles.cell}
              data-state={state}
              style={
                {
                  flex: Math.max(phase.weight, 0),
                  "--cell-rgb": PHASE_RGB[phase.kind],
                } as CSSProperties
              }
            />
          );
        })}
      </div>

      <span
        className={styles.marker}
        style={{ left: `${markerPct}%` }}
      />
    </div>
  );
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
