import type { JisRule, Priority } from "./types";

/**
 * axe ルールID → JIS X 8341-3:2016 マッピング表（設計書 §4）。
 * 優先度は wiki/web-accessibility-checklist.md の4段階に従う:
 *   critical(①重大/非干渉) / required(②必須) / individual(③個別対応)
 * axe の impact とは機械的に1:1対応しないため、ルールごとに手で決める。
 */
const JIS_MAPPING: Record<string, JisRule> = {
  // ---- ①重大（非干渉） ----
  "no-autoplay-audio": {
    jis: "1.4.2",
    wcag: "1.4.2",
    priority: "critical",
    title: "音声が自動再生され、停止手段がない",
    howToFix:
      "自動再生をやめるか、3秒以内に止める・一時停止/ミュートボタンを付ける",
  },
  blink: {
    jis: "2.2.2",
    wcag: "2.2.2",
    priority: "critical",
    title: "blink要素による点滅がある",
    howToFix: "blink要素を削除する（点滅は光感受性発作の危険）",
  },
  marquee: {
    jis: "2.2.2",
    wcag: "2.2.2",
    priority: "critical",
    title: "marquee要素による動き続けるコンテンツがある",
    howToFix:
      "marquee要素を削除し、必要ならCSSアニメーション+一時停止手段で実装する",
  },
  "meta-refresh": {
    jis: "2.2.1",
    wcag: "2.2.1",
    priority: "critical",
    title: "meta refresh による自動リダイレクト/更新がある",
    howToFix:
      "自動更新をやめる。必要ならユーザーが延長・解除できる手段を用意する",
  },

  // ---- ②必須 ----
  "image-alt": {
    jis: "1.1.1",
    wcag: "1.1.1",
    priority: "required",
    title: "画像に代替テキストがない",
    howToFix:
      'img要素にalt属性を付与。装飾画像は alt=""。リンク画像はリンク先がわかる内容にする',
  },
  "input-image-alt": {
    jis: "1.1.1",
    wcag: "1.1.1",
    priority: "required",
    title: "画像ボタンに代替テキストがない",
    howToFix: "input[type=image] に alt 属性でボタンの機能を書く",
  },
  "area-alt": {
    jis: "1.1.1",
    wcag: "1.1.1",
    priority: "required",
    title: "イメージマップのarea要素に代替テキストがない",
    howToFix: "area要素に alt 属性でリンク先を示す",
  },
  "object-alt": {
    jis: "1.1.1",
    wcag: "1.1.1",
    priority: "required",
    title: "object要素に代替コンテンツがない",
    howToFix: "object要素の中に代替となるテキストを入れる",
  },
  "svg-img-alt": {
    jis: "1.1.1",
    wcag: "1.1.1",
    priority: "required",
    title: "SVG画像にアクセシブルな名前がない",
    howToFix: 'role="img" の svg に title 要素か aria-label を付ける',
  },
  "role-img-alt": {
    jis: "1.1.1",
    wcag: "1.1.1",
    priority: "required",
    title: 'role="img" 要素に代替テキストがない',
    howToFix: "aria-label または aria-labelledby で内容を説明する",
  },
  "color-contrast": {
    jis: "1.4.3",
    wcag: "1.4.3",
    priority: "required",
    title: "文字と背景のコントラスト比が不足（4.5:1未満）",
    howToFix:
      "文字色・背景色を調整しコントラスト比4.5:1以上（大きい文字は3:1以上）にする",
  },
  "html-has-lang": {
    jis: "3.1.1",
    wcag: "3.1.1",
    priority: "required",
    title: "html要素にlang属性がない",
    howToFix: '<html lang="ja"> のようにページの言語を指定する',
  },
  "html-lang-valid": {
    jis: "3.1.1",
    wcag: "3.1.1",
    priority: "required",
    title: "html要素のlang属性値が不正",
    howToFix: "lang属性に正しい言語コード（ja, en等）を指定する",
  },
  "valid-lang": {
    jis: "3.1.2",
    wcag: "3.1.2",
    priority: "required",
    title: "部分的なlang属性の値が不正",
    howToFix: "該当要素のlang属性に正しい言語コードを指定する",
  },
  "document-title": {
    jis: "2.4.2",
    wcag: "2.4.2",
    priority: "required",
    title: "ページにtitle要素がない",
    howToFix: "「ページ名｜サイト名」の形式でページごとに固有のtitleを付ける",
  },
  "link-name": {
    jis: "2.4.4",
    wcag: "2.4.4",
    priority: "required",
    title: "リンクに識別できるテキストがない",
    howToFix:
      "リンクテキストか aria-label でリンク先がわかる文言を付ける（「こちら」は避ける）",
  },
  "button-name": {
    jis: "4.1.2",
    wcag: "4.1.2",
    priority: "required",
    title: "ボタンに識別できる名前がない",
    howToFix: "ボタンのテキスト、aria-label、または title でボタンの機能を示す",
  },
  "empty-heading": {
    jis: "1.3.1",
    wcag: "1.3.1",
    priority: "required",
    title: "空の見出し要素がある",
    howToFix:
      "見出しにテキストを入れるか、見出し要素をやめる（装飾目的で使わない）",
  },
  "heading-order": {
    jis: "1.3.1",
    wcag: "1.3.1",
    priority: "required",
    title: "見出しレベルが飛んでいる（大→中→小になっていない）",
    howToFix: "h1→h2→h3 の順に段階的に使う。HeadingsMap等でアウトラインを確認",
  },
  "page-has-heading-one": {
    jis: "-",
    wcag: "-",
    priority: "required",
    title: "ページにh1見出しがない（ベストプラクティス）",
    howToFix: "ページの主題を表す h1 を1つ置き、titleと揃える",
  },
  "meta-viewport": {
    jis: "1.4.4",
    wcag: "1.4.4",
    priority: "required",
    title: "ズームが禁止されている（user-scalable=no等）",
    howToFix:
      "meta viewport から user-scalable=no と maximum-scale を外し、200%拡大を可能にする",
  },
  bypass: {
    jis: "2.4.1",
    wcag: "2.4.1",
    priority: "required",
    title: "繰り返しブロックをスキップする手段がない",
    howToFix:
      "「本文へスキップ」リンクか、main等のランドマーク/見出し構造を用意する",
  },
  "frame-title": {
    jis: "2.4.1",
    wcag: "4.1.2",
    priority: "required",
    title: "frame/iframeにtitle属性がない",
    howToFix: "iframe に内容を表す title 属性を付ける",
  },
  "duplicate-id-aria": {
    jis: "4.1.1",
    wcag: "4.1.1",
    priority: "required",
    title: "ARIA参照されるIDが重複している",
    howToFix: "id属性の値をページ内で一意にする",
  },
  list: {
    jis: "1.3.1",
    wcag: "1.3.1",
    priority: "required",
    title: "ul/ol の直下にli以外の要素がある",
    howToFix: "リストの構造を正す（ul/olの直下はli, script, templateのみ）",
  },
  listitem: {
    jis: "1.3.1",
    wcag: "1.3.1",
    priority: "required",
    title: "li要素がul/olの外にある",
    howToFix: "li は ul または ol の中に置く",
  },
  "definition-list": {
    jis: "1.3.1",
    wcag: "1.3.1",
    priority: "required",
    title: "dl の構造が正しくない",
    howToFix: "dl の直下は dt/dd（とdiv）だけにする",
  },
  dlitem: {
    jis: "1.3.1",
    wcag: "1.3.1",
    priority: "required",
    title: "dt/dd が dl の外にある",
    howToFix: "dt/dd は dl の中に置く",
  },
  "link-in-text-block": {
    jis: "1.4.1",
    wcag: "1.4.1",
    priority: "required",
    title: "本文中のリンクが色だけで区別されている",
    howToFix:
      "下線を付けるか、コントラスト比3:1以上の視覚的差異を付ける（色だけで伝えない）",
  },
  "landmark-one-main": {
    jis: "-",
    wcag: "-",
    priority: "required",
    title: "main ランドマークがない（ベストプラクティス）",
    howToFix: "主要コンテンツを <main> で囲む",
  },
  region: {
    jis: "-",
    wcag: "-",
    priority: "required",
    title: "ランドマークに含まれないコンテンツがある（ベストプラクティス）",
    howToFix:
      "header/nav/main/footer 等のランドマークですべてのコンテンツを囲む",
  },
  tabindex: {
    jis: "2.4.3",
    wcag: "2.4.3",
    priority: "required",
    title: "正のtabindexが使われている",
    howToFix: "tabindex は 0 か -1 のみ使い、フォーカス順序はDOM順で制御する",
  },
  "scrollable-region-focusable": {
    jis: "2.1.1",
    wcag: "2.1.1",
    priority: "required",
    title: "スクロール領域にキーボードで到達できない",
    howToFix: 'スクロールする要素に tabindex="0" を付ける',
  },
  "frame-focusable-content": {
    jis: "2.1.1",
    wcag: "2.1.1",
    priority: "required",
    title: "tabindex=-1のframe内にフォーカス可能な要素がある",
    howToFix: "iframe の tabindex=-1 を外す",
  },

  // ---- ③個別対応 ----
  label: {
    jis: "3.3.2",
    wcag: "4.1.2",
    priority: "individual",
    title: "フォーム項目にラベルがない",
    howToFix:
      "label要素をfor属性でコントロールと関連付ける（またはaria-label）",
  },
  "select-name": {
    jis: "3.3.2",
    wcag: "4.1.2",
    priority: "individual",
    title: "select要素にアクセシブルな名前がない",
    howToFix: "label要素かaria-labelでセレクトボックスの目的を示す",
  },
  "form-field-multiple-labels": {
    jis: "3.3.2",
    wcag: "3.3.2",
    priority: "individual",
    title: "1つのフォーム項目に複数のラベルがある",
    howToFix:
      "ラベルを1つに統合する（複数labelはSRが正しく読まないことがある）",
  },
  "autocomplete-valid": {
    jis: "-",
    wcag: "1.3.5",
    priority: "individual",
    title: "autocomplete属性の値が不正（WCAG 2.1）",
    howToFix: "autocomplete に仕様どおりの値（name, email等）を指定する",
  },
  "td-headers-attr": {
    jis: "1.3.1",
    wcag: "1.3.1",
    priority: "individual",
    title: "td のheaders属性が正しくない",
    howToFix: "headers属性は同じtable内のth要素のidを参照させる",
  },
  "th-has-data-cells": {
    jis: "1.3.1",
    wcag: "1.3.1",
    priority: "individual",
    title: "見出しセルに対応するデータセルがない",
    howToFix: "th とデータセルの対応関係（scope/headers）を正す",
  },
  "video-caption": {
    jis: "1.2.2",
    wcag: "1.2.2",
    priority: "individual",
    title: "動画にキャプション（字幕）がない",
    howToFix: "track要素でキャプションを提供する",
  },
  "aria-allowed-attr": {
    jis: "4.1.2",
    wcag: "4.1.2",
    priority: "individual",
    title: "そのroleで許可されないARIA属性が使われている",
    howToFix: "要素のroleに対応したARIA属性のみ使う",
  },
  "aria-required-attr": {
    jis: "4.1.2",
    wcag: "4.1.2",
    priority: "individual",
    title: "roleに必須のARIA属性が欠けている",
    howToFix: "そのroleが要求するARIA属性（aria-checked等）を追加する",
  },
  "aria-required-children": {
    jis: "1.3.1",
    wcag: "1.3.1",
    priority: "individual",
    title: "ARIAロールに必要な子要素がない",
    howToFix:
      "role構造を仕様どおりにする（例: role=list の子は role=listitem）",
  },
  "aria-required-parent": {
    jis: "1.3.1",
    wcag: "1.3.1",
    priority: "individual",
    title: "ARIAロールに必要な親要素がない",
    howToFix:
      "role構造を仕様どおりにする（例: role=listitem の親は role=list）",
  },
  "aria-roles": {
    jis: "4.1.2",
    wcag: "4.1.2",
    priority: "individual",
    title: "不正なrole値が使われている",
    howToFix: "WAI-ARIA仕様に存在するroleのみ使う",
  },
  "aria-valid-attr": {
    jis: "4.1.2",
    wcag: "4.1.2",
    priority: "individual",
    title: "存在しないARIA属性が使われている",
    howToFix: "属性名のtypoを直す（aria-labelledby等、正しい綴りに）",
  },
  "aria-valid-attr-value": {
    jis: "4.1.2",
    wcag: "4.1.2",
    priority: "individual",
    title: "ARIA属性の値が不正",
    howToFix: "ARIA属性に仕様どおりの値を指定する（参照先IDの存在も確認）",
  },
  "aria-hidden-body": {
    jis: "4.1.2",
    wcag: "4.1.2",
    priority: "individual",
    title: "body に aria-hidden が付いている",
    howToFix:
      'body の aria-hidden="true" を削除する（ページ全体がSRから隠れる）',
  },
  "aria-hidden-focus": {
    jis: "4.1.2",
    wcag: "4.1.2",
    priority: "individual",
    title: "aria-hidden な要素の中にフォーカス可能な要素がある",
    howToFix:
      '隠した要素の中のリンク・ボタンに tabindex="-1" を付けるか、隠すのをやめる',
  },
  "aria-command-name": {
    jis: "4.1.2",
    wcag: "4.1.2",
    priority: "individual",
    title: "ARIAボタン/リンクに名前がない",
    howToFix: "aria-label か内包テキストで機能を示す",
  },
  "aria-input-field-name": {
    jis: "4.1.2",
    wcag: "4.1.2",
    priority: "individual",
    title: "ARIA入力フィールドに名前がない",
    howToFix: "aria-label か aria-labelledby で入力欄の目的を示す",
  },
  "aria-toggle-field-name": {
    jis: "4.1.2",
    wcag: "4.1.2",
    priority: "individual",
    title: "ARIAトグル項目に名前がない",
    howToFix: "aria-label か aria-labelledby で項目名を示す",
  },
  "aria-progressbar-name": {
    jis: "4.1.2",
    wcag: "4.1.2",
    priority: "individual",
    title: "プログレスバーに名前がない",
    howToFix: "aria-label で何の進捗かを示す",
  },
  "aria-tooltip-name": {
    jis: "4.1.2",
    wcag: "4.1.2",
    priority: "individual",
    title: "ツールチップに名前がない",
    howToFix: "aria-label か内包テキストで内容を示す",
  },
  "nested-interactive": {
    jis: "4.1.2",
    wcag: "4.1.2",
    priority: "individual",
    title: "対話要素が入れ子になっている",
    howToFix: "button の中に link を入れる等をやめ、対話要素は並列にする",
  },
};

/** 未知ルールのフォールバック: critical/serious は②必須、他は③個別対応 */
export function resolveJisRule(
  axeRuleId: string,
  impact: string | null | undefined,
): JisRule {
  const known = JIS_MAPPING[axeRuleId];
  if (known) return known;

  const priority: Priority =
    impact === "critical" || impact === "serious" ? "required" : "individual";
  return {
    jis: "-",
    wcag: "-",
    priority,
    title: `${axeRuleId}（axe原文のため英語。マッピング表未登録のルール）`,
    howToFix: "axe-core のドキュメントで該当ルールの修正方法を確認してください",
  };
}
