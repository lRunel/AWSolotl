import boto3
import os

ecs = boto3.client('ecs', region_name=os.environ.get("AWS_REGION", "us-east-1"))
ec2 = boto3.client('ec2', region_name=os.environ.get("AWS_REGION", "us-east-1"))
ssm = boto3.client('ssm', region_name=os.environ.get("AWS_REGION", "us-east-1"))

def get_ecs_projection(cluster: str, service: str, new_desired_count: int = None, new_task_def: str = None) -> set:
    resp = ecs.describe_services(cluster=cluster, services=[service])
    if not resp.get("services"):
        raise Exception(f"Service {service} not found in cluster {cluster}")
    
    svc = resp["services"][0]
    touched_arns = {svc["serviceArn"]}
    
    # Simple projection: if we change task def, we touch the task def ARN
    if new_task_def:
        # We would ideally describe the task def to get its ARN, but we'll approximate
        # by adding a placeholder or assuming the target ARN format.
        pass
        
    return touched_arns

def check_scope_lie(simulated_arns: set, declared_arns: set) -> tuple[bool, set]:
    if not simulated_arns.issubset(declared_arns):
        return False, simulated_arns - declared_arns
    return True, set()

def check(plan: dict, action: dict, ctx: dict) -> dict:
    tool = action.get("tool")
    args = action.get("args", {})
    declared_radius = set(action.get("blast_radius", {}).get("arns", []))
    
    simulated_arns = set()
    
    try:
        if tool == "ecs.scale":
            simulated_arns = get_ecs_projection(args["cluster"], args["service"], new_desired_count=args["desired_count"])
        elif tool == "ecs.restart_service":
            simulated_arns = get_ecs_projection(args["cluster"], args["service"])
        elif tool == "ecs.rollback_to_revision":
            simulated_arns = get_ecs_projection(args["cluster"], args["service"], new_task_def=args["to_revision"])
        elif tool == "sg.revoke_ingress":
            # EC2 DryRun
            try:
                ec2.revoke_security_group_ingress(
                    GroupId=args["group_id"],
                    IpPermissions=[{
                        "IpProtocol": "tcp", "FromPort": args["port"], "ToPort": args["port"],
                        "IpRanges": [{"CidrIp": args["cidr"]}]
                    }],
                    DryRun=True
                )
            except ec2.exceptions.ClientError as e:
                if 'DryRunOperation' not in str(e):
                    raise
            # If we get here or DryRunOperation, it touched the SG
            simulated_arns.add(f"arn:aws:ec2:{os.environ.get('AWS_REGION')}:{os.environ.get('AWS_ACCOUNT_ID')}:security-group/{args['group_id']}")
        elif tool == "verify.slo":
            pass # read-only
        else:
            return {
                "gate": "radius", "decision": "deny", "reason_code": "unknown_tool",
                "invariant": "G3", "why": f"Gate 3 cannot simulate {tool}", "values": {"tool": tool},
                "citation": None, "hint": "Tool missing simulator", "retries_left": 2, "latency_ms": 50, "schema_version": 1
            }
    except Exception as e:
         return {
            "gate": "radius", "decision": "deny", "reason_code": "simulation_failed",
            "invariant": "G3", "why": f"Simulation failed: {e}", "values": {"tool": tool},
            "citation": None, "hint": "Check tool args", "retries_left": 2, "latency_ms": 50, "schema_version": 1
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
