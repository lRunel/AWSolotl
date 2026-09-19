# Postmortem: primary-db split-brain during automated failover

Author: sre-lead
Date: 2025-06-18T14:32:00Z

## Summary

An automated failover promoted a replica of `primary-db` to primary without
paging the on-call DBA. The old primary was not fenced off in time and kept
accepting writes for roughly 40 seconds after the new primary took over,
producing a split-brain window. Reconciling the divergent writes took the
data team most of the following day.

## Timeline

- 14:28 -- health check on `primary-db` fails three consecutive probes.
- 14:29 -- automation calls `rds.failover` and promotes the replica.
- 14:29:40 -- old primary is finally fenced off; by then it has accepted
  212 additional writes that the new primary never saw.
- 15:10 -- data team notices divergent order totals during a routine check.

## Root cause

The failover automation had no human-approval gate. A DBA reviewing the
health-check data before promoting would very likely have caught that the
"failure" was a transient network blip on the monitoring path, not the
database itself, and would have fenced the old primary before promoting.

## Corrective action

`rds.failover` on `primary-db` must always require human approval (the
on-call DBA) before it runs. No automation, including an agent, may promote
a replica on its own judgment.
