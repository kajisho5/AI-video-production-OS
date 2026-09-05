# ADR-004: Artifact Identity Is Always a Content Hash, Never Path or Mtime

Status: Accepted

## Context

Every Artifact in the OS (video, audio, image, subtitle document, project IR, QC report,
analysis result, thumbnail, receipt) needs a stable identity that survives being moved,
renamed, recomputed, or cached. `REPOSITORY_MAP.md` documents that `qc-skill` already
solved this correctly:

> `identity = sha256(canonical_json({skill, skill_version, kind, operation,
> asset_fingerprints, effective_parameters, rules, ffmpeg_version, ffprobe_version}))`,
> explicitly excluding timestamps/paths/request_id — this is the cleanest
> reproducibility-identity design found anywhere in the ecosystem.

This design is paired with real, working infrastructure: `qc-skill` has "a real
file-based cache, sharded by hash prefix, atomic write, and tamper detection — a cache
hit is only honored if a stored result-hash still matches the recomputed hash of the
cached report." `video-production-agent`'s own `Artifact` dataclass already carries a
`hash` field alongside `logical_name`, `stage`, and `provenance`, so this is not a
foreign concept being imported — it is one repo's design, already correct, that the rest
of the ecosystem has not yet generalized.

## Decision

Every OS Artifact's `id` field is a content hash (per `SPEC.md` §2: "content hash, e.g.
sha256 of file bytes (existing pattern: qc-skill identity scheme)"), never a filesystem
path and never a modification timestamp. This applies uniformly across all Artifact
types, not only QC reports.

## Consequences

- Caching correctness follows directly: two Operations producing byte-identical output
  from identical inputs/parameters can be recognized as the same Artifact regardless of
  where either was written.
- Provenance chains (`derived_from: [ArtifactId]`) remain valid even if a file is moved,
  copied, or a Workspace is reorganized.
- Tamper detection generalizes for free: any Artifact's claimed identity can be
  recomputed and compared, exactly as `qc-skill` already does for cache hits.
- Cost: every Skill producing an Artifact must compute a canonical hash at production
  time, which qc-skill already does and most other Skills do not yet do explicitly for
  their own outputs — this is new required work for those Skills, not free.

## Alternatives Considered

**Path-based identity (identify an Artifact by its file location, optionally plus
mtime).** Rejected. This is not a strawman — it is the more common naive default, and
`qc-skill`'s own design deliberately avoided it: the identity scheme explicitly excludes
"timestamps/paths/request_id" *specifically* to support caching correctness and
reproducibility. Path/mtime identity breaks the moment a file is copied, a cache is
warmed on a different machine, or a Workspace is reorganized — none of which content-hash
identity is sensitive to.
