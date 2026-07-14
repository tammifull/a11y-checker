import puppeteer from "@cloudflare/puppeteer";
import axe from "axe-core";

export interface ScanResult {
  url: string;
  axeVersion: string;
  violations: unknown[];
  passesCount: number;
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
    await page.addScriptTag({ content: axe.source });

    // ページ内で axe.run() を実行
    const results = await page.evaluate(async () => {
      // @ts-expect-error axe はページに注入済み
      return await axe.run(document, { resultTypes: ["violations", "passes"] });
    });

    const r = results as { violations: unknown[]; passes: unknown[] };
    return {
      url,
      axeVersion: axe.version,
      violations: r.violations,
      passesCount: r.passes.length,
    };
  } finally {
    await browser.close();
  }
}
