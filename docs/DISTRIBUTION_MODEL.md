# Distribution Model: npm, GitHub, and the Distribution Layer

Status tags as elsewhere: **CURRENT**, **PROPOSED**, **FUTURE**, **UNKNOWN**. This
document responds to the npm/Package Distribution Addendum. Per that addendum's own
instruction ("推測は禁止" — guessing is forbidden), every factual claim below about
`ffmpeg-skill`'s actual npm-published state was verified in this session by reading the
local clone (`/home/user/kajisho5/ffmpeg-skill`) and by querying the live npm registry
(`https://registry.npmjs.org/ffmpeg-skill`) via `WebFetch`. Anything that could not be
verified this way is marked `UNKNOWN — not verifiable from this environment`, not
guessed. This document does not fabricate a package name, version, URL, or metadata
value anywhere.

This document generalizes nothing beyond what `REPOSITORY_MAP.md`, `CORE_PRIMITIVES.md`,
`CAPABILITY_MODEL.md`, `VERSIONING.md`, `SECURITY_MODEL.md`, and `PLUGIN_MODEL.md` have
already established as ground truth. Where this document and one of those disagree, those
win, per `REPOSITORY_MAP.md`'s own stated precedence rule.

---

## 1. The Distribution Layer is not OS Core

**PROPOSED, as a named boundary — consistent with, not a change to, `CORE_PRIMITIVES.md`
§0's existing definition of what the OS is.** `CORE_PRIMITIVES.md` §0 already excludes
"a UI, a job scheduler/queue, or a network service" from the OS; this document adds one
more explicit exclusion of the same kind: **how a Skill's code physically reaches a
machine is not an OS concern.** The OS's boundary is the Skill Contract
(`SKILL_SPEC.md`) and the Runtime (`CORE_PRIMITIVES.md` §4) — what a Skill must speak and
how it must execute once installed, never how it got onto disk.

Two channels exist today, evidenced directly in the audited ecosystem:

- **GitHub** — source hosting, issue tracking, releases, documentation, `SECURITY.md`
  (where present), and community (`FUNDING.yml`, discussions). Every one of the 11
  audited repos is a GitHub repo (`REPOSITORY_MAP.md`); this is the ecosystem's actual,
  universal distribution/development substrate today.
- **npm** — package distribution, versioned install, dependency distribution, and package
  metadata (`package.json`, the registry's `dist`/`versions` index). **CURRENT for exactly
  one repo**: `ffmpeg-skill`. See §3 for the verified detail.

**FUTURE, named but explicitly not designed here** (directly from the addendum §1 and
§19, and consistent with `PLUGIN_MODEL.md` §9's identical restraint about a marketplace):
a Skill Registry, an OCI-based distribution mechanism, an enterprise/private registry, and
offline/local catalogs. These are named as candidate future Distribution Adapters, not
sketched, scoped, or scheduled — building any of them now would be exactly the
"architecture astronautics" `ARCHITECTURE.md` and `PLUGIN_MODEL.md` both already rule out
elsewhere, applied here to distribution instead of runtime or discovery.

**The governing principle, restated plainly:** GitHub, npm, and any future Registry are
not the Skill. They are different Distribution / Discovery / Trust / Development channels
for reaching the same underlying thing — a Skill's Capability Contract and its
implementation — and none of them is the source of a Skill's identity (§6).

---

## 2. npm Package Policy: classifying the 10 Skill repos

The addendum asks each of the 10 Skill repos (`ffmpeg-skill` + the 9 others named in its
own §20 table) to be evaluated for npm-worthiness. Before classifying, the premise itself
was checked rather than assumed: `REPOSITORY_MAP.md`'s ecosystem table already states only
`ffmpeg-skill` ships `npm`-shaped packaging (`bin/install.js`, `package.json`); this
session re-confirmed it directly by searching for `package.json` at the root of all 11
local clones under `/home/user/kajisho5/` — **exactly one match, `ffmpeg-skill`'s.** Two
of the other nine (`audio-production-skill`, `qc-skill`) were spot-checked directly and
each has a `pyproject.toml` at its root and no `package.json` anywhere, matching
`REPOSITORY_MAP.md`'s claim that the other 9 are pure-Python packages with zero npm
footprint. No other Skill's `pyproject.toml`/PyPI-readiness was independently
re-inspected beyond this spot check in this session — this document trusts
`REPOSITORY_MAP.md`'s already-verified per-repo detail for the remaining seven rather than
re-deriving it.

This means: **npm is not "the" Skill-distribution channel for this ecosystem — it is
specifically `ffmpeg-skill`'s channel, because `ffmpeg-skill` is the one Skill that is
Node-wrapped** (an `npx`-runnable installer CLI over an otherwise pure-Python-stdlib
tool). Forcing an npm narrative onto the other nine, which are plain Python with no
Node/npm code anywhere, would misrepresent them. Their honest classification is
**GitHub ONLY / pip, not npm** — if any of them is ever published as a standalone
package, PyPI (via their existing `pyproject.toml`) is their equivalent of what npm is to
`ffmpeg-skill`, not npm itself.

| Skill | Language / packaging found | Standalone CLI value | npm fit | Classification |
|---|---|---|---|---|
| `ffmpeg-skill` | Node-wrapped installer (`bin/install.js`) over Python-stdlib scripts; has `package.json`, `bin`, `files` | Yes — real, verified (§3): `npx ffmpeg-skill` installs a working local CLI/MCP skill with zero other deps | Native fit — it is already Node-shaped | **npm SHOULD** (already is, see §3) |
| `video-editing-skill` | Pure Python, `pyproject.toml`, no Node code | Yes, as a Python CLI | Not Node-shaped; would need a wrapper to justify npm the way `ffmpeg-skill` has one | **GitHub ONLY / pip** — PyPI-publication status **UNKNOWN — not verifiable from this environment** |
| `audio-production-skill` | Pure Python, `pyproject.toml` (confirmed this session) | Yes | Same as above | **GitHub ONLY / pip** — PyPI status UNKNOWN |
| `color-grading-skill` | Pure Python, `pyproject.toml` (per `REPOSITORY_MAP.md`) | Yes | Same as above | **GitHub ONLY / pip** — PyPI status UNKNOWN |
| `subtitle-skill` | Pure Python | Yes | Same as above | **GitHub ONLY / pip** — PyPI status UNKNOWN |
| `motion-graphics-skill` | Pure Python | Yes | Same as above | **GitHub ONLY / pip** — PyPI status UNKNOWN |
| `thumbnail-skill` | Pure Python + Pillow dependency | Yes | Same as above | **GitHub ONLY / pip** — PyPI status UNKNOWN |
| `qc-skill` | Pure Python, `pyproject.toml` (confirmed this session) | Yes, but primarily a composition target (used via `video-production-agent`) | Same as above | **GitHub ONLY / pip** — PyPI status UNKNOWN |
| `media-analysis-skill` | Pure Python | Yes, same caveat as `qc-skill` | Same as above | **GitHub ONLY / pip** — PyPI status UNKNOWN |
| `transcription-skill` | Pure Python, optional `faster-whisper` dependency | Yes, standalone ASR CLI | Same as above; also carries a heavier ML dependency (`faster-whisper`) that is itself a distribution-simplicity concern independent of npm vs. PyPI | **GitHub ONLY / pip** — PyPI status UNKNOWN |

Notes on the classification:

- **Not evaluated as "npm MAY" for any of the nine.** "npm MAY" would imply a plausible,
  reasonably-near-term case for wrapping a pure-Python tool in a Node shim purely for
  npm's install ergonomics. No evidence in any of the nine repos suggests this was ever
  attempted or requested; inventing the case would be exactly the kind of speculative
  narrative the addendum's "推測は禁止" instruction forbids. If a future need arises (e.g.
  a JS-first agent framework wants a zero-Python-runtime installer), it would be evaluated
  against the same criteria applied to `ffmpeg-skill` in §3, not assumed now.
- **"Registry FUTURE"** applies identically to all 10, per the addendum's own table
  shape — a future Skill Registry is not npm- or PyPI-specific, and nothing about this
  classification changes if/when one exists (§9).
- **Whether any of the nine Python Skills is published to PyPI today is UNKNOWN — not
  verifiable from this environment.** This session did not query `pypi.org` for any of
  them; the addendum's own scope (§1–§23) is npm-specific, and speculating about PyPI
  publication state would violate the same no-guessing instruction that governs the npm
  investigation.

---

## 3. `ffmpeg-skill` as the reference implementation — verified findings

This section answers the addendum's §3 checklist item by item, from direct evidence: the
local clone at `/home/user/kajisho5/ffmpeg-skill` (its `package.json`, `bin/install.js`,
`README.md`, `CHANGELOG.md`, `.github/workflows/ci.yml`, `LICENSE`, and `git log`), and a
live query of `https://registry.npmjs.org/ffmpeg-skill` performed in this session.

**The package is real and published.** The npm registry returns a valid document for the
exact, unscoped name `ffmpeg-skill` — it is not squatted by an unrelated package and not
absent. No scoped-name (`@kajisho5/ffmpeg-skill`) check was needed once the bare name
resolved.

| Checklist item | Finding |
|---|---|
| **Package name** | `ffmpeg-skill` (unscoped), confirmed identical in `package.json`'s `"name"` field and on the live registry. |
| **Current version (npm registry)** | **`0.9.0`** is the latest version actually published on the registry (`dist-tags.latest`), verified live. |
| **Current version (local clone / GitHub)** | `package.json` in the local clone declares **`0.9.1`**, and `CHANGELOG.md`'s top entry is `## 0.9.1`. **This is a real, verified discrepancy, not a guess** — see §4. |
| **`package.json` fields present** | `name`, `version`, `description`, `keywords` (11 entries), `license: "MIT"`, `author: "kajisho5"`, `repository` (git URL), `homepage`, `bugs`, `bin`, `files`, `scripts`, `engines.node: ">=16"`. No `main`/`exports` field — the package is a CLI/installer, not an importable library. |
| **Exports** | None declared (no `"exports"` or `"main"` field) — consistent with the package being consumed exclusively via its `bin` entry, never `require()`d. |
| **`bin` / CLI** | `"bin": { "ffmpeg-skill": "bin/install.js" }` — one CLI entry point, confirmed live on the registry's published 0.9.0 metadata too. |
| **Dependencies** | **None.** No `"dependencies"` key in `package.json` — matches `REPOSITORY_MAP.md`'s "deps: none (stdlib)" for this repo. The installer (`bin/install.js`) uses only Node's built-in `fs`, `os`, `path`, `child_process`. |
| **Node version requirement** | `"engines": { "node": ">=16" }`. |
| **README** | Present locally (`README.md`, 23KB) and present on the registry as the top-level `readme` field for the published 0.9.0 tarball — but the two are **not** the same text (§4). |
| **Repository metadata** | `git+https://github.com/kajisho5/ffmpeg-skill.git`, matching the registry's `repository.url`. |
| **License** | `MIT` in `package.json`, matching the standalone `LICENSE` file's MIT text and the registry's `license` field. |
| **Files included in package** | `package.json`'s `"files"` field: `bin/`, `scripts/`, `mcp/`, `references/`, `SKILL.md`, `README.md`, `LICENSE`. The registry's published 0.9.0 tarball reports `fileCount: 55`, `unpackedSize: 724087` bytes — consistent with a small CLI+scripts package, not independently re-verified file-by-file. |
| **npm publish configuration** | No `publishConfig` key in `package.json` (no scoped-registry override, no `access` field) — publishing to the public registry under the default, unscoped name. |
| **Package provenance / attestation metadata** | **Checked directly on the registry: absent.** The published version has ordinary registry-issued `dist.integrity` (sha512), `dist.shasum`, and `dist.signatures` (the standard npm registry package-signing keyid/sig every package gets) — but **no `dist.attestations` and no npm-provenance (`--provenance`/Sigstore) metadata**. This means the publish was not done with `npm publish --provenance` (or an equivalent CI OIDC-based provenance flow). Marked **absent, not UNKNOWN** — this was directly checked, not inferred. |
| **Release workflow (CI)** | `.github/workflows/ci.yml` exists and runs on `pull_request`/`push to main`/`workflow_dispatch` across Ubuntu/macOS/Windows. It runs `python tests/test_all.py`, `python tests/test_contract.py`, ffmpeg capability "doctor" checks, and `node bin/install.js` as a smoke test. **It contains no `npm publish` step, no `npm login`/`NODE_AUTH_TOKEN` reference, and no release/tag-triggered job at all.** This is a direct finding from reading the one workflow file present in the repo. |
| **GitHub Release ↔ npm publish relationship** | **UNKNOWN — not verifiable from this environment.** No GitHub Releases API was queried in this session (out of the addendum's local-clone-plus-registry scope as instructed), and no automation for producing one was found in CI. Whether a human runs `npm publish` by hand outside CI, and whether a matching GitHub Release is cut before/after/never, could not be determined from the local clone alone. |
| **Changelog** | `CHANGELOG.md` exists, is substantial (16.6KB, entries from `0.1.0` through `0.9.1`), and is detailed/technical per entry — this is real, current documentation, not a stub. |
| **Security documentation** | **No `SECURITY.md` or equivalent file found anywhere in the repo** (checked directly). The README documents `mutates_input: false`, the `argv` escape hatch's `canonical: false` marking, and the absence of any filter-string acceptance from callers — these are security-relevant design statements embedded in the README/contract docs, not a dedicated security-disclosure policy document. |
| **Install command** | `npx ffmpeg-skill` (default: installs to Claude Code's skills directory), with documented flags `--cursor`, `--codex`, `--all`, `--project`, `--dir`, `--uninstall`. Also `npx ffmpeg-skill contract --json` and `npx ffmpeg-skill doctor`. All of these are read directly from `bin/install.js`'s own argument-parsing code, not from README claims alone — the code and the README agree. |
| **Standalone usage examples** | README's "Quick start" and "Install" sections give real, non-fabricated examples matching the actual CLI surface (`npx ffmpeg-skill`, `npx ffmpeg-skill doctor`, `npx ffmpeg-skill contract --json`). `npm test`, `npm run release-check`, `npm run demo` are documented and match real `package.json` `scripts` entries. |
| **OS integration documentation** | `docs/contract.md` (present in the repo) explicitly documents the intended consumption pattern by an orchestrating agent (quoted in `REPOSITORY_MAP.md`): run `contract --json` once, resolve capabilities, pick a tool, build the call, run it, verify. This is real, existing OS-integration documentation — not something this document needs to propose. |

---

## 4. GitHub ↔ npm consistency — verified, with one real discrepancy found

Per the addendum §4, the following were checked directly against each other (local
clone / GitHub-facing files vs. the live npm registry document for the published `0.9.0`):

| Field | GitHub / local clone | npm registry (published `0.9.0`) | Consistent? |
|---|---|---|---|
| Name | `ffmpeg-skill` | `ffmpeg-skill` | **Yes** |
| Version | `0.9.1` (`package.json`, `CHANGELOG.md` top entry, local `git log` HEAD is commit `d27c776`, "README: OSS landing page for 0.9.1...") | `0.9.0` (`dist-tags.latest`) | **No — GitHub/local is one release ahead of what npm has published.** |
| Description | Current local `package.json` description: "...21 FFmpeg tools with a machine-readable contract, contract-derived MCP server, FFmpeg capability detection, probe-first / verify-last workflow..." | Registry's stored description for 0.9.0: "...lets coding agents...do professional video editing with local FFmpeg: MCP server, batch processing, declarative project rendering..." | **No — materially different wording**, consistent with the version gap: the registry is still serving the older, pre-0.9.1 description. |
| README | Local `README.md` opens with a centered logo/badge block ("Give your coding agent a video editor.") | Registry's stored `readme` field for 0.9.0 opens with different prose ("# ffmpeg-skill\n\n**Give your coding agent a video editor.**... eight small CLI scripts...") and references "eight small CLI scripts," which does not match the current repo's 21-script count (`REPOSITORY_MAP.md`) | **No — the published README is stale relative to the current repo state**, again consistent with npm lagging behind GitHub. |
| Repository URL | `https://github.com/kajisho5/ffmpeg-skill.git` | `git+https://github.com/kajisho5/ffmpeg-skill.git` | **Yes** (same repo, differs only in the `git+` protocol prefix npm adds, not a real discrepancy) |
| License | `MIT` (`LICENSE` file, `package.json`) | `MIT` | **Yes** |
| Install command shown in README | `npx ffmpeg-skill` (and the `--cursor`/`--codex`/`--all`/`doctor`/`contract` variants) — all match the actual `bin/install.js` argument parser | Not independently re-checked against the registry's stored README text beyond the opening lines quoted above | Local README's commands are verified correct against the code; whether the npm-served README's install commands are fully current was not exhaustively diffed line-by-line — the opening-paragraph mismatch above is sufficient evidence the two texts have diverged. |
| Supported Node versions | `>=16` (`package.json`) | `>=16` (registry's stored `engines`) | **Yes** (this field was not touched between 0.9.0 and 0.9.1's other changes) |
| `gitHead` of the published version vs. local HEAD | Local clone's current HEAD: `d27c7762ab5266de06697744d7987d97334e7925` | Registry's `gitHead` for the published 0.9.0: `6b7188945e2e235553da90add03c8bd01df441f6` | **Different commits — direct, verified confirmation that the published npm package corresponds to an older commit than the local clone's current state.** |

**Conclusion (verified, not inferred):** GitHub and npm are **not currently consistent**
for `ffmpeg-skill`. The repository (as cloned locally) has moved to `0.9.1` — a real,
already-written commit ("README: OSS landing page for 0.9.1, FFmpeg Skill brand assets,
package metadata") — while the npm registry's `dist-tags.latest` still serves `0.9.0`.
This is the single most concrete, actionable finding of this investigation: **`0.9.1` has
not yet been `npm publish`ed.** This is not a defect in this document's design work; it is
a fact about the current operational state of a repo whose release pipeline (§10) has no
automated npm-publish step at all — a human `npm publish` simply has not been run yet for
this commit. The addendum's own §4 instruction ("存在しないpackage名や未公開versionを例
示しない" — do not present a nonexistent package name or unpublished version as an
example) is honored throughout this document: §3's install commands above are the ones
that work against whatever is currently live, and this document does not claim `0.9.1` is
installable via `npm`/`npx` today.

---

## 5. Package versioning: npm version is `skill.version`, nothing new needed

`VERSIONING.md` §1 already establishes, as a **CURRENT, proven pattern**: `ffmpeg-skill`
carries two independent axes — `skill.version` (the npm/`package.json` version, moving
through releases) and `contract_version` (frozen at `"1.0"` across that entire span). This
document adds nothing new here. To restate precisely in this document's terms: **the npm
package version *is* `ffmpeg-skill`'s `skill.version`** — there is no separate "npm
version" concept to reconcile against it. `AI Video Production OS`'s own version (were one
to exist as a single number, which it does not today per `REPOSITORY_MAP.md`'s framing of
`video-production-agent` at `0.1.0`) is independent of both axes, exactly as the addendum
§5 states: `ffmpeg-skill 0.x` and any OS-level version evolve on separate cadences, with
compatibility expressed only through `contract_version` ranges (`VERSIONING.md` §2), never
through `skill.version` pins.

---

## 6. Package identity / integrity: what's tracked vs. what's verified today

The addendum §6 asks for a design that tracks package identity, version, digest/integrity,
source revision, release identity, provenance, signature, and dependencies — while not
coupling the OS's Skill-identity model to npm specifically.

**What §3–§4's direct registry check actually found exists today, for `ffmpeg-skill`'s
published `0.9.0`:**

- **Version** — present (`0.9.0`, per `dist-tags` and the version object itself).
- **Digest/integrity** — present: `dist.integrity` (sha512) and `dist.shasum`, standard
  npm tarball-integrity fields.
- **Source revision** — present: `gitHead` (`6b71889...`), tying the published tarball to
  a specific commit — though, per §4, that commit is not the repository's current `HEAD`.
- **Dependencies** — present, and trivially so: none declared, verified empty.
- **Signature** — present only in the generic sense every npm package gets (registry
  keyid/sig under `dist.signatures`) — this is npm's own package-signing infrastructure,
  not a `ffmpeg-skill`-specific or OS-specific signing scheme.
- **Provenance (attestation)** — **checked and confirmed absent.** No `dist.attestations`,
  no Sigstore/OIDC-based provenance metadata. `ffmpeg-skill` was not published with
  `npm publish --provenance` (or CI does not exist to do so — confirmed by §3's CI-workflow
  finding).
- **Release identity** (a GitHub Release object corresponding to this npm version) —
  **UNKNOWN — not verifiable from this environment** (§3).

**Design principle (PROPOSED, directly answering the addendum's own instruction not to
build an npm-coupled design):** the OS's Skill-identity model (`CORE_PRIMITIVES.md` §2's
`Skill`, §3's `Provider`) must not be defined in terms of npm's specific fields
(`gitHead`, `dist.integrity`, npm's registry signature scheme). Those are properties of
**one Distribution Adapter's** metadata shape, not properties of Skill identity itself.
What the OS-level model should track, adapter-agnostically, mirrors the list above at a
more abstract level: a Skill has an id and `skill.version` (`VERSIONING.md` §1); a
released artifact of that Skill has a content digest and a source revision (exactly the
`Artifact` identity pattern already proven in `qc-skill`'s content-hash design,
`CORE_PRIMITIVES.md` §7); and *how* that digest+revision pair was obtained — via npm's
`dist.integrity`+`gitHead`, via a Git tag, via a future OCI digest, via a future Registry's
own signing scheme — is the Distribution Adapter's business, translated into the same
abstract shape rather than requiring the OS to special-case npm's field names. This is the
same discipline `VERSIONING.md`'s two-axis pattern already applies to versioning, applied
here to identity/integrity instead: **one canonical shape, multiple adapters that
translate into it**, npm being the first and currently only populated one.

---

## 7. Installation architecture & Standalone-first: already satisfied

The addendum §7–§8 asks for a "Standalone First" installation architecture:
`npm install` → standalone value → first success → related Skills → OS integration,
without letting OS-integration concerns compromise standalone UX.

**Finding: `ffmpeg-skill` already satisfies this, today, by its own design — no redesign
is proposed here.** `REPOSITORY_MAP.md` documents `ffmpeg-skill`'s own manifest as
declaring an explicit `not_provided` field: `["AI reasoning", "decisions", "production
plans", "project IR", "approvals", "network access", "transcription engine"]`. This is
direct, first-party evidence that the Skill was designed from the start to be usable
completely on its own — a coding agent that has never heard of `video-production-agent` or
this OS can `npx ffmpeg-skill`, get a working local video-editing CLI/MCP server, and stop
there. The README's own "Quick start" (§3) leads with exactly this standalone flow
(`npx ffmpeg-skill` → ask an agent to edit a video), with any mention of a broader
orchestrating Agent appearing only later, in `docs/contract.md`, as an optional
integration path rather than a prerequisite.

The addendum's proposed CLI surface for post-install self-checks (`doctor`, `contract`,
`capabilities`, `version`, `help`, `example`) is also **already implemented**, not merely
proposed: `npx ffmpeg-skill doctor` and `npx ffmpeg-skill contract --json` are real,
verified commands (§3); `--help` is implemented in `bin/install.js` directly. No new CLI
surface is proposed by this document.

---

## 8. OS Integration boundary: Distribution is orthogonal to Runtime trust

This is the addendum's §9 and §17 concern, and it is the point where getting the
architecture wrong would be a genuine security mistake, not just an inelegance.

**The principle, stated plainly:** *how* a Skill's code arrived on a machine — via
`npm install`, `pip install`, or `git clone` — must never change *whether* or *how much*
the OS trusts it to execute. `SECURITY_MODEL.md` §1–§4 already defines the Runtime
contract that governs every Skill invocation regardless of origin: subprocess isolation
(process-group kill-tree timeouts), the `FORBIDDEN_KEYS`/`FORBIDDEN_ARG_KEYS` denylist,
`shell=False`/list-argv exclusively, and symlink-resolved `PathPolicy` containment. None
of these five primitives reference, depend on, or vary by installation mechanism. A Skill
installed via `npm install ffmpeg-skill` is invoked by the Runtime exactly the same way as
one checked out via `git clone` — the Runtime does not know or care which one happened.

The addendum's own §17 principle — "npm package だから安全とは扱わない" (do not treat an
npm-installed package as safe merely because it came from npm) — is not a new idea this
document introduces; it is **directly and already consistent with** two things this
ecosystem's own documents already establish:

1. `SECURITY_MODEL.md` §1's evidence base: every one of the five Runtime primitives exists
   *because* seven different Skill authors independently concluded that a Skill's own
   claims about its safety (in this case, "I only take typed parameters") are not
   sufficient — the denylist and path policy exist as defense-in-depth regardless of
   authorial intent, not as a check specifically on distribution channel.
2. `PLUGIN_MODEL.md` §7's conformance stance: "OS-compatibility is a contract-and-
   conformance fact, never a maintainer's subjective code review" — a Skill earns Runtime
   trust by passing the black-box conformance suite (`SECURITY_MODEL.md` §2,
   `SKILL_SPEC.md` §8) against its actual process boundary, never by virtue of which
   registry (npm, PyPI, a future Skill Registry) served its bytes.

**Concretely, for this document's scope:** npm is a Distribution mechanism. It answers
"how did the bytes get here." It never answers "should the Runtime trust what those bytes
do when executed" — that is answered exclusively by the Runtime contract and the
conformance suite, applied identically to every Skill. Conflating the two — e.g. treating
"came from the npm registry" as a security signal that relaxes `FORBIDDEN_KEYS` checking
or path containment for that Skill — would reintroduce exactly the kind of implicit,
unearned trust `SECURITY_MODEL.md` §8 already flags as a named future risk ("third-party
Skill code as a plugin surface") once non-cooperating third parties are in the picture.
This document does not propose any such relaxation and calls out explicitly that doing so
would be a real security mistake, not merely inelegant design.

---

## 9. Four distinct dependency graphs — kept separate

The addendum §10 asks that npm's dependency model not be confused with the OS's Skill/
Capability/Provider dependency concepts. `DEPENDENCY_GRAPH.md` already establishes the
precedent this document follows: it explicitly separates a **repo-level dependency
graph** (CURRENT, fact — which repos' adapters locate and invoke which other repos'
checkouts) from a proposed **Capability-id-level dependency graph** (a different, more
abstract graph over Capabilities rather than packages), and states plainly that the
repo-level graph "says nothing about *data* flow between" packages — i.e., these are
already treated as distinct graphs serving different questions, not collapsed into one.

This document adds the same discipline to npm specifically. **Four separate graphs exist
or are proposed, and none should be conflated with another:**

1. **npm package dependency graph** — an ordinary Node/npm concern: which npm packages
   does a `package.json`'s `dependencies` list. For `ffmpeg-skill` today this graph is
   trivial (empty — §3), but the concept generalizes to any future Node-shaped Skill.
2. **Skill → Capability graph** — which Capabilities a Skill declares itself a Provider
   of (`CAPABILITY_MODEL.md`). Has nothing to do with npm; exists identically whether a
   Skill is npm-, pip-, or git-distributed.
3. **Skill → Provider dependency graph** — the repo-level graph `DEPENDENCY_GRAPH.md`
   already documents as CURRENT fact: e.g. `video-editing-skill`'s adapter locating and
   version-checking an `ffmpeg-skill` checkout. This is a *runtime/execution* dependency
   (one Skill's Runtime invokes another Skill's process), never an npm `dependencies`
   entry — none of the five delegating Skills lists `ffmpeg-skill` in an npm/pip manifest;
   they locate it via environment variable / well-known-path lookup, exactly because a
   Runtime-level dependency and a package-manager-level dependency are different things
   answering different questions.
4. **Operation → Capability dependency graph** — a `ProductionPlan`'s DAG of `Operation`s,
   each referencing the Capability id it invokes (`CORE_PRIMITIVES.md` §6). This is a
   Plan-time, per-project graph, entirely orthogonal to all three graphs above.

**Why this separation matters concretely, and is not a formality**: an npm `dependencies`
graph answers "what does `npm install` fetch." A Skill→Provider graph answers "what
process does the Runtime invoke at execution time." Collapsing these — e.g. assuming that
because `ffmpeg-skill` has zero npm dependencies it therefore has zero Skill-level
dependents, or that a Capability's Provider list can be derived from `npm ls` — would
produce an actively wrong picture: `ffmpeg-skill` has **five** Skill-level dependents
today (`video-editing-skill`, `audio-production-skill`, `color-grading-skill`,
`motion-graphics-skill`, `thumbnail-skill`, per `REPOSITORY_MAP.md`), and **zero** of that
relationship is visible anywhere in npm's dependency graph, because none of those five
Skills is itself an npm package (§2).

---

## 10. Release pipeline: a proposed practice, honestly unverified as automated

The addendum §11 proposes a release loop: code → tests → security → build → version →
GitHub Release → npm publish → install test → smoke test → release notes. This applies,
today, to exactly one Skill (`ffmpeg-skill`) — it is the only one with an npm publish step
in its lifecycle at all.

**What was directly checked, per the addendum's own instruction to verify CI rather than
assume it:** `.github/workflows/ci.yml` is the only workflow file in the repo. It runs
tests (`test_all.py`, `test_contract.py`), an ffmpeg-capability "doctor" report per OS, and
a smoke-test invocation of `node bin/install.js` — on every PR, push to `main`, and manual
dispatch. **It contains no `npm publish` step of any kind** — no `npm publish` command, no
`NODE_AUTH_TOKEN`/`NPM_TOKEN` secret reference, no tag-triggered release job, no
`actions/create-release` or equivalent. This is a direct finding, not an assumption:
**there is no automated npm-publish pipeline in this repository today.**

Combined with §4's finding (npm's `dist-tags.latest` is `0.9.0` while the repo is at
`0.9.1`), the honest conclusion is: **`npm publish` for this project is a manual,
human-run step, performed outside CI, and it has not yet been re-run since the `0.9.1`
commit landed.** This is stated as an observation about current operational practice, not
a criticism requiring immediate remediation — nothing in the addendum or this OS's own
design principles (`ARCHITECTURE.md`'s repeated "no evidence of scale that would matter")
requires build-and-publish automation for a single-maintainer, single-package ecosystem
the moment it exists. It is named here because the addendum explicitly asked whether this
pipeline is verified automated, and the honest answer is **no — UNKNOWN whether it is
automated at all; confirmed absent from the one CI workflow file present.**

The addendum's proposed loop is recorded here as a **PROPOSED practice** a maintainer of
`ffmpeg-skill` specifically could adopt (adding an `npm publish` step gated on a version
tag, for instance) — this document does not mandate it, build it, or treat its absence as
a defect in the OS architecture, since release automation for one Skill's own package is
that Skill's maintenance concern, not an OS Core concern (§1).

---

## 11. Package security: lifecycle scripts, install-time execution

The addendum §17 specifically flags npm lifecycle scripts (`preinstall`/`postinstall`) as
a distinct, well-known supply-chain risk category — code that runs automatically and
silently the moment `npm install` resolves the package, before a user has chosen to run
anything.

**Direct finding: `ffmpeg-skill`'s `package.json` `"scripts"` field contains
`test`, `release-check`, `demo`, `contract`, `doctor` — none of these are lifecycle hooks.
There is no `preinstall`, `install`, or `postinstall` script anywhere in `package.json`.**
This was checked directly, not assumed from the presence of a `bin` field (per the
addendum's own caution that a `bin` field does not imply install-time execution).

**What actually happens on `npm install ffmpeg-skill` / `npx ffmpeg-skill`, read directly
from `bin/install.js`:** nothing runs automatically at *install* time beyond npm's own
tarball extraction. `bin/install.js` only executes when the user (or their agent)
explicitly invokes the `ffmpeg-skill` command — this is a `bin`-mapped CLI entry point,
not an install lifecycle hook, and the distinction is real: a bare `npm install
ffmpeg-skill` with no subsequent invocation of the `ffmpeg-skill` command copies files to
`node_modules` and runs no code at all. When the CLI *is* invoked, it: (a) parses CLI
flags, (b) for `contract`/`doctor`, `spawnSync`s `python3 scripts/_contract.py`, (c)
otherwise copies `SKILL.md`/`scripts/`/`references/`/`mcp/`/`package.json` into a target
skills directory (default `~/.claude/skills/ffmpeg-skill`), (d) probes for `ffmpeg` on
`PATH` via `spawnSync('ffmpeg', ['-version'])` purely to print a warning if absent — never
to install it. All subprocess calls use `spawnSync` with an argument array, never a shell
string, matching `SECURITY_MODEL.md` §1.3's ecosystem-wide pattern.

**Other §17 items, checked or marked honestly:**

- **Bundled binaries** — none. No compiled binary ships in the package (`"files"` lists
  only `bin/`, `scripts/`, `mcp/`, `references/`, docs — all plain JS/Python/text). The
  package explicitly relies on a system-installed `ffmpeg`, never bundling one.
- **Native dependencies** — none (zero `dependencies` in `package.json`).
- **Credential handling / secret leakage** — no code path in `bin/install.js` reads,
  writes, or transmits credentials of any kind; it only touches the local filesystem and
  spawns local processes.
- **Unexpected network access** — none found in `bin/install.js`; it makes no HTTP/network
  calls of any kind.
- **Dependency vulnerabilities** — **UNKNOWN — not verifiable from this environment.**
  This would normally be answered by `npm audit` against the published package's resolved
  tree; since the tree is empty (zero dependencies) this is a low-risk UNKNOWN, but no
  audit tool was actually run in this session.
- **Maintainer permissions on the npm package** (who besides the registry-listed
  `_npmUser` can publish) — **UNKNOWN — not verifiable from this environment**; this
  requires registry account/team access this session does not have.

**Conclusion:** `ffmpeg-skill` does not exhibit the specific lifecycle-script risk pattern
the addendum warns about. This is a genuine finding in the package's favor, not an
assumption — the `scripts` field and `bin/install.js`'s actual code were both read
directly. This finding is scoped to `ffmpeg-skill` only; it says nothing about the (zero)
other npm-published Skills, since none exist to check.

---

## 12. Do Not Overbuild

The addendum §21 lists things not to build in reaction to npm distribution: a custom
package manager, a custom registry, a giant dependency resolver, custom signature
infrastructure, a universal plugin marketplace, a paid npm gate, or an unneeded monorepo
migration. **This document builds none of them, and explicitly rejects doing so now**,
for exactly the reason `PLUGIN_MODEL.md` §9 already gives for the identical question one
layer up (third-party Skills generally, not npm specifically): *zero third-party Skills
and, per this document's own investigation, effectively zero actual npm-publication
activity beyond one package's manual, occasionally-stale releases* exist today to justify
any of this machinery. `PLUGIN_MODEL.md` §9's "foundation only, no marketplace" stance is
not superseded or revised by this addendum — this document is the npm-specific instance of
the same already-established precedent, not a new decision.

Concretely, what this document does **not** propose, matching each item in the addendum's
list: no custom package manager (npm and, for the other nine Skills, pip/PyPI remain the
mechanism, per §2); no custom registry (§1's Registry FUTURE stays unscoped); no
dependency resolver beyond what npm/pip already provide (§9's four graphs are a
*conceptual* separation for reasoning about the ecosystem, not a resolver to be
implemented); no custom signature infrastructure (§6 explicitly defers to whatever a given
Distribution Adapter — npm today — already provides, rather than building a parallel
signing scheme); no plugin marketplace (unchanged from `PLUGIN_MODEL.md` §9); no paid gate
of any kind (§13); no monorepo migration (nothing in this investigation found any need for
one — `ffmpeg-skill` remains its own single-purpose repo).

---

## 13. Funding/sponsorship: real, existing, and out of scope for design

The addendum §14 raises a funding/sponsorship loop. Per this session's own direct check
(not merely citing an earlier audit): a `.github/FUNDING.yml` file exists in **five** of
the eleven local repos — `ffmpeg-skill`, `audio-production-skill`, `media-analysis-skill`,
`thumbnail-skill`, and `transcription-skill` — not only the one repo an earlier pass had
flagged. Each `FUNDING.yml` found contains a single line, `github: kajisho5`, pointing to
GitHub Sponsors. `ffmpeg-skill`'s own `README.md` has a real "Support" section (quoted in
full, since it is short and already public): *"If this skill saves you time, you can help
keep it maintained through [GitHub Sponsors](https://github.com/sponsors/kajisho5). Issues
and pull requests are just as welcome."*

**This document treats this as sufficient, existing evidence that a lightweight
sponsorship mechanism is already in place** (`github: kajisho5` → GitHub Sponsors) — it
does not invent a new funding architecture, a payment flow, or any URL beyond the one
already present in the repos' own `FUNDING.yml`/README text quoted above. No sponsorship
URL, handle, or platform beyond what was directly read from these files is used anywhere
in this document.

**Explicitly out of scope, stated plainly rather than designed around:** any "X
Announcement" step, social-media distribution loop, or discovery/adoption funnel the
addendum's §11/§13 diagrams sketch (Release → npm → README/Changelog → X Announcement →
Discovery → Adoption) is an **operational/marketing decision for the repo owner**, not an
OS architecture concern. This document does not design a social-posting pipeline, does not
assume any particular social platform is or should be used, and does not propose
automation for it. This is consistent with the addendum's own §24 framing that
distribution channels (including X, where used) are channels, never OS Core.

---

## 14. Final Acceptance Test: passes in principle, unexercised in practice

The addendum §22 poses a fitness test: assume a third party publishes a Skill via npm —
does the flow (npm publish → discover → install → standalone first success → capability
discovered → OS identifies the Skill → Runtime executes it → Artifact created →
verification → provenance → production receipt) hold **without changing OS Core**?

**Verdict: passes in principle, per this document's own §1–§9 design, but has not been
empirically exercised end-to-end by anyone, and this document says so plainly rather than
claiming a success it cannot show evidence for.**

- The **Distribution/Runtime separation** this test depends on (§8) is not a new design
  invented for this test — it already follows directly from `SECURITY_MODEL.md`'s
  Runtime contract and `PLUGIN_MODEL.md`'s conformance-based admission model, both of
  which are already indifferent to installation mechanism by construction.
- The **discovery and Capability-registration half** of the test (npm install → "OS can
  identify Skill") depends on `PLUGIN_MODEL.md` §1's discovery foundation, which that
  document itself already marks as a **CURRENT limitation** (`Service.adapter()` manual
  registration only) with the automatic mechanism named as **FUTURE**, not built. This
  document does not pretend that gap is closed by anything written here — an npm-published
  third-party Skill today would still need to be manually registered with an Agent exactly
  as every one of the current 10/11 Skills is, per `PLUGIN_MODEL.md` §1's own honest
  framing.
- **No evidence exists, in this investigation or any prior one, that this full loop has
  ever actually been run** — end to end, for any Skill, by any party. `ffmpeg-skill` is
  npm-published and has real standalone users in principle, but nothing in this session's
  evidence (README, CHANGELOG, CI, registry metadata) demonstrates a documented instance of
  "someone `npm install`ed it, an Agent discovered and registered it without a source
  change, and a full Production Receipt was produced from that install." This is the
  honest gap the addendum's own test is designed to surface, and this document reports it
  rather than asserting the test has been passed empirically.

**This document's contribution to closing that gap is definitional, not operational**: by
keeping Distribution (§1), Runtime trust (§8), identity (§6), and the four dependency
graphs (§9) cleanly separated, nothing in this architecture *requires* OS Core changes for
a new npm-published Skill to become usable — the test is satisfiable by design. Whether it
has actually been satisfied by anyone, once, is a separate, unanswered, and honestly
unresolved question.

---

## 15. Required Output — direct answers, per addendum §23

1. **Currently published npm package**: `ffmpeg-skill` exists on the public npm registry
   under that exact unscoped name.
2. **Package name / version**: `ffmpeg-skill`; registry `dist-tags.latest` is **`0.9.0`**.
   The local/GitHub clone has already moved to `0.9.1` (unpublished to npm as of this
   check) — see §4.
3. **Correspondence with GitHub**: partially consistent (name, license, repo URL, Node
   engine range all match); **inconsistent on version, description, and README text**,
   because npm is one release behind GitHub — see §4's table.
4. **npm README UX**: the registry-served README (0.9.0) opens correctly on "what is
   this / install / quick start" but its opening prose ("eight small CLI scripts") is
   stale relative to the current 21-script implementation — see §3–§4.
5. **Package metadata**: complete and internally consistent for the published 0.9.0
   version (name, license, repo, bin, files, engines all present and correctly shaped) —
   see §3's full checklist table.
6. **Dependency graph**: npm dependency graph is empty (zero declared deps); this is
   distinct from, and must not be conflated with, the Skill→Provider graph in which
   five other Skills depend on `ffmpeg-skill` at the Runtime level — see §9.
7. **Release workflow**: CI runs tests and a smoke-test install on every PR/push;
   **no `npm publish` step exists anywhere in CI** — publishing is manual and, per §4's
   version-gap finding, not currently up to date — see §10.
8. **Security / provenance state**: no lifecycle scripts, no install-time network or
   credential access, zero dependencies (§11); no npm provenance/attestation metadata on
   the published version (§3, §6) — ordinary registry integrity/signature fields only.
9. **Standalone usability**: real and by-design, evidenced by the Skill's own
   `not_provided` self-declaration and its README's standalone-first quick start — see §7.
10. **OS integration**: exists as documentation (`docs/contract.md`'s consumption pattern)
    and as a live Runtime pattern (five other Skills' adapters) — never as an npm-specific
    mechanism; §8's orthogonality principle governs this.
11. **Other Skills' npm suitability**: none of the other nine Skills has any npm footprint
    (verified directly for two, trusted from `REPOSITORY_MAP.md` for the rest); they are
    pure-Python and would use PyPI, not npm, if ever published standalone — see §2.
12. **Should-be-npm / should-not-be-npm**: `ffmpeg-skill` — npm SHOULD (already is); the
    other nine — GitHub ONLY / pip, npm not applicable — see §2's table.
13. **Necessary changes**: none proposed to OS Core by this document; the one concrete,
    actionable item surfaced is operational, not architectural — `ffmpeg-skill`'s
    maintainer has an unpublished `0.9.1` sitting on GitHub (§4, §10).
14. **Unnecessary changes (rejected)**: custom package manager/registry/signature
    infrastructure, a marketplace, a paid gate, an npm narrative forced onto the nine
    Python Skills, a social-distribution pipeline — see §12–§13.
15. **CI/CD improvement ideas**: PROPOSED only, for `ffmpeg-skill` specifically, and not
    mandated by this document: an `npm publish` step gated on a version tag would close
    the §4/§10 staleness gap; whether to add npm provenance (`--provenance`) is a
    maintainer decision this document does not make on their behalf — see §10.
16. **Release / sponsorship loop**: the sponsorship half is real and already in place
    (`FUNDING.yml` in five repos, a live README Support section) — see §13; any
    social-announcement loop is explicitly out of scope for this architecture document.
17. **Future registry integration**: named only as a future Distribution Adapter
    candidate (§1, §19-equivalent) — not designed, scoped, or scheduled.
18. **Architecture Gap**: the one substantive gap this investigation surfaces is
    operational rather than architectural — a real GitHub/npm version and README
    inconsistency for the one Skill that is npm-published (§4) — plus the pre-existing,
    already-documented discovery gap (`PLUGIN_MODEL.md` §1's manual-registration
    limitation) that this document does not claim to have closed (§14).

---

## 16. What this document deliberately does not define

Consistent with `PLUGIN_MODEL.md` §9's and `ARCHITECTURE.md`'s established restraint:

- A concrete Distribution Adapter abstraction/interface (§1, §19-equivalent) — named as a
  future direction only, with zero second real adapter (beyond npm) existing yet to
  design against.
- Any automated release/publish pipeline implementation for `ffmpeg-skill` — §10 names
  the gap and the addendum's proposed loop as a PROPOSED practice; this document does not
  write the GitHub Actions workflow that would implement it.
- A PyPI-publication plan or verification for any of the nine Python Skills — genuinely
  unverified (§2), and out of the addendum's own npm-scoped instructions to investigate.
- Any social-media / "X announcement" distribution mechanism — explicitly out of scope
  per §13.
- A custom signing, attestation, or provenance scheme beyond what npm's own registry
  already provides today — §6 explicitly defers this to future Distribution Adapters,
  not designed here.
