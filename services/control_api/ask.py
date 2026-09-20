"""Ask-the-ledger: same cite-or-unknown contract as ui/ask.js and
memory/episodes.py, applied to the local hash-chained ledger this control-api
writes to (control/local_ledger.py) instead of the seeded fixture episodes.
Deterministic keyword retrieval, not an LLM-composed answer -- same honest
limit as both of those: every answer either names real record_ids from the
chain or says it doesn't know, never a plausible-sounding guess.
"""
from __future__ import annotations


# Generic words that would otherwise false-match almost any record ("service"
# shows up in nearly every ARN this project mints: ".../service/demo/web").
# Matching stays on the specific nouns a question actually names -- the tool
# and the entity (the ARN's last path segment) -- not incidental overlap.
_STOPWORDS = {
    "the", "a", "an", "why", "did", "was", "were", "is", "are", "what",
    "happened", "when", "how", "and", "for", "this", "that", "service",
    "with", "from", "about", "does", "demo",
}


def _record_words(record: dict) -> set[str]:
    action = record.get("action", {})
    entities = {
        arn.split("/")[-1].lower()
        for arn in action.get("blast_radius", {}).get("arns", [])
    }
    tool_words = set(action.get("tool", "").lower().replace(".", "_").split("_"))
    return entities | tool_words | {record.get("incident_id", "").lower()}


def match_records(question: str, records: list[dict]) -> list[dict]:
    q_words = {
        w for w in question.lower().replace("?", " ").replace(",", " ").split()
        if len(w) > 2 and w not in _STOPWORDS
    }
    matches = []
    for record in records:
        if q_words & _record_words(record):
            matches.append(record)
    return matches


def format_answer(matches: list[dict]) -> dict:
    if not matches:
        return {"answer": "I could not find enough information in the indexed sources.", "cited_record_ids": [], "cited": False}

    matches = sorted(matches, key=lambda r: r["record_id"])
    cited_record_ids = [m["record_id"] for m in matches]
    sentences = []
    for m in matches:
        action = m.get("action", {})
        tool = action.get("tool", "unknown tool")
        result = m.get("result", "unknown")
        gates = m.get("gates", {})
        denied_at = next((name for name, g in gates.items() if g.get("decision") == "deny"), None)
        if denied_at:
            sentences.append(
                f"Ledger record {m['record_id']} (incident {m['incident_id']}): {tool} was denied at {denied_at} -- {gates[denied_at].get('why')}."
            )
        else:
            sentences.append(
                f"Ledger record {m['record_id']} (incident {m['incident_id']}): {tool} -- outcome: {result}."
            )
    return {"answer": " ".join(sentences), "cited_record_ids": cited_record_ids, "cited": True}


def ask_why(question: str, records: list[dict]) -> dict:
    return format_answer(match_records(question, records))
