"""Extends test_gate2_org_rules.py's single-rule (ORG-03) scenario to four
signed rules loaded together -- one per real corpus document besides ORG-03
itself (the fifth template, cidr_deny, has no real source yet since it
needs the Slack export connector). This is closer to what Gate 2 will
actually see in the demo: several org rules plus the twelve generic
invariants, all in one PolicySet, each firing only for its own action.
"""
from __future__ import annotations

from pathlib import Path

import pytest

import control.gate2 as gate2
from connectors.base import content_hash
from memory.compile import write_signed_rule

_CORPUS = Path(__file__).resolve().parent.parent / "memory" / "corpus"


def _hash_of(relative_path: str) -> str:
    return content_hash((_CORPUS / relative_path).read_text(encoding="utf-8"))


ORG_04_REQUIRES_HUMAN = {
    "rule_id": "ORG-04",
    "template": "requires_human",
    "slots": {"tool": "rds.failover", "entity": "primary-db"},
    "source_ref": "gh:acme/infra/postmortems/2025-06-db-failover.md",
    "source_hash": _hash_of("postmortems/2025-06-db-failover.md"),
    "status": "signed",
    "approved_by": "sre-lead",
    "approved_at": "2026-09-19T10:00:00Z",
}

ORG_05_REQUIRES_PRECONDITION = {
    "rule_id": "ORG-05",
    "template": "requires_precondition",
    "slots": {"tool": "ecs.rollback_to_revision", "entity": "orders-db", "check": "snapshot_taken"},
    "source_ref": "gh:acme/infra/postmortems/2025-03-rollback-data-loss.md",
    "source_hash": _hash_of("postmortems/2025-03-rollback-data-loss.md"),
    "status": "signed",
    "approved_by": "platform-lead",
    "approved_at": "2026-09-19T10:00:00Z",
}

ORG_06_FREEZE = {
    "rule_id": "ORG-06",
    "template": "freeze",
    "slots": {"scope": "prod", "window": "blackfriday"},
    "source_ref": "gh:acme/infra/adrs/0012-blackfriday-freeze.md",
    "source_hash": _hash_of("adrs/0012-blackfriday-freeze.md"),
    "status": "signed",
    "approved_by": "vp-eng",
    "approved_at": "2026-09-19T10:00:00Z",
}

ALL_ORG_RULES = [ORG_04_REQUIRES_HUMAN, ORG_05_REQUIRES_PRECONDITION, ORG_06_FREEZE]


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


@pytest.fixture(autouse=True)
def _real_gate2(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LOCKSTEP_STUB", "0")


@pytest.fixture
def org_dir_with_all_rules(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    directory = tmp_path / "org"
    monkeypatch.setattr(gate2, "_ORG_DIR", directory)
    for rule in ALL_ORG_RULES:
        write_signed_rule(rule, directory)
    return directory


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


def test_rules_do_not_cross_fire_on_unrelated_actions(org_dir_with_all_rules: Path) -> None:
    # verify.slo on payments-api matches none of ORG-04/05/06's tools or
    # entities, and touches no generic invariant either.
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


def test_org_03_still_fires_alongside_the_other_three(org_dir_with_all_rules: Path) -> None:
    """ORG-03 isn't in ALL_ORG_RULES (it's authored in the sibling test file's
    own scratch org_dir), so this proves the four-rules-together directory
    doesn't accidentally depend on it -- and that a fifth, differently
    templated rule could be added to this same directory without conflict.
    """
    from control.test_gate2_org_rules import _ORG_03

    write_signed_rule(_ORG_03, org_dir_with_all_rules)
    result = gate2.gate2_check(
        plan={},
        action=_action("ecs.restart_service", "payments-api"),
        ctx={"current_window": "batch"},
    )
    assert result["decision"] == "deny"
    assert result["invariant"] == "ORG-03"
