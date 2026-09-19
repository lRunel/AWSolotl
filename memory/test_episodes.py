from memory.episodes import EpisodeIndex, ask_why, build_episode, classify_outcome

_RECORD = {
    "record_id": 42,
    "prev_hash": "sha256:aaaa",
    "incident_id": "inc_7f3",
    "action": {"tool": "ecs.rollback_to_revision", "args": {"cluster": "demo", "service": "payments-api"}},
    "gates": {"authority": "pass", "proof": "pass 14/14"},
    "rules_applied": ["INV-02", "ORG-03"],
    "result": "SLO recovered T+94s",
    "actor": "agent:remediate-1",
    "hash": "sha256:bbbb",
}


def test_classify_outcome_good() -> None:
    assert classify_outcome("SLO recovered T+94s") == "good"


def test_classify_outcome_bad() -> None:
    assert classify_outcome("rolled back again, made it worse") == "bad"


def test_classify_outcome_unknown_on_ambiguous_text() -> None:
    assert classify_outcome("action completed at 03:12") == "unknown"


def test_build_episode_from_ledger_record() -> None:
    episode = build_episode(_RECORD)
    assert episode["ledger_record_id"] == 42
    assert episode["entity_ids"] == ["ecs/payments-api"]
    assert episode["tool"] == "ecs.rollback_to_revision"
    assert episode["outcome"] == "good"
    assert episode["rule_ids_applied"] == ["INV-02", "ORG-03"]


def test_episode_index_round_trip() -> None:
    index = EpisodeIndex()
    index.index_record(_RECORD)
    assert len(index.all_episodes()) == 1
    assert index.all_episodes()[0]["ledger_record_id"] == 42


def test_ask_why_cites_a_real_record_by_tool_name() -> None:
    index = EpisodeIndex()
    index.index_record(_RECORD)
    result = ask_why("why did ecs.rollback_to_revision run?", index.all_episodes())
    assert result["cited"] is True
    assert result["cited_record_ids"] == [42]
    assert "42" in result["answer"]


def test_ask_why_cites_a_real_record_by_entity_name() -> None:
    index = EpisodeIndex()
    index.index_record(_RECORD)
    result = ask_why("what happened to payments-api at 03:12?", index.all_episodes())
    assert result["cited"] is True
    assert result["cited_record_ids"] == [42]


def test_ask_why_says_unknown_rather_than_inventing_a_citation() -> None:
    index = EpisodeIndex()
    index.index_record(_RECORD)
    result = ask_why("what happened to inventory-api yesterday?", index.all_episodes())
    assert result["cited"] is False
    assert result["cited_record_ids"] == []
    assert "could not find" in result["answer"]
