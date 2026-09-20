"""Token-bucket rate limiting, shared by every local HTTP surface (the demo
app's own endpoints, the control-api, and the Bedrock Haiku call in
agents/bedrock_client.py) so "rate limit everything, including the model
call" is one implementation instead of three copies.

Deliberately in-process and dependency-free (no Redis): this project runs as
a handful of single-process local services, and a real deployment would size
this per Lambda concurrency model anyway, so an in-memory bucket is the
honest scope here, not a shortcut.
"""
from __future__ import annotations

import threading
import time
from typing import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse


class TokenBucket:
    """Classic token bucket: `capacity` tokens, refilled at `refill_per_s`
    tokens/second. `allow()` is the only method that mutates state and is
    thread-safe, since FastAPI's threadpool and the watchdog thread both
    call into limiters concurrently."""

    def __init__(self, capacity: int, refill_per_s: float) -> None:
        self.capacity = capacity
        self.refill_per_s = refill_per_s
        self._tokens = float(capacity)
        self._last = time.monotonic()
        self._lock = threading.Lock()

    def allow(self, cost: float = 1.0) -> tuple[bool, float]:
        """Returns (allowed, retry_after_s). retry_after_s is 0 when allowed."""
        with self._lock:
            now = time.monotonic()
            elapsed = now - self._last
            self._last = now
            self._tokens = min(self.capacity, self._tokens + elapsed * self.refill_per_s)
            if self._tokens >= cost:
                self._tokens -= cost
                return True, 0.0
            deficit = cost - self._tokens
            if self.refill_per_s <= 0:
                return False, float("inf")
            return False, deficit / self.refill_per_s


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Per-client-IP token bucket for a whole FastAPI app. A separate bucket
    per remote address so one noisy visitor can't starve everyone else
    trying the demo at the same time."""

    def __init__(
        self,
        app,
        capacity: int = 20,
        refill_per_s: float = 5.0,
        key_func: Callable[[Request], str] | None = None,
    ) -> None:
        super().__init__(app)
        self.capacity = capacity
        self.refill_per_s = refill_per_s
        self.key_func = key_func or (lambda r: r.client.host if r.client else "unknown")
        self._buckets: dict[str, TokenBucket] = {}
        self._buckets_lock = threading.Lock()

    def _bucket_for(self, key: str) -> TokenBucket:
        with self._buckets_lock:
            bucket = self._buckets.get(key)
            if bucket is None:
                bucket = TokenBucket(self.capacity, self.refill_per_s)
                self._buckets[key] = bucket
            return bucket

    async def dispatch(self, request: Request, call_next):
        key = self.key_func(request)
        allowed, retry_after = self._bucket_for(key).allow()
        if not allowed:
            return JSONResponse(
                status_code=429,
                content={
                    "error": "rate_limited",
                    "detail": f"Too many requests. Retry after {retry_after:.1f}s.",
                    "retry_after_s": round(retry_after, 1),
                },
                headers={"Retry-After": str(int(retry_after) + 1)},
            )
        return await call_next(request)
