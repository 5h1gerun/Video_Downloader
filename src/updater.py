from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path


def _get_installed_yt_dlp_version() -> str | None:
    try:
        import yt_dlp  # type: ignore
    except Exception:  # noqa: BLE001
        return None

    version = getattr(yt_dlp, "version", None)
    if version is not None and hasattr(version, "__version__"):
        return str(version.__version__)
    return getattr(yt_dlp, "__version__", None)


def _pin_requirements(requirements_path: Path, version: str) -> None:
    line = f"yt-dlp=={version}"
    pattern = re.compile(r"^\s*yt-dlp(?:[<>=!~].*)?$", flags=re.IGNORECASE)

    if requirements_path.exists():
        lines = requirements_path.read_text(encoding="utf-8").splitlines()
        replaced = False
        for idx, original in enumerate(lines):
            if pattern.match(original.strip()):
                lines[idx] = line
                replaced = True
                break
        if not replaced:
            lines.append(line)
    else:
        lines = [line]

    requirements_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def self_update_yt_dlp(pin_requirements: bool, requirements_path: Path) -> int:
    print("[update] Upgrading yt-dlp...")

    result = subprocess.run(
        [sys.executable, "-m", "pip", "install", "--upgrade", "yt-dlp"],
        check=False,
    )
    if result.returncode != 0:
        print("[error] Failed to update yt-dlp.")
        return result.returncode

    version = _get_installed_yt_dlp_version()
    if not version:
        print("[warn] yt-dlp updated, but installed version could not be detected.")
        return 0

    print(f"[done] yt-dlp is now {version}")

    if pin_requirements:
        _pin_requirements(requirements_path, version)
        print(f"[done] requirements updated: {requirements_path}")

    return 0
