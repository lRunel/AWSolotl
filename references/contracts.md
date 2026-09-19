# Contracts (frozen at Iteration 0)

These are the shapes both people build against. Anything crossing the A/B boundary lives
here. Changes after I0 need a `schema_version` bump and the other person's approval.

Every schema sets `"additionalProperties": false`. Unknown keys are a Gate 1 denial, and
that only works if the schemas are strict.

## Repository layout

```
lockstep-recall/
  infra/          iam_stack.py demo_stack.py observe_stack.py
                  control_stack.py brain_stack.py ui_stack.py
  services/demo-app/     2 FastAPI services, /chaos endpoint, load generator
  control/        orchestrator.py gate1.py gate3.py gate5.py broker.py ledger.py   (A)
                  registry.py gate2.py gate4.py sensors.py                          (B)
  invariants/     generic/*.cedar  org/*.cedar  schema.cedarschema                  (B)
  memory/         ingest.py anchor.py extract.py compile.py store.py                (B)
  connectors/     base.py github.py postmortem.py slack_export.py                   (B)
  causal/         detector.py topology.py score.py falsify.py                       (B/A)
  agents/         router.py tools.py prompts/                                       (B)
  schemas/        *.json                                                         (shared)
  brakebench/     plans/ (B)  runner/ (A)  results.md
  ui/             index.html app.css gates.js ledger.js rules.js ask.js
  docs/           one file per component, owned by that component's owner
  fixtures/       recorded verdicts, plans, gate results, ledger records
```

## 1. SourceChunk (connector output, B)

One interface for every connector, so a new source is a new file and nothing else changes.

```python
@dataclass
class SourceChunk:
    id: str            # 'gh_pr_342', 'pm_2025-09-payments'
    source_type: str   # 'github_pr' | 'postmortem' | 'adr' | 'slack_message'
    content: str
    url: str
    author: str
    created_at: str    # ISO 8601
    content_hash: str  # sha256 of content, used for staleness detection
    metadata: dict

class BaseConnector(ABC):
    def authenticate(self, token: str) -> bool: ...
    def fetch_all(self, workspace_id: str) -> list[SourceChunk]: ...
    def fetch_since(self, workspace_id: str, since: str) -> list[SourceChunk]: ...
    def get_source_name(self) -> str: ...
```

## 2. MemoryItem and Rule (B)

`trust_level` is the whole security model of the memory plane in one field.

```json
{
  "item_id": "pm_2025-09-payments#L40",
  "source_type": "postmortem",
  "url": "gh:acme/infra/postmortems/2025-09-payments.md#L40",
  "content_hash": "sha256:...",
  "entity_ids": ["ecs/payments-api"],
  "tool_ids": ["ecs.restart_service"],
  "trust_level": 0,
  "injection_flag": false
}
```

```json
{
  "rule_id": "ORG-03",
  "template": "forbid_tool_on_entity_during_window",
  "slots": {"tool": "ecs.restart_service", "entity": "payments-api", "window": "batch"},
  "cedar_text": "@id(\"ORG-03\") ... forbid (...)",
  "source_ref": "gh:acme/infra/postmortems/2025-09-payments.md#L40",
  "source_hash": "sha256:...",
  "status": "signed",
  "approved_by": "sre-lead",
  "approved_at": "2026-09-19T10:00:00Z",
  "signature": "sha256:..."
}
```

**Trust ladder.** `0 raw` has no effect. `1 precedent` is advisory and may only raise risk
or force human review. `2 candidate` has no effect until approved. `3 signed` is enforced
with a citation. A rule whose `source_hash` no longer matches its source becomes `stale`
and drops to advisory until re-approved.

**Closed vocabulary.** The model fills slots; it never writes Cedar. Templates:
`forbid_tool_on_entity_during_window`, `min_count`, `requires_precondition`,
`requires_human`, `freeze`, `cidr_deny`. Output outside this set is discarded, not repaired.

## 3. CausalVerdict (B produces, A and B consume)

```json
{"incident_id":"inc_7f3","slo":"checkout.p99","window":["T-10m","T"],
 "candidates":[{"entity":"ecs/payments-api","confidence":0.87,"layer":"L2",
   "evidence":["deploy rev 4412 at T-3m","pool_wait_ms +840%"]}],
 "falsification":{"p":0.004,"passed":true},
 "abstained":false,"ts":"...","sig":"sha256:...","schema_version":1}
```

`confidence` is a fused ranking score, not a calibrated probability. Label it that way in
the UI and the README. When `abstained` is true, nothing destructive may follow: Cedar
forbids it (INV-03) and Gate 4 refuses auto-execution.

## 4. ActionPlan (B produces, A consumes — untrusted)

Every action carries four things. Missing rollback is a Gate 3 denial; missing
justification is a Gate 1 denial. The schema is what forces the agent to be accountable.

```json
{"plan_id":"pln_01","incident_id":"inc_7f3","stage":"remediate","schema_version":1,
 "actions":[{
   "id":"a1","tool":"ecs.rollback_to_revision",
   "args":{"cluster":"demo","service":"payments-api","to_revision":11},
   "blast_radius":{"accounts":["1234..."],"region":"us-east-1",
     "arns":["arn:aws:ecs:...:service/demo/payments-api"],
     "max_tasks":4,"data_destructive":false},
   "rollback":{"tool":"ecs.rollback_to_revision","args":{"to_revision":12}},
   "expected_effect":{"metric":"checkout.p99","direction":"down",
     "threshold_ms":400,"within_s":180},
   "justification_ref":"inc_7f3#candidates[0]"}]}
```

## 5. GateResult (both produce)

```json
{"gate":"proof","decision":"deny","reason_code":"org_rule",
 "invariant":"ORG-03",
 "why":"restart of payments-api during the batch window is forbidden",
 "values":{"tool":"ecs.restart_service","entity":"payments-api","window":"batch"},
 "citation":{"rule_id":"ORG-03",
   "source_ref":"gh:acme/infra/postmortems/2025-09-payments.md#L40",
   "approved_by":"sre-lead"},
 "hint":"wait for the batch window to close, or use ecs.scale",
 "retries_left":1,"latency_ms":184,"schema_version":1}
```

`citation` is null for generic invariants and populated for org rules. It is what makes a
deny explainable, so never drop it to save a field.

## 6. LedgerRecord (A)

```json
{"record_id":42,"prev_hash":"sha256:...","incident_id":"inc_7f3",
 "action":{...},
 "gates":{"authority":"pass","proof":"pass 14/14","radius":"pass",
          "risk":0.21,"autonomy":"L2","watchdog":"clean"},
 "rules_applied":["INV-02","ORG-03"],
 "causal_basis":{"entity":"payments-api","conf":0.87,"p":0.004},
 "diff":{...},"result":"SLO recovered T+94s","actor":"agent:remediate-1",
 "hash":"sha256:..."}
```

Canonical JSON (sorted keys, no whitespace, UTF-8) before hashing, or verification will
fail for reasons that take hours to find. The chain head is updated in the same
`TransactWriteItems` as the record put, so concurrent writers cannot fork it.

## 7. Control Plane HTTP API (A)

| Method and path | Caller | Purpose |
|---|---|---|
| `POST /plans` | agent | Run G1–G4, broker, G5. Returns GateResults, a counterexample on deny, the result. Idempotent per `plan_id` |
| `POST /plans/{id}/approve` · `/deny` | human | L1 proposals |
| `GET /incidents` · `/incidents/{id}` | UI | Timeline, verdict, gate results |
| `GET /ledger` · `/ledger/{n}` · `/ledger/verify` | UI, judges | Records and chain verification |
| `GET /rules` · `POST /rules/{id}/approve` · `/reject` · `/revoke` | human, UI | Rule lifecycle |
| `POST /ask` | UI | Ask-why over episodes; cite or say unknown |
| `POST /brakebench/run` | team | Runs the suite, returns the four numbers |

## 8. Python interfaces across the A/B boundary

A imports B's modules directly; they ship in the same Lambda package.

```python
# B provides
def gate2_check(plan, action, ctx) -> GateResult
def gate4_score(plan, action, ctx) -> GateResult
def memory_lookup(tool: str, entity: str) -> list[Precedent]   # advisory only
def registry_get(tool: str) -> ToolSpec | None

# A provides
def simulate(action) -> Simulation      # resources_touched, reversibility
def mint_token(incident_id, stage) -> Token
def ledger_append(record) -> int
```

## 9. Tool registry (B owns, everyone reads)

| Tool | Tier | Stage | G3 simulator | Executor | Rollback |
|---|---|---|---|---|---|
| `ecs.rollback_to_revision` | MVP | remediate | describe projection | `ecs:UpdateService` | SSM RollbackEcsRevision |
| `ecs.restart_service` | MVP | remediate | describe projection | `ecs:UpdateService` | SSM RestoreServiceState |
| `ecs.scale` | MVP | remediate | describe projection | `ecs:UpdateService` | SSM RestoreServiceState |
| `verify.slo` | MVP | restore | read-only | `cloudwatch:GetMetricData` | none |
| `sg.revoke_ingress` | stretch | contain | EC2 `DryRun=True` | `ec2:RevokeSecurityGroupIngress` | SSM RestoreSgRule |
| `ddb.delete_table`, `iam.attach_policy`, `kms.schedule_key_deletion`, `cloudtrail.stop_logging`, `s3.delete_bucket`, `sg.authorize_ingress` | red-team | never exposed | Cedar only | `ExecRole` has no such permission | n/a |

Red-team tools are registered so Gate 2 can be tested against them. They never appear in an
agent's tool list and `ExecRole` cannot perform them.

## 10. Config and events

- SSM Parameter Store `/lockstep/*` holds every table name, bucket name, role ARN, SSM
  document name, and the Slack webhook (SecureString).
- EventBridge bus `lockstep`: `incident.opened`, `verdict.ready`, `plan.submitted`,
  `plan.denied`, `execution.halted`, `rule.proposed`, `rule.approved`, `incident.closed`.

## 11. Fixtures

`fixtures/` holds a recorded verdict, plan, gate-result set, and ledger chain. The UI must
render from fixtures with the backend down, and BrakeBench must run gates without AWS. Both
people add a fixture whenever they add a shape, because fixtures are what let the demo
survive a failure on stage.
