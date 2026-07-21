import { describe, it, expect, vi } from "vitest";
import {
  buildAiPrompt,
  parseAiReview,
  runAiReview,
  AI_MODEL,
} from "../src/ai-review";
import type { PageExtract } from "../src/types";

const extract: PageExtract = {
  links: [{ text: "こちら", href: "/detail", context: "詳しくはこちら" }],
  outline: [
    { tag: "h1", text: "タイトル" },
    { tag: "h3", text: "いきなりh3" },
  ],
};

describe("buildAiPrompt", () => {
  const p = buildAiPrompt("https://example.com/", extract);
  it("ページデータをpage_dataタグでラップする", () => {
    expect(p.user).toContain("<page_data>");
    expect(p.user).toContain("こちら");
  });
  it("systemにインジェクション対策とJIS基準を含む", () => {
    expect(p.system).toContain("page_data");
    expect(p.system).toContain("2.4.4");
    expect(p.system).toContain("1.3.2");
  });
  it("スクショなしでは視覚チェックを含まない", () => {
    expect(p.system).not.toContain("chart-a11y");
    expect(p.system).not.toContain("color-only");
  });
  it("スクショありでは視覚チェック（chart-a11y含む）を指示する", () => {
    const pi = buildAiPrompt("https://example.com/", extract, true);
    expect(pi.system).toContain("chart-a11y");
    expect(pi.system).toContain("原点が0でなく");
    expect(pi.system).toContain("グラフが見当たらなければ");
  });
});

describe("parseAiReview", () => {
  it("正しいJSONをパースする", () => {
    const raw = JSON.stringify({
      checks: [
        {
          id: "link-text",
          jis: "2.4.4",
          verdict: "issues",
          findings: [
            {
              target: "こちら",
              issue: "リンク先が不明",
              suggestion: "「料金の詳細を見る」等に",
            },
          ],
          note: "1件",
        },
      ],
    });
    expect(parseAiReview(raw).checks[0].verdict).toBe("issues");
  });
  it("chart-a11y idを受け入れる", () => {
    const raw = JSON.stringify({
      checks: [
        {
          id: "chart-a11y",
          jis: "1.4.1",
          verdict: "ok",
          findings: [],
          note: "グラフ・チャートは検出されなかった",
        },
      ],
    });
    expect(parseAiReview(raw).checks[0].id).toBe("chart-a11y");
  });
  it("形が不正ならthrowする", () => {
    expect(() => parseAiReview('{"foo": 1}')).toThrow();
    expect(() => parseAiReview("not json")).toThrow();
  });
});

describe("runAiReview", () => {
  it("クライアントを正しいモデル・スキーマで呼び、AiReviewを返す", async () => {
    const create = vi.fn(async (_params: object) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            checks: [
              {
                id: "reading-order",
                jis: "1.3.2",
                verdict: "ok",
                findings: [],
                note: "問題なし",
              },
            ],
          }),
        },
      ],
    }));
    const review = await runAiReview(
      { messages: { create } },
      "https://example.com/",
      extract,
    );
    expect(review.model).toBe(AI_MODEL);
    expect(review.checks[0].verdict).toBe("ok");
    expect(review.disclaimer).toContain("要確認");
    const params = create.mock.calls[0][0] as Record<string, unknown>;
    expect(params.model).toBe(AI_MODEL);
    expect(params.output_config).toBeDefined();
  });
});
