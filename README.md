# Lockstep Recall

Memory-derived, cited, enforceable policy for AI agents acting on AWS.
Lockstep Recall sits between an AI agent and AWS: it proves an action is
safe before it runs, bounds the damage it can do, watches it while it
runs, and writes a signed record. Its org-specific policy comes from the
organisation's own history -- postmortems, ADRs, PR threads -- turned into
human-approved, citation-carrying Cedar invariants. See the
`lockstep-recall` skill (`SKILL.md` and `references/`) for the full design
and the two-person work split.

Built by two people in parallel on separate branches: Person A owns the
brake and platform (CDK, IAM, the demo app, the orchestrator, Gates 1/3/5,
the STS broker, the ledger); Person B owns memory and the rules of the game
(connectors, ingest, entity anchoring, the rule compiler, Gates 2/4,
causal-lite, the agent, BrakeBench plans).

## Setup

Two ways to run this. Both work with no AWS account.

**Offline test suite** -- proves every gate, connector, and rule invariant:

```bash
pip install cedarpy boto3 jsonschema fastapi uvicorn requests pytest
python -m pytest -q                        # 262 passed, 1 skipped
node --test ui/test_rules.mjs ui/test_ask.mjs   # 18 passed
```

**Live local demo** -- two real FastAPI microservices, a self-healing
watchdog that runs the real Gates 1-5 against them, a hash-chained ledger,
and the dashboard UI, all on your machine. See
[`docs/RUNNING_LOCALLY.md`](docs/RUNNING_LOCALLY.md) for the two-command
version and what to try once it's up. When real AWS credentials are
available, `infra/` (CDK) deploys the same demo app for real, and
`control/ledger.py` / `control/broker.py` take over from their local-only
siblings (`control/local_ledger.py`, `control/local_executor.py`).

## The twelve generic invariants (Gate 2)

Frozen at I1, defined in `invariants/generic/*.cedar`, implemented in
`control/gate2.py`. Every one has a passing and a failing test in
`control/test_gate2_invariants.py`.

| ID | Forbids |
|---|---|
| INV-01 | security group ingress from 0.0.0.0/0 on any port except 443 |
| INV-02 | scaling a prod service below its quorum |
| INV-03 | anything destructive while the causal verdict is abstained |
| INV-04 | any action during a declared change freeze without a human override |
| INV-05 | an agent deleting a data store |
| INV-06 | an IAM change granting access the old policy did not |
| INV-07 | an agent disabling or deleting an audit source |
| INV-08 | rotating or deleting a KMS key that is in use |
| INV-09 | rolling back to an image with a known critical CVE |
| INV-10 | a single action touching more than one availability zone at once |
| INV-11 | restarting a primary while a write lock is held |
| INV-12 | targeting outside the declared account or region |

## Signed org rules

Compiled from the seeded corpus (`memory/corpus/`, `memory/CORPUS_OUTLINE.md`)
via `memory/compile.py`, loaded by Gate 2 from `invariants/org/*.cedar` at
request time. Hand-authored rather than LLM-extracted -- `memory/extract.py`
needs Bedrock access this environment doesn't have -- but compiling,
signing, and enforcing them is otherwise the real I3 pipeline, not a stub.

| Rule | Template | Source | Approved by |
|---|---|---|---|
| ORG-03 | `forbid_tool_on_entity_during_window` | `postmortems/2025-09-payments.md` | sre-lead |
| ORG-04 | `requires_human` | `postmortems/2025-06-db-failover.md` | sre-lead |
| ORG-05 | `requires_precondition` | `postmortems/2025-03-rollback-data-loss.md` | platform-lead |
| ORG-06 | `freeze` | `adrs/0012-blackfriday-freeze.md` | vp-eng |
| ORG-07 | `cidr_deny` | `slack/incident-2025-09-payments.json` | sre-lead |

All six closed-vocabulary templates are represented (`min_count` has no
separate org rule -- INV-02 already covers that shape generically).

## BrakeBench (isolated-gate mode, Gate 2 only)

`brakebench/plans/catalog.py` + `stale_rules.py`, run directly against
`gate2_check` -- not a full G1-G5 pipeline, since Person A's
orchestrator/broker/ledger don't exist in this repo. Numbers match the
design doc's target exactly:

| Metric | Result |
|---|---|
| Unsafe plans blocked | 20 / 20 |
| Org-rule unsafe plans blocked, correct citation | 5 / 5 |
| Stale-rule plans correctly stop being enforced | 3 / 3 |
| False blocks on benign plans | 0 / 19 |
| Gate 2 p95 latency (warm, in-process) | comfortably under the 300ms budget |

This is "100% on the declared invariant set," not "100% formally
verified" -- Cedar's authorization engine is formally grounded; coverage is
the twenty-plus-five-plus-three cases actually declared above.

## Honest scope: what's blocked, not just unfinished

- **Real LLM extraction, the Bedrock agent, and Ask-why's natural-language
  composition** (`memory/extract.py`, `agents/plan_builder.py`'s scripted
  substitute, `memory/episodes.py`'s deterministic-only `ask_why`): this
  environment has no AWS credentials or Bedrock model access at all. Every
  spike and module that needs one is implemented and tested up to that
  boundary, with the model call itself either mocked, skipped with an
  honest reason, or replaced by the design doc's own sanctioned
  deterministic fallback.
- **Anything on Person A's side** (CDK stacks, the demo app, the
  orchestrator, Gates 1/3/5, the STS broker, the real ledger, the real
  entity dictionary built from CDK outputs): not started in this repo.
  Nothing here has run through a real end-to-end `POST /plans` call --
  only unit and isolated-gate integration tests.

<!-- OWNER: A -- deploy, cost, and demo-script sections land here once the
     above exists. -->
