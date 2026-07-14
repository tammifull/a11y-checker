const PRIORITY_LABEL = {
  critical: "① 重大（非干渉）",
  required: "② 必須",
  individual: "③ 個別対応",
};

let turnstileToken = "";
let lastReport = null;

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
  box.innerHTML = `
    <button type="button" id="ai-review-btn" class="secondary">🤖 AI所見を生成（β）— リンク文言・読み上げ順序</button>
    <p class="ai-note">テキスト系2項目をAIが下書きします（1日3回まで／結果は要確認）</p>
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
        turnstileToken,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      out.innerHTML = `<p class="error">${esc(data.error ?? "生成に失敗しました")}</p>`;
      return;
    }
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

init();
