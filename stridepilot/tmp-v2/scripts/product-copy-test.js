"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const repoRoot = node_path_1.default.resolve(__dirname, "..", "..");
const userFacingFiles = [
    node_path_1.default.join(repoRoot, "src/app/page.tsx"),
    node_path_1.default.join(repoRoot, "src/app/layout.tsx"),
    node_path_1.default.join(repoRoot, "src/app/manifest.webmanifest"),
];
const bannedPhrases = [
    "Din AI løbecoach",
    "AI-baseret løbeprogram",
    "Din adaptive løbecoach",
];
for (const file of userFacingFiles) {
    const content = node_fs_1.default.readFileSync(file, "utf8");
    for (const phrase of bannedPhrases) {
        strict_1.default.equal(content.includes(phrase), false, `User-facing copy in ${node_path_1.default.basename(file)} should no longer lead with "${phrase}"`);
    }
}
const pageContent = node_fs_1.default.readFileSync(node_path_1.default.join(repoRoot, "src/app/page.tsx"), "utf8");
strict_1.default.match(pageContent, /Din adaptive løbeapp/, "The app should position itself as an adaptive running app in the primary welcome copy");
strict_1.default.match(pageContent, /Et adaptivt løbeprogram, der følger din træning roligt\./, "The auth and header subtitle should use the calmer adaptive positioning");
console.log("product copy audit tests passed");
