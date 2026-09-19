"""Scripted plan assembly -- the design doc's own sanctioned substitute for
live Bedrock agent variability when time or access is short ("cached
responses and the scripted ... client", references/iterations.md's cut
order, item 6). This environment has no Bedrock access at all (see
docs/memory.md), so this is not a fallback here, it's the only option.

What a real agent would still need an LLM for -- reasoning about concrete
numeric args (which revision to roll back to, what desired_count is safe)
from live telemetry this module doesn't have -- stays the caller's
responsibility, passed in as `args`. What's implemented here is the part
that doesn't need a model at all: refusing to build a plan on an abstained
verdict, only choosing a tool the router/experience-filter actually offers
for this stage, and assembling a schema-valid ActionPlan with the
justification wired to the verdict that grounds it.
"""
from __future__ import annotations

from agents.router import stage_tools


def build_plan(
    plan_id: str,
    stage: str,
    verdict: dict,
    tool: str,
    args: dict,
    rollback: dict,
    expected_effect: dict,
    blast_radius: dict,
    store=None,
) -> dict | None:
    """Returns a schema-valid ActionPlan (schemas/action_plan.schema.json),
    or None if this plan must not be proposed at all: an abstained verdict,
    a verdict with no candidates, or a tool this stage doesn't offer (either
    wrong stage or filtered out by the experience filter for this entity).
    """
    if verdict.get("abstained") or not verdict.get("candidates"):
        return None

    top_entity = verdict["candidates"][0]["entity"]
    available = {t["tool"] for t in stage_tools(stage, store=store, entity=top_entity)}
    if tool not in available:
        return None

    return {
        "plan_id": plan_id,
        "incident_id": verdict["incident_id"],
        "stage": stage,
        "schema_version": 1,
        "actions": [
            {
                "id": "a1",
                "tool": tool,
                "args": args,
                "blast_radius": blast_radius,
                "rollback": rollback,
                "expected_effect": expected_effect,
                "justification_ref": f"{verdict['incident_id']}#candidates[0]",
            }
        ],
    }
