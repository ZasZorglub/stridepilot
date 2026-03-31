"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const benchmarkReports_1 = require("../src/lib/coach/benchmarkReports");
const rootDir = path_1.default.join(process.cwd(), "tmp", "benchmark-reports");
const outputDir = (0, benchmarkReports_1.createTimestampedBenchmarkOutputDir)(rootDir);
const reports = (0, benchmarkReports_1.writeBenchmarkReports)(outputDir);
const summary = (0, benchmarkReports_1.buildPlanQualitySummary)(reports);
fs_1.default.writeFileSync(path_1.default.join(rootDir, "latest.txt"), `${outputDir}\n`, "utf8");
console.log(`Exported ${reports.length} benchmark reports to ${outputDir}`);
console.log(`Profiles with warnings: ${summary.profilesWithWarnings}/${summary.profilesTested}`);
console.log(`Warning counts: ${Object.entries(summary.warningTypes).map(([type, count]) => `${type}=${count}`).join(", ")}`);
console.log(`Latest run pointer: ${path_1.default.join(rootDir, "latest.txt")}`);
