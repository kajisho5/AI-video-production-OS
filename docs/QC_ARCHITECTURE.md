# QC / Verification Architecture

This document specifies how the OS verifies production output. It is built directly on
`qc-skill`'s design, which `REPOSITORY_MAP.md` identifies as **the one repository in the
whole audit where the task's assumptions were fully confirmed against source code**, not
inferred from documentation. Nothing in §1–§2 below is redesigned; it is the existing,
verified-correct implementation, restated as the OS contract. §3 onward is where this
document extends the design, and every extension is marked as such.

## 1. The QCReport hierarchy (CURRENT, unchanged)

```
QCMeasurement { name, value, unit }
QCFinding { measurement, threshold, verdict }
QCCheck    { name, findings: [QCFinding] }
QCReport   { overall_status: PASS | WARN | FAIL | UNKNOWN, checks: [QCCheck], identity }
```

Four properties of this design are load-bearing and are adopted verbatim, not just the
type names:

- **A fact/threshold/verdict split, not a collapsed boolean.** A `QCMeasurement` is a
  raw number (e.g. "integrated loudness: -17.2 LUFS"). A `QCFinding` is that number
  judged against a threshold. Nothing about "did this pass" exists without an explicit
  measurement and an explicit threshold behind it — there is no code path that produces a
  verdict without evidence.
- **Worst-wins aggregation.** `QCReport.overall_status` is the worst status among all
  `QCFinding`s it aggregates (`FAIL` > `WARN` > `PASS`), never an average, never a
  majority vote. One failing finding fails the report.
- **`UNKNOWN` on empty input, never a silent `PASS`.** `overall_status` defaults to
  `UNKNOWN` when no checks ran. This is a deliberate, code-enforced choice
  (`REPOSITORY_MAP.md`) — "we didn't check" and "we checked and it's fine" are never
  conflated.
- **Identity, not a timestamped log entry.** `identity =
  sha256(canonical_json({skill, skill_version, kind, operation, asset_fingerprints,
  effective_parameters, rules, ffmpeg_version, ffprobe_version}))`, explicitly excluding
  timestamps/paths/`request_id`. See `PROVENANCE.md` §1 for the full reproducibility
  argument this identity scheme is built on.

## 2. Concrete checks that exist today (CURRENT)

| Domain | Checks |
|---|---|
| Video | resolution, fps, codec, pixel format, color metadata, black-frame (`blackdetect`), freeze-frame (`freezedetect`), decode-integrity |
| Audio | LUFS/LRA/true-peak (`ebur128`), clipping, silence (`silencedetect`), channel layout/balance |
| Subtitle | SRT/VTT/ASS **timing only** — no semantic or wording checks |
| Delivery | composition of the above, plus container/size/extension checks |

Two boundaries here are worth stating precisely because they recur in §5:

- **Subtitle QC is structural/timing, never semantic.** `qc-skill` does not evaluate
  whether subtitle *text* is correct, well-translated, or appropriately timed to speech
  content — only whether the cue timing data is internally valid (format compliance,
  overlap, duration bounds). This matches `subtitle-skill`'s own posture (structural
  validation only, per `REPOSITORY_MAP.md`) and is a real, present scope boundary, not an
  oversight to fix.
- **Delivery QC is composition, not a new measurement domain.** It runs the same
  video/audio/subtitle checks against a final delivery package plus container-level
  facts (size, extension, container format) — it is not a fifth independent check
  category with its own measurement logic.

## 3. The boundary: QC does not make production decisions (CURRENT, enforced in code)

`qc-skill`'s own ADR-001: **"qc-skill is not an AI agent and does not make production
decisions."** `REPOSITORY_MAP.md` confirms this is enforced by absence, not just by
comment — no decision/render/publish/block logic exists in the code outside
boundary-documentation comments. A `QCReport.overall_status = FAIL` is a fact about
measured reality against a stated threshold; whether that fact triggers a re-render,
blocks a publish, or is accepted as a known limitation is a `Decision`
(`CORE_PRIMITIVES.md` §5), made by an Agent, with its own `basis` and `approval` state.
This is the one part of the audited ecosystem `ARCHITECTURE.md` §3 cites as already
correctly separating "the OS may verify" from "the OS may not decide," and this document
keeps that boundary exactly where `qc-skill` already drew it — every extension below
(§5) is checked against it explicitly.

## 4. QC vs. observation: `qc-skill` and `media-analysis-skill`

### 4.1 The duplication, precisely

`REPOSITORY_MAP.md` confirms silence detection, loudness measurement, and
decode-integrity checking are **each independently implemented twice**:
`media-analysis-skill/analyzers/{silence,loudness,integrity}.py` and
`qc-skill/measurements/audio.py` + `_decode_errors.py`, with no shared library between
them. Awareness is one-directional — `qc-skill`'s docs reference and position against
`media-analysis-skill`; `media-analysis-skill`'s docs contain zero references to
`qc-skill`.

Critically, this is **not** a strict subset relationship: `qc-skill` additionally
implements black-frame and freeze-frame detection that `media-analysis-skill` does not
have at all, while `media-analysis-skill` implements `scene_detection` and `timing`
(packet-gap/A-V sync) that `qc-skill` does not have at all. The overlap is a genuine
partial intersection — three shared measurement domains, and at least three
domain-exclusive capabilities on each side.

### 4.2 Are they the same Capability with two Providers, or fundamentally different roles?

**Both, at different layers — and the layer distinction is the actual fix, not a hedge.**

At the **measurement layer**, for exactly the three overlapping domains (loudness,
silence, decode-integrity), the answer is unambiguous per `CAPABILITY_MODEL.md`'s own
worked example: `measure.audio.loudness` has two Providers today, `qc-skill` and
`media-analysis-skill`, both computing the same fact (`ebur128` output) via independently
written code. This is a Capability-registry fact the OS should surface, per
`CAPABILITY_MODEL.md` §Capability collision policy — not a case for deleting one Skill,
because each Skill also does things the other categorically does not (§4.1).

At the **verification layer**, the two Skills are not interchangeable and do not play the
same role:

- `media-analysis-skill` produces **facts** — a measurement, and nothing judged against
  it. Its own README explicitly frames this as "the dedicated observation domain," "no
  AI," purely observational, with zero decision or verdict language anywhere in its docs
  or schemas (`REPOSITORY_MAP.md`). In this OS's type system, its outputs are
  `Observation`s (`provenance="OBSERVED"`, per `CORE_PRIMITIVES.md` §5) — evidence, full
  stop.
- `qc-skill` produces **verdicts** — the same kind of raw measurement, but wrapped in a
  `QCFinding` (measurement + threshold + verdict) and rolled up through `QCCheck` into a
  `QCReport` with worst-wins aggregation. This judgment layer — rules, thresholds,
  aggregation semantics, the `UNKNOWN`-on-empty guarantee — has no equivalent anywhere in
  `media-analysis-skill`. `media-analysis-skill` could not be swapped in as a
  drop-in replacement for `qc-skill` even for the three domains they share, because the
  thing that makes a QC report useful (the verdict, not the number) doesn't exist on the
  observation side at all.

**Conclusion:** for the three overlapping measurement domains, `qc-skill` and
`media-analysis-skill` should register as two Providers of the same Capability at the
*measurement* level (`measure.audio.loudness`, `measure.audio.silence`,
`measure.integrity.decode`) — this is the Capability/Provider model directly fixing the
duplication finding, exactly as `CAPABILITY_MODEL.md` specifies. But "QC" as a whole is
not itself reducible to "a Provider of the same Capabilities `media-analysis-skill`
provides" — it is a Skill that *additionally* applies a judgment layer
(Finding/Check/Report, thresholds, rules, aggregation) that `media-analysis-skill`
deliberately does not implement and is not trying to. The two Skills are not competing
implementations of one role; they are one shared measurement layer (where they overlap)
underneath two different, non-overlapping roles (raw observation vs. threshold
verification) — and `qc-skill`'s exclusive black/freeze checks and
`media-analysis-skill`'s exclusive scene/timing checks are evidence that even at the
Capability level, most of what each Skill does is not shared at all.

**Practical consequence for the Capability model:** fixing the duplication does not mean
retiring one Skill. It means factoring the *measurement computation* for the three
overlapping domains into something both Skills can register as a Provider of (whether
that ends up as each Skill keeping its own implementation but declaring the same
Capability id — the minimum viable fix, requiring no code change, only contract
declaration — or a future shared measurement library one or both migrate to internally,
which is a Roadmap-level implementation question, not an architecture question this
document needs to settle).

## 5. Extending QC to verify a Plan, not just inspect a file (PROPOSED)

Everything in §1–§4 verifies a **final artifact in isolation**: is this file's LUFS in
range, is this file's resolution correct, is there a freeze in it. None of it today
checks whether the artifact matches what the *Plan* actually intended — e.g. "duration is
between 8 and 12 minutes" (a fixed, context-free rule) is a different, weaker claim than
"duration matches the sum of this Plan's trim/concat steps' intended output length" (a
claim that requires knowing the Plan). This is a real gap: nothing in the audited
ecosystem does the second kind of check anywhere.

### 5.1 Why this doesn't require new primitive types

The task brief's proposed evidence chain is `Finding → Check → Measurement → Artifact →
Operation → Skill → ProductionPlan`. That is seven node types. This document adopts a
**shorter chain**, because five of those seven already exist with the exact linking
fields needed, and adding "Skill" as its own hop in the traversal would be redundant:

- `Measurement`, `Finding`, `Check`, `Report` — unchanged, §1.
- `Artifact.produced_by` already carries `{capability_id, provider_id, skill_id,
  skill_version, operation_id}` (`SPEC.md` §2) — so "which Skill produced this artifact"
  is already one field lookup on the Artifact, not a separate graph node to traverse.
- `Operation` already carries `capability_id, provider_id, skill_id` (`SPEC.md` §4) —
  the same information, reachable from either direction.
- `ProductionPlan` steps already carry `decision_id` (`SPEC.md` §3) — tying an Operation
  back to the `Decision` that authorized it, and from there to the `Observation`/
  `Inference` chain behind that Decision (`CORE_PRIMITIVES.md` §5).

The **one genuinely missing link** is that `QCReport` today has no field naming *which
Artifact it verified* — its `identity` hash is built from `asset_fingerprints`, which
binds it cryptographically to the input bytes but is not a lookup key back to an
`Artifact.id` in a Plan graph. The minimal fix is one new field:

```
QCReport {
  ...unchanged...
  subject_artifact_id: ArtifactId   (PROPOSED — the one new field)
}
```

With that single field, the full traversal `Report → Artifact → Operation (capability_id,
provider_id, skill_id) → decision_id → ProductionPlan step` is already walkable using
fields that exist in `SPEC.md` today. **This document does not adopt the seven-node
chain as a set of new types** — it is unnecessary machinery for a graph that is already
one field short of being fully traversable.

### 5.2 Plan-conformance checks (PROPOSED, new Check category)

The mechanism for "does duration match Plan intent" is not a new dataclass — it is a new
*source* for the `threshold` a `QCFinding` is judged against. Today, every threshold in
`qc-skill` comes from a fixed rule file (`rules`, already part of the identity hash,
§1) — a context-free spec like "duration in [480s, 720s]." A **plan-conformance check**
is the same `QCMeasurement`/`QCFinding`/`QCCheck`/`QCReport` shape, but the threshold is
derived from the specific `ProductionPlan` step's declared intent (e.g. the sum of a
`CONCAT` operation's input segment durations, or a `TRIM` operation's declared
`out_point - in_point`) rather than from a fixed rule file:

```
QCFinding {
  measurement: { name: "duration", value: 611.2, unit: "s" },
  threshold: { source: "plan", plan_step_id: "...", expected: 610.0, tolerance: 2.0 },
  verdict: PASS
}
```

This stays inside the existing boundary from §3: QC still only measures and compares
against a *given* target — it does not invent the target, decide it is a good target, or
act on a mismatch. The target's provenance (`"plan"` vs. `"rule"`) is now visible in the
finding itself, which is strictly more information than today's scheme carries, not a
new decision-making capability. A plan-conformance mismatch (measured 590s against an
expected 610s) is exactly as inert a fact as a rule-based mismatch — it becomes a `FAIL`
finding an Agent may act on, never an automatic re-render trigger.

**Why this is proportionate, not overengineered:** it requires (a) one new `QCReport`
field (§5.1) and (b) one new `threshold` shape variant reusing the existing
`QCFinding`/`QCCheck`/`QCReport` types — no new report type, no new aggregation logic, no
change to the `PASS/WARN/FAIL/UNKNOWN` semantics or worst-wins rule. A Plan-conformance
`QCCheck` sits in the same `checks: [QCCheck]` list as every existing technical-spec
check, aggregated by the same worst-wins rule, because it answers the same kind of
question ("does a measured fact meet a stated threshold") with a differently-sourced
threshold — not a different kind of question.

### 5.3 What execution-history awareness adds beyond the Artifact and the Plan

A third input, beyond the Artifact and the Plan step that produced it, is the
`ExecutionResult` that ran the Operation (`SPEC.md` §4: `status, tool_output,
duration_ms, retryable`). This matters for exactly one class of finding that neither the
Artifact nor the Plan alone can surface: **divergence between a reported success and a
measured reality** — an Operation whose `ExecutionResult.status = success` but whose
resulting Artifact fails a plan-conformance check. That divergence is itself worth
recording as a distinct fact (a Skill's own success report should not be taken as ground
truth about its output — `qc-skill` measuring the actual bytes is exactly why it exists),
but it does not require a new primitive: it is simply a plan-conformance `QCCheck`
finding a mismatch, cross-referenced (via `subject_artifact_id` → `produced_by.operation_id`)
against an `ExecutionResult` that claimed success. No new type is needed to express "the
tool said it worked and QC disagrees" — it falls directly out of §5.1's traversal plus
§5.2's check category.

## 6. What this document deliberately does not propose

- A QC engine that reasons about *why* a plan-conformance check failed — that is
  `Inference`/`Decision` territory (`CORE_PRIMITIVES.md` §5), owned by the Agent, not QC.
- Merging `qc-skill` and `media-analysis-skill` into one Skill. §4.2's conclusion is
  explicitly against this — the roles are different even where the measurement layer
  overlaps.
- A new report/finding/check type hierarchy for plan-conformance. §5.2 reuses the
  existing four types unchanged.
- Semantic subtitle QC (translation quality, speech-alignment correctness) — remains out
  of scope, unchanged from `qc-skill`'s current, deliberate boundary (§2).
