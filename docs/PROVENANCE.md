# Provenance and Reproducibility

This document specifies what the OS records about *how an Artifact came to exist* and
what "reproducible" means in this ecosystem. It is not a new invention: it generalizes
two schemes that already exist and already agree with each other — `qc-skill`'s
content-addressed `identity` scheme and `video-production-agent`'s `ProjectIR.provenance`
dict — into one OS-wide contract. Where this document proposes something new (chiefly
`ProductionReceipt`), that is marked explicitly; nothing here overrides
`REPOSITORY_MAP.md`'s evidence.

## 1. What already exists (CURRENT)

**`qc-skill`'s identity scheme** — the cleanest reproducibility design found anywhere in
the audit:

```
identity = sha256(canonical_json({
  skill, skill_version, kind, operation,
  asset_fingerprints, effective_parameters, rules,
  ffmpeg_version, ffprobe_version
}))
```

Three design choices here matter and are adopted as-is, not just the shape:

- It hashes **inputs and configuration**, not outputs — two runs with the same skill
  version, same asset fingerprints, same effective parameters, same rules, and same tool
  versions must produce the same identity, regardless of when or where they ran.
- It **explicitly excludes** timestamps, paths, and `request_id`. This is the whole
  point: identity is a fact about *what would happen*, not a log line about *when it
  happened*. A path is an accident of a particular filesystem layout; a timestamp is an
  accident of when someone pressed the button. Neither belongs in a reproducibility key.
- It uses `effective_parameters`, not the caller's raw request — defaults, resolved
  paths-as-fingerprints, and normalization already applied. Two calls that differ only in
  which optional flags were left implicit still hash identically if they resolve to the
  same effective configuration.

`qc-skill`'s cache (sharded by hash prefix, atomic write, **tamper detection** — a cache
hit is only honored if the stored result-hash still matches a recomputed hash of the
cached report) is a direct, working consequence of taking this identity scheme
seriously: reproducibility isn't just a claim, it's load-bearing infrastructure the skill
actually depends on for correctness, not merely performance.

**`video-production-agent`'s `ProjectIR.provenance` dict** — the broader, whole-project
version of the same idea:

```
provenance: {
  source_hashes, profile_version, skill_versions, tool_versions,
  ai_calls, recovery, runs, plan_hash, ir_hash
}
```

and, per-`Artifact`: `hash`, `plan_id/plan_version`, `job_id/jobs`, `stage`
(working→candidate→approved→final→archive), and a `provenance` dict of `ir_path,
plan_hash, ir_hash, provenance_path`. `REPOSITORY_MAP.md` confirms cache-hit provenance is
explicitly eval-tested, not just declared in a schema.

**The honest gap in the existing ecosystem:** `ffmpeg-skill` reports the exact command
line(s) executed and a probe of the output *in its response*, but persists nothing as a
sidecar/manifest next to the output file recording tool version + full parameters.
Provenance exists in the response, not on disk (`REPOSITORY_MAP.md`, `ffmpeg-skill`
section). This is exactly the gap `ProjectIR.provenance` closes at the Agent level today
— but only for Agent-orchestrated runs. A Skill invoked directly (CLI, by a human, by a
different Agent) produces no persisted provenance record at all under the current
ecosystem. That is a real, present limitation this document's recommendation (§3) is
designed to close without inventing new infrastructure.

## 2. Minimum information required for reproducibility

Given the two schemes above, the minimum information needed to answer "could this exact
result be reproduced, and if not, why not" is already fully enumerable from fields that
already exist somewhere in the ecosystem — nothing below is invented for this document:

| Field | Source pattern | Why it's required |
|---|---|---|
| Source artifact hash(es) | `qc-skill`'s `asset_fingerprints`; `ProjectIR.provenance.source_hashes` | Inputs are content-addressed, never path/mtime-addressed (per `CORE_PRIMITIVES.md` §7) — a rerun must start from bit-identical inputs to mean anything. |
| Capability id + Provider id | `CAPABILITY_MODEL.md` | Which accomplishable thing, by which concrete implementation. Two Providers of `measure.audio.loudness` are not interchangeable for reproducibility purposes even though they answer the same Capability. |
| Skill id + Skill version | `qc-skill`'s `skill`/`skill_version`; `ProjectIR.provenance.skill_versions` | Ties the run to an exact release of the code that ran. |
| `contract_version` | `ffmpeg-skill`'s two-axis versioning | A `skill_version` bump with the same `contract_version` should not change reproducibility semantics; a `contract_version` bump might. Both axes matter (see `VERSIONING.md`). |
| Effective parameters | `qc-skill`'s `effective_parameters` | Post-default, post-normalization — the actual configuration, not the caller's shorthand for it. |
| ProductionPlan id + `plan_hash` | `ProjectIR.provenance.plan_hash`; `SPEC.md` §3 | Which approved course of action authorized this Operation, and a hash proving the Plan itself wasn't silently edited after approval. |
| IR id + `ir_hash` | `ProjectIR.provenance.ir_hash` | Which version of the whole project document this ran against. |
| Tool versions | `qc-skill`'s `ffmpeg_version`/`ffprobe_version`; `ProjectIR.provenance.tool_versions` | The single most concrete, evidence-backed field in the whole scheme — every audited Skill delegates to `ffmpeg`/`ffprobe` binaries whose exact version genuinely changes output (filter behavior, codec defaults, bug fixes). |
| Rules/thresholds (QC only) | `qc-skill`'s `rules` | A QC verdict is only reproducible if the rule set it was judged against is also pinned. |

**What is deliberately left as an open gap, not invented here:** "environment" (OS,
kernel, CPU architecture, locale, installed codec libraries beyond ffmpeg/ffprobe
themselves) is not captured by any existing scheme in the audit. `ffmpeg_version` and
`ffprobe_version` are the only environment-adjacent fields any repo actually records.
Whether finer-grained environment capture (e.g. full `ffmpeg -version` build config,
which affects available filters/codecs) is worth the overhead is an open question — see
§5. This document does not invent an environment-fingerprinting scheme with no evidence
of need.

## 3. Where should provenance live: embedded metadata, sidecar, database, or manifest?

**Recommendation: the existing pattern — a provenance dict traveling with the Artifact
(as `ProjectIR.provenance` does today) and, per Operation, a Skill's own `--json`
response captured verbatim as `tool_output` (per `SPEC.md` §4's `ExecutionResult`).** No
new storage mechanism is introduced. Specifically, ranked against the alternatives:

- **A database** — rejected. `REPOSITORY_MAP.md` lists a database explicitly among what
  `video-production-agent` does **not** implement, and no repository anywhere in the
  11-repo ecosystem persists state in one. Introducing a database purely for provenance
  would be new, unevidenced infrastructure with no prior art in this ecosystem to build
  on — exactly the kind of architecture astronautics this project's rules forbid.
- **Embedded file metadata** (e.g. writing provenance into a video container's own
  metadata atoms, EXIF-equivalent for media) — rejected. No audited Skill does this
  anywhere; every Skill's provenance-adjacent output is a structured JSON response or
  document field, never embedded into the media file itself. Embedding also couples
  provenance to a specific container format's metadata capacity (some outputs, e.g. a raw
  SRT file, have no metadata slot to embed into at all — `subtitle-skill`'s outputs are
  plain text formats).
- **Sidecar JSON / the existing `provenance` dict pattern** — **recommended**, because it
  is what already exists and already works: `ProjectIR.provenance` is exactly a
  structured document traveling alongside the Artifacts it describes, and `qc-skill`'s
  identity/cache files are exactly sidecar JSON, sharded on disk. This generalizes with
  zero new mechanism: every Artifact's `provenance` field (per `SPEC.md` §2) *is* the
  sidecar, whether it is physically a separate `.provenance.json` file next to the media
  file (for a Skill invoked outside the Agent) or a field inside the Project IR document
  (for an Agent-orchestrated run). Both are the same shape; only the container differs.
- **A manifest** (one file enumerating everything a Plan produced) — this is not a
  fourth option, it is what `ProductionReceipt` (§4) already is. Keeping "sidecar
  provenance per Artifact" and "one receipt per completed Plan" as two levels of the same
  pattern (fine-grained + roll-up) avoids inventing a separate manifest concept on top.

**The one gap this recommendation closes that the current ecosystem has not closed:**
`ffmpeg-skill`'s command line + output probe should be persisted as a sidecar next to its
output artifact even when invoked outside `video-production-agent` (directly via CLI or
MCP), not only captured in the JSON response and then discarded by whichever caller
doesn't happen to save it. This is a direct, minimal fix to the honest gap named in §1 —
adding a `--provenance-out <path>` style option (or letting the Runtime layer write the
sidecar automatically, per `CORE_PRIMITIVES.md` §4) rather than a new storage paradigm.

## 4. ProductionReceipt (PROPOSED)

**Status: does not exist as a discrete, emitted artifact anywhere in the audited
ecosystem today.** It is buildable entirely from parts that already exist and already
agree with each other (`qc-skill`'s identity fields, `ProjectIR.provenance`'s fields),
which is exactly why it is proposed rather than invented from a blank page. Per
`SPEC.md` §6:

```
ProductionReceipt {
  id: string                       // content hash of the receipt body itself
  project_id, plan_id, plan_hash, ir_hash
  input_artifact_ids: [ArtifactId]
  output_artifact_ids: [ArtifactId]
  skill_versions: { [skill_id]: version }
  tool_versions: { ffmpeg: string, ffprobe: string, ... }
  decisions: [DecisionId]
  qc_report_ids: [ArtifactId]
  warnings: [string]
  failures: [string]
  created_at: timestamp
}
```

**What a ProductionReceipt answers that per-Artifact provenance alone does not:**
per-Artifact provenance answers "what produced *this one file*." A ProductionReceipt
answers, once, for a whole completed Plan: *what happened, why (via `decisions`, tying
back to the Observation → Inference → Decision chain that authorized each step), with
what tools (`skill_versions`, `tool_versions`), and did it pass verification
(`qc_report_ids`, `warnings`, `failures`)*. It is the roll-up; per-Artifact `provenance`
dicts are the detail it summarizes and references, not a replacement for them.

**Emission semantics:** emitted once, at the end of a completed Plan execution —
"completed" meaning the Plan finished running, **not** that it fully passed. A Plan that
ends with QC failures still gets a receipt, with `failures` populated; this mirrors
`qc-skill`'s own `overall_status` semantics (a `FAIL` is a fact, never suppressed, never
silently converted to success) and `ARCHITECTURE.md` §3's rule that the OS "never makes a
production decision" — a receipt records what happened, it does not gate anything.

**Immutability:** "immutable-ish" (per the task framing) rather than strictly
append-only-log-immutable, because nothing in this ecosystem needs cryptographic
tamper-evidence beyond what content-hashing already provides. `id` is a content hash of
the receipt body, exactly like every other Artifact (`SPEC.md` §2) — so any edit produces
a different `id`, which is a sufficient integrity property for this ecosystem's actual
threat model (see `SECURITY_MODEL.md` §7 for why no cryptographic signing scheme is
proposed here). A receipt is not literally impossible to alter on disk; it is identified
in a way that makes alteration detectable, which is the same guarantee `qc-skill`'s
tamper-detecting cache already relies on.

**What is NOT proposed:** a separate receipt database, a receipt index service, or a
receipt format distinct from the Artifact model. A `ProductionReceipt` is simply
`Artifact.type = production_receipt` (already listed in `SPEC.md` §2's Artifact type
enum) with the body shape above — one more Artifact type, not a new subsystem.

## 5. Reproducibility, precisely defined

Two distinct claims get conflated under "reproducible," and this ecosystem's evidence
supports only one of them unconditionally:

- **Deterministic reproducibility** — given the same source artifact hashes, the same
  Capability+Provider+Skill version, the same effective parameters, and the same tool
  versions, a deterministic Provider (the `deterministic_inputs: true` case,
  `ffmpeg-skill`'s existing `ToolSpec` field, per `ARCHITECTURE.md` §9.4) must produce a
  bit-identical output artifact hash. This is the guarantee `qc-skill`'s identity scheme
  is built to make checkable, and it is the only claim this ecosystem's current evidence
  actually supports end-to-end.
- **Verifiable reproducibility** — for a nondeterministic Provider (a hypothetical future
  generative/AI Provider, explicitly not present in any audited repo today — `NullProvider`
  is the only shipped `AIProvider`), bit-identical output cannot be promised. What can
  still be promised is that the same inputs, parameters, and versions, re-run, produce an
  output that a `QCReport` judges *equivalently* (same `overall_status`, findings within
  documented tolerance) — reproducibility of verified properties, not of bytes.

Recording the full field list in §2 is necessary for both claims; it is only sufficient
for the first. This document does not claim the second is solved today — it does not
exist as a tested guarantee anywhere in the audited ecosystem, and is named here as an
open question for `ROADMAP.md`, not answered.

## 6. Open questions carried forward

- Whether "environment" (beyond `ffmpeg_version`/`ffprobe_version`) needs a
  fingerprinting scheme, and if so, how coarse — no evidence of a real reproducibility
  failure caused by environment drift exists in the audit, so this is not designed here.
- Whether the sidecar-provenance-for-directly-invoked-Skills gap (§3) is closed at the
  Runtime layer (every Skill's Runtime wrapper writes it automatically) or left as a
  per-Skill CLI flag — a `CORE_PRIMITIVES.md` §4 Runtime-contract question, not a
  provenance-shape question.
- Whether `ProductionReceipt.warnings`/`failures` should reference `QCFinding` ids
  directly rather than free-text strings — the `SPEC.md` shape currently proposes
  `[string]`; a more structured shape is a candidate refinement, not a blocking gap.

## 7. Provenance vs. Memory vs. Knowledge vs. Evidence vs. Observation — five distinct concepts that must not be merged

This section does not introduce a new mechanism into the two the OS actually owns
(Provenance, §1–§4 above, and Evidence, `CORE_PRIMITIVES.md` §5) — it draws the boundary
between them and two concepts that sound adjacent but are not OS primitives at all,
specifically so a future contributor does not accidentally treat "let's add project
memory" as "let's extend provenance," or "let's teach the OS some domain knowledge" as a
provenance or evidence concern. The five terms answer five different questions, and none
of the five is a synonym for another:

| Concept | Question it answers | OS-core scope? |
|---|---|---|
| Observation | What did a tool measure? | Yes — `CORE_PRIMITIVES.md` §5 |
| Evidence | Which specific facts does a Decision cite? | Yes — `CORE_PRIMITIVES.md` §5 |
| Provenance | How did this Artifact come to exist? | Yes — this document, §1–§4 |
| Memory | What has this Production/user preferred before? | **No — out of OS-core scope** |
| Knowledge | What is generally true about the domain, independent of any one Production? | **No — out of OS-core scope** |

### 7.1 Worked example, distinguishing all five

Take a single shot under evaluation for use as an opening shot:

- **Observation** — `shot_012 has 4.2 seconds of usable footage; motion score: low`. This
  is exactly what `qc-skill`/`media-analysis-skill` already produce today: a measured
  fact, `provenance="OBSERVED"`, no interpretation attached (`CORE_PRIMITIVES.md` §5).
- **Decision** — `shot_012 is suitable for the opening`. An Agent Decision
  (`CORE_PRIMITIVES.md` §5): `subject=shot_012`, `type=KEEP`, with its own `risk`,
  `approval`, and `basis`.
- **Evidence** — `{ duration_s: 4.2, motion: "low" }`. The specific, minimal set of facts
  the Decision above cites to justify itself — **not** a dump of every Observation ever
  made about `shot_012` or the Project. Evidence is deliberately narrow and targeted: it
  is whatever a Decision's `basis` actually points to, not an audit trail of everything
  that happened to be measured along the way. (Contrast with Provenance below, which *is*
  comprehensive by design — the two serve opposite goals.)
- **Provenance** — a separate concern entirely: the `Artifact -> Operation -> Skill ->
  Runtime -> Input` chain (§1–§4 above) that answers "what produced the frame data in
  `shot_012`'s file, with which Skill version, which tool versions, which effective
  parameters." Provenance does not care whether the shot was judged suitable for
  anything; it cares how the bytes came to exist and whether that could be reproduced.
- **Memory** — `this user has rejected fast cuts three times before`. **Does not exist
  anywhere in the audited ecosystem today**, and is explicitly out of OS-core scope
  (§7.2).
- **Knowledge** — `documentaries typically pace differently than commercials`. Also
  **does not exist anywhere in the audited ecosystem today**, and is also explicitly out
  of OS-core scope (§7.3).

The load-bearing distinction is that Observation, Evidence, and Provenance are all
**traceable to a specific measurement or a specific Artifact's history** — they can be
cited, hashed, and reproduced. Memory and Knowledge are **generalizations across
Productions or across the domain** — by construction, they cannot be pinned to one
Artifact's provenance chain or one Decision's evidence list, because their entire value
lies in applying beyond the single case that produced them. Mixing the two kinds is the
exact error this section exists to prevent: provenance answers "how did *this* happen,"
never "what has the OS learned that *this* should inform."

### 7.2 Memory — out of OS-core scope

**Memory** would be what a past Production learned about a specific user's or project's
preferences — e.g. "this user has rejected fast cuts three times before," carried forward
to influence a future Decision. **No evidence anywhere in the 11 audited repos shows any
such mechanism, storage, or even a stated intention to build one** (`REPOSITORY_MAP.md`).
`video-production-agent` has no database (confirmed absent), no cross-Project preference
store, and no field anywhere in `ProjectIR` that persists a preference beyond the Project
it belongs to.

This document explicitly marks Memory **out of OS-core scope**. If pursued at all, it
belongs at the Agent or ecosystem layer, not as an OS primitive, for the same reason
`ARCHITECTURE.md` §10 gives for not designing a scheduler: **no evidence anywhere in the
audit shows a need for cross-Production memory**, and inventing storage/retrieval
infrastructure for it now — a preference store, a similarity search over past Decisions, a
ranking model over rejected options — would be exactly the kind of speculative complexity
this project's principles reject (`ARCHITECTURE.md` §9, lens 5, and §10's "not solved for
because it is not yet a real problem"). An Agent is free to build its own memory of its
own choosing on top of OS-owned Provenance and Evidence records — those records are, after
all, retrievable and real — but the OS itself does not define a Memory type, a Memory
store, or a Memory query contract.

### 7.3 Knowledge — out of OS-core scope

**Knowledge** would be general, non-Production-specific domain understanding — e.g.
"documentaries typically pace differently than commercials." Unlike Memory, this is not
even project- or user-specific; it is a general claim about the domain that would hold
across every Production the OS ever touches. Nothing in the audited ecosystem encodes
anything like this: no repo ships a rules file, model, or lookup table describing
genre-level editorial conventions.

This document also marks Knowledge **out of OS-core scope**, for a different reason than
Memory: this kind of generalization is either (a) baked into an Agent's own reasoning or
training — a Claude, GPT, or other model's general competence already carries exactly
this sort of domain knowledge, with no OS involvement needed or possible — or (b) a
future Recipe/Skill-level concern, not an OS primitive. The closest existing analog in the
ecosystem today is `video-production-agent`'s `profiles/` directory (`generic`, `youtube`,
`conference` — `CORE_PRIMITIVES.md` §11), which is exactly a named, reusable Plan *shape*
for a given production context, not a general knowledge store the OS reasons over. A
future genre-aware pacing profile would extend that pattern — a Recipe/profile a Plan can
be built from — rather than requiring the OS to own a "Knowledge" primitive of its own.

### 7.4 Why this distinction is being drawn now, before anyone needs it

Provenance and Evidence are the two OS-core concepts here, and both are already
well-specified — Provenance in this document and §1–§4 above, Evidence in
`CORE_PRIMITIVES.md` §5. Memory and Knowledge are named in this document specifically as
**boundary markers**, not as designs-in-waiting: so that a future contributor proposing
"let's add project memory" recognizes it as a different problem from "let's extend
provenance to remember more," and a future contributor proposing "let's have the OS learn
pacing conventions" recognizes that as Agent-reasoning or Recipe-authoring territory, not
a provenance or evidence extension. They are different problems, with different (and, for
now, largely unaddressed) solutions — and the fastest way to keep them from being silently
conflated later is to say so once, here, before either has a design.
