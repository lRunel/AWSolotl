"""One interface for every connector (schemas/source_chunk.schema.json,
contracts.md section 1), so a new source is a new file implementing four
methods and nothing else in the pipeline has to change.

Every SourceChunk is trust_level 0 the moment it leaves a connector: raw,
untrusted text. Anchoring, injection scanning, and human approval are all
downstream of this module, not part of it.
"""
from __future__ import annotations

import hashlib
from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass(frozen=True)
class SourceChunk:
    id: str
    source_type: str  # 'github_pr' | 'postmortem' | 'adr' | 'slack_message'
    content: str
    url: str
    author: str
    created_at: str  # ISO 8601
    content_hash: str = field(default="")
    metadata: dict = field(default_factory=dict)

    def __post_init__(self) -> None:
        if not self.content_hash:
            object.__setattr__(self, "content_hash", content_hash(self.content))


def content_hash(content: str) -> str:
    """sha256 of the exact chunk content, used for staleness detection
    (rule.source_hash flips a signed rule to stale when this no longer
    matches). Hash the content, never a summary of it, or an edit that
    changes meaning without changing whitespace would go undetected."""
    return "sha256:" + hashlib.sha256(content.encode("utf-8")).hexdigest()


class BaseConnector(ABC):
    @abstractmethod
    def authenticate(self, token: str) -> bool: ...

    @abstractmethod
    def fetch_all(self, workspace_id: str) -> list[SourceChunk]: ...

    @abstractmethod
    def fetch_since(self, workspace_id: str, since: str) -> list[SourceChunk]: ...

    @abstractmethod
    def get_source_name(self) -> str: ...
