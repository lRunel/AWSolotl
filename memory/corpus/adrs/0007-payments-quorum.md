# ADR-0007: payments-api minimum task count

Author: platform-lead
Date: 2025-04-02T09:00:00Z

## Status

Accepted

## Context

`payments-api` checkout latency breaches SLO whenever fewer than 3 tasks are
running concurrently, even briefly during a scale-down. This has caused two
prior latency-budget incidents during routine autoscaling events.

## Decision

`payments-api` must never run below 3 concurrent tasks in production, even
during a deliberate scale-down. Any scale request that would drop the
service below that floor must be rejected.

## Consequences

Autoscaling policies and any remediation tooling (including an automated
agent) must treat 3 as a hard floor for `payments-api`, not a target.
