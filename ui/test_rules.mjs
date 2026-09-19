import { test } from "node:test";
import assert from "node:assert/strict";
import { statusBadge, isActionable, sortRulesForReview, formatSlots } from "./rules.js";

test("statusBadge: signed rule", () => {
  assert.equal(statusBadge({ status: "signed", stale: false }), "SIGNED");
});

test("statusBadge: stale overrides signed", () => {
  assert.equal(statusBadge({ status: "signed", stale: true }), "STALE");
});

test("statusBadge: candidate", () => {
  assert.equal(statusBadge({ status: "candidate", stale: false }), "CANDIDATE");
});

test("isActionable: candidate is actionable", () => {
  assert.equal(isActionable({ status: "candidate", stale: false }), true);
});

test("isActionable: stale signed rule is actionable", () => {
  assert.equal(isActionable({ status: "signed", stale: true }), true);
});

test("isActionable: clean signed rule is not actionable", () => {
  assert.equal(isActionable({ status: "signed", stale: false }), false);
});

test("sortRulesForReview: candidates first, then stale, then signed", () => {
  const rules = [
    { rule_id: "ORG-03", status: "signed", stale: false },
    { rule_id: "ORG-08", status: "stale", stale: true },
    { rule_id: null, status: "candidate", stale: false },
  ];
  const sorted = sortRulesForReview(rules);
  assert.deepEqual(
    sorted.map((r) => r.rule_id),
    [null, "ORG-08", "ORG-03"]
  );
});

test("sortRulesForReview: alphabetical within the same group", () => {
  const rules = [
    { rule_id: "ORG-07", status: "signed", stale: false },
    { rule_id: "ORG-03", status: "signed", stale: false },
  ];
  const sorted = sortRulesForReview(rules);
  assert.deepEqual(
    sorted.map((r) => r.rule_id),
    ["ORG-03", "ORG-07"]
  );
});

test("sortRulesForReview does not mutate the input array", () => {
  const rules = [
    { rule_id: "ORG-07", status: "signed", stale: false },
    { rule_id: "ORG-03", status: "signed", stale: false },
  ];
  const original = [...rules];
  sortRulesForReview(rules);
  assert.deepEqual(rules, original);
});

test("formatSlots joins key=value pairs", () => {
  assert.equal(
    formatSlots({ tool: "ecs.restart_service", entity: "payments-api", window: "batch" }),
    "tool=ecs.restart_service, entity=payments-api, window=batch"
  );
});
