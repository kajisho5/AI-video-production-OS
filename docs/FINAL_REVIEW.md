# Final Architecture Review

Status: draft, closes out the Phase 0 research effort. This document is written last,
by direct synthesis rather than delegated research, because it requires holistic
judgment across all ~50 preceding documents rather than fresh evidence-gathering. It
does not introduce new architecture — it stress-tests what `ARCHITECTURE.md`,
`CORE_PRIMITIVES.md`, `CAPABILITY_MODEL.md`, and the ~45 supporting/extension documents
already decided, and answers the project's own final tests.

## 1. Red-team pass 2 (20 questions)

**1. Is the kernel too large?** No. §8 of `ARCHITECTURE.md` lists seven kernel
components (Contracts, Capability registry, Artifact model, Plan model + structural
validation, Execution/Runtime contract, Provenance/Receipt, Verification contract) —
every one of them is something a second Agent AND a third-party Skill would both need
in the same shape to interoperate, which is the test `CORE_PRIMITIVES.md` §0 sets. None
of them contains business logic (no editing algorithm, no color-grading math, no QC
threshold lives in the kernel).

**2. Is the kernel too small?** The one place this bites: Plan-time Provider collision
resolution (`CAPABILITY_MODEL.md`'s three-mechanism policy) has to be a kernel-level
contract, not Agent-optional, or two Agents could silently disagree about which
Provider ran and provenance would fork. `ARCHITECTURE_DECISIONS.md` already treats this
as ADOPT-into-kernel, not optional — verified consistent.

**3. Is Agent responsibility too large?** No — `AGENT_EVOLUTION.md` shows the Agent
already internally separates 11 concerns (intent, context, inference, planning,
capability selection, decision, execution coordination, evaluation, replanning,
escalation) as distinct modules in `video-production-agent` today, and the OS only
needs the TYPES crossing the boundary (Observation/Inference/Decision/ProductionPlan),
not the logic. The Agent is large in code, small in what the OS depends on it for.

**4. Are Skills too granular?** Spot check: `subtitle-skill` (generate + render, two
operations) is the smallest Skill in the ecosystem. It still passes `CAPABILITY_MODEL.md`'s
4-part test (owns cue-timing/format judgment, has its own security boundary, is
independently versioned, is not a thin wrapper) — it is small because subtitle
generation genuinely is a small domain, not because it was carved up unnecessarily.

**5. Are Skills too large?** Spot check: `ffmpeg-skill` (21 tools) is the largest. It
earns that breadth because every tool shares one execution substrate (ffmpeg/ffprobe)
and one security model — `CAPABILITY_MODEL.md` §Avoiding-both-failure-modes already
makes this argument explicitly, not post-hoc here.

**6. Is Capability abstraction actually useful?** Yes, falsifiably: it is the only
mechanism that turns the qc-skill/media-analysis-skill duplication from invisible
technical debt into a visible, resolvable registry fact (`CAPABILITY_MODEL.md`
§Capability collision policy). An architecture without it would have no way to even
name that bug.

**7. Is Timeline unnecessarily complex?** No — `TIMELINE_MODEL.md` explicitly declines
to build a custom DSL, adopts OTIO's shape (validated prior art), and resolves the one
real complexity source (naming collision with the existing Event Timeline) by renaming
rather than merging. It is also explicitly scoped as FUTURE — nothing forces it into
Phase 1.

**8. Is provenance over-engineered?** No — checked against Rule "do not build a
blockchain." `PROVENANCE.md`'s core mechanism is exactly `qc-skill`'s existing
`sha256(canonical_json(...))` pattern, generalized. The two additions from later
review (rights provenance, citation provenance) are each one optional, unpopulated-by-
default field — not new infrastructure.

**9. Is QC over-engineered?** No — `QC_ARCHITECTURE.md` explicitly rejected the
task-brief's own suggested 7-node evidence chain in favor of one new field
(`subject_artifact_id`) reusing existing types, and rejected a proposed 6-state
Verification State enum in favor of reusing `qc-skill`'s existing 4 states plus
`Decision.approval`. The document actively resists the over-engineering it was handed.

**10. Is plugin architecture premature?** Partially, and the docs say so themselves:
`PLUGIN_MODEL.md` explicitly builds "foundation only," and `OPEN_ARCHITECTURAL_QUESTIONS.md`
lists the conformance-suite format as a BLOCKING open question — this is honestly
unresolved, not falsely resolved.

**11. Is provider abstraction premature?** No — it is the direct, minimal fix for a
duplication bug that has ALREADY happened (qc-skill/media-analysis-skill), not a
hypothetical future problem. Premature would be building it for a duplication that
hasn't occurred yet.

**12. Is the system too dependent on FFmpeg?** Practically yes, architecturally no.
`ARCHITECTURE.md` §4 states this caveat plainly rather than hiding it: every Provider in
the ecosystem happens to use FFmpeg; the Capability/Provider split makes a second engine
possible but none exists to prove it. This is an honest limitation, not a hidden one.

**13. Is the system too dependent on AI?** No — the opposite is demonstrated: the
deterministic pipeline (silence trim, loudness normalize) already runs today with
`NullProvider` as the only AI integration. This is verified fact, not aspiration.

**14. Is local-first realistic?** Yes for the current ecosystem (zero repos use network
access, confirmed by grep), and the `requires_network`/Permission concepts
(`INTENT_MODEL.md`, `EXECUTION_MODEL.md` §11) are placeholders for when it stops being
realistic, not premature infrastructure.

**15. Can a developer understand it?** The kernel is 7 components; `GLOSSARY.md`
defines every term once; `SKILL_PROPOSAL.md` §1.10 gives a 4-step decision tree instead
of prose. This is a reasonable bar, though it has not been tested on an actual new
contributor — mark that UNKNOWN, not confirmed.

**16. Can an Agent operate it safely?** Yes — `FORBIDDEN_KEYS`/no-`shell=True` is
verified (via grep) across the entire real codebase, not just documented as intent.

**17. Can a human debug it?** Partially. `--dry-run`/`--json` exist on every Skill CLI
(verified), but `FAILURE_RECOVERY.md`'s new user-facing error-presentation convention
is marked PROPOSED, not implemented — a human today gets a Skill's raw JSON error, not
a formatted "what failed / where / why / retryable" message. Real, named gap.

**18. Can a third party extend it?** Structurally yes (contract-first, conformance-
suite-not-code-review per ADR-009); practically UNKNOWN — no third-party Skill has ever
actually been built against this contract, so this is a design property, not a
demonstrated one.

**19. Can the architecture survive five years of AI change?** The two invariants that
matter most for this — OS core has no AI-vendor dependency, and typed Operations never
become raw shell/filter strings — are both CURRENTLY ENFORCED today (`ARCHITECTURAL_INVARIANTS.md`),
not aspirational. A model swap changes the Agent's `AIProvider` implementation; it
touches zero kernel contracts.

**20. What would make this project fail?** Named honestly, not hedged: (a) the
conformance suite never gets built, so "third-party Skill" stays theoretical forever;
(b) `video_agent.models` never actually gets extracted into a shared contract package,
so "the OS" stays permanently synonymous with "video-production-agent's internals" in
practice even though the docs say otherwise; (c) nobody ever builds a second Agent or a
second media-engine Provider, so the Agent/OS and FFmpeg/OS independence claims stay
unfalsified assertions rather than demonstrated properties. All three are named as open
risks in `OPEN_ARCHITECTURAL_QUESTIONS.md` / `ROADMAP.md`, not new findings — this pass
confirms they are still the right three to worry about.

## 2. The ten-year test

**2036, 100+ Skills, multiple Agents, multiple engines, large community.** The
architecture's load-bearing bet is that Capability ids stay a flat namespace
(`SPEC.md` §7 explicitly declines a query language, calling a flat lookup "sufficient
for the ecosystem size that exists today"). At 100+ Skills this may not hold — a flat
`edit.trim`/`measure.audio.loudness`-style namespace could collide or sprawl. This is a
real scaling limit, not disqualifying: `VERSIONING.md`'s Compatibility Matrix and a
future namespacing convention (not designed here) are the natural extension points, and
nothing in the kernel (§8 of `ARCHITECTURE.md`) would need to change shape to add
hierarchy to Capability ids later — only the registry's lookup implementation would.

**Small community, only.** The kernel's 7 components, one contract format, and a
single-maintainer-appropriate ADR/decisions.md practice (already convergent across 5+
repos before this project existed, per `GOVERNANCE.md`) mean the architecture does not
presuppose a large team to operate. The Roadmap's Phase 2 (per-repo contract retrofit)
is explicitly the one phase sized for a single contributor doing it gradually,
repo-by-repo, with zero forced coordination.

**Verdict:** survives both scenarios in its current shape better than most
alternatives considered (rejected: a graph database, a plugin marketplace, a scheduler
— all would have made the small-community case worse for a large-ecosystem benefit that
isn't needed yet).

## 3. Sixteen-persona review

Each persona: one real strength, one real risk, evidence-grounded.

- **Software Architect** — Strength: the Capability/Skill/Provider/Runtime split has a
  falsifying test case it actually fixes (qc-skill/media-analysis-skill). Risk: the
  boundary between "Runtime" (§4, `CORE_PRIMITIVES.md`) and "Skill's own adapter code"
  is still implemented per-Skill, not as one shared library — five nearly-identical
  `PathPolicy` implementations still exist today.
- **Media Engineer** — Strength: FFmpeg version/parameter provenance is real and
  auditable per-run. Risk: no per-artifact sidecar embeds the FFmpeg version used
  (`PROVENANCE.md` names this gap explicitly) — reconstructing it requires cross-
  referencing a separate response log.
- **AI Engineer** — Strength: `NullProvider` proves the reasoning layer is genuinely
  swappable, not just documented as such. Risk: no real `AIProvider` implementation has
  ever been exercised end-to-end — the "AI decides WHAT" half of the architecture is
  entirely unverified in practice.
- **Agent Engineer** — Strength: Observation/Inference/Decision typing with mandatory
  evidence already prevents an entire class of "the AI just decided" bugs. Risk: the
  `confidence` field's actual propagation rules (is it used anywhere yet, or only
  declared?) are UNKNOWN per `PRODUCTION_LIFECYCLE.md`'s own honest finding.
- **Security Engineer** — Strength: zero `shell=True`/`os.system` anywhere in 11 real
  repos, verified by grep, not asserted. Risk: no repo enforces CPU/memory/disk limits,
  only wall-clock timeout — a resource-exhaustion DoS from a malicious or buggy input is
  still possible today.
- **DevOps Engineer** — Strength: every Skill's CI matrix (ubuntu/windows/macos ×
  py3.9/3.11) already exists and passes real ffmpeg installs. Risk: `video-production-
  agent`'s integration CI tracks sibling repos at default-branch HEAD while 5 Skills pin
  a specific commit — this inconsistency is a real, live source of "works in one CI, not
  the other" failures (`DEPENDENCY_GRAPH.md` §2).
- **Open Source Maintainer** — Strength: ADR/decisions.md practice is already
  convergent across the ecosystem, not imposed top-down. Risk: `GOVERNANCE.md` is
  honest that this is a single-maintainer project — none of the "what if this scales to
  many contributors" questions have been tested.
- **Video Editor** — Strength: typed operations (TRIM/CUT/CONCAT/etc.) match how an
  editor actually thinks about an edit, not how ffmpeg's filter graph thinks about it.
  Risk: no undo/redo or non-destructive multi-track editing model exists — `TIMELINE_MODEL.md`
  is explicitly FUTURE, so today's editing is single-operation-at-a-time, not
  timeline-native.
- **Colorist** — Strength: HDR-to-SDR tonemapping is a real, typed, tested Capability.
  Risk: `color-grading-skill` explicitly refuses all creative grading operations
  (exposure/contrast/saturation/etc.) — a colorist gets technical delivery compliance
  today, nothing resembling a grading session.
- **Audio Engineer** — Strength: EBU R128 loudness normalization with explicit
  target_lufs/true_peak_db (no silent defaults) is professionally correct. Risk: no
  multi-track mixing console model exists — `audio-production-skill`'s `MIX` operation
  tops out at 8 inputs with no per-track automation.
- **Motion Designer** — Strength: typed title-card/lower-third/overlay operations exist
  and are tested. Risk: `motion-graphics-skill` explicitly has no keyframe/expression
  animation — anything beyond a linear fade is out of scope today, by design, not
  oversight.
- **QC Engineer** — Strength: PASS/WARN/FAIL/UNKNOWN with worst-wins aggregation and
  tamper-detected caching is a genuinely professional-grade design, not a toy. Risk:
  Creative Evaluation is entirely FUTURE (`QC_ARCHITECTURE.md` §7) — a QC engineer today
  gets zero help with "does this cut feel right," only technical conformance.
- **Broadcast Engineer** — Strength: delivery profiles already exist as a real,
  working pattern (`video-production-agent`'s `profiles/` directory). Risk: no
  broadcast-specific delivery profile (e.g. a specific loudness/caption-safe-area spec)
  has been built yet — the mechanism exists, the content doesn't.
- **Independent Developer** — Strength: every Skill is pip/npm-installable and usable
  entirely standalone, with zero OS dependency, verified for `ffmpeg-skill` on the real
  npm registry. Risk: the real npm-vs-GitHub version drift found in this review
  (npm `0.9.0` vs. GitHub `0.9.1`) is exactly the kind of silent inconsistency an
  independent developer would hit first and be confused by.
- **Third-Party Skill Developer** — Strength: `SKILL_PROPOSAL.md`'s decision tree and
  `SKILL_SPEC.md`'s conformance requirements give a genuine, concrete on-ramp. Risk: the
  conformance suite itself doesn't exist yet (`OPEN_ARCHITECTURAL_QUESTIONS.md`,
  BLOCKING) — today's "path" ends at a specification with no automated way to check
  you've met it.
- **End User** — Strength: exit codes and `--dry-run` mean a human can preview and
  understand what will happen before committing to a render. Risk: every interface in
  the ecosystem is a CLI — there is no UI of any kind, so "end user" today functionally
  means "developer comfortable with a terminal," not a general audience.

**Reconciliation:** the risks cluster into three groups — (1) things that are honestly
marked FUTURE/PROPOSED and simply haven't been built (Creative Evaluation, Timeline,
undo/redo, conformance suite, UI) — not architectural defects, just unbuilt roadmap
items; (2) things that are real, present inconsistencies worth fixing soon (the
npm/GitHub version drift, the CI pinning inconsistency, five duplicated `PathPolicy`
implementations) — cheap, concrete Phase 1-2 cleanup, not redesign; (3) one thing that
is architecturally unverified rather than unbuilt — whether a real `AIProvider` and a
real third-party Skill actually work end-to-end against these contracts. Group 3 is the
single highest-value thing to prove next, because everything else in this document
assumes it will.

## 4. Absolute final test (25 questions)

1. New Skill without redesigning OS core? **YES** (pending: registry decoupling from
   `Service.adapter()`, tracked as Roadmap work, not a hidden blocker).
2. Existing Skill evolves independently? **YES** — 10 independent repos, independent
   versions, already true.
3. A Skill can be replaced? **YES** in principle (Capability/Provider split);
   **UNVERIFIED** in practice (never actually done).
4. A Capability can have multiple implementations? **YES** — this is precisely what
   the qc-skill/media-analysis-skill case already demonstrates once registered.
5. The Agent can be replaced? **YES** in principle (OS owns the type contracts, not
   Agent logic); **UNVERIFIED** in practice (only one Agent has ever existed).
6. Multiple Agents can eventually coexist? **YES**, architecturally undesigned but not
   precluded — `AGENT_EVOLUTION.md` explicitly defers this rather than blocking it.
7. FFmpeg can be replaced or supplemented? **YES** architecturally, **NO** evidence
   practically (§4 of `ARCHITECTURE.md`'s own honest caveat).
8. Deterministic execution stays independent from AI reasoning? **YES** — verified via
   grep, not just documented.
9. Humans can operate the system? **YES** — every Skill and the Agent are CLI-usable
   with zero AI involvement, demonstrated today.
10. AI can operate it without arbitrary shell access? **YES** — `FORBIDDEN_KEYS`
    verified ecosystem-wide.
11. Production decisions traceable to evidence? **YES** — `Decision.evidence` is a
    required field, verified in code.
12. Artifacts traceable to their origins? **PARTIALLY** — Operation/Skill/Provider
    lineage yes; `derived_from` parent-artifact graph is FUTURE, not built.
13. Failed productions recover? **PARTIALLY** — retry/idempotency exist and are real;
    the DEGRADED/OPTIONAL categories are newly-documented, not yet implemented.
14. Production revised without destroying history? **YES** — Plan revisions already
    preserve decision evidence across versions (ADR-034, verified CURRENT).
15. System operates locally? **YES** — zero network dependency anywhere, verified.
16. Cloud providers stay optional? **YES**, trivially — none exist yet to make
    mandatory.
17. Third-party Skills safely introduced? **STRUCTURALLY YES, PRACTICALLY UNPROVEN** —
    same caveat as #3/#5/#18.
18. QC verifies technical AND production requirements? **PARTIALLY** — technical: yes,
    mature; production-plan-conformance: PROPOSED, one new field, not yet implemented;
    creative: explicitly FUTURE.
19. System explains how an output was produced? **YES** for technical lineage
    (Provenance dict, verified); **NO** dedicated human-readable explanation yet — the
    ProductionReceipt itself is still PROPOSED, not implemented.
20. Architecture stays understandable to a new developer? **LIKELY, UNVERIFIED** — no
    new developer has actually onboarded against these docs yet.
21. Architecture survives major AI-technology change? **YES** — the two load-bearing
    invariants for this are both currently enforced, not aspirational (see red-team
    #19).
22. Ecosystem stays useful if the current Agent is replaced? **YES** — every Skill is
    independently useful standalone, verified (e.g. `ffmpeg-skill` on real npm).
23. Current Skills evolve without becoming permanent constraints? **YES** — none of the
    kernel's 7 components reference a specific Skill by name.
24. OS stays small enough to maintain? **YES today** (7 kernel components); *flagged*
    at scale by the ten-year test (§2) as the one place growth could strain the design,
    with a named, non-blocking extension point.
25. Solves a problem existing systems don't solve adequately? **YES, specifically**:
    `COMPETITIVE_ANALYSIS.md` found OpenMontage architecturally similar in shape but
    with no described equivalent to `qc-skill`'s identity/cache/tamper-detection
    provenance rigor — verification depth and a permissive-license, contract-first
    interoperability story are the concrete, evidenced differentiators, not marketing
    language.

**Net verdict:** 16 of 25 are unqualified YES verified today; 6 are "yes architecturally,
unverified in practice" (all converging on the same underlying fact: nobody has yet
built a second Agent, a second engine Provider, or a real third-party Skill against
these contracts); 3 are PARTIALLY true with a named, already-tracked gap (artifact
lineage, failure-category implementation, production-plan QC). No answer is a bare NO.
The architecture is not complete in the sense of "fully built" — it is coherent in the
sense the final tests actually ask for: nothing here would need to be redesigned to
close the remaining gaps, only built.

## 5. What is the AI Video Production OS?

**One sentence:** A set of open contracts and shared execution infrastructure that let
independent Skills, Providers, and Agents — human or AI — turn video-production intent
into deterministic, verifiable, reproducible changes to a project's artifacts.

**Three sentences:** The OS defines what a Capability, an Artifact, a Plan, and a
verification result *are*, so that any Agent (today one incomplete implementation,
`video-production-agent`; tomorrow possibly others, or a human at a CLI) can drive any
conformant Skill without either depending on the other's internals. Execution stays
typed and deterministic all the way down to the subprocess boundary — an Agent may
decide *what* should happen, but never emits a raw shell command or unvalidated filter
string to make it happen. Every output carries enough recorded provenance to answer, in
principle, how it was made, from what, by which tool versions, and whether it passed
verification — without requiring a blockchain, a database, or a cloud service to do so.

**Architecture-level:** AI Video Production OS is the Capability/Skill/Provider/Runtime
contract layer (§`CAPABILITY_MODEL.md`) plus the Artifact/Plan/Execution/Provenance/
Verification kernel (§`ARCHITECTURE.md` §8) that sits between an Agent (§`ARCHITECTURE.md`
§3, intent/reasoning/decision layer, vendor- and framework-independent) and a growing,
independently-versioned ecosystem of Skills (currently 10, already proven to grow
unpredictably via `transcription-skill`'s undocumented-but-real existence) — with every
primitive justified against evidence from an 11-repository audit rather than designed
in the abstract, and every extension proposal (`OPEN_ARCHITECTURAL_QUESTIONS.md`,
`ARCHITECTURE_DECISIONS.md`) explicitly marked ADOPT, DEFER, or REJECT rather than
silently accepted.

This definition explicitly is not "an AI that makes video." No component in this
architecture is an autonomous video-making AI — the Agent reasons and proposes, Skills
execute typed operations deterministically, and a human or Agent approval gate sits
between the two wherever the action is hard to reverse. That distinction is not
incidental; it is the single most load-bearing design decision this entire research
effort converged on independently, twice, across two different instruction sets (the
original task brief's Rules 6/7/8/14 and the later addendum's "AIが decides WHAT, OS
controls HOW" principle) and confirmed a third time by direct evidence from the audited
codebase (`ffmpeg-skill`'s own self-declared `not_provided: ["AI reasoning", "decisions",
"production plans", ...]`).

## 6. Final principle

Optimize for coherence, simplicity, composability, determinism, extensibility,
security, inspectability, reproducibility, Agent independence, media-tool independence,
human control, and open-source sustainability — not for feature count, Skill count, or
architectural sophistication. The current 10 Skills and the current Agent are the first
generation of an ecosystem the OS is built to outlive, not the definition of what the OS
is. Where this research effort could not verify a claim, it says UNKNOWN rather than
inventing certainty — that discipline, more than any single primitive defined here, is
what should carry forward into implementation.
