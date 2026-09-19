from cedarpy import Decision

from spikes.cedar_lambda_spike import check


def test_forbid_overrides_permit_during_batch_window() -> None:
    result = check(in_batch_window=True)
    assert result.decision == Decision.Deny


def test_permit_applies_outside_batch_window() -> None:
    result = check(in_batch_window=False)
    assert result.decision == Decision.Allow
