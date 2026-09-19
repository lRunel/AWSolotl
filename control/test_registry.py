from control.registry import list_agent_tools, registry_get


def test_known_mvp_tool_found() -> None:
    spec = registry_get("ecs.rollback_to_revision")
    assert spec is not None
    assert spec["tier"] == "mvp"
    assert spec["exposed_to_agent"] is True


def test_unknown_tool_is_none() -> None:
    assert registry_get("ecs.delete_everything") is None


def test_red_team_tools_never_agent_exposed() -> None:
    agent_tools = list_agent_tools()
    assert all(t["tier"] != "red-team" for t in agent_tools)
    assert any(t["tool"] == "ecs.rollback_to_revision" for t in agent_tools)


def test_stage_filter() -> None:
    remediate_tools = list_agent_tools(stage="remediate")
    assert all(t["stage"] == "remediate" for t in remediate_tools)
    assert len(remediate_tools) == 3
