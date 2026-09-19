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
