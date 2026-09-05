# Artifact Model

This document expands `SPEC.md` §2's `Artifact` shape into a full model: identity, types,
relationships, lifecycle, and caching. It is a direct generalization of
`video-production-agent`'s existing `Artifact` dataclass (`CORE_PRIMITIVES.md` §7),
cross-checked against `qc-skill`'s identity/cache design — the most rigorous provenance
implementation found anywhere in the ecosystem (`REPOSITORY_MAP.md`). As elsewhere in this
project: CURRENT means verified in code, PROPOSED means new, FUTURE marks a named,
deliberate gap, and nothing here builds infrastructure the evidence doesn't call for —
per the task brief's own framing, **this is not a blockchain**: there is no distributed
ledger, no consensus, no cryptographic chaining requirement beyond ordinary content
hashing. It is a typed record with a hash for an id, nothing more exotic.

## 1. Identity: content hash, never path or mtime

**CURRENT precedent, generalized.** `qc-skill`'s identity scheme —

```
identity = sha256(canonical_json({skill, skill_version, kind, operation,
  asset_fingerprints, effective_parameters, rules, ffmpeg_version, ffprobe_version}))
```

— explicitly excludes timestamps, paths, and request ids (`REPOSITORY_MAP.md`). This is
the model `Artifact.id` generalizes from (`SPEC.md` §2: "content hash, e.g. sha256 of
file bytes... never a path or mtime — this is not a new rule, it is qc-skill's
already-correct pattern").

Two Artifacts with identical content hash to the same value **are the same Artifact**,
regardless of where on disk they live, what they were called, or when they were written.
This is what makes cross-run caching (§5) and dedup possible without a central authority
deciding sameness — the hash decides it.

**Two things get hashed, and they answer different questions — do not conflate them:**

1. **Content identity** — a hash of the artifact's actual bytes (or, for structured
   artifacts like a `QCReport`, of its canonical JSON form). This answers "is this the
   same file/data I've seen before." This is `Artifact.id`.
2. **Provenance identity** — a hash of *how the artifact was produced* (skill, version,
   operation, effective parameters, inputs) — this is `qc-skill`'s `identity` field
   specifically, and it answers "would re-running this produce an equivalent result,"
   which is a different (though related) question from "is this file byte-identical to
   another." `SPEC.md`'s `Artifact.provenance` field is where this lives; it is **not**
   the same string as `Artifact.id`.

Conflating these two would mean two Artifacts with different content (say, a render that
picked up a nondeterministic timestamp overlay) could never be told apart from their
provenance, or conversely that a content-identical Artifact produced two different ways
could not be distinguished for provenance purposes. Keeping them as two separate fields —
as `qc-skill` and `video-production-agent` already do independently — avoids that.

**PROPOSED clarification:** for artifact types with a canonical serialization (JSON
documents: `qc_report`, `project_ir`, `subtitle_document`, `production_receipt`), the
content hash should be over the *canonical* (stable key ordering, no incidental
whitespace) form, exactly as `qc-skill`'s `canonical_json` already does — otherwise two
semantically identical documents could hash differently purely from formatting, which
would silently defeat the "same content, same id" guarantee this whole model depends on.
For binary media types (`video`, `audio`, `image`), the hash is simply over the file
bytes; there is no canonicalization question.

## 2. Artifact types: what exists vs. what's proposed

`SPEC.md` §2 lists: `video | audio | image | subtitle_document | project_ir | qc_report |
analysis_result | thumbnail | production_receipt | timeline`. Grounding each against
`REPOSITORY_MAP.md`:

| Type | Status | Where it exists / is produced |
|---|---|---|
| `video` | **CURRENT** | Output of `ffmpeg-skill`'s `cut`/`fit`/`join`/`export`/etc., and every Skill that delegates to it (`video-editing-skill`, `color-grading-skill`, `motion-graphics-skill`). |
| `audio` | **CURRENT** | Output of `audio-production-skill`'s typed operations, delegated through `ffmpeg-skill`. |
| `image` | **CURRENT** | Output of `thumbnail-skill`'s Pillow-based `render`, and `ffmpeg-skill`'s `look`/frame-extract path. |
| `subtitle_document` | **CURRENT** | `subtitle-skill`'s `generate` operation output — a validated `SubtitleDocument`/`SubtitleCue` structure, SRT/WebVTT serializable. Note: `subtitle-skill` does not itself do ASR; this artifact type is what sits between `transcription-skill`'s `Transcript` output and `subtitle-skill`'s `generate` input, per the Agent-mediated composition `REPOSITORY_MAP.md` documents. |
| `project_ir` | **CURRENT** | `video-production-agent`'s single versioned JSON IR document (`schemas/project.schema.json`), content-addressed via `ir_hash`. |
| `qc_report` | **CURRENT** | `qc-skill`'s `QCReport` (`SPEC.md` §5), unchanged. |
| `analysis_result` | **CURRENT** | `media-analysis-skill`'s observational outputs (`media_probe`, `silence`, `loudness`, `integrity`, `scene_detection`, `timing`, etc.) — note per `REPOSITORY_MAP.md` these overlap in substance, but not in schema, with some of `qc-skill`'s measurements; both would today be tagged `analysis_result`/`qc_report` respectively even where the underlying Capability id is shared (`measure.audio.loudness`), which is precisely the situation `CAPABILITY_MODEL.md`'s collision policy is designed to make visible rather than hide. |
| `thumbnail` | **CURRENT** | `thumbnail-skill`'s `render` output — arguably a specialization of `image`, kept as its own declared type because `thumbnail-skill` treats it as a distinct product (composed, not merely extracted) per `REPOSITORY_MAP.md`. |
| `production_receipt` | **PROPOSED** (`SPEC.md` §6) | Does not exist as a discrete artifact anywhere today; buildable from `qc-skill`'s identity scheme + `ProjectIR.provenance`, per `CORE_PRIMITIVES.md` §10. |
| `timeline` | **PROPOSED / FUTURE** | Does not exist as an edit-timeline artifact anywhere today. See `TIMELINE_MODEL.md` for the full treatment — this document's position (§6 below) is that when it exists, it is exactly an Artifact type like any other in this table, versioned and content-hashed the same way. |

**Also worth naming, not in `SPEC.md`'s list but real:** `transcription-skill` produces a
`Transcript` (segments, optional word timestamps) and `SpeechEvent` records
(`REPOSITORY_MAP.md`). These are not currently named in `SPEC.md`'s type enum. This
document treats that as an **open gap in the enum**, not evidence that transcripts aren't
Artifacts — a `Transcript` clearly fits this model's shape (content-hashable, produced by
an Operation, has a lifecycle) and should be added to the type list rather than shoehorned
into `analysis_result`, which per the table above already means something more
observational/measurement-shaped. Marked here as **FUTURE (naming/schema work)**, not
designed further in this document.

## 3. Parent / derived-from relationships — a real, named gap

**FUTURE.** `SPEC.md` §2 already flags this: `derived_from: [ArtifactId]` is "PROPOSED,
not found implemented anywhere yet." `REPOSITORY_MAP.md` confirms no audited repo
implements a derived-from/parent-artifact graph — `video-production-agent`'s `Artifact`
tracks `plan_id/plan_version` and `job_id/jobs`, which identify *which Plan and Job*
produced an artifact, but not an explicit graph edge from an output Artifact back to the
specific input Artifact(s) it was derived from.

This is a genuine gap worth being honest about rather than papering over: today, if you
have a graded, captioned export and want to know "what rough-cut was this graded from,
and what subtitle document was burned in," the answer is reconstructable only indirectly
— by cross-referencing the `ProjectIR`'s step history for the `plan_id`/`job_id` in
question, not by walking a direct Artifact-to-Artifact edge.

**What `derived_from` would add, once built:** for a given output Artifact, the exact set
of input Artifact ids consumed by the Operation that produced it — which is already
implicitly present as `Operation.argv_or_request`'s input references and the
`ProductionStep.inputs`/`outputs` fields (`SPEC.md` §3), just not yet denormalized onto
the Artifact record itself for direct traversal. This is a **PROPOSED, low-risk addition**
(it is a projection of information the Plan/Operation model already has, not a new source
of truth) — but it is not built anywhere today, and this document does not pretend
otherwise by describing traversal APIs, graph queries, or garbage-collection-by-reachability
schemes that would depend on it. Those would be reasonable follow-on design once
`derived_from` exists in even one implementation; inventing them now would be exactly the
"solve a problem nobody has evidence of yet" pattern `ARCHITECTURE.md` §9 lens 5 warns
against.

## 4. Producing-operation / producing-skill / producing-version tracking

**CURRENT**, already present in `video-production-agent`'s `Artifact` dataclass and
generalized in `SPEC.md` §2's `produced_by` field:

```
produced_by: { capability_id, provider_id, skill_id, skill_version, operation_id }
```

Per `SPEC.md`, this **generalizes** existing `plan_id`/`job_id` fields rather than
replacing them — `capability_id`/`provider_id` are the PROPOSED additions that make
Provider selection (`CAPABILITY_MODEL.md` §Collision policy) visible on the Artifact
itself, not just in the Plan that authorized the Operation. Concretely: given an Artifact
tagged `measure.audio.loudness` / `qc-skill` / `0.1.0`, it is now directly distinguishable
from an equivalent-Capability Artifact produced by `media-analysis-skill` instead — the
exact ambiguity `REPOSITORY_MAP.md` finding 2 identifies as currently invisible.

This tracking is what makes an Artifact **self-describing about its own reproducibility**
without needing to consult the Plan that produced it: `skill_version` alone tells you
whether re-running today's version of that Skill against the same inputs would even use
the same code path. Combined with `Operation.idempotency_key` (`EXECUTION_MODEL.md` §3),
this is the basis for cache-key computation (§5).

## 5. Lifecycle stage

**CURRENT, adopted as-is.** `working → candidate → approved → final → archive`
(`CORE_PRIMITIVES.md` §7, `SPEC.md` §2), unchanged from `video-production-agent`'s
existing `Artifact.stage` field. This document does not propose new stages or reorder
them — no evidence from the audit suggests the five-stage model is insufficient anywhere
in the ecosystem.

What each stage means, restated for clarity (interpretation, not new specification):

- **working** — the default stage for anything a completed Operation just produced. Not
  yet reviewed against QC or human judgment.
- **candidate** — has been through at least one verification pass (a `QCReport`
  attached, or explicit Agent/human review) and is being considered for promotion, but is
  not yet the accepted version.
- **approved** — a human or an Agent-mediated approval workflow (`REPOSITORY_MAP.md`:
  "human approve/reject workflow" already exists at the IR level) has accepted this
  Artifact as correct for its purpose.
- **final** — the delivered/exported version for a completed Plan; what a
  `ProductionReceipt` would reference as the Plan's actual output.
- **archive** — retained for provenance/history but no longer the active version for its
  logical role (e.g. superseded by a later revision of the same `Project`, per
  `CORE_PRIMITIVES.md` §11's Project/Plan distinction — a Project can accumulate multiple
  Plans over revisions, and an older Plan's `final` Artifact becomes `archive` once a
  newer Plan supersedes it).

**Stage transitions are not self-reported by a Skill.** A Skill's Operation always
produces an Artifact at `working` — promotion to `candidate`/`approved`/`final`/`archive`
is an Agent- or human-driven act, consistent with `ARCHITECTURE.md` §3's rule that a QC
`FAIL` is a fact, never an instruction, and by the same logic a QC `PASS` does not
self-promote an Artifact either. This mirrors the `plan_status`/`step_status`
"always derived, never set by hand" invariant already enforced at the Plan level
(`CORE_PRIMITIVES.md` §6) — the same discipline applied to the Artifact lifecycle.

## 6. Caching and artifact identity

**CURRENT precedent, generalized as a pattern, not yet a shared implementation.**
`qc-skill`'s cache (`REPOSITORY_MAP.md`) is the concrete, working model this section
generalizes:

- **File-based, sharded by hash prefix** — avoids one giant directory, a purely
  operational detail worth keeping as a reference default, not a hard requirement.
- **Atomic write** — a cache entry is never observably half-written.
- **Tamper detection** — "a cache hit is only honored if a stored result-hash still
  matches the recomputed hash of the cached report." This is the single most important
  property to generalize: a cache is only trustworthy if it re-verifies its own contents
  on every read, not just on write. A cache that trusts its own filesystem state
  unconditionally is one disk corruption or manual edit away from silently serving a
  wrong result.

**How this relates to Artifact identity (§1):** caching is possible *because* Artifact
identity is a content hash of reproducibility-relevant inputs, not because of any
cache-specific mechanism. The cache key **is** (a projection of) the provenance identity
described in §1 — `{skill, skill_version, operation, effective_parameters,
asset_fingerprints, ...}` for `qc-skill`'s case, or `{capability_id, provider_id,
skill_version, params, input_artifact_ids}` for the `idempotency_key` case described in
`EXECUTION_MODEL.md` §3.2. A cache hit means: "an Artifact with this exact provenance
identity already exists; return its content-identified Artifact rather than re-running
the Operation." This is not a new concept layered on top of the Artifact model — it falls
out of the model already having the right identity discipline.

**What's CURRENT vs. what's a proposed generalization:**

- **CURRENT:** `qc-skill`'s own file cache with tamper detection, scoped to `qc-skill`'s
  own reports.
- **CURRENT (narrower):** `ffmpeg-skill`'s `batch` tool declares `idempotency_hint:
  "cached"` — the only other caching behavior found anywhere in the ecosystem, and it is
  not tamper-checked the way `qc-skill`'s is (per `REPOSITORY_MAP.md`, no other tool in
  `ffmpeg-skill` caches at all).
- **PROPOSED:** a shared, OS-level caching *pattern* (not a shared *service* — no network,
  no central cache server; per `ARCHITECTURE.md` §10 this stays local-first) that any
  Skill or the Execution layer can apply uniformly: content-hash the provenance identity,
  check a local cache keyed by that hash with tamper re-verification on read, and skip
  recomputation on a verified hit. This is exactly `qc-skill`'s pattern lifted from "one
  Skill's internal cache" to "an OS-documented pattern every Skill and the Execution layer
  can apply the same way," analogous to how the Runtime contract lifts the convergent
  `FORBIDDEN_KEYS` pattern (`CORE_PRIMITIVES.md` §4). It is **not implemented** as a
  shared library anywhere today — this document names the pattern and its justification,
  it does not ship code.

**What this document deliberately does not add:** no cache invalidation protocol beyond
"tamper detection on read," no distributed/shared cache across machines, no
cache-eviction policy (disk space management is an operational concern, not an
architectural one at this scale), and — restating the section header's warning — no
blockchain, Merkle-tree-of-everything, or cryptographic proof-of-provenance beyond
straightforward content and provenance hashing. The ecosystem's actual need, evidenced by
`qc-skill`'s working implementation, is fully served by hash-keyed files with a
tamper-check on read.

## 7. Summary: the full Artifact record

Putting §§1–6 together, the practical shape a conformant Artifact record carries (restated
from `SPEC.md` §2 with this document's clarifications inlined):

```
Artifact {
  id: string                    // content hash of bytes/canonical-JSON — §1
  type: video | audio | image | subtitle_document | project_ir | qc_report
      | analysis_result | thumbnail | production_receipt | timeline   // §2
  logical_name: string
  stage: working | candidate | approved | final | archive             // §5, Agent/human-set only
  produced_by: { capability_id, provider_id, skill_id, skill_version, operation_id }  // §4
  derived_from: [ArtifactId]     // §3 — FUTURE, not implemented anywhere yet
  provenance: { ir_path, plan_hash, ir_hash, provenance_path, ... }    // provenance identity, distinct from `id` — §1
  created_at: timestamp
}
```

Nothing above is new relative to `SPEC.md` — this document's contribution is the
reasoning connecting each field to an already-verified pattern in the ecosystem (or, for
`derived_from`, an honest statement that no such pattern exists yet), and the caching
model that identity discipline enables.
