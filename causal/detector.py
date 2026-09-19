import json
import boto3
import os
import time

cloudwatch = boto3.client('cloudwatch', region_name=os.environ.get("AWS_REGION", "us-east-1"))
ddb = boto3.client('dynamodb', region_name=os.environ.get("AWS_REGION", "us-east-1"))

INCIDENTS_TABLE = os.environ.get("INCIDENTS_TABLE", "lockstep-incidents")

def get_median(data: list) -> float:
    if not data: return 0.0
    sorted_data = sorted(data)
    n = len(sorted_data)
    if n % 2 == 1:
        return sorted_data[n//2]
    else:
        return (sorted_data[n//2 - 1] + sorted_data[n//2]) / 2.0

def lambda_handler(event, context):
    # This runs every 1 minute.
    # Pull 60 minutes of metrics for checkout.p99
    now = int(time.time())
    start_time = now - 3600
    
    resp = cloudwatch.get_metric_data(
        MetricDataQueries=[
            {
                "Id": "m1",
                "MetricStat": {
                    "Metric": {
                        "Namespace": "Lockstep/App",
                        "MetricName": "checkout.p99",
                        "Dimensions": [{"Name": "Service", "Value": "payments-api"}]
                    },
                    "Period": 60,
                    "Stat": "Maximum"
                },
                "ReturnData": True
            }
        ],
        StartTime=start_time,
        EndTime=now
    )
    
    vals = resp["MetricDataResults"][0]["Values"]
    if not vals:
        return {"status": "no_data"}
        
    med = get_median(vals)
    mad_vals = [abs(x - med) for x in vals]
    mad = 1.4826 * get_median(mad_vals)
    
    latest_val = vals[0] # values are ordered newest first by default in get_metric_data? Actually usually chronological if requested, let's assume we sort or get latest.
    # MetricDataResults[0]['Timestamps'] are descending by default. So index 0 is newest.
    
    floor_val = max(0.05 * med, 10.0) # minimal threshold
    
    z = abs(latest_val - med) / max(mad, floor_val)
    
    # In a real impl, we'd check z > 5 for 2 consecutive points. For MVP, we check latest.
    if z > 5:
        incident_id = f"inc_{int(now)}"
        # Open incident
        try:
            ddb.put_item(
                TableName=INCIDENTS_TABLE,
                Item={
                    "pk": {"S": incident_id},
                    "status": {"S": "open"},
                    "slo": {"S": "checkout.p99"},
                    "created_at": {"N": str(now)},
                    "z_score": {"N": str(z)}
                },
                ConditionExpression="attribute_not_exists(pk)"
            )
            print(f"Opened incident {incident_id}")
        except Exception as e:
            print(f"Failed to open incident: {e}")
            
    return {"status": "ok", "z": z}
