from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
import requests
import time
from aws_xray_sdk.core import xray_recorder
from aws_xray_sdk.ext.fastapi.middleware import XRayMiddleware
from pydantic import BaseModel
import random

app = FastAPI()

xray_recorder.configure(service='web-api')
app.add_middleware(XRayMiddleware, recorder=xray_recorder)

PAYMENTS_API_URL = os.environ.get("PAYMENTS_API_URL", "http://localhost:8081")

class ChaosRequest(BaseModel):
    latency_ms: int = 0
    error_rate: float = 0.0
    pool_leak: bool = False

@app.post("/api/chaos")
def set_chaos(req: ChaosRequest):
    try:
        resp = requests.post(f"{PAYMENTS_API_URL}/chaos", json=req.model_dump(), timeout=5)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@app.get("/api/health")
def health():
    return {"status": "ok"}

@app.get("/api/buy")
def buy():
    # Call payments API
    try:
        resp = requests.get(f"{PAYMENTS_API_URL}/checkout", timeout=5)
        resp.raise_for_status()
        return {"status": "success", "payments_latency": resp.json().get("latency")}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

# Adding intentional bugs the server can find
@app.get("/api/bug_memory_leak")
def memory_leak():
    if not hasattr(app, "leak"):
        app.leak = []
    app.leak.append("A" * 1024 * 1024 * 10) # 10MB per request
    return {"status": "leaked 10MB", "total_leaked_mb": len(app.leak) * 10}

@app.get("/api/bug_cpu_spike")
def cpu_spike():
    # Simulate high CPU load
    end_time = time.time() + 2
    while time.time() < end_time:
        pass
    return {"status": "cpu spiked for 2 seconds"}

@app.get("/api/bug_flaky_endpoint")
def flaky_endpoint():
    if random.random() < 0.5:
        raise HTTPException(status_code=500, detail="Random internal error occurred")
    return {"status": "success"}

# Serve the portfolio website
app.mount("/", StaticFiles(directory="static", html=True), name="static")
