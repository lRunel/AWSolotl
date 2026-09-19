import { test } from "node:test";
import assert from "node:assert/strict";
import { matchEpisodes, formatAnswer, askWhy } from "./ask.js";

const EPISODES = [
  {
    ledger_record_id: 1,
    entity_ids: ["ecs/payments-api"],
    tool: "ecs.rollback_to_revision",
    outcome: "good",
    rule_ids_applied: ["INV-02"],
  },
  {
    ledger_record_id: 2,
    entity_ids: ["ecs/cart-api"],
    tool: "ecs.restart_service",
    outcome: "bad",
    rule_ids_applied: [],
  },
];

test("matchEpisodes: matches by tool name", () => {
  const matches = matchEpisodes("why did ecs.rollback_to_revision run?", EPISODES);
  assert.deepEqual(matches.map((m) => m.ledger_record_id), [1]);
});

test("matchEpisodes: matches by entity name", () => {
  const matches = matchEpisodes("what happened to payments-api?", EPISODES);
  assert.deepEqual(matches.map((m) => m.ledger_record_id), [1]);
});

test("matchEpisodes: no match returns empty array", () => {
  const matches = matchEpisodes("what happened to inventory-api?", EPISODES);
  assert.deepEqual(matches, []);
});

test("formatAnswer: empty matches says unknown, cites nothing", () => {
  const result = formatAnswer([]);
  assert.equal(result.cited, false);
  assert.deepEqual(result.citedRecordIds, []);
  assert.match(result.answer, /could not find/);
});

test("formatAnswer: cites the real record id", () => {
  const result = formatAnswer([EPISODES[0]]);
  assert.equal(result.cited, true);
  assert.deepEqual(result.citedRecordIds, [1]);
  assert.match(result.answer, /Ledger record 1/);
});

test("formatAnswer: deduplicates and sorts cited record ids", () => {
  const result = formatAnswer([EPISODES[1], EPISODES[1], EPISODES[0]]);
  assert.deepEqual(result.citedRecordIds, [1, 2]);
});

test("askWhy: end-to-end citation guarantee never invents an id", () => {
  const result = askWhy("tell me about ecs.restart_service on cart-api", EPISODES);
  assert.equal(result.cited, true);
  for (const id of result.citedRecordIds) {
    assert.ok(EPISODES.some((e) => e.ledger_record_id === id), `id ${id} must be a real episode`);
  }
});

test("askWhy: unrelated question says unknown rather than guessing", () => {
  const result = askWhy("who owns the coffee machine", EPISODES);
  assert.equal(result.cited, false);
});
