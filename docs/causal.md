# Causal-lite (person-b-brief.md task 16)

`causal/score.py` computes L2 (residual-from-parents z-score, via a linear fit on a known-good window) and L1 (correlation with the breached SLO, tiebreak only) for each node in a service DAG; `causal/falsify.py`'s `build_verdict` fuses them, runs a 200-shuffle permutation test on the top candidate's own good/current split, and sets `abstained` when `p > 0.05`. Produces a schema-valid `CausalVerdict` (`schemas/causal_verdict.schema.json`).

Dropped from the design doc's L1/L2/L3 stack: L3 (Shapley attribution via DoWhy) -- a heavy dependency for a signal the project's own brief says not to over-invest in. This module never fetches its own data (the DAG and the two windows are Person A's `causal/detector.py`/`topology.py`, not built); it's a pure function of what it's given, which is what makes it testable with a synthetic-but-structurally-realistic scenario (`causal/test_score.py`) instead of a real X-Ray account.

Two real bugs found and fixed while building this, worth knowing about if this code is ever touched again:
1. `fuse_ranks` originally weighed L1 and L2 equally via reciprocal-rank fusion. Since L1 (correlation on ~30 samples of largely independent services) is noisy, it could outrank a 40+ magnitude real anomaly. Fixed: L2 is the sort key, L1 only breaks an exact tie -- matching what the design doc says L1 is for.
2. The permutation test originally shuffled which node's *data* played which node's *structural role* in the DAG. That created arbitrary parent/regressor pairings for non-root nodes and let root-only self-baseline scoring pick up any node's raw shift, so the null distribution wasn't meaningful (a real anomaly still failed to reject the null). Fixed: it's now a standard two-sample permutation test -- shuffle the good/current *labels* within the top candidate's own pooled samples, keeping its DAG role and parent alignment fixed.

Verified robust across 5 seeds each for a real anomaly (never abstains, p ~ 0.003) and a null run (always abstains, p in 0.07-0.31).
