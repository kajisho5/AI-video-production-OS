# Agent Evolution: Current, Transition, Future

Status: **draft, evidence-based, 2026-09-05.** This document extends `REPOSITORY_MAP.md`'s
findings about `video-production-agent` and `CORE_PRIMITIVES.md` §12's Agent definition
into a concrete evolution story: what the one real Agent implementation does today, what
concretely changes on the way to an OS-shaped world, and what stays speculative rather
than designed. `video-production-agent` is **usable but incomplete** — per
`REPOSITORY_MAP.md`'s explicit framing, it is treated throughout as "the first major
consumer and orchestration layer of the future OS, not the OS itself, and not a finished
reference architecture." Nothing below invents functionality it does not have, and nothing
below discards functionality it has already built correctly.

## How to read this document

Uses the same CURRENT / FUTURE / EXPERIMENTAL / UNKNOWN tagging convention as every other
document in this project (`DESIGN_SYSTEM.md` §2). Several claims about `video-production-agent`'s
internal module layout below were verified directly against its source tree during this
task (file listings and targeted greps of `src/video_agent/`), not only inferred from
`REPOSITORY_MAP.md`'s prose — where that is the case it is noted, because it is a stronger
form of evidence than the audit document alone provides for that specific claim.

## 1. Current → Transition → Future

### 1.1 Current Agent (CURRENT)

`video-production-agent` today runs a real, working, deterministic pipeline:

```
Observation → Event → Inference/Decision → ProductionPlan → Project IR
  → Compiler → Operation → Executor(ToolRouter) → Artifact → QA
```

Every stage above is a real, distinctly named type or module in `src/video_agent/`, not
documentation-only. Four properties of the current Agent matter for this document's
argument and are restated precisely because later Agents must be measured against them,
not against an idealized version of what this repo "should" do:

- **AI integration is `NullProvider`-only.** `providers/base.py` defines a generic
  `AIProvider` interface; the only shipped implementation is `NullProvider`. No
  Anthropic/OpenAI/other SDK is imported anywhere in the repo. The deterministic
  rule-based engine (`policy/rules.py`, `agent/decision_engine.py`) is what actually
  drives Observation→Inference→Decision today — **there is no real LLM wired into this
  Agent as of this audit.** This is not a gap this document proposes closing on a
  timeline; see §1.2.
- **Skill registration is manual.** Every external Skill adapter is registered by hand via
  `Service.adapter()`; `skills/contract.py` states in its own words "no package loader,
  plugin manager or dynamic import." `SkillRegistry` (`src/video_agent/skills/registry.py`)
  resolves an abstract capability (e.g. `silence_cleanup`) to an ordered, hardcoded
  candidate list of tool ids and picks the first one whose adapter is registered and whose
  capability is `AVAILABLE` — a silent first-match-wins default, not an explicit choice.
- **No web UI, no job queue, no multicam pipeline body.** Confirmed absent in
  `REPOSITORY_MAP.md`'s audit. The multicam/conference pipeline is registered in the
  profile system but `implemented=False`. This document does not assume any of these
  exist, are stubbed usefully, or are close to landing.
- **The pipeline itself is real and already correctly designed** — the
  Observation/Inference/Decision split, the `FORBIDDEN_ARG_KEYS` security boundary, and the
  provenance/artifact model are adopted as-is by this OS (`CORE_PRIMITIVES.md` §5–§7),
  precisely so that none of the above three gaps are mistaken for "the whole Agent is
  unfinished, redesign around it" — the gaps are specific and named, not systemic.

### 1.2 Transition (Roadmap-driven — cited precisely, not assumed)

Three specific transitions are already named in `ARCHITECTURE.md` and `ROADMAP.md`. Each is
stated here exactly as those documents commit to it — no phase number is attached to a
transition unless `ROADMAP.md` actually attaches one:

1. **Extracting `video_agent.models` into a shared OS contract package.** `ARCHITECTURE.md`
   §3 names `video_agent.models.{Observation,Inference,Decision,...}` as "candidates to
   become an OS contract package (`avpos-contracts` or similar)." **This has NOT been
   scheduled to a specific Roadmap phase.** `ROADMAP.md`'s own closing section is explicit:
   "At no phase does this roadmap propose extracting `video_agent.models`... this roadmap
   does not resolve that open question either; it is compatible with doing so at any point
   after Phase 1 (once there is an OS contract package for those types to move into) but
   does not require it at any specific phase." Do not read "Phase 3-4" or any other phase
   number into this transition — the correct, evidence-backed statement is: **possible any
   time after Phase 1, required by no phase, and not yet done.**
2. **Replacing manual adapter registration with capability-driven discovery.** This one
   *is* phase-scheduled: `ROADMAP.md` Phase 4 explicitly delivers "registry-driven
   Execution/Artifact model... **replacing** `video-production-agent`'s current hardcoded
   `Service.adapter()` manual wiring... with real capability-driven discovery," and it is
   gated on Phase 3 (collision-resolution policy) having a real Provider-registration
   definition to resolve against. Phase 1–2 (contract schema + retrofit) are prerequisites
   that touch no `video-production-agent` code at all, per `ROADMAP.md`'s own "what changes,
   and starting when" section — Phase 3 is the first phase to touch
   `video-production-agent`'s code, and only `SkillRegistry.select_tool()`, not the
   Observation/Inference/Decision/Compiler/Executor pipeline itself.
3. **Wiring in a real `AIProvider` implementation.** **This has not happened yet, and no
   Roadmap phase commits to doing it.** `ROADMAP.md`'s Phase 8 ("advanced agent autonomy...
   more autonomous Agent behavior beyond what `video-production-agent`'s current
   deterministic pipeline already does") is the closest named category, and it is
   explicitly marked **LOW PRIORITY, independent of how many other phases are done**,
   triggered by observed scale evidence, not the calendar. It would be inaccurate to imply
   a real AI provider is "coming in Phase 8" as a scheduled deliverable — Phase 8 is a
   holding place for a category of future work, not a commitment to build this specific
   thing by then. The honest statement is: **a real AIProvider could be wired in at any
   point without waiting for any Roadmap phase** (it is Agent-side logic, not an OS
   contract change — `ARCHITECTURE.md` §4 already treats "any LLM can drive the same
   contracts" as an existing guarantee of the *design*, not a claim that one is actually
   wired in), **and nothing in this project's plans currently schedules doing so.**

### 1.3 Future Agent (FUTURE)

Per `CORE_PRIMITIVES.md` §12, `video-production-agent` is **a** Agent, not **the** Agent.
The concrete test this document applies, restated from `ARCHITECTURE.md` §3: would this
still make sense if `video-production-agent` were replaced by a different Agent, or by a
human using a CLI directly? A future Agent — built independently, in a different language,
by a different author, possibly with a real LLM wired in from day one — is a legitimate,
anticipated outcome of this architecture, **existing alongside or replacing
`video-production-agent`**, and it would consume exactly the same OS contracts
(`CapabilityContract`, `Artifact`, `ProductionPlan`, `Observation`/`Inference`/`Decision`,
`QCReport`) that `video-production-agent` consumes today. This is not designed further here
— per `ARCHITECTURE.md` §11's final test, the architecture already passes this test by
construction (nothing in the OS kernel references `video-production-agent` by name), and
inventing a "future Agent" design now would be exactly the architecture-astronautics
`ARCHITECTURE.md` §9 (lens 5) argues against, applied one layer up.

## 2. Agent-internal concerns: separation, and where it already exists

### 2.1 The question

Should the Agent separate intent interpretation, context gathering, observation
interpretation, inference, planning, capability selection, decision making, execution
coordination, result evaluation, replanning, and human escalation into distinct internal
concerns?

### 2.2 What already exists (CURRENT, verified directly against the source tree)

**Yes — and it already does, today, inside the one Agent that exists.** This is not a
recommendation for future work; it is a description of `video-production-agent`'s actual
module layout, confirmed by listing `src/video_agent/agent/` and `src/video_agent/context/`
directly for this document (a stronger check than `REPOSITORY_MAP.md`'s prose alone, which
names only a subset of these files):

`src/video_agent/agent/`: `intent.py`, `planner.py`, `production_plan.py`, `inference.py`,
`speech_inference.py`, `decision.py`, `decision_engine.py`, `decision_finishing.py`,
`requirements.py`, `qc.py`, `editing.py`, `audio.py`, `subtitles.py`, `finishing.py`,
`ai_reasoning.py`.

`src/video_agent/context/`: `builder.py`, `inference.py`, `model.py`.

A reasonable mapping of the task's eleven concerns onto these existing files (the file
*names and existence* are directly verified; the exact internal logic of each was not
re-read line-by-line for this document, so treat the mapping itself as a well-evidenced
inference, not a fully audited claim):

| Concern | Existing module(s) | Status |
|---|---|---|
| Intent interpretation | `agent/intent.py` | CURRENT |
| Context gathering | `context/builder.py` | CURRENT |
| Observation interpretation | `context/inference.py`, `agent/inference.py` | CURRENT |
| Inference (general + domain) | `agent/inference.py`, `agent/speech_inference.py` | CURRENT |
| Planning (general + domain) | `agent/planner.py`, `agent/production_plan.py`, `agent/editing.py`, `agent/audio.py`, `agent/subtitles.py`, `agent/finishing.py` | CURRENT |
| Capability/tool selection | `skills/registry.py` (`SkillRegistry.select_tool()`) | CURRENT, but a silent first-match default (see §1.1, §1.2 item 2) |
| Decision making | `agent/decision.py`, `agent/decision_engine.py`, `agent/decision_finishing.py` | CURRENT |
| Execution coordination | `execution/compiler.py` → `execution/executor.py` (`EXECUTION_MODEL.md`) | CURRENT |
| Result evaluation | `agent/qc.py` (consumes `QCReport`) | CURRENT |
| Replanning | `revise` CLI command (`cmd_revise`, `cli.py`) — "produce the next plan version from rejections and feedback (previous version is preserved)" | CURRENT |
| Human escalation | `WAITING_FOR_APPROVAL` job state + `approve`/`reject` CLI commands, exit code 4 (§4 below) | CURRENT |

This is real, present internal separation — via **modules within one Agent process**, not
via separate Agent processes or services. That distinction matters directly for §3 below.

### 2.3 Where each concern belongs

Per `ARCHITECTURE.md` §3, **all eleven of these concerns are explicitly Agent territory,
not OS territory** — the OS "never imports or depends on Agent logic," and "the Agent owns
the logic that produces a Decision from an Observation, the planning strategy, intent
interpretation, and orchestration order." None of the eleven concerns above is a candidate
to move into the OS kernel (`ARCHITECTURE.md` §8's kernel list has no entry resembling any
of them).

What **does** need an OS-level contract is not these concerns themselves, but **the typed
objects that pass between them and cross the Agent/OS boundary**: `Observation`,
`Inference`, `Decision`, and `ProductionPlan` are already named OS-contract candidates in
`CORE_PRIMITIVES.md` §5–§6, adopted as-is from `video-production-agent`'s existing shapes.
The OS's job, per `CORE_PRIMITIVES.md`'s own framing, is "to keep owning the *type*... while
the Agent owns the *logic* that produces one." Concretely:

- The OS defines what a `Decision` **is** (subject, type, risk, approval, basis, evidence —
  `CORE_PRIMITIVES.md` §5) so that any Agent's `decision.py`-equivalent produces something
  any other tool in the ecosystem (a Compiler, a QC extension, a human reviewer) can read
  the same way.
- The OS has no opinion on **how** an Agent internally organizes the logic that produces a
  Decision — one big function, fifteen small modules exactly as `video-production-agent`
  has today, or a different decomposition entirely are all equally valid from the OS's
  perspective, per the "would this still make sense with a different Agent" test
  (`CORE_PRIMITIVES.md` §12).

**Conclusion:** no OS action is warranted here beyond what `CORE_PRIMITIVES.md` §5–§6
already do. `video-production-agent`'s existing module separation is a reasonable
implementation choice worth noting as a positive example for future Agent authors, not a
pattern the OS should mandate, standardize, or build tooling around.

## 3. Multi-agent future — evaluated, not designed

**This section evaluates whether specialized Agents (a Director Agent, Editor Agent, Audio
Agent, Color Agent, QC Agent, Delivery Agent) would be useful, unnecessary, dangerous, or
future-only. It does not design a multi-agent architecture**, per this task's explicit
scope.

**The evidence today:** there is exactly **one** Agent implementation in the entire
ecosystem, and — per §2.2 above — it already handles domain separation (editing, audio,
subtitles, finishing, QC-result-consumption) via **modules inside one process**, not via
separate communicating Agent processes. No repository in `REPOSITORY_MAP.md`'s audit shows
any inter-Agent communication, message-passing, or coordination protocol of any kind. There
is zero evidence anywhere in the ecosystem that multiple communicating Agent processes are
needed.

**A specific candidate — "QC Agent" — is a category error, not just unproven.** `qc-skill`
is a deterministic, verification-only **Skill**, and `ADR-007` formalizes, OS-wide, that a
verification Capability "may produce Observations, Measurements, Findings, and Reports, but
must contain zero decision, render, publish, or block logic." A "QC Agent" that reasoned
about and acted on QC results would either (a) duplicate `agent/qc.py`'s existing role
inside the one real Agent, gaining nothing, or (b) violate `ADR-007`'s boundary by giving a
verification-shaped component decision-making power it is explicitly forbidden from having.
Either way, "QC Agent" is not a useful future primitive — the correct shape is exactly what
exists today: `qc-skill` reports, `agent/qc.py` (or its equivalent in any future Agent)
decides.

**Verdict: FUTURE-ONLY, if ever.** Specialized Agents-as-separate-processes are not useful
today (no evidence of a coordination need this ecosystem has actually hit), not currently
dangerous (none exist to be dangerous), and not designed here. **If this is ever pursued**,
the coordination boundary between specialized Agents would need to be **exactly the same OS
contracts already defined for a single Agent** — a shared `ProductionPlan`, shared
`Artifact` identity (content-hash, per `SPEC.md` §2), and a shared Decision log
(`CORE_PRIMITIVES.md` §5) — **not a new inter-agent protocol invented for this purpose.**
This follows directly from `ARCHITECTURE.md`'s own test: the OS contracts must make sense
"if `video-production-agent` were replaced by a different Agent" — the same test, applied
to *multiple* Agents simultaneously, has the same answer: they cooperate through the
contracts the OS already owns, or they don't cooperate safely at all. This document does
not invent a message format, a negotiation protocol, or an ownership-arbitration scheme for
that hypothetical future, because no evidence exists yet to design one against
(`ARCHITECTURE.md` §9, lens 5).

## 4. Human + AI collaboration

### 4.1 Execution modes already implemented, not newly needed

The task brief's AUTONOMOUS / ASSISTED / APPROVAL_REQUIRED / MANUAL execution-mode
framing maps directly onto machinery `video-production-agent` **already has, working,
today**:

| Execution mode | Existing mechanism |
|---|---|
| AUTONOMOUS | `Decision.approval == "AUTO"` — executes without a human gate |
| APPROVAL_REQUIRED | `Decision.approval == "CONFIRM"` — Job transitions to `WAITING_FOR_APPROVAL`; `render` exits with **exit code 4** (verified directly, `README.md`: "CONFIRM が残れば WAITING_FOR_APPROVAL (exit 4)") until a human runs `approve`/`reject` |
| MANUAL / hard-stop | `Decision.approval == "BLOCK"` — `Decision.status` becomes `BLOCKED`; per `decision_engine.py`'s own stated invariant, "BLOCK and REJECTED are never executable" |
| ASSISTED | Not a distinct `approval` value — this is a description of *how* an AUTO or CONFIRM decision was arrived at (with or without AI-generated input feeding the Inference that produced it), not a fourth gate state. `providers/base.py`'s "AI output tagged `provenance=AI_GENERATED`, treated as untrusted, validated, never becomes an executable Decision by itself" (`ARCHITECTURE.md` §4) is exactly what "assisted" means in this system: AI proposes, the same AUTO/CONFIRM/BLOCK gate decides how it is allowed to take effect. |

**No new primitive is needed here. This is a documentation/formalization task, not a design
task.** `Decision.approval` (`AUTO`/`CONFIRM`/`BLOCK`, `CORE_PRIMITIVES.md` §5) and the
`approve`/`reject` CLI commands with their exit-code-4 "waiting for approval" contract
already implement the distinction the task brief's four-mode framing is reaching for. The
only genuinely useful output of this section is naming the mapping explicitly, above, so
future documents and future Agents refer to the same four ideas by the same two names
instead of treating them as unrelated concepts.

### 4.2 Representing a human's action

A human materially changing production state — approving, rejecting, or manually editing —
must be represented using primitives that already exist, not a new concept:

- **As an Event**, per `video-production-agent`'s existing temporal/event model
  (`models.Event`, `CORE_PRIMITIVES.md` §8's "Event Timeline" — event history over
  wall-clock/media time, kept unchanged and out of scope for the edit-timeline rename). An
  approval or rejection action is a fact that occurred at a point in time and is a natural
  `Event`.
- **As a Decision with a human `basis`.** `Decision.basis` (`Dict[str, Any]`, verified
  directly in `models/__init__.py`) already records "how it was resolved: settings
  (policy/preference/constraint + provenance), approval, intent, requirements" — a human's
  approve/reject action is recorded via `Service.approve()`/`Service.reject()` (`who`,
  `reason` parameters, verified directly in `cli.py`'s `cmd_approve`/`cmd_reject`), which
  updates `Decision.status` to `APPROVED`/`REJECTED` and is exactly "a Decision with a human
  basis" already, not a proposal.

**Do not introduce a new "HumanAction" or "ManualEdit" type.** Both existing primitives
already cover this: the Event model for "this happened," the Decision model (with its
existing `basis`/`status`/evidence fields) for "and here is what it changed and who
authorized it."

## 5. Creative reasoning vs. technical execution

### 5.1 The task's own examples

- "Opening is too slow" → a Decision to remove a timeline range (typed `edit.trim`-family
  Operation).
- "Music is overpowering the dialogue" → a Decision to duck the music track by a specific
  dB amount (typed `audio.gain`/`audio.dynamics`-family Operation).
- "Color feels too cold" → a Decision to apply a typed color operation (e.g. within
  `color-grading-skill`'s declared, non-approximated operation set).

In every example, the *creative judgment* ("too slow," "overpowering," "too cold") is
qualitative and human/AI-interpreted; the *executed change* is a fully typed Operation with
no ambiguity at all. This gap — between an ambiguous creative statement and a precise
executable change — is exactly what an `Inference` (interpretation, must cite evidence) and
a `Decision` (typed, evidenced, approval-gated) already exist to bridge, per
`CORE_PRIMITIVES.md` §5.

### 5.2 Does this need new primitives?

**Evaluated candidates: `CreativeIntent`, `CreativeDecision`, `CreativeConstraint`,
`StyleReference`, `BrandRule`.**

**Recommendation: do not add `CreativeDecision`, `CreativeConstraint`, `StyleReference`, or
`BrandRule` as new types.** `Decision` and `Constraint` (see `PRODUCTION_LIFECYCLE.md`
§(d), written alongside this document) already cover what each of these would do:

- A "creative decision" is still a `Decision` — same required fields (`subject`, `type`,
  `risk`, `approval`, `basis`, `evidence`), same approval gate, same status lifecycle. It
  does not need a different shape merely because the judgment behind it was aesthetic
  rather than technical; the OS's `Decision` type was never scoped to "technical decisions
  only."
- A "creative constraint" (e.g. "never use hard cuts on beat") is still a `Constraint` —
  see `PRODUCTION_LIFECYCLE.md` §(d)'s existing `Rule(kind="CONSTRAINT", ...)` shape, which
  is domain-agnostic by design (`key`/`value` pairs, not a technical-only schema).
- `StyleReference`/`BrandRule` are, at most, **data** a Decision's evidence or a Project's
  Intent can point to (a reference video, a brand-guideline document) — not a reason to
  invent new typed OS primitives around them. Nothing in the ecosystem processes
  style-reference media or brand rules programmatically today; inventing typed structure
  for them now would be designing for a capability that does not exist
  (`ARCHITECTURE.md` §9, lens 5).

**`CreativeIntent` is the one place a small, deliberately loose addition is worth naming —
marked PROPOSED, not designed as a new type.** The recommendation is **not** a new rigid
schema. `CreativeIntent` can be represented as **loosely-structured text attached to a
Project's existing Intent data**, cited as `evidence`/`rationale` in a Decision — which
already has a mandatory evidence requirement (`CORE_PRIMITIVES.md` §5) capable of carrying
exactly this. Concretely: a Project's Intent gains an optional free-text or lightly
structured field (e.g. `creative_intent: string` or a small list of tagged notes) that a
human or an Inference step can cite by id from a Decision's `evidence` list, the same way an
Observation id is cited today.

**Why not a rigid typed schema (tone/mood/rhythm as enums):** forcing creative language into
a closed vocabulary loses exactly the ambiguity that makes it useful. "The opening feels too
slow" is not reducible to `pacing: SLOW` without discarding the information a human
reviewer or an LLM would actually use to decide *what to do about it* — the same
information a `MOOD: MELANCHOLIC` enum value would discard relative to "this needs to feel
like the character is grieving, not just be slower." No evidence anywhere in this ecosystem
— zero Skills, zero ADRs, zero eval cases per `REPOSITORY_MAP.md` — shows a need for more
structure than "text a Decision can cite as evidence" today. Building a typed creative
schema now would be inventing structure ahead of any concrete consumer of that structure,
which is the same failure mode `CAPABILITY_MODEL.md`'s lifecycle-state decision and
`ARCHITECTURE.md`'s resource-model decision both already declined to make elsewhere in this
project.

**Summary table:**

| Candidate | Verdict |
|---|---|
| `CreativeIntent` (as a field on Project's Intent) | **PROPOSED**, light addition — loosely-structured text, not a new type |
| `CreativeDecision` | **NOT NEEDED** — `Decision` already covers it |
| `CreativeConstraint` | **NOT NEEDED** — `Constraint` already covers it (`PRODUCTION_LIFECYCLE.md` §(d)) |
| `StyleReference` | **NOT NEEDED** as a type — at most a cited evidence artifact, no ecosystem consumer exists today |
| `BrandRule` | **NOT NEEDED** as a type — same reasoning as `StyleReference` |

## 6. What this document deliberately does not do

- **Does not design a multi-agent protocol.** §3 evaluates and rejects designing one now;
  if the trigger evidence ever appears, the coordination boundary is the existing OS
  contracts, not a new negotiation format invented here.
- **Does not schedule a real `AIProvider` implementation to a Roadmap phase.** §1.2 is
  explicit that no phase commits to this; stating otherwise would contradict `ROADMAP.md`.
- **Does not propose restructuring `video-production-agent`'s existing internal module
  layout.** §2 concludes its current separation is a reasonable, working implementation
  choice the OS has no opinion on, not a target for OS-mandated refactoring.
- **Does not design `CreativeIntent`'s exact field shape.** §5 names it as a light,
  loosely-structured PROPOSED addition to Project Intent data — the precise shape (a single
  free-text field vs. a small tagged-note list) is left open, deliberately, until a real
  consumer needs one or the other.
