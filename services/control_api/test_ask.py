from __future__ import annotations

from services.control_api.ask import ask_why

_RECORDS = [
    {
        "record_id": 1,
        "incident_id": "inc_1",
        "action": {"tool": "demo.restart_web_service", "blast_radius": {"arns": ["arn:aws:local:us-east-1:0:service/demo/web"]}},
        "gates": {"G1": {"decision": "pass"}},
        "result": "executed",
        "actor": "watchdog",
    },
    {
        "record_id": 2,
        "incident_id": "inc_2",
        "action": {"tool": "demo.reset_chaos_config", "blast_radius": {"arns": ["arn:aws:local:us-east-1:0:service/demo/payments"]}},
        "gates": {"G2": {"decision": "deny", "why": "org rule ORG-01"}},
        "result": "deny at G2: org rule ORG-01",
        "actor": "watchdog",
    },
]


def test_matches_by_tool_keyword() -> None:
    result = ask_why("why did the web service restart", _RECORDS)
    assert result["cited"] is True
    assert result["cited_record_ids"] == [1]


def test_matches_by_incident_id() -> None:
    result = ask_why("what happened in inc_2", _RECORDS)
    assert result["cited_record_ids"] == [2]


def test_denied_record_names_the_gate() -> None:
    result = ask_why("inc_2", _RECORDS)
    assert "denied at G2" in result["answer"]


def test_no_match_says_unknown() -> None:
    result = ask_why("what happened to the database", _RECORDS)
    assert result == {"answer": "I could not find enough information in the indexed sources.", "cited_record_ids": [], "cited": False}
