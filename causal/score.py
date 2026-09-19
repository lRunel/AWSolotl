"""Causal-lite scoring (person-b-brief.md task 16). Takes a DAG and two
windows of per-node metric samples -- a known-good baseline and the
incident window -- and ranks nodes by how anomalous they are.

This module never fetches its own data: the DAG (X-Ray service graph plus
ECS ownership) and the two windows (CloudWatch) are Person A's territory
(`causal/detector.py`, `causal/topology.py`, not built). Handing this
module plain arrays keeps it testable without AWS.

Deliberately dropped from the design doc's L1/L2/L3 stack: L3 (Shapley-style
attribution via DoWhy). That's a heavy dependency for a signal the project's
own brief says not to over-invest in ("the brake is what gets judged").
L1 (correlation) and L2 (residual-from-parents) are implemented; L1 is only
ever a tiebreak, per the design doc.
"""
from __future__ import annotations

import numpy as np

Window = dict[str, list[float]]
Dag = dict[str, list[str]]


def residual_z_scores(dag: Dag, good_window: Window, current_window: Window) -> dict[str, float]:
    """L2: for each node, fit y = beta . parents + intercept on the good
    window, then score how badly the current window's actual value deviates
    from what that fit predicts given the current window's parent values.
    A root node (no parents) is scored against its own baseline instead.

    This is the actual causal signal, not just "which node moved the most":
    a node whose shift is fully explained by its parents' shift scores near
    zero even if its raw values moved a lot, because latency (or any metric)
    propagating through a call graph is expected behaviour, not the cause.
    """
    z_scores: dict[str, float] = {}
    for node, parents in dag.items():
        y_good = np.asarray(good_window[node], dtype=float)
        y_current = np.asarray(current_window[node], dtype=float)

        if not parents:
            baseline_std = y_good.std() or 1e-9
            z_scores[node] = float((y_current.mean() - y_good.mean()) / baseline_std)
            continue

        parent_good = np.column_stack([np.asarray(good_window[p], dtype=float) for p in parents])
        parent_current = np.column_stack([np.asarray(current_window[p], dtype=float) for p in parents])

        design_good = np.column_stack([parent_good, np.ones(len(y_good))])
        beta, *_ = np.linalg.lstsq(design_good, y_good, rcond=None)
        residual_good = y_good - design_good @ beta
        residual_std = residual_good.std() or 1e-9

        design_current = np.column_stack([parent_current, np.ones(len(y_current))])
        predicted_current = design_current @ beta
        residual_current = y_current - predicted_current
        z_scores[node] = float(residual_current.mean() / residual_std)

    return z_scores


def slo_correlations(current_window: Window, slo_node: str) -> dict[str, float]:
    """L1: Pearson correlation of each node's current-window series with the
    breached SLO's series. Tiebreak only -- never the primary rank."""
    slo_series = np.asarray(current_window[slo_node], dtype=float)
    correlations: dict[str, float] = {}
    for node, series in current_window.items():
        arr = np.asarray(series, dtype=float)
        if node == slo_node or arr.std() == 0 or slo_series.std() == 0:
            correlations[node] = 0.0
        else:
            correlations[node] = float(np.corrcoef(arr, slo_series)[0, 1])
    return correlations


def fuse_ranks(z_scores: dict[str, float], correlations: dict[str, float], k: int = 10) -> dict[str, float]:
    """Rank by L2 (residual z-score) magnitude; L1 correlation only breaks
    an exact tie. This is deliberately *not* a reciprocal-rank fusion that
    weighs both signals equally -- the design doc is explicit that L1 is a
    tiebreak, not a second vote, and correlation on a handful of largely
    independent services is noisy enough (see causal/test_score.py) that
    weighing it equally can outrank a real order-of-magnitude anomaly with
    coincidental noise. The returned score is a ranking score, not a
    calibrated probability -- schemas/causal_verdict.schema.json's
    `confidence` field must be labelled that way wherever it's shown.
    """
    nodes = list(z_scores)
    ordered = sorted(nodes, key=lambda n: (-abs(z_scores[n]), -abs(correlations.get(n, 0.0))))
    return {n: 1 / (k + rank + 1) for rank, n in enumerate(ordered)}
