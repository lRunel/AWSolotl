# Running it locally

Everything here runs on your machine with no AWS account and no Bedrock
access -- see `docs/AGENTS.md` for why. Two terminals, two commands.

## 1. Start the control-api (spawns and supervises the demo app)

```bash
pip install cedarpy boto3 jsonschema fastapi uvicorn requests pytest
python services/control_api/main.py
```

Run this from the **repo root** -- Gate 1 loads its schemas from a path
relative to the process's working directory. On startup it:

- spawns `services/demo-app/payments` on `:8081` and
  `services/demo-app/web` on `:8080`, and supervises both (kills + respawns
  on crash or a failed health check)
- starts the self-healing watchdog: it probes both services, and on a
  detected incident builds a real `ActionPlan`, runs it through the real
  `control/gate1.py`-`gate5.py`, executes the fix locally, and appends a
  hash-chained record to `var/local_ledger.json`
- serves the dashboard's API on `:8090` (`GET /api/health`,
  `GET /api/ledger`, `GET /api/ledger/verify`, `POST /api/ask`,
  `POST /api/chaos/{scenario}`, `POST /api/chaos/config`)

## 2. Start the dashboard

```bash
cd services/demo-app/web/awsolotl-dashboard
npm install
npm run dev
```

Open the URL it prints (`http://localhost:5173`). The **Overview** tab is
live against the services started in step 1.

## Things to try

- **Overview -> Break it -> "Crash the process"**: this sends
  `GET /api/bug_crash` to the `web` service, which hard-exits
  (`os._exit(1)`). Within ~2s the sidebar's connection dot and the service
  card will flip red, the watchdog detects the dead process, builds a
  `demo.restart_web_service` plan, runs it through Gates 1-5, respawns the
  process, and logs the whole thing -- watch it land in the **Ledger** tab.
- **Overview -> degrade payments-api**: drag the latency slider up and hit
  apply. The watchdog's MAD z-score detector (same math as
  `causal/detector.py`, sourced from local samples instead of CloudWatch)
  will flag the spike within a few probes and reset the chaos config
  automatically.
- **From a terminal**, the same crash the button sends:
  ```bash
  curl -X POST http://localhost:8090/api/chaos/crash
  ```
- **Ask the ledger**: once a few incidents have happened, ask "why did the
  web service restart?" -- the answer cites real record ids from the chain
  you just generated, or says it doesn't know.
- Every one of the control-api's endpoints, and the demo app's own
  endpoints, are rate-limited per client (`control/ratelimit.py`) --
  hammer `/api/health` in a loop and you'll get a `429` with a
  `Retry-After` header. The same limiter guards the Bedrock Haiku call in
  `agents/bedrock_client.py`.

## Pointing this at real AWS

Once real credentials and a deployed stack (`infra/`) exist:

- `control/ledger.py` (DynamoDB + S3 Object Lock) and `control/broker.py`
  (STS + ECS) are the real implementations `control/local_ledger.py` and
  `control/local_executor.py` stand in for here -- same record shape, same
  gate sequence, different backend.
- `agents/bedrock_client.py` already attempts a real
  `bedrock-runtime InvokeModel` call for
  `anthropic.claude-3-haiku-20240307-v1:0` before falling back to the
  cached response; it needs Bedrock model access enabled in the target
  account/region, nothing else changes.
- The dashboard reads `VITE_CONTROL_API_URL` (see
  `services/demo-app/web/awsolotl-dashboard/.env.example`) -- point it at
  the deployed control-api's URL instead of `localhost:8090`.
