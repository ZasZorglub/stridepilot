"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runRules = runRules;
function runRules(plan, rules) {
    const context = { plan };
    const results = rules.flatMap((rule) => rule.run(context));
    const hardFailCount = results.filter((result) => result.severity === "hard_fail").length;
    const autoAdjustCount = results.filter((result) => result.severity === "auto_adjust").length;
    const warningCount = results.filter((result) => result.severity === "warning").length;
    return {
        passed: hardFailCount === 0,
        results,
        hardFailCount,
        autoAdjustCount,
        warningCount,
    };
}
