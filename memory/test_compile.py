"""Round-trip tests: the compiled Cedar policy must deny exactly what the
slots describe, and permit everything else. Each case pairs a rule with a
context that should be denied and one that should pass.
"""
from __future__ import annotations

import cedarpy
import pytest

from memory.compile import compile_rule, describe_rule, is_stale

_BASE_PERMIT = "permit (principal, action, resource);"


def _authorize(cedar_text: str, context: dict, tool: str = "any.tool") -> cedarpy.AuthzResult:
    policy = f"{_BASE_PERMIT}\n\n{cedar_text}"
    request = {
        "principal": {"type": "Agent", "id": "agent"},
        "action": {"type": "Action", "id": tool},
        "resource": {"type": "Resource", "id": "res-1"},
        "context": context,
    }
    return cedarpy.is_authorized(request, policy, entities=[])


CASES = [
    (
        {
            "rule_id": "ORG-01",
            "template": "forbid_tool_on_entity_during_window",
            "slots": {"tool": "ecs.restart_service", "entity": "payments-api", "window": "batch"},
            "source_ref": "gh:acme/pm.md",
            "approved_by": "sre-lead",
            "approved_at": "2026-09-19",
        },
        "ecs.restart_service",
        {"entity": "payments-api", "current_window": "batch"},  # deny
        {"entity": "payments-api", "current_window": "none"},  # permit
    ),
    (
        {
            "rule_id": "ORG-02",
            "template": "min_count",
            "slots": {"entity": "payments-api", "floor": 3},
            "source_ref": "gh:acme/adr.md",
            "approved_by": "platform-lead",
            "approved_at": "2026-09-19",
        },
        "ecs.scale",
        {"entity": "payments-api", "new_count": 1},  # deny
        {"entity": "payments-api", "new_count": 5},  # permit
    ),
    (
        {
            "rule_id": "ORG-03",
            "template": "requires_precondition",
            "slots": {"tool": "ecs.rollback_to_revision", "entity": "orders-db", "check": "snapshot_taken"},
            "source_ref": "gh:acme/pm2.md",
            "approved_by": "sre-lead",
            "approved_at": "2026-09-19",
        },
        "ecs.rollback_to_revision",
        {"entity": "orders-db", "precondition_met": False},  # deny
        {"entity": "orders-db", "precondition_met": True},  # permit
    ),
    (
        {
            "rule_id": "ORG-04",
            "template": "requires_human",
            "slots": {"tool": "rds.failover", "entity": "primary-db"},
            "source_ref": "gh:acme/pm3.md",
            "approved_by": "sre-lead",
            "approved_at": "2026-09-19",
        },
        "rds.failover",
        {"entity": "primary-db", "human_approved": False},  # deny
        {"entity": "primary-db", "human_approved": True},  # permit
    ),
    (
        {
            "rule_id": "ORG-05",
            "template": "freeze",
            "slots": {"scope": "prod", "window": "blackfriday"},
            "source_ref": "gh:acme/adr2.md",
            "approved_by": "vp-eng",
            "approved_at": "2026-09-19",
        },
        "ecs.scale",
        {"env": "prod", "current_window": "blackfriday", "human_override": False},  # deny
        {"env": "prod", "current_window": "blackfriday", "human_override": True},  # permit
    ),
    (
        {
            "rule_id": "ORG-06",
            "template": "cidr_deny",
            "slots": {"cidr": "203.0.113.0/24", "ports": "any"},
            "source_ref": "slack:incident-2025-09",
            "approved_by": "sre-lead",
            "approved_at": "2026-09-19",
        },
        "sg.authorize_ingress",
        {"cidr": "203.0.113.0/24", "port": 22},  # deny
        {"cidr": "10.0.0.0/8", "port": 22},  # permit
    ),
]


@pytest.mark.parametrize("rule, tool, deny_ctx, permit_ctx", CASES, ids=[c[0]["rule_id"] for c in CASES])
def test_compiled_rule_denies_exactly_what_slots_describe(rule, tool, deny_ctx, permit_ctx) -> None:
    cedar_text = compile_rule(rule)
    result = _authorize(cedar_text, deny_ctx, tool=tool)
    assert result.decision == cedarpy.Decision.Deny
    assert result.diagnostics.id_annotations_by_reason == {list(result.diagnostics.id_annotations_by_reason)[0]: rule["rule_id"]}


@pytest.mark.parametrize("rule, tool, deny_ctx, permit_ctx", CASES, ids=[c[0]["rule_id"] for c in CASES])
def test_compiled_rule_permits_everything_else(rule, tool, deny_ctx, permit_ctx) -> None:
    cedar_text = compile_rule(rule)
    result = _authorize(cedar_text, permit_ctx, tool=tool)
    assert result.decision == cedarpy.Decision.Allow


def test_unknown_template_is_rejected() -> None:
    with pytest.raises(ValueError, match="closed vocabulary"):
        compile_rule(
            {
                "rule_id": "ORG-99",
                "template": "delete_everything",
                "slots": {},
                "source_ref": "x",
                "approved_by": "x",
                "approved_at": "x",
            }
        )


def test_wrong_slot_keys_are_rejected() -> None:
    with pytest.raises(ValueError, match="expects slots"):
        compile_rule(
            {
                "rule_id": "ORG-98",
                "template": "min_count",
                "slots": {"entity": "payments-api"},  # missing "floor"
                "source_ref": "x",
                "approved_by": "x",
                "approved_at": "x",
            }
        )


def test_describe_rule_matches_worked_example() -> None:
    text = describe_rule(
        "forbid_tool_on_entity_during_window",
        {"tool": "ecs.restart_service", "entity": "payments-api", "window": "batch"},
    )
    assert "payments-api" in text
    assert "batch" in text


def test_is_stale_detects_source_edit() -> None:
    original = "the original postmortem text"
    from connectors.base import content_hash

    rule = {"source_hash": content_hash(original)}
    assert is_stale(rule, original) is False
    assert is_stale(rule, original + " -- edited") is True
