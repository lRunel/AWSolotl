import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

from control.gate2 import gate2_check
from control.gate4 import gate4_score

_GATE_RESULT_SCHEMA = json.loads(
    (Path(__file__).resolve().parent.parent / "schemas" / "gate_result.schema.json").read_text(
        encoding="utf-8"
    )
)


@pytest.fixture(autouse=True)
def _stub_on(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LOCKSTEP_STUB", "1")


def test_gate2_stub_always_passes() -> None:
    result = gate2_check(plan={}, action={}, ctx={})
    assert result["gate"] == "proof"
    assert result["decision"] == "pass"
    assert result["schema_version"] == 1
    Draft202012Validator(_GATE_RESULT_SCHEMA).validate(result)


def test_gate4_stub_always_passes() -> None:
    result = gate4_score(plan={}, action={}, ctx={})
    assert result["gate"] == "risk"
    assert result["decision"] == "pass"
    assert result["schema_version"] == 1
    Draft202012Validator(_GATE_RESULT_SCHEMA).validate(result)


def test_gate2_raises_once_stub_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LOCKSTEP_STUB", "0")
    with pytest.raises(NotImplementedError):
        gate2_check(plan={}, action={}, ctx={})
