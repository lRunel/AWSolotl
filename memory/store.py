"""In-memory MemoryItem store. The real store is DynamoDB
(contracts.md section 8, table `memory_items`), provisioned by
`infra/brain_stack.py`; that infra work and the boto3-backed store are not
done here. This in-memory implementation exists so `memory/ingest.py` and
its tests don't need an AWS account, and its interface (`put`, `get`,
`list_all`) is deliberately small enough that swapping in a DynamoDB-backed
version later should not require ingest.py to change.
"""
from __future__ import annotations


class MemoryItemStore:
    def __init__(self) -> None:
        self._items: dict[str, dict] = {}

    def put(self, item: dict) -> None:
        self._items[item["item_id"]] = item

    def get(self, item_id: str) -> dict | None:
        return self._items.get(item_id)

    def list_all(self) -> list[dict]:
        return list(self._items.values())

    def precedent_stats(self, entity: str, tool: str) -> tuple[float, float]:
        """Advisory-only precedent lookup for Gate 4 (control/gate4.py):
        returns (historical_failure_rate, novelty). A postmortem item is
        read as "something went wrong here before"; an ADR or any other
        source type mentioning the entity is read as neutral history, not a
        failure. This never returns anything a gate could treat as a grant
        -- both numbers only ever feed a risk score that can raise risk or
        force human review, per the trust ladder.
        """
        mentioning_entity = [item for item in self._items.values() if entity in item["entity_ids"]]
        if not mentioning_entity:
            return 0.0, 1.0  # no history at all: max novelty, no known failure

        failures = [
            item
            for item in mentioning_entity
            if item["source_type"] == "postmortem" and tool in item["tool_ids"]
        ]
        failure_rate = len(failures) / len(mentioning_entity)

        # seen_count is always >= 1 here; the seen_count == 0 case already
        # returned above with max novelty.
        novelty = 0.0 if len(mentioning_entity) >= 3 else 0.5
        return failure_rate, novelty
