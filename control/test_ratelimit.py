from __future__ import annotations

from control.ratelimit import TokenBucket


def test_bucket_allows_up_to_capacity() -> None:
    bucket = TokenBucket(capacity=3, refill_per_s=0.0)
    assert bucket.allow() == (True, 0.0)
    assert bucket.allow() == (True, 0.0)
    assert bucket.allow() == (True, 0.0)
    allowed, retry_after = bucket.allow()
    assert allowed is False
    assert retry_after == float("inf")  # refill_per_s=0 -> would never refill


def test_bucket_refills_over_time(monkeypatch) -> None:
    bucket = TokenBucket(capacity=1, refill_per_s=1.0)
    assert bucket.allow() == (True, 0.0)
    allowed, retry_after = bucket.allow()
    assert allowed is False
    assert retry_after > 0
