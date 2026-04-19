import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "..", "..");

const userFacingFiles = [
  path.join(repoRoot, "src/app/page.tsx"),
  path.join(repoRoot, "src/app/layout.tsx"),
  path.join(repoRoot, "src/app/manifest.webmanifest"),
  path.join(repoRoot, "src/lib/site-copy.ts"),
  path.join(repoRoot, "src/lib/site-variant.ts"),
];

const bannedPhrases = [
  "Din AI løbecoach",
  "AI-baseret løbeprogram",
  "Din adaptive løbecoach",
];

for (const file of userFacingFiles) {
  const content = fs.readFileSync(file, "utf8");
  for (const phrase of bannedPhrases) {
    assert.equal(
      content.includes(phrase),
      false,
      `User-facing copy in ${path.basename(file)} should no longer lead with "${phrase}"`,
    );
  }
}

const pageContent = fs.readFileSync(path.join(repoRoot, "src/app/page.tsx"), "utf8");
const siteCopyContent = fs.readFileSync(path.join(repoRoot, "src/lib/site-copy.ts"), "utf8");
const siteVariantContent = fs.readFileSync(path.join(repoRoot, "src/lib/site-variant.ts"), "utf8");
const layoutContent = fs.readFileSync(path.join(repoRoot, "src/app/layout.tsx"), "utf8");
const programScreenContent = fs.readFileSync(path.join(repoRoot, "src/lib/program-screen.ts"), "utf8");
const coachExplanationsContent = fs.readFileSync(path.join(repoRoot, "src/lib/coach/explanations.ts"), "utf8");
assert.match(
  siteCopyContent,
  /Your adaptive running app/,
  "The English beta copy should position StridePilot as an adaptive running app",
);
assert.match(
  siteCopyContent,
  /A calm adaptive running plan that follows your training week by week\./,
  "The English auth and launch copy should use calm, natural product English",
);
assert.match(
  siteCopyContent,
  /small English beta/,
  "The repo should contain concise English Reddit beta support copy",
);
assert.match(
  siteVariantContent,
  /stridepilot\.eu/,
  "The host-based site variant helper should explicitly recognize stridepilot.eu",
);
assert.match(
  layoutContent,
  /data-site-locale/,
  "Layout should expose the resolved site locale for the English beta path",
);
assert.match(
  pageContent,
  /siteCopy\.welcomeSubhead|siteCopy\.welcomeTitle/,
  "The live page should consume shared site copy instead of relying only on hardcoded Danish hero strings",
);
assert.match(
  pageContent,
  /ui\.recommendation\.title|ui\.program\.weekOverviewNotes|ui\.workout\.coachResponse/,
  "The live page should route trust-critical English beta labels through the shared locale-aware UI copy",
);
assert.match(
  pageContent,
  /Height \(cm\)|Weight \(kg\)|Gender \(optional\)|Edit profile and goal|Appearance|Dark/,
  "The final English beta cleanup should cover the remaining onboarding and settings strings on .eu",
);
assert.match(
  pageContent,
  /5 km without stopping|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Calmer route|Recommended route|Ambitious route|Easy run|Build week/,
  "The final English beta cleanup should cover the remaining surfaced onboarding, weekday, recommendation, and plan-copy strings on .eu",
);
assert.match(
  programScreenContent,
  /race day/,
  "English-facing goal-event labels should use race-day wording instead of leaking måldag",
);
assert.match(
  coachExplanationsContent,
  /translateCoachExplanationLine|locale\?: SiteLocale/,
  "Coach explanation outputs should be locale-aware so Danish rationale cannot leak on .eu",
);
assert.match(
  pageContent,
  /getConfiguredSiteLocale/,
  "The live page should resolve the beta locale through the shared site-variant helper",
);

console.log("product copy audit tests passed");
