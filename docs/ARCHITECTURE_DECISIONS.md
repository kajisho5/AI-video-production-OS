# Architecture Decisions: Scannable Reference

Status: **compact decision record, not a narrative document.** The prose ADRs in
`adr/` (ADR-001 through ADR-010) explain the reasoning behind the project's foundational
choices in essay form, with alternatives-considered and consequences sections. This
document is deliberately not that: it is a single table, built for scanning during a
review or a new-contributor onboarding, answering one question per row — **is this
concept in scope for the OS, and why** — with a pointer to whichever document carries the
actual detail. Where a row's justification needs more than one or two sentences, that
detail lives in the pointed-to document, not here.

**Verdicts used, exactly as decided elsewhere in this project's documents — not softened
here:**

- **ADOPT** — build it; adopted as designed (or already exists) in the pointed-to document.
- **DEFER** — not now; no current evidence of need, revisit if/when evidence appears.
- **REJECT** — decided against; an existing mechanism already covers the need, or the
  concept fails this project's own "no abstraction without concrete value" test.

Some concepts split into more than one verdict because different parts of the same idea
were decided differently (e.g. "adopt the conceptual separation, reject building the
infrastructure now") — each part gets its own row rather than a single row hiding a
compound answer.

---

## Production state, lifecycle & intent

| Concept | Verdict | Justification | Detail |
|---|---|---|---|
| Production State as a central OS concept | **ADOPT** — as a derived view/query over existing primitives, **not** a new stored object | Every fact a "Production State" would report (what's approved, what ran, what's pending) is already reconstructable from `Decision`, `Artifact.stage`, and `Job` state; a stored duplicate would be a second source of truth for facts that already have one. | `PRODUCTION_STATE.md` |
| Project / Production / Job / Run as four separate nouns | **REJECT** — introducing a new "Production" noun between Project and Job/Run | The existing `Project → Plan (revision) → Job (run)` hierarchy (`CORE_PRIMITIVES.md` §11) already covers this; no evidence of a need for a fourth layer. | `PRODUCTION_LIFECYCLE.md` |
| Intent decomposition (Goals / Hard Constraints / Soft Constraints / Preferences / Policy / Permissions) | **ADOPT** | Policy, Preference, and Constraint already exist in code (`policy/rules.py`); the Hard/Soft split and a formal Permissions field are PROPOSED refinements of an existing structure, not new concepts. | `INTENT_MODEL.md` |
| Creative Intent as partially-structured free text | **ADOPT** — light, non-enum fields on Project Intent | A closed enum cannot capture creative direction; free text with light structure (tags, references) fits how `video-production-agent`'s intent already accepts unstructured input without forcing a premature taxonomy. | `AGENT_EVOLUTION.md`, `INTENT_MODEL.md` |
| Decision Evidence + optional Confidence field | **ADOPT** — confidence only where meaningful, not on every field | `Decision.evidence` is already mandatory (`CORE_PRIMITIVES.md` §5); a confidence score is only meaningful for evidence that is itself probabilistic (e.g. an inference), and forcing it onto deterministic measurements (a LUFS reading has no "confidence") would be a fabricated field with no source. | `CORE_PRIMITIVES.md` §5 amendment |

## Provenance, memory & knowledge

| Concept | Verdict | Justification | Detail |
|---|---|---|---|
| Provenance vs. Memory vs. Knowledge vs. Evidence vs. Observation as five distinct concepts | **ADOPT** the conceptual separation | Each already names something real and different in this ecosystem (Provenance = what ran; Observation/Evidence = measured facts feeding a Decision) or in the broader agent-design space (Memory/Knowledge = persisted-across-runs context) — collapsing them would blur what `Decision.basis` and `Artifact.provenance` already keep distinct. | `PROVENANCE.md` amendment |
| Memory / Knowledge infrastructure, built now | **REJECT** | No repo in the audited ecosystem persists cross-run memory or a knowledge base; building this now is out of OS-core scope and, if ever pursued, is an Agent/ecosystem-layer concern, not a kernel primitive — no evidence of need per `ARCHITECTURE.md` §9 lens 5. | `PROVENANCE.md` amendment |

## Capability / Skill / Provider / Runtime

| Concept | Verdict | Justification | Detail |
|---|---|---|---|
| Capability / Skill / Provider / Runtime four-noun model | **ADOPT** | Already the core of the Capability Model; directly and concretely fixes the confirmed `qc-skill`/`media-analysis-skill` loudness/silence/integrity duplication (`REPOSITORY_MAP.md` finding 2) — not a speculative split. | `CAPABILITY_MODEL.md` |
| Provider fallback constrained by Intent / Policy / Permission | **ADOPT** | Provider selection is already required to be an explicit, provenance-recorded choice, never a silent runtime default (`CAPABILITY_MODEL.md` §Collision policy); constraining that choice by the same Intent/Policy/Permission facts a Decision already consults keeps selection accountable to the same rules as everything else the Agent decides. | `CAPABILITY_MODEL.md` amendment |
| Operation as a "Production State transition," not just an internal function call | **ADOPT** — framing only, no new fields needed | `Operation` (`SPEC.md` §4) already changes what Artifacts/state exist before vs. after it runs; naming that explicitly as a state transition clarifies the model without requiring any field `SPEC.md` doesn't already define. | `EXECUTION_MODEL.md` amendment |
| Runtime responsibilities consolidated (Execution/Resource/Timeout/Retry/Isolation/Permission/Artifact/Logging) | **ADOPT** the consolidation, as documentation | Every one of these responsibilities is already independently, convergently implemented across at least seven Skill repos (`ARCHITECTURE.md` §7); documenting them as one Runtime contract names what already exists, it does not add new behavior. | `CORE_PRIMITIVES.md` §4 |
| Runtime: Cancellation semantics | **DEFER** | No audited repo implements mid-Operation cancellation today; the gap is named, not designed — inventing cancellation semantics with zero implementation to generalize from would be speculative. | (gap named, not yet a document) |
| Runtime variants — Local / Remote / Cloud / Container / GPU | **DEFER** | Zero evidence of need anywhere in the ecosystem; every audited Operation runs as a local subprocess on the same machine as the Agent. Matches `ARCHITECTURE.md` §10's deliberately minimal resource stance exactly. | `ARCHITECTURE.md` §10 |

## Security

| Concept | Verdict | Justification | Detail |
|---|---|---|---|
| "Data is not instruction" as an OS-level security principle | **ADOPT** | Already partially implemented via the `untrusted_text` proposal, which responds directly to a real, present gap: `subtitle-skill` validates cue text structurally but has no defense against that text later reaching an LLM prompt unsanitized (`REPOSITORY_MAP.md`, `ARCHITECTURE.md` §7). | `SECURITY_MODEL.md` |
| Arbitrary shell as an escape hatch for missing capabilities | **REJECT, hard** | Already enforced ecosystem-wide today — zero `shell=True`/`os.system` found anywhere across all 11 repos, confirmed by grep (`ARCHITECTURE.md` §11). Any future escape hatch for a capability gap must be an explicit, typed, contract-declared Execution Capability, never raw shell — this is not a stance to revisit, it is a guarantee already true and load-bearing. | `ARCHITECTURE.md` §7, §11 |

## Artifact & timeline

| Concept | Verdict | Justification | Detail |
|---|---|---|---|
| Artifact as more than a file (Media / Timeline / Analysis / QC Report / Receipt / Metadata), content-hash identity, immutability with derived-artifact tracking | **ADOPT** | Already `ARTIFACT_MODEL.md`'s position, generalizing `video-production-agent`'s existing `Artifact` dataclass and `qc-skill`'s already-correct content-hash identity pattern; `derived_from` is explicitly marked FUTURE there — not claimed as already implemented. | `ARTIFACT_MODEL.md` |
| Timeline as a neutral (OTIO-inspired) composition representation, not a custom DSL or NLE clone | **ADOPT** | No edit-timeline primitive exists anywhere in the ecosystem today; modeling it on OpenTimelineIO's clip/track/transition/marker shape reuses validated prior art instead of inventing a domain model from scratch, and resolves the real `temporal/timeline.py` naming collision found in the audit. | `TIMELINE_MODEL.md` |
| Selection / Ranking / Curation as a new first-class OS primitive | **REJECT** | Fully expressible via existing Observation/Evidence/Decision primitives — a ranked Decision citing comparative Evidence needs no new type. No repo implements ranking/selection today; inventing a primitive for a zero-evidence use case violates this project's own "no abstraction without concrete value" rule. | `CORE_PRIMITIVES.md` §5 |

## QC / verification

| Concept | Verdict | Justification | Detail |
|---|---|---|---|
| Creative Evaluation vs. Technical QC, kept strictly separate, never collapsed into one score | **ADOPT** | `qc-skill`'s existing worst-wins `QCReport` aggregation is already scoped to technical/structural checks only (subtitle QC is explicitly timing-only, never semantic); collapsing creative judgment into the same score would blur a boundary the existing implementation already respects. | `QC_ARCHITECTURE.md` amendment |
| QC/Verification feeding an Accept/Replan loop (QC never decides, Agent replans using QC findings as evidence) | **ADOPT** | Already the ecosystem's own rule, enforced in code, not proposed fresh: `qc-skill`'s ADR-001 ("not an AI agent, does not make production decisions") plus `ARCHITECTURE.md` §3's "a QC FAIL is a fact, not an instruction to re-render." A QC finding becomes evidence for an Inference/Decision that may authorize a new Operation — never an automatic retry of the same one. | `QC_ARCHITECTURE.md` amendment, ADR-007 |
| A new 6-state Verification State enum (`UNVERIFIED/PASS/PASS_WITH_WARNINGS/FAIL/BLOCKED/UNKNOWN`) distinct from `qc-skill`'s existing `PASS/WARN/FAIL/UNKNOWN` | **REJECT** | Would create two sources of truth for the same fact. `qc-skill`'s existing four-state model plus `Decision.approval` (AUTO/CONFIRM/BLOCK) already cover every distinction the six-state proposal draws — "blocked" is a Decision-approval fact, not a QC-verdict fact. | `PRODUCTION_STATE.md` |

## Failure, execution & incremental rebuild

| Concept | Verdict | Justification | Detail |
|---|---|---|---|
| Failure classification: FATAL / RETRYABLE / DEGRADED / OPTIONAL | **ADOPT**, extending the existing retryable/terminal split | `FAILURE_RECOVERY.md` already distinguishes retryable categories (transient/timeout) from terminal ones (validation, security rejection, missing Provider); DEGRADED and OPTIONAL are genuine new distinctions within "terminal," not a redesign of the existing split. | `FAILURE_RECOVERY.md` amendment |
| Partial success (artifact-level status distinct from production-level status) | **ADOPT** | Already implicit in how partial execution works today: a Plan can stop partway through with a well-defined prefix of successfully-produced Artifacts (`EXECUTION_MODEL.md` §5.1) — making artifact-level vs. plan-level status explicit names an existing distinction rather than inventing one. | `EXECUTION_MODEL.md` amendment |
| Incremental production / dependency-based partial re-render — the architectural property | **ADOPT** | Comes free from content-hash Artifact identity plus DAG execution (`EXECUTION_MODEL.md` §2, `ARTIFACT_MODEL.md`) — an unchanged upstream Artifact's hash doesn't change, so a downstream re-run can already, in principle, skip recomputing it. | `EXECUTION_MODEL.md` amendment |
| Incremental production — actual executor optimization work | **DEFER** | No implementation of cross-Job cache reuse exists anywhere today (`EXECUTION_MODEL.md` §3.3 names this explicitly as PROPOSED, not built); not blocking any current work. | `EXECUTION_MODEL.md` §3.3 |
| Production Graph as a DAG/lineage (not a graph database) | **ADOPT** | Already `ARCHITECTURE.md` §6's position: the Plan's `steps`/`depends_on` structure already **is** the DAG; `ARTIFACT_MODEL.md`'s `derived_from` links already express lineage. No new engine or storage model is introduced. | `ARCHITECTURE.md` §6, `ARTIFACT_MODEL.md` |
| Production Version / Variant / Candidate / What-if multi-plan comparison as new primitives | **DEFER** | Already expressible today via multiple Projects/Plans sharing source Artifacts — no new primitive needed. No evidence of demand yet for dedicated comparison tooling. | `PRODUCTION_LIFECYCLE.md` |

## Autonomy & human-in-the-loop

| Concept | Verdict | Justification | Detail |
|---|---|---|---|
| Autonomy Level as a new marketing-style enum (e.g. 5 levels) | **REJECT** | The existing `Decision.approval` (AUTO/CONFIRM/BLOCK) already **is** this separation of execution permission from decision autonomy, per-Decision rather than as a single global dial — a coarser global enum would be a strictly less expressive restatement of a distinction the system already makes at finer grain. | `AGENT_EVOLUTION.md` |
| Human-in-the-loop states (WAITING_FOR_APPROVAL / APPROVED / REJECTED) as **new** primitives | **REJECT as new** | These already exist today, functionally: `video-production-agent`'s `approve`/`reject` CLI commands and its exit code 4 already implement exactly this state machine. | `AGENT_EVOLUTION.md` |
| Human-in-the-loop states, as formalization/documentation | **ADOPT** | Naming and documenting the existing approve/reject/exit-code-4 behavior as a formal state set makes it visible to a new Agent implementer without requiring any new code. | `AGENT_EVOLUTION.md` |

## Delivery, recipes & future scope

| Concept | Verdict | Justification | Detail |
|---|---|---|---|
| Recipe as a first-class OS concept | **ADOPT** | Already exists as `video-production-agent`'s `profiles/` directory (`generic`, `youtube`, `conference`) — a named, reusable Plan shape, exactly what "Recipe" means; this formalizes an existing directory's role rather than adding a new mechanism. | `DELIVERY_AND_INTEROP.md` |
| Knowledge / Memory as first-class OS concepts | **DEFER/REJECT** from OS core | No evidence of need anywhere in the ecosystem; if ever pursued, this is explicitly an Agent/ecosystem-layer concern, not core OS scope (restates the Provenance-section verdict above in delivery-scope terms). | — |
| Production Package (portable cross-machine format) | **DEFER** | Explicitly future-only per this project's own task brief; no implementation needed now, and no repo today produces or consumes anything resembling a portable package format. | — |
| Multi-agent architecture (Director / Editor / Audio / Color / QC / Delivery Agents) | **DEFER**, future-only | A single Agent with internal module separation already covers today's needs — `video-production-agent`'s own internal Observation/Inference/Decision/Compiler/Executor separation already provides the separation-of-concerns a multi-agent design would add, without the coordination cost of multiple processes. No evidence multiple Agent processes are needed. | `AGENT_EVOLUTION.md` |
| Media engine abstraction beyond the existing Capability/Provider model | **DEFER** | No second media engine exists anywhere in the ecosystem — every Skill delegates to `ffmpeg-skill` specifically. Designing an abstraction layer from a sample size of one implementation is speculation, not generalization. | `DELIVERY_AND_INTEROP.md` |
| A dedicated "localization-skill" bundling translation + dubbing + voice + typography | **REJECT** as one monolithic Skill | Violates `CAPABILITY_MODEL.md`'s own avoid-monolithic-skill criterion (a Skill earns breadth by sharing one execution substrate, not by sharing a domain label) — these would delegate to different substrates for different judgment/execution boundaries. | `DELIVERY_AND_INTEROP.md` |
| Localization capabilities, as separate Capabilities/future Skills | **ADOPT** | Treating translation, dubbing, voice, and typography as separate Capabilities (or separate future Skills) per their actual judgment/execution boundaries follows the granularity criteria already established, rather than inventing a new bundling rule. | `DELIVERY_AND_INTEROP.md` |
| A dedicated "accessibility-skill," for most accessibility features | **REJECT** | Most accessibility features (captions, contrast checks, structural validation) already fit inside existing Skills as Capabilities — a new Skill would fail the "more than a thin wrapper" test in `CAPABILITY_MODEL.md`'s granularity criteria. | `DELIVERY_AND_INTEROP.md` |
| A dedicated "accessibility-skill," specifically for audio-description | **ADOPT** as a legitimate FUTURE Skill candidate | Audio-description (generating a spoken narration track describing on-screen visual content for blind/low-vision viewers) is a genuinely new judgment-plus-execution domain that does not reduce to an existing Skill's typed operations — it passes `CAPABILITY_MODEL.md`'s granularity test where general "accessibility" does not. | `DELIVERY_AND_INTEROP.md` |
| Cost-aware / resource-aware Provider selection and scheduling | **DEFER**, Roadmap Phase 7+ only | Zero evidence of scale need today — no repo shows more than a handful of concurrent operations, and `ARCHITECTURE.md` §10 already made the deliberate choice to keep the resource model minimal until real evidence of a scaling problem appears. | `ARCHITECTURE.md` §10, `ROADMAP.md` Phase 8 |

---

## Note on forward references

Several "Detail" pointers above (`PRODUCTION_STATE.md`, `PRODUCTION_LIFECYCLE.md`,
`INTENT_MODEL.md`, `AGENT_EVOLUTION.md`, `DELIVERY_AND_INTEROP.md`) name documents that
do not yet exist in this repository as of this writing, and several existing-document
pointers are marked "amendment" (`CORE_PRIMITIVES.md` §5 amendment,
`CAPABILITY_MODEL.md` amendment, `QC_ARCHITECTURE.md` amendment, `EXECUTION_MODEL.md`
amendment, `FAILURE_RECOVERY.md` amendment, `PROVENANCE.md` amendment) — meaning the
decision recorded in this table is settled, but the detailed treatment is pending
authorship or a pending addition to an existing document. This table intentionally
records the decision now rather than waiting for its detail document to exist, exactly
as `ROADMAP.md`'s own Phase 0 status note treats several of its own referenced documents
as "assumed to exist or be forthcoming" — a decision and its full write-up are allowed to
land in different commits without the decision being any less real in the meantime.
