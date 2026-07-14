import { WorkerEntrypoint } from "cloudflare:workers";
import { runScan } from "./scan";
import { runScanRpc, type ScanRpcResult } from "./rpc-core";
import type { Env } from "./index";

/**
 * service binding（worker-to-worker RPC）用のエントリポイント。
 * webcheck-mcp Worker から `env.A11Y.scan(url)` として呼ばれる。
 *
 * 公開 fetch ハンドラ（default export）とは別口。Turnstile も IP レート制限も通さず、
 * スキャン本体だけを実行する。乱用対策は呼び出し元（APIキー認証・キー単位レート制限）が担う。
 */
export class ScanRpc extends WorkerEntrypoint<Env> {
  async scan(url: string): Promise<ScanRpcResult> {
    return runScanRpc((u) => runScan(this.env.MYBROWSER, u), url);
  }
}
