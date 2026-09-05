"""In-memory reference Capability registry (docs/ROADMAP.md Phase 1, item 2).

Loads real CapabilityContract documents, answers "who provides Capability X", detects
collisions the way docs/CAPABILITY_MATRIX.md section 8a currently only shows by hand, and
applies docs/CAPABILITY_MODEL.md's 3-tier collision policy in code: Plan-time explicit
choice > default-provider policy > registry refusal - never a silent first-match.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from .contract import ContractError, extract_provides, skill_identity, validate_provides_entry


@dataclass(frozen=True)
class ProviderRegistration:
    """One Skill's registration of one Capability id, from one `provides[]` entry."""

    capability_id: str
    skill_id: str
    tool_id: str
    lifecycle: str
    source: Dict[str, Any] = field(compare=False)


class CollisionError(RuntimeError):
    """Raised by `CapabilityRegistry.resolve()` when two or more distinct Skills provide
    the same Capability id and neither an explicit choice nor a default-provider policy
    was given. This is docs/CAPABILITY_MODEL.md's 3-tier policy's third tier - registry
    refusal - never a silent first-match."""

    def __init__(self, capability_id: str, providers: List[ProviderRegistration]) -> None:
        self.capability_id = capability_id
        self.providers = providers
        skills = ", ".join(sorted(p.skill_id for p in providers))
        super().__init__(
            f"Capability {capability_id!r} has {len(providers)} independent Providers ({skills}) "
            "and no explicit choice or default-provider policy resolved it."
        )


class CapabilityRegistry:
    """Register real CapabilityContract documents' `provides` lists and query them.

    This is Phase 1's registry library, not Phase 3's collision-*resolution product*: it
    can apply an explicit or default choice once one is given (`resolve()`), and it
    detects a collision precisely (`is_collision()`, `collisions()`) - it does not decide
    what a Plan's explicit choice or a deployment's default-provider policy should be.
    """

    def __init__(self) -> None:
        self._by_capability: Dict[str, List[ProviderRegistration]] = {}

    def register_contract(self, doc: Dict[str, Any]) -> List[ProviderRegistration]:
        """Register every `provides[]` entry in `doc`. Returns the registrations added.
        Raises ContractError if the document has no resolvable skill identity, or if any
        `provides` entry is malformed (see `validate_provides_entry`)."""
        skill_id = skill_identity(doc)
        added: List[ProviderRegistration] = []
        for entry in extract_provides(doc):
            problems = validate_provides_entry(entry)
            if problems:
                raise ContractError(f"{skill_id}: invalid provides entry {entry!r}: {'; '.join(problems)}")
            reg = ProviderRegistration(
                capability_id=entry["id"], skill_id=skill_id, tool_id=entry["tool_id"],
                lifecycle=entry["lifecycle"], source=dict(entry),
            )
            self._by_capability.setdefault(reg.capability_id, []).append(reg)
            added.append(reg)
        return added

    def providers_of(self, capability_id: str) -> List[ProviderRegistration]:
        return list(self._by_capability.get(capability_id, []))

    def is_collision(self, capability_id: str) -> bool:
        """True when 2+ *distinct Skills* register this Capability id. A single Skill
        registering the same id twice (which would itself be a bug in that Skill's own
        `provides` list) is not treated as a collision by this check."""
        return len({p.skill_id for p in self.providers_of(capability_id)}) > 1

    def collisions(self) -> Dict[str, List[ProviderRegistration]]:
        """Every Capability id with 2+ independent Providers, across everything
        registered so far."""
        return {cid: regs for cid, regs in self._by_capability.items() if len({r.skill_id for r in regs}) > 1}

    def resolve(
        self, capability_id: str, explicit_skill_id: Optional[str] = None, default_skill_id: Optional[str] = None,
    ) -> ProviderRegistration:
        """docs/CAPABILITY_MODEL.md's 3-tier collision policy, in order:

        1. `explicit_skill_id` - a Plan-time explicit choice; wins whenever given, even
           for a non-colliding Capability (an explicit choice always applies, since a
           caller may want to pin a Skill regardless of collision status).
        2. `default_skill_id` - a deployment's default-provider policy, applied only
           when there was no explicit choice.
        3. `CollisionError` - registry refusal. Raised only when the Capability actually
           has 2+ independent Providers and neither of the above resolved it; a
           non-colliding Capability with exactly one Provider is returned directly and
           never needs a choice.

        Raises `KeyError` if nobody has registered `capability_id` at all, or if a given
        `explicit_skill_id`/`default_skill_id` does not actually provide it.
        """
        providers = self.providers_of(capability_id)
        if not providers:
            raise KeyError(f"no registered Provider for Capability {capability_id!r}")
        if explicit_skill_id is not None:
            return self._pick(capability_id, providers, explicit_skill_id, "explicit_skill_id")
        if not self.is_collision(capability_id):
            return providers[0]
        if default_skill_id is not None:
            return self._pick(capability_id, providers, default_skill_id, "default_skill_id")
        raise CollisionError(capability_id, providers)

    @staticmethod
    def _pick(capability_id: str, providers: List[ProviderRegistration], skill_id: str, arg_name: str) -> ProviderRegistration:
        for p in providers:
            if p.skill_id == skill_id:
                return p
        known = sorted(p.skill_id for p in providers)
        raise KeyError(f"{arg_name}={skill_id!r} does not provide {capability_id!r}; providers are {known}")
