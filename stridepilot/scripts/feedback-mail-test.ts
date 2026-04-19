import assert from "node:assert/strict";

import { buildFeedbackMailto } from "../src/lib/feedback-mail";

const englishMailto = buildFeedbackMailto({
  locale: "en",
  host: "stridepilot.eu",
  track: "Goal focused",
  goal: "Half marathon · Target pace",
  daysPerWeek: 4,
});

assert.match(
  englishMailto,
  /^mailto:info@simplesolutionselearning\.dk\?subject=StridePilot%20beta%20feedback&body=/,
  "The English feedback link should target the shared feedback inbox with the beta feedback subject",
);
const decodedEnglishMailto = decodeURIComponent(englishMailto);
assert.match(decodedEnglishMailto, /Hi 👋/, "The .eu feedback mail should use the English greeting");
assert.match(decodedEnglishMailto, /\* Host: stridepilot\.eu/, "The .eu feedback mail should include the current host");
assert.match(decodedEnglishMailto, /\* Locale: en/, "The .eu feedback mail should include the current locale");
assert.match(decodedEnglishMailto, /\* Track: Goal focused/, "The .eu feedback mail should include the current track");
assert.match(decodedEnglishMailto, /\* Goal: Half marathon · Target pace/, "The .eu feedback mail should include the goal summary");
assert.match(decodedEnglishMailto, /\* Days per week: 4/, "The .eu feedback mail should include the weekly training days");

const danishMailto = buildFeedbackMailto({
  locale: "da",
  host: "stridepilot.dk",
  track: null,
  goal: null,
  daysPerWeek: null,
});

const decodedDanishMailto = decodeURIComponent(danishMailto);
assert.match(decodedDanishMailto, /Hej 👋/, "The .dk feedback mail should use the Danish greeting");
assert.match(decodedDanishMailto, /\* Host: stridepilot\.dk/, "The .dk feedback mail should include the current host");
assert.match(decodedDanishMailto, /\* Sprog: da/, "The .dk feedback mail should include the current locale");
assert.match(decodedDanishMailto, /\* Niveau: ukendt/, "Missing track should fall back to 'ukendt' in Danish");
assert.match(decodedDanishMailto, /\* Mål: ukendt/, "Missing goal should fall back to 'ukendt' in Danish");
assert.match(decodedDanishMailto, /\* Dage per uge: ukendt/, "Missing days should fall back to 'ukendt' in Danish");

console.log("feedback mail helper tests passed");
