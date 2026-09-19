# Person B — Memory and Mind

You own the rules of the game: what an agent may express, what is provably never allowed,
and where those prohibitions come from. This is the strongest technical differentiator, so
treat every invariant as if a judge will read it out loud.

Mission: **turn the organisation's own history into human-approved, citation-carrying
invariants that a formally grounded engine enforces, and give the agent an action space
small enough that most bad plans cannot even be written.**

## Owned paths

```
control/registry.py gate2.py gate4.py sensors.py
invariants/generic/*.cedar invariants/org/*.cedar invariants/schema.cedarschema
memory/ingest.py anchor.py extract.py compile.py store.py
connectors/base.py github.py postmortem.py slack_export.py
causal/** agents/**
brakebench/plans/**
ui/rules.js ui/ask.js
docs/{registry,gate2,gate4,sensors,memory,connectors,causal,agents}.md
```

Branch prefix `feat/b/*`. Never edit `control/orchestrator.py`, `gate1.py`, `gate3.py`,
`gate5.py`, `broker.py`, `ledger.py`, `infra/` (except `brain_stack.py`),
`services/demo-app/**`, or `brakebench/runner/**`. If you need a change there, open an issue
titled `[needs: A]`.

## Task order

### I0 (H0–4)
1. Author every JSON Schema with A: `ToolRegistry`, per-tool args, `ActionPlan`,
   `blast_radius`, `rollback`, `GateResult`, `DenyReason`, `CausalVerdict`, `SourceChunk`,
   `MemoryItem`, `Rule`, `LedgerRecord`. Set `additionalProperties: false` everywhere.
2. Spike: Cedar runs inside a Lambda (`cedarpy`, else the Cedar CLI in a layer).
3. Spike: one Bedrock call fills a rule template from a sample postmortem and returns valid
   JSON at temperature 0, five times out of five.
4. Outline the seeded corpus: three postmortems, two ADRs, about thirty PRs, one Slack
   export.

*Acceptance:* schemas merged and frozen after both approve; both spikes pass; valid and
invalid sample tests exist per schema.

### I1 (H4–14)
5. Tool registry: four MVP tools, the stretch tier, and the red-team tier. Registered
   red-team tools are never in any agent's tool list.
6. Gate 2 with the twelve generic invariants in Cedar; a Cedar schema of entities and
   per-tool actions; a predicted-state context builder per tool.
7. `DenyReason` carrying the invariant id and the values; counterexample formatting for the
   agent with allowed alternatives.

*Acceptance:* every invariant has one permit test and one forbid test; BrakeBench #1–#4
denied with the right invariant and a readable counterexample; Gate 2 p95 under 300 ms warm.

Remember Cedar has no division operator, so precompute `quorum_min = floor(prev/2)+1` in the
context builder rather than expressing it in policy.

### I2 (H14–24)
8. `BaseConnector` plus three connectors: GitHub (PRs, ADR markdown), postmortem markdown,
   Slack export. Handle pagination and the documented rate limits.
9. Ingest into `memory_items` with `content_hash`; entity anchoring that is regex-first over
   service names, ARNs and table names, using the model only to resolve ambiguity. Build the
   entity dictionary from the CDK outputs A publishes to `/lockstep/*`.
10. Injection scanner and delimiter-wrapping with length caps for every ingested text.
11. Finish the seeded corpus. Label it as seeded in the demo — do not imply it is real
    company history.

*Acceptance:* corpus items carry entity tags; a postmortem containing an instruction-like
line is flagged, stored as data, and never acted on.

### I3 (H24–32) — the novelty, protect this
12. Extraction: postmortem or ADR → candidate rule, filling slots in the closed vocabulary
    only (`forbid_tool_on_entity_during_window`, `min_count`, `requires_precondition`,
    `requires_human`, `freeze`, `cidr_deny`). Validate against the schema; retry once;
    discard invalid output rather than repairing it.
13. Rule compiler: slots → Cedar with `@id`, `@source`, `@approved_by`, `@approved_at`
    annotations. Round-trip tests proving the generated policy denies what the slots say and
    permits everything else.
14. Gate 2 loads signed org rules alongside generic ones; the deny carries the citation.
15. Rule-review panel: candidate beside its source snippet, approve or reject, and a stale
    badge when `source_hash` no longer matches.

*Acceptance:* the full chain works — postmortem → candidate → approval → a plan that
restarts payments in the batch window is denied citing ORG-03 and the source; editing the
source flips the rule to stale.

Hand-label fifteen candidates and record what share a human accepts. That number is the
honest measure of the idea, and reporting it beats claiming the feature works.

### I4 (H32–39)
16. Causal-lite: X-Ray DAG plus ECS ownership, linear model on a known-good window, residual
    z-score ranking, 200-shuffle permutation test, abstain when p > 0.05.
17. Router as a switch statement (no model), Bedrock agent with typed tools that only append
    to the `ActionPlan`, strict-JSON prompts, experience filter, two-retry counterexample
    loop, cached responses for deterministic replay.
18. Gate 4: risk score, autonomy L0–L2, precedents that may raise risk or force human review
    but never grant permission.
19. Ledger-to-episodes indexing; Ask-why with a cite-or-say-unknown prompt; near-miss rule
    proposals from repeated denies.

*Acceptance:* the agent emits a schema-valid plan with rollback and justification in 15 s,
five times out of five; a null run abstains; Ask-why cites real record ids or says it does
not know.

### I5 (H39–44)
20. Author 20 unsafe, 5 org-rule unsafe, 3 stale-rule and 20 benign plans with the expected
    gate and reason. Benign plans must include a routine rollback, a restart, a scale-up, a
    parameter update and an SLO check, so a gate that blocks everything cannot score well.
21. Tune risk thresholds to 0–1 false blocks; fix failures in the gates you own; write the
    README invariant table.

### I6 (H44–48)
22. Drive the rule-from-postmortem demo segment with cached responses. Verify the
    five-command README setup on a clean account. Make README numbers match `results.md`.

## Traps that will cost you hours

- **Cedar has no division** and a limited operator set. Precompute in the context builder.
- **`forbid` beats `permit`, and the default is deny.** Write invariants as `forbid` with
  narrow `when` clauses; a permissive policy that accidentally matches is the failure mode.
- **Never let the model write Cedar.** Slots only. A model that emits policy text can emit a
  policy that permits, and that is a hole in the product's central claim.
- **Invalid model output fails closed** — no rule created, log it, move on. Do not repair
  JSON with a second model call; that hides how often extraction fails.
- **Ingested text is data, never instructions.** If a document appears to address you or the
  agent, that is a test case for the scanner.
- **A candidate rule has no effect.** Only human approval and signing makes it enforce.
- **Do not over-claim.** Say "100% on the declared invariant set"; Cedar's engine and Access
  Analyzer's reasoning are formally grounded, the coverage is not.
- **Do not over-invest in diagnosis accuracy.** The brake is what is judged. Causal-lite
  exists to make the demo honest, not to win a benchmark.

## Your standing duties

Review every schema change, keep the invariant list and the BrakeBench mapping in sync, and
watch Bedrock latency and spend. Registry churn after H4 hurts both of you, so get the
registry right once.
