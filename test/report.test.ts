import { describe, it, expect } from "vitest";
import { buildReport } from "../src/report";
// 注: type-only import にする（値importだと vitest が @cloudflare/puppeteer を Node で読み込んでしまう）
import type { ScanResult } from "../src/scan";

const scan: ScanResult = {
  url: "https://example.com/",
  axeVersion: "4.12.1",
  passesCount: 25,
  pageExtract: {
    links: [
      {
        text: "こちら",
        href: "/detail",
        context: "詳しくはこちらをご覧ください",
      },
    ],
    outline: [{ tag: "h1", text: "タイトル" }],
  },
  violations: [
    {
      id: "image-alt",
      impact: "critical",
      nodes: [
        { target: ["main > img:nth-child(3)"], html: '<img src="a.png">' },
        { target: ["footer img"], html: '<img src="b.png">' },
      ],
    },
    {
      id: "no-autoplay-audio",
      impact: "moderate",
      nodes: [{ target: ["audio"], html: "<audio autoplay>" }],
    },
    {
      id: "label",
      impact: "critical",
      nodes: [{ target: ["#q"], html: '<input id="q">' }],
    },
    {
      id: "unknown-future-rule",
      impact: "serious",
      nodes: [{ target: ["div"], html: "<div>" }],
    },
  ],
};

describe("buildReport", () => {
  const report = buildReport(scan, "2026-07-14T12:00:00Z");

  it("設計書 §4 のスキーマを満たす", () => {
    expect(report.url).toBe("https://example.com/");
    expect(report.scannedAt).toBe("2026-07-14T12:00:00Z");
    expect(report.engine.axeCore).toBe("4.12.1");
  });

  it("summary が優先度ごとの件数と手動項目数を持つ", () => {
    expect(report.summary).toEqual({
      critical: 1, // no-autoplay-audio
      required: 2, // image-alt, unknown-future-rule(seriousフォールバック)
      individual: 1, // label
      manual: report.manualChecks.length,
      passed: 25,
    });
  });

  it("violations は優先度順（critical→required→individual）に並ぶ", () => {
    const priorities = report.violations.map((v) => v.priority);
    expect(priorities).toEqual([
      "critical",
      "required",
      "required",
      "individual",
    ]);
  });

  it("各violationにJIS情報・対象セレクタ・HTMLが入る", () => {
    const imageAlt = report.violations.find((v) => v.axeRule === "image-alt")!;
    expect(imageAlt.jis).toBe("1.1.1");
    expect(imageAlt.title).toContain("代替テキスト");
    expect(imageAlt.targets).toEqual(["main > img:nth-child(3)", "footer img"]);
    expect(imageAlt.html).toBe('<img src="a.png">');
  });

  it("targetsは最大5件に丸める", () => {
    const many: ScanResult = {
      ...scan,
      violations: [
        {
          id: "image-alt",
          impact: "critical",
          nodes: Array.from({ length: 8 }, (_, i) => ({
            target: [`img:nth(${i})`],
            html: "<img>",
          })),
        },
      ],
    };
    expect(
      buildReport(many, "2026-07-14T12:00:00Z").violations[0].targets,
    ).toHaveLength(5);
  });

  it("pageExtract がレポートに引き継がれる", () => {
    expect(report.pageExtract?.links[0].text).toBe("こちら");
  });

  it("手動チェック項目が常に併記される", () => {
    expect(report.manualChecks.length).toBeGreaterThan(10);
    expect(report.manualChecks[0]).toHaveProperty("jis");
    expect(report.manualChecks[0]).toHaveProperty("how");
  });
});
