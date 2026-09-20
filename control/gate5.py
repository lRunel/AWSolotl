def check(plan: dict, action: dict, ctx: dict) -> dict:
    history = ctx.get("history", [])
    tool = action.get("tool", "")
    args = action.get("args", {})

    # 1. Injection
    for k, v in args.items():
        if isinstance(v, str):
            v_upper = v.upper()
            if ";" in v or "DROP " in v_upper or "$(" in v or "DELETE " in v_upper:
                return {
                    "gate": "watchdog", "decision": "deny", "reason_code": "injection_detected",
                    "invariant": "G5", "why": "Potential injection string in arguments",
                    "values": {"arg": k, "val": v}, "citation": None, "hint": "Remove injection payloads",
                    "retries_left": 0, "latency_ms": 2, "schema_version": 1
                }

    # 2. Hallucinated arg
    for k, v in args.items():
        if isinstance(v, str):
            v_lower = v.lower()
            if "placeholder" in v_lower or "example" in v_lower or "foo" in v_lower:
                return {
                    "gate": "watchdog", "decision": "deny", "reason_code": "hallucinated_arg",
                    "invariant": "G5", "why": "Hallucinated or placeholder argument detected",
                    "values": {"arg": k, "val": v}, "citation": None, "hint": "Provide actual resource identifiers",
                    "retries_left": 1, "latency_ms": 2, "schema_version": 1
                }

    # 3. Scope creep
    allowed_resources = ctx.get("allowed_resources", [])
    action_resources = action.get("blast_radius", {}).get("arns", [])
    if allowed_resources:
        for r in action_resources:
            if r not in allowed_resources:
                return {
                    "gate": "watchdog", "decision": "deny", "reason_code": "scope_creep",
                    "invariant": "G5", "why": "Action targets resource outside allowed scope",
                    "values": {"resource": r}, "citation": None, "hint": "Restrict to initial incident scope",
                    "retries_left": 0, "latency_ms": 2, "schema_version": 1
                }

    # 4. Tool loop and 5. No effect
    same_tool_count = 0
    for past_action in history:
        if past_action.get("tool") == tool and past_action.get("args") == args:
            same_tool_count += 1
    
    if same_tool_count >= 3:
        return {
            "gate": "watchdog", "decision": "deny", "reason_code": "tool_loop",
            "invariant": "G5", "why": "Agent is stuck in a loop repeating the same action",
            "values": {"tool": tool, "count": same_tool_count}, "citation": None, "hint": "Try a different strategy",
            "retries_left": 0, "latency_ms": 2, "schema_version": 1
        }
        
    if same_tool_count > 0 and ctx.get("last_action_effect") == "none":
        return {
            "gate": "watchdog", "decision": "deny", "reason_code": "no_effect",
            "invariant": "G5", "why": "Repeating an action that had no effect",
            "values": {"tool": tool}, "citation": None, "hint": "Observe state before retrying",
            "retries_left": 0, "latency_ms": 2, "schema_version": 1
        }

    # 6. Made it worse
    if ctx.get("metrics_trend") == "degraded":
        return {
            "gate": "watchdog", "decision": "deny", "reason_code": "made_it_worse",
            "invariant": "G5", "why": "System metrics have degraded after recent actions",
            "values": {"trend": "degraded"}, "citation": None, "hint": "Revert or halt changes",
            "retries_left": 0, "latency_ms": 2, "schema_version": 1
        }

    return {
        "gate": "watchdog", "decision": "pass", "reason_code": "all_clear",
        "invariant": None, "why": "Watchdog checks passed", "values": {},
        "citation": None, "hint": None, "retries_left": 2, "latency_ms": 2, "schema_version": 1
    }
