from __future__ import annotations

import re
import shutil
import subprocess
import sys
from os import environ
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


def _resolve_python_for_pip() -> str | None:
    # In frozen exe mode, sys.executable points to our app exe, not python.exe.
    candidates: list[str] = []

    env_python = environ.get("DL_EXE_PYTHON")
    if env_python:
        candidates.append(env_python)

    conda_env_name = environ.get("DL_EXE_CONDA_ENV", "Cbot")
    user_home = Path.home()
    candidates.extend(
        [
            str(user_home / "miniconda3" / "envs" / conda_env_name / "python.exe"),
            str(user_home / "anaconda3" / "envs" / conda_env_name / "python.exe"),
        ]
    )

    conda_prefix = environ.get("CONDA_PREFIX")
    if conda_prefix:
        candidates.append(str(Path(conda_prefix) / "python.exe"))

    project_root = Path(__file__).resolve().parent.parent
    candidates.append(str(project_root / ".venv" / "Scripts" / "python.exe"))

    path_python = shutil.which("python")
    if path_python:
        candidates.append(path_python)

    for candidate in candidates:
        if not candidate:
            continue
        p = Path(candidate)
        if p.exists() and p.name.lower() == "python.exe":
            return str(p)
    return None


def self_update_yt_dlp(pin_requirements: bool, requirements_path: Path) -> int:
    print("[update] Upgrading yt-dlp...")

    python_for_pip = sys.executable
    if getattr(sys, "frozen", False):
        resolved = _resolve_python_for_pip()
        if not resolved:
            print("[error] python.exe not found for update in frozen mode.")
            print("[hint] Set DL_EXE_PYTHON or install Python/Conda env and retry.")
            return 1
        python_for_pip = resolved

    result = subprocess.run(
        [python_for_pip, "-m", "pip", "install", "--upgrade", "yt-dlp"],
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
