"""The self-healing loop: detect -> propose a plan -> run it through the
real Gates 1-5 -> execute locally -> record to the local ledger.

This intentionally reuses Person A/B's real gate modules (control.gate1-5)
and the real ActionPlan/BlastRadius/Rollback schemas rather than a parallel
toy version, so a plan that passes here would also pass the real Lambda
orchestrator once someone points control.ledger/control.broker at actual
AWS credentials. The only two things that are local-only are where the
ledger is written (control.local_ledger, not DynamoDB) and how a plan is
executed (control.local_executor + Supervisor, not the STS broker).
"""
from __future__ import annotations

import logging
import threading
import time
import uuid
from statistics import median

import requests

from control import gate1, gate2, gate3, gate4, gate5
from control import local_executor, local_ledger

logger = logging.getLogger("watchdog")

_BLAST_RADIUS_BY_SERVICE = {
    "payments": {
        "accounts": ["000000000000"],
        "region": "us-east-1",
        "arns": ["arn:aws:local:us-east-1:000000000000:service/demo/payments"],
        "max_tasks": 1,
        "data_destructive": False,
    },
    "web": {
        "accounts": ["000000000000"],
        "region": "us-east-1",
        "arns": ["arn:aws:local:us-east-1:000000000000:service/demo/web"],
        "max_tasks": 1,
        "data_destructive": False,
    },
}

_GATE_SEQUENCE = [
    (gate1.check, "G1"),
    (gate2.gate2_check, "G2"),
    (gate3.check, "G3"),
    (gate4.gate4_score, "G4"),
    (gate5.check, "G5"),
]


def _token_for(incident_id: str, tool: str) -> dict:
    return {
        "incident_id": incident_id,
        "tools": [tool],
        "revoked": False,
        "expires_at": int(time.time()) + 900,
    }


def _build_plan(incident_id: str, service: str, tool: str, args: dict) -> dict:
    radius = _BLAST_RADIUS_BY_SERVICE[service]
    action = {
        "id": "a1",
        "tool": tool,
        "args": args,
        "blast_radius": radius,
        "rollback": {"tool": "verify.slo", "args": {"metric": "checkout.p99", "within_s": 60}},
        "expected_effect": {"metric": "checkout.p99", "direction": "down", "within_s": 60},
        "justification_ref": f"{incident_id}#watchdog",
    }
    plan = {
        "plan_id": f"plan_{uuid.uuid4().hex[:12]}",
        "incident_id": incident_id,
        "stage": "remediate",
        "schema_version": 1,
        "actions": [action],
    }
    return plan


def run_plan_through_gates(plan: dict, supervisor) -> dict:
    """Runs Gates 1-5 in order, stopping at the first deny, then executes
    and writes exactly one ledger record either way -- same shape the real
    orchestrator (control/orchestrator.py) produces."""
    action = plan["actions"][0]
    incident_id = plan["incident_id"]
    tool = action["tool"]

    ctx = {
        "actor": "watchdog",
        "token_record": _token_for(incident_id, tool),
        "simulated_arns": action["blast_radius"]["arns"],
        "history": [],
        "metrics_trend": "stable",
    }

    gates_results = {}
    for gate_check, name in _GATE_SEQUENCE:
        result = gate_check(plan, action, ctx)
        gates_results[name] = result
        if result.get("decision") != "pass":
            record = local_ledger.append_record(
                incident_id=incident_id,
                action=action,
                gates=gates_results,
                causal_basis={"detector": "mad_z_score", "source": "local watchdog"},
                diff={},
                result=f"deny at {name}: {result.get('why')}",
                actor="watchdog",
            )
            logger.warning("Plan %s denied at %s: %s", plan["plan_id"], name, result.get("why"))
            return record

    exec_result = local_executor.execute(action, supervisor=supervisor)
    record = local_ledger.append_record(
        incident_id=incident_id,
        action=action,
        gates=gates_results,
        causal_basis={"detector": "mad_z_score", "source": "local watchdog"},
        diff=exec_result,
        result="executed" if exec_result.get("status") == "success" else f"execution_failed: {exec_result.get('detail')}",
        actor="watchdog",
    )
    return record


class MadDetector:
    """Same z-score math as causal/detector.py, sourced from local samples
    instead of CloudWatch (there is no CloudWatch here -- see that module's
    docstring). A rolling window of the last `window` /checkout latencies,
    same formula: z = |latest - median| / max(1.4826 * MAD, floor)."""

    def __init__(self, window: int = 30, z_threshold: float = 5.0) -> None:
        self.window = window
        self.z_threshold = z_threshold
        self._samples: list[float] = []

    def add(self, value: float) -> float | None:
        self._samples.append(value)
        self._samples = self._samples[-self.window :]
        if len(self._samples) < 6:
            return None
        med = median(self._samples)
        mad = 1.4826 * median([abs(x - med) for x in self._samples])
        floor = max(0.05 * med, 10.0)
        latest = self._samples[-1]
        z = abs(latest - med) / max(mad, floor)
        return z

    def is_incident(self, value: float) -> bool:
        z = self.add(value)
        return z is not None and z > self.z_threshold


class Watchdog:
    """Background thread: probes payments/web every `interval`s, feeds
    /checkout latency into the MAD detector, and drives dead/unhealthy
    services through the real gate-and-execute loop above."""

    def __init__(self, supervisor, interval: float = 1.5) -> None:
        self.supervisor = supervisor
        self.interval = interval
        self.detector = MadDetector()
        self.recent_ledger: list[dict] = []
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self.last_incident: dict | None = None

    def start(self) -> None:
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()

    def _loop(self) -> None:
        payments_url = f"http://127.0.0.1:{self.supervisor.services['payments'].port}"
        while not self._stop.is_set():
            self._probe_web()
            self._probe_payments(payments_url)
            time.sleep(self.interval)

    def _probe_web(self) -> None:
        if self.supervisor.process_alive("web") and self.supervisor.is_alive("web"):
            return
        incident_id = f"inc_{uuid.uuid4().hex[:10]}"
        logger.warning("web service unhealthy -- proposing restart (incident %s)", incident_id)
        plan = _build_plan(incident_id, "web", "demo.restart_web_service", {"service": "web"})
        record = run_plan_through_gates(plan, self.supervisor)
        self.last_incident = record

    def _probe_payments(self, payments_url: str) -> None:
        try:
            start = time.monotonic()
            resp = requests.get(f"{payments_url}/checkout", timeout=4)
            latency_ms = (time.monotonic() - start) * 1000
            errored = resp.status_code >= 500
        except Exception:
            latency_ms = 4000.0
            errored = True

        incident = self.detector.is_incident(latency_ms) or errored
        if not incident:
            return

        incident_id = f"inc_{uuid.uuid4().hex[:10]}"
        logger.warning(
            "payments-api degraded (latency=%.0fms, error=%s) -- proposing chaos reset (incident %s)",
            latency_ms, errored, incident_id,
        )
        plan = _build_plan(
            incident_id, "payments", "demo.reset_chaos_config", {"payments_url": payments_url}
        )
        record = run_plan_through_gates(plan, self.supervisor)
        self.last_incident = record
        # A fix was just applied -- drop stale samples so we don't
        # immediately re-trigger on the same spike while it settles.
        self.detector._samples.clear()
