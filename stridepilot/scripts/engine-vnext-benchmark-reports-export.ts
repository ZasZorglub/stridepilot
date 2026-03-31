import fs from "fs";
import path from "path";

import { buildPlanQualitySummary, createTimestampedBenchmarkOutputDir, writeBenchmarkReports } from "../src/lib/coach/benchmarkReports";

const rootDir = path.join(process.cwd(), "tmp", "benchmark-reports");
const outputDir = createTimestampedBenchmarkOutputDir(rootDir);
const reports = writeBenchmarkReports(outputDir);
const summary = buildPlanQualitySummary(reports);
fs.writeFileSync(path.join(rootDir, "latest.txt"), `${outputDir}\n`, "utf8");

console.log(`Exported ${reports.length} benchmark reports to ${outputDir}`);
console.log(`Profiles with warnings: ${summary.profilesWithWarnings}/${summary.profilesTested}`);
console.log(`Warning counts: ${Object.entries(summary.warningTypes).map(([type, count]) => `${type}=${count}`).join(", ")}`);
console.log(`Latest run pointer: ${path.join(rootDir, "latest.txt")}`);
