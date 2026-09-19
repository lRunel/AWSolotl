"""Entity anchoring: regex-first over service names and ARNs, per
references/person-b-brief.md task 9. A deterministic key lookup at gate time
is what keeps Gate 2's org-rule lookup fast and drift-free -- this module is
what produces the `entity_ids` a MemoryItem is tagged with.

`KNOWN_SERVICES` is a placeholder seed list. The real dictionary should be
built from the CDK outputs Person A publishes to `/lockstep/*` (I2 task 9);
until that exists, this is the seed corpus's known demo services. The
"model only for ambiguity" half of this task -- an LLM fallback for text
that regex can't confidently anchor -- is not implemented yet.
"""
from __future__ import annotations

import re

KNOWN_SERVICES = ["payments-api", "cart-api", "inventory-api", "orders-db"]

_ARN_RE = re.compile(r"arn:aws:[a-zA-Z0-9-]+:[a-zA-Z0-9-]*:[0-9]*:[^\s\)\]\.,;]+")


def anchor_entities(content: str, known_services: list[str] | None = None) -> list[str]:
    """Returns a deduplicated list of entity ids found in `content`, ordered
    by first appearance in the text: real ARNs verbatim, and known service
    names as `ecs/<name>` (matching the design doc's entity_ids convention,
    e.g. `ecs/payments-api`).
    """
    services = known_services if known_services is not None else KNOWN_SERVICES
    matches: list[tuple[int, str]] = []

    for match in _ARN_RE.finditer(content):
        matches.append((match.start(), match.group(0)))

    for name in services:
        found = re.search(rf"\b{re.escape(name)}\b", content)
        if found:
            matches.append((found.start(), f"ecs/{name}"))

    matches.sort(key=lambda pair: pair[0])

    seen: set[str] = set()
    ordered: list[str] = []
    for _, entity_id in matches:
        if entity_id not in seen:
            seen.add(entity_id)
            ordered.append(entity_id)
    return ordered


def anchor_tools(content: str, known_tools: list[str]) -> list[str]:
    """Same regex-first, order-preserving approach as `anchor_entities`, but
    for tool ids (`schemas/rule.schema.json`'s `slots.tool`, MemoryItem's
    `tool_ids`). Only finds a tool when the document literally names it
    (e.g. a corrective action written as `` `ecs.scale` ``); it will not
    infer a tool from prose like "restarted the service" -- that inference
    is the "model for ambiguity" half of anchoring, not implemented here.
    """
    matches: list[tuple[int, str]] = []
    for tool in known_tools:
        found = re.search(rf"\b{re.escape(tool)}\b", content)
        if found:
            matches.append((found.start(), tool))
    matches.sort(key=lambda pair: pair[0])

    seen: set[str] = set()
    ordered: list[str] = []
    for _, tool_id in matches:
        if tool_id not in seen:
            seen.add(tool_id)
            ordered.append(tool_id)
    return ordered
