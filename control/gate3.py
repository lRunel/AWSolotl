def check_scope_lie(simulated_arns: set, declared_arns: set) -> tuple[bool, set]:
    if not simulated_arns.issubset(declared_arns):
        return False, simulated_arns - declared_arns
    return True, set()

def check(plan: dict, action: dict, ctx: dict) -> dict:
    tool = action.get("tool")
    args = action.get("args", {})
    declared_radius = set(action.get("blast_radius", {}).get("arns", []))
    
    # In Iteration 0/Gate3 pure function, the orchestrator/adapter provides the simulated ARNs in ctx.
    simulated_arns = set(ctx.get("simulated_arns", []))
    
    # demo.* tools are the local-only remediation actions the control-api's
    # self-healing watchdog uses when there is no AWS account to simulate
    # against (services/control-api); their "blast radius" is a single local
    # process, so they use the same declared-vs-simulated subset check as
    # everything else, just with a synthetic local ARN.
    if tool not in [
        "ecs.scale", "ecs.restart_service", "ecs.rollback_to_revision", "sg.revoke_ingress", "verify.slo",
        "demo.reset_chaos_config", "demo.restart_web_service",
    ]:
        return {
            "gate": "radius", "decision": "deny", "reason_code": "unknown_tool",
            "invariant": "G3", "why": f"Gate 3 cannot simulate {tool}", "values": {"tool": tool},
            "citation": None, "hint": "Tool missing simulator", "retries_left": 2, "latency_ms": 50, "schema_version": 1
        }
        
    valid, lied_arns = check_scope_lie(simulated_arns, declared_radius)
    if not valid:
        return {
            "gate": "radius", "decision": "deny", "reason_code": "scope_lie",
            "invariant": "G3", "why": "Simulated ARNs exceed declared blast radius", 
            "values": {"extra_arns": list(lied_arns)},
            "citation": None, "hint": "Expand declared blast radius", "retries_left": 2, "latency_ms": 50, "schema_version": 1
        }
        
    # Check rollback presence
    if not action.get("rollback"):
        return {
            "gate": "radius", "decision": "deny", "reason_code": "no_rollback",
            "invariant": "G3", "why": "No rollback plan provided", "values": {},
            "citation": None, "hint": "Provide rollback", "retries_left": 2, "latency_ms": 50, "schema_version": 1
        }
        
    return {
        "gate": "radius", "decision": "pass", "reason_code": "all_clear",
        "invariant": None, "why": "Radius simulated and validated", "values": {},
        "citation": None, "hint": None, "retries_left": 2, "latency_ms": 50, "schema_version": 1
    }
