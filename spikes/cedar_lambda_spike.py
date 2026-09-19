"""I0 Spike 1 (references/person-b-brief.md): does Cedar run at all in the
Lambda runtime we're targeting? This proves out `cedarpy` -- if it did not
import or authorize correctly, the fallback per references/iterations.md
would be the Cedar CLI packaged as a Lambda layer instead.

This mirrors the ORG-03 example from the design doc: forbid restarting
payments-api during the nightly batch window, permit it otherwise. Run
directly with `python spikes/cedar_lambda_spike.py`, or via
`pytest spikes/test_cedar_spike.py`.
"""
from __future__ import annotations

import cedarpy

POLICY = """
permit (
    principal,
    action == Action::"ecs.restart_service",
    resource
);

@id("ORG-03")
forbid (
    principal,
    action == Action::"ecs.restart_service",
    resource
)
when {
    resource.service == "payments-api" &&
    context.in_batch_window == true
};
"""

ENTITIES = [
    {
        "uid": {"type": "Service", "id": "payments-api"},
        "attrs": {"service": "payments-api"},
        "parents": [],
    },
    {
        "uid": {"type": "Agent", "id": "remediate-1"},
        "attrs": {},
        "parents": [],
    },
]


def check(in_batch_window: bool) -> cedarpy.AuthzResult:
    request = {
        "principal": {"type": "Agent", "id": "remediate-1"},
        "action": {"type": "Action", "id": "ecs.restart_service"},
        "resource": {"type": "Service", "id": "payments-api"},
        "context": {"in_batch_window": in_batch_window},
    }
    return cedarpy.is_authorized(request, POLICY, ENTITIES)


def main() -> None:
    during_batch = check(in_batch_window=True)
    outside_batch = check(in_batch_window=False)
    print("during batch window:", during_batch.decision)
    print("outside batch window:", outside_batch.decision)


if __name__ == "__main__":
    main()
