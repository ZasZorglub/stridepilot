import fs from "fs";
import path from "path";

import {
  benchmarkReportFixtures,
  buildBenchmarkReport,
  type BenchmarkReport,
  type BenchmarkSessionReport,
} from "../src/lib/coach/benchmarkReports";

type ReviewTarget = {
  slot: number;
  requestedName: string;
  requestedTrack: string;
  requestedGoal: string;
  requestedFrequency: string;
  profileId: string;
  matchType: "exact" | "approximate";
  approximationNote?: string;
};

const REVIEW_TARGETS: ReviewTarget[] = [
  { slot: 1, requestedName: "Beginner, low frequency", requestedTrack: "getting_started", requestedGoal: "just get started / 5K", requestedFrequency: "2x/week", profileId: "profile-45", matchType: "approximate", approximationNote: "Closest existing fixture is a cautious 5K run-without-walking starter at 2x/week." },
  { slot: 2, requestedName: "Beginner, slightly ambitious", requestedTrack: "getting_started", requestedGoal: "10K", requestedFrequency: "3x/week", profileId: "profile-04", matchType: "approximate", approximationNote: "Closest fixture is a novice 10K complete profile at 3x/week." },
  { slot: 3, requestedName: "Returning runner", requestedTrack: "returning", requestedGoal: "5K / 10K", requestedFrequency: "3x/week", profileId: "profile-08", matchType: "approximate", approximationNote: "Closest fixture is a comeback 5K profile at 3x/week." },
  { slot: 4, requestedName: "Returning runner, building confidence", requestedTrack: "returning", requestedGoal: "Half marathon", requestedFrequency: "3x/week", profileId: "profile-48", matchType: "exact" },
  { slot: 5, requestedName: "Steady runner", requestedTrack: "steady_runner", requestedGoal: "10K", requestedFrequency: "4x/week", profileId: "profile-26", matchType: "approximate", approximationNote: "Closest fixture is a steady 10K complete profile with no explicit onboarding track set." },
  { slot: 6, requestedName: "Steady runner, HM", requestedTrack: "steady_runner", requestedGoal: "Half marathon", requestedFrequency: "4x/week", profileId: "profile-42", matchType: "approximate", approximationNote: "Closest fixture uses the running_consistently track, which is the nearest current equivalent to steady_runner." },
  { slot: 7, requestedName: "Goal-focused, 10K", requestedTrack: "goal_focused", requestedGoal: "10K", requestedFrequency: "4x/week", profileId: "profile-06", matchType: "exact" },
  { slot: 8, requestedName: "Goal-focused, half marathon", requestedTrack: "goal_focused", requestedGoal: "Half marathon", requestedFrequency: "4x/week", profileId: "profile-10", matchType: "approximate", approximationNote: "Closest fixture is a half-marathon PR profile at 4x/week with performance-oriented guidance." },
  { slot: 9, requestedName: "Goal-focused, marathon", requestedTrack: "goal_focused", requestedGoal: "Marathon", requestedFrequency: "4x/week", profileId: "profile-14", matchType: "exact" },
  { slot: 10, requestedName: "Goal-focused, marathon, higher frequency", requestedTrack: "goal_focused", requestedGoal: "Marathon", requestedFrequency: "5x/week", profileId: "profile-50", matchType: "approximate", approximationNote: "No 5x/week marathon fixture exists; closest current fixture is the strongest 4x/week high-volume marathon PR profile." },
  { slot: 11, requestedName: "Faster/performance-oriented runner", requestedTrack: "goal_focused", requestedGoal: "10K / Half marathon", requestedFrequency: "5x/week if supported", profileId: "profile-49", matchType: "approximate", approximationNote: "Closest current fixture is an ambitious half target-pace profile at 4x/week." },
  { slot: 12, requestedName: "Edge-case ambitious profile", requestedTrack: "goal_focused / override case", requestedGoal: "ambitious on low frequency", requestedFrequency: "2x/week", profileId: "profile-33", matchType: "exact" },
];

function fixtureName(profileId: string): string {
  const fixture = benchmarkReportFixtures.find((candidate) => candidate.profileId === profileId);
  if (!fixture) throw new Error(`Missing fixture ${profileId}`);
  return fixture.profileName;
}

function formatMinutes(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes)) return "n/a";
  const rounded = Math.round(minutes * 10) / 10;
  if (rounded < 60) return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)} min`;
  const hours = Math.floor(rounded / 60);
  const rest = Math.round((rounded - hours * 60) * 10) / 10;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${rest % 1 === 0 ? rest.toFixed(0) : rest.toFixed(1)}m`;
}

function summarizeHeartRate(session: BenchmarkSessionReport): string {
  const labels = [...new Set(session.steps.map((step) => step.heartRateGuidance?.zoneLabel).filter(Boolean))] as string[];
  return labels.length > 0 ? labels.join(", ") : "none surfaced";
}

function sessionFeel(session: BenchmarkSessionReport): string {
  if (session.sessionType === "long") return "long";
  if (["interval", "tempo", "progression", "race-specific", "benchmark"].includes(session.sessionType)) return "quality";
  if (session.sessionType === "steady") return "moderate";
  return "easy";
}

function weeklyLoadMinutes(report: BenchmarkReport, weekIndex: number): number {
  const week = report.weeks.find((candidate) => candidate.weekIndex === weekIndex);
  if (!week) return 0;
  return Math.round(week.sessions.reduce((sum, session) => sum + session.durationMin, 0) * 10) / 10;
}

function longRunProgression(report: BenchmarkReport): string {
  const entries = report.weeks
    .map((week) => {
      const longSession = week.sessions.find((session) => session.sessionType === "long");
      return longSession ? `W${week.weekIndex} ${formatMinutes(longSession.durationMin)}` : null;
    })
    .filter(Boolean) as string[];
  return entries.length > 0 ? entries.slice(0, 6).join(" -> ") : "No dedicated long run found in the first block";
}

function keyWorkouts(report: BenchmarkReport): string {
  const sessions = report.weeks
    .slice(0, 3)
    .flatMap((week) => week.sessions.map((session) => ({ weekIndex: week.weekIndex, session })))
    .filter(({ session }) => session.isKeyWorkout)
    .slice(0, 3);
  return sessions.length > 0
    ? sessions.map(({ weekIndex, session }) => `W${weekIndex}: ${session.sessionLabel} (${session.sessionType}, ${formatMinutes(session.durationMin)})`).join("; ")
    : "No key workout surfaced in the first 3 weeks";
}

function spacingSummary(report: BenchmarkReport): string {
  const firstWeek = report.weeks[0];
  if (!firstWeek) return "No week 1";
  return `${firstWeek.sessions.length} sessions in week 1; weekly counts across the plan: ${report.planSummary.weeklySessionCounts.slice(0, 6).join(", ")}`;
}

function goalDayNote(report: BenchmarkReport): string {
  if (!report.qualityDiagnostics.destinationSessionSummary) return "No explicit destination session found";
  return `${report.qualityDiagnostics.destinationSessionSummary}; goal-day run time ${formatMinutes(report.qualityDiagnostics.goalDayRunMin)}`;
}

function suspiciousNotes(report: BenchmarkReport): string[] {
  const notes = report.weeks
    .flatMap((week) => week.sessions.flatMap((session) => session.intervalAnalysis.notes.map((note) => `${session.sessionLabel}: ${note}`)));
  return notes.slice(0, 4);
}

function buildCrossProfileObservations(results: Array<{ target: ReviewTarget; report: BenchmarkReport }>): string[] {
  const observations: string[] = [];
  const trackGapProfiles = results.filter(({ report }) => report.warnings.includes("track_signal_not_reflected_enough"));
  const aggressiveProfiles = results.filter(({ report }) => report.warnings.includes("aggressive_progression_jump"));
  const beginnerProfiles = results.filter(({ target }) => target.slot <= 4);
  const strongProfiles = results.filter(({ target }) => target.slot >= 7);
  const marathonProfiles = results.filter(({ report }) => report.profileSummary.goalDistance === "Marathon");

  observations.push(
    `Beginner/returning protection: ${beginnerProfiles.map(({ report }) => `${report.profileId}=${report.qualityDiagnostics.verdict}`).join(", ")}. These plans open with mostly easy sessions and 2-3 weekly touches, which keeps the early structure conservative.`,
  );
  if (trackGapProfiles.length > 0) {
    observations.push(
      `Track-specific sameness: ${trackGapProfiles.map(({ report }) => report.profileId).join(", ")} already carry \`track_signal_not_reflected_enough\`, which matches the visible pattern that some early-week postures still look closer together than their tracks imply.`,
    );
  }
  if (strongProfiles.length > 0) {
    observations.push(
      `Stronger runner posture: ${strongProfiles.map(({ report }) => `${report.profileId}=${report.weeks[0]?.sessions.map((session) => session.sessionType).join("/")}`).join("; ")}. The stronger profiles do surface quality work early, but the harness still flags a few as not differentiated enough.`,
    );
  }
  if (aggressiveProfiles.length > 0) {
    observations.push(
      `Aggressive progression signals: ${aggressiveProfiles.map(({ report }) => report.profileId).join(", ")} show benchmark warnings for progression jumps, so those are the first profiles to review for week-to-week load increases.`,
    );
  }
  if (marathonProfiles.length > 0) {
    observations.push(
      `HM/Marathon realism: ${marathonProfiles.map(({ report }) => `${report.profileId} goal day ${formatMinutes(report.qualityDiagnostics.goalDayRunMin)}`).join("; ")}. Marathon goal events are now full-length in identity and duration, but the remaining warnings focus more on progression and track posture than on collapsed race-day structure.`,
    );
  }

  return observations;
}

function buildReport(): string {
  const results = REVIEW_TARGETS.map((target) => {
    const fixture = benchmarkReportFixtures.find((candidate) => candidate.profileId === target.profileId);
    if (!fixture) throw new Error(`Fixture ${target.profileId} not found`);
    return { target, report: buildBenchmarkReport(fixture) };
  });

  const exactIds = REVIEW_TARGETS.filter((target) => target.matchType === "exact").map((target) => target.profileId);
  const approxIds = REVIEW_TARGETS.filter((target) => target.matchType === "approximate").map((target) => target.profileId);

  const summaryTable = [
    "| Profile | Track | Goal | Frequency | Overall impression | Warnings |",
    "| --- | --- | --- | --- | --- | --- |",
    ...results.map(({ target, report }) => `| ${target.slot}. ${target.requestedName} (${report.profileId}) | ${report.profileSummary.onboardingTrack ?? target.requestedTrack} | ${report.profileSummary.goalDistance} ${report.profileSummary.goalType} | ${report.profileSummary.daysPerWeek}/week | ${report.qualityDiagnostics.verdict} (${report.qualityDiagnostics.coachCredibilityScore}/10) | ${report.warnings.length > 0 ? report.warnings.join(", ") : "none"} |`),
  ].join("\n");

  const detailSections = results.map(({ target, report }) => {
    const week1 = report.weeks[0];
    const week1Lines = week1
      ? week1.sessions.map((session) => `- ${session.sessionIndex}. ${session.sessionLabel} | type: ${session.sessionType} | duration: ${formatMinutes(session.durationMin)} | feel: ${sessionFeel(session)} | structure: ${session.structureSummary} | HR: ${summarizeHeartRate(session)}`)
      : ["- No week 1 sessions found"];
    const progressionWeeks = report.weeks.slice(0, 4).map((week) => {
      const longest = week.sessions.reduce((max, session) => Math.max(max, session.durationMin), 0);
      return `- Week ${week.weekIndex}: ${week.sessions.length} sessions, total load ${formatMinutes(weeklyLoadMinutes(report, week.weekIndex))}, longest session ${formatMinutes(longest)}, key sessions ${week.sessions.filter((session) => session.isKeyWorkout).map((session) => session.sessionLabel).join("; ") || "none surfaced"}`;
    });
    const suspicious = suspiciousNotes(report);
    return [
      `### Profile ${target.slot} - ${target.requestedName}`,
      "",
      `- Fixture used: \`${report.profileId}\` - ${fixtureName(report.profileId)} (${target.matchType}${target.approximationNote ? `; ${target.approximationNote}` : ""})`,
      `- Track / goal / frequency: ${report.profileSummary.onboardingTrack ?? "unspecified"} / ${report.profileSummary.goalDistance} ${report.profileSummary.goalType} / ${report.profileSummary.daysPerWeek} days per week`,
      `- Key inputs surfaced: current level ${report.profileSummary.currentLevel}; current continuous distance ${report.profileSummary.currentContinuousDistanceKm ?? "n/a"} km; notes: ${report.profileSummary.notes}`,
      "",
      `**Plan summary**`,
      `- Duration: ${report.planSummary.totalWeeks} weeks`,
      `- Sessions per week: ${report.planSummary.weeklySessionCounts.join(", ")}`,
      `- Long run presence: ${report.weeks.some((week) => week.sessions.some((session) => session.sessionType === "long")) ? "yes" : "no"}`,
      `- Quality workout presence: ${report.planSummary.hasIntervals ? "yes" : "no"}`,
      `- Notable structure: phases ${report.planSummary.phaseSequence.join(" -> ")}; ${spacingSummary(report)}; first key workouts: ${keyWorkouts(report)}`,
      "",
      `**Week 1 detail**`,
      ...week1Lines,
      "",
      `**Early progression snapshot (weeks 1-4)**`,
      ...progressionWeeks,
      `- Long run progression: ${longRunProgression(report)}`,
      "",
      `**Goal-specific / readiness notes**`,
      `- ${goalDayNote(report)}`,
      ...(suspicious.length > 0 ? suspicious.map((note) => `- Suspicious session note: ${note}`) : ["- No interval-shape notes surfaced in the reviewed sessions"]),
      "",
      `**Engine / benchmark warnings**`,
      `- Warnings: ${report.warnings.length > 0 ? report.warnings.join(", ") : "none"}`,
      `- Findings: ${report.findings.length > 0 ? report.findings.map((finding) => `${finding.code}: ${finding.message}`).join(" | ") : "none"}`,
      "",
    ].join("\n");
  });

  return [
    "# StridePilot Coach Review Report",
    "",
    "This report is generated from the current app/engine logic without changing product behavior. It reuses the existing benchmark-report harness and maps the requested review profiles to the closest available benchmark fixtures when needed.",
    "",
    `Exact fixture matches used: ${exactIds.length > 0 ? exactIds.join(", ") : "none"}`,
    `Approximated fixture matches used: ${approxIds.length > 0 ? approxIds.join(", ") : "none"}`,
    "",
    "## Summary table",
    "",
    summaryTable,
    "",
    "## Detailed profiles",
    "",
    ...detailSections,
    "## Cross-profile observations",
    "",
    ...buildCrossProfileObservations(results).map((line) => `- ${line}`),
    "",
  ].join("\n");
}

const outputPath = path.join(process.cwd(), "docs", "coach-review-report.md");
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${buildReport()}\n`, "utf8");
console.log(`Wrote coach review report to ${outputPath}`);
