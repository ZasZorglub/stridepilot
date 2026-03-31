import assert from "node:assert/strict";

import {
  buildPulseGuidanceSummary,
  buildPulseGuidanceWarning,
  isPlausibleMaxHeartRate,
  parseMaxHeartRateInput,
} from "../src/lib/profile-settings";

assert.equal(isPlausibleMaxHeartRate(190), true, "a realistic max heart rate should be accepted");
assert.equal(isPlausibleMaxHeartRate(99), false, "values below the plausible range should be rejected");
assert.equal(parseMaxHeartRateInput("190"), 190, "valid max heart rate input should parse cleanly");
assert.equal(parseMaxHeartRateInput(""), null, "pulse input should stay optional");
assert.equal(parseMaxHeartRateInput("99"), null, "implausibly low max heart rate should not be saved");
assert.equal(parseMaxHeartRateInput("241"), null, "implausibly high max heart rate should not be saved");
assert.equal(parseMaxHeartRateInput("abc"), null, "non-numeric max heart rate should not be saved");
assert.equal(
  buildPulseGuidanceWarning("1", true),
  null,
  "single-digit partial input should not show an early warning while the user is still typing",
);
assert.match(
  buildPulseGuidanceWarning("241", true) ?? "",
  /120 og 240/,
  "invalid enabled max heart rate should surface a calm validation message",
);
assert.equal(buildPulseGuidanceWarning("", true), null, "blank max heart rate should stay optional");
assert.match(
  buildPulseGuidanceSummary({ enabled: false, maxHeartRate: null }),
  /slået fra/,
  "pulse guidance should clearly remain optional when disabled",
);
assert.match(
  buildPulseGuidanceSummary({ enabled: true, maxHeartRate: 190 }),
  /makspuls 190/,
  "saved pulse guidance should summarize the known max heart rate",
);

console.log("profile settings tests passed");
