from fastapi import FastAPI, Request, Response, HTTPException
import boto3
import os
import time
import random
import logging
from aws_xray_sdk.core import xray_recorder
from aws_xray_sdk.ext.fastapi.middleware import XRayMiddleware
from pydantic import BaseModel

app = FastAPI()

# Instrument X-Ray
xray_recorder.configure(service='payments-api')
app.add_middleware(XRayMiddleware, recorder=xray_recorder)

# Chaos state
chaos_config = {
    "latency_ms": 0,
    "error_rate": 0.0,
    "pool_leak": False
}

ddb = boto3.resource('dynamodb', region_name=os.environ.get("AWS_REGION", "us-east-1"))
table_name = os.environ.get("DYNAMODB_TABLE", "lockstep-demo-table")
table = ddb.Table(table_name)

class ChaosRequest(BaseModel):
    latency_ms: int = 0
    error_rate: float = 0.0
    pool_leak: bool = False

@app.post("/chaos")
def set_chaos(req: ChaosRequest):
    chaos_config["latency_ms"] = req.latency_ms
    chaos_config["error_rate"] = req.error_rate
    chaos_config["pool_leak"] = req.pool_leak
    return chaos_config

@app.get("/checkout")
def checkout():
    start_time = time.time()
    
    # 1. Apply chaos
    if chaos_config["pool_leak"]:
        time.sleep(2.0) # simulate pool wait
    elif chaos_config["latency_ms"] > 0:
        time.sleep(chaos_config["latency_ms"] / 1000.0)
        
    if random.random() < chaos_config["error_rate"]:
        raise HTTPException(status_code=500, detail="Chaos error")

    # 2. Fake DDB operation
    try:
        table.put_item(Item={"pk": f"txn_{int(time.time()*1000)}", "status": "success"})
    except Exception as e:
        logging.error(f"DDB Error: {e}")
    
    latency_ms = int((time.time() - start_time) * 1000)
    
    # Custom EMF logging for ADOT
    # We will log to stdout using CloudWatch EMF format
    emf_log = {
        "_aws": {
            "Timestamp": int(time.time() * 1000),
            "CloudWatchMetrics": [
                {
                    "Namespace": "Lockstep/App",
                    "Dimensions": [["Service"]],
                    "Metrics": [
                        {"Name": "checkout.p99", "Unit": "Milliseconds"},
                        {"Name": "errors", "Unit": "Count"},
                        {"Name": "pool_wait_ms", "Unit": "Milliseconds"}
                    ]
                }
            ]
        },
        "Service": "payments-api",
        "checkout.p99": latency_ms,
        "errors": 1 if chaos_config["error_rate"] > 0 and random.random() < chaos_config["error_rate"] else 0,
        "pool_wait_ms": 2000 if chaos_config["pool_leak"] else 0
    }
    print(json.dumps(emf_log))
    
    return {"status": "ok", "latency": latency_ms}

import json
