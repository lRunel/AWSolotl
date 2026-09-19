import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

from connectors.slack_export import SlackExportConnector

_CORPUS_ROOT = Path(__file__).resolve().parent.parent / "memory" / "corpus" / "slack"
_SOURCE_CHUNK_SCHEMA = json.loads(
    (Path(__file__).resolve().parent.parent / "schemas" / "source_chunk.schema.json").read_text(
        encoding="utf-8"
    )
)


@pytest.fixture
def connector() -> SlackExportConnector:
    return SlackExportConnector(_CORPUS_ROOT)


def test_authenticate_always_true(connector: SlackExportConnector) -> None:
    assert connector.authenticate("unused") is True


def test_fetch_all_returns_one_chunk_per_top_level_message(connector: SlackExportConnector) -> None:
    chunks = connector.fetch_all(workspace_id="acme")
    assert len(chunks) == 2
    assert all(c.source_type == "slack_message" for c in chunks)


def test_thread_reply_is_folded_into_the_parent_message(connector: SlackExportConnector) -> None:
    chunks = {c.id: c for c in connector.fetch_all(workspace_id="acme")}
    incident_msg = chunks["slack_incident-2025-09-payments_1757659260_000100"]
    assert "duplicate charge reports" in incident_msg.content
    assert "Reply @sre-lead: Confirmed" in incident_msg.content
    assert incident_msg.metadata["reply_count"] == 1
    assert incident_msg.author == "carol"


def test_cidr_message_has_no_replies_and_correct_timestamp(connector: SlackExportConnector) -> None:
    chunks = {c.id: c for c in connector.fetch_all(workspace_id="acme")}
    cidr_msg = chunks["slack_incident-2025-09-payments_1757754000_000100"]
    assert "203.0.113.0/24" in cidr_msg.content
    assert cidr_msg.metadata["reply_count"] == 0
    assert cidr_msg.created_at == "2025-09-13T09:00:00.000100Z"

    Draft202012Validator(_SOURCE_CHUNK_SCHEMA).validate(
        {
            "id": cidr_msg.id,
            "source_type": cidr_msg.source_type,
            "content": cidr_msg.content,
            "url": cidr_msg.url,
            "author": cidr_msg.author,
            "created_at": cidr_msg.created_at,
            "content_hash": cidr_msg.content_hash,
            "metadata": cidr_msg.metadata,
        }
    )


def test_fetch_since_filters_by_date(connector: SlackExportConnector) -> None:
    recent = connector.fetch_since(workspace_id="acme", since="2025-09-13T00:00:00Z")
    assert len(recent) == 1
    assert "203.0.113.0/24" in recent[0].content


def test_missing_export_dir_returns_empty(tmp_path: Path) -> None:
    connector = SlackExportConnector(tmp_path / "does-not-exist")
    assert connector.fetch_all(workspace_id="acme") == []
