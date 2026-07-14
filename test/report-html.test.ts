import { describe, it, expect } from "vitest";
import { renderReportHtml } from "../src/report-html";
import type { Report } from "../src/types";

const report: Report = {
  url: "https://example.com/",
  scannedAt: "2026-07-14T12:00:00Z",
  engine: { axeCore: "4.12.1" },
  summary: { critical: 1, required: 2, individual: 0, manual: 13, passed: 25 },
  violations: [
    {
      priority: "critical",
      jis: "1.4.2",
      wcag: "1.4.2",
      axeRule: "no-autoplay-audio",
      impact: "moderate",
      title: "音声が自動再生され、停止手段がない",
      howToFix: "自動再生をやめる",
      targets: ["audio"],
      html: "<audio autoplay>",
    },
  ],
  manualChecks: [
    {
      jis: "2.1.1",
      title: "キーボードだけで全機能を操作できるか",
      how: "Tabで巡回",
    },
  ],
};

describe("renderReportHtml", () => {
  const html = renderReportHtml(report);

  it("URL・日時・サマリー件数を含む", () => {
    expect(html).toContain("https://example.com/");
    expect(html).toContain("重大");
    expect(html).toContain("手動確認");
  });

  it("違反のJIS番号・タイトル・直し方を含む", () => {
    expect(html).toContain("1.4.2");
    expect(html).toContain("音声が自動再生され");
    expect(html).toContain("自動再生をやめる");
  });

  it("HTML断片はエスケープされる（タグ注入されない）", () => {
    expect(html).not.toContain("<audio autoplay>");
    expect(html).toContain("&lt;audio autoplay&gt;");
  });

  it("自動判定の限界の注記を含む（設計書 §4 PDFレポート構成4）", () => {
    expect(html).toContain("2〜3割");
  });
});
