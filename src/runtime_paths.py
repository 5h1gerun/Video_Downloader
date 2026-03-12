from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path


def _runtime_root() -> Path:
    # Frozen binaries should look relative to the executable location.
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent.parent


def detect_default_ffmpeg_location() -> str | None:
    # Prefer explicit Windows environment variables when provided.
    env_candidates = [
        os.environ.get("FFMPEG_LOCATION"),
        os.environ.get("FFMPEG_PATH"),
    ]
    for env_path in env_candidates:
        if env_path:
            candidate = Path(env_path).expanduser()
            if candidate.exists():
                return str(candidate)

    # Fall back to PATH lookup (Windows environment variable PATH).
    ffmpeg_on_path = shutil.which("ffmpeg")
    if ffmpeg_on_path:
        return ffmpeg_on_path

    root = _runtime_root()
    candidates = [
        root / "ffmpeg" / "bin" / "ffmpeg.exe",
        root / "ffmpeg" / "ffmpeg.exe",
        root / "ffmpeg" / "bin",
        root / "ffmpeg",
    ]

    for candidate in candidates:
        if candidate.exists():
            return str(candidate)
    return None
