"""End-to-end, no AWS: causal-lite verdict -> router stage -> scripted plan
-> schema validation -> Gate 2. This is as close to the full Plane 1/2/3
loop as this repo can demonstrate without Person A's orchestrator or a
Bedrock agent.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pytest
from jsonschema import Draft202012Validator
from referencing import Registry, Resource

import control.gate2 as gate2
from agents.plan_builder import build_plan
from agents.router import route_stage
from causal.falsify import build_verdict
from causal.test_score import _scenario

_SCHEMAS_DIR = Path(__file__).resolve().parent.parent / "schemas"


def _schema_registry():
    action_plan = json.loads((_SCHEMAS_DIR / "action_plan.schema.json").read_text(encoding="utf-8"))
    blast_radius = json.loads((_SCHEMAS_DIR / "blast_radius.schema.json").read_text(encoding="utf-8"))
    rollback = json.loads((_SCHEMAS_DIR / "rollback.schema.json").read_text(encoding="utf-8"))
    registry = Registry().with_resources(
        [
            (blast_radius["$id"], Resource.from_contents(blast_radius)),
            (rollback["$id"], Resource.from_contents(rollback)),
        ]
    )
    return action_plan, registry


def test_verdict_to_plan_to_gate2_full_loop() -> None:
    dag, good, current = _scenario(seed=1, inject_anomaly=True)
    verdict = build_verdict("inc_e2e", "web", ("T-10m", "T"), dag, good, current, n_shuffles=200, seed=1)
    assert verdict["abstained"] is False

    stage = route_stage({"snapshot_taken": True, "change_proximity_s": 300})
    assert stage == "remediate"

    plan = build_plan(
        plan_id="pln_e2e",
        stage=stage,
        verdict=verdict,
        tool="ecs.scale",
        args={"cluster": "demo", "service": "payments", "desired_count": 5},
        rollback={"tool": "ecs.scale", "args": {"cluster": "demo", "service": "payments", "desired_count": 4}},
        expected_effect={"metric": "web", "direction": "down", "within_s": 180},
        blast_radius={
            "accounts": ["123456789012"],
            "region": "us-east-1",
            "arns": ["arn:aws:ecs:us-east-1:123456789012:service/demo/payments"],
            "max_tasks": 5,
            "data_destructive": False,
        },
    )
    assert plan is not None
    assert plan["actions"][0]["justification_ref"] == "inc_e2e#candidates[0]"

    action_plan_schema, registry = _schema_registry()
    errors = list(Draft202012Validator(action_plan_schema, registry=registry).iter_errors(plan))
    assert not errors, errors

    import os

    os.environ["LOCKSTEP_STUB"] = "0"
    try:
        result = gate2.gate2_check(plan=plan, action=plan["actions"][0], ctx={"env": "staging"})
    finally:
        del os.environ["LOCKSTEP_STUB"]
    assert result["decision"] == "pass"


def test_abstained_verdict_never_produces_a_plan() -> None:
    dag, good, current = _scenario(seed=10, inject_anomaly=False)
    verdict = build_verdict("inc_null", "web", ("T-10m", "T"), dag, good, current, n_shuffles=200, seed=10)
    assert verdict["abstained"] is True

    plan = build_plan(
        plan_id="pln_null",
        stage="remediate",
        verdict=verdict,
        tool="ecs.scale",
        args={},
        rollback={"tool": "ecs.scale", "args": {}},
        expected_effect={"metric": "web", "direction": "down", "within_s": 180},
        blast_radius={
            "accounts": ["123456789012"],
            "region": "us-east-1",
            "arns": ["arn:aws:ecs:us-east-1:123456789012:service/demo/web"],
            "max_tasks": 1,
            "data_destructive": False,
        },
    )
    assert plan is None


def test_a_tool_this_stage_does_not_offer_is_refused() -> None:
    dag, good, current = _scenario(seed=1, inject_anomaly=True)
    verdict = build_verdict("inc_e2e", "web", ("T-10m", "T"), dag, good, current, n_shuffles=100, seed=1)

    plan = build_plan(
        plan_id="pln_bad_tool",
        stage="restore",  # only verify.slo is offered at this stage
        verdict=verdict,
        tool="ecs.rollback_to_revision",
        args={},
        rollback={"tool": "verify.slo", "args": {"metric": "x", "within_s": 1}},
        expected_effect={"metric": "web", "direction": "down", "within_s": 180},
        blast_radius={
            "accounts": ["123456789012"],
            "region": "us-east-1",
            "arns": ["arn:aws:ecs:us-east-1:123456789012:service/demo/web"],
            "max_tasks": 1,
            "data_destructive": False,
        },
    )
    assert plan is None
