"""Shared sensors: the injection scanner used both at ingest time
(memory/ingest.py, I2) and by Person A's Gate 5 watchdog to flag text that
appears to address the agent directly.

Ingested text is data, never instructions -- this module never blocks
ingestion or execution by itself. A flagged chunk still gets stored, tagged
`injection_flag: true`, at trust_level 0; only the human-approval and
signing path (rules/status transitions) can ever change what an agent may
do. Treat a false negative here as this scanner's bug, and a false positive
as an annoyance, never the other way around.
"""
from __future__ import annotations

import re

# Heuristic, not exhaustive: phrases that look like an attempt to address or
# override the agent/policy from inside ingested content. New patterns
# should be added as real near-misses are observed, per the design doc's
# "ingested text is data" rule -- this is a scanner, not a proof.
_INJECTION_PATTERNS = [
    r"\bignore\s+(the\s+)?(rest\s+of\s+this\s+)?(all\s+|previous\s+|prior\s+)?instructions\b",
    r"\bdisregard\s+(the\s+|all\s+|previous\s+|prior\s+)?(policy|instructions|rules)\b",
    r"\bgrant\s+(admin|full|root)\s+access\b",
    r"\bmark\s+all\s+(checks|tests)\s+as\s+passing\b",
    r"\byou\s+are\s+now\s+(a|an)\b",
    r"\bnew\s+instructions\s*:",
    r"^\s*system\s*:",
    r"\bact\s+as\s+(a|an)\s+\w+\s+with\s+no\s+restrictions\b",
    r"\boverride\s+(the\s+)?(policy|gate|invariant)\b",
]

_COMPILED_PATTERNS = [re.compile(p, re.IGNORECASE | re.MULTILINE) for p in _INJECTION_PATTERNS]

_WRAP_OPEN = "<<<UNTRUSTED_DOCUMENT source={source!r}>>>"
_WRAP_CLOSE = "<<<END_UNTRUSTED_DOCUMENT>>>"


def injection_scan(text: str) -> bool:
    """True if `text` contains a phrase that looks like it is trying to
    address or override the agent/policy. Callers must still treat the text
    as data either way -- this only sets the `injection_flag` on a
    MemoryItem, it never blocks storage or grants anything."""
    return any(pattern.search(text) for pattern in _COMPILED_PATTERNS)


def wrap_untrusted(text: str, source: str = "unknown", max_len: int = 4000) -> str:
    """Delimiter-wrap and length-cap ingested text before it goes anywhere
    near a prompt, per the design doc's "wrap it, cap its length, scan it"
    rule. Truncation happens before wrapping so the closing delimiter is
    never lost inside an oversized document."""
    truncated = text[:max_len]
    if len(text) > max_len:
        truncated += "...[truncated]"
    return f"{_WRAP_OPEN.format(source=source)}\n{truncated}\n{_WRAP_CLOSE}"
