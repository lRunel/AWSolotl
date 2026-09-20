import json
import hashlib
import boto3
import os
import time

ddb = boto3.client('dynamodb', region_name=os.environ.get("AWS_REGION", "us-east-1"))
s3 = boto3.client('s3', region_name=os.environ.get("AWS_REGION", "us-east-1"))

TABLE_NAME = os.environ.get("LEDGER_TABLE", "lockstep-ledger")
BUCKET_NAME = os.environ.get("LEDGER_BUCKET", "lockstep-ledger-bucket")

def canonical_json(data: dict) -> str:
    return json.dumps(data, separators=(',', ':'), sort_keys=True, ensure_ascii=False)

def hash_record(record: dict) -> str:
    # Hash everything except the "hash" field itself
    to_hash = {k: v for k, v in record.items() if k != "hash"}
    return hashlib.sha256(canonical_json(to_hash).encode('utf-8')).hexdigest()

def get_head():
    try:
        resp = ddb.get_item(
            TableName=TABLE_NAME,
            Key={"pk": {"S": "head"}}
        )
        if "Item" in resp:
            return int(resp["Item"]["last_n"]["N"]), resp["Item"]["last_hash"]["S"]
    except Exception:
        pass
    return 0, "0000000000000000000000000000000000000000000000000000000000000000"

def append_record(incident_id: str, action: dict, gates: dict, causal_basis: dict, diff: dict, result: str, actor: str) -> int:
    last_n, prev_hash = get_head()
    n = last_n + 1
    
    record = {
        "record_id": n,
        "prev_hash": prev_hash,
        "incident_id": incident_id,
        "action": action,
        "gates": gates,
        "causal_basis": causal_basis,
        "diff": diff,
        "result": result,
        "actor": actor
    }
    
    record_hash = hash_record(record)
    record["hash"] = record_hash
    
    # TransactWriteItems to serialize writers
    try:
        ddb.transact_write_items(
            TransactItems=[
                {
                    "Put": {
                        "TableName": TABLE_NAME,
                        "Item": {
                            "pk": {"S": str(n)},
                            "data": {"S": canonical_json(record)}
                        },
                        "ConditionExpression": "attribute_not_exists(pk)"
                    }
                },
                {
                    "Update": {
                        "TableName": TABLE_NAME,
                        "Key": {"pk": {"S": "head"}},
                        "UpdateExpression": "SET last_n = :n, last_hash = :h",
                        "ConditionExpression": "attribute_not_exists(last_n) OR last_n = :prev_n",
                        "ExpressionAttributeValues": {
                            ":n": {"N": str(n)},
                            ":h": {"S": record_hash},
                            ":prev_n": {"N": str(last_n)}
                        }
                    }
                }
            ]
        )
    except ddb.exceptions.TransactionCanceledException as e:
        # Fork or race condition detected
        raise Exception(f"Ledger append failed due to concurrent write or race: {e}")
        
    # Copy to S3 Object Lock bucket
    # S3 Object Lock in COMPLIANCE or GOVERNANCE mode prevents deletion
    s3_key = f"{time.strftime('%Y-%m-%d')}/{n}.json"
    import datetime
    retain_until = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=365)
    s3.put_object(
        Bucket=BUCKET_NAME,
        Key=s3_key,
        Body=canonical_json(record),
        ContentType="application/json",
        ObjectLockMode="COMPLIANCE",
        ObjectLockRetainUntilDate=retain_until
    )
    
    return n

def verify_chain():
    last_n, last_hash = get_head()
    if last_n == 0:
        return {"valid": True, "records_checked": 0}
        
    prev_h = "0000000000000000000000000000000000000000000000000000000000000000"
    for i in range(1, last_n + 1):
        resp = ddb.get_item(TableName=TABLE_NAME, Key={"pk": {"S": str(i)}})
        if "Item" not in resp:
            return {"valid": False, "reason": f"Record {i} missing"}
            
        record_str = resp["Item"]["data"]["S"]
        record = json.loads(record_str)
        
        if record["prev_hash"] != prev_h:
            return {"valid": False, "reason": f"Record {i} prev_hash mismatch"}
            
        computed_hash = hash_record(record)
        if record["hash"] != computed_hash:
            return {"valid": False, "reason": f"Record {i} hash tampered"}
            
        prev_h = computed_hash
        
    if prev_h != last_hash:
         return {"valid": False, "reason": "Head hash mismatch"}
         
    return {"valid": True, "records_checked": last_n}

# Lambda handler for GET /ledger/verify
def verify_handler(event, context):
    try:
        result = verify_chain()
        return {
            "statusCode": 200,
            "body": json.dumps(result)
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }
