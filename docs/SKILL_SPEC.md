# Skill Spec: What Makes a Skill Conformant

Status tags used throughout, matching the rest of this project: **CURRENT** (verified in
one or more of the 10 audited Skill repos in `REPOSITORY_MAP.md`), **PROPOSED**
(generalizes a current pattern into an OS-wide requirement, not yet mandatory anywhere),
**FUTURE** (not implemented or required today), **UNKNOWN**.

This document does not invent a Skill shape. Every requirement below is either something
all 10 audited Skills already do, something at least 2 of them already do and the other 8
easily could, or an explicit generalization flagged as such. Where the audited repos
disagree or only partially converge, that is stated — this is not smoothed over.

## 1. The convergent pattern (evidence)

`REPOSITORY_MAP.md` documents 10 Skill repos: `video-editing-skill`,
`audio-production-skill`, `color-grading-skill`, `subtitle-skill`,
`motion-graphics-skill`, `thumbnail-skill`, `qc-skill`, `media-analysis-skill`,
`transcription-skill`, `ffmpeg-skill`. Independently, without a shared spec, they
converged on the same shape:

| Element | Found in | Notes |
|---|---|---|
| `SKILL.md`-equivalent + manifest declaring `not_provided` | `ffmpeg-skill` (explicit `not_provided` field) | Others declare boundaries in README/ADR prose, not a machine field — inconsistent today (`REPOSITORY_MAP.md` finding 4) |
| A `contract`/`contract.py` command emitting a machine-readable spec | **all 10** | Richest: `ffmpeg-skill`'s `scripts/_contract.py`, introspected live from `argparse`, so schema cannot drift from implementation. Weakest: most others ship an in-code `contract.py` with no external schema file. `transcription-skill` is the outlier — real standalone JSON Schema files (`schemas/transcript.schema.json` etc.) instead of a generator. |
| A CLI entrypoint, `--json` output | **all 10** | Confirmed the one universal, unbroken interface across the entire ecosystem — stronger convergence than MCP, which only `ffmpeg-skill` ships. |
| A `doctor`/environment-capability-check command | **all 10** (pattern name generalized from `ffmpeg-skill`'s `doctor` capability report, referenced by name in `CORE_PRIMITIVES.md` §3 and `CAPABILITY_MODEL.md` §Provider) | Reports installed binaries/deps, AVAILABLE/MISSING per capability — this is the same mechanism `capabilities/resolver.py` uses for `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` probing in `video-production-agent`. |
| `FORBIDDEN_KEYS`/`FORBIDDEN_ARG_KEYS` parameter denylist | **at least 7 repos**, independently implemented, slightly differently each time (`REPOSITORY_MAP.md` finding 3) | `video-production-agent`: `command, argv, shell, exec, filter_complex, api_key, token`. `qc-skill` additionally denies `filter`. Not identical across repos — a real, present inconsistency, not a hypothetical one. |
| `PathPolicy` with symlink-resolved containment | **all repos that touch the filesystem** | `qc-skill` explicitly resolves symlinks before containment checks "not string-prefix matching, which is spoofable" — the strongest documented version; assumed, not independently re-verified, in the others. |
| `shell=False` / list-argv subprocess only, no `os.system` | **all 10**, confirmed by grep across all 11 repos per `ARCHITECTURE.md` §11 | Universal. No exception found anywhere in the ecosystem. |
| A dedicated `test_security.py`-shaped test | **at least `video-editing-skill`, `audio-production-skill`** confirmed by AST-walk | See §4. |
| A single designated adapter module as the only subprocess launch site | **`video-editing-skill`, `audio-production-skill`, `color-grading-skill`, `motion-graphics-skill`, `thumbnail-skill`** (5 of the skills that delegate to `ffmpeg-skill`) | `qc-skill` and `media-analysis-skill` also invoke `ffmpeg`/`ffprobe` directly but were not documented as having the same AST-walk test — treat as **UNKNOWN**, not confirmed absent. |
| A pinned/ranged dependency on `ffmpeg-skill`, checked at startup via `contract_version` | 5 delegating skills (`video-editing-skill`, `audio-production-skill`, `color-grading-skill`, `motion-graphics-skill`, `thumbnail-skill`) | See §6. |

`qc-skill`, `media-analysis-skill`, and `ffmpeg-skill` itself have no upstream Skill
dependency — they are the three repos that talk to `ffmpeg`/`ffprobe` directly
(`CORE_PRIMITIVES.md` §4).

## 2. Definition

A **Skill**, per `CORE_PRIMITIVES.md` §2, is a versioned, independently deployable
package that implements one or more Capabilities and exposes them through this contract.
This document specifies the concrete, checkable shape of "exposes them through this
contract."

A conformant Skill **CURRENT/PROPOSED (generalized)** publishes and exposes:

1. **A Capability Contract** — the `CapabilityContract` shape defined in `SPEC.md` §1.
   This document does not redefine that shape; it specifies how a Skill must expose it:
   a `contract` subcommand (or equivalent entrypoint for a non-CLI Skill) that emits it
   as JSON on request, with no side effects and no dependency on runtime environment
   state beyond what `doctor` (see §3) separately reports. **CURRENT** as a pattern
   (every repo has *a* contract command); **PROPOSED** that its output conform exactly to
   `SPEC.md`'s shape, since today the 10 repos' contract outputs are inconsistent in
   richness and format (`REPOSITORY_MAP.md` finding 4).

2. **A CLI entrypoint.** **CURRENT**, universal. Must support `--json` output for every
   command whose result an Agent might consume programmatically — already true in all 10
   audited repos.

3. **A `doctor` command.** **CURRENT** as a pattern; reports, per capability the Skill
   declares, whether it is `AVAILABLE` or `MISSING` and why (missing binary, missing
   optional dependency, unmet OS requirement). This is the mechanism
   `SkillRegistry.select_tool()` (`video-production-agent`) already depends on to pick
   between candidates, and the mechanism `CAPABILITY_MODEL.md`'s collision policy assumes
   exists to determine which Providers are even eligible to be chosen from.

4. **A security boundary**, specified precisely in §3 below.

5. **Tests**, specified precisely in §4 below.

6. **A dependency declaration**, specified precisely in §6 below, for any Skill that
   delegates execution to another Skill.

A Skill is **not** required to be written in Python, to use any particular reference
library, or to run as a CLI subprocess specifically (a long-running server process that
exposes the same contract over another transport is not excluded) — see §7,
Language-independence.

## 3. Security requirements

These are lifted directly from `ARCHITECTURE.md` §7's five convergent primitives, made
concrete and testable.

### 3.1 Parameter denylist (FORBIDDEN_KEYS-equivalent)

**CURRENT as convergent practice, PROPOSED as a single canonical list.** Every Skill
must reject, recursively, any parameter object containing keys that would let a caller
inject raw execution control. The union of keys denied across the audited ecosystem
today:

```
command, argv, shell, exec, filter_complex, filter, api_key, token, env
```

A Skill's own domain may require extending this list (e.g. a hypothetical Skill wrapping
a tool with its own dangerous flag) but must never narrow it. This denylist check must
run on every input the Skill accepts before that input reaches any code path that builds
a subprocess argv or a filter expression — not just at the outermost CLI argument parse,
because nested parameter objects (as in `video-production-agent`'s recursive check) are
where several current implementations already look.

### 3.2 No raw shell execution

**CURRENT, universal, zero exceptions found** across all 11 repos (`ARCHITECTURE.md`
§11). A Skill must never call `shell=True`, `os.system`, `os.popen`, backtick/`eval`
equivalents in other languages, or any API that hands a string to a system shell for
interpretation. All process invocation must be list-argv (or the equivalent typed
process-spawn API in another language) so no shell metacharacter in a parameter can be
reinterpreted.

### 3.3 Workspace confinement and no-clobber-input

**CURRENT.** A Skill must resolve every path argument (including following symlinks
before the containment check — `qc-skill`'s pattern, the strongest one documented, and
the one this spec adopts as the requirement rather than string-prefix matching, which is
spoofable) against a declared Workspace root before reading or writing it. Outputs must
be written only inside the declared output workspace. A Skill must never overwrite an
input file — every audited Skill that declares `mutates_input` declares it `false`
(`ffmpeg-skill`'s `ToolSpec`), and this spec makes that mandatory, not merely typical.

### 3.4 Process isolation

**CURRENT.** Every subprocess a Skill starts must run in its own process group, so a
timeout can kill the whole tree rather than leaving orphaned children — this is
`video-production-agent`'s existing pattern, generalized here as a requirement on the
Skill side of the boundary too, for any Skill that itself spawns further subprocesses
(the delegating Skills' single adapter module, see §5).

### 3.5 Untrusted-text tagging

**PROPOSED**, motivated by a real, documented gap: `subtitle-skill` validates cue text
structurally (control characters, line length, reading speed) but has no defense against
that text later reaching an LLM prompt unsanitized (`ARCHITECTURE.md` §7). Any Capability
whose output includes text extracted from untrusted media (subtitle cues, container
metadata, filenames, embedded chapter titles) must tag that field as untrusted in its
`output_schema`, so a downstream Agent's prompt-construction layer can treat it as data,
never as instructions. No repo does this today — it is new, and required going forward
for any Skill whose output includes such text.

## 4. Test requirements

**CURRENT as a partial pattern (confirmed in `video-editing-skill` and
`audio-production-skill`), PROPOSED as a mandatory floor for all Skills.**

A conformant Skill's test suite must include:

1. **A security test** that exercises the FORBIDDEN_KEYS-equivalent denylist (§3.1)
   against every public entrypoint, confirming rejection, not silent stripping — silent
   stripping of a dangerous key is itself a finding worth failing on, since it hides a
   caller's mistake rather than surfacing it.
2. **A path-containment test** that attempts a path-traversal input (e.g. `../`-relative
   paths, absolute paths outside the workspace, a symlink pointing outside the workspace
   — the specific case `qc-skill`'s symlink-resolution pattern exists to catch) and
   confirms rejection.
3. **A no-shell-execution test.** Where the implementation language permits it, this
   should be the AST-walk pattern found in `video-editing-skill` and
   `audio-production-skill`: statically walk every module in the Skill's own source tree
   and assert that no `subprocess`/process-spawn call exists outside the one designated
   adapter module (§5). This is the strongest test in the whole ecosystem because it
   proves an *absence* structurally rather than sampling behavior — it cannot be defeated
   by a code path the test happened not to exercise. Confirmed present in exactly 2 of
   10 repos; **PROPOSED** as a requirement for every Skill going forward, and, for
   languages where a static AST walk is impractical, an equivalent build-time or
   lint-time check (e.g. a linter rule banning the shell-spawning API outside an
   allow-listed file) satisfies the same intent.
4. **A no-clobber-input test**, confirming a Skill's own output path can never equal (or
   resolve to) one of its declared input paths.
5. **Domain tests** proving the Capabilities the Skill declares actually produce the
   declared output types from the declared input types — ordinary correctness testing,
   not new to this spec.

§5.4 below (conformance suite) generalizes items 1–4 into a black-box suite any Skill
must pass regardless of what its own internal test suite looks like — internal tests are
what a Skill author runs during development; the conformance suite is what the OS (or a
third party) can run against a Skill's public interface without reading its source.

## 5. The single-adapter-module pattern (for Skills that delegate execution)

**CURRENT**, verified at the source level in `video-editing-skill` and
`audio-production-skill`; the same shape (unconfirmed by AST-walk specifically, but
present in architecture) in `color-grading-skill`, `motion-graphics-skill`, and
`thumbnail-skill`. This is the single strongest piece of evidence in the whole ecosystem
for how a Skill should delegate media execution to another Skill, and this spec adopts
it as the required shape for any Skill that delegates rather than talking to
`ffmpeg`/`ffprobe` (or another external binary) directly.

A delegating Skill must:

- Designate exactly **one** module (e.g. `ffmpeg_skill.py` or `adapter.py`) as the only
  place in the entire codebase permitted to start a subprocess.
- Locate the dependency Skill's checkout via an environment variable, then well-known
  paths, as a fallback chain (the existing pattern).
- Check the dependency's `contract_version` against a supported range before invoking it
  (see §6 and `VERSIONING.md`).
- Invoke the dependency as a list-argv subprocess with typed arguments only — never a
  filter string or raw argv passed through from the Skill's own caller.
- Prove, via the AST-walk test in §4.3 (or its language-appropriate equivalent), that no
  other module in the codebase starts a subprocess.

A Skill that talks to an external binary directly (as `qc-skill` and
`media-analysis-skill` do with `ffmpeg`/`ffprobe`, and as `ffmpeg-skill` itself does)
applies the same single-designated-module discipline to that binary invocation instead —
the requirement is "exactly one place starts processes," not "must delegate to another
Skill."

## 6. Skill dependencies

**CURRENT**, the exact pattern already used by 5 of the 10 Skills.

A Skill that depends on another Skill (today: every delegating Skill depends on
`ffmpeg-skill`) must declare that dependency in its Capability Contract's `dependencies`
field (`SPEC.md` §1: `{ skill_id, version_range }`), and must check the dependency's
`contract_version` — not its `skill_version` — against that declared range at startup,
failing fast with a clear error if the installed dependency is outside range. This is
already exactly what every `ffmpeg-skill` adapter does today (`SUPPORTED_MIN`/
`SUPPORTED_MAX` checks). See `VERSIONING.md` for why `contract_version` (not
`skill_version`) is the correct axis to pin against, and why a range (not an exact pin)
is the correct granularity.

A Skill must not depend on another Skill's internals (its source, its private modules,
its file layout) — only on its published Capability Contract and its CLI/process
interface. This is already true in the audited ecosystem: no delegating Skill imports
another Skill's Python package; every one shells out to it as a subprocess.

## 7. Language-independence

**PROPOSED**, explicitly named as a design goal in `ARCHITECTURE.md` §9 (red-team lens
8: "can a Skill written in a non-Python language conform? Verdict: yes, because the
Runtime contract is process-boundary-shaped... exactly like every existing Skill already
is"). Nothing in this spec requires Python. It requires:

- A process (or equivalent addressable interface) that can be asked for its Capability
  Contract as JSON.
- A process that accepts typed JSON input and produces typed JSON output — the exact
  shape every audited Skill's CLI already has via `--json`.
- Conformance to §3's security requirements, verified via the black-box suite in §8, not
  via reading the Skill's source or requiring it to import an OS-provided library.

The OS ships a reference implementation of the FORBIDDEN_KEYS/PathPolicy pattern as a
Python library **for convenience**, not as a requirement — a Skill in another language
implements the same guarantees however is idiomatic for it, and is checked the same way
every Skill is checked: by the conformance suite.

## 8. Conformance: what a third-party or non-Python Skill must pass

This is the concrete answer to `ARCHITECTURE.md` §9's open question ("should a
conformance suite be a downloadable harness or a written specification Skill authors
implement their own tests against") to the extent this document can resolve it:
**PROPOSED** as a written specification of black-box checks, derived directly from the
real `test_security.py`-shaped tests already found in the ecosystem (§4), runnable
against any Skill's CLI (or process interface) without reading its source — whether that
specification also ships as a runnable harness is left to `ROADMAP.md`, since building
one is implementation work, not a spec decision.

A conformant Skill (any language, any implementation) **must**:

1. **Publish a CapabilityContract.** Running the Skill's `contract` entrypoint with no
   other arguments produces valid JSON matching `SPEC.md`'s `CapabilityContract` shape,
   including at least one `capabilities[].lifecycle` value from the 5-state model in
   `CAPABILITY_MODEL.md`.
2. **Reject forbidden parameter keys.** For each key in §3.1's denylist (plus any the
   Skill's own contract declares as additional), submitting a call whose typed parameter
   object contains that key (at top level and nested one level deep, mirroring
   `video-production-agent`'s recursive check) must be rejected with a structured error,
   never silently executed and never silently stripped.
3. **Never shell out unsafely.** A black-box test cannot directly observe `shell=True`
   inside a closed-source or compiled Skill, so this is checked two ways: (a) where
   source is available, the AST-walk/lint check in §4.3; (b) where it is not, a
   shell-metacharacter injection probe — submit parameter values containing
   `; rm -rf /`, `` `id` ``, `$(id)`, `&& echo pwned` as ordinary string parameter values
   (e.g. a `logical_name` or path-adjacent field) and confirm the Skill either rejects
   the value structurally or treats it as inert literal text in its output/effects, never
   as an executed command. This is a weaker guarantee than the AST walk and is documented
   as such — it can catch an unsafe implementation but cannot certify a safe one the way
   a structural proof can.
4. **Confine outputs to a declared workspace.** Attempt a call whose output path (or
   output-adjacent parameter, e.g. a working-directory override) points outside the
   declared workspace, including via a symlink that resolves outside it, and confirm
   rejection.
5. **Never overwrite a declared input.** Attempt a call whose output path equals one of
   its input paths and confirm rejection.
6. **Declare a lifecycle state per capability**, per `CAPABILITY_MODEL.md`'s 5-state
   model (`PROPOSED → EXPERIMENTAL → STABLE → DEPRECATED → RETIRED`) — the conformance
   check is presence and validity of the field, not which state is chosen (that is a
   Skill author's own judgment about their own capability's maturity).
7. **Report doctor status.** Running the Skill's `doctor` entrypoint produces a
   machine-readable AVAILABLE/MISSING report per declared capability, without requiring
   the caller to already know what's installed.
8. **Version dependencies by range, not exact pin**, if it declares any (§6) — checked by
   inspecting the `dependencies` field's `version_range` shape, not an exact-version
   string.

A Skill that fails any of items 1–5 is a **structural rejection** from OS compatibility —
this is the mechanism `PLUGIN_MODEL.md` uses to answer "how does the OS reject an unsafe
plugin" without any human code-review judgment call. Items 6–8 are contract-completeness
checks; a Skill missing them is non-conformant but the failure mode is "not discoverable/
composable correctly," not "unsafe."

## 9. What this spec deliberately does not define

- A specific test-runner or CI configuration — orthogonal to conformance, left to each
  Skill's own tooling.
- Performance requirements or SLAs — no evidence anywhere in the audited ecosystem shows
  this is a live concern yet (`ARCHITECTURE.md` §9, red-team lens 5).
- A required programming language, package format, or distribution channel — see §7.
- Resolution of which Skill "wins" when two register as Providers of the same
  Capability — that is `CAPABILITY_MODEL.md`'s collision policy, not a Skill-authoring
  concern.
- How a brand-new Skill gets *proposed* into the ecosystem in the first place — see
  `SKILL_PROPOSAL.md`.
