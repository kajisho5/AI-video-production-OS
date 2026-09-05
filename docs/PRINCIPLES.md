# Architectural Principles

Status: **Derived, draft, 2026-09-05.** Every principle below is induced from a specific
decision already made — and evidenced — in `REPOSITORY_MAP.md`, `CORE_PRIMITIVES.md`,
`CAPABILITY_MODEL.md`, `ARCHITECTURE.md`, `SPEC.md`, `SECURITY_MODEL.md`, and
`QC_ARCHITECTURE.md`. None is introduced because it sounds like good general software
advice; each is stated precisely enough that a reviewer could point to the sentence(s) in
this project's own documents that produced it. Tags follow `DESIGN_SYSTEM.md` §2:
**CURRENT** (the principle is already enforced in code somewhere in the audited
ecosystem), **PROPOSED** (this project's documents generalize an existing pattern into an
OS-wide rule, not yet mandatory everywhere), **FUTURE** (named as a direction, not yet
built anywhere).

## How to read this document

Each principle has: a one-line statement, the evidence it is derived from (cited by
document and section), and a short note on what it rules out — a principle that doesn't
forbid some design a naive reader might otherwise reach for isn't doing any work.

## 1. AI decides WHAT, Runtime controls HOW

**PROPOSED, generalizing CURRENT enforcement.** An Agent may choose *what* should
happen — which Capability to invoke, with which parameters, in what order
(`ARCHITECTURE.md` §3, "What the Agent may do"). It may never choose *how* that happens
at the execution level — no Agent output is permitted to become a raw shell command,
filter string, or argv override. This is not aspirational: `FORBIDDEN_KEYS`/
`FORBIDDEN_ARG_KEYS` (`SECURITY_MODEL.md` §1.1, independently reimplemented in at least
seven repos) blocks exactly the parameter keys — `command`, `argv`, `shell`, `exec`,
`filter`/`filter_complex` — that would let an Agent's choice bleed into the *how*. The
OS/Agent boundary in `ARCHITECTURE.md` §3 states the same rule at the type level ("The OS
owns the *shape*... The Agent owns the *logic*") and at the security level ("an Agent
never emits a raw shell command or unvalidated filter string in place of a typed
Operation — already enforced by `FORBIDDEN_KEYS` at every existing Skill boundary").
**Rules out:** any design where a Plan step's `params` could carry an escape hatch (a raw
argv list, an inline filter graph) that bypasses a Capability's typed `input_schema`.

## 2. Data is not instruction

**PROPOSED, motivated by a CURRENT, unpatched gap.** Text a Skill extracts from untrusted
media — subtitle cues, container metadata, filenames — must be tagged `untrusted_text` in
the Capability Contract's `output_schema` and treated by any downstream prompt-
construction step as data to reason about, never as a command to obey
(`SECURITY_MODEL.md` §7). The evidence is specific and already present, not hypothetical:
`subtitle-skill`'s cue-text validation is structural only (control characters, line
length, reading speed) and has no defense against that validated-but-unsanitized text
later being concatenated into an LLM prompt (`REPOSITORY_MAP.md`, `subtitle-skill`
section; `SECURITY_MODEL.md` §7). The mitigation is explicitly a schema annotation, not a
sanitizer — `SECURITY_MODEL.md` §7 rejects content-stripping and LLM-based
injection-detection as themselves nondeterministic components making a security decision
without evidence they're needed. **Rules out:** any Agent-side code that concatenates a
Skill's raw text output directly into an instruction-bearing region of a prompt without
first checking whether the Capability Contract tagged that field `untrusted_text`.

## 3. Capability over Skill

**CURRENT as motivating bug, PROPOSED as the fix.** "What can be accomplished" and "what
package ships the code" must be two different, separately-named concepts, because
conflating them already produced a real defect: `qc-skill` and `media-analysis-skill`
each independently implement loudness, silence, and decode-integrity measurement with no
shared identity between them (`REPOSITORY_MAP.md` finding 2), and no mechanism existed to
even notice this was duplication rather than divergent design. `CAPABILITY_MODEL.md`'s
opening line states this is "derived from `REPOSITORY_MAP.md` evidence... designed
specifically to fix one real problem found during the audit," not designed in the
abstract. Under the Capability/Provider split, both Skills register as Providers of
`measure.audio.loudness`, turning silent duplication into a visible, resolvable registry
fact with an explicit collision policy (`CAPABILITY_MODEL.md` §Capability collision
policy). **Rules out:** a Plan, contract, or registry that names a Skill directly
(`qc-skill/loudness`) where it should name the accomplishable thing
(`measure.audio.loudness`) plus an explicit or defaulted Provider.

## 4. Constraints are not preferences

**CURRENT, already enforced in code.** `video-production-agent`'s `Decision` type
carries a `basis` field distinguishing policy/preference/constraint provenance
(`CORE_PRIMITIVES.md` §5), and its `policy/rules.py`/`decision_engine.py` already
separates hard constraints (which a Decision may never violate) from soft preferences
(which shape a choice among otherwise-valid options) as the deterministic rule engine
that drives Decisions with zero AI provider in the loop (`ARCHITECTURE.md` §4,
`REPOSITORY_MAP.md`'s "AI coupling" finding). This document does not invent the
separation — it is existing, working code, kept as-is precisely because it already
satisfies the discipline the rest of this project argues for elsewhere: a preference can
be overridden or traded off, a constraint cannot. `SYSTEM_CONSTRAINTS` hard-coding
`execution.no_raw_shell` and `execution.recovery.max_attempts=2`
(`REPOSITORY_MAP.md`, `SECURITY_MODEL.md` §4) is the same distinction applied at the
execution layer: these are constraints an Agent's preferences cannot relax. **Rules
out:** any design that collapses "the Agent would rather not" and "the system must not"
into one undifferentiated rules list — the two must remain separately provenanced so a
future policy engine can tell them apart.

## 5. Deterministic execution over opaque execution

**CURRENT, near-universal.** Every Capability invocation compiles to a typed `Operation`
with closed-vocabulary parameters, never a raw shell command or filter string
(`SPEC.md` §4; `ARCHITECTURE.md` §7). This is not one Skill's design choice — it is the
`FORBIDDEN_KEYS` denylist plus typed-operation pattern found identically, independently,
across every audited Skill boundary (`SECURITY_MODEL.md` §1, `SKILL_SPEC.md` §1): no
filter string is ever accepted from a caller (`REPOSITORY_MAP.md`, `ffmpeg-skill`
section); typed flags are individually range-checked and converted into filter-graph
fragments internally, with text/paths destined for filter graphs escaped, never
interpolated raw. Even `ffmpeg-skill`'s one non-canonical `{"argv": [...]}` escape hatch
"still only invokes the named script, never a shell" (`REPOSITORY_MAP.md`). **Rules
out:** a Capability Contract whose `input_schema` accepts an open-ended string destined
for direct interpolation into a command or filter graph, regardless of how convenient
that would be for a Skill author to implement quickly.

## 6. Agent independence, Provider independence

**CURRENT, verified, not aspirational.** The one Agent that exists today
(`video-production-agent`) runs its full deterministic pipeline — silence trim, loudness
normalize — with **zero** AI provider wired in: `providers/base.py` defines a generic
`AIProvider` interface, `NullProvider` is the only shipped implementation, and no
Anthropic/OpenAI SDK is imported anywhere in the repo (`REPOSITORY_MAP.md`,
`ARCHITECTURE.md` §4). This is not a goal stated for the future — it is the system's
current, working behavior, generalized by `ARCHITECTURE.md` §4 into a formal guarantee:
"a human, a deterministic rules file, or any LLM (Claude, GPT, Gemini, local) can drive
the same contracts." The same independence, one layer down, is what motivates the
**FUTURE** `Provider` concept (`CORE_PRIMITIVES.md` §3): a Capability like
`measure.audio.loudness` should be implementable by more than one backend
(`qc-skill`, `media-analysis-skill`, and someday others) without the Capability's
identity depending on any one of them, exactly as `transcription-skill`'s own
`engines/registry.py` already does one level down inside a single Skill
(`CORE_PRIMITIVES.md` §3). **Rules out:** any OS-core code path that imports a specific
model vendor's SDK, or any Capability Contract shape that can only be satisfied by one
named Provider.

## 7. Local-first, provider-optional, network-explicit

**CURRENT, confirmed by absence across the whole ecosystem.** No repository in the
11-repo audit talks to a network service today (`SPEC.md` §7: "no repo in the ecosystem
talks to a network service today"). This is why `SECURITY_MODEL.md` explicitly declines
to invent a network security model or an authentication/authorization scheme — "this
document does not invent a network security model the ecosystem has no evidence of
needing yet" (`SECURITY_MODEL.md` header) — and why `PLUGIN_MODEL.md` §4 treats network
access as an exceptional declaration a plugin must call out, not a default capability:
"a plugin declaring any network need is a deviation from that norm and should be treated
as exceptional." **Rules out:** any OS-core contract, kernel item, or default Runtime
behavior that assumes network reachability (a remote registry, a cloud cache, a hosted
capability) as anything other than an explicitly-declared, non-default exception a
specific plugin opts into.

## 8. Artifact-first, content-addressed identity

**CURRENT precedent, PROPOSED as universal.** An Artifact's identity must be a content
hash of its bytes (or canonical JSON, for structured types) — never a path, never an
mtime, never a timestamp (`SPEC.md` §2; `ARTIFACT_MODEL.md` §1). This generalizes
`qc-skill`'s already-correct scheme, `identity = sha256(canonical_json({skill,
skill_version, kind, operation, asset_fingerprints, effective_parameters, rules,
ffmpeg_version, ffprobe_version}))`, explicitly excluding timestamps/paths/`request_id`
(`REPOSITORY_MAP.md`, `qc-skill` section) — "the cleanest reproducibility-identity design
found anywhere in the ecosystem" (`CORE_PRIMITIVES.md` §7). Two Artifacts with identical
content hashes **are** the same Artifact regardless of where on disk they live, what they
were called, or when they were written (`ARTIFACT_MODEL.md` §1) — this is what makes
caching and dedup possible without a central sameness authority. **Rules out:** any
Artifact reference, cache key, or dedup check keyed on filesystem path or wall-clock
time instead of content.

## 9. QC measures, it does not decide

**CURRENT, enforced in code, elevated to an OS-wide rule.** `qc-skill`'s own ADR-001 —
"qc-skill is not an AI agent and does not make production decisions" — is verified not
just as a documentation claim but at the code level: "no decision/render/publish/block
logic exists in the code outside boundary-documentation comments"
(`REPOSITORY_MAP.md`, `QC_ARCHITECTURE.md` §3). This project's ADR-007 elevates the same
boundary from one Skill's convention to a requirement for **any** verification
Capability: it "may produce Observations, Measurements, Findings, and Reports, but must
contain zero decision, render, publish, or block logic" — consuming a Report to decide
what happens next is exclusively the Agent's responsibility, mediated through the
`Decision` type. A `QCReport.overall_status = FAIL` is a fact about measured reality
against a stated threshold, never an instruction to re-render (`ARCHITECTURE.md` §3).
**Rules out:** any future verification Capability (QC-like or analysis-like) that gains
side-effecting behavior — auto-retry, auto-block, auto-publish — without an Agent or
human Decision authorizing it first.

## 10. Simple now, extensible later — no abstraction without concrete evidence

**CURRENT discipline, demonstrated by what was deliberately cut.** `ARCHITECTURE.md` §9's
red-team pass names, by lens, exactly what was kept and what was cut, and why: the
Capability lifecycle was trimmed from the task brief's suggested 7 states to 5 because
"no evidence supports finer granularity" (§9, lens 1; `CAPABILITY_MODEL.md` §Capability
lifecycle); a scheduler/resource model was excluded from the kernel entirely because "no
evidence anywhere in the ecosystem shows a need for one yet" (§9, lens 5; §10, Resource
model). The same discipline recurs project-wide: `EXECUTION_MODEL.md` §0 explicitly
declines a scheduler, concurrency model, and distributed execution; `PLUGIN_MODEL.md` §9
declines a package index, rating system, or sandboxing mechanism as premature relative to
zero third-party Skills existing yet to design around. **Rules out:** designing for scale,
concurrency, or flexibility the ecosystem has not produced evidence of needing — "solving
a problem that does not yet exist" is named explicitly, more than once, as the failure
mode this principle exists to prevent.

## 11. Inspectable state over hidden state

**CURRENT, universal across every audited Skill.** Every Skill and `video-production-agent`
itself expose a plain CLI with `--dry-run`/`--json` support, usable by a human with no AI
involved at all (`ARCHITECTURE.md` §11, final architectural test: "Can a human operate the
OS without an AI agent? Yes, and this is intentional and already demonstrated"). A `doctor`
command reporting AVAILABLE/MISSING per capability, and a `contract --json` command
emitting a machine-readable spec, are both confirmed present in all 10 audited Skill repos
(`SKILL_SPEC.md` §1) — "what's installed, what's AVAILABLE, what ran" is explicitly listed
among what the OS may expose (`ARCHITECTURE.md` §3). **Rules out:** any Capability, Plan
state, or Runtime decision that is only observable by reading source code or internal
logs rather than through a documented `--json`/`doctor`/`contract` surface.

## 12. Convergent, independent design is the strongest evidence available

**CURRENT, the meta-principle behind the Runtime and Security models.** When the same
primitive is independently invented, in slightly different words, by multiple authors
who could not have copied each other, that convergence is treated as stronger evidence
than any single author's stated intent. `SECURITY_MODEL.md` states this directly: the
five security primitives (`FORBIDDEN_KEYS`, symlink-resolved path containment,
`shell=False`, workspace confinement, process-group timeouts) were "found independently —
not copied from a shared library, since no such library exists yet — across
`ffmpeg-skill`, `qc-skill`, `media-analysis-skill`, `video-editing-skill`,
`audio-production-skill`, `color-grading-skill`, and `transcription-skill`" (§1), and
`REPOSITORY_MAP.md` finding 3 calls this "the strongest possible evidence that these
primitives belong in a shared OS-level contract... rather than being re-derived by every
future Skill author." The single-adapter-module delegation pattern to `ffmpeg-skill`
(verified by AST-walking tests in two repos, present in three more) is the same argument
applied to composability (`REPOSITORY_MAP.md` finding 1). **Rules out:** treating a
pattern found in only one repo with the same weight as one independently re-derived
across many — this project distinguishes "one author's choice" from "convergent design"
explicitly, and only generalizes the latter into the OS kernel.

## 13. A schema that cannot drift from its implementation beats one that can

**CURRENT precedent, PROPOSED as the general contract pattern.** `ffmpeg-skill`'s
`scripts/_contract.py` "generates a live, machine-readable `ToolSpec` per script directly
from that script's own `argparse` parser — the schema cannot drift from the
implementation because it *is* the implementation, introspected"
(`REPOSITORY_MAP.md`). `ARCHITECTURE.md` §5 and this project's ADR-010 generalize exactly
this property to interface generation broadly: an MCP server, a CLI, and other-language
bindings should all be *derived from* one Capability Contract rather than hand-written
and independently maintainable-out-of-sync with each other. This is also why the
Capability Contract format is specified as *shape*, not implementation (`SPEC.md` header)
— a contract whose truth depends on a human keeping two documents in sync is weaker than
one where drift is structurally impossible. **Rules out:** a hand-maintained schema file
or README table describing a Skill's interface that a code change can silently
invalidate without the schema failing to generate or validate.

## 14. Structural rejection, not subjective review

**PROPOSED, explicit design choice.** A Skill (in-house or third-party) is admitted or
rejected from the ecosystem by deterministic, automatable checks — does its
`CapabilityContract` validate against `SPEC.md`'s shape, does it pass the black-box
conformance suite, does it declare permissions consistent with what its conformance
tests actually enforce (`PLUGIN_MODEL.md` §7) — never by a maintainer's subjective
opinion of its code quality, algorithm choice, or licensing (`PLUGIN_MODEL.md` §7,
explicitly: "OS-compatibility is a contract-and-conformance fact, never a maintainer's
subjective code review"). `SKILL_PROPOSAL.md` §1.9 states the same principle for the
proposal-review side. **Rules out:** any admission gate for a new Skill or Capability
that depends on a human reading and approving its source code as the deciding step,
rather than passing a written, automatable conformance specification.

## 15. Observation, Inference, and Decision are typed and never conflated

**CURRENT, adopted as-is, the one part of the ecosystem that already gets this right by
construction.** `video-production-agent`'s Observation (`provenance="OBSERVED"`,
evidence, never overwritten by inference), Inference (an interpretation that must cite
the Observations it is based on), and Decision (subject/type/risk/approval/basis with
mandatory `evidence`) are three distinct, typed objects, never an implicit side effect of
a measurement or a raw model completion (`CORE_PRIMITIVES.md` §5). `ARCHITECTURE.md` §3
names why this survives red-teaming intact: it is "the one part of the existing ecosystem
that already satisfies Rule 12 (don't let QC silently decide) and Rule 14 (don't let AI
reasoning silently become execution) by construction." AI output, when a provider exists,
is tagged `provenance="AI_GENERATED"`, treated as untrusted input requiring validation,
and "never becomes an executable Decision by itself" (`REPOSITORY_MAP.md`). **Rules out:**
any code path where a measurement's numeric result, or a model's raw text completion,
is consumed directly as if it were an approved Decision without passing through an
explicit, evidenced Inference/Decision step.

## 16. A naming collision is a bug to fix, not a detail to gloss over

**CURRENT finding, PROPOSED fix.** `video-production-agent`'s own source uses the word
"Skill" for two different things — an external package (`SkillPackage`, e.g. the
`ffmpeg-skill` repo) and an internal capability name (`SkillSpec`, e.g.
`silence_cleanup`) — and `CORE_PRIMITIVES.md` §2 treats this as "a real, present naming
ambiguity in the source, not a hypothetical concern," directly motivating the
Capability/Skill split. The same discipline produces the `Timeline` rename
(`CORE_PRIMITIVES.md` §8): `temporal/timeline.py` already exists and models event history,
not an edit timeline, so the two are kept as explicitly separate primitives that must not
share a name rather than quietly overloading one. **Rules out:** reusing an
already-loaded term for a new concept because it "basically means the same thing" —
`ARCHITECTURE.md` §9 lens 1 treats an overloaded name as a found bug worth a fourth noun
to fix, not a stylistic nitpick.

## 17. Self-declared non-responsibility is part of the contract

**CURRENT precedent, PROPOSED as universal.** `ffmpeg-skill`'s manifest carries an
explicit `not_provided` field — `["AI reasoning", "decisions", "production plans",
"project IR", "approvals", "network access", "transcription engine"]` — and
`REPOSITORY_MAP.md` calls this "the clearest piece of evidence in the ecosystem for the
Agent/OS/Skill boundary this project formalizes." `SPEC.md` §1 carries this field forward
into the general `CapabilityContract` shape. `media-analysis-skill`'s README explicitly
states what it does not do ("no AI... purely observational") in the same spirit. A Skill
that only states what it *does* is a weaker contract than one that also states what it
deliberately refuses — a caller cannot silently assume the wrong thing about scope it was
never told. **Rules out:** treating scope boundaries as something the reader infers from
what's absent in documentation, rather than something the contract states outright.

## 18. Verification identity excludes anything that changes without changing the answer

**CURRENT, precise design choice, generalized project-wide.** `qc-skill`'s `identity`
hash deliberately excludes timestamps, paths, and `request_id` — "identity is a fact
about *what would happen*, not a log line about *when it happened*"
(`PROVENANCE.md` §1). The same discipline governs `Operation.idempotency_key`
(`EXECUTION_MODEL.md` §3.2, derived from `{capability_id, provider_id, skill_version,
params, input_artifact_ids}`, explicitly not from a request id or timestamp) and every
proposed `ProductionReceipt`/Artifact identity scheme in this project. **Rules out:** any
identity, cache key, or reproducibility hash that includes wall-clock time, a random
request identifier, or a filesystem path — any of which would make two runs that would
produce an identical result register as different, defeating caching, dedup, and
reproducibility checking simultaneously.

## What this document deliberately does not include

- Generic software-engineering advice (DRY, SOLID, etc.) not specifically evidenced by a
  decision in this ecosystem's audited repos — a principle here must be traceable to a
  cited finding, not asserted as universally good practice.
- Principles about a UI, a scheduler, or network security — per Principle 10, no evidence
  exists yet that these domains need governing principles at all (`ARCHITECTURE.md` §8,
  §10; `SECURITY_MODEL.md` header).
- A ranking or priority order among the principles above — where two might appear to
  conflict in a specific design (e.g. Principle 1's typed-operation discipline vs.
  Principle 10's anti-abstraction discipline), resolving that conflict is a case-by-case
  judgment for the relevant technical document (`CAPABILITY_MODEL.md`,
  `SECURITY_MODEL.md`, etc.), not something this document arbitrates in the abstract.
