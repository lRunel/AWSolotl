// Rule-review panel (person-b-brief.md task 15). Fixtures-first per
// contracts.md's fixtures/ section: this reads fixtures/rules.json and
// renders it fully offline, since Person A's POST /rules/{id}/approve API
// doesn't exist yet. Approve/reject buttons update local state only and
// are wired to call `onApprove`/`onReject` hooks (no-ops until that API
// exists) rather than silently pretending to persist anything.
//
// Split into pure functions (testable with plain Node, see
// ui/test_rules.mjs) and a thin DOM-rendering layer at the bottom, which
// can only be reviewed by hand -- there is no browser in this environment.

export function statusBadge(rule) {
  if (rule.stale) return "STALE";
  if (rule.status === "signed") return "SIGNED";
  if (rule.status === "candidate") return "CANDIDATE";
  if (rule.status === "revoked") return "REVOKED";
  return rule.status.toUpperCase();
}

export function isActionable(rule) {
  // A human can approve/reject a candidate, or re-approve a stale rule.
  // A rule that is already cleanly signed needs no action.
  return rule.status === "candidate" || rule.stale === true;
}

export function sortRulesForReview(rules) {
  // Needs-a-human-now first (candidate, then stale), then everything else,
  // each group alphabetical by rule_id (nulls -- an unassigned candidate --
  // sort last within their group) so the most actionable rows are always
  // at the top regardless of fixture ordering.
  const rank = (rule) => {
    if (rule.status === "candidate") return 0;
    if (rule.stale) return 1;
    return 2;
  };
  return [...rules].sort((a, b) => {
    const rankDiff = rank(a) - rank(b);
    if (rankDiff !== 0) return rankDiff;
    const idA = a.rule_id || "￿";
    const idB = b.rule_id || "￿";
    return idA.localeCompare(idB);
  });
}

export function formatSlots(slots) {
  return Object.entries(slots)
    .map(([key, value]) => `${key}=${value}`)
    .join(", ");
}

async function loadRules(fixtureUrl) {
  const response = await fetch(fixtureUrl);
  const data = await response.json();
  return data.rules;
}

function renderRuleRow(rule, { onApprove, onReject }) {
  const row = document.createElement("tr");
  row.className = "rule-row rule-row--" + statusBadge(rule).toLowerCase();

  const cells = [
    rule.rule_id || "(unassigned)",
    rule.template,
    formatSlots(rule.slots),
    rule.why,
    statusBadge(rule),
    rule.source_ref,
  ];
  for (const text of cells) {
    const td = document.createElement("td");
    td.textContent = text;
    row.appendChild(td);
  }

  const sourceCell = document.createElement("td");
  sourceCell.className = "rule-source-snippet";
  sourceCell.textContent = rule.source_snippet;
  row.appendChild(sourceCell);

  const actionCell = document.createElement("td");
  if (isActionable(rule)) {
    const approveBtn = document.createElement("button");
    approveBtn.textContent = rule.stale ? "Re-approve" : "Approve";
    approveBtn.addEventListener("click", () => onApprove(rule));
    const rejectBtn = document.createElement("button");
    rejectBtn.textContent = "Reject";
    rejectBtn.addEventListener("click", () => onReject(rule));
    actionCell.append(approveBtn, rejectBtn);
  } else {
    actionCell.textContent = "—";
  }
  row.appendChild(actionCell);

  return row;
}

export async function renderRulePanel(container, {
  fixtureUrl = "fixtures/rules.json",
  onApprove = (rule) => console.log("approve (no backend yet):", rule.rule_id),
  onReject = (rule) => console.log("reject (no backend yet):", rule.rule_id),
} = {}) {
  const rules = sortRulesForReview(await loadRules(fixtureUrl));

  const table = document.createElement("table");
  table.className = "rules-table";
  const thead = document.createElement("thead");
  thead.innerHTML =
    "<tr><th>Rule</th><th>Template</th><th>Slots</th><th>Why</th><th>Status</th>" +
    "<th>Source</th><th>Snippet</th><th>Action</th></tr>";
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (const rule of rules) {
    tbody.appendChild(renderRuleRow(rule, { onApprove, onReject }));
  }
  table.appendChild(tbody);

  container.replaceChildren(table);
  return rules;
}
