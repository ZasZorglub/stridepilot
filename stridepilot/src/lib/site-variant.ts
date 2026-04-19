export type SiteLocale = "da" | "en";

function normalizeHost(host?: string | null): string {
  return (host ?? "").trim().toLowerCase();
}

export function resolveSiteLocaleFromHost(host?: string | null): SiteLocale {
  const normalizedHost = normalizeHost(host);
  if (normalizedHost.includes("stridepilot.eu") || normalizedHost.endsWith(".eu")) return "en";
  return "da";
}

export function getConfiguredSiteLocale(host?: string | null): SiteLocale {
  const explicitLocale = process.env.NEXT_PUBLIC_SITE_LOCALE?.trim().toLowerCase();
  if (explicitLocale === "en" || explicitLocale === "da") return explicitLocale;
  return resolveSiteLocaleFromHost(host);
}

