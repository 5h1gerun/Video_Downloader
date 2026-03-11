from __future__ import annotations

from pathlib import Path

from yt_dlp import YoutubeDL
from yt_dlp.utils import DownloadError

from options import DownloadOptions


def _progress_hook(status_data: dict) -> None:
    status = status_data.get("status")

    if status == "downloading":
        percent = status_data.get("_percent_str", "?").strip()
        speed = status_data.get("_speed_str", "?")
        eta = status_data.get("_eta_str", "?")
        print(f"[downloading] {percent} | speed: {speed} | eta: {eta}")
    elif status == "finished":
        filename = status_data.get("filename", "unknown")
        print(f"[finished] Download completed: {filename}")


def build_ydl_options(opts: DownloadOptions) -> dict:
    outtmpl = str(opts.output_dir / "%(title)s.%(ext)s")
    ydl_opts: dict = {
        "outtmpl": outtmpl,
        "noplaylist": True,
        "format": opts.format_selector,
        "progress_hooks": [_progress_hook],
        "quiet": True,
        "no_warnings": False,
    }

    if opts.ffmpeg_location:
        ydl_opts["ffmpeg_location"] = opts.ffmpeg_location

    if opts.audio_only:
        ydl_opts["format"] = "bestaudio/best"
        ydl_opts["postprocessors"] = [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": opts.audio_format,
                "preferredquality": "192",
            }
        ]

    return ydl_opts


def download_video(opts: DownloadOptions) -> int:
    opts.output_dir.mkdir(parents=True, exist_ok=True)

    ydl_opts = build_ydl_options(opts)

    print(f"[start] URL: {opts.url}")
    print(f"[start] Output: {Path(opts.output_dir).resolve()}")

    try:
        with YoutubeDL(ydl_opts) as ydl:
            ydl.download([opts.url])
    except DownloadError as exc:
        print(f"[error] yt-dlp download failed: {exc}")
        return 1
    except Exception as exc:  # noqa: BLE001
        print(f"[error] Unexpected failure: {exc}")
        return 1

    print("[done] Download task finished successfully.")
    return 0
