"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const benchmarkReports_1 = require("../src/lib/coach/benchmarkReports");
const reports = (0, benchmarkReports_1.buildBenchmarkReports)();
const summary = (0, benchmarkReports_1.buildPlanQualitySummary)(reports);
strict_1.default.ok(reports.length >= 40, "benchmark export should cover at least 40 representative runner profiles");
strict_1.default.equal(benchmarkReports_1.benchmarkReportFixtures.length, reports.length, "fixture matrix should stay aligned with the export size");
strict_1.default.equal(summary.profilesTested, reports.length, "summary should cover the same profile count as the detailed export");
strict_1.default.ok(reports.some((report) => report.planSummary.hasIntervals), "benchmark set should include interval-bearing plans for external coach review");
strict_1.default.ok(reports.every((report) => report.weeks.length >= 1 && report.weeks.every((week) => week.sessions.length >= 1)), "each exported report should include readable week/session detail");
strict_1.default.ok(reports.every((report) => report.qualityDiagnostics.goalWeek >= 1), "each report should include goal-week diagnostics");
const returningBeginner = reports.find((report) => report.profileId === "profile-01");
strict_1.default.ok(returningBeginner, "returning beginner fixture should be present");
const runWalkSessions = returningBeginner.weeks.flatMap((week) => week.sessions).filter((session) => session.sessionType === "run-walk");
strict_1.default.ok(runWalkSessions.length >= 1, "returning beginner should still include run-walk progression");
strict_1.default.ok(runWalkSessions.every((session) => session.intervalAnalysis.workBlocks.every((block) => block.zoneLabel === "Zone 2")), "beginner/comeback run-walk sessions should no longer be exported with hard interval heart-rate guidance");
strict_1.default.equal(runWalkSessions.some((session) => session.intervalAnalysis.hasCoachingMismatch), false, "run-walk sessions should not carry a coaching mismatch flag after the aerobic HR fix");
const suspiciousTenK = reports.find((report) => report.profileId === "profile-04");
strict_1.default.ok(suspiciousTenK, "10K benchmark fixture should be present");
strict_1.default.equal(suspiciousTenK.warnings.includes("race_day_too_short"), false, "10K plans should no longer collapse into implausibly short goal-day sessions after the destination-session fix");
strict_1.default.ok(suspiciousTenK.qualityDiagnostics.goalDayRunMin >= suspiciousTenK.qualityDiagnostics.longestPriorRunMin * 0.65, "10K goal day should retain a credible fraction of prior run durability");
const comparedProfile = reports.find((report) => report.profileId === "profile-07");
strict_1.default.ok(comparedProfile?.qualityDiagnostics.destinationSessionSummary, "target-time profiles should expose a destination session summary for race-week review");
const cautiousFiveKProfileIds = ["profile-03", "profile-08", "profile-21"];
for (const profileId of cautiousFiveKProfileIds) {
    const profile = reports.find((report) => report.profileId === profileId);
    strict_1.default.ok(profile, `cautious 5K profile ${profileId} should be present`);
    strict_1.default.equal(profile.warnings.includes("race_day_too_short"), false, `cautious 5K profile ${profileId} should no longer trigger race_day_too_short`);
    strict_1.default.ok(profile.qualityDiagnostics.goalDayRunMin >= profile.qualityDiagnostics.longestPriorRunMin * 0.58, `cautious 5K profile ${profileId} should still finish with a credible, though conservative, goal-day volume`);
    strict_1.default.ok(profile.qualityDiagnostics.goalDayRunMin <= profile.qualityDiagnostics.longestPriorRunMin * 0.9, `cautious 5K profile ${profileId} should remain safely below prior peak training load`);
}
const cautiousTenKProfileIds = ["profile-05", "profile-18", "profile-26", "profile-41"];
for (const profileId of cautiousTenKProfileIds) {
    const profile = reports.find((report) => report.profileId === profileId);
    strict_1.default.ok(profile, `cautious 10K profile ${profileId} should be present`);
    strict_1.default.equal(profile.warnings.includes("race_day_too_short"), false, `cautious 10K profile ${profileId} should no longer trigger race_day_too_short`);
    strict_1.default.ok(profile.qualityDiagnostics.goalDayRunMin >= profile.qualityDiagnostics.longestPriorRunMin * 0.65, `cautious 10K profile ${profileId} should now keep a credible fraction of prior running durability`);
    strict_1.default.ok(profile.qualityDiagnostics.goalDayRunMin <= profile.qualityDiagnostics.longestPriorRunMin * 0.92, `cautious 10K profile ${profileId} should still remain clearly tapered rather than overcorrected`);
}
const halfProfile = reports.find((report) => report.profileId === "profile-09");
strict_1.default.ok(halfProfile, "half marathon finish profile should be present");
strict_1.default.equal(halfProfile.warnings.includes("race_day_too_short"), false, "half marathon plans should no longer collapse into implausibly short goal-day sessions");
strict_1.default.ok(halfProfile.qualityDiagnostics.goalDayRunMin >= halfProfile.qualityDiagnostics.longestPriorRunMin * 0.72, "half marathon goal day should remain materially representative of prior long-run durability");
const marathonProfile = reports.find((report) => report.profileId === "profile-14");
strict_1.default.ok(marathonProfile, "marathon improve profile should be present");
strict_1.default.equal(marathonProfile.warnings.includes("race_day_too_short"), false, "marathon plans should no longer collapse into implausibly short goal-day sessions");
strict_1.default.ok(marathonProfile.qualityDiagnostics.goalDayRunMin >= marathonProfile.qualityDiagnostics.longestPriorRunMin * 0.8, "marathon goal day should remain credibly close to prior long-run preparation");
const stridesSession = reports
    .flatMap((report) => report.weeks)
    .flatMap((week) => week.sessions)
    .find((session) => session.sessionType === "strides");
strict_1.default.ok(stridesSession, "benchmark set should still include a strides session");
strict_1.default.equal(stridesSession.intervalAnalysis.notes.includes("Arbejdsblokkene er meget korte."), false, "strides should not be auto-flagged as suspicious just because the reps are short");
strict_1.default.equal(typeof summary.warningTypes.missing_destination_session, "number");
strict_1.default.equal(typeof summary.warningTypes.race_day_too_short, "number");
strict_1.default.equal(typeof summary.warningTypes.late_plan_collapse, "number");
strict_1.default.equal(typeof summary.warningTypes.taper_too_aggressive, "number");
strict_1.default.equal(typeof summary.warningTypes.goal_week_shape_mismatch, "number");
strict_1.default.equal(typeof summary.warningTypes.session_shape_mismatch, "number");
strict_1.default.ok(summary.warningTypes.race_day_too_short < 8, "race-day-too-short warnings should drop materially again from the previous 8-profile cautious baseline");
const tempDir = fs_1.default.mkdtempSync(path_1.default.join(os_1.default.tmpdir(), "stridepilot-benchmark-reports-"));
strict_1.default.equal((0, benchmarkReports_1.formatBenchmarkRunTimestamp)(new Date(2026, 2, 31, 14, 10, 5)), "2026-03-31_14-10-05", "benchmark export timestamps should stay filesystem-safe and easy to sort");
const firstRunDir = (0, benchmarkReports_1.createTimestampedBenchmarkOutputDir)(tempDir, new Date(2026, 2, 31, 14, 10, 5));
const secondRunDir = (0, benchmarkReports_1.createTimestampedBenchmarkOutputDir)(tempDir, new Date(2026, 2, 31, 14, 10, 5));
strict_1.default.match(path_1.default.basename(firstRunDir), /^2026-03-31_14-10-05$/, "first benchmark run should use the plain timestamp folder name");
strict_1.default.match(path_1.default.basename(secondRunDir), /^2026-03-31_14-10-05_01$/, "repeated runs in the same second should not overwrite prior output");
strict_1.default.notEqual(firstRunDir, secondRunDir, "timestamped benchmark runs should always use a fresh directory");
(0, benchmarkReports_1.writeBenchmarkReports)(firstRunDir);
const files = fs_1.default.readdirSync(firstRunDir).filter((entry) => entry.endsWith(".json"));
strict_1.default.equal(files.length, reports.length + 2, "writer should emit one file per profile plus index and plan-quality summary");
strict_1.default.ok(files.includes("index.json"), "writer should emit the summary index");
strict_1.default.ok(files.includes("plan-quality-summary.json"), "writer should emit the combined plan-quality summary");
const index = JSON.parse(fs_1.default.readFileSync(path_1.default.join(firstRunDir, "index.json"), "utf8"));
strict_1.default.equal(index.length, reports.length, "index should describe all exported profiles");
strict_1.default.ok(index.every((entry) => fs_1.default.existsSync(path_1.default.join(firstRunDir, entry.file))), "index entries should point to real exported report files");
const exportedSummary = JSON.parse(fs_1.default.readFileSync(path_1.default.join(firstRunDir, "plan-quality-summary.json"), "utf8"));
strict_1.default.equal(exportedSummary.profilesTested, reports.length, "exported summary should include the full benchmark matrix");
strict_1.default.ok(exportedSummary.profilesWithWarnings >= 1, "summary should surface at least one real warning while the end-shape issue exists");
strict_1.default.ok(exportedSummary.profiles.some((profile) => profile.warnings.includes("race_day_too_short") || profile.warnings.includes("missing_destination_session")), "summary should make suspicious goal-day behavior machine-detectable");
(0, benchmarkReports_1.writeBenchmarkReports)(secondRunDir);
strict_1.default.ok(fs_1.default.existsSync(path_1.default.join(secondRunDir, "index.json")), "subsequent timestamped runs should also write a full benchmark artifact set");
console.log("engine-vnext benchmark report export tests passed");
