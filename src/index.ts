import Anthropic from "@anthropic-ai/sdk";
import { validateScanUrl } from "./url-guard";
import { runScan } from "./scan";
import { buildReport } from "./report";
import { checkAiRateLimit, checkRateLimit } from "./rate-limit";
import { verifyTurnstile } from "./turnstile";
import { renderReportHtml } from "./report-html";
import { renderPdf } from "./pdf";
import { runAiReview } from "./ai-review";
import type { PageExtract, Report } from "./types";

export interface Env {
  MYBROWSER: Fetcher;
  ASSETS: Fetcher;
  RATE_LIMIT: KVNamespace;
  TURNSTILE_SITE_KEY: string;
  TURNSTILE_SECRET: string;
  ANTHROPIC_API_KEY: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === "/api/config" && request.method === "GET") {
      return json({ turnstileSiteKey: env.TURNSTILE_SITE_KEY }, 200);
    }

    if (pathname === "/api/scan" && request.method === "POST") {
      return handleScan(request, env);
    }

    if (pathname === "/api/pdf" && request.method === "POST") {
      return handlePdf(request, env);
    }

    if (pathname === "/api/ai-review" && request.method === "POST") {
      return handleAiReview(request, env);
    }

    // それ以外は静的アセット（UI）
    return env.ASSETS.fetch(request);
  },
};

async function handleScan(request: Request, env: Env): Promise<Response> {
  let body: { url?: string; turnstileToken?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "JSONボディが必要です" }, 400);
  }

  const ip = request.headers.get("CF-Connecting-IP");

  const human = await verifyTurnstile(
    env.TURNSTILE_SECRET,
    body.turnstileToken ?? "",
    ip,
  );
  if (!human) {
    return json(
      {
        error:
          "認証（Turnstile）を通過できませんでした。ページを再読み込みして再試行してください",
      },
      400,
    );
  }

  const rate = await checkRateLimit(
    env.RATE_LIMIT,
    ip ?? "unknown",
    Date.now(),
  );
  if (!rate.allowed) {
    return json(
      {
        error: "利用回数の上限に達しました。1時間ほどおいて再試行してください",
      },
      429,
    );
  }

  const guard = validateScanUrl(body.url ?? "");
  if (!guard.ok) {
    return json({ error: guard.reason }, 400);
  }

  try {
    const scan = await runScan(env.MYBROWSER, guard.url);
    const report = buildReport(scan, new Date().toISOString());
    // 視覚AIレビュー用にスクショを同梱（クライアントが /api/ai-review へ渡す）。
    // RPC 経路（webcheck-mcp）は buildReport の Report のみ使うので肥大化しない。
    return json({ ...report, screenshot: scan.screenshot }, 200);
  } catch (e) {
    return json(
      {
        error:
          "ページを開けませんでした。URLが正しいか、公開ページかを確認してください",
        detail: String(e),
      },
      502,
    );
  }
}

const MAX_PDF_BODY_BYTES = 2 * 1024 * 1024;

async function handlePdf(request: Request, env: Env): Promise<Response> {
  const ip = request.headers.get("CF-Connecting-IP");
  const rate = await checkRateLimit(
    env.RATE_LIMIT,
    ip ?? "unknown",
    Date.now(),
  );
  if (!rate.allowed) {
    return json(
      {
        error: "利用回数の上限に達しました。1時間ほどおいて再試行してください",
      },
      429,
    );
  }

  const raw = await request.text();
  if (raw.length > MAX_PDF_BODY_BYTES) {
    return json({ error: "レポートが大きすぎます" }, 413);
  }

  let report: Report;
  try {
    report = JSON.parse(raw) as Report;
  } catch {
    return json({ error: "JSONボディが必要です" }, 400);
  }
  if (
    typeof report?.url !== "string" ||
    !Array.isArray(report?.violations) ||
    !report?.summary
  ) {
    return json({ error: "レポートJSONの形式が正しくありません" }, 400);
  }

  try {
    const pdf = await renderPdf(env.MYBROWSER, renderReportHtml(report));
    return new Response(pdf, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": 'attachment; filename="a11y-report.pdf"',
      },
    });
  } catch (e) {
    return json({ error: "PDFの生成に失敗しました", detail: String(e) }, 502);
  }
}

// pageExtract に加えて視覚レビュー用スクショ（JPEG base64・最大 ~300KB）も受けるため広めに取る
const MAX_AI_BODY_BYTES = 1024 * 1024;

async function handleAiReview(request: Request, env: Env): Promise<Response> {
  const raw = await request.text();
  if (raw.length > MAX_AI_BODY_BYTES) {
    return json({ error: "リクエストが大きすぎます" }, 413);
  }

  let body: {
    url?: string;
    pageExtract?: PageExtract;
    screenshot?: string;
    turnstileToken?: string;
  };
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "JSONボディが必要です" }, 400);
  }
  if (
    typeof body.url !== "string" ||
    !body.pageExtract ||
    !Array.isArray(body.pageExtract.links)
  ) {
    return json(
      {
        error:
          "スキャン結果（pageExtract）が必要です。先に検査を実行してください",
      },
      400,
    );
  }

  const ip = request.headers.get("CF-Connecting-IP");
  const human = await verifyTurnstile(
    env.TURNSTILE_SECRET,
    body.turnstileToken ?? "",
    ip,
  );
  if (!human) {
    return json(
      {
        error:
          "認証（Turnstile）を通過できませんでした。ページを再読み込みして再試行してください",
      },
      400,
    );
  }

  const rate = await checkAiRateLimit(
    env.RATE_LIMIT,
    ip ?? "unknown",
    Date.now(),
  );
  if (!rate.allowed) {
    return json(
      { error: "AI所見は1日3回までです。明日また試してください" },
      429,
    );
  }

  try {
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const screenshot =
      typeof body.screenshot === "string" ? body.screenshot : undefined;
    const review = await runAiReview(
      client,
      body.url,
      body.pageExtract,
      screenshot,
    );
    return json(review, 200);
  } catch (e) {
    return json(
      {
        error: "AI所見の生成に失敗しました。時間をおいて再試行してください",
        detail: String(e),
      },
      502,
    );
  }
}

// service binding（RPC）用エントリポイント。webcheck-mcp から呼ばれる。default export は変更しない。
export { ScanRpc } from "./rpc";

export function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
