# Person A — Brake and Platform

You own the path from an approved plan to a real AWS change and back, plus everything the
system runs on. If it is deployed, mutates AWS, or proves what happened, it is yours.

Mission: **an approved action can reach AWS only through your broker, bounded by
credentials that physically cannot exceed the declared blast radius, watched at every step,
and recorded so that tampering is detectable.**

## Owned paths

```
infra/iam_stack.py demo_stack.py observe_stack.py control_stack.py ui_stack.py
services/demo-app/**
control/orchestrator.py gate1.py gate3.py gate5.py broker.py ledger.py
brakebench/runner/**
ui/gates.js ui/ledger.js
docs/{orchestrator,gate1,gate3,gate5,broker,ledger,infra,demo-app}.md
```

Branch prefix `feat/a/*`. Never edit `control/gate2.py`, `gate4.py`, `registry.py`,
`sensors.py`, `memory/**`, `connectors/**`, `invariants/**`, `agents/**`, or
`brakebench/plans/**`. If you need a change there, open an issue titled `[needs: B]`.

## Task order

### I0 (H0–4)
1. Bedrock model access for Claude in `us-east-1` — do this first, it can take time.
2. `$50` budget alarm, CloudTrail check, `cdk bootstrap`, repo with branch protection and
   CI running lint plus schema tests.
3. Five IAM role skeletons so B can deploy; `/lockstep/*` parameter names.
4. Orchestrator skeleton: `POST /plans` with mock gates that always pass, plus the shared
   `GateResult` shape and an OpenAPI file.

*Acceptance:* B can call your endpoint by H4 and receive a valid GateResult.

### I1 (H4–14)
5. Demo app: two FastAPI services (web → payments) on Fargate in public subnets, ALB,
   DynamoDB, `/chaos` endpoint (latency, errors, pool leak), load generator, ADOT sidecar
   to X-Ray at 100% sampling, 1-second custom metrics.
6. Ledger: DynamoDB chain, canonical JSON, head item updated in the same
   `TransactWriteItems` as the record put, S3 bucket created with Object Lock and 1-day
   retention, `GET /ledger/verify`, tamper test.
7. Gate 1: registry lookup, JSON Schema validation rejecting unknown keys, capability
   tokens minted per incident and stage with 900 s life, revocation, expiry checked in code
   because DynamoDB TTL deletion lags.

*Acceptance:* chaos on payments makes p99 climb within a minute; two concurrent ledger
writers never fork the chain; editing record k makes verify fail at exactly k; BrakeBench
#18 and #19 are blocked.

### I2 (H14–24)
8. Gate 3 simulators: ECS describe-before / projected-after (ECS has no `DryRun`), EC2
   `DryRun=True` reading `DryRunOperation` as success, SSM parameter diff. Scope-lie subset
   check, reversibility classifier, rollback-plan validation against Gate 1's schema.
9. Broker: session policy generated per action from the declared radius, `AssumeRole` on
   `ExecRole` with `ExternalId` and a session name recording incident and action,
   idempotency key store, backoff for IAM propagation, credentials never logged.
10. SSM Automation rollback documents (`RollbackEcsRevision`, `RestoreServiceState`,
    `RestoreSgRule`, `RestoreParameter`); `ExecRole` trust policy with
    `StringLike sts:ExternalId inc_*`.
11. Detector Lambda: median/MAD z-score, burn rate on 5 m and 60 m windows, two-point
    debounce, one batched `GetMetricData` call.

*Acceptance:* with generated credentials, `UpdateService` on the target works while
`DeleteService`, `DeleteTable`, and `UpdateService` on any other service return
`AccessDenied`. Each SSM document reverts a manual change. BrakeBench #5 and #6 blocked.

### I3 (H24–32)
12. Gate 5: step runner calling B's sensors after every step, effect verification against
    the SLO metric, auto-rollback via SSM, token revoke, demotion event, page a human with
    the failing step index.
13. Rule approval API: `POST /rules/{id}/approve` · `/reject` · `/revoke`, signing, and the
    stale check comparing `source_hash` against the current source.
14. Wire G1–G5, broker and ledger end to end. Scenario S3 (rogue mid-run).

*Acceptance:* S3 halts at step 3 and rolls back, all recorded in the ledger.

### I4 (H32–39)
15. Tune Gate 3 and broker latency (warm Lambdas, parallel simulators).
16. Scenarios S1 (bad deploy) and S2 (poisoned log line); `make reset` that restores the
    known-good revision, clears incident and token tables, and re-seeds the ledger head.
17. UI: incident timeline, five gate lights, counterexample panel with citation, ledger list
    with a Verify button. Must render from `fixtures/` with the backend down.

*Acceptance:* S1 recovers within 180 s and is visible in the UI; reset takes under two
minutes and is idempotent.

### I5 (H39–44)
18. BrakeBench runner: 48 plans in full-pipeline and isolated-gate modes; catch rate,
    org-rule citation rate, false-block rate, p95 gate latency; `results.md` plus JSON for
    the UI.
19. Ten consecutive clean S1 runs; provisioned concurrency; cost check.

### I6 (H44–48)
20. Tag the release, record the backup video on the third clean run, architecture PNG, cost
    slide, teardown script. Drive the watchdog-halt and ledger-verify demo segments.

## Traps that will cost you hours

- **ECS has no `DryRun`.** Use the describe-before / projected-after adapter.
- **Session policies cap at 2,048 characters of plaintext.** Generate per action, not per
  plan; keep ARNs short and skip giant deny lists — the intersection already bounds you.
- **Do not blanket-deny `iam:*` in the session policy.** SSM Automation needs `PassRole` for
  its automation role; allow that one ARN.
- **Trust policy conditions are static**, so they cannot say "equals the current incident".
  Use `StringLike inc_*` and set the exact id in the broker.
- **DynamoDB TTL deletes late** — enforce token expiry in code.
- **S3 Object Lock cannot be enabled after bucket creation**, and compliance mode cannot be
  undone by anyone. Use governance mode or 1-day retention for the hackathon.
- **IAM propagation takes about 10 seconds.** Retry with backoff after deploys.
- **CloudWatch defaults to 5-minute metrics and X-Ray samples sparsely.** 1-second custom
  metrics, sampling rule at 100%.
- **Never a NAT gateway** — about $25 for the weekend. Public subnets plus security groups.

## Your standing duties

Keep `main` deployable, unblock B on AWS issues (quotas, IAM, propagation), and check the
budget every four hours. You are the one who can say "that costs money" before it does.
