# Gate 2 -- formal policy proof

I0 stub only: `gate2_check` always returns `decision: pass` behind `LOCKSTEP_STUB=1`, so Person A's orchestrator can wire Gates 1-5 before Cedar invariants exist. Depends on `schemas/gate_result.schema.json`. Breaks if `LOCKSTEP_STUB` is unset before `invariants/generic/*.cedar` and a Cedar loader are actually implemented -- it will raise `NotImplementedError` by design rather than silently pass.
