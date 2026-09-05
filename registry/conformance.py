"""Conformance suite skeleton (docs/ROADMAP.md Phase 1, item 3; checks defined in
docs/SKILL_SPEC.md section 8).

Three of the eight checks are fully real here: they need only a contract document, which
this library already loads. The other five need a running Skill process (submit a
crafted request, observe the rejection) - SKILL_SPEC.md section 5 notes every Skill's
actual invocation mechanics differ (CLI argv vs. JSON stdin, different entrypoints), so
this module does not invent a generic runner that would only fit some of them. Each is a
documented stub: it states exactly what a per-Skill wiring must supply and raises
NotImplementedError until one is, rather than silently reporting a pass it never checked.
Building real per-Skill wiring for checks 2-5 and 7 is future work (docs/ROADMAP.md);
marking them PASS today would be exactly the kind of unearned claim this project's
architecture rules out.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Dict, List

from .contract import LIFECYCLES, extract_provides, skill_identity, validate_provides_entry


@dataclass
class CheckResult:
    check: str
    status: str  # "PASS" | "FAIL" | "NOT_IMPLEMENTED"
    detail: str


# ---- checks answerable from a contract document alone -----------------------------
def check_publishes_contract(doc: Dict[str, Any]) -> CheckResult:
    """SKILL_SPEC.md #1: the contract document must at least resolve a skill identity
    and, if it declares any `provides` entries, every one of them must be well-formed."""
    try:
        skill_identity(doc)
    except Exception as exc:  # noqa: BLE001 - report as a failed check, not a crash
        return CheckResult("publishes_contract", "FAIL", str(exc))
    for entry in extract_provides(doc):
        problems = validate_provides_entry(entry)
        if problems:
            return CheckResult("publishes_contract", "FAIL", f"invalid provides entry {entry!r}: {'; '.join(problems)}")
    return CheckResult("publishes_contract", "PASS", "skill identity resolved; every provides entry (if any) is well-formed")


def check_lifecycle_declared(doc: Dict[str, Any]) -> CheckResult:
    """SKILL_SPEC.md #6: every declared Capability carries a valid 5-state lifecycle.
    A Skill with no `provides` entries at all has nothing to check here and is neither a
    pass nor a fail - see NOT_IMPLEMENTED with that reason, since the check does not
    apply, distinct from a check that ran and found a problem."""
    provides = extract_provides(doc)
    if not provides:
        return CheckResult("lifecycle_declared", "NOT_IMPLEMENTED", "no provides entries to check (Skill has not adopted provides yet)")
    bad = [e.get("id") for e in provides if e.get("lifecycle") not in LIFECYCLES]
    if bad:
        return CheckResult("lifecycle_declared", "FAIL", f"missing/invalid lifecycle for: {bad}")
    return CheckResult("lifecycle_declared", "PASS", f"{len(provides)} provides entries all carry a valid lifecycle")


def check_dependency_version_ranges(doc: Dict[str, Any]) -> CheckResult:
    """SKILL_SPEC.md #8: a declared `dependencies[]` entry's `version_range` must be a
    range, not an exact pin. No Skill in the ecosystem publishes `dependencies` in its
    contract today (docs/SPEC.md's aspirational shape), so this check is
    NOT_IMPLEMENTED-by-inapplicability for every real contract as of this writing - not
    a stub, but an honestly empty check."""
    deps = doc.get("dependencies")
    if not deps:
        return CheckResult("dependency_version_ranges", "NOT_IMPLEMENTED", "no dependencies field to check (no Skill publishes this yet)")
    bad = []
    for d in deps:
        vr = d.get("version_range") if isinstance(d, dict) else None
        if not isinstance(vr, str) or vr.strip().replace(".", "").replace("v", "").isdigit():
            bad.append(d)
    if bad:
        return CheckResult("dependency_version_ranges", "FAIL", f"looks like an exact pin, not a range: {bad}")
    return CheckResult("dependency_version_ranges", "PASS", f"{len(deps)} dependencies all use a range")


# ---- checks that require a running Skill process -----------------------------------
def _stub(name: str, spec_ref: str, wiring: str) -> Callable[..., CheckResult]:
    def check(*_args: Any, **_kwargs: Any) -> CheckResult:
        raise NotImplementedError(
            f"{name} ({spec_ref}) needs a per-Skill process runner ({wiring}); "
            "docs/SKILL_SPEC.md section 5 notes invocation mechanics differ per Skill, "
            "so this library does not invent a generic one. Not implemented here yet - "
            "see docs/ROADMAP.md."
        )

    check.__name__ = name
    return check


check_forbidden_keys_rejected: Callable[..., CheckResult] = _stub(
    "forbidden_keys_rejected", "SKILL_SPEC.md #2",
    "a callable submitting a request whose parameters include a denylisted key and returning the Skill's response",
)
check_no_unsafe_shell_out: Callable[..., CheckResult] = _stub(
    "no_unsafe_shell_out", "SKILL_SPEC.md #3",
    "either source access for an AST walk, or a callable submitting shell-metacharacter injection probes",
)
check_workspace_confinement: Callable[..., CheckResult] = _stub(
    "workspace_confinement", "SKILL_SPEC.md #4",
    "a callable submitting an output path outside the declared workspace (including via a symlink) and returning the Skill's response",
)
check_no_clobber_input: Callable[..., CheckResult] = _stub(
    "no_clobber_input", "SKILL_SPEC.md #5",
    "a callable submitting a request whose output path equals one of its input paths and returning the Skill's response",
)
check_doctor_status: Callable[..., CheckResult] = _stub(
    "doctor_status", "SKILL_SPEC.md #7",
    "a callable invoking the Skill's doctor entrypoint and returning its parsed output",
)

CHECKS: Dict[str, Callable[..., CheckResult]] = {
    "publishes_contract": check_publishes_contract,
    "lifecycle_declared": check_lifecycle_declared,
    "dependency_version_ranges": check_dependency_version_ranges,
    "forbidden_keys_rejected": check_forbidden_keys_rejected,
    "no_unsafe_shell_out": check_no_unsafe_shell_out,
    "workspace_confinement": check_workspace_confinement,
    "no_clobber_input": check_no_clobber_input,
    "doctor_status": check_doctor_status,
}


def run_static_checks(doc: Dict[str, Any]) -> List[CheckResult]:
    """The three checks answerable from a contract document alone (see module docstring
    for why the other five are not run here)."""
    return [check_publishes_contract(doc), check_lifecycle_declared(doc), check_dependency_version_ranges(doc)]
