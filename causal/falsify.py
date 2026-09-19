"""The honesty gate (person-b-brief.md task 16): a 200-shuffle permutation
test asking whether the top candidate's fused score is actually
distinguishable from what random chance would produce, and `build_verdict`,
which assembles the final `CausalVerdict` and sets `abstained` when the
falsification test fails.

A confident wrong root cause handed to an executor is the worst thing this
system can do (design doc, section 5.4). When `abstained` is true, nothing
destructive may follow: Cedar's INV-03 forbids it and Gate 4 refuses
auto-execution -- this module's only job is to decide that flag honestly.
"""
from __future__ import annotations

import hashlib
import json
import random
from datetime import datetime, timezone

from causal.score import Dag, Window, fuse_ranks, residual_z_scores, slo_correlations

_SCHEMA_VERSION = 1


def permutation_test(
    dag: Dag,
    good_window: Window,
    current_window: Window,
    n_shuffles: int = 200,
    seed: int | None = None,
) -> tuple[float, float]:
    """A standard two-sample permutation test on the top candidate's own
    good-vs-current split: pool its (and its parents', index-aligned)
    samples from both windows, repeatedly re-split that pool into two
    groups the same sizes as good/current purely at random, and recompute
    the same residual z-score each time. Returns (observed_z, p), where p is
    the fraction of random re-splits whose |z| is at least as extreme as the
    real good/current split's. A high p means the good/current boundary
    itself isn't doing any real work -- an arbitrary 50/50 split of the same
    pooled samples explains the data just as well.

    An earlier version of this test shuffled which node's data played which
    node's structural role in the DAG. That produced arbitrary
    parent/regressor pairings for non-root nodes (and let root-only
    self-baseline scoring pick up any node's raw shift), so the null
    distribution wasn't a meaningful "no real signal" baseline. Permuting
    group *labels* within one node's own pooled samples, instead of
    permuting *node identities* across structurally different roles, is the
    textbook two-sample permutation test and avoids that problem entirely.
    """
    z = residual_z_scores(dag, good_window, current_window)
    top_node = max(z, key=lambda n: abs(z[n]))
    observed_z = abs(z[top_node])

    parents = dag[top_node]
    y_good, y_current = good_window[top_node], current_window[top_node]
    n_good, n_current = len(y_good), len(y_current)
    pooled_y = list(y_good) + list(y_current)
    pooled_parents = {p: list(good_window[p]) + list(current_window[p]) for p in parents}

    rng = random.Random(seed)
    indices = list(range(n_good + n_current))
    single_node_dag = {top_node: parents}

    at_least_as_extreme = 0
    for _ in range(n_shuffles):
        shuffled = indices[:]
        rng.shuffle(shuffled)
        good_idx, current_idx = shuffled[:n_good], shuffled[n_good:]

        fake_good = {top_node: [pooled_y[i] for i in good_idx]}
        fake_current = {top_node: [pooled_y[i] for i in current_idx]}
        for p in parents:
            fake_good[p] = [pooled_parents[p][i] for i in good_idx]
            fake_current[p] = [pooled_parents[p][i] for i in current_idx]

        shuffled_z = residual_z_scores(single_node_dag, fake_good, fake_current)
        if abs(shuffled_z[top_node]) >= observed_z:
            at_least_as_extreme += 1

    # +1/+1 (Laplace) smoothing: a p-value of exactly 0.0 from a finite
    # sample overstates confidence no real test can have.
    p = (at_least_as_extreme + 1) / (n_shuffles + 1)
    return observed_z, p


def _sign(payload: dict) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return "sha256:" + hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def build_verdict(
    incident_id: str,
    slo: str,
    window: tuple[str, str],
    dag: Dag,
    good_window: Window,
    current_window: Window,
    top_n: int = 3,
    n_shuffles: int = 200,
    seed: int | None = None,
) -> dict:
    """Assembles a schema-valid CausalVerdict (schemas/causal_verdict.schema.json).
    Candidates are still reported even when abstained is true, so a human
    can see what the (untrusted) ranking thought -- but nothing downstream
    may treat an abstained verdict's candidates as grounds for a destructive
    action (Cedar INV-03).
    """
    z = residual_z_scores(dag, good_window, current_window)
    corr = slo_correlations(current_window, slo)
    fused = fuse_ranks(z, corr)
    observed_top, p = permutation_test(dag, good_window, current_window, n_shuffles=n_shuffles, seed=seed)

    ranked = sorted(fused.items(), key=lambda pair: -pair[1])[:top_n]
    candidates = [
        {
            "entity": node,
            "confidence": round(score, 4),
            "layer": "L2",
            "attribution": round(abs(z[node]), 4),
            "anomaly_class": "value",
            "evidence": [
                f"residual z-score {z[node]:.2f} vs its own parents' known-good fit",
                f"correlation {corr.get(node, 0.0):.2f} with {slo}",
            ],
        }
        for node, score in ranked
    ]

    passed = p <= 0.05
    verdict = {
        "incident_id": incident_id,
        "slo": slo,
        "window": list(window),
        "candidates": candidates,
        "falsification": {"p": round(p, 4), "passed": passed},
        "abstained": not passed,
        "ts": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "schema_version": _SCHEMA_VERSION,
    }
    verdict["sig"] = _sign(verdict)
    return verdict
