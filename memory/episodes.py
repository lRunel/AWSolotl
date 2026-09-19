"""Ledger-to-episodes indexing and Ask-why (person-b-brief.md task 19).

The real ledger (control/ledger.py, DynamoDB-backed) is Person A's and
doesn't exist in this repo. This module operates on any dict matching
schemas/ledger_record.schema.json, so it's testable against fixture records
today and needs no code change once a real ledger exists to index from.

Ask-why here is deliberately split in two: the retrieval and citation logic
(real, deterministic, tested) and the natural-language answer composition
(needs an LLM -- Bedrock -- which this environment doesn't have, same as
memory/extract.py). What's implemented is the part the design doc's success
metric actually measures: "100% cite a real record id or say unknown."
"""
from __future__ import annotations

_BAD_OUTCOME_MARKERS = ["worse", "failed", "failure", "rolled back", "rollback", "regression"]
_GOOD_OUTCOME_MARKERS = ["recovered", "success", "resolved", "improved"]


def classify_outcome(result_text: str) -> str:
    """Heuristic, not authoritative: a real system would want this outcome
    explicitly recorded by whatever executed the action, not inferred from
    free text after the fact. Documented here as a known simplification."""
    text = (result_text or "").lower()
    if any(marker in text for marker in _BAD_OUTCOME_MARKERS):
        return "bad"
    if any(marker in text for marker in _GOOD_OUTCOME_MARKERS):
        return "good"
    return "unknown"


def build_episode(record: dict) -> dict:
    """LedgerRecord -> episode (contracts.md section 8's episodes table:
    PK ledger_record_id, entity_ids[], tool, outcome, gate_summary,
    rule_ids_applied[])."""
    action = record.get("action") or {}
    args = action.get("args") or {}
    entity = args.get("service", "")
    return {
        "ledger_record_id": record["record_id"],
        "entity_ids": [f"ecs/{entity}"] if entity else [],
        "tool": action.get("tool", ""),
        "outcome": classify_outcome(record.get("result", "")),
        "gate_summary": record.get("gates", {}),
        "rule_ids_applied": record.get("rules_applied", []),
    }


class EpisodeIndex:
    def __init__(self) -> None:
        self._episodes: dict[int, dict] = {}

    def index_record(self, record: dict) -> dict:
        episode = build_episode(record)
        self._episodes[episode["ledger_record_id"]] = episode
        return episode

    def all_episodes(self) -> list[dict]:
        return list(self._episodes.values())


def ask_why(question: str, episodes: list[dict]) -> dict:
    """Deterministic keyword match on tool name / entity name appearing in
    the question. Returns {"answer", "cited_record_ids", "cited"}. Never
    invents a record id: every id in `cited_record_ids` came directly from
    a matched episode, or the list is empty and `cited` is False.
    """
    q = question.lower()
    matches = []
    for episode in episodes:
        tool_hit = bool(episode["tool"]) and episode["tool"].lower() in q
        entity_hit = any(entity_id.split("/")[-1].lower() in q for entity_id in episode["entity_ids"])
        if tool_hit or entity_hit:
            matches.append(episode)

    if not matches:
        return {
            "answer": "I could not find enough information in the indexed sources.",
            "cited_record_ids": [],
            "cited": False,
        }

    record_ids = sorted({m["ledger_record_id"] for m in matches})
    sentences = [
        f"Ledger record {m['ledger_record_id']}: {m['tool']} on "
        f"{', '.join(m['entity_ids']) or 'an unknown entity'} -- outcome {m['outcome']}, "
        f"rules applied: {', '.join(m['rule_ids_applied']) or 'none'}."
        for m in matches
    ]
    return {"answer": " ".join(sentences), "cited_record_ids": record_ids, "cited": True}
