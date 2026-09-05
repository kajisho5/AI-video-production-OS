# Implementation Protocol: Reporting Externally-Visible Actions

Status: **PROPOSED process document, draft, 2026-09-05.** Unlike every other document in
`docs/`, this one is not derived from `REPOSITORY_MAP.md`'s 11-repo audit evidence — it is
named here honestly rather than dressed up as evidence-derived. It exists because a
separate review (a gap analysis of a large "V4 master prompt" instruction set against this
project's ~50 existing docs) found the same requirement stated three separate times, each
marked "mandatory," and confirmed no existing document in this project covered it. This is
a **process-hygiene addition**, not an OS architectural primitive — see `CORE_PRIMITIVES.md`
§0 for the test this document deliberately does not need to pass ("would a second Agent
and a third-party Skill both need this to interoperate?" — no; this governs how any agent,
human or AI, does implementation work on this ecosystem, not a contract Skills speak to
each other).

## 1. The rule

**Mandatory.** When doing implementation work on this ecosystem, an agent — human or AI,
including Claude Code itself — must **never silently** take an externally-visible or
hard-to-reverse action on the user's behalf. This includes, at minimum:

- Creating a new GitHub (or other) repository.
- Publishing a package (npm, PyPI, or any other registry).
- Provisioning, generating, or requesting a credential, secret, or API key.
- Any action that spends real money.
- Any other action that is hard or impossible to reverse once taken.

Instead, when such an action would be needed to move the work forward, the agent must stop
and emit a structured, clearly-labeled block making that need explicit — never bury the
need in prose, a footnote, or an aside three paragraphs into a report.

## 2. The block format

```
## NEW SKILL REQUIRED / USER ACTION REQUIRED
- Reason: <why existing Skills/Capabilities/Providers cannot satisfy this>
- Proposed repository name: <name>
- Purpose: <one sentence>
- Proposed Capabilities: <capability ids>
- Proposed Capability Contract sketch: <brief>
- What the user needs to do: <e.g. "create the GitHub repo, we'll scaffold it once it
  exists" / "approve npm publish" / "provide an API key for X">
```

Not every field applies to every action — a request to provision a credential, for
example, has no "proposed repository name." Fill in what's relevant, mark the rest "n/a"
explicitly rather than omitting the heading structure. The heading itself
(`## NEW SKILL REQUIRED / USER ACTION REQUIRED`) is what matters: it must appear verbatim
enough that a reader or a downstream tool scanning a report can find it by searching for
that string.

## 3. When this block is required

- Creating a new repository (Skill or otherwise).
- Publishing to npm, PyPI, or any other package registry.
- Provisioning any credential, secret, or API key — including asking the user to generate
  one, not only generating one directly.
- Any action that spends real money.
- Any action that is hard to reverse — deleting a repository, force-pushing over shared
  history, rotating or revoking a credential in use elsewhere, or anything with a similar
  blast radius.

This mirrors, at the process level, this project's own operating principles about
irreversible actions: `ARCHITECTURE.md` §3 already draws a hard line that "the OS never
makes a production decision" and that an Agent "never emits a raw shell command... in
place of a typed Operation" — the common thread across both is the same one careful
engineering practice generally applies to destructive or hard-to-reverse operations: make
the consequential step an explicit, visible, approved one, never an implicit side effect
of doing the requested work. This document is that same discipline applied to the
*implementation-and-operations* layer (repos, publishing, credentials) rather than the
*runtime execution* layer (subprocess calls, file writes) those sections already cover.

## 4. When this block is NOT required

- Opening a pull request against an **existing** repository.
- Editing docs, code, or configuration already tracked in a repo the agent has access to.
- Running tests, linters, or any other read-only or already-sandboxed check.
- Any action that is reversible and already authorized by the scope of the task at hand —
  e.g. committing to a feature branch the user asked for, editing a file the user asked to
  be edited, or running a build.

The dividing line is not "is this API call risky-sounding" — it is **externally visible or
hard to reverse, and not already covered by the user's explicit ask**. A user who asks
"open a PR fixing this bug" has already authorized opening that PR; a user who asks "fix
this bug" has not thereby authorized creating a new repository to hold the fix.

## 5. Where the block goes

**Top-level, unmissable — never buried.** When an agent's output is a report, a PR
description, or any other deliverable, the `NEW SKILL REQUIRED / USER ACTION REQUIRED`
block goes at the **top** of that deliverable, before the summary of what was done, not
appended at the end after a reader could plausibly have stopped reading. If the deliverable
is a chat response rather than a written document, the same rule applies to that response:
lead with the block, not with everything else that was accomplished around it. The reasoning
is not stylistic — a block that is technically present but positioned after three screens of
otherwise-normal-sounding progress notes fails the actual goal of this document (an action
the user must approve should be impossible to scroll past unnoticed), even though the letter
of §2's format was followed.

## 6. Relationship to `SKILL_PROPOSAL.md`

This document is the **reporting mechanism**; `SKILL_PROPOSAL.md` is the **content and
criteria**. They answer different questions:

- `SKILL_PROPOSAL.md` answers *"should this be a new Skill repository at all, and if so,
  what must the proposal contain to be evaluated?"* — the template (problem, Capabilities
  provided, inputs/outputs, dependencies, permissions, discovery, testing) and the
  granularity criteria that keep a proposal from being Skill-explosion or a monolith.
- This document answers *"once implementation work concludes a new repository (or a
  credential, or a publish) is genuinely needed, how does the agent doing that work
  surface that need to the user, in a way that cannot be silently acted on instead?"*

Concretely: an agent that reaches `SKILL_PROPOSAL.md`'s step 4 (per its new decision-tree
section — see there) and concludes a new Skill repository really is warranted does **not**
then go create that repository. It fills in the `SKILL_PROPOSAL.md` template as the content
of the "Proposed repository name / Purpose / Proposed Capabilities / Proposed Capability
Contract sketch" fields in **this** document's block (§2), and surfaces the block per §5.
`SKILL_PROPOSAL.md`'s reviewer (today, the sole maintainer) reads that content to decide;
this document exists so the decision is theirs to make, in an unmissable and explicit
place, rather than a decision an agent makes for them by simply proceeding.

## 7. Relationship to `GOVERNANCE.md`

`GOVERNANCE.md` §1 is explicit that this project's process is sized for a single maintainer
today, and warns against "inventing process for a scale this project has not reached." This
document is written to the same discipline: it is **not** a ticketing system, an approval
workflow with states, or a queue an agent files a request into and waits on. It is a
**clearly labeled markdown block** an agent emits inline, in its own output, at the point
the need arises. The user reads it the same way they read anything else the agent produces,
and responds in whatever channel they're already using (approving in chat, creating the
repo and saying so, providing the credential). Nothing about this document requires new
tooling, a new file location, or a new review cadence — it is exactly as lightweight as
`GOVERNANCE.md`'s existing ADR process, applied to a different kind of decision (an
operational action, not an architectural one).

## 8. Worked example

An agent implementing `voice-production-skill` (the illustrative worked example in
`SKILL_PROPOSAL.md` §3) finishes drafting its Capability Contract, code, and tests inside a
local working copy, and then needs somewhere to push it. It does not run a "create
repository" tool call on its own initiative. It instead emits, at the top of its report:

```
## NEW SKILL REQUIRED / USER ACTION REQUIRED
- Reason: no existing Skill or Capability provides per-speaker dialogue-leveling or
  de-essing; audio-production-skill's typed operations don't cover this judgment domain
  (see SKILL_PROPOSAL.md worked example).
- Proposed repository name: voice-production-skill
- Purpose: provide voice.deess and voice.level-match as new Capabilities.
- Proposed Capabilities: voice.deess, voice.level-match
- Proposed Capability Contract sketch: input audio (or video with embedded audio), output
  audio; depends on ffmpeg-skill (pinned contract_version range); no network access.
- What the user needs to do: create the GitHub repository (kajisho5/voice-production-skill
  or preferred name) — the agent will scaffold the Skill contract, code, and conformance
  tests into it once it exists.
```

The rest of the report — the drafted contract, code, and test plan — follows below the
block, not instead of it.

## 9. What this document deliberately does not define

- Any change to `SKILL_PROPOSAL.md`'s template or review criteria — those are unchanged;
  see §6.
- Any change to `GOVERNANCE.md`'s ADR process — an accepted "NEW SKILL REQUIRED" outcome
  that becomes a real Skill still goes through `SKILL_PROPOSAL.md` review and, if it
  changes an OS-level contract, an ADR per `GOVERNANCE.md` §2, exactly as it would without
  this document existing.
- A programmatic enforcement mechanism (a linter that fails a PR lacking this block, a bot
  that scans for the heading). **FUTURE**, and speculative — no evidence yet that manual
  discipline is insufficient, and building enforcement tooling before that evidence exists
  would be exactly the kind of process-astronautics `GOVERNANCE.md` §4 already argues
  against for architectural process; the same restraint applies here.
