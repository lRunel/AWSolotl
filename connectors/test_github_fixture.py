"""The ~30 PR fixture corpus (memory/CORPUS_OUTLINE.md's last gap): loaded
through GitHubConnector.fetch_fixture, not a live API -- there is no real
acme/infra repo. Proves the fixture is real, schema-valid, usable input to
the rest of the pipeline (anchoring, injection scanning), not just data
sitting in a JSON file nobody reads.
"""
from __future__ import annotations

import json
from pathlib import Path

from jsonschema import Draft202012Validator

from connectors.github import GitHubConnector
from control.sensors import injection_scan
from memory.anchor import anchor_entities

_FIXTURE_PATH = Path(__file__).resolve().parent.parent / "fixtures" / "github_prs.json"
_SOURCE_CHUNK_SCHEMA = json.loads(
    (Path(__file__).resolve().parent.parent / "schemas" / "source_chunk.schema.json").read_text(
        encoding="utf-8"
    )
)


def test_fixture_has_thirty_prs() -> None:
    chunks = GitHubConnector().fetch_fixture(_FIXTURE_PATH)
    assert len(chunks) == 30


def test_every_chunk_is_schema_valid() -> None:
    chunks = GitHubConnector().fetch_fixture(_FIXTURE_PATH)
    validator = Draft202012Validator(_SOURCE_CHUNK_SCHEMA)
    for chunk in chunks:
        instance = {
            "id": chunk.id,
            "source_type": chunk.source_type,
            "content": chunk.content,
            "url": chunk.url,
            "author": chunk.author,
            "created_at": chunk.created_at,
            "content_hash": chunk.content_hash,
            "metadata": chunk.metadata,
        }
        errors = list(validator.iter_errors(instance))
        assert not errors, f"{chunk.id} failed schema: {errors}"


def test_ordinary_prs_anchor_to_a_known_service() -> None:
    chunks = GitHubConnector().fetch_fixture(_FIXTURE_PATH)
    ordinary = [c for c in chunks if 100 <= c.metadata["number"] < 120]
    assert len(ordinary) == 20
    for chunk in ordinary:
        assert anchor_entities(chunk.content), f"{chunk.id} should anchor to at least one known service"


def test_postmortem_referencing_prs_link_back_to_the_real_corpus() -> None:
    chunks = GitHubConnector().fetch_fixture(_FIXTURE_PATH)
    referencing = [c for c in chunks if "postmortems/" in c.content or "adrs/" in c.content]
    assert len(referencing) == 5


def test_exactly_three_prs_are_injection_flagged() -> None:
    chunks = GitHubConnector().fetch_fixture(_FIXTURE_PATH)
    flagged = [c for c in chunks if injection_scan(c.content)]
    assert len(flagged) == 3
    assert all(c.author == "mallory" for c in flagged)


def test_low_signal_prs_anchor_to_nothing() -> None:
    chunks = GitHubConnector().fetch_fixture(_FIXTURE_PATH)
    low_signal = [c for c in chunks if c.author == "dependabot"]
    assert len(low_signal) == 2
    for chunk in low_signal:
        assert anchor_entities(chunk.content) == []
