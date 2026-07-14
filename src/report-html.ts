import type { Priority, Report } from "./types";

const PRIORITY_LABEL: Record<Priority, string> = {
  critical: "① 重大（非干渉）",
  required: "② 必須",
  individual: "③ 個別対応",
};

function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function renderReportHtml(report: Report): string {
  const date = report.scannedAt.replace("T", " ").replace(/\.\d+Z$/, "Z");

  const sections = (["critical", "required", "individual"] as Priority[])
    .map((p) => {
      const items = report.violations.filter((v) => v.priority === p);
      if (items.length === 0) return "";
      const rows = items
        .map(
          (v) => `
      <div class="violation">
        <h3>${esc(v.title)} <span class="meta">JIS ${esc(v.jis)} / axe: ${esc(v.axeRule)} / impact: ${esc(v.impact)}</span></h3>
        <p class="fix"><strong>直し方:</strong> ${esc(v.howToFix)}</p>
        <p class="targets"><strong>該当箇所:</strong> ${v.targets.map(esc).join(" ／ ")}</p>
        <pre>${esc(v.html)}</pre>
      </div>`,
        )
        .join("");
      return `<section><h2>${PRIORITY_LABEL[p]}（${items.length}件）</h2>${rows}</section>`;
    })
    .join("");

  const manual = report.manualChecks
    .map(
      (m) =>
        `<li><strong>〔${esc(m.jis)}〕${esc(m.title)}</strong><br>${esc(m.how)}</li>`,
    )
    .join("");

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>アクセシビリティ検査レポート</title>
<style>
  body { font-family: "Hiragino Kaku Gothic ProN", "Noto Sans CJK JP", "Noto Sans JP", sans-serif; margin: 0; color: #1a1a1a; font-size: 11px; line-height: 1.7; }
  .cover { padding: 48px 40px 24px; border-bottom: 3px solid #1a1a1a; }
  .cover h1 { font-size: 22px; margin: 0 0 8px; }
  .cover .url { font-size: 13px; word-break: break-all; }
  .summary { display: flex; gap: 12px; margin: 20px 40px; }
  .summary div { border: 1px solid #ccc; border-radius: 6px; padding: 10px 14px; text-align: center; flex: 1; }
  .summary .num { font-size: 20px; font-weight: bold; display: block; }
  section { margin: 20px 40px; }
  h2 { border-left: 6px solid #1a1a1a; padding-left: 10px; font-size: 15px; }
  .violation { margin: 12px 0 18px; page-break-inside: avoid; }
  .violation h3 { font-size: 12px; margin: 0 0 4px; }
  .meta { font-weight: normal; color: #666; font-size: 10px; }
  pre { background: #f5f5f5; padding: 8px; border-radius: 4px; white-space: pre-wrap; word-break: break-all; font-size: 9px; }
  .manual li { margin-bottom: 8px; }
  .note { margin: 28px 40px; padding: 12px; background: #f0f4ff; border-radius: 6px; font-size: 10px; }
</style>
</head>
<body>
  <div class="cover">
    <h1>ウェブアクセシビリティ検査レポート</h1>
    <p class="url">${esc(report.url)}</p>
    <p>検査日時: ${esc(date)} ／ 検査エンジン: axe-core ${esc(report.engine.axeCore)} ／ 規格: JIS X 8341-3:2016（WCAG 2.0）</p>
    <p>デジタル庁「ウェブアクセシビリティ導入ガイドブック」（DS-671.2、2025年10月16日）の考え方に準拠</p>
  </div>
  <div class="summary">
    <div><span class="num">${report.summary.critical}</span>① 重大</div>
    <div><span class="num">${report.summary.required}</span>② 必須</div>
    <div><span class="num">${report.summary.individual}</span>③ 個別対応</div>
    <div><span class="num">${report.summary.manual}</span>④ 手動確認</div>
    <div><span class="num">${report.summary.passed}</span>合格チェック</div>
  </div>
  ${sections}
  <section>
    <h2>④ 手動確認項目（自動判定できない項目）</h2>
    <ul class="manual">${manual}</ul>
  </section>
  <div class="note">
    自動チェックで判定できるのはWCAG達成基準の2〜3割です。残りは目視・キーボード操作・スクリーンリーダーでの確認が必要です。<br>
    準拠: デジタル庁「ウェブアクセシビリティ導入ガイドブック」（DS-671.2、2025年10月16日）／ WAIC JIS X 8341-3:2016 ガイドライン<br>
    このレポートは自動チェックの結果であり、JIS X 8341-3:2016 適合の証明ではありません。<br>
    運営: DOGGO Company株式会社（https://doggo-company.com ／ お問い合わせ: https://doggo-company.com/contact/）
  </div>
</body>
</html>`;
}
