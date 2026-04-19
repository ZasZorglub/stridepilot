import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";

import {
  benchmarkReportFixtures,
  buildBenchmarkReports,
  buildPlanQualitySummary,
  hasMaterialSessionShapeMismatch,
  createTimestampedBenchmarkOutputDir,
  formatBenchmarkRunTimestamp,
  writeBenchmarkReports,
} from "../src/lib/coach/benchmarkReports";

const reports = buildBenchmarkReports();
const summary = buildPlanQualitySummary(reports);

assert.equal(
  hasMaterialSessionShapeMismatch({
    durationMin: 31.5,
    structureSummary: "Warmup 7 min / Run 19.5 min / Cooldown 3 min / Walk 2 min",
    steps: [
      { type: "warmup", durationSec: 420 },
      { type: "run", durationSec: 1170 },
      { type: "cooldown", durationSec: 180 },
      { type: "walk", durationSec: 120 },
    ],
  }),
  false,
  "harmless rounding-sized differences should not count as session-shape mismatches when the rendered session is coherent",
);
assert.equal(
  hasMaterialSessionShapeMismatch({
    durationMin: 48,
    structureSummary: "Warmup 7 min / Run 19.5 min / Cooldown 3 min / Walk 2 min",
    steps: [
      { type: "warmup", durationSec: 420 },
      { type: "run", durationSec: 1170 },
      { type: "cooldown", durationSec: 180 },
      { type: "walk", durationSec: 120 },
    ],
  }),
  true,
  "material drift between declared duration and real steps should still be caught as a true mismatch",
);

assert.equal(reports.length, 50, "benchmark export should now cover exactly 50 representative runner profiles");
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
assert.ok(
  reports.every((report) => report.qualityDiagnostics.destinationSessionSummary !== undefined),
  "each report should preserve destination-session diagnostics for downstream review",
);
assert.ok(
  reports.every((report) => report.qualityDiagnostics.coachCredibilityScore >= 1 && report.qualityDiagnostics.coachCredibilityScore <= 10),
  "each report should expose bounded coach-credibility scoring",
);
assert.ok(
  reports.every((report) => ["pass", "borderline", "fail"].includes(report.qualityDiagnostics.verdict)),
  "each report should now carry a deterministic verdict",
);
assert.ok(
  reports.every((report) => typeof report.flags.hasFrontLoadedWeek === "boolean" && typeof report.flags.hasRaceDayLabelBug === "boolean"),
  "each report should expose machine-readable trust/distribution flags",
);
assert.ok(
  reports.every((report) => Array.isArray(report.findings)),
  "each report should export structured findings alongside warnings",
);

const addedProfileIds = ["profile-45", "profile-46", "profile-47", "profile-48", "profile-49", "profile-50"];
for (const profileId of addedProfileIds) {
  const profile = reports.find((report) => report.profileId === profileId);
  assert.ok(profile, `new benchmark profile ${profileId} should be present in the 50-profile matrix`);
  assert.ok(profile.weeks.length >= 1, `new benchmark profile ${profileId} should export week detail`);
}

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
  suspiciousTenK.warnings.includes("session_shape_mismatch"),
  false,
  "a now-coherent 10K benchmark profile should not keep a stale session-shape mismatch warning",
);
assert.ok(
  suspiciousTenK.qualityDiagnostics.verdict === "pass" || suspiciousTenK.qualityDiagnostics.verdict === "borderline",
  "the improved 10K profile should no longer be forced into fail just because an older end-shape bug used to exist",
);
assert.ok(
  suspiciousTenK.qualityDiagnostics.labelTrustScore >= 1,
  "suspicious profiles should still export trust scoring for downstream review",
);

const comparedProfile = reports.find((report) => report.profileId === "profile-07");
assert.ok(comparedProfile?.qualityDiagnostics.destinationSessionSummary, "target-time profiles should expose a destination session summary for race-week review");
assert.equal(comparedProfile?.profileSummary.durationScenario, "shorter_override");
assert.ok(
  comparedProfile?.findings.some((finding) => finding.code === "duration_override_respected"),
  "shorter-override benchmark cases should surface duration override diagnostics",
);

const cautiousFiveKProfileIds = ["profile-03", "profile-08", "profile-21"];
for (const profileId of cautiousFiveKProfileIds) {
  const profile = reports.find((report) => report.profileId === profileId);
  assert.ok(profile, `cautious 5K profile ${profileId} should be present`);
  assert.ok(
    profile.qualityDiagnostics.safetyScore >= 1,
    `cautious 5K profile ${profileId} should export safety scoring`,
  );
  assert.ok(
    profile.findings.length >= 0,
    `cautious 5K profile ${profileId} should export structured findings`,
  );
}

const cautiousTenKProfileIds = ["profile-05", "profile-18", "profile-26", "profile-41"];
for (const profileId of cautiousTenKProfileIds) {
  const profile = reports.find((report) => report.profileId === profileId);
  assert.ok(profile, `cautious 10K profile ${profileId} should be present`);
  assert.ok(
    profile.qualityDiagnostics.realismScore >= 1,
    `cautious 10K profile ${profileId} should export realism scoring`,
  );
  assert.ok(
    Array.isArray(profile.findings),
    `cautious 10K profile ${profileId} should export findings`,
  );
}

const halfProfile = reports.find((report) => report.profileId === "profile-09");
assert.ok(halfProfile, "half marathon finish profile should be present");
assert.equal(
  halfProfile.flags.hasRaceDayLabelBug,
  false,
  "ordinary sessions should not leak into race-day labeling in benchmark exports",
);
assert.ok(
  halfProfile.qualityDiagnostics.verdict === "pass" || halfProfile.qualityDiagnostics.verdict === "borderline",
  "cleaner plans should remain capable of passing or landing borderline instead of failing by default",
);

const marathonProfile = reports.find((report) => report.profileId === "profile-14");
assert.ok(marathonProfile, "marathon improve profile should be present");
assert.equal(marathonProfile.profileSummary.onboardingTrack, "goal_focused");
assert.equal(
  marathonProfile.warnings.includes("session_shape_mismatch"),
  false,
  "profile-14 should no longer raise session-shape mismatch once the benchmark compares the app-facing session consistently",
);
assert.equal(
  marathonProfile.warnings.includes("track_signal_not_reflected_enough"),
  false,
  "goal-focused marathon profiles should now show enough early posture signal to avoid the old track-gap warning",
);
assert.deepEqual(
  marathonProfile.weeks[0]?.sessions.map((session) => session.sessionType),
  ["easy", "recovery", "steady", "long"],
  "goal-focused marathon profiles should now open with easy + recovery + controlled quality + long structure",
);

const goalFocusedTenK = reports.find((report) => report.profileId === "profile-06");
assert.ok(goalFocusedTenK, "goal-focused 10K profile should be present");
assert.equal(
  goalFocusedTenK.warnings.includes("track_signal_not_reflected_enough"),
  false,
  "goal-focused 10K profiles should now surface enough early differentiation to clear the old track warning",
);
assert.deepEqual(
  goalFocusedTenK.weeks[0]?.sessions.map((session) => session.sessionType),
  ["easy", "recovery", "steady", "long"],
  "goal-focused 10K profiles should now open with a controlled quality signal in week 1",
);

for (const profileId of ["profile-39", "profile-50"]) {
  const marathonPrProfile = reports.find((report) => report.profileId === profileId);
  assert.ok(marathonPrProfile, `marathon PR profile ${profileId} should be present`);
  assert.ok(
    marathonPrProfile.qualityDiagnostics.coachCredibilityScore >= 1,
    `marathon PR profile ${profileId} should export coach-credibility scoring`,
  );
}
const profile50 = reports.find((report) => report.profileId === "profile-50");
assert.ok(profile50, "profile-50 should be present");
assert.equal(
  profile50.warnings.includes("session_shape_mismatch"),
  false,
  "profile-50 should no longer raise session-shape mismatch once rendered duration and summary are checked against the same app-facing steps",
);

const marathonFinishProfile = reports.find((report) => report.profileId === "profile-13");
assert.ok(marathonFinishProfile, "marathon finish profile should be present");

const lowFrequencyAmbitious = reports.find((report) => report.profileId === "profile-37");
assert.ok(lowFrequencyAmbitious, "low-frequency marathon profile should be present");
assert.equal(lowFrequencyAmbitious.flags.hasSilentFrequencyOverride, false);
assert.ok(
  lowFrequencyAmbitious.findings.some((finding) => finding.code === "low_frequency_ambitious_but_respected"),
  "2-day ambitious cases should explicitly report that low frequency was respected after override",
);

const strongerConsistentRunner = reports.find((report) => report.profileId === "profile-42");
assert.ok(strongerConsistentRunner, "stronger consistent half profile should be present");
assert.equal(strongerConsistentRunner.flags.hasUnderdosedExperiencedRunner, false);
const ambitiousHalfRunner = reports.find((report) => report.profileId === "profile-49");
assert.ok(ambitiousHalfRunner, "ambitious half target-pace profile should be present");
assert.ok(
  ambitiousHalfRunner.weeks.flatMap((week) => week.sessions).some((session) => session.sessionType === "race-specific" || session.sessionType === "tempo"),
  "ambitious half target-pace profiles should surface explicit performance support rather than flattening back to generic support work",
);
assert.equal(
  ambitiousHalfRunner.warnings.includes("race_day_too_short"),
  false,
  "fast half target-time profiles should no longer collapse into a goal-event duration that looks too short for the benchmark floor",
);
const ambitiousMarathonRunner = reports.find((report) => report.profileId === "profile-38");
assert.ok(ambitiousMarathonRunner, "ambitious marathon target-pace profile should be present");
assert.ok(
  ambitiousMarathonRunner.weeks.flatMap((week) => week.sessions).some((session) => session.sessionType === "race-specific"),
  "ambitious marathon target-pace profiles should include at least one race-specific support session",
);
assert.equal(
  ambitiousMarathonRunner.warnings.includes("race_day_too_short"),
  false,
  "marathon target-time profiles should keep a coach-credible full-distance goal event after the goal-duration realism fix",
);
const cleanPassProfile = reports.find((report) => report.profileId === "profile-08");
assert.ok(cleanPassProfile, "a clean comeback 5K profile should be present");
assert.ok(
  cleanPassProfile.qualityDiagnostics.coachCredibilityScore >= 9 && cleanPassProfile.qualityDiagnostics.verdict === "pass",
  "clean coherent plans should still be able to score highly and pass",
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
assert.equal(typeof summary.warningTypes.front_loaded_distribution, "number");
assert.equal(typeof summary.warningTypes.race_day_label_bug, "number");
assert.equal(typeof summary.verdictCounts.pass, "number");
assert.equal(typeof summary.verdictCounts.borderline, "number");
assert.equal(typeof summary.verdictCounts.fail, "number");
assert.equal(typeof summary.averageScores.coachCredibilityScore, "number");
assert.ok(Array.isArray(summary.recurringIssueCategories));
assert.ok(Array.isArray(summary.worstProfiles));
assert.ok(Array.isArray(summary.profilesForReviewFirst));
assert.ok(
  summary.warningTypes.aggressive_progression_jump <= 7,
  "progression smoothing should keep aggressive progression jumps materially below the older benchmark baseline while preserving the safer beginner-entry policy",
);
assert.ok(
  summary.warningTypes.track_signal_not_reflected_enough <= 1,
  "early track-posture changes should materially reduce track-signal gap warnings",
);
assert.equal(
  summary.warningTypes.race_day_too_short,
  0,
  "goal-event realism fixes should eliminate the remaining race_day_too_short warning from the benchmark suite",
);
assert.ok(
  summary.warningTypes.race_day_too_short >= 0,
  "summary should keep machine-readable race_day_too_short counts for benchmark review",
);
assert.equal(
  summary.verdictCounts.pass + summary.verdictCounts.borderline + summary.verdictCounts.fail,
  reports.length,
  "summary verdict counts should cover the full benchmark matrix exactly",
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
) as {
  profilesTested: number;
  profilesWithWarnings: number;
  verdictCounts: { pass: number; borderline: number; fail: number };
  averageScores: { coachCredibilityScore: number };
  profiles: Array<{ warnings: string[] }>;
};
assert.equal(exportedSummary.profilesTested, reports.length, "exported summary should include the full benchmark matrix");
assert.ok(exportedSummary.profilesWithWarnings >= 1, "summary should surface at least one real warning while the end-shape issue exists");
assert.equal(
  exportedSummary.verdictCounts.pass + exportedSummary.verdictCounts.borderline + exportedSummary.verdictCounts.fail,
  reports.length,
  "exported summary should persist verdict counts for all profiles",
);
assert.ok(exportedSummary.averageScores.coachCredibilityScore >= 1, "exported summary should include aggregate scoring");
assert.ok(
  exportedSummary.profiles.some((profile) => profile.warnings.includes("aggressive_progression_jump") || profile.warnings.includes("track_signal_not_reflected_enough")),
  "summary should still make remaining benchmark concerns machine-detectable after the goal-event realism fix",
);

writeBenchmarkReports(secondRunDir);
assert.ok(fs.existsSync(path.join(secondRunDir, "index.json")), "subsequent timestamped runs should also write a full benchmark artifact set");

console.log("engine-vnext benchmark report export tests passed");
