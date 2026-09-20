"""Local process supervisor for the two demo-app services.

There is no ECS here -- no AWS account in this environment at all (see
docs/AGENTS.md) -- so "restart the service" has to mean something real on a
laptop: kill and respawn a uvicorn subprocess this supervisor owns. This is
the local stand-in for what control/broker.py does against a real ExecRole
session; control/local_executor.py calls into this class rather than boto3.
"""
from __future__ import annotations

import os
import subprocess
import sys
import threading
import time
from dataclasses import dataclass

import requests

_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


@dataclass
class ServiceSpec:
    name: str
    cwd: str
    port: int
    health_url: str
    env: dict


def _default_services() -> dict[str, ServiceSpec]:
    payments_port = int(os.environ.get("PAYMENTS_PORT", "8081"))
    web_port = int(os.environ.get("WEB_PORT", "8080"))
    return {
        "payments": ServiceSpec(
            name="payments",
            cwd=os.path.join(_REPO_ROOT, "services", "demo-app", "payments"),
            port=payments_port,
            health_url=f"http://127.0.0.1:{payments_port}/health",
            env={"AWS_REGION": os.environ.get("AWS_REGION", "us-east-1")},
        ),
        "web": ServiceSpec(
            name="web",
            cwd=os.path.join(_REPO_ROOT, "services", "demo-app", "web"),
            port=web_port,
            health_url=f"http://127.0.0.1:{web_port}/api/health",
            env={"PAYMENTS_API_URL": f"http://127.0.0.1:{payments_port}"},
        ),
    }


class Supervisor:
    def __init__(self, services: dict[str, ServiceSpec] | None = None) -> None:
        self.services = services or _default_services()
        self._procs: dict[str, subprocess.Popen] = {}
        self._lock = threading.Lock()
        self.events: list[dict] = []  # simple in-memory audit trail for the /api/health view

    def _log(self, kind: str, service: str, detail: str) -> None:
        self.events.append({"ts": time.time(), "kind": kind, "service": service, "detail": detail})
        self.events = self.events[-200:]

    def spawn(self, name: str) -> None:
        spec = self.services[name]
        with self._lock:
            old = self._procs.get(name)
            if old is not None and old.poll() is None:
                return  # already running
            env = {**os.environ, **spec.env, "PORT": str(spec.port)}
            proc = subprocess.Popen(
                [sys.executable, "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", str(spec.port)],
                cwd=spec.cwd,
                env=env,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            self._procs[name] = proc
        self._log("spawn", name, f"pid={proc.pid} port={spec.port}")

    def spawn_all(self) -> None:
        for name in self.services:
            self.spawn(name)

    def process_alive(self, name: str) -> bool:
        proc = self._procs.get(name)
        return proc is not None and proc.poll() is None

    def is_alive(self, name: str) -> bool:
        """True only if the process is running AND answering HTTP health
        checks -- a hung event loop (the cpu-spike bug) is alive-but-broken,
        which the watchdog should still treat as unhealthy."""
        if not self.process_alive(name):
            return False
        try:
            resp = requests.get(self.services[name].health_url, timeout=1.5)
            return resp.status_code == 200
        except Exception:
            return False

    def restart(self, name: str) -> None:
        with self._lock:
            proc = self._procs.get(name)
        if proc is not None and proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait(timeout=5)
        self._log("restart", name, "terminated; respawning")
        self.spawn(name)

    def shutdown(self) -> None:
        with self._lock:
            procs = list(self._procs.values())
        for proc in procs:
            if proc.poll() is None:
                proc.terminate()
        for proc in procs:
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
