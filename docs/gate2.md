# Gate 2 -- formal policy proof

`gate2_check` loads the twelve generic invariants from `invariants/generic/*.cedar` once at import time and evaluates them as a pure function of `(plan, action, ctx)` via `cedarpy`; org rules (`invariants/org/*.cedar`) are I3 work and not wired in yet. Depends on `schemas/gate_result.schema.json` and `schemas/deny_reason.schema.json` for the citation shape. Breaks if a new invariant's `@id` annotation is missing or duplicated (the deny's `invariant` field comes straight from `diagnostics.id_annotations_by_reason`), or if `context` ever omits a default for a field an invariant reads (Cedar errors on a missing attribute rather than treating it as absent).

Set `LOCKSTEP_STUB=1` to force the I0 fixed-pass stub instead of real Cedar evaluation -- kept as the demo's fixture-mode fallback per `references/branching.md`, never deleted.
