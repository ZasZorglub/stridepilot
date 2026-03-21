import { AdaptationMode, CapabilityState, FeedbackSnapshot } from "./capability";

export type AdaptationDecision = {
  mode: AdaptationMode;
  reason: string;
};

function recentWindow(history: FeedbackSnapshot[], size: number): FeedbackSnapshot[] {
  return history.slice(-Math.max(0, Math.min(6, size)));
}

function count<T>(items: T[], predicate: (item: T) => boolean): number {
  return items.filter(predicate).length;
}

function bounceBackReady(items: FeedbackSnapshot[]): boolean {
  if (items.length < 2) return false;
  return items.every(
    (item) =>
      item.completed &&
      item.completionPct >= 88 &&
      item.energy !== "low" &&
      item.pain !== "moderate" &&
      item.pain !== "high" &&
      item.difficulty !== "very_hard",
  );
}

export function decideAdaptationMode(capability: CapabilityState): AdaptationDecision {
  const recent = recentWindow(capability.recentFeedback, 6);
  const focus = recentWindow(recent, 4);
  const traits = capability.traits;

  if (recent.length === 0) {
    return {
      mode: "hold",
      reason: "Der er endnu ikke nok feedback til at ændre mikrocyklussen.",
    };
  }

  const missedCount = count(focus, (item) => !item.completed || item.completionPct < 70);
  const hardCount = count(focus, (item) => item.difficulty === "hard" || item.difficulty === "very_hard" || item.effort >= 8);
  const painCount = count(focus, (item) => item.pain === "moderate" || item.pain === "high");
  const highPainCount = count(focus, (item) => item.pain === "high");
  const lowEnergyCount = count(focus, (item) => item.energy === "low");
  const cautionCount = count(focus, (item) => item.noteCaution || item.progressionPauseWeeks > 0 || item.adaptationFactor < 0.95);
  const tooEasyCount = count(
    focus,
    (item) => item.completed && item.completionPct >= 90 && item.difficulty === "easy" && item.energy === "high" && item.pain !== "moderate" && item.pain !== "high",
  );
  const latestStable = recentWindow(recent, 2);
  const latestThree = recentWindow(recent, 3);
  const priorThree = recent.slice(0, -2).slice(-3);
  const hadRecentCautionMode =
    capability.lastAdaptationMode === "down_shift" ||
    capability.lastAdaptationMode === "recovery_microcycle" ||
    recent.some((item) => item.noteCaution || item.progressionPauseWeeks > 0 || item.energy === "low" || item.difficulty === "very_hard");
  const priorPatchWasRough =
    priorThree.length > 0 &&
    priorThree.some(
      (item) =>
        !item.completed ||
        item.progressionPauseWeeks > 0 ||
        item.noteCaution ||
        item.energy === "low" ||
        item.difficulty === "very_hard" ||
        item.pain === "moderate" ||
        item.pain === "high",
    );
  const fragileRunner = traits.cautionTrend >= 4 || traits.durabilityTrend <= 2.3 || traits.complianceTrend <= 2.4;
  const qualityFragile = traits.qualityTolerance <= 2.4;
  const longRunFragile = traits.longRunTolerance <= 2.4;
  const durableRunner = traits.durabilityTrend >= 3.7 && traits.complianceTrend >= 3.5;
  const progressionReady = traits.progressionTolerance >= 3.6 && traits.cautionTrend <= 3.1;
  const resumeReady = traits.progressionTolerance >= 3 && traits.complianceTrend >= 3.2 && traits.cautionTrend <= 3.4;

  if (
    highPainCount >= 1 ||
    painCount >= 2 ||
    (missedCount >= 2 && (hardCount >= 2 || lowEnergyCount >= 1)) ||
    (cautionCount >= 2 && painCount >= 1) ||
    (capability.recoveryDebt >= 7 && lowEnergyCount >= 1) ||
    (fragileRunner && painCount >= 1 && (lowEnergyCount >= 1 || missedCount >= 1)) ||
    (longRunFragile && painCount >= 1 && cautionCount >= 1)
  ) {
    return {
      mode: "recovery_microcycle",
      reason: "Flere nyere signaler peger på, at kroppen er presset, så næste uge skal være klart lettere.",
    };
  }

  if (
    missedCount >= 2 ||
    hardCount >= 2 ||
    lowEnergyCount >= 2 ||
    cautionCount >= 2 ||
    capability.recoveryDebt >= 6 ||
    capability.fatigueIndex >= 6 ||
    (fragileRunner && (hardCount >= 1 || lowEnergyCount >= 1 || cautionCount >= 1)) ||
    (qualityFragile && hardCount >= 1 && cautionCount >= 1)
  ) {
    return {
      mode: "down_shift",
      reason: "Den seneste trend er lidt for hård eller ujævn, så næste uge skal ned i belastning.",
    };
  }

  if (
    hadRecentCautionMode &&
    bounceBackReady(latestStable) &&
    priorPatchWasRough &&
    resumeReady
  ) {
    return {
      mode: "resume_build",
      reason: "Du ser ud til at have rystet den svære periode af dig, så vi kan forsigtigt vende tilbage til progression.",
    };
  }

  if (
    latestThree.length >= 3 &&
    tooEasyCount >= (durableRunner ? 2 : 3) &&
    lowEnergyCount === 0 &&
    painCount === 0 &&
    missedCount === 0 &&
    progressionReady
  ) {
    return {
      mode: "progress",
      reason:
        durableRunner
          ? "Du har håndteret den seneste progression stabilt og flere pas har set for lette ud, så vi kan skrue lidt mere tillidsfuldt op."
          : "Flere nyere pas har set for lette ud med godt overskud, så vi kan skrue forsigtigt op.",
    };
  }

  return {
    mode: "hold",
    reason: "Feedbacken ser samlet set stabil ud, så mikrocyklussen kan fortsætte uden større ændringer.",
  };
}
