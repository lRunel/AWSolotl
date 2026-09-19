"""Stage router: rules, not a model. This is deliberately the dumbest part
of Plane 2 -- "LLMs routing LLMs is where live demos die" (design doc,
section 3.4) -- so a demoable, testable router exists even though the
Bedrock agent it would hand off to (person-b-brief.md task 17) needs AWS
access this environment doesn't have.

Rules are evaluated top to bottom; the first match wins
(Lockstep-System-Design-and-Team-Plan.md section 6.1):

    security_event or blast_growing  -> CONTAIN
    not snapshot_taken                -> PRESERVE
    change_proximity_s < 15 minutes   -> REMEDIATE (rollback path)
    recurrence_count >= 2             -> HARDEN (IaC pull request, never applied)
    otherwise                         -> RESTORE
"""
from __future__ import annotations

from control.registry import ToolSpec, list_agent_tools

_REMEDIATE_WINDOW_S = 15 * 60


def route_stage(ctx: dict) -> str:
    if ctx.get("security_event") or ctx.get("blast_growing"):
        return "contain"
    if not ctx.get("snapshot_taken", False):
        return "preserve"
    if ctx.get("change_proximity_s", float("inf")) < _REMEDIATE_WINDOW_S:
        return "remediate"
    if ctx.get("recurrence_count", 0) >= 2:
        return "harden"
    return "restore"


def stage_tools(stage: str, store=None, entity: str | None = None) -> list[ToolSpec]:
    """The agent's tool list for a stage, with the experience filter applied:
    a tool this exact (entity, tool) precedent shows as 100% failures in the
    seeded postmortem history is removed for this turn, per the design
    doc's "tools with a made_it_worse history are removed from the agent's
    tool list" rule (section 6.4). This filters the action space; it never
    grants anything a gate would otherwise deny -- Gate 2/4 still run
    regardless of what made it into this list.
    """
    tools = list_agent_tools(stage=stage)
    if store is None or entity is None:
        return tools
    return [t for t in tools if not _made_it_worse(store, entity, t["tool"])]


def _made_it_worse(store, entity: str, tool: str) -> bool:
    failure_rate, _novelty = store.precedent_stats(entity, tool)
    return failure_rate >= 1.0
