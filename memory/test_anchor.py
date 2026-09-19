from memory.anchor import anchor_entities


def test_known_service_name_is_anchored() -> None:
    entities = anchor_entities("We restarted payments-api during the batch window.")
    assert entities == ["ecs/payments-api"]


def test_multiple_known_services_preserve_order() -> None:
    entities = anchor_entities("cart-api called payments-api during checkout.")
    assert entities == ["ecs/cart-api", "ecs/payments-api"]


def test_arn_is_anchored_verbatim() -> None:
    arn = "arn:aws:ecs:us-east-1:123456789012:service/demo/payments-api"
    entities = anchor_entities(f"Rolled back {arn} to revision 11.")
    assert arn in entities


def test_no_matches_returns_empty_list() -> None:
    assert anchor_entities("This paragraph mentions nothing relevant at all.") == []


def test_duplicate_mentions_are_deduplicated() -> None:
    entities = anchor_entities("payments-api, payments-api, payments-api")
    assert entities == ["ecs/payments-api"]
