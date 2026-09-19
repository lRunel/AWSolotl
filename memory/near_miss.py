"""Near-miss rule proposals (person-b-brief.md task 19): repeated denials on
the same (tool, entity) pair propose a candidate rule for human approval.
A proposal is a `status: candidate` Rule -- per the trust ladder it has zero
effect on any gate until a human approves and signs it (memory/compile.py).

This only ever *proposes*; it never signs, and it never invents a template
outside the closed vocabulary. When the specific circumstances of the
denials aren't known (only that the same tool+entity keeps getting denied),
`requires_human` is the safest template to propose -- it is the one
template that adds a control without asserting a specific precondition or
window this module has no evidence for.
"""
from __future__ import annotations

from collections import Counter


def propose_from_denials(denial_log: list[dict], existing_rules: list[dict], threshold: int = 3) -> list[dict]:
    """denial_log: [{"tool": ..., "entity": ...}, ...], one entry per Gate 2
    deny. existing_rules: any candidate/signed Rule dicts already covering a
    (tool, entity) pair, so this never re-proposes the same combination.
    Returns a list of new candidate Rule dicts (status: candidate, no
    rule_id -- assigned by the approval flow, not by this module).
    """
    covered = {(rule["slots"].get("tool"), rule["slots"].get("entity")) for rule in existing_rules}

    counts = Counter((entry["tool"], entry["entity"]) for entry in denial_log)
    proposals = []
    for (tool, entity), count in counts.items():
        if count < threshold or (tool, entity) in covered:
            continue
        proposals.append(
            {
                "template": "requires_human",
                "slots": {"tool": tool, "entity": entity},
                "source_ref": f"near-miss:{tool}:{entity}",
                "status": "candidate",
                "note": f"{count} denied attempts at {tool} on {entity} in the observed window",
            }
        )
    return proposals
