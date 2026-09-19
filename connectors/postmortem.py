"""Markdown corpus connector: postmortems and ADRs are the same shape on
disk (a title, an `Author:`/`Date:` header, then prose), so one connector
handles both, distinguishing `source_type` by which subdirectory a file
lives under. This is the "postmortem markdown" connector from
contracts.md's repository layout; GitHub and Slack are separate connectors
(I2 tasks, not started).

No auth is needed for a local filesystem source -- `authenticate` always
returns True, matching the interface everyone else's connector shares.
"""
from __future__ import annotations

import re
from pathlib import Path

from connectors.base import BaseConnector, SourceChunk

_HEADER_RE = re.compile(r"^(Author|Date):\s*(.+)$", re.MULTILINE)

_SOURCE_TYPE_BY_DIR = {
    "postmortems": "postmortem",
    "adrs": "adr",
}


def _parse_header(content: str) -> tuple[str, str]:
    fields = dict(_HEADER_RE.findall(content))
    return fields.get("Author", "unknown"), fields.get("Date", "1970-01-01T00:00:00Z")


class PostmortemConnector(BaseConnector):
    def __init__(self, corpus_root: Path | str) -> None:
        self._root = Path(corpus_root)

    def authenticate(self, token: str) -> bool:
        return True

    def get_source_name(self) -> str:
        return "postmortem"

    def fetch_all(self, workspace_id: str) -> list[SourceChunk]:
        return list(self._iter_chunks())

    def fetch_since(self, workspace_id: str, since: str) -> list[SourceChunk]:
        return [chunk for chunk in self._iter_chunks() if chunk.created_at >= since]

    def _iter_chunks(self):
        for subdir, source_type in _SOURCE_TYPE_BY_DIR.items():
            directory = self._root / subdir
            if not directory.exists():
                continue
            for path in sorted(directory.glob("*.md")):
                content = path.read_text(encoding="utf-8")
                author, created_at = _parse_header(content)
                yield SourceChunk(
                    id=f"{source_type}_{path.stem}",
                    source_type=source_type,
                    content=content,
                    url=f"local:{path.as_posix()}",
                    author=author,
                    created_at=created_at,
                    metadata={"path": str(path.relative_to(self._root))},
                )
