"""Local, file-backed ledger for running the whole gate -> execute -> record
loop on a laptop with no AWS credentials.

control/ledger.py (Person A, DynamoDB + S3 Object Lock) is the real,
owned implementation and is untouched by this module. This is a drop-in
sibling with the same hash-chain algorithm (canonical JSON, SHA-256,
prev_hash linking) and the same LedgerRecord shape
(schemas/ledger_record.schema.json), so records written here are structurally
identical to what the DynamoDB path would have produced -- the only
difference is where the chain is persisted. When real AWS credentials and
table names are configured, callers should use control.ledger instead; this
module exists so the local control-api (services/control-api) and its
self-healing watchdog have somewhere to write without an AWS account.
"""
from __future__ import annotations

import hashlib
import json
import os
import threading
from pathlib import Path
from typing import Any

_DEFAULT_PATH = Path(__file__).resolve().parent.parent / "var" / "local_ledger.json"
_GENESIS_HASH = "0" * 68
_lock = threading.Lock()


def _ledger_path() -> Path:
    return Path(os.environ.get("LOCAL_LEDGER_PATH", str(_DEFAULT_PATH)))


def canonical_json(data: dict) -> str:
    return json.dumps(data, separators=(",", ":"), sort_keys=True, ensure_ascii=False)


def hash_record(record: dict) -> str:
    to_hash = {k: v for k, v in record.items() if k != "hash"}
    return hashlib.sha256(canonical_json(to_hash).encode("utf-8")).hexdigest()


def _read_all() -> list[dict]:
    path = _ledger_path()
    if not path.exists():
        return []
    text = path.read_text(encoding="utf-8").strip()
    if not text:
        return []
    return json.loads(text)["records"]


def _write_all(records: list[dict]) -> None:
    path = _ledger_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(canonical_json({"records": records}), encoding="utf-8")
    tmp.replace(path)


def get_head() -> tuple[int, str]:
    records = _read_all()
    if not records:
        return 0, _GENESIS_HASH
    last = records[-1]
    return last["record_id"], last["hash"]


def append_record(
    incident_id: str,
    action: dict,
    gates: dict,
    causal_basis: dict,
    diff: dict,
    result: str,
    actor: str,
    rules_applied: list[str] | None = None,
) -> dict:
    """Same contract as control.ledger.append_record, except it returns the
    full record dict (the local control-api hands this straight back to the
    dashboard) instead of just the record_id."""
    with _lock:
        records = _read_all()
        last_n, prev_hash = (records[-1]["record_id"], records[-1]["hash"]) if records else (0, _GENESIS_HASH)
        n = last_n + 1

        record: dict[str, Any] = {
            "record_id": n,
            "prev_hash": prev_hash,
            "incident_id": incident_id,
            "action": action,
            "gates": gates,
            "rules_applied": rules_applied or [],
            "causal_basis": causal_basis,
            "diff": diff,
            "result": result,
            "actor": actor,
        }
        record["hash"] = hash_record(record)

        records.append(record)
        _write_all(records)
        return record


def list_records(limit: int | None = None) -> list[dict]:
    records = _read_all()
    if limit is not None:
        return records[-limit:][::-1]
    return records[::-1]


def verify_chain() -> dict:
    records = _read_all()
    if not records:
        return {"valid": True, "records_checked": 0}

    prev_hash = _GENESIS_HASH
    for record in records:
        if record["prev_hash"] != prev_hash:
            return {"valid": False, "reason": f"Record {record['record_id']} prev_hash mismatch"}
        computed = hash_record(record)
        if record["hash"] != computed:
            return {"valid": False, "reason": f"Record {record['record_id']} hash tampered"}
        prev_hash = computed

    return {"valid": True, "records_checked": len(records)}


def reset() -> None:
    """Test/demo-reset helper only -- wipes the local chain file."""
    path = _ledger_path()
    if path.exists():
        path.unlink()
