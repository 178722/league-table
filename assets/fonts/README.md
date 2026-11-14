# 同梱フォントについて

`ipag.ttf`（IPAゴシック）は、データ出力（A10）でExcelに埋め込むリーグ表画像（`src/lib/league-image.ts`、`canvas`パッケージによるPNG描画）に使用する。

OS側に日本語フォントがインストールされていない端末（特にElectron配布先のまっさらなWindows/Mac環境）でも文字化けしないよう、フォントファイル自体をリポジトリに同梱し、`registerFont`で明示的に登録している。

- 提供元: 独立行政法人情報処理推進機構（IPA）
- ライセンス: IPAフォントライセンスv1.0（`IPA_Font_License_Agreement_v1.0.txt`参照。無償・改変禁止で再配布可能）
