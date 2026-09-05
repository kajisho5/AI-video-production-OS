# ADR-008: ProductionReceipt as a Sidecar Artifact Built from Existing Provenance Fields

Status: Accepted

## Context

No repository in the ecosystem currently emits a single, discrete artifact answering
"what happened, why, with what tool versions, did it pass verification" for one completed
Plan. But `CORE_PRIMITIVES.md` §10 notes this is directly buildable from two things that
already exist and already agree with each other:

- `qc-skill`'s content-addressed `identity` scheme
  (`sha256(canonical_json({skill, skill_version, kind, operation, asset_fingerprints,
  effective_parameters, rules, ffmpeg_version, ffprobe_version}))`), and
- `video-production-agent`'s existing `ProjectIR.provenance` dict, which already carries
  `source_hashes, profile_version, skill_versions, tool_versions, ai_calls, recovery,
  runs, plan_hash, ir_hash`.

`REPOSITORY_MAP.md` further notes `ffmpeg-skill`'s own provenance gap: "every run reports
the exact ffmpeg command line(s) executed and a probe of the output, but nothing is
persisted as a sidecar/manifest recording FFmpeg version + full parameters next to the
output artifact — provenance exists in the response, not on disk." A ProductionReceipt
closes exactly this gap at the Plan level.

## Decision

Define `ProductionReceipt` (`SPEC.md` §6) as a new Artifact type, content-hash identified
like every other Artifact (ADR-004), combining `ProjectIR.provenance`'s existing fields
(`skill_versions`, `tool_versions`, `plan_hash`, `ir_hash`) with references to the Plan's
input/output Artifact ids, its Decisions, and its QC report ids. It is emitted exactly
once, at the end of a completed Plan execution (whether or not that execution fully
passed verification).

## Consequences

- No new persistent infrastructure is required — the Receipt is a JSON sidecar artifact,
  written to disk alongside other Artifacts, consistent with how every existing repo
  already works.
- Skills gain no new responsibility: `skill_versions`/`tool_versions` are already tracked
  by `video-production-agent` today; the Receipt only needs to be assembled and emitted
  once at Plan completion, not tracked incrementally by every Skill.
- Fixes `ffmpeg-skill`'s documented on-disk provenance gap at the Plan level, without
  requiring every individual tool invocation to change its own output format.

## Alternatives Considered

**A running provenance database (a service or embedded DB tracking every run/decision
across Plans over time).** Rejected. `REPOSITORY_MAP.md` explicitly confirms "no
database" exists anywhere in the ecosystem today (§"Explicitly NOT implemented"), and
`ARCHITECTURE.md` §8 excludes "cloud infrastructure, a job queue, or a scheduler" from
the kernel on the same evidentiary basis. A sidecar JSON artifact, emitted once per Plan
and content-hash identified like everything else, matches the existing, working,
file-based pattern used by every repo in the ecosystem — a database would introduce new
operational infrastructure (a service to run, a schema to migrate) to solve a problem the
sidecar-artifact approach already solves within the current architecture.
