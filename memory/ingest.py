"""Ingest pipeline: connector -> anchor -> injection scan -> store.

Every chunk becomes a `MemoryItem` at `trust_level` 0 (raw, no effect on any
gate) regardless of what the injection scanner finds -- flagging tags a
chunk for review, it never blocks ingestion and never grants anything.
Real Cedar text, `approved_by`, and a rule's `signed` status only ever come
from the human-approval path (I3, memory/compile.py + the rule-review
panel), never from this module.
"""
from __future__ import annotations

from connectors.base import BaseConnector
from control.registry import list_all_tool_names
from control.sensors import injection_scan
from memory.anchor import anchor_entities, anchor_tools
from memory.store import MemoryItemStore


def ingest(connector: BaseConnector, workspace_id: str, store: MemoryItemStore) -> list[dict]:
    known_tools = list_all_tool_names()
    items: list[dict] = []

    for chunk in connector.fetch_all(workspace_id):
        item = {
            "item_id": chunk.id,
            "source_type": chunk.source_type,
            "url": chunk.url,
            "content_hash": chunk.content_hash,
            "entity_ids": anchor_entities(chunk.content),
            "tool_ids": anchor_tools(chunk.content, known_tools),
            "trust_level": 0,
            "injection_flag": injection_scan(chunk.content),
        }
        store.put(item)
        items.append(item)

    return items
