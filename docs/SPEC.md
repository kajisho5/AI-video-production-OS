# Core System Specification

This is the technical specification of the OS kernel contracts defined conceptually in
`CORE_PRIMITIVES.md` and `ARCHITECTURE.md`. Field shapes below are drawn directly from
what already exists in the audited repos wherever possible (cited inline) and marked
`(PROPOSED)` where they are new. This is a specification of *shape*, not an
implementation — language/serialization bindings are Roadmap work.

## 1. Capability Contract

Published by a Skill so it is discoverable. Generalizes `ffmpeg-skill`'s `ToolSpec`
(the richest existing example — introspected live from its own `argparse` parsers) and
every other Skill's `contract.py` output into one cross-ecosystem shape.

```
CapabilityContract {
  skill_id: string            // e.g. "ffmpeg-skill"      (existing: skill.id)
  skill_version: string       // e.g. "0.9.1"              (existing: skill.version, every repo)
  contract_version: string    // e.g. "1.0"                (existing: ffmpeg-skill only today; PROPOSED for all)
  capabilities: [
    {
      id: string               // e.g. "edit.trim"          (PROPOSED namespace; existing tool ids are close: "ffmpeg-skill/cut")
      lifecycle: PROPOSED | EXPERIMENTAL | STABLE | DEPRECATED | RETIRED   (PROPOSED field)
      input_schema: object      // typed params, closed vocabulary (existing in every repo's contract.py)
      output_schema: object     // (existing: ffmpeg-skill's output_schema)
      input_artifact_types: [ArtifactType]   (PROPOSED, generalizes existing inputs/outputs fields)
      output_artifact_types: [ArtifactType]
      mutates_input: bool        // always false today, everywhere (existing, ffmpeg-skill + others)
      deterministic_inputs: bool // (existing: ffmpeg-skill ToolSpec field)
      idempotency_hint: string   // (existing: ffmpeg-skill ToolSpec field, e.g. "cached")
      verification: { required: bool, tools: [CapabilityId] }  (existing: ffmpeg-skill ToolSpec field)
      security: { forbidden_keys: [string] }  (PROPOSED: today reimplemented ad hoc per repo)
    }, ...
  ]
  dependencies: [ { skill_id, version_range } ]   // e.g. depends on ffmpeg-skill >=0.9.1,<1.0.0
                                                   // (existing pattern: every delegating skill's adapter.py)
  not_provided: [string]        // self-declared non-responsibilities (existing: ffmpeg-skill manifest)
}
```

`capability contract --json` / `<skill> contract --json` (already the exact CLI shape of
every audited Skill) remains the discovery entrypoint. No new transport is introduced.

## 2. Artifact

Generalizes `video-production-agent`'s existing `Artifact` dataclass.

```
Artifact {
  id: string                  // content hash, e.g. sha256 of file bytes (existing pattern: qc-skill identity scheme)
  type: video | audio | image | subtitle_document | project_ir | qc_report
      | analysis_result | thumbnail | production_receipt | timeline   (existing + PROPOSED additions: timeline, production_receipt)
  logical_name: string        // (existing)
  stage: working | candidate | approved | final | archive   // (existing)
  produced_by: { capability_id, provider_id, skill_id, skill_version, operation_id }  (PROPOSED: generalizes existing plan_id/job_id fields)
  derived_from: [ArtifactId]   // parent artifacts (PROPOSED, not found implemented anywhere yet)
  provenance: { ir_path, plan_hash, ir_hash, provenance_path, ... }  (existing shape, video-production-agent)
  created_at: timestamp
}
```

Identity **must** be a content hash, never a path or mtime — this is not a new rule, it
is `qc-skill`'s already-correct pattern (`identity = sha256(canonical_json({...}))`),
generalized to every Artifact type.

## 3. ProductionPlan (DAG of Operations)

Generalizes `video-production-agent`'s `ProductionPlan`/`ProductionStep`/`Operation`.

```
ProductionPlan {
  id: string                  // stable hash of steps+constraints (existing: ProductionPlan.make_id)
  project_id: string
  steps: [
    {
      id: string
      capability_id: string          (PROPOSED field; today steps reference tool ids directly)
      provider_id: string | null     (PROPOSED — explicit per §CAPABILITY_MODEL.md collision policy)
      inputs: [ArtifactId]
      outputs: [ArtifactId]
      params: object                  // typed, validated against the capability's input_schema
      depends_on: [StepId]            // DAG edges (existing implicitly; made explicit here)
      decision_id: string             // the Decision that authorized this step (existing pattern)
      status: derived from decision states, never set directly   // (existing invariant, kept)
    }, ...
  ]
  constraints: object          // (existing)
  plan_hash: string            // (existing)
}
```

Structural plan validation (kernel responsibility, §`ARCHITECTURE.md` §8) checks: every
`capability_id` resolves in the registry; every `inputs`/`outputs` `ArtifactId` type is
compatible with the capability's declared artifact types; the `depends_on` graph is
acyclic; every step referencing a Capability with 2+ AVAILABLE Providers has an explicit
`provider_id` or a resolvable default-provider policy (§`CAPABILITY_MODEL.md`
§Collision policy) — otherwise validation fails with a named, actionable error rather
than picking silently.

## 4. Operation and Execution

Generalizes `video-production-agent`'s `execution/compiler.py` → `Operation` →
`execution/executor.py` chain, unchanged in shape:

```
Operation {
  id: string
  capability_id, provider_id, skill_id
  argv_or_request: object      // typed, never raw shell/filter strings — enforced by the
                                // FORBIDDEN_KEYS check at this exact boundary in every
                                // audited Skill already
  idempotency_key: string      // (existing: Operation.idempotency_key, used by `render --resume`)
  timeout_seconds: number
}

ExecutionResult {
  operation_id
  status: success | failed | timed_out
  outputs: [ArtifactId]
  tool_output: object          // the Skill's own --json response, preserved verbatim
  duration_ms
  retryable: bool              (PROPOSED — see FAILURE_RECOVERY.md)
}
```

## 5. QCReport (unchanged from `qc-skill`)

```
QCReport {
  overall_status: PASS | WARN | FAIL | UNKNOWN   // worst-wins aggregation; UNKNOWN if checks=[]
  checks: [ QCCheck { name, findings: [QCFinding] } ]
  identity: string   // sha256(canonical_json({skill, skill_version, kind, operation,
                      //   asset_fingerprints, effective_parameters, rules,
                      //   ffmpeg_version, ffprobe_version}))  — excludes timestamps/paths
}
QCFinding { measurement: QCMeasurement, threshold, verdict }
QCMeasurement { name, value, unit }
```

This is copied verbatim from `qc-skill`'s implementation, not redesigned — see
`QC_ARCHITECTURE.md` for how it extends to verifying a Plan, not only a final file.

## 6. ProductionReceipt (PROPOSED — new, built from existing parts)

```
ProductionReceipt {
  id: string                       // content hash of the receipt body itself
  project_id, plan_id, plan_hash, ir_hash     // (existing fields, reused)
  input_artifact_ids: [ArtifactId]
  output_artifact_ids: [ArtifactId]
  skill_versions: { [skill_id]: version }     // (existing: ProjectIR.provenance.skill_versions)
  tool_versions: { ffmpeg: string, ffprobe: string, ... }  // (existing: ProjectIR.provenance.tool_versions)
  decisions: [DecisionId]
  qc_report_ids: [ArtifactId]
  warnings: [string]
  failures: [string]
  created_at: timestamp
}
```

Emitted once, at the end of a completed (not necessarily fully-passing) Plan execution.
See `PROVENANCE.md`.

## 7. What this spec deliberately does not define

- Wire format / serialization (JSON is what every audited repo already uses; not
  mandated here as a permanent constraint, just the observed default).
- A query language for the Capability registry — a flat lookup by id is sufficient for
  the ecosystem size that exists today (11 repos, ~60 total operations).
- Any authentication/authorization model — no repo in the ecosystem talks to a network
  service today; this is out of scope until one does (see `SECURITY_MODEL.md` for the
  trust boundaries that *do* exist today: filesystem and subprocess, not network).
