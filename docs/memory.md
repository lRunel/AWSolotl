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
- `memory/corpus/{postmortems,adrs}/*.md`: 2 of the 5 outlined documents
  written for real (`2025-09-payments.md`, `0007-payments-quorum.md`); the
  rest of the outline (2 more postmortems, 1 more ADR, ~30 PRs, 1 Slack
  export) is not written yet.
- `extract.py`, `compile.py` (I3) are not started.
