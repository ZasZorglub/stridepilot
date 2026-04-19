import { SiteLocale } from "./site-variant";

export interface PulseSettingsState {
  enabled: boolean;
  maxHeartRate: number | null;
}

export interface PulseZoneLegendEntry {
  zoneLabel: string;
  rangeLabel: string;
  description: string;
}

const ZONE_DETAILS: Record<string, { minPct: number; maxPct: number; description: string }> = {
  "Zone 1-2": { minPct: 0.6, maxPct: 0.75, description: "Rolig opvarmning, nedkøling og let restitution." },
  "Zone 2": { minPct: 0.68, maxPct: 0.78, description: "Roligt aerob arbejde, hvor du stadig kan føre en samtale." },
  "Ovre zone 2": { minPct: 0.76, maxPct: 0.82, description: "Jævnt steady-arbejde lige under det mere krævende tempo." },
  "Zone 3": { minPct: 0.82, maxPct: 0.88, description: "Kontrolleret kvalitetsarbejde med tydelig indsats, men stadig styring." },
  "Zone 4": { minPct: 0.88, maxPct: 0.94, description: "Korte, fokuserede drag med højere belastning." },
};

function rangeLabelForZone(minPct: number, maxPct: number, maxHeartRate: number | null): string {
  if (isPlausibleMaxHeartRate(maxHeartRate)) {
    return `${Math.round(maxHeartRate * minPct)}-${Math.round(maxHeartRate * maxPct)} bpm`;
  }
  return `${Math.round(minPct * 100)}-${Math.round(maxPct * 100)} % af makspuls`;
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

export function buildPulseGuidanceSummary(settings: PulseSettingsState, locale: SiteLocale = "da"): string {
  if (!settings.enabled) {
    return locale === "en" ? "Heart rate is turned off as an extra guide." : "Puls er slået fra som ekstra guide.";
  }

  if (isPlausibleMaxHeartRate(settings.maxHeartRate)) {
    return locale === "en"
      ? `Heart rate is used as an extra guide with max heart rate ${settings.maxHeartRate}.`
      : `Puls bruges som ekstra guide med makspuls ${settings.maxHeartRate}.`;
  }

  return locale === "en"
    ? "Heart rate is used as an extra guide if you want to add your max heart rate."
    : "Puls bruges som ekstra guide, når du vil tilføje din makspuls.";
}

export function buildPulseGuidanceWarning(value: string, enabled: boolean, locale: SiteLocale = "da"): string | null {
  if (!enabled || !value.trim()) return null;
  if (/^\d$/.test(value.trim())) return null;
  if (parseMaxHeartRateInput(value) !== null) return null;
  return locale === "en"
    ? "Max heart rate must be a realistic number between 120 and 240."
    : "Makspuls skal være et realistisk tal mellem 120 og 240.";
}

export function buildPulseZoneLegend(
  maxHeartRate: number | null,
  requestedZoneLabels?: string[] | null,
): PulseZoneLegendEntry[] {
  const orderedLabels = requestedZoneLabels?.length
    ? [...new Set(requestedZoneLabels.filter((label): label is keyof typeof ZONE_DETAILS => label in ZONE_DETAILS))]
    : (Object.keys(ZONE_DETAILS) as Array<keyof typeof ZONE_DETAILS>);

  return orderedLabels.map((zoneLabel) => {
    const zone = ZONE_DETAILS[zoneLabel];
    return {
      zoneLabel,
      rangeLabel: rangeLabelForZone(zone.minPct, zone.maxPct, maxHeartRate),
      description: zone.description,
    };
  });
}

export function getPulseZoneLegendEntry(
  zoneLabel: string | null | undefined,
  maxHeartRate: number | null,
): PulseZoneLegendEntry | null {
  if (!zoneLabel || !(zoneLabel in ZONE_DETAILS)) return null;
  return buildPulseZoneLegend(maxHeartRate, [zoneLabel])[0] ?? null;
}
