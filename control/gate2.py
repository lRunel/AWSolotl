"""Gate 2 -- formal policy proof (Cedar generic invariants + signed org rules).

I0 stub: always returns a pass, so Person A's orchestrator can wire the full
G1-G5 chain today without waiting on Cedar. Real evaluation against
invariants/generic/*.cedar and invariants/org/*.cedar is I1/I3 work
(references/person-b-brief.md, tasks 6-7 and 12-14).

Kept behind LOCKSTEP_STUB=1 rather than deleted once the real implementation
lands, per references/branching.md: the stub is what lets the demo fall back
to a known-good gate result if the real one breaks on stage.
"""
from __future__ import annotations

import os
import time


def gate2_check(plan: dict, action: dict, ctx: dict) -> dict:
    started = time.monotonic()
    if os.environ.get("LOCKSTEP_STUB", "1") == "1":
        return _stub_pass(started)
    raise NotImplementedError(
        "Real Cedar evaluation is I1/I3 work (invariants/generic/*.cedar, "
        "invariants/org/*.cedar). Do not unset LOCKSTEP_STUB until that "
        "exists and its tests pass."
    )


def _stub_pass(started: float) -> dict:
    return {
        "gate": "proof",
        "decision": "pass",
        "reason_code": "stub_always_pass",
        "latency_ms": (time.monotonic() - started) * 1000,
        "schema_version": 1,
    }
