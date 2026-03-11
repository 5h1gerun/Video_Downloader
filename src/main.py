from __future__ import annotations

import argparse
import sys
from pathlib import Path

from downloader import download_video
from options import DownloadOptions
from updater import self_update_yt_dlp


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
        default="bv*+ba/b",
        dest="format_selector",
        help="yt-dlp format selector (default: bv*+ba/b)",
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
        "--update-yt-dlp",
        action="store_true",
        help="Update yt-dlp to latest version in current Python environment and exit",
    )
    parser.add_argument(
        "--pin-requirements",
        action="store_true",
        help="When used with --update-yt-dlp, write installed yt-dlp version to requirements.txt",
    )
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    if args.update_yt_dlp:
        project_root = Path(__file__).resolve().parent.parent
        requirements_path = project_root / "requirements.txt"
        return self_update_yt_dlp(
            pin_requirements=args.pin_requirements,
            requirements_path=requirements_path,
        )

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
        ffmpeg_location=args.ffmpeg_location,
    )

    return download_video(opts)


if __name__ == "__main__":
    sys.exit(main())
