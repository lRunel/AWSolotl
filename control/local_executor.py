"""Local executor for the two demo-only tools (`demo.reset_chaos_config`,
`demo.restart_web_service`): the same role control/broker.py plays for real
AWS tools (ecs.*, sg.*), but the target is a local process this machine
already owns instead of an ExecRole session against AWS.

control/broker.py is untouched -- it is the real STS/ECS path and stays
Person A's when real credentials exist. This module is what the local
control-api (services/control-api) calls instead, because "restart the ECS
service" has no meaning against a laptop with no AWS account. Same
`execute(...) -> {"status": ...}` return shape as broker.execute, so the
caller doesn't need to know which one it's talking to.
"""
from __future__ import annotations

import logging
import time

import requests

logger = logging.getLogger("local_executor")

DEMO_TOOLS = {"demo.reset_chaos_config", "demo.restart_web_service"}


def execute(action: dict, *, supervisor) -> dict:
    """`supervisor` is a services.control_api.supervisor.Supervisor-shaped
    object (spawn/is_alive/restart) owned by the caller -- kept as a
    parameter rather than an import to avoid control/ importing the
    control-api service package."""
    tool = action.get("tool")
    args = action.get("args", {})

    if tool == "demo.reset_chaos_config":
        return _reset_chaos_config(args)
    if tool == "demo.restart_web_service":
        return _restart_web_service(args, supervisor)
    raise ValueError(f"local_executor cannot execute {tool}")


def _reset_chaos_config(args: dict) -> dict:
    payments_url = args.get("payments_url", "http://127.0.0.1:8081")
    try:
        resp = requests.post(
            f"{payments_url}/chaos",
            json={"latency_ms": 0, "error_rate": 0.0, "pool_leak": False},
            timeout=5,
        )
        resp.raise_for_status()
        return {"status": "success", "detail": "chaos_config reset to zero", "response": resp.json()}
    except Exception as e:  # noqa: BLE001 -- reported to the ledger, not swallowed
        return {"status": "failed", "detail": str(e)}


def _restart_web_service(args: dict, supervisor) -> dict:
    service = args.get("service", "web")
    try:
        supervisor.restart(service)
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            if supervisor.is_alive(service):
                return {"status": "success", "detail": f"{service} respawned and healthy"}
            time.sleep(0.25)
        return {"status": "failed", "detail": f"{service} did not become healthy within 10s"}
    except Exception as e:  # noqa: BLE001
        return {"status": "failed", "detail": str(e)}
