"""One permit case and one forbid case per generic invariant. An untested
forbid is a claim, not a control -- this file is what turns the twelve
invariants in invariants/generic/*.cedar into an actual control.
"""
from __future__ import annotations

import pytest

from control.gate2 import gate2_check

_DEFAULT_BLAST_RADIUS = {
    "accounts": ["123456789012"],
    "region": "us-east-1",
    "arns": ["arn:aws:ecs:us-east-1:123456789012:service/demo/svc"],
    "max_tasks": 4,
    "data_destructive": False,
}


@pytest.fixture(autouse=True)
def _real_gate2(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LOCKSTEP_STUB", "0")


def _action(tool: str, args: dict | None = None, blast_radius: dict | None = None) -> dict:
    return {
        "tool": tool,
        "args": args or {},
        "blast_radius": {**_DEFAULT_BLAST_RADIUS, **(blast_radius or {})},
    }


# (invariant_id, forbid_action, forbid_ctx, permit_action, permit_ctx)
CASES = [
    (
        "INV-01",
        _action("sg.authorize_ingress", {"security_group_id": "sg-1", "cidr": "0.0.0.0/0", "port": 22}),
        {},
        _action("sg.authorize_ingress", {"security_group_id": "sg-1", "cidr": "10.0.0.0/8", "port": 22}),
        {},
    ),
    (
        "INV-02",
        _action("ecs.scale", {"cluster": "demo", "service": "payments-api", "desired_count": 1}),
        {"env": "prod", "prev_task_count": 6},
        _action("ecs.scale", {"cluster": "demo", "service": "payments-api", "desired_count": 5}),
        {"env": "prod", "prev_task_count": 6},
    ),
    (
        "INV-03",
        _action("ecs.rollback_to_revision", blast_radius={"data_destructive": True}),
        {"causal_abstained": True},
        _action("ecs.rollback_to_revision", blast_radius={"data_destructive": True}),
        {"causal_abstained": False},
    ),
    (
        "INV-04",
        _action("verify.slo", {"metric": "checkout.p99", "within_s": 60}),
        {"change_freeze": True, "human_override": False},
        _action("verify.slo", {"metric": "checkout.p99", "within_s": 60}),
        {"change_freeze": True, "human_override": True},
    ),
    (
        "INV-05",
        _action("ddb.delete_table"),
        {},
        _action("verify.slo", {"metric": "checkout.p99", "within_s": 60}),
        {},
    ),
    (
        "INV-06",
        _action("iam.attach_policy"),
        {"new_access_beyond_declared": True},
        _action("iam.attach_policy"),
        {"new_access_beyond_declared": False},
    ),
    (
        "INV-07",
        _action("cloudtrail.stop_logging"),
        {},
        _action("verify.slo", {"metric": "checkout.p99", "within_s": 60}),
        {},
    ),
    (
        "INV-08",
        _action("kms.schedule_key_deletion"),
        {"kms_key_in_use": True},
        _action("kms.schedule_key_deletion"),
        {"kms_key_in_use": False},
    ),
    (
        "INV-09",
        _action("ecs.rollback_to_revision", {"cluster": "demo", "service": "payments-api", "to_revision": 9}),
        {"image_max_severity": "CRITICAL"},
        _action("ecs.rollback_to_revision", {"cluster": "demo", "service": "payments-api", "to_revision": 9}),
        {"image_max_severity": "LOW"},
    ),
    (
        "INV-10",
        _action("verify.slo", {"metric": "checkout.p99", "within_s": 60}),
        {"az_count": 2},
        _action("verify.slo", {"metric": "checkout.p99", "within_s": 60}),
        {"az_count": 1},
    ),
    (
        "INV-11",
        _action("ecs.restart_service", {"cluster": "demo", "service": "payments-api"}),
        {"write_lock_held": True},
        _action("ecs.restart_service", {"cluster": "demo", "service": "payments-api"}),
        {"write_lock_held": False},
    ),
    (
        "INV-12",
        _action("verify.slo", {"metric": "checkout.p99", "within_s": 60}),
        {"declared_account": "999999999999"},
        _action("verify.slo", {"metric": "checkout.p99", "within_s": 60}),
        {"declared_account": "123456789012"},
    ),
]


@pytest.mark.parametrize("invariant_id, action, ctx, _pa, _pc", CASES, ids=[c[0] for c in CASES])
def test_forbid_case_denies_with_correct_invariant(invariant_id, action, ctx, _pa, _pc) -> None:
    result = gate2_check(plan={}, action=action, ctx=ctx)
    assert result["decision"] == "deny", f"{invariant_id} should have denied {action} / {ctx}"
    assert result["invariant"] == invariant_id
    assert result["why"]
    assert result["retries_left"] == 2


@pytest.mark.parametrize("invariant_id, _fa, _fc, action, ctx", CASES, ids=[c[0] for c in CASES])
def test_permit_case_passes(invariant_id, _fa, _fc, action, ctx) -> None:
    result = gate2_check(plan={}, action=action, ctx=ctx)
    assert result["decision"] == "pass", f"{invariant_id}'s permit case should have passed: {result}"
