import type { Priority, Report, ReportViolation } from "./types";
import type { ScanResult } from "./scan";
import { resolveJisRule } from "./jis-mapping";
import { MANUAL_CHECKS } from "./manual-checks";

const PRIORITY_ORDER: Record<Priority, number> = {
  critical: 0,
  required: 1,
  individual: 2,
};
const MAX_TARGETS = 5;

export function buildReport(scan: ScanResult, scannedAt: string): Report {
  const violations: ReportViolation[] = scan.violations
    .map((v) => {
      const rule = resolveJisRule(v.id, v.impact ?? null);
      return {
        ...rule,
        axeRule: v.id,
        impact: v.impact ?? "unknown",
        targets: v.nodes
          .slice(0, MAX_TARGETS)
          .map((n) => n.target.map(String).join(" ")),
        html: v.nodes[0]?.html ?? "",
      };
    })
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

  const count = (p: Priority) =>
    violations.filter((v) => v.priority === p).length;

  return {
    url: scan.url,
    scannedAt,
    engine: { axeCore: scan.axeVersion },
    summary: {
      critical: count("critical"),
      required: count("required"),
      individual: count("individual"),
      manual: MANUAL_CHECKS.length,
      passed: scan.passesCount,
    },
    violations,
    manualChecks: MANUAL_CHECKS,
  };
}
