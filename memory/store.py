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
