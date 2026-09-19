"""GitHub connector: pull requests only for now (see module-bottom note on
ADR markdown). `workspace_id` is `"owner/repo"`, matching the `gh:` URLs
used elsewhere in this codebase (e.g. `memory/CORPUS_OUTLINE.md`).

Rate limits (MemoryOS-Team-Build-Guide.md section 2.1): 5,000 requests/hour
per token, documented via the `X-RateLimit-*` response headers. This
connector paginates with `per_page=100` and backs off using
`X-RateLimit-Reset` whenever `X-RateLimit-Remaining` hits zero, rather than
guessing a fixed sleep duration.
"""
from __future__ import annotations

import json
import time
from pathlib import Path

import requests

from connectors.base import BaseConnector, SourceChunk

_API_ROOT = "https://api.github.com"
_MAX_BACKOFF_S = 60.0


class GitHubConnector(BaseConnector):
    def __init__(self, session: requests.Session | None = None) -> None:
        self._session = session or requests.Session()

    def authenticate(self, token: str) -> bool:
        # No round-trip verification here -- an invalid token surfaces as a
        # 401 on the first real fetch call instead, which is simpler and
        # doesn't spend one of the 5,000 hourly requests just to check.
        self._session.headers["Authorization"] = f"Bearer {token}"
        self._session.headers["Accept"] = "application/vnd.github+json"
        return True

    def get_source_name(self) -> str:
        return "github"

    def fetch_all(self, workspace_id: str) -> list[SourceChunk]:
        owner, repo = workspace_id.split("/", 1)
        pulls = self._get_all_pages(f"{_API_ROOT}/repos/{owner}/{repo}/pulls", {"state": "all"})
        return [self._to_chunk(owner, repo, pr) for pr in pulls]

    def fetch_since(self, workspace_id: str, since: str) -> list[SourceChunk]:
        # The PR list endpoint has no `since` filter (that's an issues/commits
        # feature); at seed-corpus scale (~30 PRs) filtering client-side
        # after fetch_all is simpler than a second pagination strategy.
        return [chunk for chunk in self.fetch_all(workspace_id) if chunk.created_at >= since]

    def fetch_fixture(self, fixture_path: Path) -> list[SourceChunk]:
        """Load a recorded PR list from a local JSON file
        (`{"workspace": "owner/repo", "pulls": [...GitHub API PR objects...]}`)
        instead of the live API. Real use case, not just a test hack: there
        is no real `acme/infra` repo, so `fixtures/github_prs.json` is how
        the seeded corpus's ~30 PRs (memory/CORPUS_OUTLINE.md) get ingested
        at all in an environment with no GitHub token to fetch from."""
        data = json.loads(Path(fixture_path).read_text(encoding="utf-8"))
        owner, repo = data["workspace"].split("/", 1)
        return [self._to_chunk(owner, repo, pr) for pr in data["pulls"]]

    def _to_chunk(self, owner: str, repo: str, pr: dict) -> SourceChunk:
        body = pr.get("body") or ""
        content = f"{pr['title']}\n\n{body}".strip()
        return SourceChunk(
            id=f"gh_pr_{pr['number']}",
            source_type="github_pr",
            content=content,
            url=pr["html_url"],
            author=(pr.get("user") or {}).get("login", "unknown"),
            created_at=pr["created_at"],
            metadata={"owner": owner, "repo": repo, "number": pr["number"], "state": pr["state"]},
        )

    def _get_all_pages(self, url: str, params: dict) -> list[dict]:
        results: list[dict] = []
        page = 1
        while True:
            response = self._session.get(url, params={**params, "page": page, "per_page": 100}, timeout=10)
            self._respect_rate_limit(response)
            response.raise_for_status()
            batch = response.json()
            if not batch:
                break
            results.extend(batch)
            if len(batch) < 100:
                break
            page += 1
        return results

    def _respect_rate_limit(self, response: requests.Response) -> None:
        remaining = response.headers.get("X-RateLimit-Remaining")
        if remaining is None or int(remaining) > 0:
            return
        reset_at = int(response.headers.get("X-RateLimit-Reset", "0"))
        sleep_for = max(0.0, reset_at - time.time())
        time.sleep(min(sleep_for, _MAX_BACKOFF_S))


# Not implemented: fetching ADR markdown from a repo path via the contents
# API. person-b-brief.md bundles "GitHub (PRs, ADR markdown)" into one
# connector; this file covers the PR half only. The seed corpus's ADRs are
# currently served by connectors/postmortem.py reading local markdown
# instead (memory/corpus/adrs/*.md), which is a reasonable stand-in until a
# real GitHub-hosted ADR path exists to fetch from.
