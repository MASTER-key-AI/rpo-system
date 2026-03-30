# GAS Inbound 連携手順（Advanced Gmail API版）

## 概要
- 目的: GmailのIndeed応募通知を構造化し、`/api/inbound/indeed` に転送してD1へ登録する。
- 実装方式: Apps Script（Advanced Gmail API + `UrlFetchApp`）。
- GCPの追加サービス（Cloud Run/PubSub/Secret Manager等）は使用しない。
- ただし Apps Script の Advanced Google services で Gmail API を有効化する必要がある。

## 使用ファイル
- GAS本体: `/Users/asyuyukiume/Projects/RPO_24CS/applier_trans.gs`
- 受信API: `/Users/asyuyukiume/Projects/RPO_24CS/my-project/rpo-app/src/app/api/inbound/indeed/route.ts`

## Apps Script プロジェクト
- URL: https://script.google.com/home/projects/1TyG8KbfpozlrhubsNm-jFwpRNhH7B6XZlA_XdCshdUv3Z5fbmumCWr5x/edit

## Apps Script 側の必須 Script Properties
- `RPO_INBOUND_URL`
  - 例: `https://<workers-url>/api/inbound/indeed`
  - 互換: 旧 `RPO_API_URL` も読み取り可（推奨は `RPO_INBOUND_URL`）
- `RPO_API_KEY`
  - Cloudflare側 `INBOUND_API_KEY` と同じ値

## 事前設定（必須）
1. Apps Script エディタ -> `サービス` から `Gmail API` を追加（Advanced Google services）
2. 初回実行時の権限承認で Gmail 読み取りと外部通信を許可

## 実装時点の固定値
- `newer_than:7d`（過去7日）
- `pageSize:100`

## 運用ラベル
- `Indeed応募一覧/PROCESSED`
- `Indeed応募一覧/PARSE_ERROR`
- `Indeed応募一覧/API_ERROR`

## 実行順序
1. `dryRun()` を手動実行
2. ログで抽出内容（name/company/job/location/email）を確認
3. `run()` を手動実行
4. RPOアプリ側で応募者登録を確認
5. 同一メールを再実行して重複登録されないことを確認（`gmailMessageId` で冪等）
6. 時間トリガー（5分ごと推奨）を設定

## 新デプロイ先へ切替する手順（最新応募者の追いつき転記）
1. Script Properties の `RPO_INBOUND_URL` を新デプロイ先に変更する  
   例: `https://rpo-app.spring-fog-fefa.workers.dev/api/inbound/indeed`
2. Script Properties の `RPO_API_KEY` を新デプロイ先の `INBOUND_API_KEY` と一致させる
3. `dryRunCatchUpToNewDeploy()` を実行して対象件数を確認する
4. `runCatchUpToNewDeploy()` を実行する  
   - 直近30日を対象
   - `PROCESSED` ラベル付きメールも再送対象
   - `PARSE_ERROR` / `API_ERROR` は除外
5. 期間を増やす場合は `runCatchUpDays(60)` のように実行する
6. 追いつき転記後は通常運用として `run()` の時間トリガーに戻す

### 補足
- 同一環境内では `gmailMessageId` で冪等に処理されるため、再実行しても重複登録されにくい設計。
- 既存ログで `Found threads: 0` になる場合は、対象期間を広げて `dryRunCatchUpDays(30)` 以上で確認する。

## 失敗時の再処理
- `PARSE_ERROR`
  - メール本文フォーマット差異。パーサー修正が必要。
- `API_ERROR`
  - APIキー不一致 / API停止 / 一時通信失敗など。
  - 復旧後、`dryRunRetryApiErrorAfterFix()` -> `runRetryApiErrorAfterFix()` の順で再処理。
  - 期間を広げる場合は `runRetryApiErrorDays(60)` のように実行。

### `401 Invalid API key` が出た場合の最短対応
1. Cloudflare 側の `INBOUND_API_KEY` の現在値を確認
2. Apps Script の `RPO_API_KEY` を同じ値に更新
3. `dryRunRetryApiErrorAfterFix()` を実行して対象件数を確認
4. `runRetryApiErrorAfterFix()` を実行して再送

## セキュリティ
- API認証は `x-rpo-api-key` ヘッダーで実施。
- `RPO_API_KEY` は Script Properties にのみ保存し、コード直書きしない。
