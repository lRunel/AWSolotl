"""Gate 2 -- formal policy proof (Cedar generic invariants + signed org rules).

A pure function of (plan, action, ctx): the twelve generic invariants are
loaded once at import time from invariants/generic/*.cedar, and every fact
Cedar needs (causal_abstained, change_freeze, quorum_min, ...) arrives
through `ctx` or is derived from `action` -- this module never calls boto3
or touches AWS. That is what makes it testable without an account and keeps
it a real gate rather than an LLM-adjacent guess.

Org rules (invariants/org/*.cedar, loaded and compiled by memory/compile.py)
are I3 work and are not wired in yet; only the generic invariants run today.

Set LOCKSTEP_STUB=1 to force the I0 fixed-pass stub instead of real Cedar
evaluation. Per references/branching.md the stub is never deleted -- it is
the fixture-mode fallback the demo uses if live Cedar breaks on stage.
"""
from __future__ import annotations

import os
import time
from pathlib import Path

import cedarpy

_INVARIANTS_DIR = Path(__file__).resolve().parent.parent / "invariants" / "generic"

_WHY_BY_INVARIANT = {
    "INV-01": "security group ingress from 0.0.0.0/0 is forbidden on any port except 443",
    "INV-02": "a prod service may not be scaled below its quorum",
    "INV-03": "nothing destructive may run while the causal verdict is abstained",
    "INV-04": "no action is allowed during a declared change freeze without a human override",
    "INV-05": "an agent may never delete a data store",
    "INV-06": "an IAM change may not grant access the old policy did not",
    "INV-07": "an agent may never disable or delete an audit source",
    "INV-08": "a KMS key that is in use may not be rotated or deleted",
    "INV-09": "the rollback target image has a known critical CVE",
    "INV-10": "no single action may touch more than one availability zone at once",
    "INV-11": "a primary may not be restarted while a write lock is held",
    "INV-12": "the target is outside the declared account or region",
}

_HINT_BY_INVARIANT = {
    "INV-01": "restrict cidr to a named range, or use sg.revoke_ingress instead",
    "INV-02": "call verify.slo first, or raise desired_count to at least quorum_min",
    "INV-03": "wait for a non-abstained causal verdict before proposing a destructive action",
    "INV-04": "wait for the freeze window to end, or obtain a human override",
    "INV-05": "this tool is red-team tier and is never available to an agent",
    "INV-06": "scope the policy change to exactly what the old policy already granted",
    "INV-07": "this tool is red-team tier and is never available to an agent",
    "INV-08": "wait until the key is no longer in use, or rotate a different key",
    "INV-09": "roll back to a revision without a critical CVE, or patch first",
    "INV-10": "split the plan into one action per availability zone",
    "INV-11": "wait for the write lock to release before restarting",
    "INV-12": "target only the declared account and us-east-1",
}


def _load_policy_set() -> cedarpy.PolicySet:
    files = sorted(_INVARIANTS_DIR.glob("*.cedar"))
    if not files:
        raise RuntimeError(f"no .cedar files found under {_INVARIANTS_DIR}")
    text = "\n\n".join(f.read_text(encoding="utf-8") for f in files)
    return cedarpy.PolicySet.from_str(text)


_POLICY_SET = _load_policy_set()


def _build_context(action: dict, ctx: dict) -> dict:
    """Everything Cedar needs lives in `context`, never in entity attributes,
    so a single generic Resource/Action pairing works for every tool without
    per-tool entity modelling. Every field has a safe default so an invariant
    about a fact this action doesn't involve (e.g. `cidr` on an ecs tool)
    simply never matches, instead of Cedar raising a missing-attribute error.
    """
    blast_radius = action.get("blast_radius", {}) or {}
    args = action.get("args", {}) or {}
    accounts = blast_radius.get("accounts") or [None]

    context: dict = {
        "causal_abstained": False,
        "change_freeze": False,
        "human_override": False,
        "kms_key_in_use": False,
        "image_max_severity": "LOW",
        "az_count": 1,
        "write_lock_held": False,
        "new_access_beyond_declared": False,
        "env": "prod",
        "cidr": "",
        "port": -1,
        "new_count": 0,
        "quorum_min": 0,
        "declared_account": accounts[0],
        **ctx,
    }

    # Facts derived from the action itself always win over ambient ctx --
    # they describe the specific action being checked, not the incident.
    context["data_destructive"] = bool(blast_radius.get("data_destructive", False))
    context["account"] = accounts[0]
    context["region"] = blast_radius.get("region", "us-east-1")
    if "desired_count" in args:
        context["new_count"] = args["desired_count"]
    if "cidr" in args:
        context["cidr"] = args["cidr"]
    if "port" in args:
        context["port"] = args["port"]

    prev_task_count = ctx.get("prev_task_count")
    if prev_task_count is not None:
        # Cedar has no division operator -- precompute here.
        context["quorum_min"] = prev_task_count // 2 + 1

    return context


def gate2_check(plan: dict, action: dict, ctx: dict) -> dict:
    started = time.monotonic()
    if os.environ.get("LOCKSTEP_STUB") == "1":
        return _stub_pass(started)

    context = _build_context(action, ctx)
    request = {
        "principal": {"type": "Agent", "id": ctx.get("actor", "agent")},
        "action": {"type": "Action", "id": action["tool"]},
        "resource": {
            "type": "Resource",
            "id": (action.get("blast_radius", {}).get("arns") or ["unknown"])[0],
        },
        "context": context,
    }
    result = cedarpy.is_authorized(request, _POLICY_SET, entities=[])
    latency_ms = (time.monotonic() - started) * 1000

    if result.allowed:
        return {
            "gate": "proof",
            "decision": "pass",
            "reason_code": "generic_invariants_ok",
            "latency_ms": latency_ms,
            "schema_version": 1,
        }

    invariant = next(iter(result.diagnostics.id_annotations_by_reason.values()), "UNKNOWN")
    return {
        "gate": "proof",
        "decision": "deny",
        "reason_code": "generic_invariant",
        "invariant": invariant,
        "why": _WHY_BY_INVARIANT.get(invariant, "a generic invariant forbids this action"),
        "values": context,
        "citation": None,
        "hint": _HINT_BY_INVARIANT.get(invariant, ""),
        "retries_left": 2,
        "latency_ms": latency_ms,
        "schema_version": 1,
    }


def _stub_pass(started: float) -> dict:
    return {
        "gate": "proof",
        "decision": "pass",
        "reason_code": "stub_always_pass",
        "latency_ms": (time.monotonic() - started) * 1000,
        "schema_version": 1,
    }
