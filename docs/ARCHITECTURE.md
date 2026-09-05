# AI Video Production OS — Architecture

Status: draft architecture, Phase 0 (research) deliverable. This document is the
synthesis of `REPOSITORY_MAP.md` (evidence), `CORE_PRIMITIVES.md` (definitions), and
`CAPABILITY_MODEL.md` (the Capability/Skill/Provider/Runtime split), read together with
competitive research (`COMPETITIVE_ANALYSIS.md`). It has been through the red-team pass
described in §9 before being written down here — the passes are not appended after the
fact, they shaped what follows.

## 1. What this project actually is

An **AI Video Production OS** is a set of contracts and shared infrastructure that let
independently-built Skills (media-processing packages) and independently-built Agents
(planning/reasoning software, human or AI) cooperate safely, reproducibly, and without
either depending on the other's implementation.

It is not: a finished autonomous video-editing product, a single AI agent, a
microservice platform, or a rewrite of the nine (in truth, at least eleven — see
`REPOSITORY_MAP.md`) existing repositories. Those repositories are **evidence and
implementation assets**, not the architecture. `video-production-agent` in particular is
**the first, currently-incomplete consumer of this OS**, not the OS itself — this is a
standing instruction for this whole project (see §3) and every design decision below was
checked against it.

## 2. Guiding principle

*What would the correct OS for AI video production look like from first principles,
while intelligently reusing what the ecosystem has already proven works?* Concretely,
this rules out two failure modes found by inspecting the actual repos:

- **Don't discard what's already correct.** The Observation/Inference/Decision split,
  the forbidden-key security pattern, the single-subprocess-module delegation to
  `ffmpeg-skill`, and `qc-skill`'s identity/provenance scheme were independently
  designed correctly by whoever built these repos. They are adopted, not reinvented.
- **Don't assume the current shape is final.** `transcription-skill` exists, works, and
  was not in the task's original "9 skills" list. The `Skill` word already means two
  different things in `video-production-agent`'s own source. `qc-skill` and
  `media-analysis-skill` already duplicated measurement logic with no registry to catch
  it. These are real defects the OS must fix, not hypothetical risks to guard against.

## 3. The OS / Agent boundary

The task brief's proposed shape —

```
AI Video Production OS
        ├── Agent        (intent, reasoning, planning, decisions, orchestration)
        ├── Core OS       (contracts, capabilities, artifacts, execution,
        │                  provenance, security, verification)
        └── Skills        (editing, audio, color, subtitles, motion graphics,
                            thumbnails, media analysis, QC, transcription, future...)
```

— is validated by the evidence, with one important refinement. `video-production-agent`
already keeps its own Observation/Inference/Decision/Compiler/Executor pipeline
internally deterministic and treats AI output as untrusted input requiring validation
(`providers/base.py`) — i.e., it already tries to behave like "Agent logic on top of OS-
shaped contracts," it just currently owns both halves in one repository because no
separate OS package exists yet for it to depend on instead.

**The refinement:** the boundary is not "Agent repo vs. OS repo" as a deployment
question (this project does not mandate splitting `video-production-agent` into two
repos on day one — see `ROADMAP.md` for when/whether that happens). The boundary is a
**dependency direction and a type-ownership rule**:

- The OS owns the *shape* of Observation, Inference, Decision, ProductionPlan, Operation,
  Artifact, Capability, QCReport, and ProductionReceipt — as a versioned contract package
  any Agent can depend on.
- The Agent owns the *logic* that produces a Decision from an Observation, the planning
  strategy, intent interpretation, and orchestration order.
- The OS never imports or depends on Agent logic. An Agent (today `video-production-agent`,
  tomorrow a different one, or a human using a CLI) always imports/depends on the OS
  contract, never the reverse.

Concretely, this means `video_agent.models.{Observation,Inference,Decision,...}` are
**candidates to become an OS contract package** (`avpos-contracts` or similar) that
`video-production-agent` then depends on rather than defines — a refactor, not a
rewrite, because the shapes are already correct (see §9.2 for why this is deferred to a
later Roadmap phase rather than done immediately).

**What the Agent may do:** interpret intent, reason, make Decisions, propose Plans,
select Capabilities/Providers, react to Observations, revise Plans, request human
approval.

**What the OS may do:** define contracts, discover Capabilities, validate Plans
structurally, execute Operations safely, manage Artifacts, enforce the security
Runtime, maintain provenance, verify results against a Plan's declared intent, expose
system state (what's installed, what's AVAILABLE, what ran).

**What neither may silently do:** the OS never makes a production decision (a QC
`FAIL` is a fact, not an instruction to re-render — `qc-skill`'s own ADR-001 already
enforces exactly this and is the reference implementation for QC's role, see
`QC_ARCHITECTURE.md`); an Agent never emits a raw shell command or unvalidated filter
string in place of a typed Operation (already enforced by `FORBIDDEN_KEYS` at every
existing Skill boundary — this OS makes that enforcement a first-class Runtime
guarantee instead of eight independently-written copies of the same denylist).

## 4. Vendor and tool independence

- **Agent-agnostic (validated by evidence):** `video-production-agent`'s
  `providers/base.py` already defines a generic `AIProvider` interface with no
  Anthropic/OpenAI SDK imported anywhere, and its rule engine
  (`policy/rules.py`/`decision_engine.py`) runs with **zero** AI provider today
  (`NullProvider`). The system already works, end-to-end, for deterministic operations
  (silence trim, loudness normalize) without any LLM in the loop. This is not a
  theoretical goal — it is the system's current, verified behavior. The OS formalizes
  this as a guarantee: **a human, a deterministic rules file, or any LLM (Claude, GPT,
  Gemini, local) can drive the same contracts.**
- **Media-engine-agnostic, with an honest caveat:** every existing Skill delegates
  ffmpeg execution to one shared dependency, `ffmpeg-skill` — this is real
  vendor-independence *of the Skills from each other*, but it is **not yet** independence
  of the ecosystem from FFmpeg itself, because `ffmpeg-skill` is FFmpeg-specific by
  design and nothing else implements its contract today. The OS's Capability/Provider
  split is what makes future independence possible (a hypothetical `gstreamer-skill`
  could register as another Provider of `edit.trim`) without claiming that independence
  already exists.

## 5. MCP's place

MCP is used by exactly one repository (`ffmpeg-skill`, a stdio JSON-RPC server whose
`tools/list` is generated live from the same contract used by its CLI) and is explicitly
deferred or explicitly rejected as a design goal by at least three others
(`media-analysis-skill` ADR-010, `motion-graphics-skill`'s architecture doc,
`subtitle-skill`'s README). This is direct evidence against putting MCP in the OS core.

**Decision:** MCP is an **external interface adapter**, not an OS-core dependency. The
useful thing `ffmpeg-skill` proved is that an MCP surface can be **generated from a
Capability Contract** rather than hand-written per tool. The OS formalizes the Capability
Contract format (`SKILL_SPEC.md`) precisely so that *any* conformant Skill can get an MCP
adapter, a CLI, and a Python/other-language binding for free from one contract — instead
of MCP support being a bespoke, one-off reimplementation like it is today in
`ffmpeg-skill` alone. Claude Code, Codex, Gemini CLI, a web UI, or a human at a terminal
are all equally valid Agent-side consumers of the same contract; none is privileged by
the OS.

## 6. Composability

Per `CORE_PRIMITIVES.md` §6, a `ProductionPlan` is a **DAG of Operations over
Artifacts**, not a fixed pipeline. The frequently-drawn linear sequence —

```
media-analysis → editing → audio → color → subtitle → graphics → thumbnail → qc
```

— is one common *shape* this DAG can take, not a mandated order. This is already true of
`video-production-agent`'s plan/step model internally; this document's contribution is
making the DAG-not-pipeline framing explicit so future Skills and pipeline authors don't
assume linearity. No new graph engine is introduced — the existing Project IR's
plan/step representation is the DAG, formalized (`EXECUTION_MODEL.md`). This follows the
Dagster-over-Airflow lesson from `COMPETITIVE_ANALYSIS.md`: QC gates attach naturally to
**artifacts** (a rough-cut, a graded master, a captioned export), not to abstract task
nodes, and an artifact-centric DAG models that directly.

## 7. Security posture (summary — see `SECURITY_MODEL.md`)

Every audited Skill independently converged on the same five security primitives: a
`FORBIDDEN_KEYS`-style parameter denylist, symlink-resolved path containment (never
string-prefix matching), `shell=False`/list-argv subprocess invocation exclusively,
workspace-confined and never-clobber-input output policy, and process-group timeout
kill. This convergence is the strongest possible evidence that these belong in the OS's
shared Runtime contract rather than being re-derived by the next Skill author (and the
one after that, and so on — seven times is enough).

One gap was found and is treated as a live finding, not a hypothetical: `subtitle-skill`
validates cue text structurally (control characters, line length, timing) but has no
defense against a downstream Agent step feeding that text into an LLM prompt
unsanitized. The OS security model requires that **any text extracted from
untrusted media (subtitles, container metadata, filenames)** be tagged as untrusted data
in the Capability Contract's output schema, so an Agent-side prompt-construction layer
can treat it the same way this very session treats external tool output — as data, never
as instructions.

## 8. The minimal kernel — and what is deliberately excluded

### In the kernel

1. **Contracts** — the Capability Contract schema format (what a Skill must publish to
   be discoverable): id, version, parameter schema, input/output artifact types,
   verification hints, lifecycle state, security declarations.
2. **Capability registry** — discovery, Provider registration, collision surfacing
   (`CAPABILITY_MODEL.md`).
3. **Artifact model** — identity (content hash), type, provenance links
   (`ARTIFACT_MODEL.md`).
4. **Plan model and structural validation** — the DAG shape, and *structural* validity
   checks (does every referenced Capability/Artifact exist, are types compatible) —
   never *semantic* validity ("is this a good plan," which is Agent judgment).
5. **Execution/Runtime contract** — the safe-invocation guarantees of §7, and the
   Operation/Execution/idempotency-key model (`EXECUTION_MODEL.md`).
6. **Provenance and ProductionReceipt** — recording what ran, with what versions, from
   what inputs (`PROVENANCE.md`).
7. **Verification contract** — the QCReport/Finding/Check/Measurement shape and the
   PASS/WARN/FAIL/UNKNOWN semantics (`QC_ARCHITECTURE.md`) — the *shape*, not any
   specific check's implementation.

This list is smaller than the task brief's suggested candidate list in one deliberate
way: it does **not** include "runtime" as a scheduler/coordinator service, because no
evidence anywhere in the ecosystem shows a need for one yet (§10, Resource Model) — the
kernel defines the execution *contract*, and a CLI process is a completely sufficient
*coordinator* for everything the current ecosystem does.

### Explicitly NOT in the kernel

- **FFmpeg, or any specific media engine's implementation details.** `ffmpeg-skill` is a
  Skill (a very foundational one, given how many other Skills depend on it), not part of
  the OS.
- **Any specific AI model or vendor SDK.** Confirmed already true in the one Agent that
  exists (`NullProvider` is the only shipped implementation).
- **Editing, subtitle, color, or QC algorithms.** These are Skill business logic.
- **A UI.** None exists today; none is assumed.
- **Cloud infrastructure, a job queue, or a scheduler.** None exists today; the Resource
  Model (§10) stays deliberately minimal rather than anticipating scale nobody has hit.
- **A specific transport (MCP, HTTP, gRPC).** Per §5, these are adapters over the
  Capability Contract, not the contract itself.

## 9. Red-team summary (10 lenses)

Each lens below states the attack, what it found, and what changed or was deliberately
not changed as a result. Full detail lives inline where it drove a decision above; this
section is the accountability record.

1. **Simplicity** — *Attack:* the Capability/Skill/Provider/Runtime split is a fourth
   noun where the ecosystem currently gets by with one ("Skill," overloaded). *Verdict:*
   kept, because the overload is a **found bug** (the `SkillSpec`/`SkillPackage`
   collision in `video-production-agent`'s own source), not a hypothetical one, and the
   split has one concrete job (fixing the qc-skill/media-analysis-skill duplication) that
   three nouns can't do. *Changed:* Capability lifecycle was cut from 7 states to 5
   (§`CAPABILITY_MODEL.md`) because no evidence supports finer granularity.
2. **Extensibility** — *Attack:* can a totally new Skill (e.g. `dubbing-skill`) join
   without touching OS code? *Verdict:* yes, by design — it publishes a Capability
   Contract and registers Providers; the OS registry has no hardcoded skill list (unlike
   `video-production-agent`'s current `Service.adapter()`, which does — named explicitly
   as Roadmap work to fix, not claimed as already solved).
3. **Security** — *Attack:* does formalizing `FORBIDDEN_KEYS` centrally create a single
   point of bypass if a third-party Skill just doesn't use the reference library?
   *Verdict:* real risk, addressed by making the denylist part of the **conformance test
   suite** (a black-box check any Skill must pass, regardless of language/implementation)
   rather than trusting voluntary library adoption alone. See `SKILL_SPEC.md`
   §Conformance and `SECURITY_MODEL.md`.
4. **Determinism** — *Attack:* does the DAG/Provider model let an Agent quietly swap in
   a nondeterministic Provider (e.g. a generative one) where a deterministic one was
   expected? *Verdict:* Capability Contracts declare a `deterministic_inputs`-style flag
   (already present in `ffmpeg-skill`'s ToolSpec today, not invented) and Provider
   selection records which one ran, in provenance, always.
5. **Performance** — *Attack:* does structural Plan validation or the registry add
   meaningful overhead? *Verdict:* no evidence of scale that would matter (single-machine,
   local-first ecosystem, no repo shows more than a handful of concurrent operations) —
   not solved for because it is not yet a real problem (Rule against architecture
   astronautics).
6. **Developer experience** — *Attack:* does a Skill author now have to learn four new
   concepts to ship a trim operation? *Verdict:* no — the existing pattern (typed
   operations delegating to `ffmpeg-skill`, exactly as `video-editing-skill` already
   does) requires zero new code; only the *contract* they already publish (`contract.py`
   in every repo) gains a few new declared fields (capability id, provider id).
7. **Agent usability** — *Attack:* does an Agent need to understand DAGs to use this?
   *Verdict:* no — `video-production-agent`'s planner already produces this shape
   internally; nothing changes from the Agent's perspective except that Capability ids
   are now resolvable against a real registry instead of a hardcoded ordered list.
8. **Third-party Skill compatibility** — *Attack:* can a Skill written in a
   non-Python language conform? *Verdict:* yes, because the Runtime contract is
   process-boundary-shaped (subprocess, stdin/stdout JSON) exactly like every existing
   Skill already is — none of the five convergent security primitives are Python-specific.
9. **Long-term maintainability** — *Attack:* what happens when `ffmpeg-skill` publishes
   a breaking `contract_version` bump? *Verdict:* already has an answer in the existing
   ecosystem (every dependent Skill pins a supported version range and checks it at
   startup) — the OS generalizes this into `VERSIONING.md` rather than inventing new
   mechanics.
10. **Competitive differentiation** — *Attack:* OpenMontage (see
    `COMPETITIVE_ANALYSIS.md`) already does auto-discovered tools + YAML pipelines +
    pre/post-render verification, at far larger scale. *Verdict:* the differentiation
    this project can credibly claim is **verification rigor and provenance depth**
    (qc-skill's identity/cache/tamper-detection design has no equivalent described in
    OpenMontage's public materials) and a **permissive-license, contract-first
    interoperability story** rather than a bundled tool marketplace — see
    `COMPETITIVE_ANALYSIS.md` for the full comparison and the licensing caveat (AGPL-3.0)
    that matters for anyone building near it.

## 10. Resource model (deliberately minimal)

No CPU/GPU/concurrency scheduling exists in any audited repo. The OS does not invent one.
The only Resource-shaped facts worth standardizing now: a Capability Contract may declare
coarse resource hints already implicit in existing tools (`requires_visual_verification`,
`audio_only`, `video_required` already exist in `ffmpeg-skill`'s ToolSpec) so an Agent
can make a cheap local-vs-not-applicable choice — not a scheduler, a declared hint.
Anything beyond this (cost-aware provider selection, concurrency limits, cloud/local
routing) is explicitly Roadmap Phase 7+ and not designed here, because designing it now
would be solving a problem this ecosystem does not have evidence of yet.

## 11. Final architectural test (per task §41)

- **New, unimagined Skill tomorrow, no OS core changes?** Yes — it publishes a
  Capability Contract; the registry has no hardcoded skill list to edit (once the
  Roadmap's registry-decoupling work lands — today's `video-production-agent` still
  requires a manual `Service.adapter()` edit, named explicitly as a gap, not hidden).
- **Remove one of the current Skills, does the OS still make sense?** Yes — nothing in
  the kernel (§8) references any specific Skill by name; `transcription-skill`'s
  existence *outside* the original "9" already proves the ecosystem survives an
  unplanned addition, and the same registry mechanism handles a planned removal.
- **Replace Claude with another AI system, does the OS still make sense?** Yes, already
  true today (§4) — `NullProvider` is the only shipped implementation and the
  deterministic pipeline runs without any LLM.
- **Replace or supplement FFmpeg, does the OS still make sense?** Architecturally yes
  (Capability/Provider split), practically not proven yet (§4's honest caveat) — no
  second engine exists today, so this is a design property, not a demonstrated fact.
- **Can a human operate the OS without an AI agent?** Yes, and this is intentional and
  already demonstrated — every Skill and `video-production-agent` itself expose a plain
  CLI with `--dry-run`/`--json`, usable by a human with no AI involved at all.
- **Can an AI operate the OS without executing arbitrary shell commands?** Yes — this is
  the one guarantee enforced identically at every single Skill boundary already audited
  (`FORBIDDEN_KEYS`, no `shell=True` anywhere in the entire ecosystem, confirmed by grep
  across all 11 repos).

## 12. Open questions carried into `ROADMAP.md`

- Whether/when to extract `video_agent.models` into an independent OS contract package,
  versus keeping it in-repo with a documented contract boundary in the interim.
- Whether Provider default-selection policy lives in a Workspace config file or in the
  OS registry itself.
- Whether a conformance test suite (§9.3, §9.8) should be a downloadable harness or a
  written specification Skill authors implement their own tests against — a real
  trade-off between rigor and adoption friction that has no evidence-based answer yet.
