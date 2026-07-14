import { describe, it, expect, vi } from "vitest";
import { runScanRpc } from "../src/rpc-core";
// 注: type-only import（値importだと vitest が @cloudflare/puppeteer を Node で読み込んでしまう）
import type { ScanResult } from "../src/scan";

const fakeScan: ScanResult = {
  url: "https://example.com/",
  axeVersion: "4.12.1",
  passesCount: 10,
  pageExtract: {
    links: [{ text: "こちら", href: "/detail", context: "詳しくはこちら" }],
    outline: [{ tag: "h1", text: "タイトル" }],
  },
  violations: [
    {
      id: "image-alt",
      impact: "critical",
      nodes: [{ target: ["main > img"], html: '<img src="a.png">' }],
    },
  ],
};

describe("runScanRpc", () => {
  it("runScan を注入して report と aiPrompt を返す", async () => {
    const runScan = vi.fn(async (_url: string) => fakeScan);
    const result = await runScanRpc(runScan, "https://example.com/");

    // 正規化された URL で runScan が呼ばれる
    expect(runScan).toHaveBeenCalledWith("https://example.com/");
    // report は buildReport の出力
    expect(result.report.url).toBe("https://example.com/");
    expect(result.report.summary.required).toBe(1); // image-alt
    // aiPrompt は buildAiPrompt の出力（Markdown 文字列）
    expect(typeof result.aiPrompt).toBe("string");
    expect(result.aiPrompt).toContain("## 対象");
    expect(result.aiPrompt).toContain("https://example.com/");
  });

  it("URL が不正なら runScan を呼ばずに例外を投げる", async () => {
    const runScan = vi.fn(async (_url: string) => fakeScan);
    await expect(runScanRpc(runScan, "ftp://example.com")).rejects.toThrow();
    expect(runScan).not.toHaveBeenCalled();
  });

  it("内部ホスト（SSRF）は runScan に到達しない", async () => {
    const runScan = vi.fn(async (_url: string) => fakeScan);
    await expect(
      runScanRpc(runScan, "http://localhost/admin"),
    ).rejects.toThrow();
    expect(runScan).not.toHaveBeenCalled();
  });
});
