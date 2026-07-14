/**
 * ページ内で実行する抽出スクリプト。
 * 注: 関数で渡すとバンドラ変換（__name等）が混入するため、文字列で evaluate する（Phase 0/1の教訓）
 */
export const EXTRACT_SCRIPT = `(() => {
  const trunc = (s, n) => (s || "").replace(/\\s+/g, " ").trim().slice(0, n);
  const links = Array.from(document.querySelectorAll("a[href]")).slice(0, 50).map((a) => {
    const parentText = a.parentElement ? a.parentElement.textContent || "" : "";
    return {
      text: trunc(a.textContent, 120),
      href: trunc(a.getAttribute("href"), 200),
      context: trunc(parentText, 80),
    };
  });
  const outline = Array.from(
    document.querySelectorAll("h1,h2,h3,h4,h5,h6,header,nav,main,aside,footer")
  ).slice(0, 80).map((el) => ({
    tag: el.tagName.toLowerCase(),
    text: /^h[1-6]$/.test(el.tagName.toLowerCase()) ? trunc(el.textContent, 60) : "",
  }));
  return { links, outline };
})()`;
