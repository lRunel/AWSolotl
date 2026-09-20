"""Rate-limited Bedrock Claude Haiku client.

This is the one place a real model call would happen in the agent path
(the router in agents/router.py and the plan assembly in
agents/plan_builder.py are both deliberately model-free -- see their
docstrings). docs/AGENTS.md is explicit that this environment has no
Bedrock access, so `propose_plan_text` here does exactly two things:

1. Enforces a rate limit in front of the call -- the same TokenBucket used
   for every HTTP surface in this project (control/ratelimit.py) -- because
   an autonomous loop that can trigger its own incident response must not
   be able to hammer a paid model endpoint once, whether that loop is a
   real bug or a person mashing the "break it" button on the dashboard.
2. Tries a real `bedrock-runtime InvokeModel` call for
   `anthropic.claude-3-haiku-20240307-v1:0`, and falls back to a fixed,
   labeled canned response when Bedrock is unreachable (no credentials, no
   model access, or any other failure) -- the project's own documented cut
   line (references/iterations.md, cut order item 6: "cached responses ...
   client") for exactly this situation.

Nothing downstream trusts this call's output as policy: whatever text comes
back is advisory narration only, same trust level as any other Plane 2
output (design doc section 4.6) -- Gate 2 enforcement never reads this
module.
"""
from __future__ import annotations

import json
import logging
import os

from control.ratelimit import TokenBucket

logger = logging.getLogger("bedrock_client")

MODEL_ID = os.environ.get("BEDROCK_HAIKU_MODEL_ID", "anthropic.claude-3-haiku-20240307-v1:0")

# 5 calls/minute steady state, a small burst of 3 -- deliberately tight:
# this call exists for demo narration, not a production inference path.
_bucket = TokenBucket(capacity=3, refill_per_s=5 / 60)

_FALLBACK_TEXT = (
    "[cached response -- no live Bedrock access in this environment] "
    "Proposing the lowest-risk remediation available for this stage; see "
    "the ledger record's `gates` and `causal_basis` for the real, "
    "deterministic reasoning. This sentence is narration, not policy -- "
    "Gate 2 never reads it."
)


class RateLimited(Exception):
    def __init__(self, retry_after_s: float) -> None:
        self.retry_after_s = retry_after_s
        super().__init__(f"Bedrock Haiku call rate-limited, retry after {retry_after_s:.1f}s")


def propose_plan_text(prompt: str) -> dict:
    """Returns {"text": str, "source": "bedrock" | "fallback"}. Raises
    RateLimited if the bucket is empty -- callers decide whether to wait,
    queue, or fall back to the deterministic plan_builder path outright."""
    allowed, retry_after = _bucket.allow()
    if not allowed:
        raise RateLimited(retry_after)

    try:
        return {"text": _invoke_bedrock(prompt), "source": "bedrock"}
    except Exception as e:  # noqa: BLE001 -- any failure means "use the fallback"
        logger.info("Bedrock Haiku call unavailable (%s); using cached fallback text", e)
        return {"text": _FALLBACK_TEXT, "source": "fallback"}


def _invoke_bedrock(prompt: str) -> str:
    import boto3  # imported lazily so this module loads with no boto3-shaped side effects

    client = boto3.client("bedrock-runtime", region_name=os.environ.get("AWS_REGION", "us-east-1"))
    body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 200,
        "messages": [{"role": "user", "content": prompt}],
    }
    response = client.invoke_model(modelId=MODEL_ID, body=json.dumps(body))
    payload = json.loads(response["body"].read())
    return payload["content"][0]["text"]
