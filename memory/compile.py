"""Rule compiler: slots -> Cedar text. The model that fills a candidate
rule's slots (memory/extract.py, not built yet) never writes Cedar itself --
this is the one place slots become policy text, and it is entirely
deterministic. A rule outside the six-template closed vocabulary, or with
the wrong slot keys for its template, is rejected here rather than guessed
at.

Context fields referenced below are a small, closed, always-defaulted set
(see control/gate2.py's _build_context): `entity`, `current_window`,
`human_approved`, `precondition_met`, `human_override`, `env`, `new_count`,
`cidr`. Using a fixed field name per concept (rather than, say, a
dynamically-named field per `check` slot) keeps every compiled rule
well-defined under Cedar's "missing attribute is an error" semantics,
regardless of what a human writes into a slot's free-text values.
"""
from __future__ import annotations

import json
from pathlib import Path

from connectors.base import content_hash


def _quote(value: object) -> str:
    return json.dumps(str(value))


def _forbid_tool_on_entity_during_window(slots: dict) -> str:
    return (
        f'forbid (principal, action == Action::{_quote(slots["tool"])}, resource)\n'
        f'when {{ context.entity == {_quote(slots["entity"])} '
        f'&& context.current_window == {_quote(slots["window"])} }};'
    )


def _min_count(slots: dict) -> str:
    floor = int(slots["floor"])
    return (
        f'forbid (principal, action == Action::"ecs.scale", resource)\n'
        f'when {{ context.entity == {_quote(slots["entity"])} '
        f"&& context.new_count < {floor} }};"
    )


def _requires_precondition(slots: dict) -> str:
    return (
        f'forbid (principal, action == Action::{_quote(slots["tool"])}, resource)\n'
        f'when {{ context.entity == {_quote(slots["entity"])} '
        f"&& context.precondition_met == false }};"
    )


def _requires_human(slots: dict) -> str:
    return (
        f'forbid (principal, action == Action::{_quote(slots["tool"])}, resource)\n'
        f'when {{ context.entity == {_quote(slots["entity"])} '
        f"&& context.human_approved == false }};"
    )


def _freeze(slots: dict) -> str:
    return (
        "forbid (principal, action, resource)\n"
        f'when {{ context.env == {_quote(slots["scope"])} '
        f'&& context.current_window == {_quote(slots["window"])} '
        f"&& context.human_override == false }};"
    )


def _cidr_deny(slots: dict) -> str:
    ports = slots["ports"]
    condition = f'context.cidr == {_quote(slots["cidr"])}'
    if ports != "any":
        condition += f" && context.port == {int(ports)}"
    return f'forbid (principal, action == Action::"sg.authorize_ingress", resource)\nwhen {{ {condition} }};'


_BUILDERS = {
    "forbid_tool_on_entity_during_window": _forbid_tool_on_entity_during_window,
    "min_count": _min_count,
    "requires_precondition": _requires_precondition,
    "requires_human": _requires_human,
    "freeze": _freeze,
    "cidr_deny": _cidr_deny,
}

_SLOT_KEYS = {
    "forbid_tool_on_entity_during_window": {"tool", "entity", "window"},
    "min_count": {"entity", "floor"},
    "requires_precondition": {"tool", "entity", "check"},
    "requires_human": {"tool", "entity"},
    "freeze": {"scope", "window"},
    "cidr_deny": {"cidr", "ports"},
}

_DESCRIBERS = {
    "forbid_tool_on_entity_during_window": lambda s: (
        f'{s["tool"]} on {s["entity"]} is forbidden during the {s["window"]} window'
    ),
    "min_count": lambda s: f'{s["entity"]} may not be scaled below {s["floor"]} tasks',
    "requires_precondition": lambda s: (
        f'{s["tool"]} on {s["entity"]} requires {s["check"]} first'
    ),
    "requires_human": lambda s: f'{s["tool"]} on {s["entity"]} requires human approval',
    "freeze": lambda s: f'no changes to {s["scope"]} during the {s["window"]} freeze without an override',
    "cidr_deny": lambda s: f'ingress from {s["cidr"]} is forbidden',
}


def describe_rule(template: str, slots: dict) -> str:
    """A short, human-readable sentence for a rule's `why` text -- used both
    in the citation payload gate2 returns and in meta.json (see
    write_signed_rule)."""
    return _DESCRIBERS[template](slots)


def compile_rule(rule: dict) -> str:
    """rule needs: rule_id, template, slots, source_ref, approved_by,
    approved_at. Raises ValueError -- never silently guesses -- for a
    template outside the closed vocabulary or slots that don't match it."""
    template = rule["template"]
    builder = _BUILDERS.get(template)
    if builder is None:
        raise ValueError(f"template {template!r} is outside the closed vocabulary")

    slots = rule["slots"]
    expected = _SLOT_KEYS[template]
    if set(slots.keys()) != expected:
        raise ValueError(f"{template} expects slots {sorted(expected)}, got {sorted(slots.keys())}")

    body = builder(slots)
    check_annotation = f' @check({_quote(slots["check"])})' if template == "requires_precondition" else ""
    annotations = (
        f'@id({_quote(rule["rule_id"])})'
        f' @source({_quote(rule["source_ref"])})'
        f"{check_annotation}"
        f' @approved_by({_quote(rule["approved_by"])})'
        f' @approved_at({_quote(rule["approved_at"])})'
    )
    return f"{annotations}\n{body}\n"


def write_signed_rule(rule: dict, org_dir: Path) -> Path:
    """Writes a signed rule's compiled Cedar text plus a citation sidecar
    (source_ref, approved_by, a human-readable description) that Gate 2
    reads to populate a deny's `citation` field. Refuses anything not
    already `status: signed` -- writing here is the one action that turns a
    candidate into something a gate will enforce, so it must never happen on
    the compiler's own initiative."""
    if rule.get("status") != "signed":
        raise ValueError("only a signed rule may be written to invariants/org/ -- got status=" + str(rule.get("status")))

    org_dir.mkdir(parents=True, exist_ok=True)
    cedar_text = compile_rule(rule)
    cedar_path = org_dir / f"{rule['rule_id']}.cedar"
    cedar_path.write_text(cedar_text, encoding="utf-8")

    meta = {
        "rule_id": rule["rule_id"],
        "source_ref": rule["source_ref"],
        "approved_by": rule["approved_by"],
        "why": describe_rule(rule["template"], rule["slots"]),
    }
    meta_path = org_dir / f"{rule['rule_id']}.meta.json"
    meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")
    return cedar_path


def is_stale(rule: dict, current_source_content: str) -> bool:
    """True once the source document has changed since this rule was
    approved -- a stale rule must drop to advisory until re-approved
    (contracts.md's trust ladder). Compares against the rule's own recorded
    `source_hash`, never the current live rule store's hash, so this stays a
    pure function callers can run against any candidate content."""
    return rule["source_hash"] != content_hash(current_source_content)
