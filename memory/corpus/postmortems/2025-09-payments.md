# Postmortem: payments-api double-charge during nightly batch

Author: sre-lead
Date: 2025-09-12T02:15:00Z

## Summary

At 02:03 during the nightly settlement batch (01:30-03:30 UTC), an on-call
engineer restarted the `payments-api` ECS service to clear a stuck
connection pool. The restart happened while the batch was mid-run.
In-flight settlement records were replayed on service startup, causing 214
customers to be charged twice.

## Timeline

- 01:58 -- connection pool exhaustion alarm fires on payments-api.
- 02:03 -- on-call restarts payments-api via `ecs update-service --force-new-deployment`.
- 02:04 -- service restarts mid-batch; in-flight settlement writes are replayed.
- 06:40 -- customer support reports duplicate charges; incident opened.

## Root cause

Restarting `payments-api` during its own settlement batch window is unsafe:
the batch has no idempotency key on replay, so any restart mid-run causes
in-flight records to be reprocessed.

## Corrective action

Never restart `payments-api` during the nightly batch window (01:30-03:30
UTC). If the service is degraded during that window, scale it up instead
(`ecs.scale`) rather than restarting it.
