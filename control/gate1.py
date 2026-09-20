import json
import time
import os
from jsonschema import validate, ValidationError

def load_schema(schema_name: str) -> dict:
    with open(f"schemas/{schema_name}.json", "r") as f:
        return json.load(f)

def validate_schema(data: dict, schema_name: str) -> tuple[bool, str]:
    schema = load_schema(schema_name)
    try:
        validate(instance=data, schema=schema)
        return True, ""
    except ValidationError as e:
        return False, e.message

def check_token(token_record: dict, incident_id: str, tool: str) -> tuple[bool, str]:
    if not token_record:
        return False, "Token not found"
    
    if token_record.get("revoked", False):
        return False, "Token revoked"
        
    expires_at = int(token_record.get("expires_at", 0))
    if time.time() > expires_at:
        return False, "Token expired"
        
    if token_record.get("incident_id") != incident_id:
        return False, "Token incident mismatch"
        
    tools = token_record.get("tools", [])
    if tool not in tools:
        return False, "Tool not authorized by this token"
        
    return True, ""

def check(plan: dict, action: dict, ctx: dict) -> dict:
    # 1. Validate action against ActionPlan schema
    # (In reality, we validate the whole plan before entering the gate loop, but let's check action schema here)
    valid, err = validate_schema(action, "action_plan")
    if not valid:
        return {
            "gate": "authority", "decision": "deny", "reason_code": "schema_invalid",
            "invariant": "G1", "why": err, "values": {"action": action},
            "citation": None, "hint": "Fix schema errors", "retries_left": 2, "latency_ms": 5, "schema_version": 1
        }
    
    # 2. Check token
    # The token is usually passed in the plan or ctx
    token_record = ctx.get("token_record")
    if not token_record:
        return {
            "gate": "authority", "decision": "deny", "reason_code": "no_token",
            "invariant": "G1", "why": "No capability token provided in context", "values": {},
            "citation": None, "hint": "Request token", "retries_left": 2, "latency_ms": 5, "schema_version": 1
        }
        
    incident_id = plan.get("incident_id")
    tool = action.get("tool")
    
    valid, err = check_token(token_record, incident_id, tool)
    if not valid:
        return {
            "gate": "authority", "decision": "deny", "reason_code": "invalid_token",
            "invariant": "G1", "why": err, "values": {},
            "citation": None, "hint": "Use valid token", "retries_left": 2, "latency_ms": 5, "schema_version": 1
        }
    
    # 3. Check justification
    justification = action.get("justification_ref")
    if not justification:
         return {
            "gate": "authority", "decision": "deny", "reason_code": "no_justification",
            "invariant": "G1", "why": "Action lacks justification_ref", "values": {},
            "citation": None, "hint": "Provide justification", "retries_left": 2, "latency_ms": 5, "schema_version": 1
        }
        
    return {
        "gate": "authority", "decision": "pass", "reason_code": "all_clear",
        "invariant": None, "why": "Authority verified", "values": {},
        "citation": None, "hint": None, "retries_left": 2, "latency_ms": 5, "schema_version": 1
    }
