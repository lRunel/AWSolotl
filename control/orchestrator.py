import json
import logging
from . import gate1, gate2, gate3, gate4, gate5, human_loop, broker, ledger

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event, context):
    logger.info("Received request: %s", json.dumps(event))

    try:
        body = json.loads(event.get('body', '{}'))
    except json.JSONDecodeError:
        body = {}

    plan = body.get("plan", {})
    action = body.get("action", {})
    ctx = body.get("ctx", {})

    gates_results = {}
    incident_id = plan.get("incident_id", "unknown")
    plan_id = plan.get("id", "unknown")
    action_id = action.get("id", "unknown")

    # Run Gates 1-5. Gate 2 and Gate 4 export their check function under a
    # gate-specific name (gate2_check, gate4_score) rather than `check`, so
    # each gate needs its own entry point rather than a uniform attribute
    # lookup -- calling `.check` uniformly here used to raise AttributeError
    # on every real (non-stub) run and was never caught because nothing
    # exercises this Lambda handler end to end yet.
    gate_checks = [
        (gate1.check, "G1"),
        (gate2.gate2_check, "G2"),
        (gate3.check, "G3"),
        (gate4.gate4_score, "G4"),
        (gate5.check, "G5"),
    ]
    for gate_check, name in gate_checks:
        try:
            result = gate_check(plan, action, ctx)
            gates_results[name] = result
            if result.get("decision") != "pass":
                try:
                    ledger.append_record(
                        incident_id=incident_id, action=action, gates=gates_results,
                        causal_basis=ctx.get("causal_basis", {}), diff={},
                        result=f"deny at {name}: {result.get('why')}", actor="orchestrator"
                    )
                except Exception as e:
                    logger.error(f"Ledger append failed for deny: {e}")
                return {
                    "statusCode": 403,
                    "headers": {"Content-Type": "application/json"},
                    "body": json.dumps(result)
                }
        except Exception as e:
            logger.error(f"Gate {name} exception: {e}")
            err_result = {
                "gate": "orchestrator", "decision": "deny", "reason_code": "gate_exception",
                "invariant": None, "why": f"Gate {name} exception: {str(e)}", "values": {},
                "citation": None, "hint": None, "retries_left": 0, "latency_ms": 0, "schema_version": 1
            }
            return {
                "statusCode": 500,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps(err_result)
            }

    # All gates passed, check autonomy level
    autonomy_level = plan.get("autonomy_level", "L1")
    if autonomy_level in ["L0", "L1"]:
        approved = human_loop.request_approval(plan, action, ctx)
        if not approved:
            deny_result = {
                "gate": "human", "decision": "deny", "reason_code": "human_denied",
                "invariant": None, "why": "Human reviewer denied the action", "values": {},
                "citation": None, "hint": None, "retries_left": 0, "latency_ms": 0, "schema_version": 1
            }
            try:
                ledger.append_record(
                    incident_id=incident_id, action=action, gates=gates_results,
                    causal_basis=ctx.get("causal_basis", {}), diff={},
                    result="human denied", actor="orchestrator"
                )
            except Exception as e:
                logger.error(f"Ledger append failed for human deny: {e}")
            return {
                "statusCode": 403,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps(deny_result)
            }

    # Execute Action
    try:
        exec_result = broker.execute(incident_id, plan_id, action)
        try:
            ledger.append_record(
                incident_id=incident_id, action=action, gates=gates_results,
                causal_basis=ctx.get("causal_basis", {}), diff={},
                result="success", actor="orchestrator"
            )
        except Exception as ledger_e:
            logger.error(f"Ledger append failed: {ledger_e}")
            
        success_result = {
            "gate": "orchestrator", "decision": "pass", "reason_code": "executed",
            "invariant": None, "why": "Action executed successfully", "values": exec_result,
            "citation": None, "hint": None, "retries_left": 0, "latency_ms": 0, "schema_version": 1
        }
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps(success_result)
        }
    except Exception as e:
        logger.error(f"Execution failed: {e}")
        try:
            ledger.append_record(
                incident_id=incident_id, action=action, gates=gates_results,
                causal_basis=ctx.get("causal_basis", {}), diff={},
                result=f"failed: {str(e)}", actor="orchestrator"
            )
        except Exception as ledger_e:
            logger.error(f"Ledger append failed on execution error: {ledger_e}")
            
        fail_result = {
            "gate": "orchestrator", "decision": "deny", "reason_code": "execution_failed",
            "invariant": None, "why": str(e), "values": {},
            "citation": None, "hint": None, "retries_left": 0, "latency_ms": 0, "schema_version": 1
        }
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps(fail_result)
        }
