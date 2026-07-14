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
    ["① 重大", s.critical],
    ["② 必須", s.required],
    ["③ 個別対応", s.individual],
    ["④ 手動確認", s.manual],
    ["合格チェック", s.passed],
  ]
    .map(
      ([label, num]) =>
        `<div class="card"><span class="num">${num}</span>${label}</div>`,
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

  document.getElementById("result").scrollIntoView({ behavior: "smooth" });
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
