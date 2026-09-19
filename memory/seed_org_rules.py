"""The five hand-authored candidate rules signed from the real seed corpus
(ORG-03 through ORG-07), shared by control/test_gate2_org_rules*.py and
brakebench/plans/ so the rule definitions exist in exactly one place.

These are hand-authored rather than LLM-extracted, since memory/extract.py
needs Bedrock access this environment doesn't have (docs/memory.md). Every
downstream step -- compiling, signing, and Gate 2 enforcement -- is real.
"""
from __future__ import annotations

from pathlib import Path

from connectors.base import content_hash
from memory.compile import write_signed_rule

_CORPUS = Path(__file__).resolve().parent / "corpus"


def _hash_of(relative_path: str) -> str:
    return content_hash((_CORPUS / relative_path).read_text(encoding="utf-8"))


ORG_03_FORBID_RESTART_DURING_BATCH = {
    "rule_id": "ORG-03",
    "template": "forbid_tool_on_entity_during_window",
    "slots": {"tool": "ecs.restart_service", "entity": "payments-api", "window": "batch"},
    "source_ref": "gh:acme/infra/postmortems/2025-09-payments.md",
    "source_hash": _hash_of("postmortems/2025-09-payments.md"),
    "status": "signed",
    "approved_by": "sre-lead",
    "approved_at": "2026-09-19T10:00:00Z",
}

ORG_04_REQUIRES_HUMAN_FAILOVER = {
    "rule_id": "ORG-04",
    "template": "requires_human",
    "slots": {"tool": "rds.failover", "entity": "primary-db"},
    "source_ref": "gh:acme/infra/postmortems/2025-06-db-failover.md",
    "source_hash": _hash_of("postmortems/2025-06-db-failover.md"),
    "status": "signed",
    "approved_by": "sre-lead",
    "approved_at": "2026-09-19T10:00:00Z",
}

ORG_05_REQUIRES_SNAPSHOT_ROLLBACK = {
    "rule_id": "ORG-05",
    "template": "requires_precondition",
    "slots": {"tool": "ecs.rollback_to_revision", "entity": "orders-db", "check": "snapshot_taken"},
    "source_ref": "gh:acme/infra/postmortems/2025-03-rollback-data-loss.md",
    "source_hash": _hash_of("postmortems/2025-03-rollback-data-loss.md"),
    "status": "signed",
    "approved_by": "platform-lead",
    "approved_at": "2026-09-19T10:00:00Z",
}

ORG_06_BLACKFRIDAY_FREEZE = {
    "rule_id": "ORG-06",
    "template": "freeze",
    "slots": {"scope": "prod", "window": "blackfriday"},
    "source_ref": "gh:acme/infra/adrs/0012-blackfriday-freeze.md",
    "source_hash": _hash_of("adrs/0012-blackfriday-freeze.md"),
    "status": "signed",
    "approved_by": "vp-eng",
    "approved_at": "2026-09-19T10:00:00Z",
}

ORG_07_DECOMMISSIONED_CIDR = {
    "rule_id": "ORG-07",
    "template": "cidr_deny",
    "slots": {"cidr": "203.0.113.0/24", "ports": "any"},
    "source_ref": "slack:incident-2025-09-payments#1757754000.000100",
    "source_hash": content_hash(
        "the old office range 203.0.113.0/24 is fully decommissioned, block it everywhere."
    ),
    "status": "signed",
    "approved_by": "sre-lead",
    "approved_at": "2026-09-19T10:00:00Z",
}

ALL_SEED_RULES = [
    ORG_03_FORBID_RESTART_DURING_BATCH,
    ORG_04_REQUIRES_HUMAN_FAILOVER,
    ORG_05_REQUIRES_SNAPSHOT_ROLLBACK,
    ORG_06_BLACKFRIDAY_FREEZE,
    ORG_07_DECOMMISSIONED_CIDR,
]


def sign_all(org_dir: Path) -> None:
    for rule in ALL_SEED_RULES:
        write_signed_rule(rule, org_dir)
