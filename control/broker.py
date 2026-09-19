import json
import boto3
import os

sts = boto3.client('sts', region_name=os.environ.get("AWS_REGION", "us-east-1"))
ddb = boto3.client('dynamodb', region_name=os.environ.get("AWS_REGION", "us-east-1"))

EXEC_ROLE_ARN = os.environ.get("EXEC_ROLE_ARN")
IDEMPOTENCY_TABLE = os.environ.get("IDEMPOTENCY_TABLE", "lockstep-idempotency")

def build_session_policy(action: dict) -> str:
    tool = action["tool"]
    radius = action["blast_radius"]
    arns = radius.get("arns", [])
    
    # Base policy: Allow execution on declared ARNs
    policy = {
        "Version": "2012-10-17",
        "Statement": []
    }
    
    allow_stmt = {
        "Effect": "Allow",
        "Action": [],
        "Resource": arns if arns else "*"
    }
    
    if tool.startswith("ecs."):
        allow_stmt["Action"].extend(["ecs:UpdateService", "ecs:DescribeServices"])
    elif tool.startswith("sg."):
        allow_stmt["Action"].extend(["ec2:RevokeSecurityGroupIngress", "ec2:DescribeSecurityGroups"])
        
    policy["Statement"].append(allow_stmt)
    
    # Deny list to prevent broad access
    # We must allow PassRole for SSM Automation if needed, so we don't blanket deny iam:*
    # We will just deny known dangerous actions outside the boundary.
    policy["Statement"].append({
        "Effect": "Deny",
        "Action": [
            "ecs:DeleteService",
            "dynamodb:DeleteTable",
            "rds:*",
            "kms:ScheduleKeyDeletion"
        ],
        "Resource": "*"
    })
    
    return json.dumps(policy)

def execute_tool(session: boto3.Session, tool: str, args: dict):
    if tool == "ecs.scale":
        ecs = session.client("ecs")
        ecs.update_service(cluster=args["cluster"], service=args["service"], desiredCount=args["desired_count"])
    elif tool == "ecs.restart_service":
        ecs = session.client("ecs")
        ecs.update_service(cluster=args["cluster"], service=args["service"], forceNewDeployment=True)
    elif tool == "ecs.rollback_to_revision":
        ecs = session.client("ecs")
        ecs.update_service(cluster=args["cluster"], service=args["service"], taskDefinition=str(args["to_revision"]))
    elif tool == "sg.revoke_ingress":
        ec2 = session.client("ec2")
        ec2.revoke_security_group_ingress(
            GroupId=args["group_id"],
            IpPermissions=[{
                "IpProtocol": "tcp", "FromPort": args["port"], "ToPort": args["port"],
                "IpRanges": [{"CidrIp": args["cidr"]}]
            }]
        )
    elif tool == "verify.slo":
        pass # read-only, done by watchdog/orchestrator
    else:
        raise ValueError(f"Broker cannot execute {tool}")

def check_and_set_idempotency(idem_key: str) -> bool:
    try:
        ddb.put_item(
            TableName=IDEMPOTENCY_TABLE,
            Item={"pk": {"S": idem_key}, "status": {"S": "started"}},
            ConditionExpression="attribute_not_exists(pk)"
        )
        return True
    except ddb.exceptions.ConditionalCheckFailedException:
        return False

def execute(incident_id: str, plan_id: str, action: dict):
    action_id = action["id"]
    idem_key = f"{plan_id}#{action_id}"
    
    if not check_and_set_idempotency(idem_key):
        return {"status": "skipped", "reason": "Idempotency key already exists"}
    
    session_policy = build_session_policy(action)
    
    try:
        creds = sts.assume_role(
            RoleArn=EXEC_ROLE_ARN,
            RoleSessionName=f"lockstep-{incident_id}-{action_id}"[:64],
            Policy=session_policy,
            DurationSeconds=900,
            ExternalId=incident_id
        )
        
        session = boto3.Session(
            aws_access_key_id=creds['Credentials']['AccessKeyId'],
            aws_secret_access_key=creds['Credentials']['SecretAccessKey'],
            aws_session_token=creds['Credentials']['SessionToken']
        )
        
        execute_tool(session, action["tool"], action.get("args", {}))
        
        ddb.update_item(
            TableName=IDEMPOTENCY_TABLE,
            Key={"pk": {"S": idem_key}},
            UpdateExpression="SET #s = :s",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":s": {"S": "success"}}
        )
        
        return {"status": "success"}
    except Exception as e:
        ddb.update_item(
            TableName=IDEMPOTENCY_TABLE,
            Key={"pk": {"S": idem_key}},
            UpdateExpression="SET #s = :s",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":s": {"S": f"failed: {e}"}}
        )
        raise
