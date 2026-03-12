# Video_Downloader

Video and audio downloader built on `yt-dlp`, with:
- Python CLI backend (`src/main.py`)
- Electron GUI (`electron/`)
- Windows packaging scripts (`build_exe.ps1`, `build_electron_package.ps1`)

## Requirements

- Windows
- Python 3.11+
- FFmpeg (optional but recommended)
- Node.js + npm (only for Electron packaging/development)

## Repository Layout

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

## Python CLI Usage

Install dependencies:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -U pip
pip install -r requirements.txt
pip install pyinstaller
```

Download video:

```powershell
python src/main.py --url "https://www.youtube.com/watch?v=xxxx" --output "downloads"
```

Audio only:

```powershell
python src/main.py --url "https://www.youtube.com/watch?v=xxxx" --audio-only --audio-format mp3
```

Update yt-dlp in current Python environment:

```powershell
python src/main.py --update-yt-dlp
```

Pin updated yt-dlp version into `requirements.txt`:

```powershell
python src/main.py --update-yt-dlp --pin-requirements
```

## FFmpeg Behavior

Runtime auto-detection order:
1. `FFMPEG_LOCATION` environment variable
2. `FFMPEG_PATH` environment variable
3. `ffmpeg` on PATH
4. Local bundle near runtime:
   - `ffmpeg/bin/ffmpeg.exe`
   - `ffmpeg/ffmpeg.exe`
   - `ffmpeg/bin`
   - `ffmpeg`

You can also pass `--ffmpeg-location` explicitly.

## Build Backend EXE (PyInstaller)

`build_exe.ps1` options (main):
- `-OneDir` / default onefile
- `-BundleFFmpeg`
- `-FFmpegPath <path>`
- `-IncludeElectron`
- `-BundleElectronRuntime`
- `-ExportToElectronBackend`
- `-InstallMissing`
- `-Clean`

Examples:

```powershell
# Portable backend folder build
powershell -ExecutionPolicy Bypass -File .\build_exe.ps1 -OneDir -Clean
```

```powershell
# Bundle FFmpeg automatically
powershell -ExecutionPolicy Bypass -File .\build_exe.ps1 -OneDir -BundleFFmpeg -Clean
```

```powershell
# Build backend and copy it to electron/backend for Electron packaging
powershell -ExecutionPolicy Bypass -File .\build_exe.ps1 -OneDir -ExportToElectronBackend -BundleFFmpeg -Clean
```

## Electron GUI Development

```powershell
cd electron
npm install
npm start
```

## Build Windows Setup (GUI App)

Use this single command from project root:

```powershell
powershell -ExecutionPolicy Bypass -File .\build_electron_package.ps1 -Clean
```

What it does:
1. Builds backend (`Video_Downloader`) with `-OneDir`
2. Exports backend into `electron/backend`
3. Runs Electron build (`electron-builder`, NSIS)

Output:
- `electron/release/Video_Downloader_Setup_<version>.exe`

Installed GUI executable:
- `Video_Downloader_GUI.exe`

## Installer / Uninstaller

The NSIS setup is configured as a standard assisted installer (wizard):
- installation directory selection enabled
- desktop and start menu shortcuts enabled

Uninstaller is generated automatically and available from:
1. Windows Settings > Apps
2. Start menu
3. Install directory: `Uninstall Video_Downloader.exe`

