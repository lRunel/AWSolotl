"""Gate 4 -- risk score and the autonomy ladder.

I0 stub: always passes at a fixed low risk. Real scoring (confidence,
blast-radius norm, irreversibility, historical failure rate, novelty) and the
L0-L2 autonomy ladder are I4 work (references/person-b-brief.md, task 18).
Precedents from memory.lookup may only raise this score or force human
review; they may never grant permission on their own -- that rule holds even
once this stub is replaced.
"""
from __future__ import annotations

import os
import time


def gate4_score(plan: dict, action: dict, ctx: dict) -> dict:
    started = time.monotonic()
    if os.environ.get("LOCKSTEP_STUB", "1") == "1":
        return _stub_pass(started)
    raise NotImplementedError(
        "Real risk scoring is I4 work (causal/**, memory precedents). Do not "
        "unset LOCKSTEP_STUB until that exists and its tests pass."
    )


def _stub_pass(started: float) -> dict:
    return {
        "gate": "risk",
        "decision": "pass",
        "reason_code": "stub_fixed_low_risk",
        "latency_ms": (time.monotonic() - started) * 1000,
        "schema_version": 1,
    }
