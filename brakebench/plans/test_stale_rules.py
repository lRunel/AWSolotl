"""3 stale-rule plans. Each proves detection (is_stale) and the resulting
Gate 2 behaviour together: once stale, the rule is correctly absent from
enforcement, so the action it used to block now passes -- the coverage gap
that is exactly why a stale rule must flag a human for re-approval, per the
design doc's trust ladder.
"""
from __future__ import annotations

from pathlib import Path

import pytest

import control.gate2 as gate2
from brakebench.plans.stale_rules import STALE_CASES
from memory.compile import is_stale, write_signed_rule


@pytest.fixture(autouse=True)
def _real_gate2(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LOCKSTEP_STUB", "0")


@pytest.mark.parametrize("case", STALE_CASES, ids=[c["id"] for c in STALE_CASES])
def test_editing_the_source_is_detected_as_stale(case: dict) -> None:
    assert is_stale(case["rule"], case["original_content"]) is False
    assert is_stale(case["rule"], case["edited_content"]) is True


@pytest.mark.parametrize("case", STALE_CASES, ids=[c["id"] for c in STALE_CASES])
def test_rule_still_signed_denies_the_unsafe_action(case: dict, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Sanity baseline: while the source is unedited, the rule is exactly as
    enforceable as it is everywhere else in this repo."""
    org_dir = tmp_path / "org"
    monkeypatch.setattr(gate2, "_ORG_DIR", org_dir)
    write_signed_rule(case["rule"], org_dir)

    result = gate2.gate2_check(plan={}, action=case["action"], ctx=case["ctx"])
    assert result["decision"] == "deny"
    assert result["invariant"] == case["rule"]["rule_id"]


@pytest.mark.parametrize("case", STALE_CASES, ids=[c["id"] for c in STALE_CASES])
def test_once_stale_the_rule_is_not_enforced_and_the_action_passes(
    case: dict, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The coverage gap: once the source has changed, the correct behaviour
    is to withhold this rule from invariants/org/ until a human re-approves
    it against the new content (that re-approval flow -- a rule-review UI
    action -- is not automated here). Not writing it means Gate 2 no longer
    blocks the action the rule used to cover."""
    assert is_stale(case["rule"], case["edited_content"]) is True

    org_dir = tmp_path / "org"
    monkeypatch.setattr(gate2, "_ORG_DIR", org_dir)
    # Deliberately not signing this rule, simulating that staleness was
    # already detected and it was pulled from enforcement pending review.

    result = gate2.gate2_check(plan={}, action=case["action"], ctx=case["ctx"])
    assert result["decision"] == "pass", (
        f"{case['id']}: a stale rule must not still be enforced -- if this now "
        "denies, something is (re)signing a rule that failed is_stale."
    )
