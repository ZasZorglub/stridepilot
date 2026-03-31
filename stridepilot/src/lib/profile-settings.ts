export interface PulseSettingsState {
  enabled: boolean;
  maxHeartRate: number | null;
}

export function isPlausibleMaxHeartRate(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 120 && value <= 240;
}

export function parseMaxHeartRateInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d{2,3}$/.test(trimmed)) return null;

  const parsed = Number(trimmed);
  return isPlausibleMaxHeartRate(parsed) ? parsed : null;
}

export function buildPulseGuidanceSummary(settings: PulseSettingsState): string {
  if (!settings.enabled) {
    return "Puls er slået fra som ekstra guide.";
  }

  if (isPlausibleMaxHeartRate(settings.maxHeartRate)) {
    return `Puls bruges som ekstra guide med makspuls ${settings.maxHeartRate}.`;
  }

  return "Puls bruges som ekstra guide, når du vil tilføje din makspuls.";
}

export function buildPulseGuidanceWarning(value: string, enabled: boolean): string | null {
  if (!enabled || !value.trim()) return null;
  if (/^\d$/.test(value.trim())) return null;
  if (parseMaxHeartRateInput(value) !== null) return null;
  return "Makspuls skal være et realistisk tal mellem 120 og 240.";
}
