import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator
from referencing import Registry, Resource

from control.gate2 import gate2_check
from control.gate4 import gate4_score

_SCHEMAS_DIR = Path(__file__).resolve().parent.parent / "schemas"
_GATE_RESULT_SCHEMA = json.loads((_SCHEMAS_DIR / "gate_result.schema.json").read_text(encoding="utf-8"))
_DENY_REASON_SCHEMA = json.loads((_SCHEMAS_DIR / "deny_reason.schema.json").read_text(encoding="utf-8"))
_REGISTRY = Registry().with_resources(
    [
        (_GATE_RESULT_SCHEMA["$id"], Resource.from_contents(_GATE_RESULT_SCHEMA)),
        (_DENY_REASON_SCHEMA["$id"], Resource.from_contents(_DENY_REASON_SCHEMA)),
    ]
)


def _validate_gate_result(instance: dict) -> None:
    Draft202012Validator(_GATE_RESULT_SCHEMA, registry=_REGISTRY).validate(instance)


@pytest.fixture(autouse=True)
def _stub_on(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LOCKSTEP_STUB", "1")


def test_gate2_stub_always_passes() -> None:
    result = gate2_check(plan={}, action={}, ctx={})
    assert result["gate"] == "proof"
    assert result["decision"] == "pass"
    assert result["schema_version"] == 1
    _validate_gate_result(result)


def test_gate4_stub_always_passes() -> None:
    result = gate4_score(plan={}, action={}, ctx={})
    assert result["gate"] == "risk"
    assert result["decision"] == "pass"
    assert result["schema_version"] == 1
    _validate_gate_result(result)


def test_gate2_real_mode_pass_and_deny_validate_against_schema(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LOCKSTEP_STUB", "0")
    benign = gate2_check(
        plan={},
        action={
            "tool": "verify.slo",
            "args": {"metric": "checkout.p99", "within_s": 60},
            "blast_radius": {
                "accounts": ["123456789012"],
                "region": "us-east-1",
                "arns": ["arn:aws:cloudwatch:us-east-1:123456789012:metric/checkout"],
                "max_tasks": 0,
                "data_destructive": False,
            },
        },
        ctx={},
    )
    _validate_gate_result(benign)
    assert benign["decision"] == "pass"

    denied = gate2_check(
        plan={},
        action={
            "tool": "ddb.delete_table",
            "args": {},
            "blast_radius": {
                "accounts": ["123456789012"],
                "region": "us-east-1",
                "arns": ["arn:aws:dynamodb:us-east-1:123456789012:table/orders"],
                "max_tasks": 0,
                "data_destructive": True,
            },
        },
        ctx={},
    )
    _validate_gate_result(denied)
    assert denied["decision"] == "deny"
    assert denied["invariant"] == "INV-05"
    assert denied["citation"] is None
