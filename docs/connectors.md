# Connectors

`connectors/base.py` defines `SourceChunk` and `BaseConnector`; `connectors/postmortem.py` implements it for local markdown postmortems and ADRs (`memory/corpus/{postmortems,adrs}/*.md`), parsing an `Author:`/`Date:` header. Depends on `schemas/source_chunk.schema.json`. Breaks if a corpus file drops its `Author:`/`Date:` header (silently falls back to `"unknown"` / epoch rather than failing loud) or if a filename is reused across `postmortems/` and `adrs/`, producing a duplicate chunk id.

`connectors/github.py` fetches pull requests (paginated, `per_page=100`, backing off on `X-RateLimit-Reset` when `X-RateLimit-Remaining` hits zero) given `workspace_id="owner/repo"`. Tested entirely against a fake `requests.Session` -- no real network calls or rate-limit spend. Does not fetch ADR markdown from a repo path (person-b-brief.md's "GitHub (PRs, ADR markdown)" is split: this file is the PR half, `connectors/postmortem.py` covers ADRs from local files instead). Breaks if GitHub ever changes pagination past `page`/`per_page` query params, or if a PR's `body` is `None` and a caller assumes a string without the same null-check this module already does.

Slack export connector is not started.
