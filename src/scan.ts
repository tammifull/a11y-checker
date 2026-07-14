import puppeteer from "@cloudflare/puppeteer";
import axe from "axe-core";
import { EXTRACT_SCRIPT } from "./extract";
import type { PageExtract, ScanRawViolation } from "./types";

export interface ScanResult {
  url: string;
  axeVersion: string;
  violations: ScanRawViolation[];
  passesCount: number;
  pageExtract: PageExtract;
}

export async function runScan(
  browserBinding: Fetcher,
  url: string,
): Promise<ScanResult> {
  const browser = await puppeteer.launch(browserBinding);
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });

    // axe-core のソースをページに注入
    // 注: addScriptTag({content}) は Browser Rendering で window.axe が
    // 定義されない事象があったため、evaluate による直接評価で注入する
    // wrangler(esbuild) の keepNames が axe.source 内に __name 呼び出しを
    // 混入させるため、ページ側に無害なシムを先に定義しておく
    await page.evaluate("window.__name = (target, name) => target;");
    await page.evaluate(axe.source);

    const injected = await page.evaluate("typeof window.axe");
    if (injected !== "object") {
      throw new Error(
        `axe-core の注入に失敗（typeof window.axe = ${injected}）`,
      );
    }

    // ページ内で axe.run() を実行
    // 注: import した `axe` を evaluate 内で参照するとバンドラがモジュール参照に
    // 書き換えてページ内で未定義になるため、注入済みの window.axe を使う
    const results = await page.evaluate(async () => {
      // @ts-expect-error window/document はページ側にのみ存在（Workers型にDOMなし）
      return await window.axe.run(document, {
        resultTypes: ["violations", "passes"],
      });
    });

    // AI所見用のページ情報（リンク・アウトライン）も同じ訪問で抽出しておく
    const pageExtract = (await page.evaluate(EXTRACT_SCRIPT)) as PageExtract;

    const r = results as { violations: ScanRawViolation[]; passes: unknown[] };
    return {
      url,
      axeVersion: axe.version,
      violations: r.violations,
      passesCount: r.passes.length,
      pageExtract,
    };
  } finally {
    await browser.close();
  }
}
