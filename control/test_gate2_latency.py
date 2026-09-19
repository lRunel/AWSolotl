"""I1 exit test requirement: Gate 2 p95 under 300 ms warm
(references/person-b-brief.md). This is an in-process sanity check, not a
Lambda cold-start benchmark -- it exists to catch an accidental O(n) policy
reload or similar regression, not to certify production latency.
"""
from __future__ import annotations

import statistics

import pytest

from control.gate2 import gate2_check

_ACTION = {
    "tool": "verify.slo",
    "args": {"metric": "checkout.p99", "within_s": 60},
    "blast_radius": {
        "accounts": ["123456789012"],
        "region": "us-east-1",
        "arns": ["arn:aws:cloudwatch:us-east-1:123456789012:metric/checkout"],
        "max_tasks": 0,
        "data_destructive": False,
    },
}


def test_gate2_p95_latency_under_300ms_warm(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LOCKSTEP_STUB", "0")
    gate2_check(plan={}, action=_ACTION, ctx={})  # warm-up call

    samples = [gate2_check(plan={}, action=_ACTION, ctx={})["latency_ms"] for _ in range(50)]
    p95 = statistics.quantiles(samples, n=100)[94]
    assert p95 < 300, f"p95 latency {p95:.2f}ms exceeds the 300ms budget"
