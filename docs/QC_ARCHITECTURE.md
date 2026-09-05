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

## 7. Creative Evaluation vs. Technical QC — kept strictly separate (ENTIRELY FUTURE/PROPOSED)

**Status: nothing in this section exists anywhere in the audited ecosystem today.**
Confirmed: `qc-skill` and `media-analysis-skill` are both purely technical/measurement —
neither has any code path, schema field, or doc reference to pacing, narrative, emotional
impact, visual consistency, brand fit, or subject emphasis. This section is written now,
before any such capability exists, specifically so that if one is ever built, it does not
get bolted onto the `QCReport` shape in a way that would need to be undone later.

**Technical QC** is everything in §1–§2 above: resolution, codec, fps, audio level/
clipping, black frame, freeze, subtitle timing, delivery spec conformance — deterministic,
measured, judged against a fixed or plan-derived threshold (§5.2). It is restated here
only by reference; nothing about it changes.

**Creative Evaluation** — pacing, narrative coherence, emotional impact, visual
consistency, brand fit, subject emphasis — is a fundamentally different kind of activity:
it requires judgment against a goal, not measurement against a threshold. A shot's
duration is a fact; whether that duration is "too slow for the piece" is a judgment, and
two competent editors can disagree about it without either being factually wrong.
Technical QC has no equivalent case: a LUFS reading is not a matter of editorial taste.

### 7.1 Why creative evaluation must never collapse into one scalar with technical QC

**Rule: a Creative Evaluation output MUST NOT be expressed as a single scalar "quality
score," and MUST NOT be averaged, blended, or otherwise merged with
`QCReport.overall_status` or any technical `QCFinding`.**

The reason is the same one §3 already established for QC itself, taken one step further.
§3's boundary is: QC measures and reports, it does not decide (`qc-skill`'s ADR-001,
restated by `ARCHITECTURE.md` §3). A single creative "quality score" averaged against
technical PASS/WARN/FAIL would violate that boundary twice over:

- It would **hide which dimension failed and why.** A blended score of, say, 0.71 out of
  1.0 tells nobody whether the piece is technically broken (clipped audio) or creatively
  slow (pacing) or both — the two problems have completely different remedies
  (re-normalize gain vs. re-cut a sequence), and a single number destroys exactly the
  information needed to choose between them. Every existing type in this hierarchy
  (`QCMeasurement → QCFinding → QCCheck → QCReport`) exists precisely to keep "what was
  measured, against what threshold, with what verdict" traceable — a scalar quality score
  is the collapse this whole hierarchy was built to prevent, reintroduced one level up.
- It would **smuggle a Decision into a Finding.** Per `CORE_PRIMITIVES.md` §5, judging
  whether something is *good enough to ship* — weighing a creative shortcoming against a
  deadline, an audience, a budget — is a `Decision`: it has a `basis`, a `risk`, an
  `approval` state, and mandatory cited `evidence`. A "quality score" that already encodes
  a pass/fail-shaped verdict about creative judgment is a Decision wearing a QC-shaped
  costume — it looks like a Finding (a QC report is usually accepted without further
  argument) but it has actually already made the judgment call a Decision is supposed to
  make, without `basis`, `approval`, or `risk` ever being recorded. This is precisely the
  "QC silently decides" failure mode `ARCHITECTURE.md` §3 and this document's §3 already
  rule out for technical QC; a scalar creative score would reintroduce it through a side
  door, made more plausible only because it is more subjective.

### 7.2 What a future creative-evaluation capability should produce instead

If a future Skill or Agent capability performs creative evaluation, its output should be
a set of **separate, named Findings-with-evidence** — not a `QCReport`, and never merged
into `PASS/WARN/FAIL/UNKNOWN`. For example:

```
{
  dimension: "pacing",
  evidence: [{ shot_id: "shot_012", duration_s: 4.2 }, { shot_id: "shot_013", duration_s: 6.8 }],
  inference: "shot_013 may be slower than the surrounding cutting rhythm suggests",
  confidence: "low"
  // explicitly NOT a verdict, NOT a score, NOT PASS/WARN/FAIL
}
```

This shape is deliberately closer to `CORE_PRIMITIVES.md` §5's `Inference` (an
interpretation that must cite evidence, and is not itself an executable verdict) than to a
`QCFinding` (a measurement judged against a stated threshold) — creative evaluation has no
fixed threshold to judge against, only a cited basis for an interpretation. Such Findings
become **input to an Agent Decision** (with its own `basis`, `risk`, `approval`, and
mandatory `evidence` drawn from — but not identical to — the creative Findings), exactly
the way a technical `QCReport` already becomes evidence for a Decision today (§3, §8
below). It is never itself a `QCReport`, and it is never aggregated with one — a Plan may
have both a technical `QCCheck` list and a separate set of creative Findings feeding the
same downstream Decision, but the two remain two distinct evidentiary inputs, never one
number.

## 8. The QC/Verification feedback loop: Accept vs. Replan

This section does not introduce a new mechanism. `CORE_PRIMITIVES.md` §5 already allows a
`Decision` to cite `QCFinding`/`QCReport` evidence, and `ARCHITECTURE.md` §3 and this
document's §3 already establish that a QC verdict is a fact an Agent Decision acts on,
never an instruction QC issues itself. What follows makes the loop those existing types
already support explicit, end to end, because no single document currently states it as
one continuous path.

**The loop:**

```
Plan -> Execute -> Artifact -> QC (QCReport)
                                   |
                                   v
                     Agent Decision: ACCEPT or REPLAN
                     (QCReport used as evidence, per CORE_PRIMITIVES.md §5)
                                   |
                        +----------+----------+
                        |                     |
                     ACCEPT                REPLAN
                        |                     |
                  Artifact stage        revised ProductionPlan
                  may advance           (new plan_hash, same Project —
                  (Agent/human-         the revision/ADR-034 pattern,
                  driven, per           CORE_PRIMITIVES.md §11's
                  ARTIFACT_MODEL.md)    Project/Plan distinction)
                                               |
                                               v
                                   re-execute only the affected
                                   Operations (incremental
                                   production — EXECUTION_MODEL.md)
```

- **ACCEPT**: the Agent Decision treats the `QCReport` (whatever its `overall_status`) as
  sufficient to proceed — this includes accepting a `WARN`, or even a documented `FAIL`,
  as a known, approved limitation. This is an ordinary Decision like any other in
  `CORE_PRIMITIVES.md` §5: it has a `basis`, a `risk`, and an `approval` state, and it
  cites the `QCReport` as evidence.
- **REPLAN**: the Agent Decision instead authorizes a **revised** `ProductionPlan` for the
  same `Project` — not a mutation of the existing Plan. Per `CORE_PRIMITIVES.md` §11, a
  Project can accumulate multiple Plans over revisions (the `revision.md`/ADR-034 pattern
  already present in `video-production-agent`); a REPLAN produces a new Plan with a new
  `plan_hash`, authorized by this Decision, targeting the same Project.
- **Re-execution is incremental, not a full re-render.** Per the DAG shape
  (`CORE_PRIMITIVES.md` §6, `ARCHITECTURE.md` §6), a revised Plan need not re-run every
  Operation — only the Operations affected by whatever changed (a re-cut shot, a
  re-normalized audio pass) need re-execution; unaffected upstream Artifacts are reused.
  This property is fully specified in `EXECUTION_MODEL.md`'s incremental-production
  model — this document only names that the QC/Decision loop is one of the things that
  triggers it, not a redefinition of the mechanism itself.

**What this section restates as non-negotiable, because it is the entire point of the
loop:** QC **never** triggers a re-render, a replan, or any other execution step by
itself. `qc-skill`'s own ADR-001 and this document's §3 already make this the ecosystem's
existing rule for technical QC; §7 extends the same rule to any future creative
evaluation. A `QCReport` — technical or (per §7) a set of creative Findings — is always
and only **evidence**. The Agent Decision, with its own recorded `basis` and `approval`,
is what decides ACCEPT or REPLAN; nothing about this loop changes that division, it only
makes explicit that the loop is a closed cycle back to a revised Plan on the same Project,
rather than a one-shot check with no formalized path back.

## 9. Verification State: rejecting a proposed six-state enum (PROPOSED — REJECTED)

**The proposal under review:** a stakeholder proposed introducing a new "Verification
State" enum — `UNVERIFIED | PASS | PASS_WITH_WARNINGS | FAIL | BLOCKED | UNKNOWN` — as a
separate, parallel piece of state tracked alongside `QCStatus`.

**This document rejects introducing that enum.** Adding a second state machine that
describes "was this verified, and how did it go" alongside `qc-skill`'s existing
`QCStatus` (`PASS | WARN | FAIL | UNKNOWN`, §1) would create **two sources of truth for
the same underlying facts** — every one of the six proposed states already has an
unambiguous existing representation, and the new enum would need to be kept in sync with
`QCStatus` forever, for no additional expressive power:

- **`UNVERIFIED`** — already representable as simply having no `QCReport` for an Artifact
  yet. Where a report does exist but ran zero checks, §1 already specifies
  `overall_status` defaults to `UNKNOWN` by design ("never a silent `PASS`") — this is the
  existing state the proposed `UNVERIFIED` would duplicate.
- **`PASS`**, **`FAIL`**, **`UNKNOWN`** — identical to the three same-named `QCStatus`
  values already in §1. No new meaning is added by restating them under a different enum
  name.
- **`PASS_WITH_WARNINGS`** — already exactly what `QCStatus.WARN` means under worst-wins
  aggregation (§1): at least one `QCFinding` was judged `WARN` and none was worse, so the
  overall verdict is `WARN` rather than a clean `PASS`. Introducing a differently-named
  state here would only rename an existing value, not add one.
- **`BLOCKED`** — already exists, at the correct layer, as a `Decision.type` value
  (`CORE_PRIMITIVES.md` §5: `KEEP/REMOVE/TRANSFORM/DELIVER/SKIP/REVIEW/BLOCK`). A Plan
  step awaiting a `BLOCK`-type Decision is blocked at the **Decision/Plan** layer, not the
  **QC** layer — QC has not "found" a block, an Agent has decided to block pending
  something else (often, but not only, a QC result). Giving QC its own `BLOCKED` verdict
  would mean two different parts of the system could independently claim authority over
  the same fact, which is exactly the two-sources-of-truth problem this rejection exists
  to avoid.

**Recommendation: add nothing.** Reuse `QCStatus` for verification facts and
`Decision.type` for Plan-level blocking, exactly as both already exist. This is simpler,
and it avoids a maintenance and consistency burden between two enums that would otherwise
need to be kept in permanent lockstep — the same "don't invent a fourth noun without a
concrete job for it" discipline `ARCHITECTURE.md` §9 (lens 1) already applied to the
Capability/Skill/Provider/Runtime split applies here in the opposite direction: where that
split earned its keep by fixing a real, found bug, this six-state enum fixes nothing that
`QCStatus` and `Decision.type` do not already fix, so it is not adopted.
