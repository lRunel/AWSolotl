import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

from connectors.postmortem import PostmortemConnector

_CORPUS_ROOT = Path(__file__).resolve().parent.parent / "memory" / "corpus"
_SOURCE_CHUNK_SCHEMA = json.loads(
    (Path(__file__).resolve().parent.parent / "schemas" / "source_chunk.schema.json").read_text(
        encoding="utf-8"
    )
)


@pytest.fixture
def connector() -> PostmortemConnector:
    return PostmortemConnector(_CORPUS_ROOT)


def test_authenticate_always_true(connector: PostmortemConnector) -> None:
    assert connector.authenticate("any-token") is True


def test_fetch_all_returns_postmortems_and_adrs(connector: PostmortemConnector) -> None:
    chunks = connector.fetch_all(workspace_id="acme")
    source_types = [c.source_type for c in chunks]
    assert source_types.count("postmortem") == 3
    assert source_types.count("adr") == 2
    assert len(chunks) == 5


def test_chunk_fields_and_schema_validity(connector: PostmortemConnector) -> None:
    chunks = {c.id: c for c in connector.fetch_all(workspace_id="acme")}
    postmortem = chunks["postmortem_2025-09-payments"]
    assert postmortem.author == "sre-lead"
    assert postmortem.created_at == "2025-09-12T02:15:00Z"
    assert "payments-api" in postmortem.content

    Draft202012Validator(_SOURCE_CHUNK_SCHEMA).validate(
        {
            "id": postmortem.id,
            "source_type": postmortem.source_type,
            "content": postmortem.content,
            "url": postmortem.url,
            "author": postmortem.author,
            "created_at": postmortem.created_at,
            "content_hash": postmortem.content_hash,
            "metadata": postmortem.metadata,
        }
    )


def test_fetch_since_filters_by_date(connector: PostmortemConnector) -> None:
    only_recent = connector.fetch_since(workspace_id="acme", since="2025-08-01T00:00:00Z")
    assert {c.id for c in only_recent} == {
        "postmortem_2025-09-payments",
        "adr_0012-blackfriday-freeze",
    }

    everything = connector.fetch_since(workspace_id="acme", since="2000-01-01T00:00:00Z")
    assert len(everything) == 5
