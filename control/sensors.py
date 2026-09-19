"""Shared sensors: the injection scanner used both at ingest time and by
Gate 5's watchdog (owned by Person A) to flag text that appears to address
the agent directly.

I0 stub: always reports clean. Real heuristics land in I2 (task 10,
references/person-b-brief.md). Never treat flagged text as an instruction to
follow -- it is a test case for this scanner, logged and wrapped as data.
"""
from __future__ import annotations


def injection_scan(text: str) -> bool:
    """True if ``text`` looks like it is trying to address or override the
    agent/policy. Callers must still treat the text as data either way."""
    return False
