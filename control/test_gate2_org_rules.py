"""The I3 exit test (references/iterations.md): postmortem -> candidate ->
human approves -> the agent proposes restarting payments in the batch
window -> Gate 2 denies citing ORG-03 and the postmortem. Editing the source
flips the rule to stale.

There is no live Bedrock access in this environment (see docs/memory.md), so
the "candidate" step here is hand-authored from the real seed postmortem
rather than LLM-extracted -- everything downstream of that (compile, sign,
Gate 2 wiring, staleness) is real.
"""
from __future__ import annotations

from pathlib import Path

import pytest

import control.gate2 as gate2
from connectors.base import content_hash
from memory.compile import is_stale, write_signed_rule

_POSTMORTEM_PATH = (
    Path(__file__).resolve().parent.parent / "memory" / "corpus" / "postmortems" / "2025-09-payments.md"
)
_POSTMORTEM_CONTENT = _POSTMORTEM_PATH.read_text(encoding="utf-8")

_ORG_03 = {
    "rule_id": "ORG-03",
    "template": "forbid_tool_on_entity_during_window",
    "slots": {"tool": "ecs.restart_service", "entity": "payments-api", "window": "batch"},
    "source_ref": "gh:acme/infra/postmortems/2025-09-payments.md",
    "source_hash": content_hash(_POSTMORTEM_CONTENT),
    "status": "signed",
    "approved_by": "sre-lead",
    "approved_at": "2026-09-19T10:00:00Z",
}


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


@pytest.fixture(autouse=True)
def _real_gate2(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LOCKSTEP_STUB", "0")


@pytest.fixture
def org_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Redirect Gate 2's org-rule directory to a scratch path so this test
    never writes into the real invariants/org/ tree."""
    directory = tmp_path / "org"
    monkeypatch.setattr(gate2, "_ORG_DIR", directory)
    return directory


def test_signed_rule_denies_restart_during_batch_with_citation(org_dir: Path) -> None:
    write_signed_rule(_ORG_03, org_dir)

    result = gate2.gate2_check(
        plan={},
        action=_restart_payments_action(),
        ctx={"current_window": "batch"},
    )

    assert result["decision"] == "deny"
    assert result["invariant"] == "ORG-03"
    assert result["reason_code"] == "org_rule"
    assert result["citation"] == {
        "rule_id": "ORG-03",
        "source_ref": "gh:acme/infra/postmortems/2025-09-payments.md",
        "approved_by": "sre-lead",
    }
    assert "payments-api" in result["why"] and "batch" in result["why"]


def test_same_restart_outside_batch_window_passes(org_dir: Path) -> None:
    write_signed_rule(_ORG_03, org_dir)

    result = gate2.gate2_check(
        plan={},
        action=_restart_payments_action(),
        ctx={"current_window": "none"},
    )
    assert result["decision"] == "pass"


def test_candidate_rule_is_refused_at_write_time(org_dir: Path) -> None:
    candidate = {**_ORG_03, "status": "candidate"}
    with pytest.raises(ValueError):
        write_signed_rule(candidate, org_dir)
    assert not list(org_dir.glob("*.cedar")), "an unapproved rule must never reach Gate 2"


def test_editing_the_source_flips_the_rule_to_stale() -> None:
    edited_content = _POSTMORTEM_CONTENT + "\n\n## Addendum\n\nA later edit.\n"
    assert is_stale(_ORG_03, _POSTMORTEM_CONTENT) is False
    assert is_stale(_ORG_03, edited_content) is True


def test_no_org_rules_yet_falls_back_to_generic_only(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(gate2, "_ORG_DIR", tmp_path / "does-not-exist")
    result = gate2.gate2_check(plan={}, action=_restart_payments_action(), ctx={})
    assert result["decision"] == "pass"
