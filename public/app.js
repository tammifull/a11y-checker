const PRIORITY_LABEL = {
  critical: "① 重大（非干渉）",
  required: "② 必須",
  individual: "③ 個別対応",
};

let turnstileToken = "";
let lastReport = null;
let lastAiReview = null;

async function init() {
  const res = await fetch("/api/config");
  const { turnstileSiteKey } = await res.json();

  // Turnstile を明示レンダリング（トークンはコールバックで受け取る）
  // 注: /api/config の取得完了時点で load イベントが済んでいることがあるため、
  // イベント待ちではなく window.turnstile の出現をポーリングして確実に描画する
  const render = () =>
    window.turnstile.render("#turnstile-widget", {
      sitekey: turnstileSiteKey,
      callback: (token) => {
        turnstileToken = token;
      },
      "expired-callback": () => {
        turnstileToken = "";
      },
    });
  if (window.turnstile) {
    render();
  } else {
    const timer = setInterval(() => {
      if (window.turnstile) {
        clearInterval(timer);
        render();
      }
    }, 100);
  }
}

function setStatus(message, isError = false) {
  const el = document.getElementById("status");
  el.textContent = message;
  el.className = isError ? "error" : "";
}

function esc(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

function renderReport(report) {
  lastReport = report;
  lastAiReview = null; // 新しい検査結果ではAI所見をリセット
  document.getElementById("result").hidden = false;
  document.getElementById("result-meta").textContent =
    `${report.url} ／ ${report.scannedAt} ／ axe-core ${report.engine.axeCore}`;

  const s = report.summary;
  document.getElementById("summary").innerHTML = [
    ["① 重大", s.critical, "critical"],
    ["② 必須", s.required, "required"],
    ["③ 個別対応", s.individual, "individual"],
    ["④ 手動確認", s.manual, "manual"],
    ["合格チェック", s.passed, "passed"],
  ]
    .map(
      ([label, num, cls]) =>
        `<div class="card ${cls}"><span class="num">${num}</span>${label}</div>`,
    )
    .join("");

  const groups = ["critical", "required", "individual"]
    .map((p) => {
      const items = report.violations.filter((v) => v.priority === p);
      if (items.length === 0) return "";
      const details = items
        .map(
          (v) => `
      <details>
        <summary>${esc(v.title)}</summary>
        <p class="meta">JIS ${esc(v.jis)} ／ axeルール: ${esc(v.axeRule)} ／ impact: ${esc(v.impact)}</p>
        <p><strong>直し方:</strong> ${esc(v.howToFix)}</p>
        <p><strong>該当箇所:</strong> ${v.targets.map(esc).join(" ／ ")}</p>
        <pre><code>${esc(v.html)}</code></pre>
      </details>`,
        )
        .join("");
      return `<div class="priority-group ${p}"><h3>${PRIORITY_LABEL[p]}（${items.length}件）</h3>${details}</div>`;
    })
    .join("");
  document.getElementById("violations").innerHTML =
    groups ||
    "<p>自動チェックで検出された問題はありませんでした。④の手動確認は必要です。</p>";

  document.getElementById("manual-list").innerHTML = report.manualChecks
    .map(
      (m) =>
        `<li><strong>〔${esc(m.jis)}〕${esc(m.title)}</strong><br>${esc(m.how)}</li>`,
    )
    .join("");

  renderAiButton(report);

  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  document
    .getElementById("result")
    .scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
}

function renderAiButton(report) {
  const section = document.getElementById("manual-section");
  let box = document.getElementById("ai-review-box");
  if (!box) {
    box = document.createElement("div");
    box.id = "ai-review-box";
    section.appendChild(box);
  }
  if (!report.pageExtract) {
    box.innerHTML = "";
    return;
  }
  const hasShot =
    typeof lastReport.screenshot === "string" &&
    lastReport.screenshot.length > 0;
  const btnLabel = hasShot
    ? "🤖 AI所見を生成（β）— リンク文言・読み上げ順序＋視覚レビュー"
    : "🤖 AI所見を生成（β）— リンク文言・読み上げ順序";
  const noteText = hasShot
    ? "テキスト系2項目＋スクショからの視覚レビュー（色依存・画像内テキスト・視認性）をAIが下書きします（1日3回まで／結果は要確認）"
    : "テキスト系2項目をAIが下書きします（1日3回まで／結果は要確認）";
  box.innerHTML = `
    <button type="button" id="ai-review-btn" class="secondary">${btnLabel}</button>
    <p class="ai-note">${noteText}</p>
    <div id="ai-review-result"></div>`;
  document
    .getElementById("ai-review-btn")
    .addEventListener("click", runAiReviewUi);
}

async function runAiReviewUi() {
  const btn = document.getElementById("ai-review-btn");
  const out = document.getElementById("ai-review-result");
  if (!turnstileToken) {
    out.innerHTML =
      '<p class="error">セキュリティ確認の完了を待ってから再度押してください</p>';
    return;
  }
  btn.disabled = true;
  out.innerHTML = "<p>AIが確認しています…（数秒かかります）</p>";
  try {
    const res = await fetch("/api/ai-review", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        url: lastReport.url,
        pageExtract: lastReport.pageExtract,
        screenshot: lastReport.screenshot || undefined,
        turnstileToken,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      out.innerHTML = `<p class="error">${esc(data.error ?? "生成に失敗しました")}</p>`;
      return;
    }
    lastAiReview = data; // 「AI用にコピー」に含めるため保持
    out.innerHTML = renderAiReview(data);
  } catch {
    out.innerHTML =
      '<p class="error">通信に失敗しました。時間をおいて再試行してください</p>';
  } finally {
    btn.disabled = false;
    if (window.turnstile) window.turnstile.reset();
    turnstileToken = "";
  }
}

function renderAiReview(review) {
  const CHECK_LABEL = {
    "link-text": "リンク文言（JIS 2.4.4）",
    "reading-order": "読み上げ順序（JIS 1.3.2）",
    "color-only": "色依存（JIS 1.4.1・視覚）",
    "text-in-image": "画像内テキスト（JIS 1.4.5・視覚）",
    "text-legibility": "文字の視認性（JIS 1.4.3/1.4.4・視覚）",
  };
  const blocks = review.checks
    .map((c) => {
      const items =
        c.verdict === "ok"
          ? "<p>問題は見つかりませんでした（目視確認は必要です）</p>"
          : "<ul>" +
            c.findings
              .map(
                (f) =>
                  `<li><strong>${esc(f.target)}</strong>: ${esc(f.issue)}<br>💡 ${esc(f.suggestion)}</li>`,
              )
              .join("") +
            "</ul>";
      return `<div class="ai-check"><h4>🤖 AI所見（要確認）: ${CHECK_LABEL[c.id] ?? esc(c.id)}</h4>${items}<p class="meta">${esc(c.note)}</p></div>`;
    })
    .join("");
  return blocks + `<p class="ai-disclaimer">${esc(review.disclaimer)}</p>`;
}

function download(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

document.getElementById("scan-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const url = document.getElementById("url").value.trim();
  const button = document.getElementById("submit");

  if (!turnstileToken) {
    setStatus(
      "セキュリティ確認の完了を待っています。チェックボックスが表示されている場合はチェックしてから、もう一度「検査する」を押してください",
      true,
    );
    return;
  }

  button.disabled = true;
  setStatus("検査中です（10〜30秒ほどかかります）…");
  try {
    const res = await fetch("/api/scan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url, turnstileToken }),
    });
    const data = await res.json();
    if (!res.ok) {
      setStatus(data.error ?? "検査に失敗しました", true);
      return;
    }
    setStatus("");
    renderReport(data);
  } catch {
    setStatus("通信に失敗しました。時間をおいて再試行してください", true);
  } finally {
    button.disabled = false;
    if (window.turnstile) window.turnstile.reset();
    turnstileToken = "";
  }
});

document.getElementById("dl-json").addEventListener("click", () => {
  if (!lastReport) return;
  download(
    new Blob([JSON.stringify(lastReport, null, 2)], {
      type: "application/json",
    }),
    "a11y-report.json",
  );
});

document.getElementById("dl-pdf").addEventListener("click", async () => {
  if (!lastReport) return;
  setStatus("PDFを生成しています…");
  try {
    const res = await fetch("/api/pdf", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(lastReport),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setStatus(data.error ?? "PDFの生成に失敗しました", true);
      return;
    }
    download(await res.blob(), "a11y-report.pdf");
    setStatus("");
  } catch {
    setStatus("通信に失敗しました。時間をおいて再試行してください", true);
  }
});

/** 検査結果を「AIに貼り付けて直させる」ためのMarkdownを組み立てる。
    src/ai-prompt.ts の手書き複製（フロントにビルドステップが無いため）。
    ロジックを変えるときは src/ai-prompt.ts と両方を更新すること。 */
function buildAiPrompt(report, aiReview) {
  const TOOL_URL = "https://a11y-checker.doggo-company.com";
  const PRIORITY_LABEL = {
    critical: "① 重大（非干渉）",
    required: "② 必須",
    individual: "③ 個別対応",
  };
  const PRIORITY_ORDER = ["critical", "required", "individual"];
  const MAX_PER_GROUP = 20;
  const AI_CHECK_LABEL = {
    "link-text": "リンク文言（JIS 2.4.4）",
    "reading-order": "読み上げ順序（JIS 1.3.2）",
    "color-only": "色依存（JIS 1.4.1・視覚）",
    "text-in-image": "画像内テキスト（JIS 1.4.5・視覚）",
    "text-legibility": "文字の視認性（JIS 1.4.3/1.4.4・視覚）",
  };
  const FINAL_DISCLAIMER =
    "本結果はJIS X 8341-3:2016適合の証明ではありません。修正後も人の確認が必要です。";

  const violationLines = (v) => {
    const out = [];
    out.push(`- ${v.title}`);
    out.push(`  - JIS達成基準: ${v.jis}`);
    if (v.targets.length > 0)
      out.push(`  - 対象要素: ${v.targets.join(" / ")}`);
    if (v.html) out.push(`  - HTML: ${v.html.replace(/\n/g, " ")}`);
    out.push(`  - 修正ガイド: ${v.howToFix}`);
    return out;
  };

  const lines = [];

  lines.push(
    `以下はウェブアクセシビリティチェックツール（${TOOL_URL}）の検査結果です。このサイトのHTML/CSSを修正して、指摘された問題を解消してください。修正は優先度①→②→③の順で。`,
  );
  lines.push("");

  lines.push("## 対象");
  lines.push(`- URL: ${report.url}`);
  lines.push(`- 検査日時: ${report.scannedAt}`);
  lines.push("");

  for (const p of PRIORITY_ORDER) {
    const items = report.violations.filter((v) => v.priority === p);
    if (items.length === 0) continue;
    lines.push(`## ${PRIORITY_LABEL[p]}（${items.length}件）`);
    lines.push("");
    const shown = items.slice(0, MAX_PER_GROUP);
    for (const v of shown) lines.push(...violationLines(v));
    const rest = items.length - shown.length;
    if (rest > 0) {
      lines.push(`- …ほか${rest}件（同種の修正を全体に適用してください）`);
    }
    lines.push("");
  }

  if (report.manualChecks.length > 0) {
    lines.push("## ④ AIでは自動修正できない確認項目");
    lines.push("");
    for (const m of report.manualChecks) {
      lines.push(`- 〔${m.jis}〕${m.title}`);
    }
    lines.push("");
  }

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

  lines.push("---");
  lines.push(FINAL_DISCLAIMER);

  return lines.join("\n") + "\n";
}

const COPY_AI_LABEL = "🤖 AI用にコピー";

document.getElementById("copy-ai").addEventListener("click", async () => {
  if (!lastReport) return;
  const btn = document.getElementById("copy-ai");
  try {
    await navigator.clipboard.writeText(
      buildAiPrompt(lastReport, lastAiReview),
    );
    btn.textContent = "コピーしました";
    setTimeout(() => {
      btn.textContent = COPY_AI_LABEL;
    }, 2000);
  } catch {
    setStatus(
      "コピーできませんでした。ブラウザのクリップボード権限をご確認ください",
      true,
    );
  }
});

init();
