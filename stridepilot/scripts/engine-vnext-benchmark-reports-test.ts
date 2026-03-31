import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";

import {
  benchmarkReportFixtures,
  buildBenchmarkReports,
  buildPlanQualitySummary,
  createTimestampedBenchmarkOutputDir,
  formatBenchmarkRunTimestamp,
  writeBenchmarkReports,
} from "../src/lib/coach/benchmarkReports";

const reports = buildBenchmarkReports();
const summary = buildPlanQualitySummary(reports);

assert.ok(reports.length >= 40, "benchmark export should cover at least 40 representative runner profiles");
assert.equal(benchmarkReportFixtures.length, reports.length, "fixture matrix should stay aligned with the export size");
assert.equal(summary.profilesTested, reports.length, "summary should cover the same profile count as the detailed export");
assert.ok(
  reports.some((report) => report.planSummary.hasIntervals),
  "benchmark set should include interval-bearing plans for external coach review",
);
assert.ok(
  reports.every((report) => report.weeks.length >= 1 && report.weeks.every((week) => week.sessions.length >= 1)),
  "each exported report should include readable week/session detail",
);
assert.ok(
  reports.every((report) => report.qualityDiagnostics.goalWeek >= 1),
  "each report should include goal-week diagnostics",
);

const returningBeginner = reports.find((report) => report.profileId === "profile-01");
assert.ok(returningBeginner, "returning beginner fixture should be present");
const runWalkSessions = returningBeginner.weeks.flatMap((week) => week.sessions).filter((session) => session.sessionType === "run-walk");
assert.ok(runWalkSessions.length >= 1, "returning beginner should still include run-walk progression");
assert.ok(
  runWalkSessions.every((session) =>
    session.intervalAnalysis.workBlocks.every((block) => block.zoneLabel === "Zone 2"),
  ),
  "beginner/comeback run-walk sessions should no longer be exported with hard interval heart-rate guidance",
);
assert.equal(
  runWalkSessions.some((session) => session.intervalAnalysis.hasCoachingMismatch),
  false,
  "run-walk sessions should not carry a coaching mismatch flag after the aerobic HR fix",
);

const suspiciousTenK = reports.find((report) => report.profileId === "profile-04");
assert.ok(suspiciousTenK, "10K benchmark fixture should be present");
assert.equal(
  suspiciousTenK.warnings.includes("race_day_too_short"),
  false,
  "10K plans should no longer collapse into implausibly short goal-day sessions after the destination-session fix",
);
assert.ok(
  suspiciousTenK.qualityDiagnostics.goalDayRunMin >= suspiciousTenK.qualityDiagnostics.longestPriorRunMin * 0.65,
  "10K goal day should retain a credible fraction of prior run durability",
);

const comparedProfile = reports.find((report) => report.profileId === "profile-07");
assert.ok(comparedProfile?.qualityDiagnostics.destinationSessionSummary, "target-time profiles should expose a destination session summary for race-week review");

const cautiousFiveKProfileIds = ["profile-03", "profile-08", "profile-21"];
for (const profileId of cautiousFiveKProfileIds) {
  const profile = reports.find((report) => report.profileId === profileId);
  assert.ok(profile, `cautious 5K profile ${profileId} should be present`);
  assert.equal(
    profile.warnings.includes("race_day_too_short"),
    false,
    `cautious 5K profile ${profileId} should no longer trigger race_day_too_short`,
  );
  assert.ok(
    profile.qualityDiagnostics.goalDayRunMin >= profile.qualityDiagnostics.longestPriorRunMin * 0.58,
    `cautious 5K profile ${profileId} should still finish with a credible, though conservative, goal-day volume`,
  );
  assert.ok(
    profile.qualityDiagnostics.goalDayRunMin <= profile.qualityDiagnostics.longestPriorRunMin * 0.9,
    `cautious 5K profile ${profileId} should remain safely below prior peak training load`,
  );
}

const cautiousTenKProfileIds = ["profile-05", "profile-18", "profile-26", "profile-41"];
for (const profileId of cautiousTenKProfileIds) {
  const profile = reports.find((report) => report.profileId === profileId);
  assert.ok(profile, `cautious 10K profile ${profileId} should be present`);
  assert.equal(
    profile.warnings.includes("race_day_too_short"),
    false,
    `cautious 10K profile ${profileId} should no longer trigger race_day_too_short`,
  );
  assert.ok(
    profile.qualityDiagnostics.goalDayRunMin >= profile.qualityDiagnostics.longestPriorRunMin * 0.65,
    `cautious 10K profile ${profileId} should now keep a credible fraction of prior running durability`,
  );
  assert.ok(
    profile.qualityDiagnostics.goalDayRunMin <= profile.qualityDiagnostics.longestPriorRunMin * 0.92,
    `cautious 10K profile ${profileId} should still remain clearly tapered rather than overcorrected`,
  );
}

const halfProfile = reports.find((report) => report.profileId === "profile-09");
assert.ok(halfProfile, "half marathon finish profile should be present");
assert.equal(
  halfProfile.warnings.includes("race_day_too_short"),
  false,
  "half marathon plans should no longer collapse into implausibly short goal-day sessions",
);
assert.ok(
  halfProfile.qualityDiagnostics.goalDayRunMin >= halfProfile.qualityDiagnostics.longestPriorRunMin * 0.72,
  "half marathon goal day should remain materially representative of prior long-run durability",
);

const marathonProfile = reports.find((report) => report.profileId === "profile-14");
assert.ok(marathonProfile, "marathon improve profile should be present");
assert.equal(
  marathonProfile.warnings.includes("race_day_too_short"),
  false,
  "marathon plans should no longer collapse into implausibly short goal-day sessions",
);
assert.ok(
  marathonProfile.qualityDiagnostics.goalDayRunMin >= marathonProfile.qualityDiagnostics.longestPriorRunMin * 0.8,
  "marathon goal day should remain credibly close to prior long-run preparation",
);

const stridesSession = reports
  .flatMap((report) => report.weeks)
  .flatMap((week) => week.sessions)
  .find((session) => session.sessionType === "strides");
assert.ok(stridesSession, "benchmark set should still include a strides session");
assert.equal(
  stridesSession.intervalAnalysis.notes.includes("Arbejdsblokkene er meget korte."),
  false,
  "strides should not be auto-flagged as suspicious just because the reps are short",
);

assert.equal(typeof summary.warningTypes.missing_destination_session, "number");
assert.equal(typeof summary.warningTypes.race_day_too_short, "number");
assert.equal(typeof summary.warningTypes.late_plan_collapse, "number");
assert.equal(typeof summary.warningTypes.taper_too_aggressive, "number");
assert.equal(typeof summary.warningTypes.goal_week_shape_mismatch, "number");
assert.equal(typeof summary.warningTypes.session_shape_mismatch, "number");
assert.ok(
  summary.warningTypes.race_day_too_short < 8,
  "race-day-too-short warnings should drop materially again from the previous 8-profile cautious baseline",
);

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "stridepilot-benchmark-reports-"));
assert.equal(
  formatBenchmarkRunTimestamp(new Date(2026, 2, 31, 14, 10, 5)),
  "2026-03-31_14-10-05",
  "benchmark export timestamps should stay filesystem-safe and easy to sort",
);

const firstRunDir = createTimestampedBenchmarkOutputDir(tempDir, new Date(2026, 2, 31, 14, 10, 5));
const secondRunDir = createTimestampedBenchmarkOutputDir(tempDir, new Date(2026, 2, 31, 14, 10, 5));
assert.match(
  path.basename(firstRunDir),
  /^2026-03-31_14-10-05$/,
  "first benchmark run should use the plain timestamp folder name",
);
assert.match(
  path.basename(secondRunDir),
  /^2026-03-31_14-10-05_01$/,
  "repeated runs in the same second should not overwrite prior output",
);
assert.notEqual(firstRunDir, secondRunDir, "timestamped benchmark runs should always use a fresh directory");

writeBenchmarkReports(firstRunDir);

const files = fs.readdirSync(firstRunDir).filter((entry) => entry.endsWith(".json"));
assert.equal(files.length, reports.length + 2, "writer should emit one file per profile plus index and plan-quality summary");
assert.ok(files.includes("index.json"), "writer should emit the summary index");
assert.ok(files.includes("plan-quality-summary.json"), "writer should emit the combined plan-quality summary");

const index = JSON.parse(fs.readFileSync(path.join(firstRunDir, "index.json"), "utf8")) as Array<{ file: string }>;
assert.equal(index.length, reports.length, "index should describe all exported profiles");
assert.ok(
  index.every((entry) => fs.existsSync(path.join(firstRunDir, entry.file))),
  "index entries should point to real exported report files",
);

const exportedSummary = JSON.parse(
  fs.readFileSync(path.join(firstRunDir, "plan-quality-summary.json"), "utf8"),
) as { profilesTested: number; profilesWithWarnings: number; profiles: Array<{ warnings: string[] }> };
assert.equal(exportedSummary.profilesTested, reports.length, "exported summary should include the full benchmark matrix");
assert.ok(exportedSummary.profilesWithWarnings >= 1, "summary should surface at least one real warning while the end-shape issue exists");
assert.ok(
  exportedSummary.profiles.some((profile) => profile.warnings.includes("race_day_too_short") || profile.warnings.includes("missing_destination_session")),
  "summary should make suspicious goal-day behavior machine-detectable",
);

writeBenchmarkReports(secondRunDir);
assert.ok(fs.existsSync(path.join(secondRunDir, "index.json")), "subsequent timestamped runs should also write a full benchmark artifact set");

console.log("engine-vnext benchmark report export tests passed");
