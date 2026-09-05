# Intent Model: Goals, Constraints, Preferences, Policy, Permissions, Creative Intent

This document decomposes **Production Intent** — currently, per `REPOSITORY_MAP.md`, a
largely implicit concept in `video-production-agent`, carried as free-text request data
and a deterministic rules engine rather than one named, structured type. This is **not a
blank-page design**: `video-production-agent`'s `policy/rules.py` already has separately
provenanced `Policy`, `Preference`, and `Constraint` concepts driving its
`decision_engine.py` (`PRINCIPLES.md` Principle 4, `CORE_PRIMITIVES.md` §5's `Decision.basis`
field), and this document's job is to sharpen and complete that decomposition — not
invent it from nothing. As elsewhere in this project: **CURRENT** means verified in the
audited code, **PROPOSED** means a refinement of something that already exists,
**FUTURE** means net-new with no current use case, and **UNKNOWN** is stated outright
wherever the audit did not verify enough detail to claim more.

Companion document: `PRODUCTION_STATE.md` treats "Intent" as one read-only element of a
Production State query built over this model plus the other existing OS primitives — this
document defines the shape of Intent itself; that one defines how it's surfaced.

## 0. What already exists — the honest starting point

`REPOSITORY_MAP.md` confirms `video-production-agent`'s `policy/rules.py` and
`agent/decision_engine.py` form "a deterministic, rule-based engine... operating on
measured Observations — not an LLM." `PRINCIPLES.md` Principle 4 ("Constraints are not
preferences") confirms more precisely that this engine **already separates hard
constraints (which a Decision may never violate) from soft preferences (which shape a
choice among otherwise-valid options)**, and that `Decision.basis` already carries
distinct policy/preference/constraint provenance (`CORE_PRIMITIVES.md` §5). Concretely:
`policy/rules.py` defines `Policy`, `Preference`, and `Constraint` as separately-typed
concepts feeding that engine — **CURRENT** evidence this document treats as a starting
point, not a proposal.

What the audit did **not** verify in enough depth to claim: whether `Constraint` in
`policy/rules.py` is itself already split into a hard/soft distinction, or is a single
type that this document's proposed Hard/Soft refinement (§2, §3) would split for the
first time. This document treats the existing `Constraint` type as **CURRENT and
unsplit**, and the Hard/Soft division as a **PROPOSED refinement** of it, not a
restatement of something already separated in code — see §2's tag for the precise claim.

This document does not propose a new top-level `Intent` dataclass replacing any of these.
It proposes naming and relating six elements — Goals, Hard Constraints, Soft Constraints,
Preferences, Policy, Permissions — plus a seventh, deliberately looser one (Creative
Intent), as the vocabulary a Project's Intent is made of, most of which already exists in
some form.

## 1. Goals

**UNKNOWN whether a formally separate Goal type exists in `video-production-agent`.**

A Goal is the top-level ask that starts a Project: "make a 60-second promotional video for
product X." Every Project must have at least one.

`REPOSITORY_MAP.md` documents `video-production-agent`'s pipeline as `Observation → Event
→ Inference/Decision → ProductionPlan → Project IR → Compiler → Operation →
Executor(ToolRouter) → Artifact → QA`, and `CORE_PRIMITIVES.md` §11 confirms `Project`
is CURRENT (`ProjectIR`'s `project` section, "the unit of identity for one production").
Neither document, nor the rest of this audit, establishes **whether that `project`
section carries a structured `Goal` field (e.g. a typed duration/format/purpose target)
or is simply free text describing what the user asked for**. This is genuinely
**UNKNOWN** — the audit did not read `schemas/project.schema.json` at the level of detail
needed to answer it, and this document does not guess.

**What this document recommends, without overclaiming what exists today:** if/when this
is verified, a Goal should be treated as a small, mostly free-text record (a purpose
statement, a target duration if stated, a target platform if stated) that sits at the
`Project` level — not a new primitive requiring its own lifecycle, registry, or contract.
It is closer to Creative Intent (§6) in looseness than to a Hard Constraint (§2) in
rigor: "make a 60-second promotional video" contains one number worth lifting out as a
Hard Constraint (`duration <= 60s`, or `duration == 60s` if exact) and a purpose ("
promotional") that stays as loose context. Decomposing a Goal into its constituent Hard
Constraints, Soft Constraints, and Creative Intent is Agent judgment (interpreting a
free-text ask), not something the OS structurally validates — consistent with
`ARCHITECTURE.md` §8's rule that Plan Validation is structural, never semantic.

## 2. Hard Constraints

**PROPOSED — a refinement/split of the existing `Constraint` type.**

A Hard Constraint is a must-satisfy condition: `duration <= 60s`, `resolution ==
1920x1080`, `no profanity`, `deliver as .mp4`. A Decision or Plan that would violate a
Hard Constraint is invalid, full stop — not a matter of Agent taste.

`policy/rules.py` already has a `Constraint` type feeding `Decision.basis`
(`CORE_PRIMITIVES.md` §5, `PRINCIPLES.md` Principle 4) — **CURRENT**. What this document
proposes, and what the audit did not verify already exists as a formal split in code, is
naming the **hard** half of that type explicitly: a constraint an Agent must treat as
non-negotiable, never traded off against a preference or "AI taste," and never silently
relaxed to make a Plan easier to satisfy. This is a **PROPOSED** refinement, not a
restatement — see §0's caveat.

Mechanically, a Hard Constraint fits directly into what already exists: it is exactly the
kind of fact a `QCReport`'s `threshold` can check (`QC_ARCHITECTURE.md` §5.2's
plan-conformance mechanism, or a fixed rule-file threshold, §1), and exactly what a
`Decision.basis` should cite when a Decision is made *because of* a constraint
(`CORE_PRIMITIVES.md` §5). No new enforcement machinery is needed — Hard Constraints are
data the existing Decision/QC contracts already know how to consume; the refinement is
purely in how the constraint is tagged (`hard` vs. `soft`, §3) at the point it's declared.

## 3. Soft Constraints

**PROPOSED — a refinement/split of the existing `Constraint` type, alongside §2.**

A Soft Constraint is a should-satisfy-if-possible condition: "prefer minimal cuts,"
"keep the intro under 5 seconds if the pacing allows it." Unlike a Hard Constraint, a Plan
that fails to satisfy a Soft Constraint is still valid — the Soft Constraint shapes which
otherwise-valid choice is preferred, it does not gate validity.

The distinction from a **Preference** (§4) is real and worth stating precisely, because
the two are easy to conflate: a Soft Constraint is still a *constraint on the production
task itself* ("minimize the number of cuts" is a property of the edit), whereas a
Preference (§4) is a *stylistic leaning independent of the task's correctness*
("monochrome" doesn't make the edit more or less correct, it makes it look a certain way).
Both are negotiable/tradeable in a way Hard Constraints are not, which is why both are
grouped opposite Hard Constraints in `Decision.basis`'s existing provenance categories —
but they answer different questions ("how should this be accomplished, if there's a
choice" vs. "what should this look/feel like").

## 4. Preferences

**CURRENT — the `Preference` type already exists in `policy/rules.py`
(`CORE_PRIMITIVES.md` §5, `Decision.basis`; `PRINCIPLES.md` Principle 4).**

A Preference is a stylistic leaning: "prefer a monochrome visual style," "prefer upbeat
background music." The distinction this document sharpens is not the type's existence —
it already exists — but the **failure mode an Agent must never fall into**, stated
explicitly because nothing in the audited pipeline currently states it as a rule an Agent
must follow:

- **An Agent must never treat a Preference as blocking.** A Preference can lose to a Hard
  Constraint, a Soft Constraint, a Policy rule, or even practical necessity, without that
  being a violation of anything. If honoring "prefer monochrome" would make a Hard
  Constraint like `duration <= 60s` impossible to satisfy (a contrived example, but the
  shape matters), the Hard Constraint wins and the Preference is simply not honored — this
  must never surface as a blocked Plan or a required human override, because a Preference
  was never authorized to block in the first place.
- **An Agent must never treat a Hard Constraint as negotiable "AI taste."** The inverse
  failure is just as real: an Agent rationalizing away a stated Hard Constraint ("the
  video is 63 seconds but I judged that acceptable") is not exercising taste, it is
  silently overriding a non-negotiable fact. `Decision.basis`'s existing provenance
  distinction (`CORE_PRIMITIVES.md` §5) is precisely what makes this checkable after the
  fact: a Decision whose `basis` cites a constraint but whose outcome violates it is a
  detectable inconsistency, not merely bad judgment nobody can point to.

This document does not propose changing `Preference`'s shape — it proposes stating these
two failure modes as an explicit rule any Agent consuming Intent must follow, analogous to
how `PRINCIPLES.md` Principle 4 already states "a preference can be overridden or traded
off, a constraint cannot" as a rule, not merely a description.

## 5. Policy

**CURRENT — the `Policy` type already exists in `policy/rules.py`
(`CORE_PRIMITIVES.md` §5, `Decision.basis`; `PRINCIPLES.md` Principle 4).**

A Policy is an organization- or production-wide rule that outlives any single Project:
"never publish without QC PASS," "always burn in captions for delivery," "never deliver
HDR without a tonemap fallback." Unlike a Hard Constraint (§2), which is scoped to one
Project's Intent ("this video must be <=60s"), a Policy is scoped above the Project —
it applies to every Project a Workspace or organization runs, the way `SYSTEM_CONSTRAINTS`
(`execution.no_raw_shell`, `execution.recovery.max_attempts=2`) already applies uniformly
regardless of which Project is executing (`REPOSITORY_MAP.md`, `SECURITY_MODEL.md` §4).

This document does not propose a new Policy shape — it is adopted as-is, per §0. The one
clarification worth stating: a Policy and a Hard Constraint can look similar in effect
(both are non-negotiable) but differ in scope and origin — a Hard Constraint comes from
*this Project's* stated intent, a Policy comes from *the organization's* standing rules,
independent of any one Project asking for it. Both feed `Decision.basis` the same way;
neither is more "important" than the other, they are simply provenanced differently so a
future policy engine (`PRINCIPLES.md` Principle 4) can distinguish "the client asked for
this" from "we always require this."

## 6. Permissions

**FUTURE — entirely proposed, no current use case anywhere in the ecosystem.**

A Permission is a Runtime-boundary-scoped authorization: "local rendering allowed,"
"network upload allowed/forbidden," "uploading source footage to a third-party service
forbidden." Per `SPEC.md` §7 and `SECURITY_MODEL.md`'s header, **no repository in the
11-repo ecosystem talks to a network service today**, and `PRINCIPLES.md` Principle 7
generalizes this into a standing rule: network access is treated as an exceptional,
non-default deviation any component must explicitly declare, never an assumed capability
(`PLUGIN_MODEL.md` §4: "a plugin declaring any network need is a deviation from that norm
and should be treated as exceptional"). There is, today, **nothing to permission** — every
Skill runs fully local, and no audited repo has a network-access code path to gate at all.

Despite there being no current use case, this document proposes Permissions exist as a
**named placeholder in the Intent model now**, for one specific reason: the day a Skill
needs network access — the recurring hypothetical named consistently across this project's
documents is a future cloud ASR Provider of `transcribe.audio` alongside
`transcription-skill`'s local `faster-whisper` engine (`CORE_PRIMITIVES.md` §3,
`CAPABILITY_MODEL.md` §Granularity) — there should already be a place in the Intent model
for a user or Agent to have explicitly authorized that network reach, rather than it being
bolted on ad hoc at the point some future Skill first asks for it. Concretely, a
Permission would name: which Runtime-level capability is being authorized (e.g. `network:
upload`, `network: cloud-provider-call`), what it's scoped to (a specific Provider, a
specific Capability, or global), and who granted it (user, Workspace policy).

This ties directly to two existing/parallel discussions rather than redefining either:

- **`SECURITY_MODEL.md`'s trust-boundary discussion** — the current trust boundaries are
  filesystem and subprocess, not network/auth (`SECURITY_MODEL.md` header), and §8 names
  third-party Skill network access as an explicitly **UNKNOWN/FUTURE** risk the Runtime
  contract does not yet constrain. Permissions, once built, would be the Intent-side
  complement to that Runtime-side gap: the Runtime enforces what a Skill's process
  boundary can reach; Permissions record what the Project's Intent has actually authorized
  it to reach. Neither exists as enforced machinery today.
- **`CAPABILITY_MODEL.md`'s Provider-selection discussion** — a parallel effort may be
  refining `CAPABILITY_MODEL.md` to state that Provider fallback/selection must respect
  Permissions (e.g. a Plan must not silently fall back from a local Provider to a
  network-calling one without an explicit Permission authorizing that reach). This
  document does not assume or restate the exact wording of that refinement — it only
  establishes that Permissions is the Intent-side concept such a rule would reference.

**What this document does not propose:** an authorization/authentication model, a
credentials store, a network policy engine, or any enforcement mechanism. Per `SPEC.md`
§7 and `SECURITY_MODEL.md` §9, those remain explicitly out of scope until a real network
use case exists. Permissions here is a **named slot in the Intent vocabulary**, not a
system being built.

## 7. Creative Intent

**PROPOSED — partially structured, deliberately not fully typed.**

Creative Intent covers tone, mood, rhythm, visual language, narrative priority, audience,
emotional objective, and brand style: "make it feel more cinematic," "keep the energy
high throughout," "this is for a younger audience, keep pacing fast." None of this is
formally typed anywhere in the audited ecosystem today — it is the part of a Production's
Intent with the least existing structure to build on.

**Recommendation: a small set of named, loosely-typed free-text fields attached to a
Project's Intent — not entries in a rigid enum.** Concretely, something like `{tone:
string, mood: string, narrative_priority: string, audience: string, emotional_objective:
string, brand_style: string}` — named slots so an Agent knows *where* creative guidance
lives and can look for it consistently, but each slot holds free text, not a closed
vocabulary of allowed values.

**Why full structuring is explicitly rejected, not merely deferred:** the task brief's
implicit temptation here is to enumerate tone as `{cinematic, corporate, casual,
energetic, ...}` the way `Decision.type` is enumerated
(`KEEP/REMOVE/TRANSFORM/DELIVER/SKIP/REVIEW/BLOCK`, `CORE_PRIMITIVES.md` §5). This document
argues that would be a category error, not a simplification: "make it feel more
cinematic" is legitimately open to interpretation — different Agents, or the same Agent
on different footage, may reasonably realize "cinematic" differently, and that ambiguity
is exactly what a human client means when they use a word like that instead of naming a
specific technique. Forcing it into an enum wouldn't remove the ambiguity, it would hide
it behind a false appearance of precision (picking one enum value silently discards the
nuance a human's actual words carried). This mirrors `ARCHITECTURE.md` §9 lens 1's
discipline of not adding structure the evidence doesn't call for — except here the
"evidence" against structuring is the nature of the content itself, not an absence of
audit findings.

**How Creative Intent is meant to be used, precisely:** as `evidence`/`rationale` context
an Agent may cite when constructing an `Inference` or a `Decision`
(`CORE_PRIMITIVES.md` §5) — e.g. "chose a slower cut pace; rationale cites
`creative_intent.tone = 'cinematic'`" — never as a machine-checkable threshold a
`QCFinding` (`QC_ARCHITECTURE.md` §1) could pass or fail against. This is the same
boundary `QC_ARCHITECTURE.md` §2 already draws for subtitle content ("structural, never
semantic") applied to creative direction: the OS can record that Creative Intent existed
and was cited, but it can never verify that a Decision "correctly" satisfied a Creative
Intent field the way it can verify `duration <= 60s` — that verification, to the extent it
happens at all, is human judgment reviewing the output, not a QC check.

**What this rules out concretely:** a `CreativeIntentEnum`, a scoring/matching algorithm
that claims to measure "how cinematic" an edit is, or treating a mismatch between stated
Creative Intent and a rendered output as a `QCReport` finding. Any of these would convert
a legitimately ambiguous human statement into a false-precision machine judgment — exactly
the failure mode this document exists to name and reject.

## 8. Summary table

| Element | Status | Basis |
|---|---|---|
| Goals | **UNKNOWN** whether formally typed; likely free-text today | Not verified against `schemas/project.schema.json` in this audit |
| Hard Constraints | **PROPOSED** split of existing `Constraint` | `policy/rules.py` (CURRENT `Constraint`), `CORE_PRIMITIVES.md` §5, `PRINCIPLES.md` Principle 4 |
| Soft Constraints | **PROPOSED** split of existing `Constraint` | same as above |
| Preferences | **CURRENT** type; failure-mode rule is the refinement | `policy/rules.py` `Preference`, `CORE_PRIMITIVES.md` §5 |
| Policy | **CURRENT** | `policy/rules.py` `Policy`, `CORE_PRIMITIVES.md` §5, `SYSTEM_CONSTRAINTS` precedent |
| Permissions | **FUTURE** | No network use case anywhere in ecosystem (`SPEC.md` §7); ties to `SECURITY_MODEL.md` trust boundaries and a possible `CAPABILITY_MODEL.md` Provider-fallback refinement |
| Creative Intent | **PROPOSED**, deliberately unstructured | Named free-text fields, used only as Decision `evidence`/rationale, never a QC threshold |

## 9. What this document deliberately does not propose

- A single `Intent` dataclass unifying all seven elements into one object — per
  `PRODUCTION_STATE.md`'s central argument (applied here one level down), collapsing
  distinct, differently-owned, differently-provenanced concepts into one structure trades
  away exactly the separations (`basis` provenance, hard/soft/preference distinctness)
  that make them useful individually.
- Structuring Creative Intent into an enum, a score, or a QC-checkable threshold (§7).
- An authorization/network-security system for Permissions (§6) — a named placeholder
  only, not infrastructure.
- A claim that Goals are already formally typed in `video-production-agent` — left
  explicitly UNKNOWN (§1) pending direct verification.

## 10. Reference-driven production

**PROPOSED / FUTURE — entirely new, no repo does this today.**

Production intent does not always arrive as text. A client sometimes hands over a
reference asset instead of (or alongside) a description: "make it look like this,"
"match this pacing," "use a similar color grade to this reference clip." This section
asks the question this document's method requires before adding anything: **does a
reference asset need a new OS primitive?**

**Recommendation: no.** A reference asset is simply an **Artifact** — the same primitive
every source clip, rendered output, or QC report already is (`ARTIFACT_MODEL.md`) — fed
through the existing Observation/Analysis pipeline this project already has an answer for.
`media-analysis-skill`, or a future analysis Capability built the same way, can extract the
reference's measurable properties (color palette, pacing/cut-frequency via its existing
`scene_detection`-style measurement, a loudness profile via its existing loudness
analyzer) exactly as it already does for any other input clip. The resulting
**Observations** become **Evidence** a **Decision** can cite when an Agent chooses, say, a
faster cut pace or a particular tonemap curve — this is not a new flow, it is the same
Observation → Evidence → Decision composition `CORE_PRIMITIVES.md` §5 already defines,
applied to an Artifact whose role happens to be "reference" rather than "source footage."
No new pipeline stage, no new Artifact type, no new primitive is required for this to
work.

**The one genuinely new piece.** What does not already exist anywhere in the audited
ecosystem is a way to say *this specific Artifact is a style reference, not source
material the output should include*. Without that tag, nothing stops an Agent (or a
naive Plan) from treating a reference clip as footage to cut into the timeline rather than
as an example to draw stylistic Observations from — a meaningfully different, and
currently unstated, distinction. This document proposes closing that gap with the
smallest possible addition: one small, optional field on a Project's Intent record,
alongside the elements §§1–7 already define —

```
reference_assets: [ { artifact_id: ArtifactId, role: "style_reference" } ]
```

— not a new Artifact type (the referenced asset is still an ordinary Artifact per
`ARTIFACT_MODEL.md`), not a new pipeline stage, and not a new primitive of any kind. It is
a tag on the Intent, read by whatever Agent logic constructs the Plan, so that "analyze
this and cite it as Evidence for style choices" and "include this in the delivered edit"
stay distinguishable. Consistent with §7's treatment of Creative Intent, this stays a
loosely-typed pointer, not a machine-checkable contract: the OS can record that a
reference was tagged and cited, but whether a Decision "correctly" matched the reference's
style is Agent/human judgment, never a QC threshold — the same boundary QC_ARCHITECTURE.md
already draws for subtitle content and §7 draws for Creative Intent generally.

## 11. Taste — a fourth distinct concept, named to prevent a future conflation

**Terminology/scope clarification only — no mechanism is proposed or designed here.**

`PROVENANCE.md` §7 already separates **Provenance vs. Memory vs. Knowledge vs. Evidence
vs. Observation** as five concepts that must not be merged, and marks Memory (cross-
Production preference recall) and Knowledge (general domain expertise, not user-specific)
explicitly **out of OS-core scope** — see that document for the full treatment; it is not
restated here. This document adds one more term to that boundary-marking exercise,
specific to Intent, because it is easy to conflate with something this document already
treats as CURRENT and in-scope: **Preference** (§4).

**Taste** would be a specific user's demonstrated aesthetic leanings, inferred from that
user's past corrections and rejections **across multiple Productions** — e.g. "this user
has rejected fast-cut editing three times, has approved slower pacing twice." Like
Memory, it is a generalization across Productions, not a fact about the one Production
currently underway; like Knowledge, it requires persistent storage and some inference
process to exist at all. No evidence anywhere in the 11-repo audit shows any such
mechanism, storage, or cross-Production learning process — nor any stated intention to
build one (`REPOSITORY_MAP.md`; `PROVENANCE.md` §7.2's identical finding for Memory
applies here without modification).

**Why this is named here rather than left implicit in Memory:** Taste is Memory-shaped
(it is, in fact, most precisely described as user-specific Memory applied to aesthetic
judgments specifically), but it sits close enough to this document's own **Preference**
concept (§4) that a future contributor could plausibly reach for one when they mean the
other. The distinction that matters:

| | Scope | Stated when | Persistence required | OS-core scope |
|---|---|---|---|---|
| **Preference** (§4, this document) | One Project's Intent | Once, upfront, by the user for this Production ("prefer monochrome") | None — lives and dies with the Project | **Yes — CURRENT** |
| **Taste** (this section) | Across many Productions, one user | Never stated directly — inferred from repeated past corrections/rejections | Yes — requires a store that outlives any single Project | **No — out of OS-core scope, same as Memory/Knowledge** |

"The user said prefer monochrome for this video" is a Preference: scoped to one Project's
Intent, already CURRENT, requiring no persistence beyond that Project — exactly what §4
already describes. "This user seems to prefer slower pacing, based on what they rejected
on their last three Productions" is Taste: an Agent- or ecosystem-layer inference that
requires a persistent store across Productions the OS does not have and is not proposed
here. Confusing the two would mean either treating a one-time stated Preference as if it
needed cross-Production storage it does not need (over-building), or treating a
cross-Production behavioral inference as if it were as simple and disposable as a
same-Project Preference (under-building, and silently wrong once a second Production
exists).

**What this section does not do:** it does not design a Taste-tracking mechanism, a
storage schema, an inference process, or a similarity model over past rejections — per
`PROVENANCE.md` §7.2's identical reasoning for Memory, building that now would be
speculative complexity with no evidence of need. This section exists solely so that a
future contributor proposing "let's remember what this user tends to like" recognizes it
as a Memory/Taste-layer, Agent-or-ecosystem concern — out of OS-core scope, per
`PROVENANCE.md` §7 — rather than mistaking it for an extension of the already-CURRENT,
already-in-scope Preference concept this document owns.
