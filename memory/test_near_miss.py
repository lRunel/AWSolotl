from memory.near_miss import propose_from_denials


def test_repeated_denial_proposes_a_candidate() -> None:
    denials = [{"tool": "ecs.restart_service", "entity": "cart-api"}] * 3
    proposals = propose_from_denials(denials, existing_rules=[])
    assert len(proposals) == 1
    assert proposals[0]["template"] == "requires_human"
    assert proposals[0]["slots"] == {"tool": "ecs.restart_service", "entity": "cart-api"}
    assert proposals[0]["status"] == "candidate"


def test_below_threshold_proposes_nothing() -> None:
    denials = [{"tool": "ecs.restart_service", "entity": "cart-api"}] * 2
    assert propose_from_denials(denials, existing_rules=[]) == []


def test_already_covered_pair_is_not_reproposed() -> None:
    denials = [{"tool": "ecs.restart_service", "entity": "payments-api"}] * 5
    existing = [
        {
            "template": "forbid_tool_on_entity_during_window",
            "slots": {"tool": "ecs.restart_service", "entity": "payments-api", "window": "batch"},
        }
    ]
    assert propose_from_denials(denials, existing_rules=existing) == []


def test_different_entities_are_independent() -> None:
    denials = (
        [{"tool": "ecs.restart_service", "entity": "cart-api"}] * 3
        + [{"tool": "ecs.restart_service", "entity": "payments-api"}] * 2
    )
    proposals = propose_from_denials(denials, existing_rules=[])
    assert len(proposals) == 1
    assert proposals[0]["slots"]["entity"] == "cart-api"


def test_a_proposal_never_carries_approval_fields() -> None:
    denials = [{"tool": "x", "entity": "y"}] * 3
    proposals = propose_from_denials(denials, existing_rules=[])
    assert "approved_by" not in proposals[0]
    assert "rule_id" not in proposals[0]
    assert proposals[0]["status"] == "candidate"
