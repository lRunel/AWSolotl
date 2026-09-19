"""3 stale-rule scenarios (I5 task 20's remaining category), reusing 3 of
the 5 real seed rules. Each case demonstrates two things together, because
either one alone misses the point of why staleness matters:

1. `is_stale` correctly detects that the source document changed after
   signing.
2. Once a rule is stale, the *correct* system behaviour is to stop
   enforcing it until a human re-approves (write_signed_rule already
   refuses anything not `status: signed`) -- which means the action it used
   to block now passes. That is not a bug in Gate 2; it is the trust
   ladder working as designed. It is also exactly the coverage gap
   `references/*.md` warns needs a reviewer flagged, since silently having
   fewer enforced rules than you think is its own risk.
"""
from __future__ import annotations

from pathlib import Path

from memory.seed_org_rules import (
    ORG_03_FORBID_RESTART_DURING_BATCH,
    ORG_05_REQUIRES_SNAPSHOT_ROLLBACK,
    ORG_07_DECOMMISSIONED_CIDR,
)

_CORPUS = Path(__file__).resolve().parent.parent.parent / "memory" / "corpus"
_EDIT_SUFFIX = "\n\n## Addendum\n\nEdited after this rule was signed.\n"
_EDITED_CIDR_MESSAGE = (
    "the old office range 203.0.113.0/24 is fully decommissioned, block it "
    "everywhere. (edited: confirmed with networking on 2026-10-01)"
)


def _restart_payments_action() -> dict:
    return {
        "tool": "ecs.restart_service",
        "args": {"cluster": "demo", "service": "payments-api"},
        "blast_radius": {
            "accounts": ["123456789012"],
            "region": "us-east-1",
            "arns": ["arn:aws:ecs:us-east-1:123456789012:service/demo/payments-api"],
            "max_tasks": 4,
            "data_destructive": False,
        },
    }


def _rollback_orders_db_action() -> dict:
    return {
        "tool": "ecs.rollback_to_revision",
        "args": {"cluster": "demo", "service": "orders-db", "to_revision": 4},
        "blast_radius": {
            "accounts": ["123456789012"],
            "region": "us-east-1",
            "arns": ["arn:aws:ecs:us-east-1:123456789012:service/demo/orders-db"],
            "max_tasks": 4,
            "data_destructive": False,
        },
    }


def _sg_ingress_action() -> dict:
    return {
        "tool": "sg.authorize_ingress",
        "args": {"security_group_id": "sg-1", "cidr": "203.0.113.0/24", "port": 22},
        "blast_radius": {
            "accounts": ["123456789012"],
            "region": "us-east-1",
            "arns": ["arn:aws:ec2:us-east-1:123456789012:security-group/sg-1"],
            "max_tasks": 0,
            "data_destructive": False,
        },
    }


def _postmortem_content(relative_path: str) -> str:
    return (_CORPUS / relative_path).read_text(encoding="utf-8")


STALE_CASES = [
    {
        "id": "stale-org-03",
        "rule": ORG_03_FORBID_RESTART_DURING_BATCH,
        "original_content": _postmortem_content("postmortems/2025-09-payments.md"),
        "edited_content": _postmortem_content("postmortems/2025-09-payments.md") + _EDIT_SUFFIX,
        "action": _restart_payments_action(),
        "ctx": {"current_window": "batch"},
        "note": "Restarting payments-api during the batch window would be ORG-03's exact deny case.",
    },
    {
        "id": "stale-org-05",
        "rule": ORG_05_REQUIRES_SNAPSHOT_ROLLBACK,
        "original_content": _postmortem_content("postmortems/2025-03-rollback-data-loss.md"),
        "edited_content": _postmortem_content("postmortems/2025-03-rollback-data-loss.md") + _EDIT_SUFFIX,
        "action": _rollback_orders_db_action(),
        "ctx": {"precondition_met": False},
        "note": "Rolling back orders-db without a snapshot would be ORG-05's exact deny case.",
    },
    {
        "id": "stale-org-07",
        "rule": ORG_07_DECOMMISSIONED_CIDR,
        "original_content": (
            "the old office range 203.0.113.0/24 is fully decommissioned, block it everywhere."
        ),
        "edited_content": _EDITED_CIDR_MESSAGE,
        "action": _sg_ingress_action(),
        "ctx": {},
        "note": "Ingress from 203.0.113.0/24 would be ORG-07's exact deny case.",
    },
]
