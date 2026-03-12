from __future__ import annotations

import shutil
from collections.abc import Callable
from pathlib import Path

from yt_dlp import YoutubeDL
from yt_dlp.utils import DownloadError

from options import DownloadOptions

LogFunc = Callable[[str], None]
ProgressFunc = Callable[[dict], None]


def _make_progress_hook(log: LogFunc, progress_callback: ProgressFunc | None) -> Callable[[dict], None]:
    def _progress_hook(status_data: dict) -> None:
        status = status_data.get("status")

        if status == "downloading":
            percent = status_data.get("_percent_str", "?").strip()
            speed = status_data.get("_speed_str", "?")
            eta = status_data.get("_eta_str", "?")
            log(f"[downloading] {percent} | speed: {speed} | eta: {eta}")
        elif status == "finished":
            filename = status_data.get("filename", "unknown")
            log(f"[finished] Download completed: {filename}")

        if progress_callback:
            progress_callback(status_data)

    return _progress_hook


def _make_postprocessor_hook(log: LogFunc) -> Callable[[dict], None]:
    def _postprocessor_hook(status_data: dict) -> None:
        if status_data.get("status") != "finished":
            return

        info_dict = status_data.get("info_dict") or {}
        final_path = info_dict.get("filepath")
        if final_path:
            # Dedicated marker consumed by Electron for history/open-path.
            log(f"[result] {final_path}")

    return _postprocessor_hook


def build_ydl_options(
    opts: DownloadOptions,
    log: LogFunc = print,
    progress_callback: ProgressFunc | None = None,
) -> dict:
    outtmpl = str(opts.output_dir / "%(title)s.%(ext)s")
    ydl_opts: dict = {
        "outtmpl": outtmpl,
        "noplaylist": True,
        "format": opts.format_selector,
        "progress_hooks": [_make_progress_hook(log, progress_callback)],
        "postprocessor_hooks": [_make_postprocessor_hook(log)],
        "js_runtimes": {"node": {}},
        "concurrent_fragment_downloads": max(1, int(opts.concurrent_fragments)),
        "quiet": True,
        "no_warnings": False,
    }

    if opts.use_aria2c and shutil.which("aria2c"):
        ydl_opts["external_downloader"] = "aria2c"
        ydl_opts["external_downloader_args"] = {
            "default": [
                "--max-connection-per-server=16",
                "--split=16",
                "--min-split-size=1M",
                "--file-allocation=none",
            ]
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
    else:
        ydl_opts["merge_output_format"] = "mp4"

    return ydl_opts


def download_video(
    opts: DownloadOptions,
    log: LogFunc = print,
    progress_callback: ProgressFunc | None = None,
) -> int:
    opts.output_dir.mkdir(parents=True, exist_ok=True)

    ydl_opts = build_ydl_options(opts, log=log, progress_callback=progress_callback)

    log(f"[start] URL: {opts.url}")
    log(f"[start] Output: {Path(opts.output_dir).resolve()}")
    log(f"[start] concurrent fragments: {opts.concurrent_fragments}")
    if opts.use_aria2c and shutil.which("aria2c"):
        log("[start] downloader: aria2c (auto)")
    else:
        log("[start] downloader: yt-dlp internal")

    try:
        with YoutubeDL(ydl_opts) as ydl:
            ydl.download([opts.url])
    except DownloadError as exc:
        log(f"[error] yt-dlp download failed: {exc}")
        return 1
    except Exception as exc:  # noqa: BLE001
        log(f"[error] Unexpected failure: {exc}")
        return 1

    log("[done] Download task finished successfully.")
    return 0
