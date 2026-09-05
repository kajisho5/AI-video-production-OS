# Open Architectural Questions

Status tagging convention as elsewhere: **CURRENT**, **FUTURE**, **EXPERIMENTAL**,
**UNKNOWN**. Every question below is drawn from an explicit open item already named in
one or more of `ARCHITECTURE.md`, `SPEC.md`, `CAPABILITY_MODEL.md`, `EXECUTION_MODEL.md`,
`PROVENANCE.md`, `VERSIONING.md`, `SECURITY_MODEL.md`, `ARTIFACT_MODEL.md`,
`FAILURE_RECOVERY.md`, `PLUGIN_MODEL.md`, `ROADMAP.md`, or `COMPETITIVE_ANALYSIS.md`, or
from a gap made visible by reading them together (e.g. a schema field two documents both
depend on but neither finalizes). Nothing here restates a question those documents already
answer — where a document proposes a specific resolution and no other document
contradicts it, that is treated as decided, not open.

## How the four tiers are applied

- **BLOCKING** — the question gates something Phase 1 (`ROADMAP.md`) must ship; Phase 1
  cannot be honestly called complete while it is open.
- **IMPORTANT** — needed for the roadmap's near-to-mid-term work (Phases 2 through 6:
  contract retrofit, collision resolution, registry-driven execution, Plan-aware QC,
  ProductionReceipt) but does not block Phase 1 from starting or shipping.
- **FUTURE** — a Phase 7+ concern (third-party Skills, resource-aware autonomy) or a
  question multiple documents already say has no current evidence of need — correctly
  left open for years, not a gap in this documentation set.
- **OPTIONAL** — worth knowing, resolved whenever convenient, blocks nothing on the
  roadmap at any phase.

---

## BLOCKING — must be answered before Phase 1 implementation starts

### B1. Should the conformance test suite be a downloadable harness or a written specification?

`ARCHITECTURE.md` §12 names this explicitly as carried into `ROADMAP.md` unresolved: "a
real trade-off between rigor and adoption friction that has no evidence-based answer
yet." `ROADMAP.md` Phase 1 item 3 already *commits to a deliverable* — "the conformance
test suite skeleton... implemented as a runnable harness skeleton, even if individual
checks start as stubs" — and its own risk section argues for resolving the question this
way ("building it now, even minimally, is lower-risk than deferring the decision
again"). But no ADR has recorded this as decided (`GOVERNANCE.md` §2's ADR trigger —
"any decision that changes... the boundary between the OS and an Agent/Skill" — applies
directly, since the conformance suite *is* how that boundary gets enforced against
non-cooperating Skills, `SECURITY_MODEL.md` §2). Phase 1's third deliverable is
concretely different in shape (code to build vs. prose to publish) depending on the
answer, so this cannot be deferred past Phase 1's start without Phase 1's scope being
genuinely undefined.

### B2. The Artifact type enum is incomplete, and Phase 1's schema embeds it

`ARTIFACT_MODEL.md` §2 confirms a real gap: `transcription-skill` produces `Transcript`
and `SpeechEvent` records that are "not currently named in `SPEC.md`'s type list,"
calling this "an open gap in the enum... **FUTURE** (naming/schema work), not designed
further in this document." This cannot be left to "whenever a Skill needs it" the way
`ARTIFACT_MODEL.md` frames it, because Phase 1's own `CapabilityContract` schema
(`SPEC.md` §1) embeds `input_artifact_types`/`output_artifact_types` fields that are
typed against this exact same enum (`ARCHITECTURE.md` §12's Phase 1 formalizes "the
`CapabilityContract` JSON shape... as an actual JSON Schema document"). If the enum ships
incomplete, `transcribe.audio`'s Phase 2 contract retrofit (`ROADMAP.md` Phase 2) has no
correct value to declare for its own output type — a second, uncoordinated fix would
likely be freelanced at retrofit time, which `ROADMAP.md` Phase 2 explicitly warns
against ("any Skill whose retrofit surfaces a genuine schema gap should feed that back
into Phase 1's schema rather than freelancing an extension, to avoid re-diverging the
exact inconsistency Phase 1 exists to fix").

---

## IMPORTANT — should be answered during Phase 2-6, doesn't block Phase 1 starting

### I1. Where does Provider default-selection policy live: a Workspace config file, or the OS registry?

Named as open in two places independently: `ARCHITECTURE.md` §12 ("Whether Provider
default-selection policy lives in a Workspace config file or in the OS registry itself")
and `CAPABILITY_MODEL.md`'s collision policy mechanism 2, which describes it only as "an
OS-level or Workspace-level config file" without choosing between the two. This is a real
fork: an OS-level default applies uniformly across every Project using that OS
installation; a Workspace-level default lets two Workspaces on the same machine resolve
the same collision (e.g. `measure.audio.loudness`) differently. `ROADMAP.md` Phase 3 is
where this becomes load-bearing — it implements the three-tier collision policy "inside
`video-production-agent`'s `SkillRegistry`, replacing its current hardcoded... first-match
default" — but Phase 3 depends on Phase 1+2 first (`ROADMAP.md`: "Attempting Phase 3
first would mean inventing a registration format ad hoc"). This question should be
settled before Phase 3 begins, not before Phase 1.

### I2. Should `video_agent.models` be extracted into an independent `avpos-contracts` package now, or kept in-repo?

`ARCHITECTURE.md` §3 names the candidate refactor directly: `Observation`, `Inference`,
`Decision`, and the rest are "candidates to become an OS contract package... rather than
[being] defined [in `video-production-agent`]," but defers the decision "to a later
Roadmap phase." `ARCHITECTURE.md` §12 restates it as carried-forward-open.
`ROADMAP.md`'s own closing section is explicit that this roadmap **does not resolve** it
at any specific phase: "this roadmap does not resolve that open question either; it is
compatible with doing so at any point after Phase 1... but does not require it at any
specific phase." The natural forcing function is Phase 3-4, the first phases that
actually touch `video-production-agent`'s code (`SkillRegistry.select_tool()` in Phase 3,
`execution/compiler.py`/`executor.py` in Phase 4) — extracting the types at that point,
rather than before or long after, avoids both a premature package split with no second
consumer yet and a second in-place rewrite of code Phase 3-4 is already touching.

### I3. Cancellation semantics are undesigned — `ExecutionResult.status` has no `cancelled` value

`SPEC.md` §4 defines `ExecutionResult.status` as `success | failed | timed_out`. No
audited document proposes a fourth `cancelled` state, and `FAILURE_RECOVERY.md` §2's
failure-category table treats "Human interruption / Job kill" only as a Job-level
interruption for `render --resume` purposes, not as a typed, per-Operation cancellation
with its own semantics (does a cancelled Operation count toward
`execution.recovery.max_attempts=2`? does it leave a partial Artifact the way a genuine
failure never does, per `FAILURE_RECOVERY.md` §5's "a failed Operation produces no
Artifact at all, by construction"?). No repo in the ecosystem implements explicit
cancellation today, so this is not blocking Phase 1's contract-schema work — but Phase 4
is where the Execution/Artifact model starts routing real executions
(`ROADMAP.md` Phase 4), and adding a status value later is a `VERSIONING.md` §3-style
compatibility question worth deciding once, deliberately, rather than backfilling after
Phase 4 code already assumes a three-state enum.

### I4. Should the retry budget skip terminal failure categories, and is this already true?

`FAILURE_RECOVERY.md` §4 proposes, as **PROPOSED, not confirmed**, that validation
errors, security rejections, missing/ambiguous Providers, and contract-version
incompatibilities should **not** consume the `max_attempts=2` budget at all, "since
spending a retry on a deterministic rejection wastes the bounded budget on a category of
failure retrying can never fix." Whether `execution/recovery.py` already implements this
distinction, or applies bounded retry uniformly regardless of cause, is stated as
**UNKNOWN** — "not independently verified in the audit." This needs resolving (by
inspection of the actual code, or by deliberate design if the current behavior is
uniform) before Phase 4 touches the same execution path, since Phase 4's risk section
already flags that `execution/compiler.py`/`executor.py` changes must not regress
existing retry behavior.

### I5. Should a partial (not-fully-executed) Plan emit a partial `ProductionReceipt`?

Named open in three independent places, which is itself evidence this is a real gap
rather than an oversight in one document: `EXECUTION_MODEL.md` §5.3 ("A Plan that stops
partway through... does not yet have a defined Receipt behavior... named here so it is
not silently assumed either way"), `PROVENANCE.md` §6 (same question, restated as
carried forward), and `FAILURE_RECOVERY.md` §11 (same question, again explicitly not
re-answered). `SPEC.md` §6 only specifies emission for "a completed (not necessarily
fully-passing) Plan execution" — a Plan that never reaches completion at all is a
different case none of the three documents settles. This must be resolved by
`ROADMAP.md` Phase 6, which implements `ProductionReceipt` emission, but has no bearing
on Phases 1-5.

### I6. Should `retains_intermediate_outputs` become a declared `CapabilityContract` field?

`FAILURE_RECOVERY.md` §5 names this directly: whether a Skill's internal multi-stage
retention behavior (the concrete existing example being `ffmpeg-skill`'s `render.py
--keep`/`--work` flags) should be exposed as a contract field "so an Agent could know,
without reading a Skill's docs, whether a partially-failed multi-stage Operation left
anything inspectable behind... is an open question, not designed here." Low cost to add
(one boolean field, additive per `VERSIONING.md` §3's non-breaking-change list) but
genuinely undecided; worth settling by the time Phase 2's contract retrofit touches
`ffmpeg-skill`'s schema, so the retrofit doesn't have to be revisited for it later.

### I7. Should `ProductionReceipt.warnings`/`failures` reference `QCFinding` ids, or stay free-text?

`PROVENANCE.md` §6 names this explicitly, and — notably — is the one item in this
document's IMPORTANT tier that a source document itself already calls non-blocking: "a
more structured shape is a candidate refinement, not a blocking gap." Included here
because it still needs an answer before `ROADMAP.md` Phase 6 finalizes the
`ProductionReceipt` shape, even though no phase is stalled waiting on it — a Receipt with
free-text `[string]` failures is real and shippable in the interim, per `SPEC.md` §6's
current shape.

---

## FUTURE — Phase 7+ concern, fine to leave open for years

### F1. How should "environment" be fingerprinted for reproducibility?

`PROVENANCE.md` §2 names this as the one deliberately-left gap in an otherwise fully
enumerated reproducibility field list: "'environment' (OS, kernel, CPU architecture,
locale, installed codec libraries beyond ffmpeg/ffprobe themselves) is not captured by any
existing scheme in the audit... `ffmpeg_version` and `ffprobe_version` are the only
environment-adjacent fields any repo actually records." `PROVENANCE.md` §6 restates it as
carried forward, explicitly declining to invent a scheme "with no evidence of need." This
only becomes concretely relevant once `PROVENANCE.md` §5's "verifiable reproducibility"
claim (for a future nondeterministic/generative Provider — none exists today,
`NullProvider` is the only shipped `AIProvider`) needs to be tested in practice, which is
Phase 8-adjacent territory (`ROADMAP.md` Phase 8: "advanced agent autonomy... beyond what
`video-production-agent`'s current deterministic pipeline already does").

### F2. Does Permission declaration (filesystem/network) need a schema now, or when a Skill first needs network access?

`PLUGIN_MODEL.md` §4 states this is "**PROPOSED** — no repo declares this explicitly
today," and grounds the network-specific case in a confirmed absence: `SKILL_PROPOSAL.md`
§1.5 and `SPEC.md` §7 both confirm "**No existing Skill in the ecosystem uses network
access for anything**... confirmed absence across all 11 repos." `PLUGIN_MODEL.md` §4
also names the harder half of this as unsolved regardless of when the schema is written:
"an enforcement mechanism that actually *confines* a plugin to its declared permissions at
runtime" does not exist and is not designed. This is squarely `ROADMAP.md` Phase 7
territory (third-party Skill support) — Phase 7's own sequencing argument already applies
here without modification: designing a permission schema before any Skill needs one, and
before any third-party author has tried to conform to it, risks exactly the "architecture
astronautics" `ROADMAP.md` Phase 7 argues against for the conformance harness generally.

### F3. How strict should collision refusal be for an unknown third-party Provider, and does the flat registry lookup hold up at unknown Skill-count scale?

`ROADMAP.md` Phase 7 names both questions itself, explicitly unresolved and explicitly
gated on internal experience first: "has [stricter refusal] actually been livable in
Phase 3-4's internal experience?" and whether "the registry's flat-lookup-by-id design...
sufficient for 11 repos, ~60 operations... hold[s] up once a third party's Skill count is
unknown/unbounded." Restated here only because it is a genuine open architectural
question, not because `ROADMAP.md`'s sequencing argument (deliberately deferred, not
merely late) needs revisiting.

### F4. Does Memory/Knowledge, as distinct from Provenance, belong in OS scope at all?

Not named as an open question anywhere in the audited corpus — this document surfaces it
because its absence is itself notable. Nothing in `PROVENANCE.md`, `CORE_PRIMITIVES.md`,
or `ARCHITECTURE.md` addresses whether an Agent's cross-Project memory (a learned style
preference, a recurring brand-voice constraint, "the last time this happened, the outcome
was X") is an OS concern or purely an Agent-implementation concern. `CORE_PRIMITIVES.md`
§0's own kernel test answers this by construction, even though no document poses the
question explicitly: "would a second, independently-built Agent and a third-party Skill
both need this to exist, in the same shape, to interoperate?" A given Agent's memory
model is exactly the kind of thing a *different* Agent would have no reason to share the
shape of — it is Agent-side reasoning state, not a contract two independently-built
programs must agree on, which places it outside the OS by the same reasoning
`ARCHITECTURE.md` §8 already applies to AI provider choice. This is filed as FUTURE
rather than resolved-now because it only becomes concrete once an Agent sophisticated
enough to want cross-Project memory exists — `ROADMAP.md` Phase 8 territory ("advanced
agent autonomy"), with zero present evidence of need.

### F5. Is the `measure.video.quality-vs-source` gap (full-reference quality metrics) worth a new Capability?

`COMPETITIVE_ANALYSIS.md` §1.3 names this directly: VMAF is "full-reference only," while
"every `qc-skill` video check... is **no-reference** today," and concludes "a single
metric family cannot cover both re-encode verification and no-original-reference (e.g.
generative) content — a real, currently-unfilled gap this document names but does not
design a solution for." No Skill in the ecosystem does re-encode/transcode comparison
today, so there is no forcing function; worth revisiting once a re-encode or transcode
Capability is actually proposed (`SKILL_PROPOSAL.md`'s process would be where this
surfaces).

### F6. Should `qc-skill`'s `rules` become a first-class, independently-versioned `qc_policy`/`delivery_spec` Artifact type?

`COMPETITIVE_ANALYSIS.md` §1.2 names MediaConch's portable-policy-file pattern as worth
adopting, and states plainly this is "not designed further here; a candidate for a future
`ARTIFACT_MODEL.md` revision." Today `rules` is already part of `qc-skill`'s identity
hash (`SPEC.md` §5, `PROVENANCE.md` §2) as an opaque blob — functionally adequate, just
not yet a versioned, diffable Artifact in its own right. No urgency: nothing depends on
this becoming a distinct type before it's convenient to design.

### F7. What deprecation timeline/support window applies once a Capability reaches `DEPRECATED`?

`VERSIONING.md` §9 names this explicitly as undefined and explicitly defers it: "how long
a `DEPRECATED` Capability must remain callable before `RETIRED`... no evidence exists yet
for what's realistic... left to `ROADMAP.md`." `ROADMAP.md` itself does not pick it back
up. Irrelevant until the first Capability is actually marked `DEPRECATED`, which has not
happened anywhere in the audited ecosystem (every Capability today is informally pre-1.0).

---

## OPTIONAL — nice to know, blocks nothing

### O1. What license governs this project?

`COMPETITIVE_ANALYSIS.md` §7 surfaces this without resolving it: "This project's own
license is not specified anywhere in the audited document set — `REPOSITORY_MAP.md` notes
the 11 audited repos are 'single-owner, public' but records no license for any of them...
This document surfaces that as an open decision for whoever owns licensing policy; it
does not resolve it." Purely a business/legal decision, orthogonal to every technical
phase in `ROADMAP.md` — the differentiation argument against OpenMontage's AGPL-3.0
(`COMPETITIVE_ANALYSIS.md` §2, §7) is a stated preference for permissive licensing, not a
commitment already made.

### O2. What is the exact field set hashed into `Operation.idempotency_key`?

`EXECUTION_MODEL.md` §3.2 and `FAILURE_RECOVERY.md` §1 both carry this forward as
**UNKNOWN**, not fabricated: the general shape (`{capability_id, provider_id,
skill_version, params, input_artifact_ids}`) "is inferred from the documented behavior...
and from the sibling `qc-skill` identity pattern it is consistent with," but "the precise
field list used by `execution/compiler.py` today was not independently re-derived from
source." This is a verification task (read the actual source), not an architectural
design question — the *shape* every document already agrees on is sufficient to build
against; only the exact field list awaits a direct citation.

### O3. Does a resumed Job's retry-attempt counter reset or persist across the resume boundary?

`FAILURE_RECOVERY.md` §7 names this precisely as unresolved: whether a step that already
exhausted its `max_attempts=2` budget once gets a fresh budget on `render --resume`, or
requires an explicit new Decision instead. Marked there as "a candidate for direct
source citation in a future revision," i.e. another verification task rather than a
design decision with two live proposals to choose between.

### O4. Should `ffmpeg-skill`'s command-line-plus-probe provenance be persisted as an automatic sidecar, or stay an opt-in flag?

`PROVENANCE.md` §6 names this as the one remaining shape question for an already-agreed
fix: "Whether the sidecar-provenance-for-directly-invoked-Skills gap... is closed at the
Runtime layer (every Skill's Runtime wrapper writes it automatically) or left as a
per-Skill CLI flag." That the gap should close is not in question (`PROVENANCE.md` §3
already recommends the sidecar pattern generally); only the *mechanism* — automatic vs.
opt-in — is open, and either answer is a minor Runtime-contract detail, not a design
fork with materially different consequences.
