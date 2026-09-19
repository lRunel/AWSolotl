"""Round-trip tests for the frozen I0 contracts (see ../references/contracts.md
in the lockstep-recall skill). Every schema needs one passing and one failing
sample -- an untested schema is a claim, not a control, same as an invariant.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator
from referencing import Registry, Resource

SCHEMAS_DIR = Path(__file__).parent
SAMPLES_DIR = SCHEMAS_DIR / "samples"

TOP_LEVEL_SCHEMAS = sorted(SCHEMAS_DIR.glob("*.schema.json"))
TOOL_ARG_SCHEMAS = sorted((SCHEMAS_DIR / "tools").glob("*.schema.json"))


def _load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _build_registry() -> Registry:
    pairs = []
    for schema_path in TOP_LEVEL_SCHEMAS + TOOL_ARG_SCHEMAS:
        contents = _load(schema_path)
        pairs.append((contents["$id"], Resource.from_contents(contents)))
    return Registry().with_resources(pairs)


REGISTRY = _build_registry()


@pytest.mark.parametrize(
    "schema_path", TOP_LEVEL_SCHEMAS + TOOL_ARG_SCHEMAS, ids=lambda p: p.name
)
def test_schema_document_is_well_formed(schema_path: Path) -> None:
    """Every schema file must itself be a valid draft 2020-12 document."""
    Draft202012Validator.check_schema(_load(schema_path))


def _schema_name(schema_path: Path) -> str:
    # "action_plan.schema.json" -> "action_plan"
    return schema_path.stem.removesuffix(".schema")


def _samples(schema_name: str, prefix: str) -> list[Path]:
    directory = SAMPLES_DIR / schema_name
    if not directory.exists():
        return []
    return sorted(directory.glob(f"{prefix}*.json"))


@pytest.mark.parametrize("schema_path", TOP_LEVEL_SCHEMAS, ids=lambda p: p.name)
def test_valid_samples_pass(schema_path: Path) -> None:
    schema = _load(schema_path)
    validator = Draft202012Validator(schema, registry=REGISTRY)
    name = _schema_name(schema_path)
    cases = _samples(name, "valid")
    assert cases, f"{name} has no valid sample under schemas/samples/{name}/"
    for case in cases:
        instance = _load(case)
        errors = list(validator.iter_errors(instance))
        assert not errors, f"{case} should be valid but failed: {errors}"


@pytest.mark.parametrize("schema_path", TOP_LEVEL_SCHEMAS, ids=lambda p: p.name)
def test_invalid_samples_fail(schema_path: Path) -> None:
    schema = _load(schema_path)
    validator = Draft202012Validator(schema, registry=REGISTRY)
    name = _schema_name(schema_path)
    cases = _samples(name, "invalid")
    assert cases, f"{name} has no invalid sample under schemas/samples/{name}/"
    for case in cases:
        instance = _load(case)
        errors = list(validator.iter_errors(instance))
        assert errors, f"{case} should be invalid but passed validation"
