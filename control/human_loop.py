import json
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def request_approval(plan: dict, action: dict, ctx: dict) -> bool:
    """
    Sends a structured Slack webhook or SNS message to request approval for an L0/L1 autonomy plan.
    Waits/returns a decision. Uses placeholder/mock logic for the actual wait mechanism.
    """
    autonomy_level = plan.get("autonomy_level", "L0")
    plan_id = plan.get("id", "unknown")
    tool = action.get("tool", "unknown")
    
    msg = {
        "text": f"Approval requested for plan {plan_id} (Level {autonomy_level})",
        "action": tool,
        "blast_radius": action.get("blast_radius", {})
    }
    logger.info(f"Sending approval request via SNS/Slack: {json.dumps(msg)}")
    
    # Mocking wait/return behavior
    # In a real environment, this might block, poll a table, or be fully asynchronous.
    mock_decision = ctx.get("mock_approval", True)
    
    if mock_decision:
        logger.info(f"Plan {plan_id} approved by human.")
        return True
    else:
        logger.info(f"Plan {plan_id} denied by human.")
        return False
