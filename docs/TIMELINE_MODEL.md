# Timeline Model

This document does three things: (a) documents a real naming collision found in the
audit so nobody confuses two unrelated concepts that happen to share a name, (b) proposes
— clearly marked FUTURE/PROPOSED — an edit-Timeline primitive modeled on OpenTimelineIO's
clip/track/transition/marker shape, and (c) answers the placement question `CORE_PRIMITIVES.md`
§8 defers to this document: is Timeline an OS-core primitive, an IR, or an Artifact type?

Everything in this document beyond §1 is **FUTURE** unless stated otherwise. No edit-timeline
primitive exists anywhere in the audited ecosystem today (`REPOSITORY_MAP.md`,
`CORE_PRIMITIVES.md` §8).

## 1. The naming collision (CURRENT — a real, present fact, not hypothetical)

`video-production-agent` already has a module named `temporal/timeline.py`. Per
`CORE_PRIMITIVES.md` §8, this module "models event history over wall-clock/media time
(which event kinds are 'active' in a time range — a session/observability concept)." It
answers questions like *"was a silence-detection event active between 00:31 and 00:34"*
or *"what Observations/Decisions were in flight during this window"* — it is fundamentally
about **when things happened during agent execution/observation**, not about what an
edited video looks like.

This document calls this existing thing the **Event Timeline** (also acceptable:
`temporal timeline`, matching its module path). It is explicitly **out of this
document's scope** — it is not renamed, not restructured, not touched. It is named here
only so the term "Timeline" used for the rest of this document is never confused with it.

The thing this document is actually about — clips, tracks, transitions, captions, markers
arranged along an edited sequence's duration, in the shape of Avid/Premiere/Resolve/
OpenTimelineIO's domain model — **does not exist under any name in the audited ecosystem
today.** This document proposes calling it, simply, **Timeline** (capitalized, to
distinguish it in prose from the lowercase "event timeline" and from generic uses of the
word "timeline" in everyday English). Going forward in this project's documents:

- **"Event Timeline" / `temporal/timeline.py`** = the existing observability concept.
  CURRENT. Unchanged. Not this document.
- **"Timeline"** = the proposed edit-timeline domain model. FUTURE. This document.

If a future implementation needs both concepts to coexist in one codebase, they must use
visibly different type names (e.g. `EventTimeline` vs. `Timeline`, or a module path that
keeps `temporal.*` separate from wherever the edit-Timeline lands) — the collision found
in `video-production-agent`'s own source between `SkillPackage`/`SkillSpec`
(`CAPABILITY_MODEL.md`) is direct evidence that "same English word, two meanings, no
naming discipline" is a mistake this ecosystem has already made once. This document
exists specifically so it is not made twice.

## 2. What's known and unknown about the Project IR's existing `timeline` section

`video-production-agent`'s `ProjectIR` schema (`schemas/project.schema.json`, 1851 lines)
has a section named `timeline`. Per `CORE_PRIMITIVES.md` §8: *"the Project IR's `timeline`
section... is the closest thing [to an edit timeline], but it has not been audited in
enough depth to know how close."*

This document does not go further than that. Specifically marked **UNKNOWN**, not
assumed either way:

- Whether the IR's `timeline` section already has clip/track structure resembling §3
  below, or is a much thinner representation (e.g. just an ordered list of step outputs).
- Whether it has any notion of transitions, overlapping tracks, or markers at all.
- Whether it is even indexed by time, or is closer to a plain sequence-of-operations
  record (which would make its name a second, milder instance of the same
  naming-collision risk called out in §1 — sharing a word with both the Event Timeline
  and this document's proposed edit-Timeline without being either).

**What this means for the proposal below:** §3 is not a claim about what the IR's
`timeline` section currently contains, and it should not be read as a redesign of that
section. It is a from-scratch design grounded in external prior art (OpenTimelineIO),
offered as the target shape for a *future*, explicitly-named edit-Timeline. Reconciling
it with whatever the IR's existing `timeline` section actually holds is real,
necessary future work (a direct code audit of `schemas/project.schema.json`'s `timeline`
definition) that this document does not perform and does not fabricate an answer for.

## 3. Proposed edit-Timeline shape (FUTURE, modeled on OpenTimelineIO)

**Prior art basis:** OpenTimelineIO (OTIO) is a real, verified project — an Academy
Software Foundation open-source interchange format for editorial timeline data, with a
JSON-based schema and adapters for professional NLE formats (Final Cut Pro XML, AAF, CMX
EDL, among others). It is cited here as validated prior art per `CORE_PRIMITIVES.md` §8's
own instruction ("modeled after OpenTimelineIO's clip/track/transition/marker shape...
rather than invented from scratch"), not as something this ecosystem currently depends on
or implements any part of.

The proposed shape, deliberately kept close to OTIO's own core concepts rather than
inventing new ones:

```
Timeline {                                  // PROPOSED — an Artifact, see §6
  id: string                                 // content hash — same identity rule as any Artifact (ARTIFACT_MODEL.md §1)
  global_start_time: Timecode | null          // OTIO concept: where timeline-zero sits against source media time
  tracks: [
    Track {
      id: string
      kind: video | audio | caption | overlay   // OTIO's "kind" concept, extended with the two ecosystem-specific
                                                  // kinds this project actually needs (caption, overlay) —
                                                  // see §4 for why overlay/caption get their own track kind
      items: [
        Clip {
          id: string
          source_artifact_id: ArtifactId          // points at a video/audio/image Artifact (ARTIFACT_MODEL.md §2) —
                                                    // NOT a raw file path, consistent with this project's
                                                    // content-hash-identity rule everywhere else
          source_range: { start: Timecode, duration: Timecode }
          transition_in: Transition | null
          transition_out: Transition | null
        }
        | Gap { duration: Timecode }               // OTIO concept: explicit empty space, not an absence of data
        | Transition { kind: string, duration: Timecode }
      ]
    }, ...
  ]
  markers: [
    Marker { time: Timecode, name: string, color: string | null, metadata: object }
  ]
}
```

Notes on deliberate choices:

- **`source_artifact_id`, not a path.** Every reference from a Timeline into actual media
  is an `ArtifactId` (`ARTIFACT_MODEL.md`), so a Timeline is reproducible and
  content-addressed the same way everything else in this system is — a Timeline that
  pointed at filesystem paths would break this project's one consistent identity rule
  for no benefit.
- **`Gap` as an explicit item**, not merely absence of a clip in a time range — this is a
  direct OTIO concept, and it matters because "no clip here" and "an intentional
  half-second of black" need to be distinguishable when multiple Skills are editing the
  same Timeline (§4).
- **`caption` and `overlay` as track kinds**, beyond OTIO's typical `video`/`audio` split
  — added because this ecosystem specifically has `subtitle-skill` and
  `motion-graphics-skill` as independent Skills that each need a well-defined place to
  put their output without colliding with the primary video/audio tracks. This is the one
  place this proposal extends OTIO's shape rather than copying it exactly, and it is
  extended for a concrete, named reason (§4), not speculatively.
- **No mandated on-disk serialization format.** OTIO's own `.otio` JSON format is a
  reasonable default to converge on given it already has FCP XML/AAF/CMX EDL adapters
  (useful if this ecosystem ever needs to hand a Timeline to a professional NLE), but
  this document does not mandate adopting OTIO's Python library or exact schema
  verbatim — only its conceptual shape. Adopting the literal OTIO library/schema instead
  of merely its shape is a real option worth evaluating when this is actually built, not
  decided here.

## 4. How multiple Skills read/modify a shared Timeline without corrupting each other

The scenario named directly: `video-editing-skill` produces cuts, `motion-graphics-skill`
adds overlays, `subtitle-skill` adds captions — three independent Skills, one shared
Timeline. This is exactly the kind of composability problem `ARCHITECTURE.md` §6 already
has a general answer for, applied here specifically:

### 4.1 The Plan/DAG already prevents concurrent mutation

Per `EXECUTION_MODEL.md` §2.2, execution is **strictly sequential** — one Operation runs
to completion before the next begins. This means, by construction, **no two Skills ever
write to a Timeline at the same instant.** There is no need for locking, optimistic
concurrency control, or a merge algorithm for simultaneous writes, because simultaneous
writes do not happen anywhere in this execution model. This is not a Timeline-specific
guarantee — it is the general Execution Model guarantee, and the Timeline case is simply
one more instance where it matters.

### 4.2 Each write is a new Artifact, not an in-place mutation

Per `ARTIFACT_MODEL.md` §1, an Artifact's identity is a content hash — Artifacts are
**immutable once produced**. A Skill that "modifies" a Timeline does not edit it in
place; it consumes one Timeline Artifact as input and produces a **new** Timeline
Artifact as output, related to the input via `derived_from` (`ARTIFACT_MODEL.md` §3 —
itself a named FUTURE gap, which applies here identically: today this derivation would
only be reconstructable via the Plan/step history, not a direct edge, until
`derived_from` is built).

Concretely, the three-Skill scenario becomes a linear (or DAG-shaped, per
`ARCHITECTURE.md` §6) chain of Timeline Artifacts:

```
Timeline_v0  --[video-editing-skill: cut]-->      Timeline_v1
Timeline_v1  --[subtitle-skill: add captions]-->  Timeline_v2
Timeline_v2  --[motion-graphics-skill: overlay]--> Timeline_v3
```

Each arrow is one `Operation` (`SPEC.md` §4) whose declared `inputs` includes the prior
Timeline Artifact and whose declared `outputs` is the next one. **Corruption in the sense
of "one Skill's change silently clobbers another's" is structurally impossible under this
model**, because there is never a single mutable Timeline object two Skills could race to
write — there is only ever a sequence of distinct, content-addressed, immutable
Timeline Artifacts, and the Plan's DAG (not any locking primitive) determines their order.

### 4.3 What each Skill is actually allowed to touch

This still leaves a real design question this document should not paper over: what stops
`subtitle-skill`'s Operation from also rewriting a video track's clip list, which is
outside its declared domain? Two answers, at different layers:

- **Capability Contract scoping (PROPOSED, generalizing an existing pattern).** Per
  `SPEC.md` §1, a Capability declares its `input_artifact_types`/`output_artifact_types`.
  A Capability like `subtitle.burn-in`-onto-Timeline (a **new, currently nonexistent
  Capability** this document is naming, not one that exists today) would declare that it
  reads a `timeline` Artifact and writes a `timeline` Artifact — but the Contract format
  as specified in `SPEC.md` has no field yet for constraining *which parts* of a
  structured Artifact a Capability is allowed to change (e.g. "may add to the `caption`
  track, may not alter `video` tracks"). This is a **real, named gap**, not solved by
  anything existing today. It could be solved with a schema-level convention (a Capability
  that only ever adds caption-track items and never touches other tracks, verified by
  a post-condition check rather than an enforced write-permission system) rather than
  a new access-control mechanism — but this document does not pick a specific mechanism
  here; it names the gap so it is not silently assumed solved.
- **Verification, not prevention, is the model's actual enforcement mechanism today.**
  Consistent with `ARCHITECTURE.md` §3 ("the OS never makes a production decision... a QC
  FAIL is a fact, not an instruction"), the realistic answer for now is: nothing at the
  execution layer *prevents* a misbehaving Skill from producing a Timeline Artifact that
  changed more than its Capability contract implied, but the Plan's declared
  `inputs`/`outputs` per step, combined with each Timeline Artifact being independently
  diffable (since both the before/after are immutable, hashed, structured documents), 
  make such a change **detectable after the fact** — an Agent or a QC-style check could
  diff `Timeline_v1` against `Timeline_v2` and flag "subtitle-skill's Operation also
  altered the video track" as a verification finding, the same way any other
  QCReport/Finding is a fact about an Artifact, not an in-band block. Building that
  specific diff-based verification is **FUTURE work**, not designed further here — it is
  named as the direction consistent with everything else in this project's verification
  philosophy, not as a shipped mechanism.

## 5. Multiple derivations from one base Timeline (branching, not just chaining)

The chain in §4.2 is the simple case. A more realistic Plan DAG might have
`motion-graphics-skill` and `subtitle-skill` both branch from the **same** `Timeline_v1`
independently (rather than one depending on the other's output), because their edits
don't logically depend on each other:

```
                    +--[subtitle-skill: captions]--> Timeline_v2a
Timeline_v1 --------|
                    +--[motion-graphics-skill: overlay]--> Timeline_v2b
```

This is exactly the DAG-not-pipeline point `ARCHITECTURE.md` §6 already makes generally —
the Timeline case does not need a different answer, only an acknowledgment that
**producing two divergent Timeline Artifacts from the same input is a normal, expected
outcome of this model, not an error.** What is genuinely unresolved, and named here as
**FUTURE, unsolved work, not fabricated as already handled:** if a later step in the Plan
needs a Timeline that has *both* the captions and the overlay, something must merge
`Timeline_v2a` and `Timeline_v2b` into a `Timeline_v3` — and no merge algorithm for two
independently-derived edit-Timelines is proposed by this document. This is a real,
nontrivial problem (OTIO itself does not solve concurrent-edit merging as a general
problem; professional NLEs mostly avoid it by having one editor own one timeline at a
time) and this document is explicit that it is **not solved here**. The practical
workaround available today, without inventing a merge algorithm, is Plan design
discipline: sequence dependent Timeline-mutating steps rather than branching them when
their outputs must later combine — i.e., prefer the §4.2 chain shape over the branching
shape above whenever two Skills' Timeline edits need to end up in the same place. This is
a Plan-authoring constraint, not an OS-enforced rule, and it is named as a real limitation
of this proposal rather than glossed over.

## 6. Is Timeline an OS-core primitive, an IR, or an Artifact type?

**Recommendation: Timeline is an Artifact type** (as `SPEC.md` §2 already lists it),
**not** a special OS-core "running state" object, and not a second, competing IR
alongside the `ProjectIR`.

**Argument, against the project's own stated principle of not building distributed-system
machinery without evidence of need:**

1. **Everything a Timeline needs already exists on the Artifact model.** Content-hash
   identity (§1 above and `ARTIFACT_MODEL.md` §1), a lifecycle stage
   (`working`→...→`final`, `ARTIFACT_MODEL.md` §5 — a Timeline under active editing is
   naturally `working`; one accepted for final render is `approved`/`final`), a producing
   Operation/Skill/version (`ARTIFACT_MODEL.md` §4), and — once built — `derived_from`
   links (§4.2 above) are exactly the facts a Timeline needs recorded. Making Timeline an
   OS-core primitive instead would require inventing a **second** identity/lifecycle/
   provenance scheme in parallel with the Artifact model's, for no functional gain — this
   is precisely the "fourth noun where three would do" failure mode `ARCHITECTURE.md` §9
   lens 1 already rejected once (for Capability/Skill/Provider/Runtime, where the fourth
   noun *was* justified by a concrete found bug). Timeline has no equivalent found bug
   that only a new OS-core primitive category could fix.
2. **"OS-core running state" implies mutable, in-memory, coordinator-owned state — and
   this ecosystem has no coordinator to own it.** Per `ARCHITECTURE.md` §8/§10 and
   `EXECUTION_MODEL.md` §0, there is no scheduler, no daemon, no long-lived service in
   this architecture; a CLI process is a sufficient coordinator for everything the
   ecosystem does today. An "OS-core running state" object is a concept that belongs to
   systems with a stateful runtime service — this one deliberately has none. Treating
   Timeline as mutable core state would be inventing exactly the kind of always-on,
   centrally-coordinated object this project has repeatedly declined to build elsewhere
   (§0 of `EXECUTION_MODEL.md`; §10 of `ARCHITECTURE.md`), for a domain object that does
   not need it — §4.2 already shows the immutable-Artifact-chain model handles concurrent
   Skill contributions correctly without any mutable shared state at all.
3. **It is not a second IR either.** The `ProjectIR` (`CORE_PRIMITIVES.md`) is the
   single versioned document describing an entire Project's state — plan history,
   approvals, provenance dict, and (per §2 above, UNKNOWNly) some existing `timeline`
   section. Elevating the proposed edit-Timeline to IR status would mean two documents
   both claiming to be the authoritative description of "the project," which invites
   exactly the kind of drift/duplication `REPOSITORY_MAP.md` finding 2 already caught
   once between `qc-skill` and `media-analysis-skill` (two things independently claiming
   overlapping authority with no registry to reconcile them). An Artifact, by contrast,
   is inherently *referenced by* the IR (the IR's `timeline` section, once reconciled per
   §2, would plausibly hold a reference — an `ArtifactId` — to the current Timeline
   Artifact, the same way it would reference any other Artifact) rather than competing
   with it for authority.
4. **Versioning naturally becomes Artifact versioning, which already exists.** A Timeline
   that changes over the course of editing is not a special "Timeline versioning" problem
   — it is the ordinary Artifact-chain-via-`derived_from` pattern (§4.2), identical in
   kind to how a graded master Artifact relates to its ungraded source. No new versioning
   concept is needed.

**What this recommendation does not claim:** it does not claim the OTIO-shaped structure
in §3 is validated by any implementation in this ecosystem — it is a from-scratch,
FUTURE proposal grounded in external prior art, exactly as `CORE_PRIMITIVES.md` §8
instructed. It also does not claim the `ProjectIR`'s existing `timeline` section is
already this shape, or that reconciling the two will be trivial — that reconciliation is
named explicitly in §2 as unstarted, evidence-requiring work.

## 7. Summary

- **Event Timeline** (`temporal/timeline.py`) — CURRENT, unrelated, out of scope, never
  to be confused with the following.
- **Timeline** (edit-timeline: clips/tracks/transitions/markers) — FUTURE, does not exist
  today anywhere in the ecosystem, proposed here modeled on OpenTimelineIO's shape.
- **Project IR's existing `timeline` section** — UNKNOWN how close it already is to the
  §3 shape; not audited in this document, not assumed either way.
- **Multi-Skill editing of a shared Timeline** — handled by the existing immutable-
  Artifact + sequential-execution model (`ARTIFACT_MODEL.md` §1, `EXECUTION_MODEL.md`
  §2.2), not by any new locking or merge mechanism; branching/merging of independently-
  derived Timeline Artifacts is a real, named, currently-unsolved problem (§5), worked
  around today only by Plan-authoring discipline.
- **Placement:** Timeline is an **Artifact type**, versioned and content-hashed like any
  other Artifact — not an OS-core primitive and not a competing IR — because the Artifact
  model already supplies everything a Timeline needs, and inventing a stateful "OS-core
  running state" object for it would be exactly the unjustified distributed-system
  machinery this project's own principles argue against building without evidence of
  need.
