"""Gate 2 -- formal policy proof (Cedar generic invariants + signed org rules).

A pure function of (plan, action, ctx): the twelve generic invariants are
loaded once at import time from invariants/generic/*.cedar (they are frozen
I1 policy, never edited at runtime); every fact Cedar needs (causal_abstained,
change_freeze, quorum_min, entity, ...) arrives through `ctx` or is derived
from `action` -- this module never calls boto3 or touches AWS.

Signed org rules (invariants/org/*.cedar, written by
memory/compile.py:write_signed_rule) are re-read on every call instead of
cached at import time, because a rule can be approved, revoked, or go stale
between requests without a redeploy -- correctness here matters more than
the (small) cost of re-parsing a handful of short policies. Each org rule's
citation sidecar (invariants/org/<id>.meta.json) is read the same way, and
populates a deny's `citation` field.

Set LOCKSTEP_STUB=1 to force the I0 fixed-pass stub instead of real Cedar
evaluation. Per references/branching.md the stub is never deleted -- it is
the fixture-mode fallback the demo uses if live Cedar breaks on stage.
"""
from __future__ import annotations

import json
import os
import time
from pathlib import Path

import cedarpy

_INVARIANTS_DIR = Path(__file__).resolve().parent.parent / "invariants" / "generic"
_ORG_DIR = Path(__file__).resolve().parent.parent / "invariants" / "org"

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


def _read_cedar_files(directory: Path) -> str:
    if not directory.exists():
        return ""
    files = sorted(directory.glob("*.cedar"))
    return "\n\n".join(f.read_text(encoding="utf-8") for f in files)


_GENERIC_TEXT = _read_cedar_files(_INVARIANTS_DIR)
if not _GENERIC_TEXT:
    raise RuntimeError(f"no .cedar files found under {_INVARIANTS_DIR}")
_GENERIC_ONLY_POLICY_SET = cedarpy.PolicySet.from_str(_GENERIC_TEXT)


def _load_policy_set() -> cedarpy.PolicySet:
    """Generic invariants are cached; org rules are re-read every call (see
    module docstring), so the common case -- no org rules signed yet -- stays
    on the cached, already-parsed PolicySet."""
    org_text = _read_cedar_files(_ORG_DIR)
    if not org_text:
        return _GENERIC_ONLY_POLICY_SET
    return cedarpy.PolicySet.from_str(f"{_GENERIC_TEXT}\n\n{org_text}")


def _load_org_citations() -> dict:
    if not _ORG_DIR.exists():
        return {}
    citations = {}
    for meta_path in _ORG_DIR.glob("*.meta.json"):
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        citations[meta["rule_id"]] = meta
    return citations


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
        # Org-rule (invariants/org/*.cedar) fields -- see memory/compile.py's
        # module docstring for why these are a small closed set rather than
        # a dynamically named field per rule.
        "entity": "",
        "current_window": "",
        "human_approved": False,
        "precondition_met": False,
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
    if "service" in args:
        context["entity"] = args["service"]

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
    policy_set = _load_policy_set()
    result = cedarpy.is_authorized(request, policy_set, entities=[])
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
    org_citation = _load_org_citations().get(invariant)

    if org_citation is not None:
        why = org_citation["why"]
        citation = {
            "rule_id": org_citation["rule_id"],
            "source_ref": org_citation["source_ref"],
            "approved_by": org_citation["approved_by"],
        }
        hint = "this is a human-approved organisational rule; see the citation for the source and an alternative"
        reason_code = "org_rule"
    else:
        why = _WHY_BY_INVARIANT.get(invariant, "a generic invariant forbids this action")
        citation = None
        hint = _HINT_BY_INVARIANT.get(invariant, "")
        reason_code = "generic_invariant"

    return {
        "gate": "proof",
        "decision": "deny",
        "reason_code": reason_code,
        "invariant": invariant,
        "why": why,
        "values": context,
        "citation": citation,
        "hint": hint,
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
