from __future__ import annotations

import pytest

from control import local_ledger


@pytest.fixture(autouse=True)
def _isolated_ledger(tmp_path, monkeypatch):
    monkeypatch.setenv("LOCAL_LEDGER_PATH", str(tmp_path / "ledger.json"))
    yield


def _append(n: int = 1, result: str = "executed") -> dict:
    record = None
    for _ in range(n):
        record = local_ledger.append_record(
            incident_id="inc_1",
            action={"id": "a1", "tool": "demo.reset_chaos_config", "args": {}},
            gates={"G1": {"decision": "pass"}},
            causal_basis={},
            diff={},
            result=result,
            actor="watchdog",
        )
    return record


def test_first_record_chains_from_genesis() -> None:
    record = _append()
    assert record["record_id"] == 1
    assert record["prev_hash"] == local_ledger._GENESIS_HASH


def test_records_chain_and_verify() -> None:
    _append(3)
    result = local_ledger.verify_chain()
    assert result == {"valid": True, "records_checked": 3}


def test_tampering_is_detected() -> None:
    _append(2)
    records = local_ledger._read_all()
    records[0]["result"] = "tampered"
    local_ledger._write_all(records)
    result = local_ledger.verify_chain()
    assert result["valid"] is False


def test_list_records_newest_first_and_limited() -> None:
    _append(3)
    records = local_ledger.list_records(limit=2)
    assert [r["record_id"] for r in records] == [3, 2]


def test_rules_applied_defaults_to_empty_list() -> None:
    record = _append()
    assert record["rules_applied"] == []
