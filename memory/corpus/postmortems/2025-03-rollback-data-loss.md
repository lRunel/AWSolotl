# Postmortem: unrecoverable write loss from a snapshot-less rollback

Author: platform-lead
Date: 2025-03-05T22:10:00Z

## Summary

An on-call engineer rolled `orders-db` back to a prior schema revision to
resolve a migration error, without first taking a snapshot. The prior
revision's schema was incompatible with writes made after the migration
started, and roughly 12 minutes of order writes were unrecoverable once the
rollback completed.

## Timeline

- 21:52 -- a schema migration on `orders-db` starts failing partway through.
- 22:01 -- on-call decides to roll back to the pre-migration revision.
- 22:03 -- rollback executes; no snapshot was taken beforehand.
- 22:04 -- writes made between 21:52 and 22:03 are found to be incompatible
  with the restored schema and cannot be replayed.

## Root cause

`orders-db` rollbacks are destructive when the schema has changed underneath
in-flight writes. A snapshot taken immediately before the rollback would
have made this recoverable; without one, the writes were gone the moment the
rollback completed.

## Corrective action

Any rollback of `orders-db` must confirm a snapshot has been taken
(`snapshot_taken`) before it is allowed to run. This applies to
`ecs.rollback_to_revision` and any equivalent tool, including one proposed
by an agent.
