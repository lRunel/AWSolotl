"""Gate 4 -- risk score and the autonomy ladder.

A pure function of (plan, action, ctx), same discipline as Gate 2: nothing
here calls boto3 or a model. Precedents come from an optional
`ctx["memory_store"]` (a `memory.store.MemoryItemStore`); if none is given,
this falls back to "no history" (max novelty, zero historical failure
rate) rather than erroring, since a caller with no memory plane wired up
yet still needs a risk score.

    risk = 0.30*(1 - causal_confidence) + 0.20*blast_radius_norm
         + 0.25*irreversibility + 0.15*historical_failure_rate + 0.10*novelty

Risk only ever caps the autonomy level an action may use; it never denies
the action outright unless the caller explicitly asked to auto-run at a
level the risk band doesn't allow (`ctx["requested_autonomy"]`). A caller
that doesn't ask for auto-run always gets `decision: pass` with the risk and
cap attached, so a human or Gate 5 can use it downstream.

Set LOCKSTEP_STUB=1 to force the I0 fixed-pass stub instead of real
scoring -- kept as the demo's fixture-mode fallback per
references/branching.md, never deleted.
"""
from __future__ import annotations

import os
import time

_AUTONOMY_LEVELS = ["L0", "L1", "L2"]


def _autonomy_cap(risk: float) -> str:
    """Starting thresholds from the design doc, scoped to this project's
    L0-L2 ladder (references/iterations.md: "Autonomy ladder L0 to L2
    only"). Tuning these against the BrakeBench benign set is I5 work."""
    if risk < 0.30:
        return "L2"
    if risk < 0.70:
        return "L1"
    return "L0"


def _score_risk(action: dict, ctx: dict) -> tuple[float, dict]:
    blast_radius = action.get("blast_radius", {}) or {}

    causal_confidence = ctx.get("causal_confidence", 1.0)
    blast_radius_norm = ctx.get("blast_radius_norm", 0.0)
    irreversibility = ctx.get("irreversibility", 0.0)  # 0, 0.5, or 1, from Gate 3 (A)

    store = ctx.get("memory_store")
    entity = ctx.get("entity", "")
    if store is not None and entity:
        historical_failure_rate, novelty = store.precedent_stats(entity, action.get("tool", ""))
    else:
        historical_failure_rate, novelty = 0.0, 1.0

    risk = (
        0.30 * (1 - causal_confidence)
        + 0.20 * blast_radius_norm
        + 0.25 * irreversibility
        + 0.15 * historical_failure_rate
        + 0.10 * novelty
    )
    components = {
        "causal_confidence": causal_confidence,
        "blast_radius_norm": blast_radius_norm,
        "irreversibility": irreversibility,
        "historical_failure_rate": historical_failure_rate,
        "novelty": novelty,
        "data_destructive": bool(blast_radius.get("data_destructive", False)),
    }
    return risk, components


def gate4_score(plan: dict, action: dict, ctx: dict) -> dict:
    started = time.monotonic()
    if os.environ.get("LOCKSTEP_STUB") == "1":
        return _stub_pass(started)

    risk, components = _score_risk(action, ctx)
    cap = _autonomy_cap(risk)
    latency_ms = (time.monotonic() - started) * 1000

    requested = ctx.get("requested_autonomy")
    if requested is not None and _AUTONOMY_LEVELS.index(requested) > _AUTONOMY_LEVELS.index(cap):
        return {
            "gate": "risk",
            "decision": "deny",
            "reason_code": "autonomy_capped",
            "invariant": "RISK_CAP",
            "why": f"risk {risk:.2f} caps autonomy at {cap}, but {requested} auto-run was requested",
            "values": {**components, "risk": risk, "autonomy_cap": cap, "requested_autonomy": requested},
            "citation": None,
            "hint": f"resubmit for {cap} or lower, or route to human approval",
            "retries_left": 0,
            "latency_ms": latency_ms,
            "schema_version": 1,
        }

    return {
        "gate": "risk",
        "decision": "pass",
        "reason_code": "risk_scored",
        "latency_ms": latency_ms,
        "schema_version": 1,
        "values": {**components, "risk": risk, "autonomy_cap": cap},
    }


def _stub_pass(started: float) -> dict:
    return {
        "gate": "risk",
        "decision": "pass",
        "reason_code": "stub_fixed_low_risk",
        "latency_ms": (time.monotonic() - started) * 1000,
        "schema_version": 1,
    }
