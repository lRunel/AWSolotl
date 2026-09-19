"""Slack export connector. Per person-b-brief.md and the design doc's scope
cut, this reads a Slack **export** file (a JSON dump of one channel), not a
live Slack API integration -- no OAuth scopes, no rate limits, no network
call at all. One `SourceChunk` per top-level message, with any thread
replies folded into its content so a reply isn't anchored or scanned
separately from the message it replies to.

Export file shape (`memory/corpus/slack/*.json`):
{"channel": "...", "messages": [{"user": "...", "text": "...", "ts": "<unix>.<micro>",
 "thread_replies": [{"user": "...", "text": "...", "ts": "..."}]}]}
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from connectors.base import BaseConnector, SourceChunk


def _ts_to_iso(ts: str) -> str:
    return datetime.fromtimestamp(float(ts), tz=timezone.utc).isoformat().replace("+00:00", "Z")


class SlackExportConnector(BaseConnector):
    def __init__(self, export_dir: Path | str) -> None:
        self._dir = Path(export_dir)

    def authenticate(self, token: str) -> bool:
        # A local export file needs no auth; present for interface parity.
        return True

    def get_source_name(self) -> str:
        return "slack_export"

    def fetch_all(self, workspace_id: str) -> list[SourceChunk]:
        return list(self._iter_chunks())

    def fetch_since(self, workspace_id: str, since: str) -> list[SourceChunk]:
        return [chunk for chunk in self._iter_chunks() if chunk.created_at >= since]

    def _iter_chunks(self):
        if not self._dir.exists():
            return
        for path in sorted(self._dir.glob("*.json")):
            export = json.loads(path.read_text(encoding="utf-8"))
            channel = export["channel"]
            for message in export.get("messages", []):
                yield self._to_chunk(channel, message, path)

    def _to_chunk(self, channel: str, message: dict, path: Path) -> SourceChunk:
        lines = [message["text"]]
        for reply in message.get("thread_replies", []):
            lines.append(f"Reply @{reply['user']}: {reply['text']}")
        content = "\n".join(lines)
        ts = message["ts"]

        return SourceChunk(
            id=f"slack_{channel}_{ts.replace('.', '_')}",
            source_type="slack_message",
            content=content,
            url=f"slack://{channel}/{ts}",
            author=message["user"],
            created_at=_ts_to_iso(ts),
            metadata={
                "channel": channel,
                "ts": ts,
                "reply_count": len(message.get("thread_replies", [])),
                "path": str(path.name),
            },
        )
