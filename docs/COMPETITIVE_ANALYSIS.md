# Competitive and Adjacent Landscape

This document records what already exists outside this ecosystem — verification tooling,
full agent-orchestration frameworks, commercial products, timeline/edit representations,
workflow-orchestration engines, and plugin architectures — and states what this project
adopts from each, what it deliberately avoids, and what it differentiates on. It is
referenced by name from `ARCHITECTURE.md` §6 and §9 (lens 10), `CORE_PRIMITIVES.md` §6
and §8, `VERSIONING.md` §6, and `TIMELINE_MODEL.md`; this document is the detailed
backing for those citations, not a restatement that revises their verdicts.

## 0. Methodology and verification levels

The findings below come from a background research agent's report, condensed, plus one
independent spot-check (a `WebFetch` against OpenMontage's repository) performed as part
of this project's own audit. This document does not re-research the findings from
scratch; it documents them and preserves every verification caveat from the original
research exactly as reported, per this project's own governing discipline — the same
"do not state unverified things as fact" standard `REPOSITORY_MAP.md` applies throughout
to this project's own ecosystem is applied here, outward, to competitors' claims.

Three verification levels are used:

- **CONFIRMED** — independently verified to exist, with a citable URL.
- **CONFIRMED, WITH CAVEAT** — verified to exist, but a specific claimed detail (a
  statistic, a growth curve) could not be independently corroborated and is flagged as
  such rather than repeated as settled fact.
- **DOES NOT APPEAR TO EXIST** — named in the original research brief but no evidence of
  a real, matching project was found. Stated plainly rather than silently dropped, so a
  reader does not mistake silence for confirmation.

## 1. Verification / QC tooling prior art

### 1.1 QCTools

**CONFIRMED.** `github.com/bavc/qctools`, `mediaarea.net/QCTools`. BAVC's open-source,
frame-level A/V signal analysis tool for archivists.

- **Strength:** mature, frame-accurate signal analysis.
- **Weakness:** a human-triage tool — it presents signal data for a person to interpret;
  it has no automated pass/fail policy engine of its own.
- **Lesson:** separate signal-analysis (this project's `QCMeasurement`, `SPEC.md` §5)
  from policy-enforcement (`QCFinding`'s threshold judgment, same section). QCTools is a
  real example of a mature tool that only does the measurement half — confirming, from
  the outside, that `qc-skill`'s `QCMeasurement → QCFinding → QCCheck → QCReport`
  hierarchy (`CORE_PRIMITIVES.md` §9) is a real, useful layering distinction rather than
  an unnecessary complication.

### 1.2 MediaConch

**CONFIRMED.** `github.com/MediaArea/MediaConch`. A conformance/policy checker with
exportable/importable XML policies.

- **Lesson (ADOPT):** policy-as-a-portable-file — a versioned, diffable rule set, not
  inline code — is strong, independently-arrived-at prior art for what this OS's QC
  "rules" concept should look like as a first-class artifact. `qc-skill`'s `rules` field
  is already part of its identity hash (`SPEC.md` §5, `PROVENANCE.md` §2), but it is not
  yet a formal, independently versioned `Artifact` type in `SPEC.md` §2's enum. This is
  worth naming as a candidate future addition — a `qc_policy` or `delivery_spec` document
  type, versioned and diffable the way MediaConch's XML policies already are — rather
  than assuming `qc-skill`'s `rules` parameter stays an opaque, unversioned blob forever.
  Not designed further here; a candidate for a future `ARTIFACT_MODEL.md` revision.

### 1.3 VMAF

**CONFIRMED.** `github.com/Netflix/vmaf`. Netflix's perceptual video-quality metric,
since merged into FFmpeg.

- **Limitation that matters here:** full-reference only — it requires the original to
  compare against, which makes it useless for no-reference or generative-content QC.
- **Lesson:** VMAF-style full-reference metrics are the right tool for re-encode/transcode
  QC — a `measure.video.quality-vs-source` Capability would be a legitimate, genuinely
  new Capability, not a variant of an existing check. Every `qc-skill` video check per
  `REPOSITORY_MAP.md` (resolution/fps/codec/black-frame/freeze-frame/decode-integrity) is
  **no-reference** today. VMAF's own full-reference limitation is direct external
  evidence that a single metric family cannot cover both re-encode verification and
  no-original-reference (e.g. generative) content — a real, currently-unfilled gap this
  document names but does not design a solution for.

### 1.4 "rendercheck" (Pixar RenderMan) — does not appear to exist

**DOES NOT APPEAR TO EXIST.** No real project matching "Pixar RenderMan's rendercheck"
in the video/3D-rendering QC space could be verified. This is stated plainly as a likely
fabricated or confused reference in the original research brief, not silently dropped —
the only real project sharing the name "rendercheck" is an unrelated X.Org X11
RENDER-extension conformance tool, which has nothing to do with video or 3D rendering QC
and is not cited here as a competitor, only noted to explain why the name might have been
mistakenly recalled.

### 1.5 uploadcheck-mcp

**CONFIRMED, small/early-stage.** npm package `@drantoniou/uploadcheck-mcp`
(`https://www.npmjs.com/package/@drantoniou/uploadcheck-mcp`), a thin MCP-server wrapper
over a hosted proprietary API at `uploadcheck.app`, offering 40+ checks and a
PASS/WATCH/BLOCK ternary verdict.

- **Lesson (adopt the pattern, not the dependency):** a ternary verdict models
  uncertainty better than a binary pass/fail. This OS's own `QCReport` already goes
  further with a four-state `PASS/WARN/FAIL/UNKNOWN` model (`SPEC.md` §5) that
  additionally distinguishes "no checks ran" (`UNKNOWN`) from "checks ran and found
  something ambiguous" (`WARN`) — a distinction uploadcheck-mcp's ternary model does not
  appear to make. Do **not** hard-depend on `uploadcheck.app` itself: it is a small,
  unclaimed, low-visibility hosted service with no evidence of maturity or longevity — a
  real vendor-lock and availability risk if adopted as infrastructure rather than studied
  as a design pattern. This is consistent with `ARCHITECTURE.md` §10's local-first
  posture: nothing in this ecosystem depends on a network service today, and this is a
  concrete example of the kind of dependency that posture is right to avoid.

## 2. Full agent-orchestration prior art — OpenMontage (the single most important competitive finding)

**CONFIRMED TO EXIST AND BE SUBSTANTIAL**, independently re-verified via `WebFetch`
during this audit: `github.com/calesthio/OpenMontage`, AGPL-3.0, Python. The fetch
reported 56.2k stars / 7.1k forks and "no suspicious indicators detected."

**Architecture, as reported:** an agent-orchestration framework driven from Claude Code,
Cursor, Copilot, or Codex; a `tools/` directory of 100+ auto-discovered Python
executables inheriting a `BaseTool` class, wrapping 20+ external providers; a
`pipeline_defs/` directory of YAML manifests for roughly 12 production pipelines;
`skills/` and `.agents/skills/` directories totaling 700+ markdown instruction files.
It has pre-execution cost/budget gates, pre-render checks, post-render self-review
(ffprobe validation, black/frozen-frame detection, audio-level and subtitle checks), and
scored provider-selection with logged decision trails.

**Verification caveat — read this before citing the star count anywhere public.** A
`WebSearch` performed as part of the same research pass found many forks or clones of
this repository under different owner names, with **differing claimed statistics in
their own descriptions** — examples found: "12 pipelines, 100+ tools" versus "11
pipelines, 49 tools, 400+ skills" versus "52 tools, 500+ agent skills." The same
architectural concept, restated with materially different numbers by different apparent
owners, suggests OpenMontage may be a widely-forked or rebranded template rather than one
single canonical, actively-maintained project with one stable, agreed feature count.
Separately, reaching 56.2k stars within roughly three months of an apparent ~June 2026
creation date is an unusually fast growth rate that could not be independently
corroborated against a star-history timeline in this audit.

**How to read this finding, precisely:** the project's existence, its general
architecture, and its AGPL-3.0 licensing are treated as **CONFIRMED** — this document is
confident that OpenMontage-shaped software, with this architecture, is real and worth
taking seriously as prior art. The specific star count and growth trajectory are flagged
as **CONFIRMED, WITH CAVEAT** — worth independent re-verification (a proper star-history
check, a look at actual commit history and contributor count, not only the repository's
own README/about-page numbers) before repeating "56.2k stars" as a citable fact in any
external-facing material. This is exactly the same discipline `REPOSITORY_MAP.md` applies
to `video-production-agent`'s own self-reported "99/99 evals" commit-message claim
(explicitly named there as not independently re-run) — turned outward, at a competitor,
rather than only inward, at this project's own ecosystem.

**Why this is the single most important competitive finding:** it is a nearly identical
concept to this project's own OS — auto-discovered tools wrapping external providers,
declarative pipeline manifests, pre/post-render verification — already built and, on its
own numbers, popular, under an AGPL-3.0 license. Weaknesses relative to this project's
design, as read from OpenMontage's public materials:

- **AGPL-3.0 copyleft licensing** — a real adoption barrier for anyone building
  commercial or permissively-licensed tooling near it.
- **Heavy dependency fan-out** — 20+ wrapped providers, each a potential
  compatibility and security surface, with no described single, shared Runtime
  contract analogous to this project's convergent `FORBIDDEN_KEYS`/`PathPolicy` pattern
  (`CORE_PRIMITIVES.md` §4).
- **No described equivalent of `qc-skill`'s identity/cache/tamper-detection design**
  (`PROVENANCE.md` §1, `ARTIFACT_MODEL.md` §6) — OpenMontage's "post-render self-review"
  is described as a set of checks, not as a reproducibility scheme with content-addressed
  identity and cache tamper-detection.

**Direct tie to this project's own decisions:** `ARCHITECTURE.md` §9 (red-team lens 10)
already names this exact finding and states the differentiation claim: **verification
rigor and provenance depth** and a **permissive-license, contract-first
interoperability story**, rather than competing on bundled-tool-marketplace breadth. This
document is the detailed backing for that lens; the closer look here does not revise that
verdict — if anything, the fork-proliferation and unverified-growth caveat found here
strengthens the case for differentiating on verification rigor and licensing rather than
trying to out-market a project whose own headline numbers cannot be fully corroborated.

## 3. Commercial / market comparators

### 3.1 MakeMyClip

**CONFIRMED.** `makemyclip.com`. A closed, commercial SaaS product, not open source.
Included only as a market comparator establishing that a commercial market for this
category of product exists — its internals are not public, so it is not architectural
prior art and does not inform any design decision in this document set.

### 3.2 "forwrdcut" — does not appear to exist

**DOES NOT APPEAR TO EXIST.** No evidence of a real project by this name was found.
Stated clearly as unverifiable, and likely fictitious in the original research brief,
rather than silently omitted.

## 4. Timeline / edit-representation prior art

### 4.1 OpenTimelineIO (OTIO)

**CONFIRMED.** Academy Software Foundation;
`https://github.com/AcademySoftwareFoundation/OpenTimelineIO`. A JSON interchange
format, Python API, and plugin adapters (FCP XML, AAF, CMX EDL) for editorial timeline
data.

- **Lesson (ADOPT):** validated prior art for exactly the gap `CORE_PRIMITIVES.md` §8
  names — a future edit-`Timeline` primitive (clips, tracks, transitions, captions,
  markers), distinct from `video-production-agent`'s existing `temporal/timeline.py`
  event-history concept. `CORE_PRIMITIVES.md` §8 already commits to modeling that future
  primitive "after OpenTimelineIO's clip/track/transition/marker shape... rather than
  invented from scratch"; this entry is the citation backing that commitment. See
  `TIMELINE_MODEL.md` for the full design treatment — not duplicated here.

### 4.2 Shotstack

**CONFIRMED.** A commercial cloud video-editing API with a declarative JSON edit spec.
A second, commercial data point (alongside OTIO's open, interchange-focused approach) for
what a `Timeline` Artifact's JSON shape could look like — relevant as a market/API-shape
comparator, not adopted directly.

### 4.3 Remotion

**CONFIRMED.** An open-source, React-based programmatic video framework, used internally
by OpenMontage (per §2). Relevant as a "video-as-code" alternative point in the design
space — declarative React composition, rather than typed operations delegating to
ffmpeg. This project does not adopt this model: the ecosystem's existing typed-Skill-over-
`ffmpeg-skill` delegation pattern (`REPOSITORY_MAP.md` finding 1) is independently
validated on its own terms across five Skills already, and nothing in the evidence
suggests replacing it.

### 4.4 editly

**CONFIRMED.** `github.com/mifi/editly`. A declarative Node.js + ffmpeg video editor.
Another independent data point that "declarative spec wrapping ffmpeg" is a broadly
convergent, validated shape across unrelated projects — consistent with, not a challenge
to, this ecosystem's own typed-operation delegation pattern.

### 4.5 FFCreator

**CONFIRMED.** `github.com/tnfe/FFCreator`. Another declarative, ffmpeg-based video
creation library, in the same category as editly — further confirming that typed or
declarative wrapping of ffmpeg is a broadly convergent pattern, not a choice unique to
this ecosystem.

### 4.6 Kinocut / mcp-video

**CONFIRMED.** `github.com/KyaniteLabs/mcp-video`. A self-hostable MCP server wrapping
FFmpeg, with "preflight guardrails" and a "Video Receipts" audit trail.

- **Lesson:** its "Video Receipts" concept is directly analogous to this project's own
  PROPOSED `ProductionReceipt` (`SPEC.md` §6, `PROVENANCE.md` §4) — independent,
  convergent evidence that an emitted, per-run audit-trail artifact is a validated shape
  in this exact domain, not an invention unique to this project. Unlike uploadcheck-mcp
  (§1.5), mcp-video is self-hostable, which matters for this project's local-first,
  no-required-external-service posture (`ARCHITECTURE.md` §10) — it is the more directly
  comparable prior art of the two MCP-shaped tools found in this research.

### 4.7 Frame.io

**CONFIRMED.** Adobe; a commercial review/approval platform. Prior art for a
review/approval-gate subsystem — relevant to the human-approval workflow already present
at the IR level in `video-production-agent` (`REPOSITORY_MAP.md`) and to the Decision
`approval: AUTO/CONFIRM/BLOCK` field (`CORE_PRIMITIVES.md` §5). Frame.io demonstrates a
mature, separately-monetizable product exists around exactly this one workflow step —
supporting evidence for keeping approval a clean, potentially-pluggable seam rather than
building a specific review UI into the OS kernel, consistent with `ARCHITECTURE.md` §8's
explicit exclusion of "a UI" from the kernel.

## 5. Workflow-orchestration prior art

### 5.1 Temporal

**CONFIRMED.** `https://github.com/temporalio/temporal` (`temporal.io`). Durable
execution with idempotency-key activities and deterministic, replayable workflow code.

- **Lesson:** model pipeline steps as idempotent, retryable "activities" — already
  partially matched by `Operation.idempotency_key`
  (`EXECUTION_MODEL.md` §3, `FAILURE_RECOVERY.md` §1). Temporal's activity model
  additionally provides durable replay across a distributed worker fleet, which this
  project explicitly declines to build (`EXECUTION_MODEL.md` §0, §2.2;
  `ARCHITECTURE.md` §9 lens 5: "no evidence of scale that would matter") — the
  idempotency-key discipline is adopted; the distributed-durable-execution machinery
  around it is not, for lack of evidence this ecosystem needs it. See also
  `docs/adr/ADR-006-execution-model.md`, which considers and rejects adopting Temporal
  or Airflow directly for exactly this reason.

### 5.2 Airflow

**CONFIRMED.** `https://github.com/apache/airflow`. DAG-of-tasks orchestration;
idempotency treated as an authoring discipline rather than a framework guarantee.

- **Lesson:** confirms DAG-of-tasks is a common, validated orchestration shape — see
  §5.3 for why this project's own Plan model is closer to Dagster's asset-centric variant
  than to Airflow's task-centric one.

### 5.3 Dagster

**CONFIRMED.** `https://github.com/dagster-io/dagster`. Asset-centric, not task-centric,
orchestration.

- **Lesson (ADOPTED, already cited in this project's own architecture):**
  `CORE_PRIMITIVES.md` §6 and `ARCHITECTURE.md` §6 already explicitly adopt the
  Dagster-over-Airflow framing — a `ProductionPlan` is "a DAG over Artifacts and
  Operations," and QC gates "attach naturally to artifacts... not to abstract task
  nodes." This entry supplies the citable external prior art backing that already-made
  decision; it does not revise it.

## 6. Plugin-architecture prior art

### 6.1 LSP (Language Server Protocol)

**CONFIRMED.** `https://microsoft.github.io/language-server-protocol/`. Capability
negotiation at handshake time solves the M-editors × N-languages combinatorial problem.

- **Lesson (ADOPTED):** the direct model behind this project's `CapabilityContract`
  negotiation — `CORE_PRIMITIVES.md` §1's `Capability` concept, `SPEC.md` §1's
  `CapabilityContract`, and the `doctor`/AVAILABLE-MISSING pattern `SKILL_SPEC.md` §3
  generalizes — is the same "publish what you support, let the other side query it"
  shape that solves M-Agents × N-Skills exactly as LSP solves M-editors × N-languages.
  This document supplies the citable external validation for a design already present
  throughout `CAPABILITY_MODEL.md` and `SKILL_SPEC.md`.

### 6.2 VS Code extensions

**CONFIRMED.** `https://code.visualstudio.com/api`. The extension host is **not**
sandboxed despite running in a separate process — a documented, ongoing security
weakness: an extension running with broad host privileges is difficult to safely contain
once an ecosystem exists and extensions are trusted by convention rather than verified
behavior.

- **Lesson (AVOID replicating this):** this project's black-box conformance-test-suite
  approach (`SKILL_SPEC.md` §8) — checking a Skill's behavior from outside, rather than
  trusting that it merely imports an OS-provided security library — is a direct reaction
  to this exact failure mode. `ARCHITECTURE.md` §9 (lens 3) already reaches the same
  conclusion independently ("a single point of bypass if a third-party Skill just doesn't
  use the reference library... addressed by making the denylist part of the conformance
  test suite"), and `docs/adr/ADR-009-plugin-conformance-over-code-review.md` names the
  VS Code extension host explicitly as the cautionary precedent this design is chosen to
  avoid. This document supplies the external grounding for a decision already recorded
  in both places — process isolation alone is not a security boundary if nothing verifies
  what the isolated process is actually permitted to do.

### 6.3 Kubernetes Custom Resource Definitions (CRDs)

**CONFIRMED.** `https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources/`.
Alpha/beta/stable per-API-version lifecycle, with conversion webhooks translating between
simultaneously-served versions.

- **Lesson (DECLINED, deliberately):** `VERSIONING.md` §6 already considers this pattern
  by name and declines it, for reasons restated here rather than duplicated at length:
  every version number in this 11-repo ecosystem is single-digit or a small `0.x`/`"1.0"`
  string, and every existing consumer pins a supported *range*, never simultaneously
  serves multiple shapes of the same contract. Kubernetes needs conversion webhooks
  because a cluster genuinely runs workloads written against many API versions
  concurrently, at massive scale, over years; nothing in this ecosystem's evidence shows
  that problem exists. Declining CRD-style multi-version serving now is the right call
  given the evidence, not a missed opportunity — adopting it would be exactly the kind of
  "architecture astronautics" `ARCHITECTURE.md` §9 (lens 5) and §10 already rule out,
  paid for in real implementation complexity (every contract consumer handling N
  simultaneous shapes instead of one) against a problem with zero current instances.

### 6.4 Docker plugins

**CONFIRMED.** `https://docs.docker.com/engine/extend/`. Lazy, on-demand plugin
activation via an out-of-process handshake, rather than eagerly initializing every
installed plugin at daemon startup.

- **Lesson — a genuinely new recommendation, not yet reflected anywhere else in this
  document set** (checked directly against `ARCHITECTURE.md`, `CAPABILITY_MODEL.md`, and
  `EXECUTION_MODEL.md`; none currently states a registry-activation-timing policy): don't
  eagerly initialize every registered Skill or Provider when the OS/registry starts up —
  activate a Skill (run its `doctor`/contract handshake) on first `Plan` reference to a
  Capability it provides, mirroring Docker's out-of-process, on-demand plugin handshake.
  This costs nothing new to add: the `doctor` entrypoint every Skill already exposes
  (`SKILL_SPEC.md` §3) is exactly the handshake this lesson calls for. It is recorded here
  as a **PROPOSED** refinement for whichever document formalizes registry startup
  behavior, not claimed as an already-adopted decision — this is the one lesson in this
  section this document introduces rather than one it finds already backing an existing
  decision.

## 7. Summary: what we adopt / what we avoid / what we differentiate on

### Adopt

| From | Into |
|---|---|
| MediaConch's policy-as-portable-file (§1.2) | Candidate future `qc_policy`/`delivery_spec` artifact type, generalizing `qc-skill`'s `rules` field |
| OTIO's clip/track/transition/marker shape (§4.1) | The `Timeline` primitive (`CORE_PRIMITIVES.md` §8, `TIMELINE_MODEL.md`) |
| Dagster's asset-centric DAG over Airflow's task-centric one (§5.2, §5.3) | `ProductionPlan` as a DAG over Artifacts and Operations (`CORE_PRIMITIVES.md` §6, `ARCHITECTURE.md` §6) |
| LSP's capability-negotiation-at-handshake (§6.1) | `CapabilityContract` + `doctor` (`CORE_PRIMITIVES.md` §1, `SPEC.md` §1, `SKILL_SPEC.md` §3) |
| Temporal's idempotent-activity discipline, without its distributed-durability machinery (§5.1) | `Operation.idempotency_key` (`EXECUTION_MODEL.md` §3) |
| Docker plugins' lazy/on-demand activation (§6.4) | PROPOSED registry-startup refinement, new to this document |
| Kinocut/mcp-video's "Video Receipts," uploadcheck-mcp's ternary-verdict framing — studied as patterns, not dependencies (§4.6, §1.5) | `ProductionReceipt` (`SPEC.md` §6), `QCReport`'s four-state model (`SPEC.md` §5) |

### Avoid

| From | Because |
|---|---|
| VS Code extension host's unsandboxed-despite-isolated model (§6.2) | Replaced by a black-box conformance suite rather than voluntary-library trust (`SKILL_SPEC.md` §8, `ARCHITECTURE.md` §9 lens 3, ADR-009) |
| Kubernetes CRDs' simultaneous-multi-version-serving complexity (§6.3) | Declined for now — single supported-range versioning instead (`SKILL_SPEC.md` §6, `VERSIONING.md` §6) |
| Hard-dependency on an unclaimed, low-visibility hosted service, e.g. `uploadcheck.app` (§1.5) | Local-first posture, no required external service (`ARCHITECTURE.md` §10) |
| Competing on combinatorial provider fan-out as a goal in itself (OpenMontage, §2) | Depth and rigor over breadth (§2's differentiation argument) |

**Open licensing question, stated rather than resolved here:** OpenMontage's AGPL-3.0
copyleft licensing is a real, documented adoption barrier this project can differentiate
against (§2). This project's own license is not specified anywhere in the audited
document set — `REPOSITORY_MAP.md` notes the 11 audited repos are "single-owner, public"
but records no license for any of them. This document surfaces that as an open decision
for whoever owns licensing policy; it does not resolve it, and does not assume a
permissive license is already chosen merely because it would make a clean contrast with
OpenMontage.

### Differentiate on

- **Verification rigor and provenance depth** — `qc-skill`'s identity/cache/
  tamper-detection scheme, generalized in `PROVENANCE.md` and `ARTIFACT_MODEL.md` §6,
  against OpenMontage's described post-render checks, which have no described equivalent
  scheme (§2; `ARCHITECTURE.md` §9 lens 10).
- **Permissive-license, contract-first interoperability** — `SPEC.md`'s
  `CapabilityContract` and `SKILL_SPEC.md`'s conformance suite, against OpenMontage's
  AGPL-3.0 copyleft (§2).
- **A narrower, evidence-driven kernel** (`ARCHITECTURE.md` §8) over
  bundled-tool-marketplace breadth. This project does not compete on "how many providers
  are wrapped" — it competes on whether two independently-built pieces of software can
  trust the same contract and prove, after the fact, exactly what happened.
