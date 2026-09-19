# Tool registry

`control/registry.py` does a deterministic lookup of `ToolSpec` by tool name, reading the seeded `schemas/samples/tool_registry/valid.json` fixture. Depends on `schemas/tool_registry.schema.json` for the shape it trusts. Breaks if a tool's `exposed_to_agent` is ever `true` on a `red-team` tier entry, or if the fixture's tool names drift from what Gate 1 and the agent's tool list expect.
