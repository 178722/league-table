---
name: run-desktop
description: Build, run, and drive the「リーグ戦しようよ」Electronデスクトップアプリ。デスクトップアプリの起動・スクリーンショット・UI操作を求められたときに使う。
---

「リーグ戦しようよ」はNext.jsアプリをElectronでラップしたデスクトップアプリです。
headless Linux（本devcontainer含む）ではxvfb経由でPlaywrightの`_electron`driverを使って操作します。
起動時はまずローディング画面（data: URL）が表示され、Next.jsサーバーの起動確認後に本物のURL
（`http://localhost:<port>`）へ遷移します。driverはこの遷移を待ってから本物のページを掴みます。

パスはすべてリポジトリ直下（`/workspaces/LeagueTable`）からの相対パスです。

## 前提パッケージ

```bash
sudo apt-get install -y tmux xvfb libgtk-3-0t64 libnss3 libxss1 libasound2t64
```

## ビルド

```bash
npm run electron:build:main   # electron/*.ts → dist-electron/*.js
```

## 実行（エージェント向け）

開発中のNext.jsサーバーに接続する場合（高速・推奨）：

```bash
npx next dev -p 3800 &            # 別途next devを起動しておく
# /login が200を返すまで待つ
tmux new-session -d -s app -x 200 -y 50
tmux send-keys -t app 'xvfb-run -a node .claude/skills/run-desktop/driver.mjs' Enter
timeout 20 bash -c 'until tmux capture-pane -t app -p | grep -q "driver>"; do sleep 0.2; done'
tmux send-keys -t app 'launch 3800' Enter
timeout 30 bash -c 'until tmux capture-pane -t app -p | grep -q "launched\."; do sleep 0.3; done'
tmux send-keys -t app 'ss login' Enter
tmux capture-pane -t app -p
```

本番相当（`next start`をmain.ts自身に起動させる）で確認したい場合は`launch`を引数なしで呼ぶ
（事前に`npm run build`が必要。起動確認ポーリングがあるぶん遅い）。

スクリーンショットは`/tmp/shots/`に出力される（`SCREENSHOT_DIR`で上書き可）。

### コマンド一覧

| コマンド | 内容 |
|---|---|
| `launch [devPort]` | アプリを起動。`devPort`指定時はそのポートのnext devに接続、省略時はmain.tsが`next start`を自前起動 |
| `ss [name]` | スクリーンショット → `/tmp/shots/<name>.png` |
| `click <css-sel>` | DOM経由でクリック |
| `click-text <text>` | テキストが一致/部分一致するbutton/a/[role=button]をクリック |
| `type <text>` / `press <key>` | キーボード入力 |
| `wait <css-sel>` | 要素出現待ち（10秒タイムアウト） |
| `eval <js>` | ページ内でJS評価しJSON表示 |
| `text [css-sel]` | innerTextを表示 |
| `windows` | 開いているwindow一覧（本物のURLに遷移済みか確認用） |
| `quit` | アプリ終了 |

## 実行（人間向け）

```bash
npm run electron:dev   # next devを起動しElectronウィンドウを開く（GUI環境が必要）
```

## うまくいかなかったこと・注意点

- 初回ウィンドウはローディング画面（data: URL）。`app.windows()`がすぐ本物のURLを返すとは限らないため、driverの`launch`は`http://localhost`で始まるURLが出るまで最大20秒ポーリングする
- サンドボックスはコンテナ内では使えないため`--no-sandbox`必須（CAP_SYS_ADMIN/user namespacesが無い前提）
- `canvas`（node-canvas）はネイティブアドオンのため、Electron同梱Nodeとのビルド時ABIが一致している必要がある。開発時（`npm run electron:dev`やこのdriver経由の`next dev`接続）はリポジトリの通常のnode_modulesで動くが、パッケージ後の配布物は`scripts/prepare-electron-deps.mjs`で`@electron/rebuild`により再ビルドしたものを使う（`npm run electron:build`参照）
