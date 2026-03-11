# DL_exe

`yt-dlp` を利用して動画をダウンロードする Windows 向け `exe` アプリを開発するプロジェクトです。  
現在は CLI ベースの MVP を実装済みで、後から GUI 対応できる構成を目指します。

## 目的

- URL を指定して動画をダウンロードできること
- 保存先・画質・音声のみ抽出など、よく使うオプションを扱えること
- Python 実行環境がない PC でも `exe` 単体で動かせること

## 実装済み機能（MVP）

- 単一 URL の動画ダウンロード
- 出力先フォルダ指定
- フォーマット指定（例: `best`, `bv*+ba/b`）
- 音声のみ抽出（`mp3` など）
- ダウンロード進捗とエラーメッセージ表示

## 技術スタック

- Python 3.11+
- [yt-dlp](https://github.com/yt-dlp/yt-dlp)
- [FFmpeg](https://ffmpeg.org/)（形式変換・音声抽出で利用）
- PyInstaller（`exe` 化）

## 開発環境セットアップ

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -U pip
pip install -r requirements.txt
pip install pyinstaller
```

`FFmpeg` は別途インストールし、`PATH` が通っていることを推奨します。

## 実行イメージ（CLI）

```powershell
python src/main.py --url "https://example.com/watch?v=xxxx" --output "C:\Downloads"
```

音声のみ:

```powershell
python src/main.py --url "https://example.com/watch?v=xxxx" --audio-only --audio-format mp3
```

## exe ビルド

```powershell
pyinstaller --onefile --name DL_exe src/main.py
```

生成物:

- `dist\DL_exe.exe`

## ディレクトリ構成

```text
DL_exe/
  ├─ src/
  │   ├─ main.py
  │   ├─ downloader.py
  │   └─ options.py
  ├─ requirements.txt
  ├─ dist/
  ├─ build/
  ├─ README.md
  └─ LICENSE
```

## 注意事項

- 利用するサイトの利用規約・著作権法を必ず遵守してください。
- ダウンロード可否はコンテンツ提供元の規約に従います。
- 本ツールの利用は自己責任で行ってください。

## 開発ロードマップ

1. CLI 版 MVP 実装（URL/保存先/フォーマット/音声抽出）
2. エラーハンドリング強化とログ出力
3. `exe` 化と配布手順の整備
4. GUI 対応（必要なら）

## yt-dlp を最新化する

最新の `yt-dlp` が公開されたら、以下で更新できます。

```powershell
python src/main.py --update-yt-dlp
```

`requirements.txt` も更新後バージョンへ固定したい場合:

```powershell
python src/main.py --update-yt-dlp --pin-requirements
```
