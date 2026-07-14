# Phase 0 PoC 動作確認結果（2026-07-14）

## 結果: 合格 ✅

`wrangler dev --remote`（doggo-company アカウント / Workers Paid / Browser Rendering）で確認。

| 確認項目 | 結果 |
|---------|------|
| 実サイトスキャン | `https://www.washington.edu/accesscomputing/AU/before.html` → HTTP 200、violations **8件**（image-alt/label = critical、color-contrast/html-has-lang/link-in-text-block = serious ほか）、passesCount 25 |
| axe-core 注入・実行 | axeVersion **4.12.1**、エラーなし |
| SSRF 拒否 | `http://127.0.0.1` → HTTP 400 `プライベートIPは検査できません` |

## 詰まった点（2件、いずれも解決済み）

1. **evaluate 内での import 参照**: `page.evaluate(() => axe.run(...))` の `axe` がバンドラにモジュール参照（`import_axe_core`）へ書き換えられ、ページ内で未定義に。→ 注入済みの `window.axe` を参照する形に変更。
2. **addScriptTag が効かない + `__name` 混入**: `addScriptTag({content: axe.source})` では `window.axe` が定義されなかった。さらに wrangler(esbuild) の keepNames により `axe.source`（`Function.toString()` 由来）に `__name()` 呼び出しが混入し `ReferenceError: __name is not defined`。→ ページ側に `window.__name = (t, n) => t` のシムを先に定義し、`page.evaluate(axe.source)` で直接評価する方式に変更（プランの想定トラブル1の代替策どおり）。

## メモ

- アカウントは personal ではなく doggo-company 側（`account_id` を wrangler.toml に固定済み）
- スキャン所要時間は1リクエストあたり体感 5〜10 秒程度
- Phase 1 へ進んで問題なし
