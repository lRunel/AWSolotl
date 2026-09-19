import json
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event, context):
    \"\"\"
    Mock Orchestrator handler for POST /plans.
    In Iteration 0, this always returns a passing GateResult.
    \"\"\"
    logger.info("Received request: %s", json.dumps(event))

    # Try parsing the body, but don't strictly validate in I0 yet
    try:
        body = json.loads(event.get('body', '{}'))
    except json.JSONDecodeError:
        body = {}

    # Mock successful GateResult
    gate_result = {
        "gate": "proof",
        "decision": "pass",
        "reason_code": "all_clear",
        "invariant": None,
        "why": "Iteration 0 mock always passes",
        "values": {},
        "citation": None,
        "hint": None,
        "retries_left": 2,
        "latency_ms": 10,
        "schema_version": 1
    }

    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json"
        },
        "body": json.dumps(gate_result)
    }
