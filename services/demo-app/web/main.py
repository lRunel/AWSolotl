from fastapi import FastAPI, HTTPException
import os
import requests
import time
from aws_xray_sdk.core import xray_recorder
from aws_xray_sdk.ext.fastapi.middleware import XRayMiddleware

app = FastAPI()

xray_recorder.configure(service='web-api')
app.add_middleware(XRayMiddleware, recorder=xray_recorder)

PAYMENTS_API_URL = os.environ.get("PAYMENTS_API_URL", "http://localhost:8081")

@app.get("/")
def health():
    return {"status": "ok"}

@app.get("/buy")
def buy():
    # Call payments API
    try:
        resp = requests.get(f"{PAYMENTS_API_URL}/checkout", timeout=5)
        resp.raise_for_status()
        return {"status": "success", "payments_latency": resp.json().get("latency")}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
