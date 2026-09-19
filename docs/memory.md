# Memory plane

Owns ingest, entity anchoring, rule extraction/compilation, and the
connector interface (`memory/**`, `connectors/**`). Depends on
`schemas/source_chunk.schema.json`, `memory_item.schema.json`, and
`rule.schema.json`. Breaks if a candidate rule ever gets Cedar text or an
`approved_by` before a human signs it -- that would let ingested text grant
permission, which is the one thing the trust ladder exists to prevent.

## I0 status

- Spike 2 (Bedrock rule extraction) is implemented at
  `spikes/bedrock_rule_extraction_spike.py`, forcing a tool call against the
  closed-vocabulary schema rather than free-text JSON. **Unexecuted**: this
  environment has no AWS credentials, so the "5/5 valid JSON" acceptance
  test (`spikes/test_bedrock_extraction_spike.py`) is skipping honestly
  rather than reporting a result. Re-run it once Person A's AWS bootstrap
  (I0) grants Bedrock Claude access in `us-east-1`.
- Seeded corpus outline: `memory/CORPUS_OUTLINE.md`. Content itself
  (I2 task 11) is not written yet.

## I2 status (in progress)

- `memory/anchor.py`: regex-first entity *and tool* anchoring (`anchor_entities`,
  `anchor_tools`), ordered by first appearance in text. `KNOWN_SERVICES` is a
  hand-seeded placeholder list -- swap it for the real dictionary built from
  Person A's `/lockstep/*` CDK outputs once those exist. Tool anchoring only
  finds a tool the document names literally (e.g. `` `ecs.scale` ``); it
  cannot infer a tool from prose like "restarted the service". The "model
  only for ambiguity" fallback for either kind of anchoring is not
  implemented.
- `memory/store.py`: in-memory `MemoryItemStore` only. The real store is
  DynamoDB (`infra/brain_stack.py`, not started) -- this exists so
  `ingest.py` and its tests don't need an AWS account.
- `memory/ingest.py`: connector -> anchor -> injection scan -> store,
  producing schema-valid `MemoryItem`s at `trust_level` 0. Flagged content is
  still stored, never dropped, per the trust ladder.
- `memory/corpus/{postmortems,adrs}/*.md`: all 5 outlined markdown documents
  are now written for real (3 postmortems, 2 ADRs -- see
  `memory/CORPUS_OUTLINE.md`'s status section). The ~30 PRs and 1 Slack
  export are not written, since they need connectors that don't exist yet.
- `extract.py` (LLM slot-filling, I3) is not started -- blocked on Bedrock access, same as the I0 spike.

## I3 status (in progress)

- `memory/compile.py`: `compile_rule` turns a candidate's `template` + `slots`
  into Cedar text with `@id`/`@source`/`@approved_by`/`@approved_at`
  annotations, for all six closed-vocabulary templates. Rejects (raises
  `ValueError`) a template outside the vocabulary or slots that don't match
  it -- it never guesses. 16 round-trip tests prove each compiled rule denies
  exactly its slots and permits everything else.
- Cedar text always reads from a small, closed set of `context` fields
  (`entity`, `current_window`, `human_approved`, `precondition_met`,
  `human_override`, `env`, `new_count`, `cidr`) rather than a dynamically
  named field per rule, so every compiled rule stays well-defined under
  Cedar's missing-attribute-is-an-error semantics regardless of what a human
  writes into a slot.
- `write_signed_rule` refuses anything not already `status: signed`, and
  writes both the compiled `.cedar` file and a `.meta.json` citation sidecar
  (`source_ref`, `approved_by`, a human-readable `why`) to `invariants/org/`.
- `is_stale` flips a rule to advisory once its source document's hash no
  longer matches what was approved.
- Gate 2 now loads `invariants/org/*.cedar` and their `.meta.json` citation
  sidecars (task 14, see `docs/gate2.md`). The full I3 exit test passes as a
  real integration test (`control/test_gate2_org_rules.py`): the real seed
  postmortem's hash signs a hand-authored ORG-03 candidate (no live Bedrock
  extraction yet), Gate 2 denies a batch-window restart citing it, the same
  action outside the window passes, an unsigned candidate is refused at
  write time, and editing the source flips the rule stale.
- `control/test_gate2_org_rules_multi.py` extends this to ORG-04
  (`requires_human`), ORG-05 (`requires_precondition`), and ORG-06
  (`freeze`), all four org rules loaded into one `PolicySet` together
  alongside the twelve generic invariants, proving they don't cross-fire on
  unrelated actions. 4 of 6 templates are now proven end-to-end against a
  real Gate 2; `min_count` only exists as a round-trip test (generic
  invariant INV-02 already covers that shape) and `cidr_deny` has no real
  source document yet (needs the Slack export).
- Not done: the rule-review panel (task 15), and the hand-labelled
  15-candidate acceptance rate (needs real extraction, which needs Bedrock
  access this environment doesn't have).
