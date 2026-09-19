"""residual_z_scores / slo_correlations / fuse_ranks against a synthetic
but structurally realistic incident: payments (root cause) degrades, and
its effect propagates -- damped -- through cart and web. Six independent
noise services are included so ranking has to actually discriminate signal
from coincidental correlation, not just compare three numbers.
"""
from __future__ import annotations

import numpy as np
import pytest

from causal.score import fuse_ranks, residual_z_scores, slo_correlations

_NOISE_NODES = ["inventory", "shipping", "auth", "notifications", "search", "recommendations"]


def _scenario(seed: int, inject_anomaly: bool) -> tuple[dict, dict, dict]:
    rng = np.random.default_rng(seed)
    n = 30
    dag = {"payments": [], "cart": ["payments"], "web": ["cart"], **{nn: [] for nn in _NOISE_NODES}}

    payments_good = rng.normal(50, 3, n)
    cart_good = 0.2 * payments_good + 40 + rng.normal(0, 2, n)
    web_good = 0.2 * cart_good + 50 + rng.normal(0, 2, n)
    good = {"payments": payments_good.tolist(), "cart": cart_good.tolist(), "web": web_good.tolist()}

    payments_mean = 150 if inject_anomaly else 50
    payments_current = rng.normal(payments_mean, 5 if inject_anomaly else 3, n)
    cart_current = 0.2 * payments_current + 40 + rng.normal(0, 2, n)
    web_current = 0.2 * cart_current + 50 + rng.normal(0, 2, n)
    current = {
        "payments": payments_current.tolist(),
        "cart": cart_current.tolist(),
        "web": web_current.tolist(),
    }

    for nn in _NOISE_NODES:
        baseline = rng.normal(30, 2, n)
        good[nn] = baseline.tolist()
        current[nn] = (baseline + rng.normal(0, 2, n)).tolist()

    return dag, good, current


@pytest.fixture
def anomalous_scenario():
    return _scenario(seed=1, inject_anomaly=True)


def test_root_cause_has_the_largest_residual_z(anomalous_scenario) -> None:
    dag, good, current = anomalous_scenario
    z = residual_z_scores(dag, good, current)
    top_node = max(z, key=lambda n: abs(z[n]))
    assert top_node == "payments"
    assert abs(z["payments"]) > 20  # a real, large anomaly
    # cart and web inherit the shift but it's *explained* by their parent,
    # so their residual should be far smaller than payments' own, even
    # though their raw values also moved a lot.
    assert abs(z["cart"]) < abs(z["payments"]) / 2
    assert abs(z["web"]) < abs(z["cart"])


def test_noise_nodes_have_small_residuals(anomalous_scenario) -> None:
    dag, good, current = anomalous_scenario
    z = residual_z_scores(dag, good, current)
    for node in _NOISE_NODES:
        assert abs(z[node]) < 3


def test_fuse_ranks_puts_the_causal_chain_first(anomalous_scenario) -> None:
    dag, good, current = anomalous_scenario
    z = residual_z_scores(dag, good, current)
    corr = slo_correlations(current, "web")
    fused = fuse_ranks(z, corr)
    ranked = sorted(fused, key=lambda n: -fused[n])
    assert ranked[:3] == ["payments", "cart", "web"]


def test_fuse_ranks_is_not_derailed_by_noisy_correlation() -> None:
    """Regression test for a real bug: weighing L1 (correlation) equally
    with L2 (residual z) via reciprocal-rank fusion let coincidental
    correlation on pure-noise nodes outrank a 40+ magnitude real anomaly.
    L1 must only break exact L2 ties."""
    z = {"real_cause": 40.0, "noise_a": 0.1, "noise_b": 0.2}
    # noise_b has the "best" correlation despite being irrelevant
    corr = {"real_cause": -0.1, "noise_a": 0.05, "noise_b": 0.9}
    fused = fuse_ranks(z, corr)
    assert max(fused, key=lambda n: fused[n]) == "real_cause"
