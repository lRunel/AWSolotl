# ADR-0012: Black Friday change freeze

Author: vp-eng
Date: 2025-08-01T09:00:00Z

## Status

Accepted

## Context

The two prior Black Friday weekends each had a customer-facing incident
traced back to a routine infrastructure change made during the peak traffic
window, once by a human and once by an automated remediation. Peak traffic
is exactly the wrong time to absorb an unreviewed change's blast radius.

## Decision

No changes to `prod` infrastructure between November 24 and November 27
(inclusive) without a VP-of-Engineering sign-off. This applies to any
actor, including an automated agent's remediation plan -- an incident during
the freeze still pages a human rather than auto-remediating.

## Consequences

Any remediation tooling must treat the freeze window as a hard gate: a
freeze-window action without a recorded human override must be blocked, not
merely logged.
