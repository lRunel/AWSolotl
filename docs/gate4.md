# Gate 4 -- risk score and autonomy ladder

I0 stub only: `gate4_score` always returns `decision: pass` at a fixed low risk behind `LOCKSTEP_STUB=1`. Depends on `schemas/gate_result.schema.json`. Breaks if `LOCKSTEP_STUB` is unset before the real risk formula and precedent lookup (I4) exist -- it raises `NotImplementedError` instead of silently passing, and real precedents must only ever raise this score, never grant.
