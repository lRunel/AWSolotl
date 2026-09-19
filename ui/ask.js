// Ask-why panel (person-b-brief.md task 19). Mirrors memory/episodes.py's
// ask_why() logic client-side against fixtures/episodes.json, since there
// is no POST /ask backend yet and the UI must render from fixtures with
// the backend down (contracts.md's fixtures/ section). This is
// deterministic keyword retrieval, not an LLM-composed answer -- same
// honest limit as the Python version: composing natural language from the
// matched episodes needs Bedrock, which this project doesn't have access
// to. What both implementations guarantee is the citation contract: every
// answer either cites a real record id or says it doesn't know.
//
// Split into pure functions (ui/test_ask.mjs) and a thin DOM layer.

export function matchEpisodes(question, episodes) {
  const q = question.toLowerCase();
  return episodes.filter((episode) => {
    const toolHit = Boolean(episode.tool) && q.includes(episode.tool.toLowerCase());
    const entityHit = episode.entity_ids.some((entityId) =>
      q.includes(entityId.split("/").pop().toLowerCase())
    );
    return toolHit || entityHit;
  });
}

export function formatAnswer(matches) {
  if (matches.length === 0) {
    return {
      answer: "I could not find enough information in the indexed sources.",
      citedRecordIds: [],
      cited: false,
    };
  }
  const citedRecordIds = [...new Set(matches.map((m) => m.ledger_record_id))].sort((a, b) => a - b);
  const sentences = matches.map((m) => {
    const entities = m.entity_ids.length ? m.entity_ids.join(", ") : "an unknown entity";
    const rules = m.rule_ids_applied.length ? m.rule_ids_applied.join(", ") : "none";
    return `Ledger record ${m.ledger_record_id}: ${m.tool} on ${entities} -- outcome ${m.outcome}, rules applied: ${rules}.`;
  });
  return { answer: sentences.join(" "), citedRecordIds, cited: true };
}

export function askWhy(question, episodes) {
  return formatAnswer(matchEpisodes(question, episodes));
}

async function loadEpisodes(fixtureUrl) {
  const response = await fetch(fixtureUrl);
  const data = await response.json();
  return data.episodes;
}

export async function renderAskPanel(container, { fixtureUrl = "fixtures/episodes.json" } = {}) {
  const episodes = await loadEpisodes(fixtureUrl);

  const form = document.createElement("form");
  form.className = "ask-form";
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Why did the agent roll back payments-api?";
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.textContent = "Ask";
  form.append(input, submit);

  const answerBox = document.createElement("div");
  answerBox.className = "ask-answer";

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const result = askWhy(input.value, episodes);
    answerBox.textContent = result.answer;
    answerBox.className = "ask-answer " + (result.cited ? "ask-answer--cited" : "ask-answer--unknown");
    answerBox.dataset.citedRecordIds = JSON.stringify(result.citedRecordIds);
  });

  container.replaceChildren(form, answerBox);
}
