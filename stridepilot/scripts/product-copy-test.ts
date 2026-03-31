import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "..", "..");

const userFacingFiles = [
  path.join(repoRoot, "src/app/page.tsx"),
  path.join(repoRoot, "src/app/layout.tsx"),
  path.join(repoRoot, "src/app/manifest.webmanifest"),
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
assert.match(
  pageContent,
  /Din adaptive løbeapp/,
  "The app should position itself as an adaptive running app in the primary welcome copy",
);
assert.match(
  pageContent,
  /Et adaptivt løbeprogram, der følger din træning roligt\./,
  "The auth and header subtitle should use the calmer adaptive positioning",
);

console.log("product copy audit tests passed");
