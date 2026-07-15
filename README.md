# a11y-checker — ウェブアクセシビリティチェックツール

URL を入力するだけで、ページのアクセシビリティを **JIS X 8341-3:2016（WCAG 2.0）準拠**の日本語・優先度4段階で検査する無料ツール。デジタル庁「ウェブアクセシビリティ導入ガイドブック」の考え方に準拠。

- 本番: <https://a11y-checker.doggo-company.com>
- 検査エンジン: [axe-core](https://github.com/dequelabs/axe-core)（Cloudflare Browser Rendering 上で実行）
- 診断結果は「🤖 AI用にコピー」でそのまま生成AIに修正を依頼できる
- 登録不要・結果はサーバーに保存しない（レート制限カウンタのみ1時間で自動失効）

## 機能

- **axe-core 自動検査** → JIS X 8341-3:2016 の達成基準にマッピングし、優先度4段階（重大 / 必須 / 個別 / 手動確認）で表示
- **AIアシスト検査（β・任意）** — Claude (haiku) がテキスト所見（リンク文言・読み上げ順序）を下書き
- **視覚系AIレビュー（β・任意）** — ファーストビューのスクリーンショットを Claude vision に渡し、色依存・画像内テキスト・文字の視認性を所見化（静止画で判断できる範囲に限定）
- **PDF / JSON レポート出力**、**AI用プロンプトのコピー**
- UI 自身がデジタル庁デザインシステム(DADS)のカラー基準に準拠

> 注意: 自動チェックで判定できるのは WCAG 達成基準の 2〜3 割です。本ツールの結果は JIS X 8341-3:2016 適合の証明ではありません。正式な試験は人の確認が必要です。

## 技術構成

Cloudflare Workers（TypeScript）。`@cloudflare/puppeteer`（Browser Rendering）でページを開き axe-core を注入して実行。フロントは `public/` の静的アセット。

- `src/scan.ts` — ページを開いて axe-core 実行＋抽出＋スクショ
- `src/report.ts` / `src/jis-mapping.ts` — 結果を JIS マッピングして優先度レポート化
- `src/ai-review.ts` — Claude によるテキスト＋視覚レビュー
- `src/rpc.ts` — service binding（他 Worker から RPC で呼ぶ用の `ScanRpc`）

## セルフホスト（clone して自分の環境で動かす）

**前提**: Node.js、Cloudflare アカウント（**Browser Rendering が使える有料プラン**）、[Anthropic API キー](https://console.anthropic.com/)、[Cloudflare Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile) のサイト。

```bash
git clone https://github.com/tammifull/a11y-checker.git
cd a11y-checker
npm install
wrangler login   # 自分の Cloudflare アカウントにログイン
```

### 1. KV ネームスペースを作る

```bash
wrangler kv namespace create RATE_LIMIT
```

出力された `id` を `wrangler.toml` の `[[kv_namespaces]]` に貼り替える。

### 2. Turnstile を設定

Cloudflare ダッシュボードで Turnstile サイトを作成し、**サイトキー**を `wrangler.toml` の `[vars] TURNSTILE_SITE_KEY` に、**シークレット**を後述の secret に設定する。

### 3. ドメイン/ルート

`wrangler.toml` の `routes`（`a11y-checker.doggo-company.com`）は作者の本番ドメインです。**自分のドメインに変更するか、行ごと削除**してください（削除すると `*.workers.dev` で配信されます）。

### 4. シークレットを登録

```bash
cp .dev.vars.example .dev.vars   # ローカル開発用（値を入れる／.dev.vars は git 管理外）
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put TURNSTILE_SECRET
```

### 5. 開発・デプロイ

```bash
npx vitest run     # ユニットテスト
npx wrangler dev   # ローカル
npx wrangler deploy
```

## ライセンス

[MIT](./LICENSE)
