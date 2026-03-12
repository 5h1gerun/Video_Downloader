# Video_Downloader

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

## FFmpeg bundling for distribution

You can redistribute this app with FFmpeg in the project/package root.

Recommended layout:

```text
DL_exe/
  DL_exe.exe (or python entry)
  ffmpeg/
    bin/
      ffmpeg.exe
      ffprobe.exe
    licenses/
      LICENSE.txt
      COPYING.LGPLv2.1.txt (or corresponding GPL/LGPL files)
      THIRD_PARTY_NOTICES.txt
```

Behavior in this project:

- If `--ffmpeg-location` is omitted, the app automatically checks these paths:
  1. `ffmpeg/bin/ffmpeg.exe`
  2. `ffmpeg/ffmpeg.exe`
  3. `ffmpeg/bin`
  4. `ffmpeg`
- This works for both CLI and GUI.

Distribution checklist:

1. Include the original FFmpeg license files from your build.
2. Keep source URL + version in `THIRD_PARTY_NOTICES.txt`.
3. Confirm whether your FFmpeg build is LGPL or GPL and comply accordingly.

## Electron GUI

A desktop GUI using Electron is available under `electron/`.

Setup:

```powershell
cd electron
npm install
npm start
```

Notes:

- The Electron app calls `src/main.py` as backend.
- Python executable resolution order:
  1. `DL_EXE_PYTHON` environment variable
  2. `%CONDA_PREFIX%\python.exe`
  3. `.venv\Scripts\python.exe`
  4. `python` on PATH
- Existing CLI remains available.

## Electron packaged distribution (electron-builder)

For full distribution, package Electron separately and bundle the Python backend as a resource.

1. Build backend and export it into `electron/backend`:

```powershell
powershell -ExecutionPolicy Bypass -File .\build_exe.ps1 -OneDir -ExportToElectronBackend -Clean
```

2. Install Electron dependencies:

```powershell
cd electron
npm install
```

3. Build installer package:

```powershell
npm run dist:win
```

Outputs are generated under `electron/release/`.
Installed app entry point is `Video_Downloader_GUI.exe` (GUI).
Installer is assisted UI style (wizard with install directory selection).
Uninstaller is generated automatically and available from:
- Windows Settings > Apps > Installed apps
- Start menu entry created by installer
- Install directory (`Uninstall Video_Downloader.exe`)

Or run all steps (backend build + electron-builder) from project root:

```powershell
powershell -ExecutionPolicy Bypass -File .\build_electron_package.ps1 -Clean
```

To bundle FFmpeg automatically:

```powershell
powershell -ExecutionPolicy Bypass -File .\build_exe.ps1 -OneDir -BundleFFmpeg -Clean
# or explicit path
powershell -ExecutionPolicy Bypass -File .\build_exe.ps1 -OneDir -BundleFFmpeg -FFmpegPath "C:\ffmpeg\bin" -Clean
```
