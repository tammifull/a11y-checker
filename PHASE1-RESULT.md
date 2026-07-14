# Phase 1 MVP デプロイ・動作確認結果（2026-07-14）

## 結果: 合格 ✅

公開URL: **https://a11y-checker-poc.tamiya-404.workers.dev**

| 確認項目 | 結果 |
|---------|------|
| 本番スキャン | before.html → HTTP 200、②必須 7件・③個別対応 1件・④手動確認 13件・合格 25（日本語JISマッピング済み） |
| ブラウザUI E2E | playwright-cli で URL入力→検査→4段階表示を確認。フォームはネイティブHTML（label関連付け・aria-live status） |
| JSON / PDF DL | `/api/pdf` → `%PDF-`、日本語フォント正常（豆腐なし）。JSONはクライアント側Blob |
| Turnstile | トークンなし → HTTP 400（テストキー運用中 = bot対策は実質無効） |
| SSRF拒否 | `http://127.0.0.1` → HTTP 400 |
| レート制限 | 10回/時/IP（KV `RATE_LIMIT`）。ロジックは単体テスト4本で担保 |
| テスト/型 | vitest 30本 PASS ／ tsc エラーなし |

## 構成メモ

- 設計書 §3 の Cloudflare Pages ではなく **Workers Static Assets**（単一Worker）で実装。機能は等価でリポ構成がシンプル
- 初回コールドスタート直後の1リクエストが空応答になる事象を1回観測（再現せず。継続観察）

## 残タスク（コウイチ判断待ち）

1. **プロダクト名・公開ドメイン**（design.md §10）→ 決定後: worker名変更・カスタムドメイン・本番Turnstileキー発行
2. UIデザイン磨き込み（公開告知前に1パス）
3. 命名決定までは workers.dev URL + Turnstileテストキーのまま
