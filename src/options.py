from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class DownloadOptions:
    url: str
    output_dir: Path
    format_selector: str = "bv*+ba/b"
    audio_only: bool = False
    audio_format: str = "mp3"
    ffmpeg_location: str | None = None
