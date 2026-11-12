# API仕様

## 目的

本ドキュメントは、現行実装のAPI Route Handlers（`src/app/api/**/route.ts`）の仕様を示す。

- 定義の一次情報源は `要件定義書.md` です。本ドキュメントと齟齬がある場合は要件定義書を優先してください。
- URL・命名は `用語集.md` に準拠します。
- 設計規約は `CLAUDE.md` の「API設計規約」に従う。
  - URL: 名詞複数形、ドメイン階層に沿ってネスト（例: `/api/tournaments/:id/categories/:categoryId/settings`）
  - メソッド: `GET`(取得) / `POST`(作成) / `PUT`(更新) / `DELETE`(削除)
  - レスポンス形式: 成功時 `{ data: ... }`、失敗時 `{ error: { code, message } }`
- 本書は実装をそのまま記述したものであり、サンプル・叩き台ではない。Route Handlerを変更した場合は本書も合わせて更新すること。

## 全体設計の注意点

- **一覧・詳細取得の多くはAPIのGETエンドポイントを経由しない。** 管理者向け画面（A2〜A8）はNext.jsのServer Componentであり、ページ描画時に`src/lib/mock-data.ts`の関数（`getTournaments()` / `getTournament()` / `getEnabledCategories()` / `getEntrants()` / `getMatches()` / `getStandings()` 等）を直接呼び出してデータを取得する。そのため、大会一覧・大会詳細・カテゴリ一覧・選手(チーム)一覧・試合一覧・勝敗表（順位表）を取得する専用のGET APIは存在しない。
- 参加者向け画面（P1、`/t/:tournamentId`）も同様にServer Componentであり、専用のAPIルートを介さず`src/lib/mock-data.ts`を直接呼び出す（「参加者向け（P1）」節を参照）。
- 以下にAPIとして一覧化するのは、クライアントコンポーネントからの書き込み操作（登録・更新・削除・生成）と、Excel出力・バックアップ一覧取得など、Route Handlerとして実装されている操作のみである。

## 認証

Cookieベースの簡易セッション実装（`src/lib/auth.ts`・`src/lib/require-session.ts`）を利用する（要件定義書2.1・4章セキュリティ要件）。NextAuth.js等の外部ライブラリは使用しない。

| エンドポイント | メソッド | 内容 |
|---|---|---|
| `/api/auth/login` | POST | ID・パスワードを検証し、成功時はセッションCookie（`admin_session`、`role: 'admin'`）を発行する |
| `/api/auth/view-login` | POST | ID・パスワードなしで、閲覧モード（`role: 'viewer'`）のセッションCookieを発行する |
| `/api/auth/logout` | POST | セッションを破棄しCookieを削除する。`role: 'admin'`のセッションかつリクエストボディで`createBackup: true`が指定された場合のみ、ログアウト前に手動バックアップと同じ処理（`trigger: 'ログアウト'`）を実行する |
| `/api/auth/credentials` | PUT | ログインID・パスワードの変更。未ログイン状態からも呼び出せるよう、セッションの代わりにリクエストボディの現在のID・パスワード（`currentId`・`currentPassword`）の一致を本人確認として検証する。新しいパスワード（`password`）は8文字未満の場合`400 VALIDATION_ERROR`。本人確認に失敗した場合は`401 INVALID_CREDENTIALS` |

### セッションCookie

- Cookie名: `admin_session`
- 属性: `httpOnly: true`, `sameSite: 'lax'`, `path: '/'`, `maxAge: 604800`（7日）
- セッション本体（トークン・ロール）はCookieの値ではなく、ストア側の`store.session`（`{ token, role }`）に保持する。Cookieにはトークン文字列のみを保持し、リクエストごとにストアの`session.token`と照合する

### 認可ガード関数（`src/lib/require-session.ts`）

| 関数 | 用途 | 挙動 |
|---|---|---|
| `requireSession()` | 参照系（閲覧モードでも許可してよい）操作の先頭で呼ぶ | セッションが無効なら`401 UNAUTHORIZED`を返す。`role`は問わない |
| `requireWriteSession()` | 登録・編集・削除・生成・バックアップ作成/復元など書き込み系操作の先頭で呼ぶ | セッションが無効なら`401 UNAUTHORIZED`、`role !== 'admin'`（閲覧モード）なら`403 FORBIDDEN`を返す |
| `getSessionRole()` | Server Componentから現在のセッション種別を取得する | 閲覧モード時にUIの書き込み系操作を非表示/disabledにするために使う（API Route Handlerではなく画面側で使用） |

下記エンドポイント一覧の「認可」列は、どちらのガード関数を使っているかを示す。

## 共通仕様

### レスポンス形式

成功時:
```json
{ "data": { "...": "..." } }
```

失敗時:
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "大会名・開催日・開催場所・カテゴリAは必須です" } }
```

ページネーション（`?page=&pageSize=`）は、一覧系がServer Component直読みでAPI化されていないため、現行の書き込み系エンドポイントでは使用していない。

### エラーコード一覧（実装に存在するもの）

| code | HTTPステータス | 内容 |
|---|---|---|
| `UNAUTHORIZED` | 401 | 未ログイン（`requireSession()` / `requireWriteSession()`共通） |
| `FORBIDDEN` | 403 | 閲覧モードでの書き込み操作拒否（`requireWriteSession()`） |
| `INVALID_CREDENTIALS` | 401 | ID・パスワードの不一致（ログイン・ログイン情報変更） |
| `VALIDATION_ERROR` | 400 | 必須項目未入力、または値の範囲・形式が不正 |
| `NOT_FOUND` | 404 | 対象リソースが存在しない |
| `TOURNAMENT_FINISHED` | 409 | 「大会が終了しているため変更できません」（要件定義書2.1） |
| `HAS_RESULTS` / `HAS_RESULT` | 409 | 「試合結果が登録されているため変更できません」（要件定義書3.2・3.3。競技情報側は`HAS_RESULTS`、選手(チーム)側は`HAS_RESULT`で名称が異なる） |
| `EXPORT_FAILED` | 500 | Excel出力処理中の例外 |

上記以外に、`updateCategorySettings()` / `createEntrant()` / `updateEntrant()` / `deleteEntrant()`は内部的に`ok: false`＋エラーコード文字列を返し、各route.tsがコードごとのHTTPステータスへマッピングしている（コードと詳細メッセージは実装依存）。

## エンドポイント一覧

### 大会（tournaments）

| メソッド | パス | 認可 | 内容 |
|---|---|---|---|
| POST | `/api/tournaments` | 書き込み | 大会を新規作成する（要件定義書3.1）。`name` / `date` / `location` / `categories`（`{key, name}`の配列。カテゴリA相当が最低1件）が必須。`name` / `location`は1〜50文字、各カテゴリ名は1〜25文字、カテゴリ名は配列内で重複不可（`validateTournamentInput()`で検証、違反時は`400 VALIDATION_ERROR`）。成功時`201`で作成した`Tournament`を返す |
| PUT | `/api/tournaments/:id` | 書き込み | 大会情報（大会名・開催日・開催場所・カテゴリA〜Jの名称/有効無効）を更新する。対象が存在しない場合`404 NOT_FOUND`、ステータス「終了」の場合は`409 TOURNAMENT_FINISHED`。文字数上限・カテゴリ名重複の検証はPOST同様（有効化されているカテゴリのみが対象、違反時は`400 VALIDATION_ERROR`）。カテゴリを無効化した場合、紐づく選手(チーム)登録や試合結果があるとそのカテゴリの無効化はサーバー側で無視される |
| DELETE | `/api/tournaments/:id` | 書き込み | 大会を削除する（カスケード削除、要件定義書2.1） |
| PUT | `/api/tournaments/:id/status` | 書き込み | ステータス切替（`'進行中'` ⇄ `'終了'`）。リクエストボディ`{ status }`の値が`'進行中'`/`'終了'`以外の場合は`400 VALIDATION_ERROR` |

大会一覧・大会詳細の取得は、A2・A3画面のServer Componentが`getTournaments()` / `getTournament()`を直接呼び出すため、対応するGET APIは存在しない。

**既知の未検証事項**: カテゴリA（必須カテゴリ）そのものの存在は、サーバー側では「カテゴリが1件以上存在すること」のみを検証し、どのキーかは問わない。カテゴリAの必須入力は、フォーム側でチェックボックスを表示せず常に有効のまま送信することで担保している（`NewTournamentForm`）。

### 競技情報（categories）

| メソッド | パス | 認可 | 内容 |
|---|---|---|---|
| PUT | `/api/tournaments/:id/categories/:categoryId/settings` | 書き込み | 競技情報（セット数・順位決定方式・勝点・コート数・1コート最大選手(チーム)数・リーグ形式）を更新する（要件定義書3.2）。対象が存在しない場合`404 NOT_FOUND`、大会終了中は`409 TOURNAMENT_FINISHED`、試合結果登録済みは`409 HAS_RESULTS`、数値範囲等が不正な場合は`400 VALIDATION_ERROR` |

カテゴリの新規作成・削除・一覧取得専用のエンドポイントは存在しない。カテゴリA〜Jは大会作成・更新時に`POST /api/tournaments`・`PUT /api/tournaments/:id`で一括登録・一括無効化（＝実質的な削除）する。

### 選手(チーム)（entrants）

| メソッド | パス | 認可 | 内容 |
|---|---|---|---|
| POST | `/api/tournaments/:id/entrants` | 書き込み | 選手(チーム)の新規登録（要件定義書3.3）。`categoryId` / `name` / `affiliation`（任意） / `courtSelection`（任意） / `courtNumber`（任意）を受け取る |
| PUT | `/api/tournaments/:id/entrants/:entrantId` | 書き込み | 選手(チーム)情報の編集（同上の項目） |
| DELETE | `/api/tournaments/:id/entrants/:entrantId` | 書き込み | 選手(チーム)の削除 |

いずれも`src/lib/mock-data.ts`の`createEntrant()` / `updateEntrant()` / `deleteEntrant()`が、名称の長さ（`name`は1〜10文字、`affiliation`は10文字以内）・同一カテゴリ内の重複（`src/lib/entrant-validation.ts`の`validateEntrantAgainst()`）・コート人数上限・試合結果登録済みによるブロック等を検証し、`{ ok: false, code, message }`を返した場合はroute.ts側で`NOT_FOUND`→404、`TOURNAMENT_FINISHED`→409、`HAS_RESULT`→409、`VALIDATION_ERROR`→400にマッピングする。

選手(チーム)一覧の取得は、A5画面のServer Componentが`getEntrants()`を直接呼び出すため、対応するGET APIは存在しない。

### 自動生成（generate）

| メソッド | パス | 認可 | 内容 |
|---|---|---|---|
| POST | `/api/tournaments/:id/generate` | 書き込み | リーグ表・試合順・審判順を一括生成/再生成する（要件定義書3.4〜3.6）。対象大会がステータス「終了」の場合は`409 TOURNAMENT_FINISHED`。リクエストボディを省略、または`{ targets: [] }`の場合は大会内の全有効カテゴリが対象。`{ targets: [{ categoryId }, ...] }`を指定した場合はそのカテゴリのみが対象。ボディが省略（空）ではなく、かつJSONとして解釈できない場合は、選択していないカテゴリまで誤って全生成してしまうことを防ぐため、`400 VALIDATION_ERROR`を返す（全カテゴリ生成へのフォールバックはボディ省略時のみ） |

レスポンス例:
```json
{
  "data": {
    "generatedCategoryKeys": ["A", "C"],
    "skipped": [
      { "categoryKey": "B", "categoryName": "初級", "reason": "参加選手(チーム)数が2名未満です" }
    ]
  }
}
```

`skipped`の`reason`は固定のエラーコードではなく、画面にそのまま表示する日本語の説明文字列である（例: 参加人数不足、コート毎の人数超過など。要件定義書3.4の各エラー条件に対応）。

### 試合結果（matches）

| メソッド | パス | 認可 | 内容 |
|---|---|---|---|
| PUT | `/api/tournaments/:id/categories/:categoryId/matches/:matchId` | 書き込み | 1試合分のセットスコアを保存し、該当コート（単一リーグの場合はカテゴリ全体）の勝敗表（順位表）を自動再集計する（要件定義書3.7・3.8）。対象の大会・競技情報が存在しない場合は`404 NOT_FOUND`、対象大会がステータス「終了」の場合は`409 TOURNAMENT_FINISHED`、指定した`matchId`の試合が存在しない場合も`404 NOT_FOUND` |

リクエストボディ:
```json
{ "sets": [{ "scoreA": 25, "scoreB": 20 }, { "scoreA": 25, "scoreB": 18 }] }
```

- `sets`は配列であることが必須（配列でない場合`400 VALIDATION_ERROR`）。各セットの`scoreA` / `scoreB`は`null`（未入力）または0〜999の数値。範囲外の場合は`400 VALIDATION_ERROR`
- レスポンスは更新後の`Match`（`data`）そのもの。再集計された勝敗表は`store.standings`へ保存されるのみでレスポンスボディには含まれない（画面側は保存後に再取得する）

試合一覧の取得は、A6画面のServer Componentが`getMatches()` / `getCategoryMatches()`を直接呼び出すため、対応するGET APIは存在しない。

### じゃんけん結果の反映（standings）

| メソッド | パス | 認可 | 内容 |
|---|---|---|---|
| PUT | `/api/tournaments/:id/categories/:categoryId/standings/janken` | 書き込み | 直接対決でも決着しない3者以上のタイについて、じゃんけん（システム外）の結果を最終順位へ反映する（要件定義書3.8）。対象の大会・競技情報が存在しない場合は`404 NOT_FOUND`、対象大会がステータス「終了」の場合は`409 TOURNAMENT_FINISHED` |

リクエストボディ:
```json
{ "court": 1, "ranks": [{ "entrantId": "entrant-xxx", "rank": 2 }, { "entrantId": "entrant-yyy", "rank": 3 }] }
```

- `court`は数値、`ranks`は1件以上の配列であることが必須（`400 VALIDATION_ERROR`）
- `ranks`に指定した各`entrantId`は、指定したコート（単一リーグは`court: 0`）の勝敗表で`jankenPending: true`になっている行でなければならない（存在しない・重複・`jankenPending`でない行を含む場合は`400 VALIDATION_ERROR`）。ただし、タイしている組の行をすべて含んでいるかどうかまでは検証しない（一部の選手(チーム)のみを指定した呼び出しも成功しうる）
- 指定した順位は、対象とした行の中で、その中の最小順位を起点とした重複のない連番でなければならない（範囲外・重複がある場合は`400 VALIDATION_ERROR`）
- 成功時レスポンスは`{ "data": { "ok": true } }`のみ（更新後の勝敗表はレスポンスに含まれない）

勝敗表（順位表）そのものの取得は、A6画面のServer Componentが`getStandings()`を直接呼び出すため、対応するGET APIは存在しない。

### データ出力（export）

| メソッド | パス | 認可 | 内容 |
|---|---|---|---|
| GET | `/api/tournaments/:id/export/xlsx` | 参照（`requireSession()`。閲覧モードでも実行可） | 大会全体のデータをExcel（.xlsx）としてまとめて出力する（要件定義書3.9） |

- レスポンスはバイナリ（`Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`）。ファイル名は`Content-Disposition: attachment; filename*=UTF-8''...`ヘッダーで指定する
- ファイル名の形式: `リーグ戦しようよ_${大会名（記号はアンダースコアに置換）}_${YYYYMMDD}.xlsx`
- シート構成: 「大会情報」「競技情報」「選手(チーム)」の3シートに続けて、生成済み（`generationStatus: '生成済み'`）のカテゴリごとに1シート（独立リーグかつコート数2以上の場合はさらにコートごとに1シート）。リーグ表・勝敗表はテキスト表ではなくPNG画像として埋め込む（`src/lib/league-image.ts`の`renderLeagueTableImage()`。日本語フォントはIPAGothicを同梱）
- 対象大会が存在しない場合は`404 NOT_FOUND`、生成処理中の例外は`500 EXPORT_FAILED`

### 参加者向け（P1）

参加者向け画面（P1、`/t/:tournamentId`）専用のAPIルートは存在しない。`src/app/(public)/t/[tournamentId]/page.tsx`がServer Componentとして、`getTournament()` / `getEnabledCategories()` / `getEntrants()` / `getMatches()` / `getCategoryMatches()` / `getStandings()` / `sortByDisplayOrder()`を直接呼び出し、大会内全カテゴリ（コート単位、単一リーグはカテゴリ全体で1つ）の選手(チーム)一覧・試合結果・勝敗表をページ描画時に組み立てる。ログイン不要で、認可ガード（`requireSession()`等）は呼び出さない。

### バックアップ・リストア（backups）

| メソッド | パス | 認可 | 内容 |
|---|---|---|---|
| GET | `/api/backups` | 参照（`requireSession()`。閲覧モードでも実行可） | バックアップ履歴一覧（`BackupRecord[]`）を取得する |
| POST | `/api/backups` | 書き込み | 今すぐバックアップ（手動、`trigger: '手動'`）を実行する。成功時`201`で作成した`BackupRecord`を返す |
| POST | `/api/backups/restore` | 書き込み | リクエストボディ`{ backupId }`で指定した既存バックアップのJSONファイルで、業務データ（大会・競技情報・選手(チーム)・試合・勝敗表）一式を上書き復元する。認証情報・現在のセッション・バックアップ履歴一覧自体は復元の対象外（復元後も維持される） |

`GET /api/backups`に期間絞り込み（`?dateFrom=&dateTo=`）のクエリパラメータは実装されていない（画面側（A8）でフィルタする場合はクライアント側でのみ絞り込む）。個別バックアップファイルのダウンロード専用エンドポイントは提供しない。

レスポンス例（`GET /api/backups`）:
```json
{
  "data": [
    { "id": "bk-7d4e...", "createdAt": "2026-11-09T09:00:00.000Z", "trigger": "ログアウト" }
  ]
}
```
