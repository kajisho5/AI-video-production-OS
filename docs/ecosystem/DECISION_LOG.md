# Decision Log — cross-repository / ecosystem-level judgment calls

**Status: CURRENT / IMPLEMENTED** (this document; a real log of decisions actually made).

This is not `docs/adr/` (this repo's own formal architecture ADRs — numbered, one
proposal/decision/consequence each) and not `docs/ECOSYSTEM_CHANGELOG.md` (what changed,
factually, in which PR). This is the smaller set of judgment calls made *while operating*
this project autonomously across repositories — the kind of thing a fresh session needs to
know so it doesn't re-litigate a question already thought through, or reverse a decision
without realizing one was made.

## D1 — Do not touch `video-production-agent`'s `SkillRegistry` yet

**Context**: discovered (2026-09-05, this session) that `video-production-agent` already
has a working, tested, independently-designed Skill→Tool selection mechanism
(`SkillRegistry.select_tool`), solving a problem this project's own `docs/ROADMAP.md`
Phase 4 describes as unbuilt future work.

**Decision**: do not rewrite, extend, or "upgrade" `video-production-agent`'s registry to
consume this project's `provides`/`registry/` mechanism without a separate, explicit
investigation and plan. Record the discovery in `CURRENT_STATE.md` and queue the
investigation in `WORK_QUEUE.md` instead of acting on it immediately.

**Why**: `video-production-agent`'s registry is real, tested (187 tests), and underlies a
working end-to-end pipeline already in production use by its own author. It is not this
project's repository to rewrite unilaterally (per this project's own cross-repository rule:
"the smallest coherent change," "each repository remains independently maintainable").
Its own ADRs (028–032) are explicit and repeated on one point: "no shortcuts" between
layers — replacing a working, deliberately-static registration model with a dynamic one
is exactly the kind of "architecture inflation" this project has been told to avoid
introducing without genuine necessity. The right first step is investigation (does the
static model actually need to change, or does it already satisfy the spirit of "Capability
Discovery" well enough with a thinner connecting layer?), not a rewrite.

## D2 — Merge conflicts on Skill PRs are resolved with a `main` merge, not a rebase

**Context**: `ffmpeg-skill#24` (this project's own PR, on branch
`claude/add-capability-provides-field`) developed a real merge conflict after
`ffmpeg-skill#23` (a human-authored PR, typed colour correction) merged to `main` first.

**Decision**: merged `main` into the PR branch (one merge commit), resolved the one real
conflict (`CHANGELOG.md`, both sides added a section — kept both), verified both changes
still work together, pushed, and left one PR comment explaining what happened.

**Why**: matches this project's own standing PR-maintenance rules (merge, don't rebase, on
a conflict; never force-push over a shared branch) and the general principle that a PR this
project opened is this project's to keep green — a conflict is work now, not something to
wait out.

## D3 — `media-analysis-skill`'s five previously-unassigned Capability ids were resolved by direct code comparison, not by guessing

**Context**: the Phase 2 `provides` rollout initially left `media_probe`, `stream_layout`,
`video_format`, `audio_format`, `duration` unassigned because `CAPABILITY_MATRIX.md` §8c
hadn't pinned individual ids for them, and two real collision risks were unresolved
(`video_format` vs. `qc-skill`'s `measure.video.format`; `ffmpeg-skill`'s own `probe` tool).

**Decision**: resolved both risks by reading the actual implementations (not by inference
from names or descriptions) before assigning five new ids (`measure.media.probe`,
`measure.media.stream_layout`, `measure.video.probe`, `measure.audio.probe`,
`measure.media.duration`).

**Why**: this project's own repeated principle — never invent a capability id assignment
without verifying it against real code, because a wrong assignment (a false collision, or a
missed real one) is worse than leaving the gap open and documented. See
`CAPABILITY_MATRIX.md` §8c's "RESOLVED 2026-09-05" annotations for the specific evidence
each id's assignment rests on.

## D4 — This project maintains its own `provides`-based `registry/`, distinct from and not yet wired into `video-production-agent`'s registry

**Context**: two Skill/Provider selection mechanisms now coexist in the ecosystem — this
project's `registry/` (Capability-id-based, generic, not agent-specific) and
`video-production-agent`'s `SkillRegistry` (production-skill-name-based, hand-registered,
proven in production).

**Decision**: keep both, for now, rather than forcing a premature merge or deprecating
either. `registry/`'s README already states plainly what it is not ("not Phase 3", "not a
live registry") — this decision doesn't change that scope, it just makes explicit that
"connect the two" is deliberately deferred, not forgotten.

**Why**: per D1, a real investigation (which parts of `video-production-agent`'s selection
logic could be *expressed* in terms of `provides` without changing its behavior, versus
which parts depend on assumptions `provides` doesn't capture, like declared-order fallback
policy) needs to happen before either mechanism should change. Forcing convergence before
that investigation risks breaking the one thing in this whole ecosystem that is a real,
working, end-to-end system today.

## D5 — `workspace_confinement`/`no_clobber_input` were redesigned around observable behavior, not the originally-planned request-mutation shape

**Context**: these two `SKILL_SPEC.md` §8 checks were originally scoped the same way as
`forbidden_keys_rejected` — submit a request with a bad value (an output path outside the
workspace, or equal to an input path) and confirm the Skill rejects it. Live testing
against `qc-skill` (the only Skill this conformance harness currently exercises against a
real process) found that shape doesn't fit: `qc-skill`'s `run` request schema has no
output-path field at all — its operations (`validate`/`inspect`/`check`) are read-only
measurement returning a report on stdout, and its on-disk report cache writes to a fixed
path under the workspace via a code path (`PathPolicy.resolve_output()`) that exists but
is never actually called anywhere in the real codebase (confirmed by `grep -rn` finding
zero call sites).

**Decision**: redesigned both checks around properties observable from outside the
process, real for any Skill regardless of whether it exposes a request-level output-path
field: `workspace_confinement` snapshots directories outside the declared workspace
before/after one real, synchronous run and fails if any gained a file;
`no_clobber_input` hashes the input fixture before/after and fails if its content
changed.

**Why**: this project's rule against unearned claims applies as much to a conformance
check's own design as to a status label — a check whose only test target doesn't have
the field the check assumes would either be permanently `NotImplementedError` (true but
stalled) or would need a synthetic fake to exercise (proving nothing about a real Skill).
The observable-behavior redesign is answerable against `qc-skill` as it actually exists
today, and the property it verifies (no stray writes outside the workspace; the input is
never mutated) is the same real safety guarantee `SKILL_SPEC.md` §8 items 4-5 are meant
to protect, reached by a different, equally valid route.

## D6 — `no_unsafe_shell_out` uses a full AST walk, not a text/regex scan, after the regex draft produced two real false positives

**Context**: the first implementation of this check scanned each Skill's source files
as raw text for patterns like `shell=True`, `eval(`, `exec(`. Run against the real
ecosystem (all 9 Python Skills' actual cloned source), it immediately produced two false
FAILs: `qc-skill`'s `rules.py` has a comment literally reading "no eval()/exec()... or
shell" (documenting the constraint, not violating it), and `subtitle-skill`'s
`engine.py` module docstring says "no shell=True" for the same reason — plus a related,
distinct false positive where the AST-level check itself flagged the safe, explicit
`shell=False` keyword as if any `shell=` presence were dangerous.

**Decision**: rewrote the check to walk the parsed AST exclusively, with no text/regex
fallback: `eval`/`exec` are only flagged as an `ast.Call` whose `func` is a bare
`ast.Name`, `os.system`/`os.popen` only as an `ast.Attribute` call, and a `shell=`
keyword's `ast.Constant` value is inspected directly — `False` clears, `True` fails, and
anything else (a variable, a dynamic expression) fails conservatively as "cannot
statically prove this is never True."

**Why**: a comment or docstring is a string literal in the AST, never a `Call` node, so
switching from text to AST structure eliminates the false-positive class entirely rather
than trying to special-case comment syntax on top of a fundamentally text-based
approach. This is the same principle D5 already established for `workspace_confinement`/
`no_clobber_input`: test the actual, real behavior of real ecosystem code before
trusting a check's first design, and fix the check's *design* rather than special-casing
away an inconvenient real finding. Verified: all 9 real Python Skills now correctly PASS
(`registry/tests/test_no_unsafe_shell_out.py` also carries both false positives as
permanent regression tests).
