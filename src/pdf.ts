import puppeteer from "@cloudflare/puppeteer";

export async function renderPdf(
  browserBinding: Fetcher,
  html: string,
): Promise<ArrayBuffer> {
  const browser = await puppeteer.launch(browserBinding);
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: 30000 });
    const pdf = await page.pdf({
      format: "a4",
      printBackground: true,
      margin: { top: "12mm", bottom: "14mm", left: "0mm", right: "0mm" },
    });
    // Buffer/Uint8Array → ArrayBuffer に正規化
    return pdf.buffer.slice(
      pdf.byteOffset,
      pdf.byteOffset + pdf.byteLength,
    ) as ArrayBuffer;
  } finally {
    await browser.close();
  }
}
