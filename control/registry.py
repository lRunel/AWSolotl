"""Tool registry: the entire action space Gate 1 and the agent may draw from.

If a tool is not returned by ``registry_get``, the caller must treat it as
unknown and deny by default (Gate 1's job, not this module's). This is real,
not a stub: it reads the seeded fixture at ``schemas/samples/tool_registry/valid.json``
so Person A's orchestrator has a genuine registry to call from hour 0, instead
of hand-rolled fixtures. I1 (task 5, references/person-b-brief.md) replaces
the fixture-backed source with the real registry data, behind the same
two functions so nothing importing this module has to change.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Optional, TypedDict

_REGISTRY_FIXTURE = (
    Path(__file__).resolve().parent.parent
    / "schemas"
    / "samples"
    / "tool_registry"
    / "valid.json"
)


class ToolSpec(TypedDict):
    tool: str
    tier: str
    stage: Optional[str]
    args_schema: dict
    simulator: str
    executor_action: str
    rollback: str
    exposed_to_agent: bool


def _load_registry() -> list[ToolSpec]:
    data = json.loads(_REGISTRY_FIXTURE.read_text(encoding="utf-8"))
    return data["tools"]


def registry_get(tool: str) -> Optional[ToolSpec]:
    """Deterministic lookup by tool name. None means unknown tool."""
    for spec in _load_registry():
        if spec["tool"] == tool:
            return spec
    return None


def list_agent_tools(stage: Optional[str] = None) -> list[ToolSpec]:
    """Tools an agent may see: exposed_to_agent only, red-team tier excluded
    by construction. Optionally filtered to one stage."""
    tools = [t for t in _load_registry() if t["exposed_to_agent"]]
    if stage is not None:
        tools = [t for t in tools if t.get("stage") == stage]
    return tools


def list_all_tool_names() -> list[str]:
    """Every registered tool name, including red-team tier -- used by
    entity/tool anchoring (memory/anchor.py), which needs the full
    vocabulary a document might reference, not just what an agent may call."""
    return [t["tool"] for t in _load_registry()]
