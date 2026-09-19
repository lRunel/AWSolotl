import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

from connectors.postmortem import PostmortemConnector
from memory.ingest import ingest
from memory.store import MemoryItemStore

_CORPUS_ROOT = Path(__file__).resolve().parent / "corpus"
_MEMORY_ITEM_SCHEMA = json.loads(
    (Path(__file__).resolve().parent.parent / "schemas" / "memory_item.schema.json").read_text(
        encoding="utf-8"
    )
)


@pytest.fixture
def store() -> MemoryItemStore:
    return MemoryItemStore()


def test_ingest_returns_one_item_per_chunk(store: MemoryItemStore) -> None:
    connector = PostmortemConnector(_CORPUS_ROOT)
    items = ingest(connector, workspace_id="acme", store=store)
    assert len(items) == 5
    assert len(store.list_all()) == 5


def test_every_item_validates_against_memory_item_schema(store: MemoryItemStore) -> None:
    connector = PostmortemConnector(_CORPUS_ROOT)
    items = ingest(connector, workspace_id="acme", store=store)
    validator = Draft202012Validator(_MEMORY_ITEM_SCHEMA)
    for item in items:
        errors = list(validator.iter_errors(item))
        assert not errors, f"{item['item_id']} failed schema: {errors}"


def test_postmortem_item_is_entity_and_tool_anchored(store: MemoryItemStore) -> None:
    connector = PostmortemConnector(_CORPUS_ROOT)
    ingest(connector, workspace_id="acme", store=store)
    item = store.get("postmortem_2025-09-payments")
    assert item is not None
    assert "ecs/payments-api" in item["entity_ids"]
    # The corrective action names ecs.scale literally; the causal tool
    # (restarting the service) is only described in prose, so it is not
    # anchored -- this is the documented regex-only limitation.
    assert "ecs.scale" in item["tool_ids"]
    assert item["trust_level"] == 0
    assert item["injection_flag"] is False


def test_rollback_postmortem_is_anchored_to_orders_db_and_its_tool(store: MemoryItemStore) -> None:
    connector = PostmortemConnector(_CORPUS_ROOT)
    ingest(connector, workspace_id="acme", store=store)
    item = store.get("postmortem_2025-03-rollback-data-loss")
    assert item is not None
    assert "ecs/orders-db" in item["entity_ids"]
    assert "ecs.rollback_to_revision" in item["tool_ids"]


def test_ingest_is_idempotent_by_item_id(store: MemoryItemStore) -> None:
    connector = PostmortemConnector(_CORPUS_ROOT)
    ingest(connector, workspace_id="acme", store=store)
    ingest(connector, workspace_id="acme", store=store)
    assert len(store.list_all()) == 5
