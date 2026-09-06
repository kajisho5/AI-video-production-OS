"""Loader for capability_contract.schema.json (docs/ROADMAP.md Phase 1, item 1).

Stdlib only, matching this package's "small, dependency-free" design (registry/README.md).
Does not itself validate a document against the schema -- that needs a real JSON Schema
implementation (e.g. the `jsonschema` PyPI package), which this package deliberately does
not depend on. See registry/tests/test_schema.py for schema validation, which uses
`jsonschema` as an optional, skip-if-absent test dependency only (the same pattern
test_conformance_live.py already uses for a live `qc-skill` process).
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict

SCHEMA_PATH = Path(__file__).parent / "capability_contract.schema.json"


def load_schema() -> Dict[str, Any]:
    """Parse and return capability_contract.schema.json."""
    with SCHEMA_PATH.open(encoding="utf-8") as f:
        return json.load(f)
