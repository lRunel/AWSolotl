"""The honesty gate. A confident wrong root cause handed to an executor is
the worst thing this system can do, so these tests check both directions:
a real signal must not abstain, and a null run must.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pytest
from jsonschema import Draft202012Validator

from causal.falsify import build_verdict, permutation_test
from causal.test_score import _scenario

_CAUSAL_VERDICT_SCHEMA = json.loads(
    (Path(__file__).resolve().parent.parent / "schemas" / "causal_verdict.schema.json").read_text(
        encoding="utf-8"
    )
)


@pytest.mark.parametrize("seed", [1, 2, 3])
def test_real_anomaly_does_not_abstain(seed: int) -> None:
    dag, good, current = _scenario(seed=seed, inject_anomaly=True)
    verdict = build_verdict("inc_test", "web", ("T-10m", "T"), dag, good, current, n_shuffles=300, seed=seed)
    assert verdict["abstained"] is False
    assert verdict["falsification"]["p"] <= 0.05
    assert verdict["candidates"][0]["entity"] == "payments"


@pytest.mark.parametrize("seed", [10, 11, 12])
def test_null_run_abstains(seed: int) -> None:
    dag, good, current = _scenario(seed=seed, inject_anomaly=False)
    verdict = build_verdict("inc_null", "web", ("T-10m", "T"), dag, good, current, n_shuffles=300, seed=seed)
    assert verdict["abstained"] is True
    assert verdict["falsification"]["p"] > 0.05


def test_verdict_is_schema_valid_in_both_outcomes() -> None:
    for inject in (True, False):
        dag, good, current = _scenario(seed=1, inject_anomaly=inject)
        verdict = build_verdict("inc", "web", ("T-10m", "T"), dag, good, current, n_shuffles=100, seed=1)
        Draft202012Validator(_CAUSAL_VERDICT_SCHEMA).validate(verdict)


def test_permutation_test_is_deterministic_given_a_seed() -> None:
    dag, good, current = _scenario(seed=1, inject_anomaly=True)
    z1, p1 = permutation_test(dag, good, current, n_shuffles=200, seed=42)
    z2, p2 = permutation_test(dag, good, current, n_shuffles=200, seed=42)
    assert z1 == z2
    assert p1 == p2


def test_p_value_is_never_exactly_zero() -> None:
    # Laplace smoothing: a finite permutation sample can never justify p=0.
    dag, good, current = _scenario(seed=1, inject_anomaly=True)
    _, p = permutation_test(dag, good, current, n_shuffles=50, seed=1)
    assert p > 0.0


def test_abstained_verdict_still_reports_candidates_for_a_human_to_see() -> None:
    dag, good, current = _scenario(seed=10, inject_anomaly=False)
    verdict = build_verdict("inc_null", "web", ("T-10m", "T"), dag, good, current, n_shuffles=200, seed=10)
    assert verdict["abstained"] is True
    assert len(verdict["candidates"]) > 0
