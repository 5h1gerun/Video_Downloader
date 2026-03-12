# Video_Downloader

`yt-dlp` を利用した動画/音声ダウンローダーです。  
以下の構成で動作します。

- Python 製 CLI バックエンド（`src/main.py`）
- Electron 製 GUI（`electron/`）
- Windows 向けビルドスクリプト（`build_exe.ps1`, `build_electron_package.ps1`）

## 必要環境

- Windows
- Python 3.11 以上
- FFmpeg（任意だが推奨）
- Node.js + npm（Electron の開発/パッケージ化時のみ）

## ディレクトリ構成

```text
DL_exe/
  src/
    main.py
    downloader.py
    options.py
    runtime_paths.py
    updater.py
  electron/
    main.js
    preload.js
    renderer.js
    index.html
    styles.css
    package.json
  build_exe.ps1
  build_electron_package.ps1
  requirements.txt
```

## Python CLI の使い方

依存をインストール:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -U pip
pip install -r requirements.txt
pip install pyinstaller
```

動画ダウンロード:

```powershell
python src/main.py --url "https://www.youtube.com/watch?v=xxxx" --output "downloads"
```

音声のみ:

```powershell
python src/main.py --url "https://www.youtube.com/watch?v=xxxx" --audio-only --audio-format mp3
```

現在の Python 環境で yt-dlp を更新:

```powershell
python src/main.py --update-yt-dlp
```

更新後の yt-dlp バージョンを `requirements.txt` に固定:

```powershell
python src/main.py --update-yt-dlp --pin-requirements
```

## FFmpeg の検出順

実行時の自動検出順は以下です。

1. 環境変数 `FFMPEG_LOCATION`
2. 環境変数 `FFMPEG_PATH`
3. `PATH` 上の `ffmpeg`
4. 実行ファイル近傍の同梱パス
   - `ffmpeg/bin/ffmpeg.exe`
   - `ffmpeg/ffmpeg.exe`
   - `ffmpeg/bin`
   - `ffmpeg`

必要であれば `--ffmpeg-location` で明示指定できます。

## バックエンド EXE のビルド（PyInstaller）

`build_exe.ps1` の主なオプション:

- `-OneDir`（未指定時は onefile）
- `-BundleFFmpeg`
- `-FFmpegPath <path>`
- `-IncludeElectron`
- `-BundleElectronRuntime`
- `-ExportToElectronBackend`
- `-InstallMissing`
- `-Clean`

例:

```powershell
# ポータブルフォルダ形式でビルド
powershell -ExecutionPolicy Bypass -File .\build_exe.ps1 -OneDir -Clean
```

```powershell
# FFmpeg を自動同梱
powershell -ExecutionPolicy Bypass -File .\build_exe.ps1 -OneDir -BundleFFmpeg -Clean
```

```powershell
# バックエンドをビルドし、Electron 用に electron/backend へコピー
powershell -ExecutionPolicy Bypass -File .\build_exe.ps1 -OneDir -ExportToElectronBackend -BundleFFmpeg -Clean
```

## Electron GUI 開発

```powershell
cd electron
npm install
npm start
```

## Windows Setup（GUIアプリ）作成

プロジェクトルートで以下を実行:

```powershell
powershell -ExecutionPolicy Bypass -File .\build_electron_package.ps1 -Clean
```

実行内容:

1. `Video_Downloader` バックエンドを `-OneDir` でビルド
2. `electron/backend` へエクスポート
3. `electron-builder`（NSIS）で Setup を作成

出力先:

- `electron/release/Video_Downloader_Setup_<version>.exe`

インストール後の GUI 実行ファイル:

- `Video_Downloader_GUI.exe`

## インストーラー / アンインストーラー

NSIS は一般的なウィザード形式で構成しています。

- インストール先フォルダ選択可
- デスクトップ/スタートメニューショートカット作成

アンインストーラーは自動生成され、以下から実行できます。

1. Windows 設定 > アプリ
2. スタートメニュー
3. インストール先の `Uninstall Video_Downloader.exe`

