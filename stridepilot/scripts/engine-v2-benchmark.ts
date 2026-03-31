import { evaluateBenchmarkSuite, referenceRunnerBenchmarks, renderBenchmarkReport } from "../src/lib/engine-v2";

const suite = evaluateBenchmarkSuite(referenceRunnerBenchmarks);

console.log(renderBenchmarkReport(suite));
