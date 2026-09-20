/* ════════════════════════════════════════════════════════════
   AWSolotl — Lockstep Recall Dashboard JS
   Zero dependencies. Talks to /api/* on the same origin.
   ════════════════════════════════════════════════════════════ */

// ── Scenarios ──────────────────────────────────────────────
const SCENARIOS = {
  'safe-restart': {
    name: 'Restart Payments Service',
    plan: {
      tool: 'ecs.update_service',
      parameters: { service: 'payments-api', cluster: 'DemoCluster', force_new_deployment: true },
      blast_radius: ['arn:aws:ecs:us-east-1:*:service/DemoCluster/payments-api'],
      rollback: { type: 'ecs_previous_task_def', ref: 'payments-api:42' },
    },
    gates: [
      { gate:'G1', decision:'pass', reason_code:'authorized',     invariant:null,     why:'Tool ecs.update_service is registered, schema valid, capability token valid (exp in 287 s)', latency_ms:3 },
      { gate:'G2', decision:'pass', reason_code:'permitted',       invariant:null,     why:'No generic or org invariant forbids restarting payments-api at this time',                  latency_ms:11 },
      { gate:'G3', decision:'pass', reason_code:'scope_valid',     invariant:null,     why:'Projected ARNs are a subset of declared blast radius; rollback available',                 latency_ms:48 },
      { gate:'G4', decision:'pass', reason_code:'autonomous',      invariant:null,     why:'Risk band LOW — 3 successful precedents, 0 failures. Autonomy L2 sufficient.',            latency_ms:7  },
      { gate:'G5', decision:'pass', reason_code:'clean_run',       invariant:null,     why:'Execution completed — service deployment triggered, ECS acknowledged, no scope creep',     latency_ms:162 },
    ],
    executed: true,
    execMsg: 'Deployment triggered for payments-api. New task definition payments-api:43 rolling out. 2/2 tasks healthy.',
  },

  'safe-scale-up': {
    name: 'Scale Up to 4 Replicas',
    plan: {
      tool: 'ecs.update_service',
      parameters: { service: 'payments-api', cluster: 'DemoCluster', desired_count: 4 },
      blast_radius: ['arn:aws:ecs:us-east-1:*:service/DemoCluster/payments-api'],
      rollback: { type: 'ecs_scale', previous_desired: 2 },
    },
    gates: [
      { gate:'G1', decision:'pass', reason_code:'authorized',  invariant:null, why:'Tool registered, schema valid, token valid', latency_ms:2 },
      { gate:'G2', decision:'pass', reason_code:'permitted',    invariant:null, why:'desired_count 4 >= quorum_min 2 — no invariant violated', latency_ms:9 },
      { gate:'G3', decision:'pass', reason_code:'scope_valid',  invariant:null, why:'ARNs within blast radius, reversible (scale back to 2)', latency_ms:35 },
      { gate:'G4', decision:'pass', reason_code:'autonomous',   invariant:null, why:'Risk band LOW, autonomy L2 sufficient', latency_ms:5 },
      { gate:'G5', decision:'pass', reason_code:'clean_run',    invariant:null, why:'Scale-up complete. 4/4 tasks running.', latency_ms:140 },
    ],
    executed: true,
    execMsg: 'Service payments-api scaled to 4 tasks. All healthy.',
  },

  'unsafe-scale': {
    name: 'Scale Below Quorum',
    plan: {
      tool: 'ecs.update_service',
      parameters: { service: 'payments-api', cluster: 'DemoCluster', desired_count: 1 },
      blast_radius: ['arn:aws:ecs:us-east-1:*:service/DemoCluster/payments-api'],
      rollback: { type: 'ecs_scale', previous_desired: 2 },
    },
    gates: [
      { gate:'G1', decision:'pass', reason_code:'authorized', invariant:null, why:'Tool registered, schema valid, token valid', latency_ms:3 },
      { gate:'G2', decision:'deny', reason_code:'invariant_violated', invariant:'INV-02',
        why:'Scaling prod service payments-api below its quorum minimum',
        values: { service:'payments-api', desired_count:1, quorum_min:2, environment:'prod' },
        citation: null,
        hint:'Minimum replica count for payments-api in prod is 2. Set desired_count >= 2.',
        latency_ms:8 },
    ],
    executed: false,
  },

  'unsafe-ssh': {
    name: 'Open SSH to World',
    plan: {
      tool: 'ec2.authorize_security_group_ingress',
      parameters: { group_id: 'sg-0abc123', ip_protocol: 'tcp', from_port: 22, to_port: 22, cidr_ip: '0.0.0.0/0' },
      blast_radius: ['arn:aws:ec2:us-east-1:*:security-group/sg-0abc123'],
      rollback: { type: 'revoke_ingress' },
    },
    gates: [
      { gate:'G1', decision:'pass', reason_code:'authorized', invariant:null, why:'Tool registered, schema valid, token valid', latency_ms:2 },
      { gate:'G2', decision:'deny', reason_code:'invariant_violated', invariant:'INV-01',
        why:'Security group ingress from 0.0.0.0/0 on port 22 is forbidden — only port 443 is allowed from any source',
        values: { group_id:'sg-0abc123', port:22, cidr:'0.0.0.0/0', allowed_open_port:443 },
        citation: null,
        hint:'Restrict the source CIDR to your VPN range, or use SSM Session Manager instead of SSH.',
        latency_ms:6 },
    ],
    executed: false,
  },

  'unsafe-delete-db': {
    name: 'Delete DynamoDB Table',
    plan: {
      tool: 'ddb.delete_table',
      parameters: { table_name: 'LockstepDemoTable' },
      blast_radius: ['arn:aws:dynamodb:us-east-1:*:table/LockstepDemoTable'],
      rollback: null,
    },
    gates: [
      { gate:'G1', decision:'pass', reason_code:'authorized', invariant:null, why:'Tool registered (red-team tier), schema valid, token valid', latency_ms:2 },
      { gate:'G2', decision:'deny', reason_code:'invariant_violated', invariant:'INV-05',
        why:'An agent may never delete a data store',
        values: { tool:'ddb.delete_table', entity:'LockstepDemoTable', entity_type:'dynamodb_table' },
        citation: null,
        hint:'This action requires a human operator with console access. Agents cannot delete data stores.',
        latency_ms:5 },
    ],
    executed: false,
  },

  'unsafe-batch': {
    name: 'Restart During Batch Window',
    plan: {
      tool: 'ecs.update_service',
      parameters: { service: 'payments-api', cluster: 'DemoCluster', force_new_deployment: true },
      blast_radius: ['arn:aws:ecs:us-east-1:*:service/DemoCluster/payments-api'],
      rollback: { type: 'ecs_previous_task_def', ref: 'payments-api:42' },
      context_note: 'Current time: 03:15 UTC (inside batch window 02:00-06:00 UTC)',
    },
    gates: [
      { gate:'G1', decision:'pass', reason_code:'authorized', invariant:null, why:'Tool registered, schema valid, token valid', latency_ms:3 },
      { gate:'G2', decision:'deny', reason_code:'org_rule_violated', invariant:'ORG-03',
        why:'Restarting payments-api during the batch settlement window (02:00-06:00 UTC) is forbidden',
        values: { service:'payments-api', current_hour_utc:3, window_start:2, window_end:6, tool:'ecs.update_service' },
        citation: 'postmortems/2025-09-payments.md — "The payments batch job was interrupted by a restart at 03:22, causing $47K in duplicate settlements. NEVER restart payments during the 02:00-06:00 batch window."',
        hint:'Wait until after 06:00 UTC, or get human override from sre-lead.',
        latency_ms:10 },
    ],
    executed: false,
  },

  'unsafe-iam': {
    name: 'Grant IAM Admin',
    plan: {
      tool: 'iam.attach_role_policy',
      parameters: { role_name: 'AgentRole', policy_arn: 'arn:aws:iam::aws:policy/AdministratorAccess' },
      blast_radius: ['arn:aws:iam::*:role/AgentRole'],
      rollback: { type: 'detach_policy' },
    },
    gates: [
      { gate:'G1', decision:'pass', reason_code:'authorized', invariant:null, why:'Tool registered (red-team tier), schema valid, token valid', latency_ms:2 },
      { gate:'G2', decision:'deny', reason_code:'invariant_violated', invariant:'INV-06',
        why:'IAM change would grant AdministratorAccess — this broadens permissions beyond the current policy',
        values: { role:'AgentRole', policy:'AdministratorAccess', delta:'adds 12,847 new allowed actions' },
        citation: null,
        hint:'AgentRole should never have admin access. Use a scoped policy with only the permissions needed.',
        latency_ms:7 },
    ],
    executed: false,
  },

  'unsafe-kms': {
    name: 'Delete Active KMS Key',
    plan: {
      tool: 'kms.schedule_key_deletion',
      parameters: { key_id: 'alias/lockstep-encryption', pending_window_in_days: 7 },
      blast_radius: ['arn:aws:kms:us-east-1:*:key/*'],
      rollback: { type: 'cancel_key_deletion' },
    },
    gates: [
      { gate:'G1', decision:'pass', reason_code:'authorized', invariant:null, why:'Tool registered (red-team tier), schema valid, token valid', latency_ms:2 },
      { gate:'G2', decision:'deny', reason_code:'invariant_violated', invariant:'INV-08',
        why:'Rotating or deleting a KMS key that is actively in use for encryption',
        values: { key:'alias/lockstep-encryption', active_grants:3, encrypted_resources:['LockstepDemoTable','lockstep-ledger-bucket'] },
        citation: null,
        hint:'This key encrypts 2 active resources. Rotate to a new key first, then schedule deletion of the old one.',
        latency_ms:9 },
    ],
    executed: false,
  },
};

// ── Ask-Why canned responses ──────────────────────────────
const ASK_ANSWERS = {
  'Why was the last action blocked?': null, // filled dynamically
  'What postmortem created this rule?': `ORG-03 was extracted from postmortems/2025-09-payments.md.\n\nOn September 14 2025, a routine restart of the payments service at 03:22 UTC interrupted a batch settlement job, causing $47K in duplicate settlements. The post-incident review mandated: "NEVER restart payments during the 02:00–06:00 batch window without sre-lead approval."\n\nThis was compiled into Cedar rule ORG-03 using template forbid_tool_on_entity_during_window, approved by sre-lead.\n\n<span class="cite">📎 memory/corpus/postmortems/2025-09-payments.md</span>`,
  'How can I safely restart payments?': `To safely restart payments-api:\n\n1. Check the current UTC time is outside 02:00–06:00 (ORG-03 batch window)\n2. Ensure desired_count stays ≥ 2 (INV-02 quorum)\n3. Use tool ecs.update_service with force_new_deployment: true\n4. The blast radius should declare only the payments-api service ARN\n5. Include a rollback reference to the current task definition\n\nThis action is typically approved at autonomy level L2 (no human in the loop) when all five conditions are met.\n\n<span class="cite">📎 control/gate2.py — INV-02, ORG-03</span>`,
  'What invariants protect the database?': `Three invariants protect data stores:\n\n• INV-05 — An agent may NEVER delete a data store (DynamoDB table, RDS instance, S3 bucket). This is unconditional.\n• INV-08 — Rotating or deleting a KMS key that encrypts active resources. Protects data-at-rest encryption.\n• INV-07 — Disabling or deleting an audit source (CloudTrail, access logs). Protects the audit trail.\n\nAdditionally, ORG-05 (from postmortems/2025-03-rollback-data-loss.md) requires a verified backup before any rollback that touches a data store.\n\n<span class="cite">📎 invariants/generic/*.cedar</span>`,
};

// ── State ──────────────────────────────────────────────────
let trafficTimer = null;
let trafficRunning = false;
let latencies = [];          // raw ms values for sparkline
let reqCount = 0;
let errCount = 0;
let rpsWindow = [];          // timestamps of recent requests
let ledger = [];
let lastDenyResult = null;
let evaluating = false;

// ── DOM helpers ────────────────────────────────────────────
const $ = id => document.getElementById(id);
const show = el => el.classList.remove('hidden');
const hide = el => el.classList.add('hidden');

// ── Init ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Traffic
  $('traffic-toggle').onclick = toggleTraffic;

  // Chaos
  $('c-lat').oninput = () => { $('c-lat-v').textContent = $('c-lat').value + ' ms'; };
  $('c-err').oninput = () => { $('c-err-v').textContent = $('c-err').value + '%'; };
  $('c-pool').onchange = () => { $('c-pool-v').textContent = $('c-pool').checked ? 'ON' : 'Off'; };
  $('chaos-inject').onclick = applyChaos;
  $('chaos-nuke').onclick = nukeChaos;
  $('chaos-clear').onclick = clearChaos;

  // Pipeline
  $('scenario-sel').onchange = selectScenario;
  $('eval-btn').onclick = evaluatePlan;

  // Ask-why
  $('ask-btn').onclick = () => askWhy($('ask-input').value);
  $('ask-input').onkeydown = e => { if (e.key === 'Enter') askWhy($('ask-input').value); };
  document.querySelectorAll('.chip').forEach(c => {
    c.onclick = () => { $('ask-input').value = c.dataset.q; askWhy(c.dataset.q); };
  });
});

// ════════════════════════════════════════════════════════════
// TRAFFIC MONITOR
// ════════════════════════════════════════════════════════════
function toggleTraffic() {
  if (trafficRunning) stopTraffic(); else startTraffic();
}

function startTraffic() {
  trafficRunning = true;
  $('traffic-toggle').textContent = 'Stop Traffic';
  $('traffic-toggle').classList.replace('btn-primary', 'btn-danger');
  setStatus('live', 'Sending traffic');
  sendRequest(); // first immediately
  trafficTimer = setInterval(sendRequest, 800);
}

function stopTraffic() {
  trafficRunning = false;
  clearInterval(trafficTimer);
  $('traffic-toggle').textContent = 'Start Traffic';
  $('traffic-toggle').classList.replace('btn-danger', 'btn-primary');
  setStatus('idle', 'Idle');
}

async function sendRequest() {
  const t0 = performance.now();
  rpsWindow.push(Date.now());
  rpsWindow = rpsWindow.filter(t => Date.now() - t < 5000); // 5 s window
  try {
    const res = await fetch('/api/buy');
    const ms = Math.round(performance.now() - t0);
    reqCount++;
    if (!res.ok) { errCount++; }
    const data = res.ok ? await res.json() : {};
    const lat = data.payments_latency ?? ms;
    latencies.push(lat);
    if (latencies.length > 60) latencies.shift();
    updateMetrics(lat);
  } catch {
    errCount++;
    const ms = Math.round(performance.now() - t0);
    latencies.push(ms);
    if (latencies.length > 60) latencies.shift();
    updateMetrics(ms);
  }
}

function updateMetrics() {
  // RPS (over 5 s window)
  const rps = (rpsWindow.length / 5).toFixed(1);
  $('m-rps').textContent = rps;

  // Avg
  if (latencies.length) {
    const avg = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
    $('m-avg').textContent = avg;
  }

  // P99
  if (latencies.length >= 3) {
    const sorted = [...latencies].sort((a, b) => a - b);
    const idx = Math.floor(sorted.length * 0.99);
    $('m-p99').textContent = sorted[Math.min(idx, sorted.length - 1)];
  }

  // Errors
  $('m-err').textContent = errCount;
  const errCard = $('m-err-card');
  if (errCount > 0) errCard.classList.add('danger');
  else errCard.classList.remove('danger');

  drawSparkline();
}

function drawSparkline() {
  if (!latencies.length) return;
  const W = 480, H = 72;
  const maxVal = Math.max(...latencies, 1);
  const pts = latencies.map((v, i) => {
    const x = (i / Math.max(latencies.length - 1, 1)) * W;
    const y = H - (v / maxVal) * (H - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const lineStr = pts.join(' ');
  $('spark-line').setAttribute('points', lineStr);
  // fill: close the polygon along the bottom
  const fillStr = `0,${H} ${lineStr} ${W},${H}`;
  $('spark-fill').setAttribute('points', fillStr);
}

// ════════════════════════════════════════════════════════════
// CHAOS ENGINEERING
// ════════════════════════════════════════════════════════════
async function applyChaos() {
  const body = {
    latency_ms: parseInt($('c-lat').value),
    error_rate: parseInt($('c-err').value) / 100,
    pool_leak: $('c-pool').checked,
  };
  try {
    const res = await fetch('/api/chaos', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
    if (res.ok) {
      showChaosStatus(body);
    } else {
      $('chaos-status').textContent = 'Failed to inject — ' + res.status;
    }
  } catch(e) {
    $('chaos-status').textContent = 'Network error — ' + e.message;
  }
}

function nukeChaos() {
  $('c-lat').value = 3000; $('c-lat-v').textContent = '3000 ms';
  $('c-err').value = 50;   $('c-err-v').textContent = '50%';
  $('c-pool').checked = true; $('c-pool-v').textContent = 'ON';
  applyChaos();
}

function clearChaos() {
  $('c-lat').value = 0;  $('c-lat-v').textContent = '0 ms';
  $('c-err').value = 0;  $('c-err-v').textContent = '0%';
  $('c-pool').checked = false; $('c-pool-v').textContent = 'Off';
  applyChaos();
}

function showChaosStatus(body) {
  const parts = [];
  if (body.latency_ms > 0) parts.push(`+${body.latency_ms}ms latency`);
  if (body.error_rate > 0) parts.push(`${Math.round(body.error_rate*100)}% errors`);
  if (body.pool_leak) parts.push('pool leak');
  const el = $('chaos-status');
  if (parts.length) {
    el.textContent = '⚠ Active faults: ' + parts.join(', ');
    el.classList.add('active');
    setStatus('fault', 'Faults active');
  } else {
    el.textContent = 'No faults active';
    el.classList.remove('active');
    if (trafficRunning) setStatus('live', 'Sending traffic');
    else setStatus('idle', 'Idle');
  }
}

// ════════════════════════════════════════════════════════════
// GATE PIPELINE
// ════════════════════════════════════════════════════════════
function selectScenario() {
  const key = $('scenario-sel').value;
  resetPipeline();
  if (!key) {
    $('plan-box').textContent = 'Select a scenario above to preview the action plan.';
    $('eval-btn').disabled = true;
    return;
  }
  const sc = SCENARIOS[key];
  const plan = sc.plan;
  const lines = [
    `Action:  ${sc.name}`,
    `Tool:    ${plan.tool}`,
    `Params:  ${JSON.stringify(plan.parameters, null, 2)}`,
    `Blast:   ${JSON.stringify(plan.blast_radius)}`,
    `Rollback:${plan.rollback ? ' ' + JSON.stringify(plan.rollback) : ' none (irreversible)'}`,
  ];
  if (plan.context_note) lines.push(`Context: ${plan.context_note}`);
  $('plan-box').textContent = lines.join('\n');
  $('eval-btn').disabled = false;
}

function resetPipeline() {
  ['g-g1','g-g2','g-g3','g-g4','g-g5','g-exec'].forEach(id => {
    const el = $(id);
    el.classList.remove('pass','deny','active','exec-ok');
  });
  hide($('detail-card'));
}

async function evaluatePlan() {
  const key = $('scenario-sel').value;
  if (!key || evaluating) return;
  evaluating = true;
  $('eval-btn').disabled = true;
  $('eval-btn').textContent = 'Evaluating…';
  resetPipeline();

  const sc = SCENARIOS[key];
  const gates = sc.gates;
  const gateIds = ['g-g1','g-g2','g-g3','g-g4','g-g5'];
  let finalResult = null;

  for (let i = 0; i < gates.length; i++) {
    const g = gates[i];
    const el = $(gateIds[i]);

    // Activate
    el.classList.add('active');
    await sleep(400 + g.latency_ms * 2); // stretch latency for visual drama

    el.classList.remove('active');

    if (g.decision === 'pass') {
      el.classList.add('pass');
    } else {
      el.classList.add('deny');
      finalResult = g;
      break;
    }
  }

  // If all passed and execution happened
  if (!finalResult && sc.executed) {
    // Remaining gates (G3-G5 if scenario only has G1-G2 listed) are already covered in the gates array
    // Light up execute node
    $('g-exec').classList.add('exec-ok');
    await sleep(300);
    showDetail({
      decision: 'pass',
      gate: 'Orchestrator',
      invariant: '—',
      why: sc.execMsg,
      values: null,
      citation: null,
      hint: null,
    });
    addLedger(sc, 'pass', sc.execMsg);
  } else if (finalResult) {
    showDetail(finalResult);
    addLedger(sc, 'deny', `${finalResult.invariant}: ${finalResult.why}`);
    lastDenyResult = finalResult;
    // Update the dynamic ask-why answer
    ASK_ANSWERS['Why was the last action blocked?'] =
      `The action "${sc.name}" was blocked at <b>${finalResult.gate}</b> by invariant <b>${finalResult.invariant}</b>.\n\n${finalResult.why}\n` +
      (finalResult.hint ? `\n💡 <b>Hint:</b> ${finalResult.hint}\n` : '') +
      (finalResult.citation ? `\n<span class="cite">📎 ${finalResult.citation}</span>` : `\n<span class="cite">📎 invariants/generic/${finalResult.invariant}.cedar</span>`);
  }

  $('eval-btn').textContent = 'Evaluate Plan';
  $('eval-btn').disabled = false;
  evaluating = false;
}

function showDetail(result) {
  const card = $('detail-card');
  show(card);

  const badge = $('d-badge');
  badge.textContent = result.decision.toUpperCase();
  badge.className = 'detail-badge ' + (result.decision === 'pass' ? 'pass-badge' : 'deny-badge');
  $('d-title').textContent = result.gate;
  $('d-inv').textContent = result.invariant ?? '—';
  $('d-why').textContent = result.why;

  const citeRow = $('d-cite-row');
  if (result.citation) { show(citeRow); $('d-cite').textContent = result.citation; }
  else hide(citeRow);

  const hintRow = $('d-hint-row');
  if (result.hint) { show(hintRow); $('d-hint').textContent = result.hint; }
  else hide(hintRow);

  const valsRow = $('d-vals-row');
  if (result.values) { show(valsRow); $('d-vals').textContent = JSON.stringify(result.values, null, 2); }
  else hide(valsRow);

  // Scroll into view
  card.scrollIntoView({ behavior:'smooth', block:'nearest' });
}

// ════════════════════════════════════════════════════════════
// ASK WHY
// ════════════════════════════════════════════════════════════
function askWhy(q) {
  if (!q.trim()) return;
  const resp = $('ask-resp');
  resp.innerHTML = '<em style="color:var(--muted)">Thinking…</em>';

  // Simulate a short delay for realism
  setTimeout(() => {
    // Check for exact match first
    let answer = ASK_ANSWERS[q];
    if (answer) {
      resp.innerHTML = answer;
      return;
    }
    // Fuzzy match on keywords
    const lower = q.toLowerCase();
    if (lower.includes('block') || lower.includes('denied') || lower.includes('why')) {
      answer = ASK_ANSWERS['Why was the last action blocked?'];
      if (answer) { resp.innerHTML = answer; return; }
      resp.innerHTML = 'No actions have been blocked yet. Run a scenario in the Gate Pipeline first.';
      return;
    }
    if (lower.includes('postmortem') || lower.includes('source') || lower.includes('org-03') || lower.includes('citation')) {
      resp.innerHTML = ASK_ANSWERS['What postmortem created this rule?'];
      return;
    }
    if (lower.includes('restart') || lower.includes('safe') || lower.includes('how')) {
      resp.innerHTML = ASK_ANSWERS['How can I safely restart payments?'];
      return;
    }
    if (lower.includes('database') || lower.includes('dynamo') || lower.includes('protect') || lower.includes('invariant')) {
      resp.innerHTML = ASK_ANSWERS['What invariants protect the database?'];
      return;
    }
    // Fallback
    resp.innerHTML = `I don't have enough context to answer that precisely. Try asking about:\n• Why a specific action was blocked\n• Which postmortem created a rule\n• How to safely perform an action\n• What invariants protect a resource\n\n<span class="cite">📎 This response was generated without model access (Bedrock unavailable). In production, the Bedrock agent provides cited natural-language answers.</span>`;
  }, 600);
}

// ════════════════════════════════════════════════════════════
// LEDGER
// ════════════════════════════════════════════════════════════
let prevHash = '0000000000000000';

function addLedger(scenario, decision, result) {
  const now = new Date();
  const record = {
    ts: now.toISOString(),
    action: scenario.name,
    tool: scenario.plan.tool,
    decision,
    result,
    hash: hashRecord(prevHash, scenario.name, decision, now.toISOString()),
    prev_hash: prevHash,
  };
  prevHash = record.hash;
  ledger.unshift(record);
  if (ledger.length > 20) ledger.pop();
  renderLedger();
}

function hashRecord(prev, action, decision, ts) {
  // Simple deterministic hash for demo — not crypto
  let h = 0;
  const str = prev + action + decision + ts;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(16).padStart(16, '0').slice(0, 16);
}

function renderLedger() {
  const list = $('ledger-list');
  if (!ledger.length) {
    list.innerHTML = '<div class="ledger-empty">No records yet. Evaluate a plan to create ledger entries.</div>';
    return;
  }
  list.innerHTML = ledger.slice(0, 8).map(r => `
    <div class="ledger-entry entry-${r.decision}">
      <div class="ledger-ts">${new Date(r.ts).toLocaleTimeString()}</div>
      <div class="ledger-action">${r.tool} → ${r.action}</div>
      <div class="ledger-result">${r.decision === 'pass' ? '✅' : '❌'} ${truncate(r.result, 80)}</div>
      <div class="ledger-hash">hash: ${r.hash} ← prev: ${r.prev_hash}</div>
    </div>
  `).join('');
}

// ════════════════════════════════════════════════════════════
// UTILITIES
// ════════════════════════════════════════════════════════════
function setStatus(mode, text) {
  const dot = $('status-dot');
  dot.classList.remove('live','fault');
  if (mode === 'live') dot.classList.add('live');
  if (mode === 'fault') dot.classList.add('fault');
  $('status-text').textContent = text;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function truncate(s, n) { return s.length > n ? s.slice(0, n) + '…' : s; }
