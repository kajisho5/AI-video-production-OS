# Roadmap

Status: this roadmap is built from the task brief's suggested phase shape, then
challenged against `REPOSITORY_MAP.md`'s evidence, `ARCHITECTURE.md`'s minimal-kernel
definition (§8), and `CAPABILITY_MODEL.md`/`SKILL_SPEC.md`'s already-specified contract
shapes — not copied verbatim. Where a phase's real dependencies force a different
sequencing than "the next number," that is stated explicitly. Every phase lists what it
delivers, what it genuinely depends on (and why that dependency is real, not just
numerically convenient), and a risk/uncertainty rating.

**Sequencing rule used throughout:** a phase can only be marked parallelizable with
another phase (or internally parallelizable, e.g. Skill-by-Skill) when the evidence shows
the parallel units do not share a mutable contract they'd otherwise race on defining
independently. Most phases below fail that test and are explicitly marked non-parallel.
Phase 2 is the one clear exception, and it is called out as such.

---

## Phase 0 — Research + architecture

**Status: substantially complete once this document and its two companions
(`CAPABILITY_MATRIX.md`, `DEPENDENCY_GRAPH.md`) land**, alongside the five prior
documents (`REPOSITORY_MAP.md`, `CORE_PRIMITIVES.md`, `CAPABILITY_MODEL.md`,
`ARCHITECTURE.md`, `SPEC.md`) and the supporting docs already written
(`SKILL_SPEC.md`, `EXECUTION_MODEL.md`, `ARTIFACT_MODEL.md`, `PROVENANCE.md`).

**Delivers:** an evidence-based map of what exists (`REPOSITORY_MAP.md`), the
Capability/Skill/Provider/Runtime split and why it's the right split
(`CORE_PRIMITIVES.md`, `CAPABILITY_MODEL.md`), the minimal kernel definition and red-team
record (`ARCHITECTURE.md`), the concrete contract shapes (`SPEC.md`, `SKILL_SPEC.md`),
and this concrete capability-to-provider matrix and dependency graph.

**Depends on:** nothing else — this is the research phase.

**What is genuinely still open after Phase 0** (carried forward, not silently resolved):
`COMPETITIVE_ANALYSIS.md`, `SECURITY_MODEL.md`, `QC_ARCHITECTURE.md`, `TIMELINE_MODEL.md`,
`VERSIONING.md`, `FAILURE_RECOVERY.md`, and `PLUGIN_MODEL.md` are referenced by the
finalized documents above but their own detailed content is not what this roadmap
verifies — they are assumed to exist or be forthcoming as part of closing out Phase 0,
and Phase 1 should not start schema work that contradicts them without reconciling first.

**Risk/uncertainty: low.** This is documentation and analysis work against evidence
already gathered; the main risk is scope creep (continuing to write "just one more"
architecture document instead of moving to implementation).

---

## Phase 1 — Minimal OS kernel: the Capability Contract format + reference registry

**Status: CURRENT / IMPLEMENTED as of 2026-09-05, for items 1-2 and item 3.**
[`registry/`](../registry/) is a real, tested Python library (50 tests, all passing —
21 against real captured data from five Skills, 11 live against a real `qc-skill`
process, 18 exercising the AST-walk check's logic against synthetic fixtures — see
`registry/README.md`): `registry.contract` resolves a Skill's identity across the three
real shapes the ecosystem actually uses and validates a `provides[]` entry against what
Skills actually publish (not the full aspirational shape below — see the delta noted
under item 1); `registry.registry.CapabilityRegistry` registers Capabilities, detects
collisions, and applies the 3-tier policy; `registry.conformance` implements **all 8**
of `SKILL_SPEC.md` section 8's checks for real — 3 answerable from a contract document
alone, 4 (`forbidden_keys_rejected`, `doctor_status`, `workspace_confinement`,
`no_clobber_input`) wired against a live Skill process via callables
(`make_stdin_json_runner()` for the request/response pair, plus a filesystem-snapshot
and a content-hash comparison for the latter two), verified end-to-end against
`qc-skill` — and the 8th (`no_unsafe_shell_out`) via a static AST-walk of a Skill's own
Python source tree, manually verified PASS against all 9 real Python Skills in the
ecosystem (does not cover `ffmpeg-skill`, a Node.js package - a language-appropriate
lint-rule equivalent is future work). `workspace_confinement`/`no_clobber_input` ended
up shaped differently than originally planned: live testing found `qc-skill`'s `run`
request has no output-path field to probe at all (its operations are read-only
measurement), so both checks were redesigned around externally observable properties —
no stray files outside the declared workspace, no change to the input fixture's content
— that apply to any Skill regardless of whether it exposes an output-path field.
`no_unsafe_shell_out` was also redesigned mid-implementation: an initial text/regex-scan
draft produced two real false positives against actual ecosystem source (a comment in
`qc-skill` merely mentioning "eval()/exec()"; the safe, explicit `shell=False` several
Skills use), fixed by switching to a full AST walk, which cannot mistake a string
literal's *contents* for executable code. **Update, 2026-09-06:** item 1's remaining gap
is now closed — `registry/capability_contract.schema.json` formalizes the full
aspirational `CapabilityContract` shape below as an actual JSON Schema (draft 2020-12)
document, with `required` deliberately narrow (only what every real Skill's `contract`
output already carries: a skill identity plus `provides[].{id, lifecycle, tool_id}`) so
the schema documents the target shape in full while still validating every one of
`registry/tests/fixtures/*.provides.json`'s real captured contracts without rejecting
any of them (`registry/tests/test_schema.py`, skipped when the optional `jsonschema`
package is not installed — the registry package itself stays dependency-free, per
`registry/README.md`). Still not built: wiring any of the 8 conformance checks into
an actual CI job per-Skill (each check is a real, callable function today, not yet an
automated gate anywhere).

**Delivers:**
1. The `CapabilityContract` JSON shape from `SPEC.md` §1, formalized as an actual JSON
   Schema document (not just the prose shape already written) — `skill_id`,
   `skill_version`, `contract_version`, `capabilities[]` (with `id`, `lifecycle`,
   `input_schema`, `output_schema`, `input_artifact_types`, `output_artifact_types`,
   `mutates_input`, `deterministic_inputs`, `idempotency_hint`, `verification`,
   `security.forbidden_keys`), `dependencies[]`, `not_provided[]`.
2. A reference validator/registry **library in Python** (matching the ecosystem's
   existing implementation language — every one of the 11 audited repos is Python) that
   can: load a `CapabilityContract` JSON document, validate it against the schema,
   register its declared Capabilities/Providers in an in-memory (or file-backed) registry,
   and answer "who provides Capability X" and "is Capability X's registration a
   collision" (i.e., detect what `CAPABILITY_MATRIX.md` §8a currently only shows by hand).
3. The **conformance test suite skeleton** from `SKILL_SPEC.md` §8 — the eight black-box
   checks (publish contract; reject forbidden keys; no unsafe shell-out via AST-walk or
   injection probe; workspace confinement; no-clobber-input; lifecycle field presence;
   doctor status; range-not-pin dependency versioning) implemented as a runnable harness
   skeleton, even if individual checks start as stubs that need per-Skill wiring.

**Depends on: nothing else in this roadmap.** This is pure schema/contract/library work.
It requires no changes to any existing Skill repo to *build* (only to eventually *adopt*,
which is Phase 2). It can start immediately.

**Why this must come before every other phase, concretely:** Phase 3's collision-
resolution policy needs a real definition of "a Provider registration" to resolve between
— that definition is this phase's schema, not an assumption Phase 3 can supply for itself.
Phase 4's registry-driven discovery needs the registry library this phase builds. Every
later phase either validates against, registers into, or executes through the artifact
this phase produces.

**Risk/uncertainty: low-to-moderate.** The shapes are already well-specified in `SPEC.md`
and `SKILL_SPEC.md` — the risk is not "what should this look like" but ordinary
implementation risk (schema edge cases, JSON Schema tooling choices) and the open question
`ARCHITECTURE.md` §12 flags: whether the conformance suite should be a downloadable
harness or a written spec Skills implement their own tests against. This phase should
resolve that question by building the harness (since `SKILL_SPEC.md` §8 already commits
to "PROPOSED as a written specification... whether it also ships as a runnable harness is
left to `ROADMAP.md`") — building it now, even minimally, is lower-risk than deferring the
decision again.

---

## Phase 2 — Retrofit existing Skills to publish the CapabilityContract shape

**Status: CURRENT / IMPLEMENTED as of 2026-09-05.** All 10 audited Skills now have an
open PR adding `provides` — see `docs/ECOSYSTEM_CHANGELOG.md` for the full list of PRs,
per-repo Capability-id mappings, and the current CI/review state of each (this roadmap
entry is not updated again as those PRs merge; check the changelog and the PRs
themselves for that). The per-Skill effort estimates below were written before any of
that work started and are kept as-is because they turned out accurate, not because they
still describe unstarted work: `video-editing-skill` was in fact near-zero-cost;
`audio-production-skill`/`color-grading-skill`/`motion-graphics-skill` did each need one
naming decision per operation, recorded as a new ADR in each repo; `qc-skill` did need
real manual mapping (35 checks grouped into 10 Capability ids) and now publishes
identical ids to `media-analysis-skill` for their three collision Capabilities, the
first real demonstration of `CAPABILITY_MODEL.md`'s collision model; and both
`transcription-skill` and `ffmpeg-skill`'s structurally different contract shapes each
needed their own small, documented decision rather than a mechanical retrofit. One
genuine gap surfaced during the work and was **not** forced shut at the time:
`media-analysis-skill` has five analysis kinds (`media_probe`, `stream_layout`,
`video_format`, `audio_format`, `duration`) that had no settled Capability id in
`CAPABILITY_MATRIX.md` §8c — publishing a guessed id there risked creating a false
collision the matrix had not yet ruled out. **Update, same day:** that gap is now
closed. `CAPABILITY_MATRIX.md` §8c was resolved by directly reading both
implementations rather than assuming — confirming `video_format` genuinely measures
something different from `qc-skill`'s `measure.video.format` (a raw probe vs. a
threshold judgment), and that the `ffmpeg-skill.probe` overlap is base-layer-tool-only,
never a Capability collision — and `media-analysis-skill`'s `provides` now covers all
ten of its analysis kinds (see `docs/ECOSYSTEM_CHANGELOG.md`, "Resolve
media-analysis-skill's remaining 5 Capability ids"). Phase 2 is now fully complete, not
complete-with-one-known-gap.

**Delivers:** each of the 10 existing Skill repos (11 counting `ffmpeg-skill` itself)
extends its existing `contract.py`/contract-emission code to output the Phase 1 schema's
shape, additively. Every audited repo already has a `contract` command emitting *some*
JSON (`SKILL_SPEC.md` §1 — confirmed universal across all 10); this phase makes that
output's *shape* consistent rather than inventing the mechanism. `ffmpeg-skill`'s
`_contract.py` (already schema-introspected from `argparse`, the richest example in the
ecosystem) is the easiest and lowest-risk retrofit; the repos with only an in-code
`contract.py` and no schema file (`REPOSITORY_MAP.md` finding 4) require more genuinely
new work per repo, but none require new capabilities to be built — only new fields on
capabilities that already exist and already run.

**Per-Skill effort, grounded in real contract data, not estimated from source reading**
(`docs/POC_CAPABILITY_CONTRACT.md` ran all 10 Skills' actual `contract`/`skill` CLI
output through the proposed schema — this replaces guesswork with fact):

- **Near-zero-cost:** `video-editing-skill` already publishes a native, dotted
  `capability` field per operation (`video.trim`, `video.concat`, ...) in exactly the
  target shape — its retrofit is close to "add `provides: [...]` derived mechanically
  from a field that already exists," not a design decision (PoC Finding 4).
- **One bounded decision per operation:** `audio-production-skill`, `color-grading-skill`
  need a human (or reviewed-AI) decision mapping each existing `type`-tagged operation
  (`NORMALIZE`, `HDR_TO_SDR`, ...) to a Capability id — real work, but small and
  well-defined per operation (PoC Finding 4, 8).
- **Same decision, plus exposing nested operations as addressable at all:**
  `motion-graphics-skill` shares the pattern above; it and `audio-production-skill` /
  `color-grading-skill` currently expose only one generic `<skill>/run` tool at the top
  level, with real operations one level deeper in a separate `operations` list (PoC
  Finding 8) — the retrofit should decide whether each operation becomes independently
  addressable or stays reached only through `run`, since the Capability registry
  ultimately needs *something* invocable per Capability id.
- **A few decisions, not per-operation:** `subtitle-skill` (2 operations),
  `thumbnail-skill` (3, and already has real per-operation Tool ids to map from) — small
  by virtue of being small Skills.
- **Manual mapping against skill-internal names:** `qc-skill` (36 checks),
  `media-analysis-skill` (10 tools) — the known collision case; mapping is real work but
  fully worked out already for 5 of their Capabilities in the PoC.
- **Structurally different, not yet scoped in this depth:** `transcription-skill`'s flat,
  skill-wide `capabilities` list and `ffmpeg-skill`'s own nested `skill: {...}` shape
  (PoC Finding 7) each need their own small design decision, not a mechanical retrofit.
- **Add `contract_version` from scratch:** 7 of 10 Skills don't publish this field at
  all today, not just inconsistently (PoC Finding 6) — this is a real, if small, task
  for most of the ecosystem, not a rename.

This is not one uniform task repeated ten times — treat each Skill's Phase 2 entry as
its own estimate, checked against its real contract, rather than assuming parity.

**Depends on: Phase 1** (there is no target shape to retrofit toward until the schema and
validator exist — a Skill author cannot conform to a contract that hasn't been written
down yet).

**Parallelizability — the one clear exception in this roadmap:** once Phase 1 lands,
retrofitting each Skill is **genuinely independent, Skill-by-Skill** work. Unlike every
other phase in this roadmap, there is no shared mutable state two Skills would race on —
`video-editing-skill`'s contract retrofit does not block or interact with
`color-grading-skill`'s. This can be assigned to different people/repos/PRs in any order
or fully in parallel, and is the only phase in this document that can honestly make that
claim. (Two caveats worth naming: the three direct-to-binary Skills — `qc-skill`,
`media-analysis-skill`, `ffmpeg-skill` — have no `dependencies` field to fill in the same
way the six delegating Skills do, so their retrofit is slightly different in shape, not
harder; and any Skill whose retrofit surfaces a genuine schema gap should feed that back
into Phase 1's schema rather than freelancing an extension, to avoid re-diverging the
exact inconsistency Phase 1 exists to fix.)

**Risk/uncertainty: low overall, uneven per Skill.** This is still accurately described
as "mostly additive" in aggregate — every Skill already has the underlying mechanism,
and none needs new capabilities built. But the per-Skill breakdown above shows the real
variance is bigger than "low" alone implies: `video-editing-skill` is near-zero-effort,
while `audio-production-skill` / `color-grading-skill` / `motion-graphics-skill` include
a real design decision (whether nested operations become independently addressable).
Treat each Skill's Phase 2 entry as its own risk estimate. The main risk that *is*
uniform across all 10 is a Skill author treating this as a chance to also change
*behavior* rather than only *contract output* — worth calling out as a discipline point,
not a technical risk.

---

## Phase 3 — Fix the qc-skill/media-analysis-skill collision + real Provider resolution

**Status: CURRENT / IMPLEMENTED as of 2026-09-06, for items 1-2.** Item 1 (both
`qc-skill` and `media-analysis-skill` registering as Providers of
`measure.audio.loudness` / `measure.audio.silence` / `measure.audio.integrity`) was
already done as part of each Skill's Phase 2 contract retrofit — confirmed by reading
both Skills' `contract.py`, not assumed. Item 2 (the three-tier collision-resolution
policy replacing `SkillRegistry.select_tool()`'s hardcoded first-match-wins) is
implemented in `video-production-agent` PR #42: `select_tool(name, caps, supports,
explicit=None, default=None)` now applies, only when 2+ Providers are actually usable
(the 4 real collisions confirmed live: `media_probe` / `silence_analysis` /
`loudness_analysis` between ffmpeg-skill and media-analysis-skill, `silence_cleanup`
between ffmpeg-skill and video-editing-skill), an explicit `--set
provider.<skill>=<package>` requirement (Tier 1) → a workspace `providers.json`
overriding the OS's own baked-in default, which reproduces today's ffmpeg-skill-wins
behavior with zero configuration (Tier 2) → loud refusal naming the candidates and how
to resolve it, never an arbitrary pick (Tier 3). Verified against the re-established
baseline this roadmap's own risk note called for, not the unverified self-reported
99/99: full unit suite (197 passed; 4 pre-existing environment-only failures, confirmed
identical on `main` before this change) and the full real-Skill integration suite —
real ffmpeg, ffmpeg-skill, media-analysis-skill, video-editing-skill,
audio-production-skill, subtitle/thumbnail/color-grading/motion-graphics/qc-skill, no
mocks — 48 passed, 0 failed (up from 45, +3 covering the real collision end-to-end).

**Delivers:**
1. `qc-skill` and `media-analysis-skill` both register as Providers of
   `measure.audio.loudness`, `measure.audio.silence`, and `measure.audio.integrity` (the
   three confirmed collisions in `CAPABILITY_MATRIX.md` §8a) using the Phase 1/2
   machinery — this alone converts silent duplication into a visible, queryable registry
   fact, which is most of the value of this phase.
2. Implementation of `CAPABILITY_MODEL.md`'s three-tier collision-resolution policy
   (Plan-time explicit `provider_id` → Workspace/OS default-provider policy file →
   registry refusal with a named, actionable error) inside `video-production-agent`'s
   `SkillRegistry`, **replacing** its current hardcoded, ordered-candidate-list
   `select_tool()` (today: "picks the first candidate whose adapter is registered and
   whose capability is AVAILABLE" — a silent default this phase explicitly removes).

**Depends on: Phase 1 + Phase 2, genuinely, not just numerically.** `CAPABILITY_MODEL.md`
itself states the collision policy needs "a real definition of 'a Provider registration'"
— that definition does not exist until Phase 1's schema defines what a Provider
registration *is* and Phase 2 gets both `qc-skill` and `media-analysis-skill` actually
publishing one. Attempting Phase 3 first would mean inventing a registration format
ad hoc inside `video-production-agent`'s codebase, which is exactly the kind of
one-off, non-reusable fix `CAPABILITY_MODEL.md` was written to avoid.

**Risk/uncertainty: moderate.** The policy itself is already fully specified in
`CAPABILITY_MODEL.md` — the risk is entirely in `video-production-agent`'s side: rewiring
`SkillRegistry.select_tool()` touches a component the orchestrator's own eval suite
(99/99 self-reported) presumably exercises, so this phase needs to prove the eval suite
still passes with real Provider selection instead of first-match-wins, not just that the
new code compiles. `REPOSITORY_MAP.md` explicitly flags that these self-reported test
counts were never independently re-run, so this phase should re-establish a verified
baseline before changing the selection logic, not assume the reported 99/99 as ground
truth going in.

---

## Phase 4 — Cross-Skill Execution/Artifact model (real registry-driven discovery)

**Status: PARTIALLY IMPLEMENTED as of 2026-09-06** (`video-production-agent` PR #43) —
deliberately scoped down from this phase's full "moderate-to-high risk" vision after
cross-checking `ARTIFACT_MODEL.md`'s `produced_by` shape against the actual `Artifact`
dataclass first: `skill_version`/`operation_id` already existed as `tool_version`/
`operations`, so only the genuinely-missing `capability_id` (producing skill name) and
`provider_id` (executing package) fields were added, both additive with no migration.
`derived_from` is implemented exactly as `ARTIFACT_MODEL.md` §3 itself scopes it — "a
projection of information the Plan/Operation model already has," not the traversal/query
API that section explicitly defers. `Service.adapter()`'s remaining four hardcoded
per-Skill branches were unified into the same capability-driven table already used for
five other Skills, with `ffmpeg-skill` (the Reference Skill) deliberately kept as a
special first case rather than folded into a false uniformity that would change its
fail-fast behavior. **Not done, and explicitly deferred**, consistent with this section's
own framing of a generic third-party-loadable adapter interface and an OS-level
`capability_id` taxonomy as Phase 7 concerns: the Executor still does not resolve
adapters from a registry at execution time (`Service.adapter()` is still called once per
Service, still Skill-aware code, just table-shaped instead of branch-shaped); `Operation`
does not yet carry `capability_id`/`provider_id` itself (only the registered `Artifact`
does, after the fact). Verified: full unit suite 198 passed (4 pre-existing environment-
only failures, unrelated) and full real-Skill integration suite (real ffmpeg + all 9
Skills, no mocks) 48 passed, 0 failed — byte-for-byte behavior-preserving.

**Delivers:** the generalized `Artifact` identity/derived-from graph (`ARTIFACT_MODEL.md`,
per `SPEC.md` §2 — content-hash identity, `produced_by`, `derived_from` links) and
idempotent `Operation` execution (`SPEC.md` §4) running against the Phase 1–3 registry,
**replacing** `video-production-agent`'s current hardcoded `Service.adapter()` manual
wiring — today explicitly "no package loader, plugin manager or dynamic import" — with
real capability-driven discovery: an Operation names a `capability_id` and (per Phase 3's
policy) an optional `provider_id`, and the Executor resolves which Skill/adapter to
invoke from the registry rather than from a hand-edited `Service.adapter()` table.

**Depends on: Phase 3.** Registry-driven discovery is meaningless without Phase 3's
resolution policy already in place — otherwise "the registry has two Providers for this
Capability" has no defined answer for what the Executor should do, which is precisely the
failure mode Phase 3 exists to close before Phase 4 starts routing real executions through
it.

**Risk/uncertainty: moderate-to-high.** This is the first phase that touches
`video-production-agent`'s actual execution path (`execution/compiler.py` →
`execution/executor.py`), not just its discovery/registration layer. The existing
`FORBIDDEN_ARG_KEYS` security check, per-process-group subprocess isolation, and
`idempotency_key`/`render --resume` machinery must all continue to work unchanged — this
phase is additive to *how discovery happens*, not a rewrite of *how execution happens*
(§"what does not change," below). The main uncertainty is integration risk: this is the
largest single code-change phase in the roadmap, touching a component with real existing
behavior (187 unit / 90 adapter tests, self-reported) that must not regress.

---

## Phase 5 — QC/Verification extension: verify against declared Plan intent

**Delivers:** extends `qc-skill`'s existing verification (already the reference
implementation for the OS's QCReport shape, per `SPEC.md` §5) to validate a completed
`ProductionPlan`'s outputs against that Plan's **declared intent** — not only inspect a
final file in isolation, as it does today. This is `QC_ARCHITECTURE.md`'s proposed
extension: e.g., a Plan step that declares "target: EBU R128 loudness normalization" can
be checked as "did the actual output achieve what this specific step asked for," not just
"is loudness within some generic acceptable range."

**Depends on: Phase 4, genuinely.** Verifying against a Plan's declared intent requires
knowing which `Operation` produced which `Artifact` and what that Operation's typed
parameters declared as its target — i.e., it requires the provenance links (`produced_by`,
`derived_from`) that Phase 4's Artifact model creates. Attempting this before Phase 4
would mean re-deriving an ad hoc "what was this file supposed to be" lookup instead of
reading it off the Artifact graph, duplicating exactly the kind of ad hoc provenance
`qc-skill`'s own identity scheme was designed to avoid.

**Risk/uncertainty: moderate.** `qc-skill`'s own ADR-001 boundary ("not an AI agent, does
not make production decisions") must be preserved exactly — this phase extends *what
qc-skill checks against*, not *what qc-skill is allowed to decide*. The risk is scope
creep into QC making or implying decisions; the mitigation is that this phase adds new
`QCFinding`s and `QCCheck`s (already-established types, unchanged shape) with a Plan
reference as new input, not new verdict semantics beyond PASS/WARN/FAIL/UNKNOWN.

---

## Phase 6 — Provenance/ProductionReceipt

**Delivers:** implements the `ProductionReceipt` artifact type from `SPEC.md` §6 — the
final, emitted-once Artifact answering "what happened, why, with what tools, did it pass
verification" for one completed Plan, composing `input_artifact_ids`/`output_artifact_ids`,
`skill_versions`, `tool_versions`, `decisions`, `qc_report_ids`, `warnings`, `failures`.

**Depends on: Phase 4 + Phase 5, both, genuinely.** A ProductionReceipt is explicitly
defined as the *composition* of Phase 4's execution provenance (which Operations ran,
producing which Artifacts, from which Skill/tool versions) and Phase 5's QC results
(whether the Plan's declared intent was actually verified as met). It cannot be built from
either alone — this is not a numbering convenience, it is what a receipt *means*: a record
that both "this ran" and "this was checked" are true together.

**Risk/uncertainty: low-to-moderate.** The component parts (`qc-skill`'s identity scheme,
`ProjectIR.provenance`'s existing fields) already exist and already agree with each other
in shape, per `CORE_PRIMITIVES.md` §10 — this phase is genuinely composition work, not
new-concept work. The main uncertainty is emission timing/idempotency edge cases (what
happens to a Plan's receipt if a later re-run partially reuses cached Artifacts) —
undesigned territory today.

---

## Phase 7 — Third-party Skill support (dynamic discovery + published conformance harness)

**Delivers:** the actual dynamic discovery mechanism that lets a Skill join the ecosystem
without any OS-core or Agent-core code change — replacing today's manual registration
(Phase 1–4's registry is still queried by explicit registration, not auto-discovered from
a filesystem/network scan) with real dynamic loading, plus a **published**, externally-
runnable version of Phase 1's conformance harness so a third-party developer (not one of
this ecosystem's own repo authors) can self-certify a new Skill against the OS without
reading any of this project's source.

**Depends on: Phase 1–4 being stable and battle-tested internally first — this is an
explicit, argued sequencing choice, not a default "do it last because it's numbered
last."** The reasoning, concretely:

- Every conformance check in `SKILL_SPEC.md` §8 was derived from patterns **already found
  working** across the 10 existing Skills (the FORBIDDEN_KEYS union, the AST-walk pattern,
  the path-containment pattern). A plugin/conformance model designed and published
  *before* the internal ecosystem has actually run Phase 1–4's registry, collision policy,
  and execution model in anger is a model built from zero real third-party evidence — it
  is exactly the "architecture astronautics" `ARCHITECTURE.md` §9 (lens 5) explicitly
  argues against elsewhere in this project, applied here to the plugin surface instead of
  the resource scheduler.
- Concretely, until Phase 3 has actually resolved a real collision
  (`measure.audio.loudness`) and Phase 4 has actually routed a real execution through
  registry-driven discovery instead of `Service.adapter()`, there is no internal
  experience to answer basic third-party-facing questions this phase must get right: how
  strict should collision refusal be for an unknown third-party Provider (§`CAPABILITY_MODEL.md`
  favors *stricter* refusal than internal defaults — has that actually been livable
  in Phase 3–4's internal experience?); does the conformance harness's black-box
  shell-injection probe (`SKILL_SPEC.md` §8 item 3) actually catch anything the AST-walk
  variant used internally wouldn't, in practice, across the existing 10 Skills; does the
  registry's flat-lookup-by-id design (`SPEC.md` §7 — "sufficient for 11 repos, ~60
  operations") hold up once a third party's Skill count is unknown/unbounded.
- Publishing this too early risks locking in a plugin contract informed by zero real
  external adoption pressure, which is a worse failure mode than being "late" to
  third-party support — a contract is far more costly to break once external parties
  depend on it than an internal-only registry is to iterate on.

**Risk/uncertainty: highest in this roadmap, along with Phase 8.** No repository in
`REPOSITORY_MAP.md`'s audit is written by anyone outside this ecosystem's single owner
(`kajisho5`) — there is **zero evidence today** of what a genuinely independent third-party
Skill author would find confusing, underspecified, or actively hostile in this contract.
Every design choice in Phase 1–4 was validated against patterns 10 internally-authored
Skills converged on independently; that is real but weaker evidence than one external
Skill actually attempting to conform. This phase should budget for at least one real
external pilot integration before calling the harness final, not just a documentation
release.

---

## Phase 8 — Advanced agent autonomy, resource-aware provider selection, cost modeling

**Delivers:** anything in the category of concurrency/resource scheduling, cost-aware
Provider selection (e.g. choosing a cheaper/faster Provider under load), or materially
more autonomous Agent behavior beyond what `video-production-agent`'s current
deterministic Observation/Inference/Decision pipeline already does.

**Depends on:** everything above being in place first, and — more importantly than the
ordering — **explicitly LOW PRIORITY**, independent of how many other phases are done.

**Why this is explicitly deprioritized, not just sequenced last:** `REPOSITORY_MAP.md`
found **zero evidence of scale or resource-scheduling need anywhere in the audited
ecosystem today** — no repo shows more than a handful of concurrent operations, no CPU/
GPU/concurrency scheduling exists anywhere, and `ARCHITECTURE.md` §10 already made the
deliberate choice to keep the Resource model minimal for exactly this reason. Building
Phase 8 before real evidence of a scaling problem is the same architecture-astronautics
failure mode Phase 7's sequencing argument names, applied to a different subsystem: this
project should not design a scheduler or a cost model for a load pattern nobody has hit.
The correct trigger for starting Phase 8 is observed evidence (a real Workspace running
enough concurrent Operations, or with enough Provider choices per Capability, that manual/
default-policy selection genuinely becomes a bottleneck) — not the calendar or the roadmap
number.

**Risk/uncertainty: highest in this roadmap, tied with Phase 7, for the same underlying
reason** — no evidence anywhere in the ecosystem to design against yet. Anything written
here today would be speculative in a way none of Phase 1–6 is.

---

## What changes about `video-production-agent`, and what does not

**What does NOT change, at all, in Phase 1–2:** `video-production-agent`'s existing
`Observation → Event → Inference/Decision → ProductionPlan → Project IR → Compiler →
Operation → Executor(ToolRouter) → Artifact → QA` pipeline is **preserved throughout this
entire roadmap, not rewritten at any phase.** `ARCHITECTURE.md` §2 and §9 (lens 6, lens 7)
already establish that this pipeline, the `FORBIDDEN_ARG_KEYS` security pattern, and the
provenance/artifact model were **independently designed correctly** and are adopted, not
reinvented. Phase 1 and Phase 2 specifically require **zero changes** to how
`video-production-agent` currently works — Phase 1 is schema/library work that lives
outside `video-production-agent`'s repo entirely, and Phase 2 is other Skills' contract
output changing, which `video-production-agent` does not even need to consume yet. This is
pure additive schema work landing in the *ecosystem*, not a modification to the
*orchestrator*.

**What changes, and starting when:**

- **Phase 3** is the first phase that touches `video-production-agent`'s code at all —
  specifically `SkillRegistry.select_tool()`'s Provider-selection logic, replacing
  first-match-wins with the explicit collision policy. The Observation/Inference/Decision
  types, the Plan/Compiler/Operation shapes, and the security boundary are untouched by
  this phase.
- **Phase 4** touches the Executor/discovery layer (`Service.adapter()` → registry-driven
  discovery) and generalizes the `Artifact` dataclass — but the *Operation* and
  *Execution* concepts themselves keep the shape `SPEC.md` §4 already documents as
  "generalizes `video-production-agent`'s `execution/compiler.py` → `Operation` →
  `execution/executor.py` chain, **unchanged in shape**." This is a rewiring of *how a
  Capability is found*, not a redesign of *what running one means*.
- **Phase 5–6** add new capabilities (Plan-intent-aware QC, ProductionReceipt emission)
  that consume `video-production-agent`'s existing provenance fields
  (`ProjectIR.provenance`) rather than replacing them.
- At no phase does this roadmap propose extracting `video_agent.models.{Observation,
  Inference, Decision,...}` into a separate `avpos-contracts` package — `ARCHITECTURE.md`
  §3 names that as a real candidate refactor but explicitly defers the decision of
  whether/when to do it, and this roadmap does not resolve that open question either; it
  is compatible with doing so at any point after Phase 1 (once there is an OS contract
  package for those types to move into) but does not require it at any specific phase.

**The test this section applies, per `ARCHITECTURE.md` §3's boundary rule:** would
`video-production-agent`'s Observation/Inference/Decision/Compiler/Executor pipeline still
make sense, unchanged, if this whole roadmap were being executed by a different Agent
instead? Yes, at every phase — nothing in Phase 1–8 requires `video-production-agent`
specifically to exist; it requires only that *some* Agent consume the OS contracts this
roadmap builds. `video-production-agent` is this roadmap's first, currently-most-complete
consumer, exactly as `ARCHITECTURE.md` §1 already frames it — never the thing being
redesigned for its own sake.

---

## Summary dependency chain

```
Phase 0 (research, substantially complete)
   │
   ▼
Phase 1 (Capability Contract schema + registry library + conformance skeleton)
   │  — no dependents can start meaningfully before this
   ▼
Phase 2 (Skill-by-Skill contract retrofit)  ◄── the one genuinely parallelizable phase
   │
   ▼
Phase 3 (collision resolution + real Provider policy in SkillRegistry)
   │
   ▼
Phase 4 (registry-driven Execution/Artifact model, replacing Service.adapter())
   │
   ├──────────────┐
   ▼              │
Phase 5 (QC vs.   │
 Plan intent)     │
   │              │
   └──────┬───────┘
          ▼
Phase 6 (ProductionReceipt — needs BOTH Phase 4 and Phase 5)

Phase 7 (third-party dynamic discovery)  — deliberately gated on Phase 1–4 being
                                             internally battle-tested first, highest
                                             design uncertainty
Phase 8 (autonomy / resource-aware selection / cost modeling)  — explicitly low
                                             priority, no current evidence of need,
                                             highest design uncertainty tied with Phase 7
```
