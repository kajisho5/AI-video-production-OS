"""Tests for capability_contract.schema.json (docs/ROADMAP.md Phase 1, item 1).

`load_schema()` itself is stdlib-only and always tested. Actually validating a document
against the schema needs a real JSON Schema implementation; this package deliberately
stays dependency-free (registry/README.md), so those tests use the `jsonschema` PyPI
package as an optional dependency and skip themselves when it is not installed -- the
same pattern test_conformance_live.py already uses for a live `qc-skill` process.
"""
from __future__ import annotations

import copy
import json
import unittest
from pathlib import Path

from ..schema import SCHEMA_PATH, load_schema

try:
    import jsonschema

    HAVE_JSONSCHEMA = True
except ImportError:
    HAVE_JSONSCHEMA = False

FIXTURES_DIR = Path(__file__).parent / "fixtures"
REAL_FIXTURE_FILES = sorted(FIXTURES_DIR.glob("*.provides.json"))


class LoadSchemaTests(unittest.TestCase):
    def test_schema_file_exists_and_is_valid_json(self) -> None:
        self.assertTrue(SCHEMA_PATH.is_file())
        with SCHEMA_PATH.open(encoding="utf-8") as f:
            json.load(f)  # raises if not valid JSON

    def test_load_schema_returns_the_same_document(self) -> None:
        schema = load_schema()
        self.assertEqual(schema["title"], "CapabilityContract")
        self.assertIn("provides", schema["properties"])


@unittest.skipUnless(HAVE_JSONSCHEMA, "jsonschema package not installed")
class SchemaIsValidDraft202012Tests(unittest.TestCase):
    def test_schema_itself_is_a_valid_draft_2020_12_schema(self) -> None:
        jsonschema.Draft202012Validator.check_schema(load_schema())


@unittest.skipUnless(HAVE_JSONSCHEMA, "jsonschema package not installed")
class RealFixturesValidateTests(unittest.TestCase):
    """Every real captured `provides` document in registry/tests/fixtures/ must validate
    against the schema -- proof this is not just a document but a schema that actually
    accepts today's real, minimal contracts (docs/ROADMAP.md Phase 1 item 1's own goal)."""

    def setUp(self) -> None:
        self.validator = jsonschema.Draft202012Validator(load_schema())

    def test_every_real_fixture_validates(self) -> None:
        self.assertGreaterEqual(len(REAL_FIXTURE_FILES), 5, "fixtures directory looks empty")
        for path in REAL_FIXTURE_FILES:
            with self.subTest(fixture=path.name):
                with path.open(encoding="utf-8") as f:
                    doc = json.load(f)
                errors = list(self.validator.iter_errors(doc))
                self.assertEqual(errors, [], f"{path.name} failed schema validation: {errors}")


@unittest.skipUnless(HAVE_JSONSCHEMA, "jsonschema package not installed")
class SchemaRejectsInvalidDocumentsTests(unittest.TestCase):
    """The schema must actually constrain something -- not merely accept anything handed
    to it. Each case here takes a real, valid fixture and breaks exactly one rule."""

    def setUp(self) -> None:
        self.validator = jsonschema.Draft202012Validator(load_schema())
        with (FIXTURES_DIR / "qc-skill.provides.json").open(encoding="utf-8") as f:
            self.valid_doc = json.load(f)

    def _errors(self, doc):
        return list(self.validator.iter_errors(doc))

    def test_sanity_the_real_fixture_it_is_based_on_is_valid(self) -> None:
        self.assertEqual(self._errors(self.valid_doc), [])

    def test_rejects_a_document_with_no_skill_identity_at_all(self) -> None:
        doc = copy.deepcopy(self.valid_doc)
        del doc["skill_id"]
        self.assertTrue(self._errors(doc))

    def test_rejects_a_provides_entry_missing_lifecycle(self) -> None:
        doc = copy.deepcopy(self.valid_doc)
        del doc["provides"][0]["lifecycle"]
        self.assertTrue(self._errors(doc))

    def test_rejects_a_provides_entry_with_an_invalid_lifecycle_value(self) -> None:
        doc = copy.deepcopy(self.valid_doc)
        doc["provides"][0]["lifecycle"] = "SHIPPED"  # not one of docs/SPEC.md's five values
        self.assertTrue(self._errors(doc))

    def test_rejects_a_provides_entry_missing_tool_id(self) -> None:
        doc = copy.deepcopy(self.valid_doc)
        del doc["provides"][0]["tool_id"]
        self.assertTrue(self._errors(doc))

    def test_accepts_extra_skill_specific_fields_on_a_provides_entry(self) -> None:
        # registry/contract.py: extra fields like `checks` are permitted and ignored.
        doc = copy.deepcopy(self.valid_doc)
        doc["provides"][0]["totally_new_field_no_skill_has_used_before"] = True
        self.assertEqual(self._errors(doc), [])

    def test_accepts_the_transcription_skill_flat_id_identity_shape(self) -> None:
        with (FIXTURES_DIR / "transcription-skill.provides.json").open(encoding="utf-8") as f:
            doc = json.load(f)
        self.assertEqual(self._errors(doc), [])

    def test_accepts_the_ffmpeg_skill_nested_skill_id_identity_shape(self) -> None:
        with (FIXTURES_DIR / "ffmpeg-skill.provides.json").open(encoding="utf-8") as f:
            doc = json.load(f)
        self.assertEqual(self._errors(doc), [])
