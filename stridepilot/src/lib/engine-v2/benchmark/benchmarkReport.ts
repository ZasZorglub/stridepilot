import type { BenchmarkBand, BenchmarkRunnerResult, BenchmarkSuiteResult, BenchmarkFailureScan } from "./benchmarkModels";

function renderBand(label: string, status: BenchmarkBand): string {
  return `${label}: ${status}`;
}

function renderFailure(scan: BenchmarkFailureScan): string {
  if (scan.status === "pass") return "failureScan: pass";
  const notes = [...scan.failures, ...scan.warnings];
  return `failureScan: ${scan.status}${notes.length ? ` (${notes.join(" ; ")})` : ""}`;
}

function renderRunner(result: BenchmarkRunnerResult): string {
  const lines = [
    `=== ${result.runnerName} ===`,
    `classification: ${result.classificationSummary}`,
    `phases: ${result.phaseSummary}`,
    renderBand("classificationFit", result.classificationFit.status),
    renderBand("phaseFit", result.phaseFit.status),
    renderBand("longRunFit", result.longRunFit.status),
    renderBand("weeklyStructureFit", result.weeklyStructureFit.status),
    renderBand("intensityFit", result.intensityFit.status),
    renderBand("milestoneFit", result.milestoneFit.status),
    renderBand("raceWeekFit", result.raceWeekFit.status),
    renderFailure(result.failureScan),
  ];

  const notes = result.majorNotes.length > 0 ? result.majorNotes.map((note) => `- ${note}`) : ["- no major notes"];
  return `${lines.join("\n")}\nnotes:\n${notes.join("\n")}\nscore: ${result.summaryScore}/14`;
}

export function renderBenchmarkReport(suite: BenchmarkSuiteResult): string {
  const header = [
    "StridePilot Engine V2 Benchmark",
    `overallScore: ${suite.overallScore}`,
    `failingRunners: ${suite.failingRunners.length > 0 ? suite.failingRunners.join(", ") : "none"}`,
  ].join("\n");
  return `${header}\n\n${suite.results.map((result) => renderRunner(result)).join("\n\n")}`;
}
