"""Conformance suite skeleton (docs/ROADMAP.md Phase 1, item 3; checks defined in
docs/SKILL_SPEC.md section 8).

Three of the eight checks are answerable from a contract document alone. Four more
(`forbidden_keys_rejected`, `doctor_status`, `workspace_confinement`, `no_clobber_input`)
are real when given callables that talk to a live Skill process -
`make_stdin_json_runner` below builds one for the ecosystem's common "one JSON request on
stdin, one JSON response on stdout" convention (confirmed for qc-skill,
media-analysis-skill, transcription-skill, audio-production-skill, color-grading-skill,
motion-graphics-skill; all four process-based checks verified end-to-end against a real
qc-skill process in registry/tests/test_conformance_live.py). The remaining one
(`no_unsafe_shell_out`) stays a documented stub: it needs either source-level AST analysis
or a callable submitting shell-metacharacter injection probes, neither of which this
library builds yet - real future work (docs/ROADMAP.md), and marking it PASS today would
be exactly the kind of unearned claim this project's architecture rules out.

`workspace_confinement` and `no_clobber_input` were originally scoped (see git history) as
"submit a request whose output path is outside the workspace / equals an input path, and
check the Skill rejects it" - the same request-mutation shape as `forbidden_keys_rejected`.
Live testing against qc-skill found that shape does not fit: qc-skill's `run` request
schema has no output-path field at all (its `validate`/`inspect`/`check` operations are
read-only measurement, returning a report on stdout; its on-disk report cache is a fixed,
non-request-controlled path under the workspace, via a code path - `PathPolicy.resolve_output`
- that is defined but never actually called). Rather than force a check design onto a Skill
it does not apply to, these two checks were redefined around what is actually observable
from outside the process for *any* Skill, regardless of whether it exposes an output-path
field: `workspace_confinement` snapshots caller-chosen directories outside the declared
workspace before and after a real run and fails if any of them gained a file;
`no_clobber_input` hashes the input fixture before and after a real run and fails if the
Skill changed it. Both are real properties every Skill must hold, not proxies for one.
"""
from __future__ import annotations

import hashlib
import json
import os
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Sequence, Set

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
def make_stdin_json_runner(command: Sequence[str], timeout: float = 30.0) -> Callable[[Dict[str, Any]], Dict[str, Any]]:
    """A process runner for the ecosystem's common CLI convention: one JSON request
    document on stdin, exactly one JSON response document on stdout (e.g. `qc run -
    --json`). Raises RuntimeError if the process cannot be started or its stdout is not
    valid JSON - a Skill that crashes instead of returning a structured error fails a
    conformance check for a more serious reason than a forbidden key merely being
    accepted, and that failure must not be silently swallowed."""
    def run(request: Dict[str, Any]) -> Dict[str, Any]:
        try:
            proc = subprocess.run(list(command), input=json.dumps(request), capture_output=True, text=True, timeout=timeout)
        except (OSError, subprocess.TimeoutExpired) as exc:
            raise RuntimeError(f"could not run {list(command)}: {exc}") from exc
        try:
            return json.loads(proc.stdout)
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"{list(command)} (exit {proc.returncode}) did not print one JSON document on stdout: "
                                f"stdout={proc.stdout[:200]!r} stderr={proc.stderr[:200]!r}") from exc
    return run


def _is_rejected(response: Any) -> bool:
    """A response counts as a structured rejection under either real convention this
    ecosystem's Skills use for a failure envelope (docs/POC_CAPABILITY_CONTRACT.md notes
    both exist: some Skills carry `ok: false`, others `status: failed|error` with no `ok`
    key at all - qc-skill is the latter). Never inferred from the mere presence of an
    `error` key alone, since a passing response could in principle echo unrelated data
    under that name."""
    if not isinstance(response, dict):
        return False
    if response.get("ok") is False:
        return True
    return response.get("status") in ("failed", "error")


def check_forbidden_keys_rejected(
    runner: Optional[Callable[[Dict[str, Any]], Dict[str, Any]]] = None,
    forbidden_keys: Optional[Sequence[str]] = None,
    base_request: Optional[Dict[str, Any]] = None,
) -> CheckResult:
    """SKILL_SPEC.md #2: for each denylisted key, submit a request carrying it - at top
    level and nested one level deep inside `parameters` (mirroring the recursive check
    video-production-agent itself performs) - and confirm the Skill responds with a
    structured rejection, never a silent success.

    Real when `runner`, `forbidden_keys` and `base_request` are all given (`runner` from
    `make_stdin_json_runner` for the ecosystem's stdin-JSON convention, or any callable
    with the same signature; `base_request` a request shape the Skill would otherwise
    accept or reject for an unrelated, non-forbidden-key reason). Otherwise raises
    NotImplementedError: SKILL_SPEC.md section 5 notes invocation mechanics differ per
    Skill, so this library does not invent a generic runner that would only fit some of
    them.
    """
    if runner is None or forbidden_keys is None or base_request is None:
        raise NotImplementedError(
            "forbidden_keys_rejected (SKILL_SPEC.md #2) needs runner, forbidden_keys and base_request "
            "(see make_stdin_json_runner for Skills using the stdin-JSON CLI convention)."
        )
    problems: List[str] = []
    for key in forbidden_keys:
        top = dict(base_request)
        top[key] = "conformance-probe"
        nested = dict(base_request)
        nested["parameters"] = {**(base_request.get("parameters") or {}), key: "conformance-probe"}
        for placement, doc in (("top level", top), ("nested in parameters", nested)):
            try:
                response = runner(doc)
            except Exception as exc:  # noqa: BLE001 - a crash is a failure to report, not to hide
                problems.append(f"{key} ({placement}): runner raised {exc}")
                continue
            if not _is_rejected(response):
                problems.append(f"{key} ({placement}): not rejected (response: {response!r})")
    if problems:
        return CheckResult("forbidden_keys_rejected", "FAIL", "; ".join(problems))
    return CheckResult("forbidden_keys_rejected", "PASS", f"{len(forbidden_keys)} forbidden keys rejected, top level and nested")


def check_doctor_status(runner: Optional[Callable[[], Dict[str, Any]]] = None) -> CheckResult:
    """SKILL_SPEC.md #7: the Skill's doctor entrypoint produces a machine-readable
    report without requiring the caller to already know what's installed.

    Real when `runner` (a zero-argument callable invoking the Skill's doctor entrypoint
    and returning its parsed JSON) is given; otherwise NotImplementedError."""
    if runner is None:
        raise NotImplementedError(
            "doctor_status (SKILL_SPEC.md #7) needs a runner invoking the Skill's doctor entrypoint with no arguments."
        )
    try:
        doc = runner()
    except Exception as exc:  # noqa: BLE001 - report, don't hide
        return CheckResult("doctor_status", "FAIL", f"doctor runner raised {exc}")
    if not isinstance(doc, dict) or not doc:
        return CheckResult("doctor_status", "FAIL", f"doctor did not return a non-empty JSON object: {doc!r}")
    return CheckResult("doctor_status", "PASS", f"doctor returned a JSON object with {len(doc)} top-level keys")


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


check_no_unsafe_shell_out: Callable[..., CheckResult] = _stub(
    "no_unsafe_shell_out", "SKILL_SPEC.md #3",
    "either source access for an AST walk, or a callable submitting shell-metacharacter injection probes",
)


def _snapshot(directory: str) -> Set[str]:
    """Every file under `directory`, as paths relative to it. A missing directory
    snapshots as empty rather than raising - it may not exist yet before the first run
    that could create it, which is itself a legitimate thing for the check to notice."""
    root = Path(directory)
    if not root.is_dir():
        return set()
    return {str(p.relative_to(root)) for p in root.rglob("*") if p.is_file()}


def check_workspace_confinement(
    run_in_workspace: Optional[Callable[[str], Any]] = None,
    workspace: Optional[str] = None,
    watch_dirs: Optional[Sequence[str]] = None,
) -> CheckResult:
    """SKILL_SPEC.md #4: every file a Skill writes during one real run must land inside
    the workspace root it was told to confine itself to - never in a directory it merely
    happens to have OS-level access to.

    Real when `run_in_workspace` (a callable that performs one full, synchronous Skill
    invocation against `workspace` - e.g. spawns `qc run - --json --workspace <workspace>`
    and waits for it to exit, so every file that run will ever write already exists on
    disk by the time the callable returns), `workspace`, and `watch_dirs` (directories to
    snapshot before/after, none of which may be `workspace` itself or contain it - e.g.
    the process's own cwd, the system temp dir) are all given. Otherwise raises
    NotImplementedError.
    """
    if run_in_workspace is None or workspace is None or watch_dirs is None:
        raise NotImplementedError(
            "workspace_confinement (SKILL_SPEC.md #4) needs run_in_workspace, workspace and watch_dirs "
            "(directories outside the workspace to check for stray writes)."
        )
    workspace_resolved = os.path.realpath(workspace)
    for d in watch_dirs:
        resolved = os.path.realpath(d)
        if resolved == workspace_resolved or resolved.startswith(workspace_resolved + os.sep):
            raise ValueError(f"watch_dirs entry {d!r} is the workspace (or inside it) - it can't also be an 'outside' probe")
    before = {d: _snapshot(d) for d in watch_dirs}
    run_in_workspace(workspace)
    stray: List[str] = []
    for d in watch_dirs:
        new_files = _snapshot(d) - before[d]
        stray.extend(str(Path(d) / f) for f in new_files)
    if stray:
        return CheckResult("workspace_confinement", "FAIL", f"file(s) written outside the declared workspace: {stray}")
    return CheckResult("workspace_confinement", "PASS", f"no stray writes across {len(watch_dirs)} watched director{'y' if len(watch_dirs) == 1 else 'ies'} outside the workspace")


def _file_sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def check_no_clobber_input(
    run_with_input: Optional[Callable[[str], Any]] = None,
    input_path: Optional[str] = None,
) -> CheckResult:
    """SKILL_SPEC.md #5: a Skill must never modify the input file(s) a caller hands it,
    regardless of what operation was requested or whether it succeeded.

    Real when `run_with_input` (a callable that performs one full, synchronous Skill
    invocation reading `input_path` as its input - e.g. spawns `qc run - --json` with a
    request whose `input` field is `input_path`) and `input_path` (an existing fixture
    file) are both given. Otherwise raises NotImplementedError.
    """
    if run_with_input is None or input_path is None:
        raise NotImplementedError(
            "no_clobber_input (SKILL_SPEC.md #5) needs run_with_input and input_path (an existing fixture file)."
        )
    before = _file_sha256(input_path)
    run_with_input(input_path)
    after = _file_sha256(input_path)
    if before != after:
        return CheckResult("no_clobber_input", "FAIL", f"input file content changed after the run (sha256 {before} -> {after})")
    return CheckResult("no_clobber_input", "PASS", f"input file unchanged (sha256 {after})")

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
