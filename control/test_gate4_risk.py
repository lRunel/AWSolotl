"""Real Gate 4 risk scoring (I4 task 18). No LLM, no boto3 -- a pure
function of (plan, action, ctx), same discipline as Gate 2.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator
from referencing import Registry, Resource

from connectors.postmortem import PostmortemConnector
from control.gate4 import gate4_score
from memory.ingest import ingest
from memory.store import MemoryItemStore

_SCHEMAS_DIR = Path(__file__).resolve().parent.parent / "schemas"
_GATE_RESULT_SCHEMA = json.loads((_SCHEMAS_DIR / "gate_result.schema.json").read_text(encoding="utf-8"))
_DENY_REASON_SCHEMA = json.loads((_SCHEMAS_DIR / "deny_reason.schema.json").read_text(encoding="utf-8"))
_REGISTRY = Registry().with_resources(
    [
        (_GATE_RESULT_SCHEMA["$id"], Resource.from_contents(_GATE_RESULT_SCHEMA)),
        (_DENY_REASON_SCHEMA["$id"], Resource.from_contents(_DENY_REASON_SCHEMA)),
    ]
)
_CORPUS_ROOT = Path(__file__).resolve().parent.parent / "memory" / "corpus"


def _validate_gate_result(instance: dict) -> None:
    Draft202012Validator(_GATE_RESULT_SCHEMA, registry=_REGISTRY).validate(instance)


def _action(tool: str = "ecs.scale", data_destructive: bool = False) -> dict:
    return {
        "tool": tool,
        "args": {"service": "payments-api"},
        "blast_radius": {
            "accounts": ["123456789012"],
            "region": "us-east-1",
            "arns": ["arn:aws:ecs:us-east-1:123456789012:service/demo/payments-api"],
            "max_tasks": 4,
            "data_destructive": data_destructive,
        },
    }


@pytest.fixture(autouse=True)
def _real_gate4(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LOCKSTEP_STUB", "0")


def test_default_ctx_gives_low_risk_and_l2_cap() -> None:
    result = gate4_score(plan={}, action=_action(), ctx={})
    assert result["decision"] == "pass"
    assert result["values"]["risk"] == pytest.approx(0.10)
    assert result["values"]["autonomy_cap"] == "L2"
    _validate_gate_result(result)


def test_low_confidence_high_irreversibility_gives_l0_cap() -> None:
    result = gate4_score(
        plan={},
        action=_action(),
        ctx={"causal_confidence": 0.2, "blast_radius_norm": 1.0, "irreversibility": 1.0},
    )
    assert result["decision"] == "pass"
    assert result["values"]["risk"] == pytest.approx(0.79)
    assert result["values"]["autonomy_cap"] == "L0"


def test_requested_autonomy_beyond_cap_is_denied() -> None:
    result = gate4_score(
        plan={},
        action=_action(),
        ctx={
            "causal_confidence": 0.2,
            "blast_radius_norm": 1.0,
            "irreversibility": 1.0,
            "requested_autonomy": "L2",
        },
    )
    assert result["decision"] == "deny"
    assert result["invariant"] == "RISK_CAP"
    assert result["values"]["autonomy_cap"] == "L0"
    assert result["values"]["requested_autonomy"] == "L2"
    assert result["retries_left"] == 0
    _validate_gate_result(result)


def test_requested_autonomy_within_cap_passes() -> None:
    result = gate4_score(plan={}, action=_action(), ctx={"requested_autonomy": "L1"})
    assert result["decision"] == "pass"


def test_requested_autonomy_equal_to_cap_passes() -> None:
    result = gate4_score(plan={}, action=_action(), ctx={"requested_autonomy": "L2"})
    assert result["decision"] == "pass"


def test_no_memory_store_defaults_to_max_novelty_zero_failure_rate() -> None:
    result = gate4_score(plan={}, action=_action(), ctx={"entity": "ecs/orders-db"})
    assert result["values"]["novelty"] == 1.0
    assert result["values"]["historical_failure_rate"] == 0.0


def test_precedent_from_real_corpus_raises_failure_rate_and_lowers_novelty() -> None:
    store = MemoryItemStore()
    ingest(PostmortemConnector(_CORPUS_ROOT), workspace_id="acme", store=store)

    result = gate4_score(
        plan={},
        action=_action(tool="ecs.rollback_to_revision"),
        ctx={"memory_store": store, "entity": "ecs/orders-db"},
    )
    assert result["values"]["historical_failure_rate"] == 1.0
    assert result["values"]["novelty"] == 0.5
    # precedent only ever raises risk, it must not by itself deny anything
    assert result["decision"] == "pass"


def test_precedent_does_not_affect_an_unrelated_tool_on_the_same_entity() -> None:
    store = MemoryItemStore()
    ingest(PostmortemConnector(_CORPUS_ROOT), workspace_id="acme", store=store)

    result = gate4_score(
        plan={},
        action=_action(tool="verify.slo"),
        ctx={"memory_store": store, "entity": "ecs/orders-db"},
    )
    assert result["values"]["historical_failure_rate"] == 0.0
