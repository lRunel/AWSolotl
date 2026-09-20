"""Local control-api: the dashboard's single backend.

Run this from the repo root (`python services/control_api/main.py`) -- gate1
loads schemas from a path relative to the process's working directory, so
this process's cwd must be the repo root, same as the pytest suite already
assumes. It spawns and supervises the `web` and `payments` demo services,
runs the self-healing watchdog against them, and exposes everything the
dashboard needs behind one rate-limited, CORS-enabled origin:

    GET  /api/health           live status of web, payments, and the watchdog
    GET  /api/ledger           recent ledger records, newest first
    GET  /api/ledger/verify    hash-chain verification
    POST /api/ask              cite-or-unknown Q&A over the live ledger
    POST /api/chaos/{scenario} trigger a chaos bug (proxied to `web`)
    POST /api/chaos/config     set payments latency/error/pool_leak chaos
"""
from __future__ import annotations

import logging
import os
import sys
import time
from contextlib import asynccontextmanager

import requests
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, _REPO_ROOT)

from control.ratelimit import RateLimitMiddleware  # noqa: E402
from control import local_ledger  # noqa: E402
from services.control_api.supervisor import Supervisor  # noqa: E402
from services.control_api.watchdog import Watchdog  # noqa: E402
from services.control_api.ask import ask_why  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger("control-api")

supervisor = Supervisor()
watchdog = Watchdog(supervisor)

BUG_ENDPOINTS = {
    "memory_leak": "/api/bug_memory_leak",
    "cpu_spike": "/api/bug_cpu_spike",
    "flaky_endpoint": "/api/bug_flaky_endpoint",
    "crash": "/api/bug_crash",
}


@asynccontextmanager
async def lifespan(_app: FastAPI):
    supervisor.spawn_all()
    watchdog.start()
    logger.info("control-api ready: supervising %s", list(supervisor.services))
    yield
    watchdog.stop()
    supervisor.shutdown()


app = FastAPI(title="Lockstep Recall -- local control-api", lifespan=lifespan)
app.add_middleware(RateLimitMiddleware, capacity=40, refill_per_s=15.0)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("DASHBOARD_ORIGIN", "http://localhost:5173").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


def _web_url() -> str:
    return f"http://127.0.0.1:{supervisor.services['web'].port}"


def _payments_url() -> str:
    return f"http://127.0.0.1:{supervisor.services['payments'].port}"


@app.get("/api/health")
def health():
    web_alive = supervisor.is_alive("web")
    payments_alive = supervisor.is_alive("payments")
    return {
        "services": [
            {"name": "web", "healthy": web_alive, "port": supervisor.services["web"].port},
            {"name": "payments", "healthy": payments_alive, "port": supervisor.services["payments"].port},
        ],
        "watchdog": {
            "running": watchdog._thread is not None and watchdog._thread.is_alive(),
            "last_incident": watchdog.last_incident,
        },
        "recent_events": supervisor.events[-20:],
        "server_time": time.time(),
    }


@app.get("/api/ledger")
def ledger(limit: int = 50):
    return {"records": local_ledger.list_records(limit=limit)}


@app.get("/api/ledger/verify")
def ledger_verify():
    return local_ledger.verify_chain()


class AskRequest(BaseModel):
    question: str


@app.post("/api/ask")
def ask(req: AskRequest):
    records = local_ledger.list_records()
    return ask_why(req.question, records)


class ChaosConfig(BaseModel):
    latency_ms: int = 0
    error_rate: float = 0.0
    pool_leak: bool = False


@app.post("/api/chaos/config")
def set_chaos_config(cfg: ChaosConfig):
    # Registered before /api/chaos/{scenario} -- FastAPI matches routes in
    # declaration order, and the static path must win over the dynamic one
    # or every request for "config" gets swallowed as scenario="config".
    try:
        resp = requests.post(f"{_payments_url()}/chaos", json=cfg.model_dump(), timeout=5)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(e))


@app.post("/api/chaos/{scenario}")
def trigger_chaos(scenario: str):
    if scenario not in BUG_ENDPOINTS:
        raise HTTPException(status_code=404, detail=f"unknown scenario {scenario!r}")
    try:
        resp = requests.get(f"{_web_url()}{BUG_ENDPOINTS[scenario]}", timeout=6)
        return {"status": "triggered", "scenario": scenario, "upstream_status": resp.status_code}
    except requests.exceptions.ConnectionError:
        # The crash scenario is expected to do exactly this: the process
        # dies before it can respond. That's success, not an error.
        return {"status": "triggered", "scenario": scenario, "upstream_status": None, "note": "connection dropped (expected for crash)"}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(e))


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=int(os.environ.get("CONTROL_API_PORT", "8090")))
