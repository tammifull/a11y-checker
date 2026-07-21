import type { Priority, Report, ReportViolation } from "./types";
import type { AiReview } from "./ai-review";

const TOOL_URL = "https://a11y-checker.doggo-company.com";

/** 優先度ごとの見出しラベル（①〜③） */
const PRIORITY_LABEL: Record<Priority, string> = {
  critical: "① 重大（非干渉）",
  required: "② 必須",
  individual: "③ 個別対応",
};

const PRIORITY_ORDER: Priority[] = ["critical", "required", "individual"];

/** 暴走防止: 1つの優先度グループで列挙する違反の上限 */
const MAX_PER_GROUP = 20;

/** AI所見の項目ラベル（public/app.js の renderAiReview と同じ対応） */
const AI_CHECK_LABEL: Record<string, string> = {
  "link-text": "リンク文言（JIS 2.4.4）",
  "reading-order": "読み上げ順序（JIS 1.3.2）",
  "color-only": "色依存（JIS 1.4.1・視覚）",
  "text-in-image": "画像内テキスト（JIS 1.4.5・視覚）",
  "text-legibility": "文字の視認性（JIS 1.4.3/1.4.4・視覚）",
  "chart-a11y": "グラフ・チャート（JIS 1.4.1関連・視覚）",
};

const FINAL_DISCLAIMER =
  "本結果はJIS X 8341-3:2016適合の証明ではありません。修正後も人の確認が必要です。";

/** 1件の違反を Markdown のリスト項目群に展開する */
function violationLines(v: ReportViolation): string[] {
  const lines: string[] = [];
  lines.push(`- ${v.title}`);
  lines.push(`  - JIS達成基準: ${v.jis}`);
  if (v.targets.length > 0) {
    lines.push(`  - 対象要素: ${v.targets.join(" / ")}`);
  }
  if (v.html) {
    lines.push(`  - HTML: ${v.html.replace(/\n/g, " ")}`);
  }
  lines.push(`  - 修正ガイド: ${v.howToFix}`);
  return lines;
}

/**
 * 診断結果を「AIに貼り付けて直させる」ためのMarkdownテキストに組み立てる純関数。
 * public/app.js に同一ロジックの手書き複製があるため、変更時は両方を更新すること。
 *
 * @param report /api/scan の結果（Report）
 * @param aiReview /api/ai-review の結果が画面にある場合のみ渡す。無ければ省略/undefined
 */
export function buildAiPrompt(
  report: Report,
  aiReview?: AiReview | null,
): string {
  const lines: string[] = [];

  // 冒頭の依頼文
  lines.push(
    `以下はウェブアクセシビリティチェックツール（${TOOL_URL}）の検査結果です。このサイトのHTML/CSSを修正して、指摘された問題を解消してください。修正は優先度①→②→③の順で。`,
  );
  lines.push("");

  // 対象・検査日時
  lines.push("## 対象");
  lines.push(`- URL: ${report.url}`);
  lines.push(`- 検査日時: ${report.scannedAt}`);
  lines.push("");

  // 優先度グループごとの違反（0件のグループは見出しごと省略）
  for (const p of PRIORITY_ORDER) {
    const items = report.violations.filter((v) => v.priority === p);
    if (items.length === 0) continue;
    lines.push(`## ${PRIORITY_LABEL[p]}（${items.length}件）`);
    lines.push("");
    const shown = items.slice(0, MAX_PER_GROUP);
    for (const v of shown) {
      lines.push(...violationLines(v));
    }
    const rest = items.length - shown.length;
    if (rest > 0) {
      lines.push(`- …ほか${rest}件（同種の修正を全体に適用してください）`);
    }
    lines.push("");
  }

  // ④ 手動確認項目
  if (report.manualChecks.length > 0) {
    lines.push("## ④ AIでは自動修正できない確認項目");
    lines.push("");
    for (const m of report.manualChecks) {
      lines.push(`- 〔${m.jis}〕${m.title}`);
    }
    lines.push("");
  }

  // AI所見（画面に結果がある場合のみ）
  if (aiReview && aiReview.checks.length > 0) {
    lines.push("## AI所見（要確認）");
    lines.push("");
    for (const c of aiReview.checks) {
      lines.push(`### ${AI_CHECK_LABEL[c.id] ?? c.id}`);
      if (c.verdict === "ok" || c.findings.length === 0) {
        lines.push("- 問題は見つかりませんでした（目視確認は必要です）");
      } else {
        for (const f of c.findings) {
          lines.push(`- ${f.target}: ${f.issue}`);
          lines.push(`  - 提案: ${f.suggestion}`);
        }
      }
      if (c.note) lines.push(`  （補足: ${c.note}）`);
      lines.push("");
    }
  }

  // 末尾の注意書き
  lines.push("---");
  lines.push(FINAL_DISCLAIMER);

  return lines.join("\n") + "\n";
}
