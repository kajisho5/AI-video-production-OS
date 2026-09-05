# Versioning

Status tags as elsewhere: **CURRENT**, **PROPOSED**, **FUTURE**, **UNKNOWN**. This
document generalizes one already-working, already-validated pattern
(`ffmpeg-skill`'s two-axis versioning) into an OS-wide rule, and states explicitly where
a more elaborate scheme (Kubernetes-CRD-style multi-version serving) is tempting but not
yet justified by any evidence in this ecosystem.

## 1. The proven pattern: two independent axes

**CURRENT**, verified directly in `ffmpeg-skill` (`REPOSITORY_MAP.md`): the repo's
`skill.version` has moved through releases (documented as far as 0.8.3 → 0.9.1) while its
`contract_version` has stayed frozen at `"1.0"` for the entire span. These are tracked
completely independently:

- **`skill.version`** — the Skill's own release version. Changes on every release,
  including internal refactors, bug fixes, new operations, and dependency bumps that
  don't change the shape of the Capability Contract. Not meaningful to anyone outside the
  Skill's own release process.
- **`contract_version`** — the version of the *shape* the Skill exposes: its
  `CapabilityContract`'s `capabilities[].input_schema`/`output_schema`,
  `input_artifact_types`/`output_artifact_types`, and the set of capability ids
  themselves. Changes only when that shape changes in a way a dependent (another Skill,
  an Agent) would need to react to. `ffmpeg-skill` has shipped many releases without a
  single `contract_version` bump — direct evidence this is not busywork, it's the
  intended, working behavior of the axis.

**PROPOSED, generalized as an OS-wide rule**: every Skill has an independent release
version *and* an independent Capability Contract version, and the two must never be
conflated. A dependent Skill (or Agent) that pins against a dependency pins against its
`contract_version`, never its `skill.version` — pinning against `skill.version` would
force a re-pin on every release even when nothing the dependent actually uses changed,
exactly the kind of unnecessary coupling `ffmpeg-skill`'s design already avoids in
practice.

## 2. Pinned ranges, not exact pins

**CURRENT**, the exact pattern already implemented in `video-editing-skill`'s,
`audio-production-skill`'s, and `color-grading-skill`'s `ffmpeg-skill` adapters
(`REPOSITORY_MAP.md` §`video-editing-skill and audio-production-skill`): each adapter
checks the located `ffmpeg-skill` checkout's `contract_version` against a
`SUPPORTED_MIN`/`SUPPORTED_MAX` range at startup, failing fast if it's outside range.

**PROPOSED, generalized**: every Skill dependency (`SPEC.md` §1's
`dependencies: [{ skill_id, version_range }]`) is declared as a `contract_version` range
(e.g. `>=1.0,<2.0`), never an exact pin (e.g. `==1.0`). An exact pin would break on every
non-breaking addition the dependency makes (see §3) for no reason — the entire value of
having a `contract_version` axis separate from `skill.version` is that a wide range of
releases can share one contract version, and a dependent should be able to float across
all of them without a re-pin. This is not a new mechanic invented for this document; it
is `SUPPORTED_MIN`/`SUPPORTED_MAX` as already implemented, stated as the OS-wide rule
rather than a per-Skill convention three repos happened to converge on independently.

## 3. What counts as a breaking Capability Contract change

**PROPOSED** — no repo in the ecosystem has yet published a real
`contract_version` bump to observe in practice (`ffmpeg-skill`'s has never moved), so
this section is derived from what would necessarily break a dependent that pinned a
range against the old version, not from an observed incident.

**Breaking (requires a `contract_version` bump):**

- Removing a capability id that was previously published.
- Narrowing an `input_schema` — removing an accepted parameter, tightening a parameter's
  allowed value range or type in a way that previously-valid calls would now fail, or
  making a previously-optional parameter required.
- Changing a capability's declared `output_artifact_types` to a type a dependent
  wouldn't already be handling (e.g. changing `edit.trim`'s output from `video` to
  something else).
- Changing the *meaning* of a parameter without changing its name or type (a silent
  semantic break — the hardest kind to catch mechanically, and exactly why a written
  changelog convention matters alongside the version number itself, even though this
  document does not mandate a specific changelog format).
- Changing `mutates_input` from `false` to `true` for an existing capability, or
  changing `deterministic_inputs` from `true` to `false` — either one changes a
  guarantee a dependent may have relied on structurally (e.g. for caching, per
  `ARCHITECTURE.md` §9 red-team lens 4).

**Non-breaking (does not require a `contract_version` bump):**

- Adding a new capability id.
- Adding a new optional parameter to an existing `input_schema` with a default that
  preserves prior behavior when omitted.
- Widening an accepted parameter's range or type (e.g. accepting a broader set of valid
  values than before).
- Adding a new `output_artifact_types` entry alongside existing ones (a capability that
  now also emits a QC report, say, without removing what it emitted before) — as long as
  the previously-guaranteed outputs are still produced.
- Internal implementation changes, performance improvements, bug fixes that make actual
  behavior conform *more* closely to the documented contract (a bug fix that changes
  behavior to match what the schema already promised is not a contract change, even
  though it may change output bytes).
- Promoting a capability's `lifecycle` state forward (e.g. `EXPERIMENTAL` → `STABLE`) —
  the lifecycle state itself is metadata about maturity, not a shape change (see §5).

A `contract_version` bump is a **major** version bump in whatever versioning scheme a
Skill author uses for it (this document does not mandate SemVer specifically for
`contract_version`, only that breaking vs. non-breaking is distinguishable — `ffmpeg-
skill`'s own `"1.0"` string is evidence the ecosystem already treats it informally as
major.minor).

## 4. Skill lifecycle state vs. Capability lifecycle state

Not to be confused with each other, and both distinct from the two version axes above:

- **Capability lifecycle** (`PROPOSED → EXPERIMENTAL → STABLE → DEPRECATED → RETIRED`) is
  defined in `CAPABILITY_MODEL.md` §Capability lifecycle and is **not redefined here** —
  this document only notes that a lifecycle-state change is, per §3 above, never itself a
  `contract_version`-breaking event, because it's a maturity signal about the capability,
  not a shape change to its schema.
- **Skill release version** (`skill.version`) is the ordinary release cadence axis from
  §1, orthogonal to both the contract version and the capability lifecycle state — a
  Skill can bump `skill.version` on every commit while its `contract_version` and every
  capability's lifecycle state stay untouched, exactly as `ffmpeg-skill` already does.

## 5. Project IR versioning

**CURRENT, already working**: `video-production-agent` has real migration support —
`project/migrations.py` and a `CURRENT` version constant (`REPOSITORY_MAP.md`,
`CORE_PRIMITIVES.md` §7's reference to the IR's versioned JSON document,
`schemas/project.schema.json`). This is cited here as the existing, working pattern for
IR schema evolution — **this document does not propose replacing it.** A Project IR
document declares the schema version it was written against; a migration function (or
chain of them) upgrades an older document to the version the running Agent expects
before operating on it. This is a single-current-version-plus-migration-chain model, not
a multi-version-serving model — see §6 for why that distinction matters and is
deliberate.

`ProductionPlan`, `Artifact`, `QCReport`, and `ProductionReceipt` (`SPEC.md`) are not yet
independently versioned as schemas in their own right anywhere in the ecosystem — they
are sub-shapes within the versioned Project IR document today. **FUTURE**: if any of
these needs to be exchanged or persisted independently of a specific Project IR version
(e.g. a `ProductionReceipt` archived long after its originating Project IR schema has
moved on), it will need its own version field and its own migration story, following the
same pattern already proven for the IR as a whole rather than inventing a new one. No
evidence in the ecosystem shows this is needed yet.

## 6. Why not Kubernetes-CRD-style multi-version serving

Competitive research surfaced Kubernetes's Custom Resource Definition pattern — serving
multiple schema versions of the same resource simultaneously, with a conversion webhook
translating between them on read/write — as a more sophisticated alternative to a single
current version plus a migration chain.

**Verdict: not justified yet, PROPOSED against for now.** Reasons, grounded in what
actually exists:

- Every version number in this ecosystem is single-digit or a small `0.x`/`"1.0"` string
  (`ffmpeg-skill` skill.version 0.9.1, contract_version "1.0"; every other Skill at
  0.1.0–0.2.0; the Project IR has one `CURRENT` constant). There is no evidence of the
  scale problem multi-version serving solves — many simultaneous consumers pinned to
  many different historical schema versions that cannot all be migrated forward at once.
  Kubernetes needs this because thousands of independently-operated clusters run
  different API-server versions against the same stored objects for years; nothing in
  this ecosystem remotely resembles that operational shape today (`ARCHITECTURE.md` §9,
  red-team lens 5: "no evidence of scale that would matter").
- A migration chain (upgrade-on-read, the existing `migrations.py` pattern) already
  solves the actual problem this ecosystem has: an old Project IR document needs to be
  usable by a newer Agent. It does not need to solve the much harder problem multi-
  version serving solves: many *different* current consumers needing to read and write
  the *same* live object in *their own* preferred version simultaneously. Nothing in
  this ecosystem writes back to a shared, long-lived, multi-writer object store the way
  a Kubernetes API server does — everything here is local-first, single-machine,
  file-based (`ARCHITECTURE.md` §10).
- Building conversion-webhook-style infrastructure now would be solving a problem this
  ecosystem does not have evidence of yet — exactly the "architecture astronautics"
  failure mode `ARCHITECTURE.md` explicitly rules out for the Resource model, applied
  here to versioning instead.

**Recommendation**: keep the simpler pinned-range approach (§2) for Capability Contracts
and the single-current-version-plus-migration-chain approach (§5, already implemented)
for the Project IR. Revisit multi-version serving only if and when real evidence emerges
of multiple simultaneously-active consumers that cannot tolerate a migration step — e.g.
a hosted multi-tenant service reading many users' IR documents live across schema
versions, which is explicitly not what this ecosystem is today (`ARCHITECTURE.md` §8:
"Cloud infrastructure, a job queue, or a scheduler... None exists today").

## 7. Artifact and Receipt versioning

**CURRENT.** `Artifact` identity is a content hash (`SPEC.md` §2), not a version number —
an Artifact does not get "upgraded," it is superseded by a new Artifact with its own hash
and a `derived_from` link. This sidesteps the versioning question for artifacts entirely:
there is nothing to migrate, only new content to produce. `ProductionReceipt` (`SPEC.md`
§6) follows the same identity-by-content-hash model and is emitted once per completed
Plan — it is not mutated or migrated after the fact; a later schema change to the
Receipt shape is handled the same way any other schema evolves (a new field is additive
and non-breaking per this document's own §3 criteria, applied to the Receipt shape same
as a Capability Contract).

## 8. Summary table

| Thing | Versioned by | Changes on | Pinned as |
|---|---|---|---|
| Skill | `skill.version` | every release | not pinned by dependents at all |
| Capability Contract | `contract_version` | only on breaking shape change (§3) | range (`>=min,<max`) by dependents |
| Capability | `lifecycle` state | maturity signal, not a shape change | not pinned — informs Provider selection, not compatibility |
| Project IR | schema version + `CURRENT` constant | schema evolution | single current version; older docs migrated forward |
| Artifact | content hash (identity, not a version) | never — new content is a new Artifact | referenced by hash, never "upgraded" |
| ProductionReceipt | content hash of receipt body | never — emitted once | referenced by hash |

## 9. What this document deliberately does not define

- A mandated version-string format (SemVer specifically) for `skill.version` or
  `contract_version` — every audited Skill already uses something SemVer-shaped
  informally; this document does not need to mandate it to make the two-axis and
  range-pinning rules work.
- Deprecation timelines or support-window policy (how long a `DEPRECATED` Capability
  must remain callable before `RETIRED`) — no evidence exists yet for what's realistic,
  and `CAPABILITY_MODEL.md` does not specify this either; left to `ROADMAP.md`.
- Multi-version serving infrastructure — explicitly addressed and rejected for now in
  §6, not merely omitted.
