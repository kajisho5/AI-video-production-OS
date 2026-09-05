"""Reference Capability registry (docs/ROADMAP.md Phase 1).

CURRENT / IMPLEMENTED: load a real CapabilityContract document's `provides` list (the
shape every Skill in the ecosystem that has adopted it actually publishes today - see
docs/ECOSYSTEM_CHANGELOG.md for which Skills that is, as of this writing all 10 audited
Skills via open PRs), register it, answer "who provides Capability X", detect real
collisions (docs/CAPABILITY_MATRIX.md section 8a's qc-skill/media-analysis-skill pair),
and apply docs/CAPABILITY_MODEL.md's 3-tier collision-resolution policy in code.

NOT IMPLEMENTED here (see docs/ROADMAP.md for where each belongs): executing a Skill's
CLI/process, a persisted or networked registry, Phase 3's default-provider *configuration*
mechanism (this library can apply a default choice once given one; deciding what that
default should be, and where it is configured, is Phase 3), and the full aspirational
`capabilities[]` shape docs/SPEC.md section 1 sketches (input_schema, output_schema,
security.forbidden_keys per capability) - no Skill in the ecosystem publishes that shape
today, so validating against it here would check something that does not exist.
"""
from .contract import ContractError, extract_provides, skill_identity, validate_provides_entry
from .registry import CapabilityRegistry, CollisionError, ProviderRegistration

__all__ = [
    "CapabilityRegistry",
    "CollisionError",
    "ContractError",
    "ProviderRegistration",
    "extract_provides",
    "skill_identity",
    "validate_provides_entry",
]
