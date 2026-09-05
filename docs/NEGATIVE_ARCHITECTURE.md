# Negative Architecture: What This Is Not

Status: **Derived, draft, 2026-09-05.** A positive architecture document (`ARCHITECTURE.md`)
states what the AI Video Production OS is. This document states, with equal rigor and the
same evidence base, what it explicitly **is not** — not as a marketing disclaimer, but
because every boundary below prevents a specific, plausible misreading of the audit
evidence that would otherwise lead someone to design (or evaluate) this project as the
wrong kind of thing. Tags follow `DESIGN_SYSTEM.md` §2. Each section states: why the
distinction matters, what belongs inside the OS, what belongs outside it, and where the
integration boundary between the two actually sits.

## How to read this document

Ten misreadings named in the task brief are addressed first, in the brief's own order,
followed by additional negative boundaries this audit's evidence independently supports.
Every claim of absence below was verified — "confirmed absent" means someone looked and
did not find it, not that it was assumed absent because no one mentioned it.

## 1. NOT merely a video editor

**Why it matters:** "video editor" implies an interactive surface a human manipulates
directly — timeline scrubbing, preview playback, click-to-trim. Evaluating this project
against that mental model would fault it for missing a UI it was never trying to build.

**What's confirmed absent (CURRENT):** no web UI, no interactive editing surface, no
timeline-scrubbing interface exists in any of the 11 audited repositories
(`REPOSITORY_MAP.md`, `video-production-agent` section: "Explicitly NOT implemented...
web UI"; `DESIGN_SYSTEM.md` §6: "there is no UI anywhere in this ecosystem today"). Every
existing interaction surface is a CLI (`ARCHITECTURE.md` §11: "every Skill and
`video-production-agent` itself expose a plain CLI with `--dry-run`/`--json`").

**What belongs inside the OS:** the contracts (Capability, Artifact, Plan, Operation)
that any future editing UI — interactive or not — would need to consume in order to show
a human what's possible, what's happened, and what a Plan intends.

**What belongs outside:** the UI itself. `ARCHITECTURE.md` §8 lists "A UI" among what is
explicitly not in the kernel: "None exists today; none is assumed." `DESIGN_SYSTEM.md`
§6 goes further and declines to design a visual brand, component library, or design
token system precisely because there is no UI surface for these to apply to yet.

**Integration boundary:** a future editing UI is an Agent-layer consumer like any other
(`ARCHITECTURE.md` §3's Agent role) — it would interpret a human's direct manipulation
gestures into Decisions and Plan edits through the same OS contracts a text-only Agent
uses, not through a privileged UI-specific API.

## 2. NOT merely an FFmpeg wrapper

**Why it matters:** `ffmpeg-skill` is real, foundational, and used by five other Skills —
easy to mistake for the whole system, especially since nothing else implements its
contract today.

**What's true today, honestly:** every Skill that touches media ultimately delegates to
`ffmpeg`/`ffprobe`, either directly (`ffmpeg-skill`, `qc-skill`, `media-analysis-skill`)
or via `ffmpeg-skill` (`video-editing-skill`, `audio-production-skill`,
`color-grading-skill`, `motion-graphics-skill`, `thumbnail-skill`'s frame-extract path).
`ARCHITECTURE.md` §4 states this caveat plainly: the Skills are vendor-independent *of
each other*, "but it is **not yet** independence of the ecosystem from FFmpeg itself,
because `ffmpeg-skill` is FFmpeg-specific by design and nothing else implements its
contract today." Being honest about this is the point — claiming engine-independence
already exists would be false.

**What belongs inside the OS:** the Capability/Provider split (`CAPABILITY_MODEL.md`)
that makes a second engine *possible* without a redesign — a hypothetical
`gstreamer-skill` could register as another Provider of `edit.trim` alongside
`video-editing-skill`'s current ffmpeg-backed implementation, because `edit.trim` names
the accomplishable thing, not the engine that does it.

**What belongs outside:** FFmpeg itself, and any specific media engine's implementation
details. `ARCHITECTURE.md` §8: "`ffmpeg-skill` is a Skill (a very foundational one, given
how many other Skills depend on it), not part of the OS."

**Integration boundary:** a Skill registers as a Provider of a Capability id; the OS
kernel never references `ffmpeg`, `ffmpeg-skill`, or any engine by name in a contract
shape (`SPEC.md` §1's `CapabilityContract` has no engine-specific field). The
architecture is engine-agnostic by design; the ecosystem is not yet engine-diverse in
practice — these are two different claims and this document does not conflate them.

## 3. NOT merely an AI Agent

**Why it matters:** `video-production-agent` is the most complete, most instrumented
piece of software in the whole audit (34 ADRs, a 1851-line schema, real eval suites) —
the temptation to treat it *as* the architecture, rather than *evidence for* the
architecture, is real and named explicitly as a risk this project guards against.

**What's true today:** `video-production-agent` is "**the first, currently-incomplete
consumer of this OS**, not the OS itself" (`ARCHITECTURE.md` §1) — "a standing
instruction for this whole project." `REPOSITORY_MAP.md` states the same rule from the
evidence side: it "must be treated... as the first major consumer and orchestration
layer of the future OS, not the OS itself, and not a finished reference architecture...
The OS must not be redesigned around its current gaps."

**What belongs inside the OS:** the *shape* of the types `video-production-agent`
already defined correctly — Observation, Inference, Decision, ProductionPlan, Operation,
Artifact, Capability, QCReport, ProductionReceipt — as a versioned contract package any
Agent can depend on (`ARCHITECTURE.md` §3).

**What belongs outside:** the planning *logic* — how intent becomes a Decision, what
counts as a good Plan, orchestration order and strategy. `ARCHITECTURE.md` §3: "The Agent
owns the *logic* that produces a Decision from an Observation, the planning strategy,
intent interpretation, and orchestration order."

**Integration boundary:** dependency direction, never reversed. "The OS never imports or
depends on Agent logic. An Agent... always imports/depends on the OS contract, never the
reverse" (`ARCHITECTURE.md` §3). `CORE_PRIMITIVES.md` §12 states the concrete test every
primitive in this project is checked against: *would this still make sense if
`video-production-agent` were replaced by a different Agent, or by a human using a CLI
directly?*

## 4. NOT merely a workflow engine

**Why it matters:** "DAG of Operations over Artifacts" (`CORE_PRIMITIVES.md` §6) sounds
like it's reaching for Airflow, Temporal, or Dagster's territory — worth stating
precisely why this project declined that path rather than leaving the resemblance
unaddressed.

**What was considered and rejected (ADR-006):** "Adopt a dedicated workflow engine
(Temporal, Airflow, or similar). **Rejected for now.**" The reasoning is evidence-based,
not aesthetic: "no evidence of scale that would matter (single-machine, local-first
ecosystem, no repo shows more than a handful of concurrent operations)," and introducing
"a distributed workflow engine's operational complexity (separate service, persistence
layer, worker fleet) against a system that runs as a single local CLI process today would
be solving a problem that does not yet exist" (ADR-006, Alternatives Considered).
`ARCHITECTURE.md` §6 draws the positive lesson from Dagster specifically (asset/artifact-
centric graphs over task-centric linear DAGs), without importing Dagster or any workflow
engine as a dependency.

**What belongs inside the OS:** the DAG-over-Artifacts *framing* of the Plan model that
already exists (`ARCHITECTURE.md` §6) — no new engine, no new graph representation
(`EXECUTION_MODEL.md` §0: "This document does not invent parallel execution, worker
pools, or a task queue").

**What belongs outside:** a scheduler, worker pool, task queue, or any concurrency model.
`EXECUTION_MODEL.md` §2.2 is explicit that execution is "strictly sequential topological
execution" today, by design, not as a stopgap: "no evidence anywhere in the ecosystem
shows a need for [concurrent execution]."

**Integration boundary:** if a future Roadmap phase produces concrete evidence of a
sequential-execution bottleneck, a concurrency model is designed then, against real
numbers (`EXECUTION_MODEL.md` §2.2, §6) — the OS kernel does not pre-build hooks for a
workflow engine it has no evidence it needs.

## 5. NOT merely an MCP server

**Why it matters:** MCP is a natural lens for anyone approaching this project from the
Claude/agent-tooling ecosystem — easy to assume it's the interface layer by default.

**What's true today (ADR-010):** MCP is used by exactly **1 of 11 repos**
(`ffmpeg-skill`), and at least three others explicitly defer or reject it:
`media-analysis-skill` ADR-010 ("No MCP server in 0.1.0... can be added as a thin
wrapper over `run` later"), `motion-graphics-skill`'s architecture doc (lists MCP among
things it deliberately does not do), and `subtitle-skill`'s README (does not include it)
(`REPOSITORY_MAP.md` finding 5).

**What belongs inside the OS:** the Capability Contract format itself — the thing that
makes it possible to *generate* an MCP adapter mechanically, the way `ffmpeg-skill`
already generates its `tools/list` live from the same contract generator used by its CLI
(`REPOSITORY_MAP.md`, `ffmpeg-skill` section).

**What belongs outside:** MCP as a mandatory transport, or any transport-specific logic
in OS-core contracts. ADR-010's Decision: "Treat MCP as one external interface adapter
over the Capability Contract... not an OS-core dependency." `ARCHITECTURE.md` §5: "Claude
Code, Codex, Gemini CLI, a web UI, or a human at a terminal are all equally valid
Agent-side consumers of the same contract; none is privileged by the OS."

**Integration boundary:** MCP, HTTP, gRPC, and CLI are all adapters generated from or
built over the same Capability Contract — none is baked into the kernel (`ARCHITECTURE.md`
§8: "A specific transport (MCP, HTTP, gRPC)" is explicitly excluded from the kernel).

## 6. NOT merely a QC tool

**Why it matters:** `qc-skill` is "the one repository in the whole audit where the task's
assumptions were fully confirmed against source code" (`QC_ARCHITECTURE.md` header) —
its rigor could easily be mistaken for the center of the whole project rather than one
domain within it.

**What's true today:** QC (`qc-skill`) is one Capability domain among several
independently-versioned ones — editing, audio, color, subtitles, motion graphics,
thumbnails, transcription, and media analysis all exist as separate Skills with their own
release cadences (`REPOSITORY_MAP.md`). `QC_ARCHITECTURE.md` §4.2 goes further and shows
QC is not even the whole "verification" story: `media-analysis-skill` provides raw
Observations in overlapping measurement domains without QC's judgment layer, and neither
subsumes the other.

**What belongs inside the OS:** the `QCReport`/`Finding`/`Check`/`Measurement` shape and
the PASS/WARN/FAIL/UNKNOWN semantics, as a verification *contract* any Capability can
implement — not QC's specific checks (`ARCHITECTURE.md` §8 item 7: "the *shape*, not any
specific check's implementation").

**What belongs outside:** the specific measurement algorithms (loudness thresholds,
freeze-detection parameters) — Skill business logic, per `ARCHITECTURE.md` §8's
"Editing, subtitle, color, or QC algorithms. These are Skill business logic."

**Integration boundary:** any Capability whose role is verification, not only
`qc-skill`, must conform to the "measures, does not decide" rule (this project's
ADR-007) — QC is the reference implementation of a pattern the OS applies to a whole
class of future verification Capabilities, not a privileged single tool.

## 7. NOT merely a media library or asset manager

**Why it matters:** Artifacts, provenance, and content-addressed identity sound like
database/asset-management concerns — worth stating explicitly that no such system exists
or is planned.

**What's confirmed absent:** no database exists anywhere in the 11-repo ecosystem.
`REPOSITORY_MAP.md` lists a database explicitly among what `video-production-agent` does
**not** implement. `PROVENANCE.md` §3 states the rejection directly when weighing where
provenance should live: "A database — rejected... no repository anywhere in the 11-repo
ecosystem persists state in one. Introducing a database purely for provenance would be
new, unevidenced infrastructure... exactly the kind of architecture astronautics this
project's rules forbid." No asset-management UI exists either — confirmed absent
alongside every other UI (`DESIGN_SYSTEM.md` §6).

**What belongs inside the OS:** the Artifact *identity* scheme (content hash) and
provenance *shape* — enough to answer "what produced this, from what inputs" without a
central index (`ARTIFACT_MODEL.md` §1, §4).

**What belongs outside:** any persistence layer, index, or query service. `SPEC.md` §7:
"A query language for the Capability registry — a flat lookup by id is sufficient for
the ecosystem size that exists today." `PROVENANCE.md` §3 rejects "a receipt database, a
receipt index service" for the same reason.

**Integration boundary:** the recommended provenance storage pattern is sidecar JSON
traveling with the Artifact — "physically a separate `.provenance.json` file next to the
media file... or a field inside the Project IR document" (`PROVENANCE.md` §3) — never a
central database an Agent or human must query through a service.

## 8. NOT merely a plugin marketplace

**Why it matters:** the Capability/Provider/Skill split and the Plugin Model's
permission-declaration proposal both sound like marketplace infrastructure — the
document that defines them states explicitly that this is not what's being built.

**What's true today:** `PLUGIN_MODEL.md`'s header states the scope directly: "this
document is explicitly **not a marketplace**. It designs the minimal foundation that
makes a third-party Skill possible and safe-by-structure to admit, and stops there — no
package index, no distribution channel, no discovery UI, no rating/review system."
§9 lists the excluded items by name: a package index or registry service, a
rating/review/trust-scoring system, a payment or monetization mechanism, an
automatic-update mechanism.

**What belongs inside the OS:** the minimum that makes a third-party Skill *possible* —
uniform Capability declaration (§2), compatibility checking via `contract_version`
ranges (§3), a permission-declaration proposal (§4, itself marked PROPOSED with no
enforcement mechanism yet), and structural rejection criteria (§7).

**What belongs outside:** discovery-at-scale, trust scoring, monetization, or automatic
updates — all named as premature relative to "zero third-party Skills exist yet to design
a marketplace around" (`PLUGIN_MODEL.md` §9).

**Integration boundary:** a plugin registers exactly the same way an in-house Skill does
— "there is no separate, lesser, or different contract format for 'external' vs.
'in-house' Skills" (`PLUGIN_MODEL.md` §2) — because a marketplace's trust-differentiation
machinery has no foundation to sit on until real third-party Skills exist to motivate it.

## 9. NOT merely an orchestration framework

**Why it matters:** "orchestrates Capability invocations" sounds exactly like what an
orchestration framework does — worth stating precisely where orchestration lives and why
it is not OS-core.

**What's true today:** orchestration — deciding what order to run things in, which
Capability to invoke for a given intent, how to react to a failure — is Agent-layer logic
by the OS/Agent boundary rule (`ARCHITECTURE.md` §3): "The Agent owns... orchestration
order." The OS provides the *contract* orchestration runs against (Plan structure,
structural validation, the Runtime's safe-invocation guarantees) but never the
orchestration decisions themselves.

**What belongs inside the OS:** Plan structural validation (does every referenced
Capability/Artifact exist, is the DAG acyclic — `ARCHITECTURE.md` §8 item 4) and the
Execution/Runtime contract that any orchestrator's chosen Operations run through
(`item 5`).

**What belongs outside:** the orchestration *strategy* — which Capability to reach for
given an intent, how to sequence independent branches, when to retry versus escalate to
a human. `ARCHITECTURE.md` §8 explicitly excludes "a scheduler" and treats "the kernel
defines the execution *contract*, and a CLI process is a completely sufficient
*coordinator*" as the deliberate, minimal answer.

**Integration boundary:** the same dependency-direction rule as Principle/§3 above — an
orchestrator (today `video-production-agent`) depends on the OS's Plan/Operation
contracts; the OS never depends on any specific orchestration strategy.

## 10. NOT merely a collection of Skills

**Why it matters:** with 11 repositories doing real, working things, it's tempting to
describe "the OS" as simply the sum of the Skills that exist today — this misses the
entire point of `CAPABILITY_MODEL.md`.

**What's true today:** `CAPABILITY_MODEL.md`'s whole argument is that Capabilities, not
Skills, are the unit of "what can be done" — "A Skill is **not** an implementation. It is
the thing a `ProductionPlan` refers to" applies to Capability, and a single Skill package
typically provides *several* Capabilities (`ffmpeg-skill` alone provides at least six
named Capability examples across 21 tool scripts — `CAPABILITY_MODEL.md` §1). Naming the
OS as "the 10 (or 11) Skills" would also misdescribe its own evidence:
`transcription-skill` — real, working — was not in the task's original "9 skills" list,
proving "the number of Skills is not fixed and the OS must not assume it"
(`REPOSITORY_MAP.md`).

**What belongs inside the OS:** the Capability registry, contract format, and Provider
collision policy — the mechanism by which *any* number of Skills, known or not-yet-built,
register what they can do (`CAPABILITY_MODEL.md`).

**What belongs outside:** any specific Skill by name. `ARCHITECTURE.md` §11's final test:
"Remove one of the current Skills, does the OS still make sense? Yes — nothing in the
kernel (§8) references any specific Skill by name."

**Integration boundary:** a Skill joins by publishing a Capability Contract and
registering Providers; the OS registry (once decoupled from `video-production-agent`'s
current manual `Service.adapter()` — named explicitly as a gap, not hidden,
`ARCHITECTURE.md` §9 lens 2) has no hardcoded Skill list to edit.

## 11. NOT a distributed system

**Why it matters:** DAGs, Providers, and a Runtime contract can sound distributed-systems-
shaped even when nothing about the ecosystem is.

**What's confirmed:** "Every Operation today runs as a local subprocess on the same
machine as the Agent. Nothing in this document assumes otherwise" (`EXECUTION_MODEL.md`
§0). No repo shows evidence of multi-machine coordination, remote workers, or network
calls of any kind (`SPEC.md` §7). `ARTIFACT_MODEL.md` header states plainly: "this is not
a blockchain: there is no distributed ledger, no consensus, no cryptographic chaining
requirement beyond ordinary content hashing."

**What belongs outside:** distributed execution, remote workers, and any consensus or
replication mechanism — none is designed anywhere in this document set
(`EXECUTION_MODEL.md` §6).

**Integration boundary:** if genuine multi-machine execution becomes evidenced need, it
is explicitly Roadmap Phase 7+ work (`ARCHITECTURE.md` §10), designed against real
requirements at that time, not anticipated in the kernel now.

## 12. NOT a database

**Why it matters:** stated fully under §7 above; restated here as its own boundary
because provenance, caching, and Artifact identity could each independently tempt a
designer toward "just add a database."

**What's confirmed absent:** no repo in the 11-repo ecosystem persists state in a
database (`REPOSITORY_MAP.md`; `PROVENANCE.md` §3). Caching that does exist (`qc-skill`'s
sharded, tamper-checked file cache) is a plain filesystem pattern, not a database
(`ARTIFACT_MODEL.md` §6).

**Integration boundary:** provenance and cache state are sidecar files keyed by content
hash, not rows in a queryable store — this is a load-bearing constraint on any future
implementation, not an incidental detail.

## 13. NOT a scheduler or resource manager

**Why it matters:** repeats and consolidates the resource-model boundary threaded through
§4 and §9 above, because it is one of the most explicitly-argued exclusions in the whole
document set.

**What's confirmed absent:** "No CPU/GPU/concurrency scheduling exists in any audited
repo" (`ARCHITECTURE.md` §10). `qc-skill` and `media-analysis-skill` "both **document,
explicitly and honestly, that they do not enforce CPU/memory/disk resource limits**"
(`SECURITY_MODEL.md` §5).

**What belongs inside the OS:** a Capability Contract may declare coarse resource
*hints* already implicit in existing tools (`requires_visual_verification`, `audio_only`,
`video_required`) — "not a scheduler, a declared hint" (`ARCHITECTURE.md` §10).

**What belongs outside:** cost-aware provider selection, concurrency limits,
cloud/local routing, cgroups/rlimits/container sandboxing for resource limiting —
explicitly named Roadmap Phase 7+ work (`ARCHITECTURE.md` §10; `SECURITY_MODEL.md` §5).

**Integration boundary:** the only resource guarantee the Runtime contract makes today is
a wall-clock timeout with process-group kill-tree semantics, applied uniformly
(`SECURITY_MODEL.md` §5's proposed fix for `ffmpeg-skill`'s 20-script gap) — anything
beyond that is an honestly-declared gap (`resource_limits: { cpu: none, memory: none,
disk: none, wall_clock: <seconds> }`), not a silent promise.

## 14. NOT a sandbox or an authentication system

**Why it matters:** "security model" and "permission declaration" (`PLUGIN_MODEL.md` §4)
can suggest a security boundary stronger than what actually exists — this document is
explicit that it is not one, rather than letting the terminology imply more than the
evidence supports.

**What's confirmed absent:** "No repo in the ecosystem uses containers, VMs, or any
OS-level sandbox (seccomp, namespaces, gVisor, etc.) beyond subprocess isolation plus path
policy — confirmed absent everywhere, not merely undocumented" (`PLUGIN_MODEL.md` §6). No
repo talks to a network service, so no authentication/authorization model exists or is
proposed (`SECURITY_MODEL.md` §9: "no authentication/authorization model... no blockchain
or distributed-ledger anything... no sandboxing/container runtime").

**What belongs inside the OS today:** subprocess-based isolation (process group,
`shell=False`, workspace-confined path policy) — a genuinely good pattern for the current
single-owner trust level, stated as such, not oversold (`PLUGIN_MODEL.md` §6).

**What belongs outside, marked as a real and named limit, not a solved problem:**
container/VM/seccomp-level isolation for genuinely untrusted third-party code. "The
moment a genuinely untrusted third party is expected to publish a Skill that any operator
can run, this gap becomes load-bearing and must be revisited before that happens — not
after" (`PLUGIN_MODEL.md` §6).

**Integration boundary:** the FORBIDDEN_KEYS/PathPolicy pattern is "a **contract-level**
guarantee, enforceable by convention and conformance testing, not a **kernel-level**
guarantee enforced regardless of what the plugin's own process actually does once
spawned" (`PLUGIN_MODEL.md` §6) — this document does not let the word "security model"
imply a stronger boundary than that.

## What this document deliberately does not include

- A comparison against any specific competing product feature-by-feature — that is
  `COMPETITIVE_ANALYSIS.md`'s job; this document only states negative boundaries
  evidenced by this project's own audit, not market positioning.
- Predictions about which of the "NOT yet" caveats (engine diversity, third-party
  isolation, cross-machine execution) will resolve on any particular timeline — those are
  `ROADMAP.md` questions, explicitly left open there rather than committed to here.
- A claim that any boundary above is permanent. Several (engine independence, isolation
  strength) are named as *current, honest limits*, not as things this architecture
  forbids solving later — see the Roadmap open questions each section cites.
