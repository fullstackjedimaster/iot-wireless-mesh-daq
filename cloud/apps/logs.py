# apps/routers/logs.py

from __future__ import annotations

from collections import deque
from pathlib import Path
from typing import Final

from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/api/logs", tags=["logs"])

LOG_FILES: Final[dict[str, tuple[Path, ...]]] = {
    "mesh": (
        Path("/logs/mesh.log"),
        Path("/logs/emulator.log"),
    ),
    "cloud": (
        Path("/logs/cloud.log"),
    ),
}


def tail_file(path: Path, line_count: int) -> list[str]:
    if not path.is_file():
        return []

    with path.open(
        mode="r",
        encoding="utf-8",
        errors="replace",
    ) as handle:
        return [
            line.rstrip("\r\n")
            for line in deque(handle, maxlen=line_count)
        ]


@router.get("/{source}")
def get_logs(
    source: str,
    lines: int = Query(default=100, ge=1, le=500),
) -> dict[str, object]:
    paths = LOG_FILES.get(source)

    if paths is None:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown log source: {source}",
        )

    combined: list[str] = []
    available_files: list[str] = []

    try:
        for path in paths:
            if not path.is_file():
                continue

            available_files.append(str(path))

            file_lines = tail_file(path, lines)

            if len(paths) > 1 and file_lines:
                combined.append(f"--- {path.name} ---")

            combined.extend(file_lines)

    except OSError as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to read logs: {exc}",
        ) from exc

    return {
        "name": source,
        "files": available_files,
        "lines": combined[-lines:],
    }