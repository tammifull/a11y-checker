import { validateScanUrl } from "./url-guard";
import { runScan } from "./scan";
import { buildReport } from "./report";
import { checkRateLimit } from "./rate-limit";
import { verifyTurnstile } from "./turnstile";

export interface Env {
  MYBROWSER: Fetcher;
  ASSETS: Fetcher;
  RATE_LIMIT: KVNamespace;
  TURNSTILE_SITE_KEY: string;
  TURNSTILE_SECRET: string;
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
    return json(report, 200);
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

export function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
