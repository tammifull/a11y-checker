import { validateScanUrl } from "./url-guard";
import { runScan } from "./scan";

export interface Env {
  MYBROWSER: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (request.method === "POST" && pathname === "/scan") {
      let body: { url?: string };
      try {
        body = await request.json();
      } catch {
        return json({ error: "JSONボディが必要です" }, 400);
      }

      const guard = validateScanUrl(body.url ?? "");
      if (!guard.ok) {
        return json({ error: guard.reason }, 400);
      }

      try {
        const result = await runScan(env.MYBROWSER, guard.url);
        return json(result, 200);
      } catch (e) {
        return json({ error: "検査に失敗しました", detail: String(e) }, 502);
      }
    }

    return json({ error: "Not found" }, 404);
  },
};

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
