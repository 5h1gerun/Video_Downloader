from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

from downloader import download_video
from options import DownloadOptions
from runtime_paths import detect_default_ffmpeg_location
from updater import self_update_yt_dlp


def configure_stdio_utf8() -> None:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="DL_exe",
        description="Download videos using yt-dlp.",
    )
    parser.add_argument("--url", help="Video URL")
    parser.add_argument(
        "--output",
        default="downloads",
        help="Output directory (default: ./downloads)",
    )
    parser.add_argument(
        "--format",
        default="bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b",
        dest="format_selector",
        help="yt-dlp format selector (default: mp4 preferred)",
    )
    parser.add_argument(
        "--audio-only",
        action="store_true",
        help="Download audio only",
    )
    parser.add_argument(
        "--audio-format",
        default="mp3",
        choices=["mp3", "m4a", "aac", "wav", "opus", "vorbis", "flac"],
        help="Audio format when --audio-only is enabled (default: mp3)",
    )
    parser.add_argument(
        "--ffmpeg-location",
        default=None,
        help="Path to ffmpeg binary directory or executable",
    )
    parser.add_argument(
        "--concurrent-fragments",
        type=int,
        default=8,
        help="Concurrent fragment downloads for yt-dlp (default: 8)",
    )
    parser.add_argument(
        "--no-aria2c",
        action="store_true",
        help="Disable aria2c even when installed",
    )
    parser.add_argument(
        "--update-yt-dlp",
        action="store_true",
        help="Update yt-dlp to latest version in current Python environment and exit",
    )
    parser.add_argument(
        "--pin-requirements",
        action="store_true",
        help="When used with --update-yt-dlp, write installed yt-dlp version to requirements.txt",
    )
    parser.add_argument(
        "--gui",
        action="store_true",
        help="Launch Electron GUI",
    )
    return parser


def launch_electron_gui() -> int:
    project_root = Path(__file__).resolve().parent.parent
    electron_dir = project_root / "electron"
    package_json = electron_dir / "package.json"

    if not package_json.exists():
        print(f"[error] Electron app not found: {package_json}")
        return 1

    npm = shutil.which("npm.cmd") or shutil.which("npm")
    if not npm:
        print("[error] npm was not found. Please install Node.js.")
        return 1

    node_modules = electron_dir / "node_modules"
    if not node_modules.exists():
        print("[error] Electron dependencies are not installed.")
        print(f"[hint] Run: cd {electron_dir} && npm install")
        return 1

    result = subprocess.run(
        [npm, "start"],
        cwd=electron_dir,
        check=False,
    )
    return result.returncode


def main() -> int:
    configure_stdio_utf8()

    parser = build_parser()
    args = parser.parse_args()

    # Launch Electron GUI by default when no CLI arguments are provided.
    if len(sys.argv) == 1:
        return launch_electron_gui()

    if args.update_yt_dlp:
        project_root = Path(__file__).resolve().parent.parent
        requirements_path = project_root / "requirements.txt"
        return self_update_yt_dlp(
            pin_requirements=args.pin_requirements,
            requirements_path=requirements_path,
        )

    if args.gui:
        return launch_electron_gui()

    if not args.url:
        parser.error("--url is required unless --update-yt-dlp is used.")

    if args.audio_only is False and "audio" in args.format_selector.lower():
        print(
            "[warn] --format looks audio-focused. Consider --audio-only for extraction.",
        )

    opts = DownloadOptions(
        url=args.url,
        output_dir=Path(args.output),
        format_selector=args.format_selector,
        audio_only=args.audio_only,
        audio_format=args.audio_format,
        ffmpeg_location=args.ffmpeg_location or detect_default_ffmpeg_location(),
        concurrent_fragments=args.concurrent_fragments,
        use_aria2c=not args.no_aria2c,
    )

    return download_video(opts)


if __name__ == "__main__":
    sys.exit(main())
