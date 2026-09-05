# Security Model

This document specifies the OS's trust boundaries. Per `SPEC.md` §7, no repository in
this ecosystem talks to a network service today, so the trust boundaries that exist are
**filesystem and subprocess**, not network/auth — this document does not invent a
network security model the ecosystem has no evidence of needing yet. Every primitive
below is drawn from a pattern **independently reinvented in at least seven of the eleven
audited repositories**, which `REPOSITORY_MAP.md` finding 3 and `ARCHITECTURE.md` §7
both name as the strongest possible evidence that these belong in a shared OS-level
contract rather than being re-derived by the next Skill author.

## 1. The convergent pattern (CURRENT, evidence base)

Five primitives, found independently — not copied from a shared library, since no such
library exists yet — across `ffmpeg-skill`, `qc-skill`, `media-analysis-skill`,
`video-editing-skill`, `audio-production-skill`, `color-grading-skill`, and
`transcription-skill`:

1. **A `FORBIDDEN_KEYS`/`FORBIDDEN_ARG_KEYS` denylist**, applied recursively to parameter
   trees before they can reach any adapter or subprocess call. Blocked keys include
   `command`, `argv`, `shell`, `exec`, `filter`/`filter_complex`, `api_key`, `token`, and
   `env`-shaped keys. `qc-skill` and `video-production-agent` both implement this
   independently, with `qc-skill` additionally denying `filter`/`filter_complex`
   specifically because ffmpeg filter-graph strings are the ecosystem's own recognized
   injection surface.
2. **`PathPolicy` with symlink-resolved containment.** Every audited Skill that touches
   the filesystem resolves symlinks *before* checking containment, never checking by
   string-prefix match on the unresolved path. This distinction is real, not
   pedantic: a string-prefix check on `/workspace/input.mp4` passes even if that path is
   a symlink pointing outside `/workspace` entirely; a symlink-resolved check does not.
   `color-grading-skill` goes further with a *separate* path allowlist for LUT files vs.
   input media roots — `REPOSITORY_MAP.md` calls this "a detail worth generalizing," and
   this document adopts it as the general pattern: a Skill may need more than one
   containment root, and the Runtime contract must support declaring several, not just
   one workspace root.
3. **`shell=False` / list-argv subprocess invocation, exclusively.** Confirmed by grep
   across the entire ecosystem: **zero** occurrences of `shell=True` or `os.system`
   anywhere in any of the 11 repositories. Every subprocess call passes an argument list,
   never a string a shell would interpret. `ffmpeg-skill`'s raw `{"argv": [...]}` escape
   hatch (explicitly marked `contract: false`) still only ever invokes the named script
   with a list-argv call — never a shell — even in its least-typed entrypoint.
4. **Workspace-confined, never-clobber-input output policy.** Outputs must be written
   inside the declared workspace root(s); `mutates_input: false` is declared and enforced
   for every tool in `ffmpeg-skill` — source files are never overwritten by any operation
   in the ecosystem.
5. **Process-group timeout with kill-tree semantics.** Every subprocess runs in its own
   process group specifically so a timeout kills the whole tree, not just the immediate
   child — relevant because `ffmpeg` itself can spawn helper processes, and a naive
   single-PID kill would leave orphans running.

This is the evidence base, not a hypothesis: `CORE_PRIMITIVES.md` §4 formalizes it as the
**Runtime** primitive precisely because the same five things were built the same way by
different authors working from different starting points, independently — the strongest
signal available in this audit that a design is right, not merely convenient for one
Skill.

## 2. Why this becomes a Runtime contract with a reference library AND a conformance suite

Per `CORE_PRIMITIVES.md` §4 and `ARCHITECTURE.md` §9.3 (the security red-team lens): a
shared **reference library** is necessary so Python Skills stop re-deriving the same five
primitives (seven times is enough), but a reference library alone has an obvious bypass —
nothing stops a Skill (particularly a third-party or non-Python one) from simply not
importing it. `ARCHITECTURE.md` §9.3's own verdict is the one this document adopts
unchanged: the fix is a **black-box conformance test suite** any Skill must pass
regardless of implementation language, exercised against the Skill's actual process
boundary (its CLI/stdio contract) rather than against its internal source code. Concretely,
conformance testing should include, at minimum, the same adversarial classes
`video-production-agent`'s own eval suite already names (`20_path_traversal_block.json`,
`11_plan_hostile_ai_no_leakage.json`) generalized to any Skill: does the Skill refuse a
`FORBIDDEN_KEYS`-shaped parameter, does it refuse to write outside its declared
workspace root(s), does it refuse a symlink-based containment escape, does it actually
terminate on timeout (process group, not just parent PID).

This two-tier design — library for convenience, black-box tests for guarantee — is the
direct answer to "does formalizing this centrally create a single point of bypass if a
Skill just doesn't use the library": no, because the guarantee is enforced by testing
observable behavior at the process boundary, not by trusting voluntary adoption of a
particular implementation (`SKILL_SPEC.md` §Conformance carries the full test-suite
specification; this document only states why one is required).

## 3. Filesystem isolation and path policy (CURRENT pattern, generalized)

- **Containment is symlink-resolved, never string-prefix.** §1.2 above; this is the one
  detail every Skill author converged on getting right and is the version this OS
  standardizes, not a naive prefix check some Skills happen to use.
- **Multiple named roots, not one workspace.** Generalizing `color-grading-skill`'s
  separate LUT-file allowlist: a Runtime-conforming Skill declares each root it needs
  (input media root, output workspace root, reference-asset roots such as LUTs or
  subtitle template files) rather than assuming one undifferentiated workspace directory.
- **`-protocol_whitelist file` and PATH-only binary resolution**, per
  `media-analysis-skill`'s and `qc-skill`'s pattern: ffmpeg/ffprobe are never given a URL
  scheme beyond `file`, and are located via `PATH`, not a caller-supplied executable
  path — closing off a class of "point the tool at an arbitrary binary" substitution
  attack.
- **Never-clobber-input.** Restated from §1.4: an Operation's output artifact is never
  written over one of its own input artifacts' paths.

## 4. Subprocess restrictions (CURRENT pattern, generalized)

- `shell=False`, list-argv, always (§1.3).
- **Scrubbed environment** passed to every child process — the pattern used across
  `qc-skill` and `media-analysis-skill` for subprocess invocation, generalized as a
  Runtime requirement: a Skill's child process should not inherit the parent's full
  environment (which could contain secrets irrelevant to the Skill's task) unless
  explicitly declared as a dependency.
- **`-nostdin`** (used by `media-analysis-skill`/`qc-skill`'s ffmpeg invocations) so a
  hung or misbehaving ffmpeg process cannot block waiting on stdin it should never read.
- **Own process group per subprocess**, for kill-tree timeout enforcement (§1.5).
- **No raw shell escape reachable from a typed Operation.** `SYSTEM_CONSTRAINTS` in
  `video-production-agent` hard-codes `execution.no_raw_shell` as a system-level
  invariant — this document elevates that from an Agent-level constant to an OS Runtime
  guarantee, verified by the conformance suite (§2), not merely declared in one Agent's
  constants file.

## 5. Resource limits (CURRENT — honest, present gap, not hypothetical)

**This is a real limitation today, not a risk being flagged defensively.** Every
audited Skill enforces a **wall-clock timeout** (via the process-group kill-tree
mechanism, §1.5/§4). None enforces CPU, memory, or disk-space limits:

- `ffmpeg-skill` has **no per-encode timeout on its main scripts at all** — only
  `verify.py` sets one. A long-running or resource-heavy encode on the other 20 scripts
  has no built-in ceiling.
- `qc-skill` and `media-analysis-skill` both **document, explicitly and honestly, that
  they do not enforce CPU/memory/disk resource limits** — only the wall-clock timeout
  exists.

**What this document proposes and what it does not:** consistent with
`ARCHITECTURE.md` §10's Resource Model (deliberately minimal — no scheduler, no
concurrency model, because no audited repo shows evidence of needing one), this document
does **not** propose a resource-limiting subsystem (cgroups, rlimits, container
sandboxing) as OS-kernel work. That would be solving a problem with no evidence behind it
yet, and would be exactly the "architecture astronautics" this project's rules forbid.
What this document does propose, as a minimal, immediately actionable Runtime-contract
requirement: (a) **every** Skill script gets a wall-clock timeout by default at the
Runtime layer, not opt-in per script — closing `ffmpeg-skill`'s specific 20-script gap
without inventing new limit categories; (b) resource-limit enforcement beyond wall-clock
remains an explicitly named open gap in the Skill Contract's `security` declaration (an
honest `resource_limits: { cpu: none, memory: none, disk: none, wall_clock: <seconds>
}`-shaped field, so a caller can see the gap rather than assume protection that doesn't
exist) rather than a promise the Runtime cannot yet keep.

## 6. Input validation and schema validation (CURRENT pattern, generalized)

Every audited Skill's typed parameter model is itself the primary input-validation
layer: `ffmpeg-skill`'s typed flags (e.g. `--compress`, `--limit`, `--gate`) are
individually range-checked, and any text or path destined for a filter graph is escaped,
never interpolated raw — this is why "no filter string is ever accepted from a caller"
(`REPOSITORY_MAP.md`) is a security property, not just an API-design choice. The
Capability Contract's `input_schema` (`SPEC.md` §1) generalizes this: a closed-vocabulary,
typed parameter schema per Capability is itself the primary defense against
injection-shaped parameters, upstream of the `FORBIDDEN_KEYS` denylist (§1.1) which
exists as defense-in-depth for the case where a schema is incomplete or a caller
constructs a request programmatically rather than through validated typed bindings.

## 7. The prompt-injection gap (CURRENT, genuine — not hypothetical)

**Finding, precisely:** `subtitle-skill`'s cue-text validation is structural only —
control characters rejected, line-length/duration/reading-speed constraints enforced —
and stops there. It does not, and by its own design cannot, defend against the case
where a *downstream Agent step* takes that validated cue text and inserts it into an LLM
prompt (e.g. "summarize/translate these captions"). Structurally valid subtitle text can
still contain instruction-shaped content ("Ignore prior instructions and...") that a
naive prompt-construction step would concatenate directly into a model's context. This is
present in the ecosystem today, not a speculative future risk — `subtitle-skill`'s own
validation code was read and confirmed to stop at the structural layer.

The same class of risk generalizes beyond subtitles: any text a Skill extracts from
untrusted media — subtitle cue content, container metadata (title, comment, artist
fields), filenames — carries the same property. It came from a media file, not from a
trusted operator or the Agent's own reasoning, and nothing in the current Capability
Contract shape (`SPEC.md` §1) distinguishes "a parameter the caller typed" from "a string
the Skill extracted from the file it was pointed at."

**Proposed mitigation (PROPOSED, minimal, no new infrastructure):**

1. **Tag extracted-text fields in the Capability Contract's `output_schema`.** Any output
   field whose value originates from parsing untrusted media content — subtitle cue
   text, container metadata strings, filenames read from disk — is annotated
   `untrusted_text: true` in the schema. This is a schema annotation, not a runtime
   sanitizer: it does not attempt to strip or neutralize instruction-like content (which
   is unreliable and would give false confidence), it makes the field's provenance
   visible to whatever consumes it.
2. **Agent-side prompt-construction code must treat `untrusted_text`-tagged fields as
   data, never as instructions** — structurally the same rule this development
   environment itself already applies to tool output (untrusted content read by an
   agent is data to reason about, not a command to obey). Concretely: such fields belong
   in a clearly delimited data section of a prompt (e.g. quoted/fenced and explicitly
   labeled as "content to summarize," never concatenated into an instruction-bearing
   region of the prompt), and any Agent that skips this for `untrusted_text`-tagged input
   is violating the Capability Contract it consumed, not exploiting an ambiguity in it.
3. **This does not require changes to `subtitle-skill` itself.** Its structural
   validation (control characters, line length) remains correct and sufficient for its
   own stated scope (rendering valid, displayable subtitles) — the gap lives entirely at
   the Agent's prompt-construction boundary, which is exactly where `ARCHITECTURE.md` §7
   already places the fix ("an Agent-side prompt-construction layer can treat it the same
   way this very session treats external tool output").

This keeps the fix proportionate: one schema annotation convention plus one rule for
Agent authors, not a content-sanitization engine, not an LLM-based "detect prompt
injection" filter (which would itself be a nondeterministic component making a security
decision — precisely the kind of thing §8 argues against introducing without evidence it
is needed).

## 8. Future risks: malicious media and third-party Skill code

These are named as **future/architectural risks the model must remain compatible with**,
not problems solved here — inventing solutions with no present evidence of the specific
threat manifesting would be the architecture astronautics this project's rules forbid.

- **Malicious media/project files.** A crafted media file could attempt to exploit a
  parser vulnerability in `ffmpeg`/`ffprobe` themselves (the actual decoding surface every
  Skill delegates to). This risk is real but sits **outside** this OS's control surface —
  `ffmpeg-skill` is a Skill that wraps the `ffmpeg`/`ffprobe` binaries; hardening those
  binaries' own parsers is upstream FFmpeg-project work, not something a Capability
  Contract or Runtime policy can patch. What the Runtime *can* and does own: `qc-skill`'s
  decode-integrity check (§`QC_ARCHITECTURE.md` §2) already gives the ecosystem a
  deterministic way to detect that a file failed to decode cleanly, which is the
  detection half of this risk; the OS does not claim to solve the prevention half.
- **Third-party Skill code as a plugin surface.** Once a third-party, non-cooperating
  Skill can register Capabilities (`CAPABILITY_MODEL.md`, `ARCHITECTURE.md` §9.2's
  extensibility lens), the conformance test suite (§2) verifies *observable behavior at
  the process boundary* — it does not sandbox the Skill's process, and it cannot verify
  properties the test suite doesn't specifically check for. A malicious Skill that passes
  every conformance test could still misbehave in ways outside the tested surface (e.g.
  exfiltrating data over network access the conformance suite doesn't probe for, if the
  Runtime contract does not also constrain network access — which no audited Skill
  currently needs or uses). True process-level sandboxing (containers, seccomp profiles,
  network denial by default) would close this gap further but has no precedent anywhere
  in the audited ecosystem and is marked **UNKNOWN / FUTURE** — a Roadmap question for if
  and when third-party, non-cooperating Skills become a real deployment shape, not a
  problem this document invents a solution for today.

## 9. What this document deliberately does not include

Per the task's explicit instruction to avoid architecture astronautics: no
authentication/authorization model (no repo talks to a network service, per `SPEC.md`
§7); no blockchain or distributed-ledger anything; no cryptographic signing scheme beyond
the content-hashing already used for Artifact/Report identity (`PROVENANCE.md` §1, §4) —
hashing here is an identity and tamper-*detection* mechanism already proven in
`qc-skill`'s cache, not a security control against a motivated adversary controlling the
hash's own storage; no sandboxing/container runtime (§8, marked future/unknown rather
than designed); no resource-scheduling or quota system (§5's honest gap is named, not
"solved" with unevidenced machinery).
