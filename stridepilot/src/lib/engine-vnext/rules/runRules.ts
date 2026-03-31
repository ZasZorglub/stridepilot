import type { VNextRule, VNextRuleContext, VNextRuleResult, VNextValidationReport } from "./types";

export function runRules<TPlan>(
  plan: TPlan,
  rules: Array<VNextRule<TPlan>>,
): VNextValidationReport {
  const context: VNextRuleContext<TPlan> = { plan };
  const results: VNextRuleResult[] = rules.flatMap((rule) => rule.run(context));
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
