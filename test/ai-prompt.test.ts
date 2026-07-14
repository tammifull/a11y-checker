import { describe, it, expect } from "vitest";
import { buildAiPrompt } from "../src/ai-prompt";
import type { Report, ReportViolation } from "../src/types";
import type { AiReview } from "../src/ai-review";

function violation(over: Partial<ReportViolation> = {}): ReportViolation {
  return {
    jis: "1.1.1",
    wcag: "1.1.1",
    priority: "required",
    title: "画像に代替テキストがない",
    howToFix: "img要素にalt属性を付与する",
    axeRule: "image-alt",
    impact: "critical",
    targets: ["main > img:nth-child(3)"],
    html: '<img src="a.png">',
    ...over,
  };
}

function report(over: Partial<Report> = {}): Report {
  return {
    url: "https://example.com/",
    scannedAt: "2026-07-14T00:00:00.000Z",
    engine: { axeCore: "4.12.1" },
    summary: {
      critical: 0,
      required: 0,
      individual: 0,
      manual: 2,
      passed: 10,
    },
    violations: [],
    manualChecks: [
      { jis: "1.4.5", title: "文字画像を使っていないか", how: "目視で確認" },
      { jis: "2.4.4", title: "リンク文言が具体的か", how: "目視で確認" },
    ],
    ...over,
  };
}

function aiReview(over: Partial<AiReview> = {}): AiReview {
  return {
    model: "claude-haiku-4-5",
    disclaimer: "AIによる所見（要確認）です。",
    checks: [
      {
        id: "link-text",
        jis: "2.4.4",
        verdict: "issues",
        findings: [
          {
            target: "こちら",
            issue: "リンク先が分からない",
            suggestion: "「詳細ページへ」に変更",
          },
        ],
        note: "文脈から推定",
      },
    ],
    ...over,
  };
}

describe("buildAiPrompt", () => {
  it("冒頭の依頼文・対象・末尾注意書きを含む", () => {
    const text = buildAiPrompt(report());
    expect(text).toContain(
      "以下はウェブアクセシビリティチェックツール（https://a11y-checker.doggo-company.com）の検査結果です。このサイトのHTML/CSSを修正して、指摘された問題を解消してください。修正は優先度①→②→③の順で。",
    );
    expect(text).toContain("- URL: https://example.com/");
    expect(text).toContain("- 検査日時: 2026-07-14T00:00:00.000Z");
    expect(text).toContain(
      "本結果はJIS X 8341-3:2016適合の証明ではありません。修正後も人の確認が必要です。",
    );
  });

  it("違反はルール名・JIS・対象要素・修正ガイドを列挙する", () => {
    const text = buildAiPrompt(
      report({
        violations: [violation()],
        summary: { ...report().summary, required: 1 },
      }),
    );
    expect(text).toContain("## ② 必須（1件）");
    expect(text).toContain("- 画像に代替テキストがない");
    expect(text).toContain("  - JIS達成基準: 1.1.1");
    expect(text).toContain("  - 対象要素: main > img:nth-child(3)");
    expect(text).toContain('  - HTML: <img src="a.png">');
    expect(text).toContain("  - 修正ガイド: img要素にalt属性を付与する");
  });

  it("0件の優先度グループは見出しごと省略する", () => {
    const text = buildAiPrompt(
      report({
        violations: [violation({ priority: "critical" })],
      }),
    );
    expect(text).toContain("## ① 重大（非干渉）（1件）");
    expect(text).not.toContain("② 必須");
    expect(text).not.toContain("③ 個別対応");
  });

  it("違反が20件を超えたら20件で打ち切り、超過分を要約する", () => {
    const many = Array.from({ length: 25 }, (_, i) =>
      violation({ priority: "individual", title: `違反${i}` }),
    );
    const text = buildAiPrompt(report({ violations: many }));
    expect(text).toContain("## ③ 個別対応（25件）");
    expect(text).toContain("- 違反0");
    expect(text).toContain("- 違反19");
    expect(text).not.toContain("- 違反20");
    expect(text).toContain("- …ほか5件（同種の修正を全体に適用してください）");
  });

  it("④手動確認項目を項目名の箇条書きで含める", () => {
    const text = buildAiPrompt(report());
    expect(text).toContain("## ④ AIでは自動修正できない確認項目");
    expect(text).toContain("- 〔1.4.5〕文字画像を使っていないか");
    expect(text).toContain("- 〔2.4.4〕リンク文言が具体的か");
  });

  it("AI所見が渡されたときだけ「AI所見（要確認）」セクションを出す", () => {
    const withReview = buildAiPrompt(report(), aiReview());
    expect(withReview).toContain("## AI所見（要確認）");
    expect(withReview).toContain("### リンク文言（JIS 2.4.4）");
    expect(withReview).toContain("- こちら: リンク先が分からない");
    expect(withReview).toContain("  - 提案: 「詳細ページへ」に変更");

    const withoutReview = buildAiPrompt(report());
    expect(withoutReview).not.toContain("AI所見（要確認）");

    const nullReview = buildAiPrompt(report(), null);
    expect(nullReview).not.toContain("AI所見（要確認）");
  });

  it("AI所見が verdict=ok のときは問題なしと表記する", () => {
    const text = buildAiPrompt(
      report(),
      aiReview({
        checks: [
          {
            id: "reading-order",
            jis: "1.3.2",
            verdict: "ok",
            findings: [],
            note: "",
          },
        ],
      }),
    );
    expect(text).toContain("### 読み上げ順序（JIS 1.3.2）");
    expect(text).toContain(
      "- 問題は見つかりませんでした（目視確認は必要です）",
    );
  });
});
