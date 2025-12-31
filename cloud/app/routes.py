# cloud/app/routes.py
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from .commissioning.commission_sitegraph import load_site_graph
from .util.config import get_redis_conn, load_config
from .util.logger import make_logger
from .util.faults import (
    set_fault,
    normalize_fault_token,
)

from app.security.embed_token import require_embed_token


class FaultRequest(BaseModel):
    mac: str
    fault: str


router = APIRouter()
config = load_config()
logger = make_logger("Route")

# Token dependency factory (POST routes only)
require_meshdaq = require_embed_token("mesh-daq")


def normalize_mac(raw: str) -> str:
    try:
        value = int(raw, 16)
        hex_str = f"{value:012x}"
        return ":".join(hex_str[i : i + 2] for i in range(0, 12, 2))
    except ValueError:
        return "invalid"


@router.get("/layout", response_class=JSONResponse)
async def get_panel_layout():
    try:
        graph_json = load_site_graph()

        layout = []

        def walk(node):
            if not isinstance(node, dict):
                return
            if node.get("devtype") == "P":
                mac = node.get("inputs", [{}])[0].get("macaddr", "").lower()
                x = node.get("x")
                y = node.get("y")
                if mac and x is not None and y is not None:
                    layout.append({"mac": mac, "x": x, "y": y})
            for child in node.get("inputs", []):
                walk(child)

        walk(graph_json.get("sitearray", {}))
        return layout
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {e}")


@router.get("/status/{mac}")
def get_panel_status(mac: str):
    r = get_redis_conn(db=3)
    key = f"sitearray:monitor:{mac.lower()}"
    data = r.hgetall(key) or {}
    return {
        "mac": mac,
        "status": data.get("status", "unknown"),
        "voltage": data.get("voltage"),
        "current": data.get("current"),
        "power": data.get("power"),
        "temperature": data.get("temperature"),
    }


@router.post("/inject_fault", dependencies=[Depends(require_meshdaq)])
def api_inject_fault(payload: dict):
    mac = (payload.get("mac") or "").lower()
    raw_fault = payload.get("fault") or "normal"
    low, _ = normalize_fault_token(raw_fault)
    if not mac:
        raise HTTPException(status_code=400, detail="mac required")
    set_fault(mac, low)
    return {"ok": True, "mac": mac, "fault": low}


@router.post("/clear_all_faults", dependencies=[Depends(require_meshdaq)])
def api_clear_all_faults():
    r = get_redis_conn(db=3)
    keys = list(r.scan_iter("fault_injection:*"))
    for k in keys:
        r.delete(k)
    return {"ok": True, "deleted": len(keys)}


@router.get("/faults/profile")
def api_faults_profile():
    r = get_redis_conn()
    profile: dict[str, int] = {}
    for key in r.scan_iter("sitearray:monitor:*"):
        status = (r.hget(key, "status") or "normal")
        _, up = normalize_fault_token(status)
        profile[up] = profile.get(up, 0) + 1
    return {"GLOBAL": profile}
