"""Extends test_gate2_org_rules.py's single-rule (ORG-03) scenario to all
five signed rules loaded together. This is closer to what Gate 2 will
actually see in the demo: several org rules plus the twelve generic
invariants, all in one PolicySet, each firing only for its own action.
"""
from __future__ import annotations

from pathlib import Path

import pytest

import control.gate2 as gate2
from memory.seed_org_rules import sign_all


def _action(tool: str, entity: str) -> dict:
    return {
        "tool": tool,
        "args": {"service": entity},
        "blast_radius": {
            "accounts": ["123456789012"],
            "region": "us-east-1",
            "arns": [f"arn:aws:ecs:us-east-1:123456789012:service/demo/{entity}"],
            "max_tasks": 4,
            "data_destructive": False,
        },
    }


def _sg_ingress_action(cidr: str, port: int = 22) -> dict:
    return {
        "tool": "sg.authorize_ingress",
        "args": {"security_group_id": "sg-1", "cidr": cidr, "port": port},
        "blast_radius": {
            "accounts": ["123456789012"],
            "region": "us-east-1",
            "arns": ["arn:aws:ec2:us-east-1:123456789012:security-group/sg-1"],
            "max_tasks": 0,
            "data_destructive": False,
        },
    }


@pytest.fixture(autouse=True)
def _real_gate2(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LOCKSTEP_STUB", "0")


@pytest.fixture
def org_dir_with_all_rules(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    directory = tmp_path / "org"
    monkeypatch.setattr(gate2, "_ORG_DIR", directory)
    sign_all(directory)
    return directory


def test_restart_during_batch_is_still_denied_alongside_the_others(org_dir_with_all_rules: Path) -> None:
    result = gate2.gate2_check(
        plan={},
        action=_action("ecs.restart_service", "payments-api"),
        ctx={"current_window": "batch"},
    )
    assert result["decision"] == "deny"
    assert result["invariant"] == "ORG-03"


def test_failover_without_human_approval_is_denied(org_dir_with_all_rules: Path) -> None:
    result = gate2.gate2_check(
        plan={}, action=_action("rds.failover", "primary-db"), ctx={"human_approved": False}
    )
    assert result["decision"] == "deny"
    assert result["invariant"] == "ORG-04"
    assert result["citation"]["approved_by"] == "sre-lead"


def test_failover_with_human_approval_passes(org_dir_with_all_rules: Path) -> None:
    result = gate2.gate2_check(
        plan={}, action=_action("rds.failover", "primary-db"), ctx={"human_approved": True}
    )
    assert result["decision"] == "pass"


def test_rollback_without_snapshot_is_denied(org_dir_with_all_rules: Path) -> None:
    result = gate2.gate2_check(
        plan={},
        action=_action("ecs.rollback_to_revision", "orders-db"),
        ctx={"precondition_met": False},
    )
    assert result["decision"] == "deny"
    assert result["invariant"] == "ORG-05"
    assert "snapshot_taken" in result["why"]


def test_rollback_with_snapshot_passes(org_dir_with_all_rules: Path) -> None:
    result = gate2.gate2_check(
        plan={},
        action=_action("ecs.rollback_to_revision", "orders-db"),
        ctx={"precondition_met": True},
    )
    assert result["decision"] == "pass"


def test_prod_change_during_freeze_without_override_is_denied(org_dir_with_all_rules: Path) -> None:
    result = gate2.gate2_check(
        plan={},
        action=_action("ecs.scale", "cart-api"),
        ctx={"env": "prod", "current_window": "blackfriday", "human_override": False},
    )
    assert result["decision"] == "deny"
    assert result["invariant"] == "ORG-06"
    assert result["citation"]["approved_by"] == "vp-eng"


def test_prod_change_during_freeze_with_override_passes(org_dir_with_all_rules: Path) -> None:
    result = gate2.gate2_check(
        plan={},
        action=_action("ecs.scale", "cart-api"),
        ctx={"env": "prod", "current_window": "blackfriday", "human_override": True},
    )
    assert result["decision"] == "pass"


def test_ingress_from_decommissioned_range_is_denied(org_dir_with_all_rules: Path) -> None:
    result = gate2.gate2_check(plan={}, action=_sg_ingress_action("203.0.113.0/24"), ctx={})
    assert result["decision"] == "deny"
    assert result["invariant"] == "ORG-07"
    assert result["citation"]["source_ref"] == "slack:incident-2025-09-payments#1757754000.000100"


def test_ingress_from_other_ranges_passes(org_dir_with_all_rules: Path) -> None:
    result = gate2.gate2_check(plan={}, action=_sg_ingress_action("10.0.0.0/8"), ctx={})
    assert result["decision"] == "pass"


def test_rules_do_not_cross_fire_on_unrelated_actions(org_dir_with_all_rules: Path) -> None:
    # verify.slo on payments-api matches none of the signed org rules' tools
    # or entities, and touches no generic invariant either.
    result = gate2.gate2_check(
        plan={},
        action={
            "tool": "verify.slo",
            "args": {"metric": "checkout.p99", "within_s": 60},
            "blast_radius": {
                "accounts": ["123456789012"],
                "region": "us-east-1",
                "arns": ["arn:aws:cloudwatch:us-east-1:123456789012:metric/checkout"],
                "max_tasks": 0,
                "data_destructive": False,
            },
        },
        ctx={},
    )
    assert result["decision"] == "pass"
