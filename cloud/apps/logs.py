from __future__ import annotations

from collections import deque
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query

router = APIRouter()

ALLOWED_LOGS = {
    "mesh": Path("/logs/mesh.log"),
    "cloud": Path("/logs/cloud.log"),
}


def tail_file(path: Path, lines: int) -> list[str]:
    if not path.exists():
        return []

    with path.open("r", encoding="utf-8", errors="replace") as f:
        return list(deque(f, maxlen=lines))


@router.get("/{name}")
def get_logs(
    name: str,
    lines: int = Query(default=100, ge=1, le=500),
):
    path = ALLOWED_LOGS.get(name)

    if path is None:
        raise HTTPException(status_code=404, detail="Unknown log source")

    try:
        output = tail_file(path, lines)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return {
        "name": name,
        "path": str(path),
        "lines": [line.rstrip("\n") for line in output],
    }