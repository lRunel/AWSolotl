# Iterations, exit tests and cut order

Seven iterations over about 48 hours. Each ends in a vertical slice the *other* person
runs. Work is ordered by risk: the things most likely to invalidate the plan get spiked
first.

| It | Hours | Theme | Integration point |
|---|---|---|---|
| I0 | 0–4 | Contracts and skeleton | Schemas and stubs merged to `main` |
| I1 | 4–14 | Walking brake | Fixed plan through G1+G2; ledger verifies |
| I2 | 14–24 | Real execution and memory ingest | Broker runs and rolls back; corpus anchored |
| I3 | 24–32 | Memory becomes policy | Postmortem → rule → cited deny |
| I4 | 32–39 | Real agent and the loop closes | S1 end to end; Ask-why cites the ledger |
| I5 | 39–44 | BrakeBench and hardening | Four numbers in `results.md` |
| I6 | 44–48 | Freeze and rehearse | Tagged release, backup video |

---

## I0 · Contracts and skeleton (H0–4)

**A:** AWS bootstrap (Bedrock access, `$50` budget alarm, CloudTrail, `cdk bootstrap`);
repo, branch protection, CI (lint, schema tests); five IAM role skeletons; `/lockstep/*`
parameter names; orchestrator skeleton with `POST /plans` running mock gates; OpenAPI file.

**B:** All JSON Schemas with A; Cedar-in-Lambda spike; Bedrock structured-output spike (one
call that fills a rule template from a sample postmortem); seeded corpus outline.

**Exit test:** schemas merged and both approve; both spikes work; the mock endpoint returns
a valid GateResult; both can deploy their own stack prefix.

**Cut:** nothing. This is the foundation, and skipping it costs more than it saves.

---

## I1 · Walking brake (H4–14)

**A:** demo app (2 FastAPI services on Fargate, ALB, DynamoDB, `/chaos`, load generator);
ledger (chain, head-pointer transaction, Object Lock with 1-day retention,
`GET /ledger/verify`, tamper test); Gate 1 (registry lookup, schema validation, capability
tokens with expiry checked in code).

**B:** tool registry (4 MVP + red-team tier); Gate 2 with the 12 generic invariants in
Cedar; counterexample format; one permit test and one forbid test per invariant;
`quorum_min` precomputed in the context builder because Cedar has no division operator.

**Exit test:** BrakeBench #1–#4, #18, #19 blocked at the right gate with a readable
counterexample; editing a ledger record makes verify fail at exactly that index.

**Cut:** Access Analyzer (#4 becomes a Cedar rule on the IAM action instead).

---

## I2 · Real execution and memory ingest (H14–24)

**A:** Gate 3 (ECS describe-before / projected-after adapter, EC2 `DryRun`, scope-lie subset
check, reversibility classifier); broker (session policy per action, `AssumeRole` with
`ExternalId` and session name, idempotency store, credentials never logged); SSM rollback
documents; `ExecRole` trust policy using `StringLike inc_*`; detector Lambda.

**B:** `BaseConnector` plus three connectors (GitHub PRs and ADRs, postmortem markdown,
Slack export); ingest to `memory_items`; entity anchoring (regex first over service names
and ARNs, model only for ambiguity); seeded corpus finished; injection scanner and wrapping
for all ingested text.

**Exit test:** a mocked rollback plan runs with scoped credentials; `DeleteService` and
`DeleteTable` return `AccessDenied` with those same credentials; rollback executes; a
ledger record is written; corpus items show entity tags.

**Cut:** the Slack export connector (keep GitHub and postmortems).

---

## I3 · Memory becomes policy (H24–32)

This is the novelty. If anything slips, protect this iteration.

**A:** Gate 5 (step runner, sensors, auto-rollback, token revoke); rule approval API
(approve, reject, revoke, sign, stale-on-source-change); wire G1–G5 and the ledger end to
end; scenario S3 (rogue mid-run).

**B:** decision and rule extraction into candidate rules using the closed vocabulary only;
rule compiler turning slots into Cedar with `@id`, `@source`, `@approved_by` annotations,
with round-trip tests; Gate 2 loads signed org rules; cited counterexample text;
rule-review panel showing the source snippet beside the proposed rule.

**Exit test:** postmortem → candidate → human approves → the agent proposes restarting
payments in the batch window → Gate 2 denies citing ORG-03 and the postmortem. Editing the
source flips the rule to stale.

**Cut:** near-miss rule proposals (defer to I4); keep only postmortem-derived rules.

---

## I4 · Real agent and the loop closes (H32–39)

**A:** Gate 3 and broker performance tuning (warm Lambdas); scenarios S1 (bad deploy) and
S2 (poisoned log line); `make reset`; gate-panel and ledger UI in live and fixture modes.

**B:** causal-lite (X-Ray DAG, residual score, permutation falsification, abstain); router
plus Bedrock agent with typed tools; experience filter; two-retry counterexample loop;
cached responses; Gate 4 risk with precedents (raise only, never grant); ledger-to-episodes
indexing; Ask-why with a cite-or-say-unknown prompt; near-miss rule proposals.

**Exit test:** S1 recovers within 180 s and is visible in the UI; S2 gives the same gate
outcome in 5 of 5 runs; a null run abstains; Ask-why answers cite real ledger record ids or
say it does not know.

**Cut:** near-miss proposals, then falsification (a fixed-threshold abstain is enough).

**Feature freeze after this iteration.** Bug fixes only.

---

## I5 · BrakeBench and hardening (H39–44)

**A:** runner in full-pipeline and isolated-gate modes; `results.md` and a JSON for the UI;
idempotent reset; ten consecutive clean S1 runs; provisioned concurrency; cost check.

**B:** author 20 unsafe, 5 org-rule unsafe, 3 stale-rule, and 20 benign plans with the
expected gate and reason; tune risk thresholds to 0–1 false blocks; fix failures in the
gates B owns; README invariant table.

**Exit test:** 20/20 unsafe blocked; 5/5 org-rule plans blocked with a correct citation;
0–1 of 20 benign blocked; p95 gate latency under 2 s.

**Cut:** stale-rule tests.

---

## I6 · Freeze and rehearse (H44–48)

**A:** tag the release; record the backup video on the third clean run; architecture PNG;
cost slide; teardown script; drive the watchdog-halt and ledger-verify segments.

**B:** drive the rule-from-postmortem segment with cached agent responses; verify the
five-command README setup on a clean account; make the README numbers match `results.md`.

**Exit test:** five timed rehearsals done; backup video exists; only README and slides
change after this.

**Cut:** nothing. Protect this window — an unrehearsed demo wastes everything before it.

---

## Cut order

When a task passes 50% over its estimate, take the next cut immediately. The owner decides
in consultation with the other person; do not debate for more than five minutes.

| Order | Cut | Replace with |
|---|---|---|
| 1 | Embeddings and vector search | Entity-key lookup, plus a dictionary for Ask-why |
| 2 | Slack export connector | GitHub and postmortem markdown only |
| 3 | Near-miss rule proposals | Manual rule authoring in the review panel |
| 4 | Falsification permutation test | Fixed-threshold abstain |
| 5 | Access Analyzer | A Cedar rule on IAM actions |
| 6 | Live agent variability | Cached responses and the scripted rogue-agent client |
| — | **Never cut** | Gate 2, Gate 3, the STS broker, Gate 5 rollback, the ledger |

## Ceremonies

- **Standup** every 4 hours, 10 minutes: what is blocked, what changes next.
- **Iteration demo:** the person who did not build the slice runs it. If they cannot, it is
  not done.
- **Retro:** 5 minutes after each demo; re-order the backlog by risk.
- **Sleep:** stagger two sleeps of 4–5 hours between H14 and H36 so one person is always
  awake. Schedule the I2 and I3 exit tests when both are awake, because those are the
  integrations most likely to need a conversation.

## Success metrics

| Metric | Target |
|---|---|
| Catch rate, 20 unsafe plans | 20/20 blocked |
| Org-rule catch with correct citation | 5/5 |
| False-block rate, 20 benign plans | 0–1 |
| Gate latency G1–G4 | p95 under 2 s warm |
| Candidate rules a human accepts | measure and report, no target |
| Ask-why citation validity | 100% cite a real record or say unknown |
| Fault to recovery | within 180 s |
| Cost | under $40, single `cdk deploy` |

Report these honestly. Four measured numbers are worth more than any adjective, and a
judge who catches one inflated claim discounts all the others.
