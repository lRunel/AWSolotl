from pathlib import Path

from agents.router import route_stage, stage_tools
from connectors.postmortem import PostmortemConnector
from memory.ingest import ingest
from memory.store import MemoryItemStore

_CORPUS_ROOT = Path(__file__).resolve().parent.parent / "memory" / "corpus"


def test_security_event_routes_to_contain() -> None:
    assert route_stage({"security_event": True}) == "contain"


def test_blast_growing_routes_to_contain() -> None:
    assert route_stage({"blast_growing": True}) == "contain"


def test_security_event_wins_even_without_a_snapshot() -> None:
    # First match wins: contain must fire before the missing-snapshot check.
    assert route_stage({"security_event": True, "snapshot_taken": False}) == "contain"


def test_no_snapshot_routes_to_preserve() -> None:
    assert route_stage({"snapshot_taken": False}) == "preserve"


def test_recent_change_routes_to_remediate() -> None:
    assert route_stage({"snapshot_taken": True, "change_proximity_s": 300}) == "remediate"


def test_change_at_the_window_boundary_does_not_remediate() -> None:
    assert route_stage({"snapshot_taken": True, "change_proximity_s": 900}) != "remediate"


def test_recurring_incident_routes_to_harden() -> None:
    result = route_stage({"snapshot_taken": True, "change_proximity_s": 9999, "recurrence_count": 2})
    assert result == "harden"


def test_default_routes_to_restore() -> None:
    result = route_stage({"snapshot_taken": True, "change_proximity_s": 9999, "recurrence_count": 0})
    assert result == "restore"


def test_stage_tools_without_store_returns_full_stage_list() -> None:
    tools = stage_tools("remediate")
    assert {t["tool"] for t in tools} == {"ecs.rollback_to_revision", "ecs.restart_service", "ecs.scale"}


def test_stage_tools_excludes_a_tool_with_a_made_it_worse_precedent() -> None:
    store = MemoryItemStore()
    ingest(PostmortemConnector(_CORPUS_ROOT), workspace_id="acme", store=store)

    tools = stage_tools("remediate", store=store, entity="ecs/orders-db")
    tool_names = {t["tool"] for t in tools}
    assert "ecs.rollback_to_revision" not in tool_names
    assert "ecs.scale" in tool_names
    assert "ecs.restart_service" in tool_names


def test_stage_tools_never_includes_red_team_tier() -> None:
    for stage in ["contain", "preserve", "remediate", "harden", "restore"]:
        tools = stage_tools(stage)
        assert all(t["tier"] != "red-team" for t in tools)
