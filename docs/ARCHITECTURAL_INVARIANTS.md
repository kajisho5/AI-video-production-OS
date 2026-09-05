# Architectural Invariants

Status: **Derived, draft, 2026-09-05.** This document states properties that must remain
true of the AI Video Production OS, each as a testable invariant, with the evidence that
currently enforces it — or the honest gap, if it doesn't yet. Tags follow
`DESIGN_SYSTEM.md` §2, plus one enforcement-status label per invariant, used
consistently:

- **CURRENTLY ENFORCED** — verified in code today, across one or more repos, by direct
  evidence in `REPOSITORY_MAP.md` or a cited document.
- **PARTIALLY ENFORCED** — true in some repos/paths and not others, or enforced by
  convention but not by a mechanism that would catch a violation. The specific gap is
  named, not glossed over.
- **ASPIRATIONAL / FUTURE** — not enforced anywhere in the audited ecosystem today, but
  architecturally required going forward. Stated as a requirement, not claimed as already
  true.

An invariant here is not a principle (`PRINCIPLES.md`) or a boundary (`NEGATIVE_ARCHITECTURE.md`)
— it is a specific, checkable property with a concrete test someone could actually run
against a Skill or Agent to find a violation.

## How to read this document

Each invariant states: the property, its enforcement status, the mechanism (or the gap)
that determines that status, and — where the status is not CURRENTLY ENFORCED — what
closing the gap would require.

## 1. Agent cannot bypass execution security

**Invariant:** no Agent output — a Decision, a Plan step's parameters, an Operation's
`argv_or_request` — can reach a subprocess boundary carrying a raw shell command, filter
string, or execution-control key.

**Status: CURRENTLY ENFORCED.** `FORBIDDEN_KEYS`/`FORBIDDEN_ARG_KEYS` — blocking
`command`, `argv`, `shell`, `exec`, `filter`/`filter_complex`, `api_key`, `token`,
`env`-shaped keys — is independently implemented, recursively applied before any
parameter tree reaches an adapter, across at least seven audited repos: `ffmpeg-skill`,
`qc-skill`, `media-analysis-skill`, `video-editing-skill`, `audio-production-skill`,
`color-grading-skill`, and `transcription-skill` (`SECURITY_MODEL.md` §1.1;
`REPOSITORY_MAP.md` finding 3). `video-production-agent`'s own `FORBIDDEN_ARG_KEYS`
enforces this at the Agent's own execution boundary, independent of any Skill's own
enforcement (`REPOSITORY_MAP.md`, `video-production-agent` section). Adversarial eval
cases exist by name testing exactly this (`11_plan_hostile_ai_no_leakage.json`,
`REPOSITORY_MAP.md`).

**Named, honest gap within "currently enforced":** the denylist is "not identical across
repos — a real, present inconsistency, not a hypothetical one" (`SKILL_SPEC.md` §1) —
`qc-skill` additionally denies `filter` where others do not. This does not break the
invariant (every repo's list is a superset of the dangerous core keys), but it means the
exact enforced boundary is not yet a single canonical list — `SPEC.md` §1 and
`SKILL_SPEC.md` §3.1 propose closing this with one canonical denylist any Skill's own
list must be a superset of, never a subset.

## 2. Skills cannot bypass typed contracts

**Invariant:** no Skill accepts a raw filter string, argv list, or shell-interpretable
string from a caller as a substitute for its typed, closed-vocabulary parameter schema.

**Status: CURRENTLY ENFORCED.** "No filter string is ever accepted from a caller"
(`REPOSITORY_MAP.md`, `ffmpeg-skill` section) — typed flags (`--compress`, `--limit`,
`--gate`) are individually range-checked and converted into filter-graph fragments
internally; text/paths destined for filter graphs are escaped, never interpolated raw.
This was verified by grep across the whole ecosystem for shell/argv/filter-string
acceptance patterns, per `ARCHITECTURE.md` §7 and §11's final test: "Can an AI operate
the OS without executing arbitrary shell commands? Yes — this is the one guarantee
enforced identically at every single Skill boundary already audited... confirmed by grep
across all 11 repos." Even `ffmpeg-skill`'s one explicit escape hatch — a raw
`{"argv": [...]}` call — is marked `canonical: false` and "still only invokes the named
script, never a shell" (`REPOSITORY_MAP.md`).

**Named, honest gap:** the `{"argv": [...]}` escape hatch itself is a deliberate,
documented exception — it exists, is non-canonical, and still cannot reach a shell. This
is disclosed, not hidden, and does not violate the invariant as stated (it never accepts
a *shell*-interpretable string; it accepts a pre-validated argv list for one named
script).

## 3. QC cannot silently modify artifacts

**Invariant:** no verification Capability writes to, mutates, or overwrites the artifact
it measures, and no verification Capability's code path acts on its own findings (retry,
re-render, publish, block) without an Agent- or human-mediated Decision.

**Status: CURRENTLY ENFORCED.** `qc-skill`'s own ADR-001 — "qc-skill is not an AI agent
and does not make production decisions" — is verified at the code level, not just in
documentation: "No decision/render/publish/block logic exists in the code outside
boundary-documentation comments" (`REPOSITORY_MAP.md`, confirmed independently by
`QC_ARCHITECTURE.md` §3). No media-writing code path exists anywhere in `qc-skill`'s CLI
or schemas (`REPOSITORY_MAP.md`, `media-analysis-skill` section makes the same
confirmation for that Skill: "purely observational — confirmed no media-writing code
path exists anywhere"). This project's ADR-007 generalizes the rule to any future
verification Capability as an OS-wide requirement, not merely `qc-skill`'s private
convention.

**Named, honest gap:** ADR-007's own "Alternatives Considered" names the risk this
invariant guards against directly — "a verification Skill silently gaining
side-effecting behavior... in a later version without an Agent or human ever approving
that behavior" — and states no automated mechanism yet checks a *future* verification
Skill for this property beyond code review; `SKILL_SPEC.md` §8's conformance suite does
not yet name a specific black-box test for "produces no side effects beyond its declared
output," so enforcement for a not-yet-audited future Skill is currently by review
convention, not by an automated conformance check.

## 4. Artifacts have stable, content-addressed identity — never path or mtime

**Invariant:** an Artifact's identity (`Artifact.id`) is a hash of its content (bytes, or
canonical JSON for structured types), and two artifacts with the same content hash are
treated as the same Artifact regardless of filesystem location, name, or timestamp.

**Status: CURRENTLY ENFORCED**, for the one repo whose identity scheme was verified at
the source level; **PROPOSED as universal, not yet implemented everywhere.**
`qc-skill`'s `identity = sha256(canonical_json({skill, skill_version, kind, operation,
asset_fingerprints, effective_parameters, rules, ffmpeg_version, ffprobe_version}))`
explicitly excludes timestamps, paths, and `request_id` (`REPOSITORY_MAP.md`,
`PROVENANCE.md` §1) and is backed by a real cache with tamper detection — "a cache hit is
only honored if a stored result-hash still matches the recomputed hash of the cached
report" (`ARTIFACT_MODEL.md` §6). `video-production-agent`'s `Artifact.hash` field
follows the same content-hash discipline (`CORE_PRIMITIVES.md` §7).

**Named gap:** `SPEC.md` §2 generalizes this to every Artifact type as a proposed
kernel-wide rule, but no single shared implementation of content-hashing exists across
all Skills today — each Skill that produces Artifacts (`video-editing-skill`,
`audio-production-skill`, etc.) has not been individually verified to compute a content
hash the same way `qc-skill` does; `qc-skill` is the one confirmed, rigorous
implementation, not a proof every Artifact-producing Skill already follows the pattern.
Treat this invariant as CURRENTLY ENFORCED for `qc-skill`'s own outputs and
`video-production-agent`'s `Artifact.hash`, and PROPOSED (not yet independently verified)
for every other Skill's output artifacts.

## 5. Provenance cannot depend on hidden state

**Invariant:** an Artifact's or Capability's reproducibility identity must be computable
from information the caller can see and control — never from wall-clock time, a random
request id, or an unstated environment fact — such that the same inputs, parameters, and
versions always hash identically regardless of when or where the operation ran.

**Status: CURRENTLY ENFORCED**, for `qc-skill`'s identity and cache; **PARTIALLY
ENFORCED** elsewhere. `qc-skill`'s identity scheme deliberately excludes
timestamps/paths/`request_id` specifically to keep it reproducible — "identity is a fact
about *what would happen*, not a log line about *when it happened*"
(`PROVENANCE.md` §1). `Operation.idempotency_key` is documented to follow the same
discipline (`EXECUTION_MODEL.md` §3.2), but the exact field set actually hashed by
`execution/compiler.py` today "was not independently re-derived from source for this
document; the general shape... is inferred from the documented behavior... Treat the
exact hashed field set as **UNKNOWN pending direct code citation, not as verified**"
(`EXECUTION_MODEL.md` §3.2, explicit self-correction). This is the clearest named
instance of PARTIALLY ENFORCED in this whole document: the *design intent* is confirmed,
but the *actual implementation* was not independently verified.

**Also named, a distinct and larger gap:** "environment" (OS, kernel, CPU architecture,
locale, installed codec libraries beyond `ffmpeg`/`ffprobe` themselves) is not captured
by any existing scheme in the audit — `ffmpeg_version`/`ffprobe_version` are the only
environment-adjacent fields any repo actually records (`PROVENANCE.md` §2, §6). A
reproducibility claim that ignores environment drift is weaker than the identity scheme's
design implies, and this document does not claim otherwise.

## 6. Third-party Skills cannot receive undeclared permissions

**Invariant:** a Skill's filesystem, network, and external-tool access must be visible as
declared data in its Capability Contract, checkable before the Skill runs, not just
whatever its source code happens to do.

**Status: ASPIRATIONAL / FUTURE. Not yet enforced anywhere, and this document states
that plainly rather than implying otherwise.** `PLUGIN_MODEL.md` §4 states the gap
directly: "no repo declares this explicitly today. Every audited Skill hardcodes its
`PathPolicy` roots in source... This works when the OS maintainer trusts every Skill's
author implicitly (true of all 10 audited Skills, all single-owner `kajisho5` repos
today) and stops working the moment a Skill's author is someone the OS operator has never
met." The permission-declaration shape itself (filesystem roots, network access,
external tools/binaries) is only **PROPOSED** (`PLUGIN_MODEL.md` §4), and even once
declared, "this section does not yet define an enforcement mechanism that actually
*confines* a plugin to its declared permissions at runtime" (§4) — declaration without
enforcement, checkable today only as "a documentation-consistency check... not as a
runtime-enforced guarantee" (`PLUGIN_MODEL.md` §7 item 3). Closing this invariant would
require both the contract field (not yet specified in `SPEC.md`'s current shape) and a
kernel-level confinement mechanism (container/sandbox-based, explicitly named as
**FUTURE, not designed here** — `PLUGIN_MODEL.md` §6) — neither exists today.

## 7. OS core cannot depend on one AI provider

**Invariant:** no OS-core contract, kernel component, or deterministic pipeline may
import or require a specific AI vendor's SDK or API; the same contracts must be operable
by a human, a rules engine, or any LLM interchangeably.

**Status: CURRENTLY ENFORCED — this one IS true today, not aspirational.**
`video-production-agent`'s `providers/base.py` defines a generic `AIProvider` interface;
`NullProvider` is the only shipped implementation; "no Anthropic/OpenAI SDK is imported
anywhere" (`REPOSITORY_MAP.md`); `capabilities/resolver.py` only probes for
`ANTHROPIC_API_KEY`/`OPENAI_API_KEY` environment variables to report capability status,
never imports either vendor's client library. The deterministic rule engine
(`policy/rules.py`, `agent/decision_engine.py`) drives real Decisions — silence trim,
loudness normalize — end-to-end with zero LLM in the loop (`ARCHITECTURE.md` §4). This is
"not a theoretical goal — it is the system's current, verified behavior"
(`ARCHITECTURE.md` §4), restated in `ARCHITECTURE.md` §11's final test: "Replace Claude
with another AI system, does the OS still make sense? Yes, already true today."

**No named gap.** This is the one invariant in this document with unqualified CURRENTLY
ENFORCED status, backed by absence-of-import evidence (grep-verified), not merely a
stated design intent.

## 8. No component may invoke a shell

**Invariant:** no process in the ecosystem calls `shell=True`, `os.system`,
`os.popen`, or any equivalent that hands a string to a system shell for interpretation;
every subprocess invocation is list-argv (or the equivalent typed process-spawn API).

**Status: CURRENTLY ENFORCED, ecosystem-wide, zero exceptions found.** "Confirmed by
grep across the entire ecosystem: **zero** occurrences of `shell=True` or `os.system`
anywhere in any of the 11 repositories" (`SECURITY_MODEL.md` §1.3). `SKILL_SPEC.md` §1
restates this as "**CURRENT**, universal. No exception found anywhere in the ecosystem."
`ARCHITECTURE.md` §11's final test independently confirms the same grep result. Even
`ffmpeg-skill`'s non-canonical `{"argv": [...]}` escape hatch is list-argv, never a shell
(`REPOSITORY_MAP.md`).

**No named gap for existing repos.** The forward-looking risk is explicitly named as a
*different* invariant, not a hole in this one: `SKILL_SPEC.md` §3.2 requires this of
every *future* Skill too, and §8 item 3 names how a closed-source or non-Python future
Skill would be checked (AST-walk where source is available; a shell-metacharacter
injection probe otherwise) — "a weaker guarantee than the AST walk and is documented as
such — it can catch an unsafe implementation but cannot certify a safe one the way a
structural proof can." So: CURRENTLY ENFORCED for all 11 audited repos today; the
conformance mechanism for verifying this of an *unaudited, not-yet-existing* Skill is
itself only PROPOSED (`SKILL_SPEC.md` §8), and its black-box variant is honestly weaker
than the AST-walk variant available where source is readable.

## 9. Structural Plan validity is checked before execution, never assumed

**Invariant:** an `Operation` is never compiled or executed against a `ProductionPlan`
step whose referenced Capability doesn't exist, whose Artifact types are incompatible, or
whose `depends_on` graph contains a cycle.

**Status: PARTIALLY ENFORCED.** `plan_status`/`step_status` are always computed from
Decision states, never set by hand (`CORE_PRIMITIVES.md` §6) — a real, kept invariant.
Structural validation of the DAG (acyclic `depends_on`) is required before execution
begins per `EXECUTION_MODEL.md` §2.2. **Named gap:** Provider resolution at compile time
is not yet enforced the way this document requires — `SkillRegistry.select_tool()`
"currently picks the first candidate in a hardcoded ordered list — a silent default"
(`CAPABILITY_MODEL.md` §Collision policy), rather than failing loudly when more than one
Provider is `AVAILABLE` and neither the Plan nor a default-provider policy names one.
`EXECUTION_MODEL.md` §1.1 names this explicitly as "a stricter behavior than what exists
in `video-production-agent` right now and is called out as a gap to close, not something
already true."

## 10. A Decision always carries evidence; nothing becomes executable without one

**Invariant:** no measurement, AI completion, or raw Observation is consumed as an
authorization to execute a Plan step without passing through an explicit, typed Decision
carrying mandatory `evidence`.

**Status: CURRENTLY ENFORCED.** `Decision` (`subject`, `type`, `risk`, `approval`,
`basis`, mandatory `evidence`) is a distinct, typed object in
`video-production-agent`'s `agent/decision_engine.py`, never an implicit side effect of a
measurement or a raw model completion (`CORE_PRIMITIVES.md` §5). AI output, when a
provider exists, "is tagged `provenance='AI_GENERATED'`, is treated as untrusted input,
is validated against the system-defined structure, and never becomes an executable
Decision by itself" (`REPOSITORY_MAP.md`). `ARCHITECTURE.md` §3 names this as the one
part of the ecosystem that already satisfies "don't let AI reasoning silently become
execution" by construction.

**No named implementation gap** — this invariant's enforcement was independently
confirmed in `video-production-agent`'s existing code, not merely stated as intended.

## Summary table

| # | Invariant | Status |
|---|---|---|
| 1 | Agent cannot bypass execution security | CURRENTLY ENFORCED (denylist not yet canonicalized across repos) |
| 2 | Skills cannot bypass typed contracts | CURRENTLY ENFORCED |
| 3 | QC cannot silently modify artifacts | CURRENTLY ENFORCED (no automated conformance check yet for *future* Skills) |
| 4 | Artifacts have stable, content-addressed identity | CURRENTLY ENFORCED (`qc-skill` only) / PROPOSED (other Skills, unverified) |
| 5 | Provenance cannot depend on hidden state | CURRENTLY ENFORCED (`qc-skill`) / PARTIALLY ENFORCED (`idempotency_key`'s exact fields UNKNOWN) |
| 6 | Third-party Skills cannot receive undeclared permissions | ASPIRATIONAL / FUTURE |
| 7 | OS core cannot depend on one AI provider | CURRENTLY ENFORCED |
| 8 | No component may invoke a shell | CURRENTLY ENFORCED (existing repos) / PROPOSED conformance mechanism (future Skills) |
| 9 | Structural Plan validity checked before execution | PARTIALLY ENFORCED (Provider-collision case is a named gap) |
| 10 | Decisions always carry evidence | CURRENTLY ENFORCED |

## What this document deliberately does not include

- Performance or scale invariants (throughput, latency bounds) — no evidence anywhere in
  the audit shows these are live concerns yet (`ARCHITECTURE.md` §9, lens 5).
- Invariants about a UI, scheduler, or network security boundary — per
  `NEGATIVE_ARCHITECTURE.md` §§11–14, these domains do not exist in the ecosystem yet, so
  there is nothing to state an invariant about.
- A commitment to when each PARTIALLY ENFORCED or ASPIRATIONAL invariant becomes fully
  enforced — that is `ROADMAP.md`'s job; this document only states the property and its
  current truth value, not a delivery timeline.
- Cryptographic non-repudiation or tamper-proof guarantees beyond content-hash tamper
  *detection* — `SECURITY_MODEL.md` §9 and `PROVENANCE.md` §4 explicitly decline to
  propose a signing scheme, and no invariant above claims one exists.
