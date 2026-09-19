# Gate 4 -- risk score and autonomy ladder

`gate4_score` computes `risk = 0.30*(1-confidence) + 0.20*blast_radius_norm + 0.25*irreversibility + 0.15*historical_failure_rate + 0.10*novelty` from `ctx` and an optional `ctx["memory_store"]` precedent lookup (`memory/store.py:precedent_stats`), then maps it to an L0-L2 autonomy cap. It only denies when `ctx["requested_autonomy"]` exceeds that cap; with no requested level it always passes, carrying `risk`/`autonomy_cap` in `values` for a caller to act on. Precedents can only raise the score, never grant -- there is no code path from a `MemoryItemStore` lookup to a `pass`. Depends on `schemas/gate_result.schema.json`. Breaks if the risk-band thresholds (0.30/0.70, untuned against BrakeBench) ever get read as anything but starting values.

Set `LOCKSTEP_STUB=1` to force the I0 fixed-pass stub instead -- kept as the demo's fixture-mode fallback per `references/branching.md`, never deleted.
