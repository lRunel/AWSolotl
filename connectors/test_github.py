"""No real network calls: a fake requests.Session stands in for GitHub's
API, since these tests should run offline and never spend real rate-limit
budget.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

from connectors.github import GitHubConnector

_SOURCE_CHUNK_SCHEMA = json.loads(
    (Path(__file__).resolve().parent.parent / "schemas" / "source_chunk.schema.json").read_text(
        encoding="utf-8"
    )
)


def _pr(number: int, created_at: str = "2025-09-01T00:00:00Z", body: str | None = "a body") -> dict:
    return {
        "number": number,
        "title": f"PR title {number}",
        "body": body,
        "html_url": f"https://github.com/acme/infra/pull/{number}",
        "user": {"login": "alice"},
        "created_at": created_at,
        "state": "closed",
    }


class _FakeResponse:
    def __init__(self, payload: list[dict], headers: dict | None = None) -> None:
        self._payload = payload
        self.headers = headers or {}

    def json(self) -> list[dict]:
        return self._payload

    def raise_for_status(self) -> None:
        pass


class _FakeSession:
    def __init__(self, pages: list[list[dict]], headers: dict | None = None) -> None:
        self._pages = pages
        self._headers = headers or {}
        self.headers: dict = {}
        self.calls: list[dict] = []

    def get(self, url: str, params: dict, timeout: int):
        self.calls.append({"url": url, "params": dict(params)})
        page_index = params["page"] - 1
        payload = self._pages[page_index] if page_index < len(self._pages) else []
        return _FakeResponse(payload, headers=self._headers)


def test_authenticate_sets_bearer_header() -> None:
    session = _FakeSession(pages=[[]])
    connector = GitHubConnector(session=session)
    assert connector.authenticate("tok_123") is True
    assert session.headers["Authorization"] == "Bearer tok_123"


def test_fetch_all_single_page() -> None:
    session = _FakeSession(pages=[[_pr(1), _pr(2)]])
    connector = GitHubConnector(session=session)
    chunks = connector.fetch_all("acme/infra")
    assert [c.id for c in chunks] == ["gh_pr_1", "gh_pr_2"]
    assert len(session.calls) == 1


def test_fetch_all_paginates_until_a_short_page() -> None:
    full_page = [_pr(n) for n in range(1, 101)]
    short_page = [_pr(101)]
    session = _FakeSession(pages=[full_page, short_page])
    connector = GitHubConnector(session=session)
    chunks = connector.fetch_all("acme/infra")
    assert len(chunks) == 101
    assert len(session.calls) == 2
    assert session.calls[0]["params"]["page"] == 1
    assert session.calls[1]["params"]["page"] == 2


def test_chunk_fields_and_schema_validity() -> None:
    session = _FakeSession(pages=[[_pr(42, body="fixes the thing")]])
    connector = GitHubConnector(session=session)
    chunk = connector.fetch_all("acme/infra")[0]

    assert chunk.source_type == "github_pr"
    assert chunk.author == "alice"
    assert "PR title 42" in chunk.content
    assert "fixes the thing" in chunk.content
    assert chunk.metadata == {"owner": "acme", "repo": "infra", "number": 42, "state": "closed"}

    Draft202012Validator(_SOURCE_CHUNK_SCHEMA).validate(
        {
            "id": chunk.id,
            "source_type": chunk.source_type,
            "content": chunk.content,
            "url": chunk.url,
            "author": chunk.author,
            "created_at": chunk.created_at,
            "content_hash": chunk.content_hash,
            "metadata": chunk.metadata,
        }
    )


def test_null_body_does_not_crash() -> None:
    session = _FakeSession(pages=[[_pr(7, body=None)]])
    connector = GitHubConnector(session=session)
    chunk = connector.fetch_all("acme/infra")[0]
    assert chunk.content == "PR title 7"


def test_fetch_since_filters_by_date() -> None:
    session = _FakeSession(
        pages=[[_pr(1, created_at="2024-01-01T00:00:00Z"), _pr(2, created_at="2025-09-01T00:00:00Z")]]
    )
    connector = GitHubConnector(session=session)
    recent = connector.fetch_since("acme/infra", since="2025-01-01T00:00:00Z")
    assert [c.id for c in recent] == ["gh_pr_2"]


def test_backs_off_when_rate_limit_exhausted(monkeypatch: pytest.MonkeyPatch) -> None:
    session = _FakeSession(
        pages=[[_pr(1)]],
        headers={"X-RateLimit-Remaining": "0", "X-RateLimit-Reset": "1000"},
    )
    connector = GitHubConnector(session=session)

    monkeypatch.setattr("connectors.github.time.time", lambda: 990.0)
    sleep_calls = []
    monkeypatch.setattr("connectors.github.time.sleep", lambda s: sleep_calls.append(s))

    connector.fetch_all("acme/infra")
    assert sleep_calls == [10.0]


def test_does_not_sleep_when_rate_limit_has_room() -> None:
    session = _FakeSession(pages=[[_pr(1)]], headers={"X-RateLimit-Remaining": "500"})
    connector = GitHubConnector(session=session)
    # No monkeypatch on time.sleep: if the connector tried to sleep for a
    # meaningful duration here, this test would hang instead of passing.
    connector.fetch_all("acme/infra")
