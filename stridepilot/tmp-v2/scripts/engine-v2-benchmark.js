"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const engine_v2_1 = require("../src/lib/engine-v2");
const suite = (0, engine_v2_1.evaluateBenchmarkSuite)(engine_v2_1.referenceRunnerBenchmarks);
console.log((0, engine_v2_1.renderBenchmarkReport)(suite));
