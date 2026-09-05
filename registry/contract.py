"""Reading a real CapabilityContract document, as the ecosystem's Skills actually publish
it today - not the full aspirational shape docs/SPEC.md section 1 sketches. See
docs/POC_CAPABILITY_CONTRACT.md for the proof-of-concept that established what "actually
publish" means here, across all 10 audited Skills' real `contract`/`skill` CLI output."""
from __future__ import annotations

from typing import Any, Dict, List

LIFECYCLES = ("PROPOSED", "EXPERIMENTAL", "STABLE", "DEPRECATED", "RETIRED")


class ContractError(ValueError):
    """A contract document, or one of its `provides` entries, does not have a shape any
    Skill in the ecosystem actually publishes."""


def skill_identity(doc: Dict[str, Any]) -> str:
    """The identifying skill id of a contract document.

    Three real shapes exist today (docs/POC_CAPABILITY_CONTRACT.md Finding 5/9): a flat
    `skill_id` (most Skills), a flat `id` with no `skill_id` at all (transcription-skill),
    or a nested `skill.id` (ffmpeg-skill, whose contract nests skill metadata under a
    `skill` sub-object instead of flat top-level fields - Finding 7). Checked in that
    order because several Skills publish both `skill_id` and `id` redundantly, in which
    case `skill_id` is the one every other Skill treats as canonical.
    """
    if isinstance(doc.get("skill_id"), str) and doc["skill_id"]:
        return doc["skill_id"]
    skill = doc.get("skill")
    if isinstance(skill, dict) and isinstance(skill.get("id"), str) and skill["id"]:
        return skill["id"]
    if isinstance(doc.get("id"), str) and doc["id"]:
        return doc["id"]
    raise ContractError("contract document has none of skill_id, skill.id, or id")


def validate_provides_entry(entry: Any) -> List[str]:
    """Problems with one `provides[]` entry (empty list = valid).

    Checks only the three fields every real `provides` entry in the ecosystem actually
    carries today: `id`, `lifecycle`, `tool_id`. Does not check the much larger
    aspirational per-capability shape docs/SPEC.md section 1 sketches (`input_schema`,
    `output_schema`, `security.forbidden_keys`, ...) - no Skill publishes that shape yet,
    so requiring it here would reject every real contract in the ecosystem. Extra,
    Skill-specific fields (`operation`, `element_type`, `kind`, `checks`) are permitted
    and simply ignored.
    """
    if not isinstance(entry, dict):
        return ["entry is not an object"]
    problems: List[str] = []
    for key in ("id", "tool_id"):
        if not isinstance(entry.get(key), str) or not entry[key]:
            problems.append(f"missing or non-string {key!r}")
    if entry.get("lifecycle") not in LIFECYCLES:
        problems.append(f"lifecycle must be one of {LIFECYCLES}, got {entry.get('lifecycle')!r}")
    return problems


def extract_provides(doc: Dict[str, Any]) -> List[Dict[str, Any]]:
    """The document's `provides` list.

    A Skill that has not adopted `provides` yet returns []; that is not an error here -
    docs/ECOSYSTEM_CHANGELOG.md records which Skills currently publish it and which do
    not (as of this writing, every audited Skill does, via open PRs not yet merged).
    """
    provides = doc.get("provides", [])
    if not isinstance(provides, list):
        raise ContractError("'provides' must be a list")
    return provides
