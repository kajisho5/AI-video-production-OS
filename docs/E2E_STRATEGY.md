# End-to-End and Cross-Ecosystem Testing Strategy

Status tags as elsewhere in this project: **CURRENT** (a working pattern already exists,
verified by reading source/CI config), **PROPOSED** (extends a current pattern, not yet
built), **UNKNOWN**, and one additional caution this document uses more than most:
**SELF-REPORTED, NOT INDEPENDENTLY RE-RUN** — for claims about test counts and pass rates
that could not be re-verified in the audit (`REPOSITORY_MAP.md`'s explicit UNKNOWNs).
This document is deliberately practical: it extends a real, working ecosystem testing
pattern one layer, rather than proposing a testing strategy from a blank page.

## 0. Caveat on evidence quality — read before citing any number in this document

`REPOSITORY_MAP.md` records that `video-production-agent`'s latest commit message
self-reports "Unit 187, adapter 90, pipeline 15, real-Skill integration 44/44, evals
99/99," and states explicitly: *"Whether `video-production-agent`'s self-reported test
counts... actually pass in a clean environment [was] not independently re-run here."*
Only one commit was visible in the shallow clone audited, so this history could not be
walked commit-by-commit either. This document inherits that caveat without softening it:
everywhere below that a specific count (99 eval cases, 8+ sibling repos, etc.) is stated,
it is stated as **what the CI configuration and eval directory structure show on disk**,
not as an independently-verified "N tests currently pass." The *existence and shape* of
the CI job, the eval corpus, and their category breadth are treated as CURRENT (source
was read); specific pass/fail counts are treated as self-reported claims this document
does not re-certify.

## 1. What already exists (CURRENT) — three real, working patterns

### 1.1 Cross-repo integration CI (`video-production-agent`'s `.github/workflows/tests.yml`)

A real, working CI job clones 8+ sibling Skill repos at checkout time, wires each one in
via `VIDEO_AGENT_*_DIR` environment variables — the same environment-variable-based
checkout-location discovery every delegating Skill's own adapter already uses
(`REPOSITORY_MAP.md`, `SKILL_SPEC.md` §5) — and runs `test_integration.py` against
**real ffmpeg and the real cloned Skill code**, not mocks or stubs of either.

This is direct, existing, in-production evidence that testing a multi-repo ecosystem with
real dependencies (not mocked boundaries) is affordable and already done at least once in
this exact ecosystem. It is the load-bearing precedent for everything §3 proposes: this
document extends this discipline, it never proposes retreating from it to mocks for
convenience.

**Named limitation, stated plainly rather than hidden:** this pattern wires each Skill
via a hardcoded per-Skill environment variable — exactly the manual, hardcoded discovery
`REPOSITORY_MAP.md` and `ARCHITECTURE.md` §9 (red-team lens 2) already name as a gap
(`Service.adapter()`'s hardcoded registration has the same shape). Today's integration CI
job proves the *transport* (real subprocess, real cloned repos) works; it does not
exercise the OS's Capability/Provider registry, because that registry does not exist yet
in `video-production-agent`'s current code. §3 proposes closing exactly this gap.

### 1.2 `video-production-agent`'s `evals/` corpus

A directory of **99 JSON eval cases** (count as it appears in the self-reported commit
message and the directory's own structure — see §0's caveat), spanning categories
including silence, loudness, decision, plan, artifact, provenance, and security
scenarios. Named examples confirmed by file name: `19_artifact_hash_mismatch.json`,
`20_path_traversal_block.json`, `11_plan_hostile_ai_no_leakage.json`.

This layer is good at scenario-level behavior testing of the Agent's own deterministic
logic (the decision engine, the plan compiler, the `FORBIDDEN_KEYS` denylist) against
named, adversarial, and edge-case JSON fixtures — cheap to run relative to §1.1's
real-subprocess integration job, though the artifact-hash and path-traversal cases
plausibly do exercise real filesystem/security checks rather than pure in-memory logic.

**What this layer does not cover, by design:** real subprocess execution against real,
independently-versioned Skill repos — that is §1.1's job. The two layers are
complementary, not duplicative: evals test the Agent's own reasoning and guardrails
against known-tricky inputs; the integration CI tests that real Skills, invoked for
real, actually do what the Agent expects.

### 1.3 `ffmpeg-skill`'s own `evals/` (agent-behavior evals)

A distinct, third layer: `ffmpeg-skill` ships its own eval corpus testing whether **an AI
agent can correctly plan purely from the published contract** — i.e., these evals are
aimed at the *consumer* side of the Capability Contract (`SPEC.md` §1), not at
`ffmpeg-skill`'s own tool correctness. This is direct, existing evidence for the
"contract, not source" discoverability principle `ARCHITECTURE.md` §5 and `SKILL_SPEC.md`
build the whole Capability Contract format around: can an Agent that has never read
`ffmpeg-skill`'s source, only its `contract --json` output, plan correctly against it?
`ffmpeg-skill` already tests exactly this question for itself.

## 2. Layered testing model

Naming what already exists, plus where this document's proposal fits, without inventing
a new layer that duplicates one already there:

| Layer | Scope | Status | Where |
|---|---|---|---|
| 1. Per-Skill unit tests | One Skill's own internal correctness | CURRENT, per-repo | `SKILL_SPEC.md` §4 |
| 2. Per-Skill conformance suite | One Skill's black-box security/contract compliance, no ecosystem awareness needed | PROPOSED | `SKILL_SPEC.md` §8 |
| 3. Cross-repo integration tests | One Agent + N real cloned Skills, hardcoded per-Skill wiring | CURRENT | §1.1 above |
| 4. Agent-behavior / contract evals | Scenario-driven JSON fixtures; some exercise real files/security, some are planning-only | CURRENT | §1.2, §1.3 above |
| 5. Ecosystem-level, Capability/Provider-mediated E2E scenarios | A small number of realistic scenarios spanning multiple Skills, resolved through the OS registry rather than hardcoded wiring | PROPOSED, this document's contribution | §3 below |

Layer 5 sits above, not in place of, layers 1–4. It does not re-test what a per-Skill unit
test or conformance suite already covers, and it does not replace the Agent-behavior
evals — it adds the one thing none of the existing layers exercise: **whether the
Capability/Provider registry itself, not a hardcoded wiring, correctly resolves and
executes a multi-Skill scenario.**

## 3. PROPOSED: OS-level multi-skill E2E scenarios via the Capability/Provider registry

**The core proposal, stated once, precisely:** extend §1.1's proven pattern — real
cloned repos, real ffmpeg, no mocked Skill-execution boundary — but resolve which Skill
executes each step of a scenario through the Capability/Provider registry
(`CAPABILITY_MODEL.md`) rather than a hardcoded per-Skill environment-variable mapping.
Concretely: a scenario's `ProductionPlan` names Capability ids (and, where a Capability
has multiple Providers, optionally a `provider_id`), and the test harness's job is to
prove the registry resolves each one to the correct, real, cloned Skill process — i.e.,
it exercises the actual Compiler → Operation resolution path
(`EXECUTION_MODEL.md` §1.1), not a test harness that already knows which Skill to call
because it hardcoded the answer itself.

**Scope discipline:** keep the scenario count small and realistic. Per the repeated
discipline in `ARCHITECTURE.md` §9 (lens 5) and `EXECUTION_MODEL.md` §0 against building
unevidenced infrastructure, this is explicitly **not** a combinatorial "every Capability
× every Provider × every parameter combination" matrix — that would be new,
un-evidenced test-maintenance burden, not a proportionate extension of a working pattern.
A handful of end-to-end narratives, each proving a distinct structural property (§4),
is the target shape.

### 3.1 Worked example scenario (illustrative, not the only one)

> raw footage → media-analysis observation → agent decision → video-editing trim →
> audio-production normalize → subtitle-skill caption → qc-skill verify → production
> receipt

Walking the hops:

1. **`media-analysis-skill`** observes the raw footage — silence, loudness
   (`measure.audio.loudness`), decode integrity. This Capability is deliberately chosen
   because it is the one `CAPABILITY_MODEL.md` documents as having **two real Providers**
   today (`qc-skill` and `media-analysis-skill`, per `REPOSITORY_MAP.md` finding 2) —
   this scenario is where the collision-resolution policy gets exercised **end to end**
   (a real registry resolving a real ambiguous Capability to a real chosen Provider, with
   the choice recorded in provenance), not merely structurally validated in the abstract.
2. An **Inference and Decision** (`CORE_PRIMITIVES.md` §5) is authorized from that
   Observation — e.g. "trim the silence at 00:12–00:19."
3. **`video-editing-skill`**'s `TRIM` operation executes, delegating to `ffmpeg-skill`'s
   `cut` tool (`REPOSITORY_MAP.md`'s exemplary delegation pattern).
4. **`audio-production-skill`**'s `NORMALIZE` (EBU R128) executes on the trimmed output,
   also delegating to `ffmpeg-skill`.
5. **`subtitle-skill`**'s `generate` + `render` produce and burn in captions, fed a
   `SubtitleDocument` the scenario supplies directly (per `REPOSITORY_MAP.md`'s
   documented Agent-mediated composition — this scenario does not invent a direct
   `transcription-skill → subtitle-skill` dependency that does not exist in the audited
   ecosystem).
6. **`qc-skill`**'s `verify` produces a `QCReport` over the final export.
7. A **`ProductionReceipt`** (`PROVENANCE.md` §4) is emitted, referencing
   `skill_versions`, `tool_versions`, the `decisions` that authorized each step, and the
   `qc_report_ids`.

**What this scenario structurally proves that no single-Skill test can:** that a
Capability id resolves to a real Provider process across a repo boundary via the registry
rather than a hardcoded call site; that an Artifact produced by one Skill (e.g. the
trimmed video) is a valid, type-compatible input to the next Skill in the DAG; that
provenance accumulates correctly across Skill process boundaries into one Receipt; and
that the whole chain runs with zero shell/raw-argv anywhere along the way — a structural
security guarantee (`SKILL_SPEC.md` §3), now demonstrated across a real multi-repo chain,
not asserted per-repo in isolation.

## 4. Failure-mode coverage matrix

Each row below is a distinct scenario shape, not a parameter variation on the worked
example in §3.1 — this is the explicit list of failure modes this document is asked to
cover, each grounded in an existing mechanism or eval where one exists.

| Failure mode | What the scenario exercises | Grounding / analogous existing evidence |
|---|---|---|
| **Retry** | An Operation transiently fails (a flaky-tool double at the Runtime boundary — never a mocked Skill's business logic) and the Executor retries within `execution.recovery.max_attempts=2` (`FAILURE_RECOVERY.md` §4); assert eventual success and that the retry never exceeds the bounded budget. | `execution/recovery.py`, `SYSTEM_CONSTRAINTS` (`REPOSITORY_MAP.md`) |
| **Unsupported capability** | A Plan references a `capability_id` no registered Skill provides. Assert structural Plan validation fails loudly (`SPEC.md` §3) before any subprocess is spawned — never a runtime crash discovered mid-execution. | `ARCHITECTURE.md` §8 item 4 (structural validation) |
| **Missing Skill** | A declared dependency's checkout is absent (the env-var/well-known-path discovery chain finds nothing). Assert a clear `doctor` AVAILABLE=false report (`SKILL_SPEC.md` §3), not an opaque subprocess-not-found error. | `SKILL_SPEC.md` §3, §5 |
| **Version mismatch** | A dependency Skill's `contract_version` is bumped, in a test fixture, outside the declaring Skill's supported range (`SKILL_SPEC.md` §6). Assert fail-fast at startup, before any Operation attempt — mirrors `ffmpeg-skill`'s real two-axis `skill_version`/`contract_version` distinction (`REPOSITORY_MAP.md`). | `SKILL_SPEC.md` §6, `VERSIONING.md` §2–3 |
| **Invalid artifact** | An Artifact's content hash doesn't match its declared id (simulated tamper/corruption), or a wrong `ArtifactType` is handed to a step expecting another. Directly extends the existing `19_artifact_hash_mismatch.json` eval case (§1.2) from a single-Agent check into a real cross-Skill handoff: does the *receiving* Skill correctly reject a tampered Artifact from a different Skill's output, not only does the Agent's own internal validation catch it. | `evals/19_artifact_hash_mismatch.json`; `ARTIFACT_MODEL.md` §1 |
| **QC failure** | A scenario deliberately produces output that fails a `qc-skill` check (e.g. clipping from a bad gain parameter). Assert the `QCReport` carries `overall_status: FAIL`; assert this does **not** trigger an automatic retry (`FAILURE_RECOVERY.md` §3 — QC `FAIL` is not a failure); assert a `ProductionReceipt` is still emitted with `failures` populated (`PROVENANCE.md` §4's "completed, not necessarily fully-passing" semantics), not a Plan that errors out. | `FAILURE_RECOVERY.md` §3; `PROVENANCE.md` §4 |
| **Recovery** | Combine an Operation-level failure with a subsequent `render --resume`; assert the resumed Job skips already-completed steps via `idempotency_key` (`EXECUTION_MODEL.md` §3.1) and re-attempts only the failed step, reaching a final state indistinguishable from a Job that never failed. | `EXECUTION_MODEL.md` §3, §5; `FAILURE_RECOVERY.md` §7 |
| **Deterministic reproduction** | Run the identical scenario twice from the same source Artifacts; assert `plan_hash` and `ir_hash` are byte-identical, and that `qc-skill`'s `identity` field for an equivalent QC Operation is also identical. | Directly testable today, per `PROVENANCE.md` §5: "the only [reproducibility] claim this ecosystem's current evidence actually supports end-to-end" — this document proposes making it an explicit, automated E2E assertion rather than an implicit, unchecked property |

Every row above is **PROPOSED** — none of these OS-level, registry-mediated scenarios is
claimed to exist anywhere in the audited ecosystem today. The "grounding" column names
the existing mechanism or eval each scenario extends or would directly build on, not a
claim that the scenario itself has been run.

## 5. What this document does not claim

- It does not claim `video-production-agent`'s self-reported test counts (`187` unit /
  `90` adapter / `44/44` real-skill integration / `99/99` evals) were independently
  re-run — `REPOSITORY_MAP.md`'s UNKNOWN on this point stands, unchanged, and this
  document repeats it rather than quietly dropping it.
- It does not claim any scenario in §3 or §4 has been implemented or executed anywhere.
  Everything past §1 is PROPOSED.
- It does not propose a testing rigor beyond what the evidence in §1 supports is
  affordable: §1.1 already proves real multi-repo, real-ffmpeg CI is workable at this
  ecosystem's current size (11 repos); §3–§4 add a small, fixed number of additional
  scenarios on top of an already-paid cost, not a new order of magnitude of CI time or
  maintenance burden.

## 6. What this document deliberately does not propose

- **No mocking of Skill execution boundaries.** This ecosystem's own working pattern
  (§1.1) proves real-process integration testing is affordable at this scale; introducing
  mocks at the Skill boundary for the OS-level scenarios in §3 would be a regression in
  rigor relative to what already exists, not a simplification worth making.
- **No new test framework or scenario-description DSL.** JSON eval fixtures (§1.2, §1.3)
  and a CI workflow (§1.1) are the existing, working tools. §3's scenarios are expressed
  as `ProductionPlan`s (`SPEC.md` §3) exactly like any other Plan — no new authoring
  format is introduced.
- **No performance, load, or scale testing.** No evidence anywhere in the ecosystem
  (`REPOSITORY_MAP.md`; `ARCHITECTURE.md` §9 lens 5) shows this is a live concern yet.
- **No claim that this replaces per-Skill unit tests or the conformance suite**
  (`SKILL_SPEC.md` §4, §8). Layer 5 (§2) is additive, sitting above the existing layers,
  not a substitute for any of them.
- **No combinatorial Capability × Provider × parameter matrix.** Restated from §3: a
  small number of realistic, structurally-distinct narratives is the target, chosen to
  cover the failure-mode list in §4, not to exhaustively enumerate every possible Plan
  shape.

## 7. Status summary

| Item | Status |
|---|---|
| Cross-repo integration CI (§1.1) | CURRENT |
| `video-production-agent` `evals/` corpus, category breadth and named cases (§1.2) | CURRENT (existence/shape); pass counts SELF-REPORTED, NOT INDEPENDENTLY RE-RUN |
| `ffmpeg-skill` agent-behavior evals (§1.3) | CURRENT |
| Layered testing model (§2) | Naming existing layers (CURRENT) + one new proposed layer (PROPOSED) |
| Capability/Provider-registry-mediated multi-skill E2E scenarios (§3) | PROPOSED |
| Worked scenario and failure-mode matrix (§3.1, §4) | PROPOSED |
| Deterministic-reproduction assertion as an automated CI check | PROPOSED (the underlying guarantee is CURRENT per `PROVENANCE.md` §5) |
