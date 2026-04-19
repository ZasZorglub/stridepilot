import { getConfiguredSiteLocale, SiteLocale } from "./site-variant";

export type FeedbackMailParams = {
  locale?: string;
  host?: string;
  track?: string | null;
  goal?: string | null;
  daysPerWeek?: number | null;
};

const FEEDBACK_EMAIL = "info@simplesolutionselearning.dk";
const FEEDBACK_SUBJECT = "StridePilot beta feedback";

function resolveFeedbackLocale(params: FeedbackMailParams): SiteLocale {
  const normalizedLocale = (params.locale ?? "").trim().toLowerCase();
  if (normalizedLocale.startsWith("en")) return "en";
  if (normalizedLocale.startsWith("da")) return "da";
  return getConfiguredSiteLocale(params.host);
}

function fallbackValue(value: string | number | null | undefined, locale: SiteLocale): string {
  if (value === null || value === undefined || value === "") {
    return locale === "en" ? "unknown" : "ukendt";
  }
  return String(value);
}

export function buildFeedbackMailto(params: FeedbackMailParams): string {
  const locale = resolveFeedbackLocale(params);
  const host = fallbackValue(params.host, locale);
  const track = fallbackValue(params.track, locale);
  const goal = fallbackValue(params.goal, locale);
  const days = fallbackValue(params.daysPerWeek, locale);
  const localeValue = fallbackValue(params.locale ?? locale, locale);

  const body = locale === "en"
    ? `Hi 👋

Thanks for trying StridePilot — this helps a lot.

1. What did you want to achieve with your running?

2. Does the plan feel realistic for you?
   (too easy / too hard / about right)

3. How does the first week look to you?

4. Did anything feel confusing or unclear?

5. Did you try a workout yet?
   (If yes: how did it feel?)

6. Anything else you’d change or improve?

---

Technical context:

* Host: ${host}
* Locale: ${localeValue}
* Track: ${track}
* Goal: ${goal}
* Days per week: ${days}

Thanks again 🙏`
    : `Hej 👋

Tak fordi du prøver StridePilot — det hjælper rigtig meget.

1. Hvad vil du gerne opnå med din løbetræning?

2. Føles planen realistisk for dig?
   (for let / for hård / passende)

3. Hvordan ser første uge ud for dig?

4. Var der noget, der var uklart?

5. Har du prøvet et træningspas?
   (Hvis ja: hvordan føltes det?)

6. Hvad ville du ændre eller forbedre?

---

Teknisk kontekst:

* Host: ${host}
* Sprog: ${localeValue}
* Niveau: ${track}
* Mål: ${goal}
* Dage per uge: ${days}

Tak 🙏`;

  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(FEEDBACK_SUBJECT)}&body=${encodeURIComponent(body)}`;
}
