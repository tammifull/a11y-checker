export type Priority = "critical" | "required" | "individual";

export interface JisRule {
  /** JIS X 8341-3:2016 達成基準番号（例 "1.1.1"）。ベストプラクティス系は "-" */
  jis: string;
  wcag: string;
  priority: Priority;
  title: string;
  howToFix: string;
}

export interface ReportViolation extends JisRule {
  axeRule: string;
  impact: string;
  targets: string[];
  html: string;
}

export interface ManualCheck {
  jis: string;
  title: string;
  how: string;
}

export interface Report {
  url: string;
  scannedAt: string;
  engine: { axeCore: string };
  summary: {
    critical: number;
    required: number;
    individual: number;
    manual: number;
    passed: number;
  };
  violations: ReportViolation[];
  manualChecks: ManualCheck[];
}

/** axe の violation のうち、この製品が使う部分だけの型 */
export interface ScanRawViolation {
  id: string;
  impact?: string | null;
  nodes: { target: unknown[]; html: string }[];
}
