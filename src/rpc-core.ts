import { validateScanUrl } from "./url-guard";
import { buildReport } from "./report";
import { buildAiPrompt } from "./ai-prompt";
import type { ScanResult } from "./scan";
import type { Report } from "./types";

/** service binding（RPC）の戻り値。webcheck-mcp 側もこの形を前提にする */
export interface ScanRpcResult {
  report: Report;
  aiPrompt: string;
}

/** runScan を注入可能にするための型（本物の runScan は browser 束縛を先に適用して渡す） */
export type RunScanFn = (url: string) => Promise<ScanResult>;

/**
 * ScanRpc.scan の中身を純粋に取り出したもの。
 * - url-guard で検証（SSRF 防御は呼び出し元 Worker 側でも二重に効く）
 * - runScan → buildReport → buildAiPrompt を組み立てて返す
 *
 * Turnstile / IP レート制限はここには含めない（service binding は外部公開されないため、
 * 乱用対策は呼び出し元の webcheck-mcp 側で APIキー単位に行う）。
 *
 * cloudflare:workers / puppeteer への依存を持たないので vitest から直接テストできる。
 */
export async function runScanRpc(
  runScan: RunScanFn,
  url: string,
): Promise<ScanRpcResult> {
  const guard = validateScanUrl(url);
  if (!guard.ok) {
    throw new Error(guard.reason);
  }

  const scan = await runScan(guard.url);
  const report = buildReport(scan, new Date().toISOString());
  const aiPrompt = buildAiPrompt(report);

  return { report, aiPrompt };
}
