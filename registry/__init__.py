"""Reference Capability registry (docs/ROADMAP.md Phase 1).

CURRENT / IMPLEMENTED: load a real CapabilityContract document's `provides` list (the
shape every Skill in the ecosystem that has adopted it actually publishes today - see
docs/ECOSYSTEM_CHANGELOG.md for which Skills that is, as of this writing all 10 audited
Skills via open PRs), register it, answer "who provides Capability X", detect real
collisions (docs/CAPABILITY_MATRIX.md section 8a's qc-skill/media-analysis-skill pair),
and apply docs/CAPABILITY_MODEL.md's 3-tier collision-resolution policy in code.

The full aspirational `provides[]` entry shape docs/SPEC.md section 1 sketches
(input_schema, output_schema, security.forbidden_keys per capability) is now formally
documented as a standalone JSON Schema (`capability_contract.schema.json`, `load_schema()`
below) -- but no Skill in the ecosystem publishes that richer shape yet, so this package's
own Python-level validation (`validate_provides_entry`) still checks only what is
actually real today (`id`, `lifecycle`, `tool_id`), matching the schema's own narrow
`required` list.

NOT IMPLEMENTED here (see docs/ROADMAP.md for where each belongs): executing a Skill's
CLI/process, a persisted or networked registry, Phase 3's default-provider *configuration*
mechanism (this library can apply a default choice once given one; deciding what that
default should be, and where it is configured, is Phase 3), and validating a document
against the schema at runtime (that needs a real JSON Schema implementation, which this
package deliberately does not depend on -- see registry/tests/test_schema.py).
"""
from .contract import ContractError, extract_provides, skill_identity, validate_provides_entry
from .registry import CapabilityRegistry, CollisionError, ProviderRegistration
from .schema import SCHEMA_PATH, load_schema

__all__ = [
    "SCHEMA_PATH",
    "CapabilityRegistry",
    "CollisionError",
    "ContractError",
    "ProviderRegistration",
    "extract_provides",
    "load_schema",
    "skill_identity",
    "validate_provides_entry",
]
