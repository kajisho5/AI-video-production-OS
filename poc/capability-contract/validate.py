#!/usr/bin/env python3
"""
Minimal, zero-dependency validator for the proposed CapabilityContract shape
(docs/SPEC.md section 1 / schema.json in this directory).

Deliberately hand-rolled rather than depending on the `jsonschema` package:
this matches the convention every audited Skill repo already uses for its own
request/response validation (media-analysis-skill, subtitle-skill, qc-skill,
etc. all ship a small hand-written JSON-Schema-subset checker rather than a
third-party dependency), and `jsonschema` is not installed in this
environment, so pip-installing it just to validate five files would be adding
infrastructure this PoC is specifically supposed to avoid until proven
necessary.

This checks only what schema.json declares: presence/type of required
top-level fields, and, if `provides` is present and is a list, that each item
is shaped like a Capability entry. It intentionally does NOT try to coerce or
interpret the real ecosystem's existing contract shapes into this one — the
goal is to report the mismatch honestly, not hide it.

v2 (five Skills): the field names below reflect the SPEC.md amendment this
PoC itself produced (skill_version -> version, capabilities -> provides).
transcription-skill's real contract uses `id`, not `skill_id`, for its own
identifier — that mismatch is intentionally left in this validator's
required-field list (not special-cased away) so it shows up as a finding
below, the same as every other mismatch.
"""
import json
import sys
from pathlib import Path

REQUIRED_TOP_LEVEL = {
    "skill_id": str,
    "version": str,
    "contract_version": (str, int),
    "provides": list,
}

TYPE_NAMES = {str: "str", list: "list", (str, int): "str or int"}

CAPABILITY_LIFECYCLE = {"PROPOSED", "EXPERIMENTAL", "STABLE", "DEPRECATED", "RETIRED"}


def validate(doc: dict) -> list[str]:
    problems = []
    for field, expected_type in REQUIRED_TOP_LEVEL.items():
        if field not in doc:
            problems.append(f"MISSING required field: {field!r}")
            continue
        if not isinstance(doc[field], expected_type):
            actual = doc[field]
            shown = (
                repr(actual)
                if not isinstance(actual, (dict, list))
                else f"<{type(actual).__name__} of len {len(actual)}>"
            )
            problems.append(
                f"WRONG TYPE for {field!r}: expected {TYPE_NAMES.get(expected_type, expected_type)}, "
                f"got {type(actual).__name__} (value: {shown})"
            )

    provides = doc.get("provides")
    if isinstance(provides, list):
        for i, entry in enumerate(provides):
            if not isinstance(entry, dict):
                problems.append(
                    f"provides[{i}]: expected an object with an 'id' field, "
                    f"got {type(entry).__name__}: {entry!r}"
                )
                continue
            if "id" not in entry:
                problems.append(f"provides[{i}]: missing required 'id' field")
            lifecycle = entry.get("lifecycle")
            if lifecycle is not None and lifecycle not in CAPABILITY_LIFECYCLE:
                problems.append(
                    f"provides[{i}].lifecycle: {lifecycle!r} is not one of "
                    f"{sorted(CAPABILITY_LIFECYCLE)}"
                )

    if not problems:
        problems.append("(no problems found — this contract already matches the proposed shape)")
    return problems


def main():
    here = Path(__file__).parent
    assert (here / "schema.json").exists(), "schema.json must exist alongside this script"

    targets = [
        here / "qc-skill.contract.json",
        here / "media-analysis-skill.contract.json",
        here / "video-editing-skill.contract.json",
        here / "audio-production-skill.contract.json",
        here / "transcription-skill.contract.json",
        here / "ffmpeg-skill.contract.json",
        here / "color-grading-skill.contract.json",
        here / "motion-graphics-skill.contract.json",
        here / "subtitle-skill.contract.json",
        here / "thumbnail-skill.contract.json",
    ]

    exit_code = 0
    for target in targets:
        print(f"\n=== {target.name} ===")
        if not target.exists():
            print(f"  SKIPPED: file not found ({target})")
            exit_code = 1
            continue
        doc = json.loads(target.read_text())
        problems = validate(doc)
        for p in problems:
            print(f"  - {p}")
        if any(not p.startswith("(no problems") for p in problems):
            exit_code = 1

    sys.exit(exit_code)


if __name__ == "__main__":
    main()
