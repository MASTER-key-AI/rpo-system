# RPO App

Cloudflare Workers + Next.js(App Router) + D1 で動く採用管理アプリです。

## ローカル起動（推奨）

```bash
npm install
npm run dev:local
```

`dev:local` は以下をまとめて実行します。

1. `wrangler d1 migrations apply rpo-db --local --config wrangler.jsonc`
2. `next dev`

## 手動起動

```bash
npm run db:migrate:local
npm run dev
```

## 一時運用仕様（ログイン撤廃中）

- 認証は一時停止中です。`/login` と `/admin` は `/applicants` へリダイレクトされます。
- `/api/auth/*` は `404` を返します。
- 架電ログ作成者は暫定ユーザーで記録されます。

以下の環境変数で暫定ユーザーを変更できます（未設定時はデフォルト値を使用）。

- `DEV_ACTOR_ID`
- `DEV_ACTOR_NAME`
- `DEV_ACTOR_EMAIL`

## GAS連携（Inbound API）

`/api/inbound/indeed` は API キー必須です。

- ヘッダー: `x-rpo-api-key`
- サーバー側環境変数: `INBOUND_API_KEY`
- GASプロジェクトURL: https://script.google.com/home/projects/1TyG8KbfpozlrhubsNm-jFwpRNhH7B6XZlA_XdCshdUv3Z5fbmumCWr5x/edit

## よく使うコマンド

```bash
npm run typecheck
npm run lint
npm run build
npm run preview
npm run deploy
```
