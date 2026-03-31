export type VNextRuleSeverity = "hard_fail" | "auto_adjust" | "warning";

export interface VNextRuleResult {
  ruleId: string;
  severity: VNextRuleSeverity;
  message: string;
  weekIndex?: number;
  sessionId?: string;
  sessionDay?: string;
}

export interface VNextRuleContext<TPlan = unknown> {
  plan: TPlan;
}

export interface VNextRule<TPlan = unknown> {
  id: string;
  run(context: VNextRuleContext<TPlan>): VNextRuleResult[];
}

export interface VNextValidationReport {
  passed: boolean;
  results: VNextRuleResult[];
  hardFailCount: number;
  autoAdjustCount: number;
  warningCount: number;
}
