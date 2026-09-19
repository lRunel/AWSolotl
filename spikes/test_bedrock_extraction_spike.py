"""Honest gate for Spike 2. This test is skipped, not faked, when Bedrock
model access has not been granted yet -- see docs/agents.md for the current
status. Do not change this to assume success; the whole point of the spike
is measuring the real acceptance rate.
"""
from __future__ import annotations

import boto3
import pytest
from botocore.exceptions import NoCredentialsError, ClientError

from spikes.bedrock_rule_extraction_spike import run_five_times


def _bedrock_reachable() -> bool:
    try:
        boto3.client("bedrock-runtime", region_name="us-east-1").converse(
            modelId="anthropic.claude-3-5-sonnet-20241022-v2:0",
            messages=[{"role": "user", "content": [{"text": "ping"}]}],
            inferenceConfig={"maxTokens": 1},
        )
        return True
    except NoCredentialsError:
        return False
    except ClientError:
        # Reachable but e.g. access-denied/model-not-enabled -- still "no",
        # but for a different, equally honest reason.
        return False
    except Exception:
        return False


@pytest.mark.skipif(
    not _bedrock_reachable(),
    reason=(
        "No AWS credentials / Bedrock Claude access configured in this "
        "environment. Person A's I0 bootstrap task grants this; re-run once "
        "it lands."
    ),
)
def test_five_out_of_five_valid_json_on_closed_vocabulary() -> None:
    results = run_five_times()
    accepted = sum(1 for r in results if r.valid)
    print(f"acceptance rate: {accepted}/5")
    assert accepted == 5, "log the real rate even on failure -- do not repair or retry silently"
