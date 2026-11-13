# CLAUDE.md

このファイルは、本リポジトリでコードを書くAIエージェント（Claude Code）および開発者向けのガイドです。

## プロジェクト概要

**リーグ戦しようよ**（スポーツリーグ管理システム。大会ごとの名称は利用者が個別に設定する）

背景・目的の詳細は `docs/要件定義書.md` の「1. システム概要」を参照してください。

要件の一次情報源は `docs/要件定義書.md` です。本ファイルとの間に齟齬がある場合は **要件定義書を優先** してください。要件定義書に書かれていない仕様を推測で補わず、不明点はユーザーに確認してください。

## 現在の状態（重要）

- 画面構成・画面遷移の確認を目的として、Next.js（App Router）+ TypeScript + Tailwind CSS + shadcn/ui による画面実装が存在します（`src/`配下）。全画面はA1〜A8・P1に対応します。
- **コアロジックは実装済み**です（ファイルベースのJSONストアの上で動作します。本ストアは暫定実装ではなく、本番の正式なデータ永続化方式として確定しています）。
  - リーグ表・試合順（円卓法）・審判順の自動生成：`src/lib/scheduling.ts`。競技情報の「リーグ形式」設定（独立リーグ／単一リーグ、デフォルト独立リーグ）に応じて、コート毎の独立リーグ（`generateRoundRobinOrder`/`assignReferees`）と、複数コートにまたがる単一リーグ（`scheduleSingleLeagueMatches`/`assignRefereesForSingleLeague`）の2方式を切り替える。審判を割り当てられない場合は画面側で赤字「運営スタッフ」と表示する
  - 順位自動計算（タイ時のミニリーグ再集計・じゃんけん待ち判定含む）：`src/lib/ranking.ts`
  - データアクセス・生成/結果保存の制御関数：`src/lib/mock-data.ts`（`.gitignore`対象の`.data/store.json`をファイルDBとして読み書きする簡易実装。Next.jsのRoute HandlerとServer Componentでモジュールインスタンスが分かれる場合があり、モジュール変数だけでは状態を共有できないための対策）
  - 上記を呼び出すAPI Route Handlers：`src/app/api/tournaments/[tournamentId]/...`
- **認証・セッション・バックアップ/リストア・データ出力（Excel）も実装済み**です。
  - 認証：Cookieベースのセッション実装（`src/lib/auth.ts`、`src/lib/require-session.ts`）。パスワードはbcryptjsでハッシュ化（ネイティブビルド回避のためbcryptではなくbcryptjsを採用。本番方式として確定）。管理者ID・パスワードはA1ログイン画面のダイアログから変更できる（未ログイン状態でも現在のID・パスワードの入力を本人確認として実行可能）
  - バックアップ/リストア：全テーブルをJSONエクスポートし、OS標準のユーザーデータディレクトリ配下（`LEAGUE_TABLE_DATA_DIR`環境変数で指定。未設定時は`.gitignore`対象のローカルディレクトリ）に保存する実装（`src/lib/backup.ts`）。本番方式として確定しており、クラウドストレージへの置き換えは行わない
  - データ出力：exceljsで大会全体のデータを1つのExcel（.xlsx）ファイルにまとめて出力する実装済み（`src/lib/export.ts`）。PDF（Puppeteer）・CSV出力は廃止した
  - 閲覧モード：A1ログイン画面に、ID・パスワードなしで入れる「閲覧モードで見る」ボタンを用意している。閲覧モードのセッション（`role: 'viewer'`）は、登録・編集・削除・生成・バックアップ作成/復元などの書き込み系API（`requireWriteSession`でガード）をすべて403で拒否し、対応するUIのボタンもdisabledにする
- **データ出力（A7）・参加者向け閲覧URL表示は、現在一旦保留（コメントアウト）中**です。共通ヘッダーの「データ出力」ボタン（`src/components/admin/AdminHeader.tsx`）と大会名ヘッダーの参加者向けURL表示（`src/components/tournaments/TournamentHeaderBlock.tsx`）をコメントアウトして入口を非表示にしているだけで、A7画面・P1画面・該当API自体は削除していない（直接URLを叩けば動作する）。再度有効化する場合は該当コメントを外すこと
- **単体テスト（Vitest）はコアロジックに対して実装済み**です。`src/lib/scheduling.test.ts`・`src/lib/ranking.test.ts`・`src/lib/league-matrix.test.ts`・`src/lib/mock-data.test.ts`（バリデーション純粋関数）。`docs/ユニットテスト.md`のテストケースに対応する（本書内の仮称と実関数名の対応表は同ドキュメント内に記載）。React Testing Libraryを用いたコンポーネント単体テストは未着手
- **結合テスト（Playwright）はAPI Routes・画面間連携に対して実装済み**です。`tests/integration/*.spec.ts`（開発サーバーに対して実際の画面操作・API呼び出しを行う）。`docs/結合テスト.md`のテストケースに対応する
- **E2Eテストスイート（Playwright）は主要フローに対して実装済み**です。`tests/e2e/*.spec.ts`（`playwright.e2e.config.ts`、開発サーバーをポート3600で自動起動。結合テストとはポート・設定ファイルを分け、事前ログイン済みのstorageStateを使わずログイン自体をシナリオの一部として検証する）。`docs/E2Eテスト.md`の4シナリオ（ハッピーパス／じゃんけん確定／大会終了後の閲覧専用化／参加者向け画面）に対応する
- **Electronによるデスクトップアプリ化は実装済み**です。`electron/main.ts`・`electron/server.ts`がNext.jsサーバー（`next start`）をElectron同梱のNodeランタイム上でutilityProcess.forkにより起動し（システムへのNode.js事前インストールは不要）、起動確認後にBrowserWindowを表示する。データ保存先は、同一PC内の複数OSユーザー間でデータを共有できるよう、per-userな`app.getPath('userData')`ではなくマシン単位の共有ディレクトリを使う（`electron/main.ts`の`resolveSharedDataDir()`。Windows: `%ProgramData%\<productName>`、mac: `/Library/Application Support/<productName>`、配布対象外のOS（開発コンテナ等）では従来通り`app.getPath('userData')`にフォールバック）。旧バージョン（`userData`配下）にデータが残っている場合は、起動時に`migrateLegacyDataDirIfNeeded()`が一度だけ共有ディレクトリへコピーする。macOSは`/Library/Application Support`が既定で管理者グループのみ書き込み可のため、**初回起動は管理者権限のあるアカウントで行う必要がある**（非管理者アカウントでの初回起動は共有フォルダ作成に失敗し、エラーダイアログを表示して終了する）。Windowsの`ProgramData`は標準ユーザーでも書き込み可能なためこの制約はない。`npm run electron:dev`で開発確認、`npm run electron:build`でパッケージングできる（electron-builder、`package.json`の`build`設定参照）。macOS/Windows向け配布物（`.dmg`/`.exe`）は、この開発コンテナ（Linux）では生成できないため、GitHub Actions（`.github/workflows/electron-build.yml`、`v*`タグpushまたは手動実行）でビルドする。Apple Developer Program等の正式な署名は行っておらず、macOSビルドはアドホック署名（`package.json`の`build.mac.identity: "-"`）のみ付与している（未署名のまま配布するとApple Silicon上で「壊れているため開けません」という誤解を招くエラーで起動自体ができないため）。それでもGatekeeperの検疫属性（quarantine）が付いた状態でダウンロードした場合は初回起動時に警告が出るため、利用者向けに`xattr -cr`での検疫属性解除または右クリック→「開く」の案内が別途必要。Windows版はNSISインストーラーを`oneClick: false`・`perMachine: true`（インストール先フォルダ選択可能なウィザード形式、`Program Files`配下への全ユーザー共通インストール。要管理者権限）にしているが、署名していないため初回起動時にSmartScreenの警告（「詳細情報」→「実行」で回避）が出る。この案内は未整備
- **以下は未実装**です（実装時は別途対応すること）。
  - React Testing Libraryによるコンポーネント単体テスト
- クラウドDB（Prisma/PostgreSQL）・NextAuth.js化・クラウドストレージへのバックアップ保存は**行わない方針として確定**しています（ファイルベースストア・Cookieセッション・ローカルバックアップが本番アーキテクチャです。大会当日、インターネット接続の有無に関わらず運営者のPC1台だけで完結して動作することを優先したため）。`docs/データベース仕様.md`・`docs/API仕様.md`は、当初はクラウド移行の叩き台として作成されたが、現在はこのファイルベースストア・Route Handlers実装を正確に記述した現行仕様書として全面的に書き直し済みです
- 技術スタックは**決定済み**です。詳細は下記「技術スタック」セクションを参照してください。
- 実行コマンド: `npm run dev`（開発サーバー）/ `npm run build`（本番ビルド）/ `npm run lint`（ESLint）/ `npm test`（Vitest単体テスト）/ `npm run test:integration`（Playwright結合テスト。開発サーバーをポート3500で自動起動する）/ `npm run test:e2e`（PlaywrightE2Eテスト。開発サーバーをポート3600で自動起動する）。Node.jsは22.x（`.nvmrc`参照）。
- Electron関連コマンド: `npm run electron:dev`（Next開発サーバー起動後、Electronウィンドウを開く）/ `npm run electron:build`（現在のホストOS向けにパッケージング。事前に`npm run build`を実行）/ `npm run electron:build:mac` ・ `npm run electron:build:win`（OS別ターゲット指定。実際のmacOS/Windows向け配布物は各OSまたはCI上でのビルドが必要。詳細は`electron/`配下および`package.json`の`build`設定を参照）
- Gitリポジトリとして初期化済みです（詳細は下記「Gitワークフロー」セクションを参照）。

## 技術スタック

大会当日、インターネット接続の有無に関わらず運営者のPC1台だけで完結して動作する構成として、以下を採用する。

| 領域 | 採用技術 |
|---|---|
| フロントエンド | Next.js (React + TypeScript) |
| バックエンド | Next.js API Routes (Node.js) |
| DB | ファイルベースJSONストア（`.data/store.json`。Electron配布時はOS標準のユーザーデータディレクトリ配下に保存） |
| 認証 | Cookieベースの簡易セッション実装（`src/lib/auth.ts`）。パスワードはbcryptjsでハッシュ化しJSONストアへ保存。単一PCでのオフライン動作が前提のためHTTPS通信は必須としない |
| データ出力 | exceljs（大会全体のデータを1つのExcel（.xlsx）ファイルにまとめて出力する） |
| ホスティング | Electronによるデスクトップアプリ配布（macOS/Windows）。アプリ内でNext.jsサーバーを起動し、BrowserWindowで表示する |
| パッケージング | Electron + electron-builder |
| Router | Next.js App Router（`src/app/`） |
| TypeScript | `tsconfig.json` で `strict: true` を有効化 |
| パッケージ管理 | npm |
| Node.js | 22.x (LTS)。`.nvmrc` および `package.json` の `engines` で固定 |
| UI | Tailwind CSS + shadcn/ui |
| テスト（単体） | Vitest（+ React Testing Libraryは未着手。コンポーネント単体テストが必要になった時点で導入） |
| テスト（結合・E2E） | Playwright（開発サーバーに対して実施する。ファイルベースストアを本番方式として確定したため、結合テストは今後もPlaywrightで行う） |
| 日付/タイムゾーン | date-fns（+ `date-fns/locale/ja`）。ストアはUTC保存、アプリ層でAsia/Tokyoに変換して表示 |
| フォーム/バリデーション | React Hook Form + Zod |

### テスト方針

- 単体テスト（Vitest）は、特にリーグ表自動生成・試合順自動生成・審判順自動生成・順位決定ロジックなど「コアロジック」セクションに該当する、間違えやすい機能を重点的にカバーする（`src/lib/*.test.ts`）
- 結合テスト（Playwright、`tests/integration/*.spec.ts`）は、API Routes・画面間連携・ブロック系ルール・認証・バックアップ等、複数コンポーネントを跨いだ振る舞いを検証する（`docs/結合テスト.md`参照）
- E2E（Playwright、`tests/e2e/*.spec.ts`）は主要フロー（ログイン → 大会/競技/選手情報登録 → 結果入力 → データ出力）のみを対象とし、全画面を網羅するものではない（`docs/E2Eテスト.md`参照）

### 日付/タイムゾーンの扱い

- 利用者は日本国内の大会運営者のみを想定しているため、ユーザーごとのタイムゾーン設定には対応しない（常にAsia/Tokyo表示）
- DBにはUTCで保存し、表示・入力時にアプリ層でJST⇔UTCを変換する

### フォーム/バリデーション方針

- 要件定義書の入力制約（文字数上限、数値範囲、必須/任意など）はZodスキーマとして定義する
- 同じZodスキーマを、フロントエンドのフォーム入力制御（React Hook Form）とAPIルートのリクエストバリデーションの両方で再利用する

## 利用者・ロール

`docs/要件定義書.md` の「2. システム利用者」を参照してください（管理者・参加者の2ロール）。

## ドメインモデル

`docs/要件定義書.md` の「3. 機能要件」各節を参照してください。用語の統一表記は `docs/用語集.md` を参照してください。画面構成・画面遷移・各画面の表示/入力項目は `docs/画面仕様書.md` を参照してください。

## コアロジック（自動生成・自動計算の仕様）

`docs/要件定義書.md` の「3.4〜3.9」（リーグ表自動生成、試合順自動生成、審判順自動生成、試合結果入力・自動計算、データ出力）を参照してください。実装時に誤りやすい核心部分のため、要約だけに頼らず必ず原文を確認してください。

## 非機能要件

`docs/要件定義書.md` の「4. 非機能要件」を参照してください（対応環境・性能・セキュリティ・バックアップ）。

## 将来対応要件（現時点ではスコープ外）

`docs/要件定義書.md` の「5. 将来対応要件」を参照してください（トーナメント戦対応、結果公開Webページ、不戦勝・棄権対応）。1カテゴリ1リーグ・複数コート（単一リーグ）対応、および審判要員不足時（審判欄への「運営スタッフ」表示）の対応は実装済みのため、本節からは除外しています。

## コーディング規約

- コード中のコメントは**日本語**で記述する。
- Lint/フォーマッタ: ESLint（`eslint-config-next`）+ Prettier
  - Prettier設定: `singleQuote: true`, `semi: true`, `trailingComma: "all"`, `printWidth: 100`
- 命名規則:
  - コンポーネントファイルは `PascalCase`（例: `Button.tsx`）
  - それ以外のファイル（ユーティリティ等）は `camelCase`
  - ルートフォルダ（`app/` 配下のディレクトリ）は `kebab-case`

## ディレクトリ構成

```
src/
  app/          … ページ & Route Handlers
    (admin)/    … 管理者向け画面グループ
    (public)/   … 参加者向け画面グループ
    api/        … API Route Handlers
  components/   … 共通UIコンポーネント
  lib/          … DB接続・認証・共通ロジック
  types/        … 型定義
electron/
  main.ts       … Electronメインプロセス（Next.jsサーバーの起動・ウィンドウ表示）
  server.ts     … Next.jsサーバーの起動・ポート選定・起動確認ヘルパー
```

## 環境変数管理

- `.env.example` をリポジトリにコミットし、必要な環境変数のキー一覧を示す（値はダミー）
- 実際の値は `.env.local`（`.gitignore`対象）に記述する
- 変数名は `LEAGUE_TABLE_DATA_DIR` のような `SCREAMING_SNAKE_CASE` とする
- `LEAGUE_TABLE_DATA_DIR`：データ保存先ディレクトリを上書きする任意の環境変数（未設定時は`process.cwd()/.data`を使用）。Electron版では起動時にアプリが自動的にOS標準のユーザーデータディレクトリを設定する

## API設計規約

- URL: 名詞複数形を用い、ドメイン階層に沿ってネストする（例: `/api/tournaments/:id/categories`）
- メソッド: `GET`(取得) / `POST`(作成) / `PUT`(更新) / `DELETE`(削除)
- レスポンス形式: 成功時 `{ data: ... }`、失敗時 `{ error: { code, message } }`
- ページネーション: `?page=&pageSize=` のクエリパラメータ方式

## バックアップ実装方針

バックアップ要件（手動/自動）自体は `docs/要件定義書.md` の「4. 非機能要件」を参照。実装方式は以下のとおりとする。

- 手動・自動（ログアウト時）とも、全テーブルをJSONエクスポートする共通APIを実装する
- 自動バックアップは、ログアウトAPI呼び出し時に「バックアップする」が選択された場合（管理者ロールのみ）、同じエクスポート処理をトリガーする
- 保存先: ローカルファイルシステム（OS標準のユーザーデータディレクトリ配下、`LEAGUE_TABLE_DATA_DIR`環境変数で指定）。個人情報を含むため非公開のローカルディレクトリに保存し、管理者のみがアプリ経由でアクセスできるようにする

## Gitワークフロー

### 作業コミット（チェックポイント）

- ファイルを変更する前に、その時点の差分を `git commit` してチェックポイントとして記録すること

### リリースコミット（バージョンタグでの集約）

チャット上で以下のフォーマットの入力があった場合、それまでに積み上がった作業コミットを1つのリリースコミットに集約（squash）し、バージョンタグを付与する。

- **トリガーフォーマット**: `リリース：x.y.z、更新内容`

**リリースコミット作成前の前提条件**: Electronパッケージング（`installer/`配下の成果物）等、タグpushで起動するビルド・パブリッシュ処理が構成に含まれている場合は、リリースコミット（スクワッシュ＋タグ付け）を実行する前に、そのビルドが問題なく成功することを検証しておく（例：GitHub Actionsの`workflow_dispatch`で手動実行し、失敗があれば通常の作業コミットとして修正を重ねる）。検証済みの状態で初めてリリースコミットを作成することで、タグ付け後に不具合が見つかり、既にpush済みのリリースコミット・タグをamend・force pushし直すような手戻りを避けられる。

**手順:**

1. 直前のリリースタグを確認する: `git tag --list 'v*' --sort=-v:refname | head -1`
2. **直前のタグが存在する場合**: `git reset --soft <直前のタグ>` でそのタグ以降の作業コミットをまとめ、`git tag vx.y.z` を付与する
3. **直前のタグが存在しない場合（初回リリース）**: それまでの全コミット（初期コミットを含む）を1つのリリースコミットに置き換える（オーファンブランチで作り直す: `git checkout --orphan` → `git add -A` → `git commit` → 旧ブランチを削除してリネーム）。その後 `git tag v1.0.0` のようにタグを付与する
4. コミット時に現在日付を取得し（`date +%Y-%m-%d`）、コミットメッセージはユーザー入力に日付を付加した形にする: `git commit -m "リリース：x.y.z、更新内容 (YYYY-MM-DD)"`（例: `リリース：1.0.0、初回リリース (2026-11-09)`）

この結果、リリース後のGit履歴には作業コミットは残らず、リリースコミット（タグ付き・日付入り）のみが積み重なる。

## 開発時の注意事項

- 要件定義書（`docs/要件定義書.md`）を実装の一次情報源とし、矛盾があれば要件定義書を優先する
- 用語は `docs/用語集.md` に準拠する
- 画面構成・画面遷移は `docs/画面仕様書.md` に準拠する
- 技術スタックや新しい依存関係を導入する前に、必ずユーザーに確認する
- ビルド/テスト/Lintコマンドが整備されたら、このファイルの「現在の状態」セクションを更新すること
