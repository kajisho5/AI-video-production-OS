# Design System (Docs & Repository Style)

Status: **CURRENT convention, draft, 2026-09-05.** This document describes the visual and
structural conventions this project's documentation and repositories already follow (or
should follow going forward for consistency), not a product or UI design system. Per
`REPOSITORY_MAP.md`, there is no UI anywhere in this ecosystem today, and Rule 9 ("no
abstraction without concrete value" — see `CAPABILITY_MODEL.md`, `ARCHITECTURE.md` §9)
argues directly against designing one speculatively. Everything below is scoped to
Markdown documents, Mermaid diagrams, repository naming, and README structure.

## How to read this doc

This is a style guide, not a technical spec — it is intentionally short. Where a
convention is already used consistently across this project's documents (the status-tag
system in particular), this document describes it precisely enough to apply without
guessing; where it is a new suggestion for future Skill repos, it is marked as such.

## 1. Document structure

Every document in this project's `docs/` follows the same shape, already visible in
`ARCHITECTURE.md`, `CORE_PRIMITIVES.md`, `CAPABILITY_MODEL.md`, `SPEC.md`,
`REPOSITORY_MAP.md`, `EXECUTION_MODEL.md`, `SKILL_SPEC.md`, and `ARTIFACT_MODEL.md`:

1. **Title** — a single `#` heading naming the document.
2. **Status line**, immediately below the title, in the form:

   ```
   Status: **<state>, <draft|final>, <date>.** <one or two sentences of context.>
   ```

   e.g. `Status: draft architecture, Phase 0 (research) deliverable.` or
   `Status: **Evidence-based, current as of 2026-09-05/06.**` The bold lead phrase names
   what kind of document this is (evidence audit, draft architecture, technical spec,
   process doc); the date anchors it in time so a reader can judge staleness at a glance.
   A document has exactly one status line, at the top, never restated mid-document.

3. **"How to read this map/doc" section**, where useful — a short paragraph immediately
   after the status line explaining any convention specific to that document (e.g.
   `REPOSITORY_MAP.md` §"How to read this map" explains its four-category tagging before
   using it 11 times). Not every document needs one; add it when a reader would otherwise
   have to infer a convention from repeated use rather than being told once.
4. **Body**, organized under numbered or named `##` sections.
5. **A closing "what this document deliberately does not define/cover" section**, where
   applicable (`SPEC.md` §7, `SKILL_SPEC.md` §9, this document's own §6) — an explicit
   scope boundary is preferred over a document that silently omits something a reader
   might expect and wonder if it was an oversight.

## 2. CURRENT / FUTURE / EXPERIMENTAL / UNKNOWN tagging

This is the single most load-bearing convention across this project's documents, and it
must be used precisely and consistently:

- **CURRENT** — exists in code today, verified by reading it. Never used for something
  merely planned or merely typical-sounding.
- **FUTURE** (also seen as "FUTURE INTENDED") — described in docs/ADRs as a direction, or
  proposed by this project's own documents, but not implemented anywhere yet.
- **EXPERIMENTAL** — exists in code but is unstable, stubbed, or explicitly marked
  provisional by its own repo.
- **UNKNOWN** — could not be determined from available evidence; used instead of silently
  guessing or omitting the question.

A few documents add a fifth, narrower tag, **RENAME** — used only when a concept already
exists in code but this project's documents give it a different name or narrower scope to
resolve a real ambiguity found in the audit (e.g. → Timeline in `CORE_PRIMITIVES.md` §8,
`GLOSSARY.md`). Do not invent additional tags beyond these five; the value of this
convention is that a reader who has seen it once in `REPOSITORY_MAP.md` can rely on it
meaning the same thing in every other document in this project.

**Where to place the tag:** as a bold lead-in to the paragraph or section it qualifies —
`**CURRENT**, adopted as-is.` / `**FUTURE** — does not exist as a discrete artifact
anywhere today.` — not as a separate column or footnote, and not applied at a granularity
finer than a paragraph (don't tag individual words or table cells; tag the claim).
Every substantive technical claim in a document should be traceable to one of these four
tags, either directly or by inheriting the tag of the section it's in — an untagged claim
in a technical doc reads as an unintentional gap, not a stylistic choice.

## 3. Mermaid diagrams

Use a diagram only when a DAG, dependency direction, or process boundary is genuinely
easier to see than to read as prose — most of this project's documents (including all
five finalized ones) currently make their case in prose and tables rather than diagrams,
and that is a legitimate choice, not a gap to fill in. When a diagram is used:

- Prefer `graph TD` (top-down) for a layered/dependency view (e.g. OS → Agent → Skills) or
  `graph LR` (left-right) for a pipeline/flow view (e.g.
  `Observation → Event → Inference/Decision → ProductionPlan → ... → Artifact → QA`).
- No custom colors, no `classDef` styling, no icons — plain nodes and labeled edges only.
  This project's technical content should stand on precise labels, not visual styling; a
  diagram that needs color-coding to be readable usually means the diagram is trying to
  carry too many distinct facts at once and should be split.
- Keep node labels to the project's own real names (Capability, Skill, Provider,
  Operation, Artifact, ...) exactly as spelled in `GLOSSARY.md` — never an abbreviation or
  a paraphrase that could be mistaken for a different primitive.
- A diagram supplements the prose that already states the same fact; it never carries
  information the prose doesn't also state in words, since Mermaid source is not always
  legible to every downstream reader/tool.

## 4. Naming conventions

### 4.1 Skill repositories

Every future Skill repository should match the naming pattern of the 10 existing ones
exactly:

- **kebab-case**, all lowercase.
- Domain name followed by a literal `-skill` suffix: `<domain>-skill` (e.g.
  `video-editing-skill`, `audio-production-skill`, `color-grading-skill`,
  `subtitle-skill`, `motion-graphics-skill`, `thumbnail-skill`, `qc-skill`,
  `media-analysis-skill`, `transcription-skill`). `ffmpeg-skill` is the one existing
  exception where the domain name is the underlying tool rather than a production
  activity — acceptable when a Skill's whole domain genuinely *is* wrapping one specific
  external engine or binary, per the same reasoning `CAPABILITY_MODEL.md` uses to justify
  `ffmpeg-skill`'s breadth (one shared execution substrate).
- Avoid version numbers, author names, or marketing adjectives in the repo name itself —
  none of the 10 existing repos do this, and `SKILL_SPEC.md` §6/`VERSIONING.md` already
  give version identity its own field (`skill_version`, `contract_version`), not the repo
  name.

### 4.2 Capability ids

Per `CORE_PRIMITIVES.md` §1 and `CAPABILITY_MODEL.md`, a Capability id is a **dotted,
namespaced string**, generalizing how `ffmpeg-skill`'s tool ids are already namespaced
(`ffmpeg-skill/cut`):

- **Pattern:** `<domain>.<verb>` or `<domain>.<verb>.<qualifier>`, all lowercase,
  underscore-free (use additional dot segments instead of underscores to add
  specificity).
- **Examples already used in this project's documents:** `edit.trim`, `edit.concat`,
  `audio.normalize.loudness`, `color.hdr-to-sdr`, `measure.audio.loudness`,
  `measure.video.freeze`, `subtitle.generate`, `subtitle.burn-in`, `transcribe.audio`.
- `domain` names the production area (edit, audio, color, subtitle, measure, transcribe,
  graphics, thumbnail, ...), not the Skill that happens to implement it today — a
  Capability id must never encode a specific Skill or Provider name, since the same
  Capability id can have multiple Providers (`CAPABILITY_MODEL.md` §Capability
  collision policy).
- `verb` is the accomplishable action (`trim`, `concat`, `normalize`, `generate`,
  `burn-in`); `qualifier`, when present, narrows it (`loudness` in
  `audio.normalize.loudness` distinguishes it from a hypothetical
  `audio.normalize.peak`).
- A hyphen is acceptable **within** a single dot-segment when the concept itself is
  naturally hyphenated (`hdr-to-sdr`, `burn-in`) — hyphens do not replace the dot as the
  segment separator.

## 5. README structure and badges

Every existing Skill repo already has a working CI badge via GitHub Actions — this is a
proven, existing pattern, not a proposal. A README in this ecosystem should lead with:

1. A one-line description of the Skill's domain (matching its `CapabilityContract`'s
   `not_provided`-style self-declared boundary where one exists — say what it does *and*
   explicitly what it doesn't, per `ffmpeg-skill`'s pattern).
2. A small badge row, in this order: **CI status** (the GitHub Actions workflow badge,
   already present in every existing Skill repo), **version** (matching `skill.version` in
   the Capability Contract, not a hand-maintained duplicate), **license**. Do not add
   badges beyond these three without a concrete reason (e.g. a code-coverage badge is
   fine once real coverage tracking exists; do not add a placeholder badge for
   infrastructure that doesn't exist yet).
3. Installation/usage matching the Skill's actual CLI (`--json`, `contract`, `doctor` —
   per `SKILL_SPEC.md` §2), not aspirational usage.

## 6. Repository README checklist

**PROPOSED — a consistency checklist, not a redesign.** `REPOSITORY_MAP.md`'s own audit
already found that every existing Skill repo has both a `SKILL.md` and a `README.md`
covering most of what a reader needs — this section does not change anything about a
README that already works, and it is not a new design system. It exists only so that
future Skill repos (and, where cheap, existing ones) stay consistent about *which* items
land on that first screen, rather than each README improvising its own subset.

A reader should be able to tell all of the following within seconds, from one screen,
without opening a second file:

1. **What it is** — one line, its domain.
2. **Why use it** — the concrete need it satisfies (mirrors §5.1's "say what it does *and*
   explicitly what it doesn't").
3. **Install command.**
4. **Minimal example** — the shortest real invocation that does something.
5. **Input → output shape** — what artifact type(s) go in, what come out.
6. **Capabilities** — the Capability id(s) it provides (`CORE_PRIMITIVES.md` §1).
7. **Standalone usage** — how to run it with no Agent or OS involved at all
   (`ARCHITECTURE.md` §11's "can a human operate this without an AI agent" test, applied
   at the single-Skill level).
8. **OS integration** — how an Agent discovers and invokes it (`SKILL_PROPOSAL.md` §1.6,
   §1.7).
9. **Version/compatibility** — `skill.version` and the `contract_version` range it
   supports (`VERSIONING.md`).
10. **Security notes** — filesystem/network permissions it declares (§1.5 of
    `SKILL_PROPOSAL.md`; `PLUGIN_MODEL.md` §4).
11. **Repository link.**
12. **Related Skills** — what it depends on and what commonly composes with it.

This is a checklist for the next README written or revised, not a mandate to rewrite the
existing ones — apply it opportunistically, the same restraint this document uses
elsewhere against inventing work nothing today needs.

## 7. What this document deliberately does not define

- **A logo, color palette, or marketing brand identity.** Explicitly out of scope for
  this phase: the ecosystem has no UI today (`REPOSITORY_MAP.md`), and per Rule 9 (no
  abstraction without concrete value), designing a visual brand for software nobody yet
  looks at would be pure speculation with no user to validate it against. Revisit only if
  and when a UI is actually built (see `ARCHITECTURE.md` §8, "explicitly NOT in the
  kernel" — a UI is not planned there either).
- **A component library, design tokens, typography scale, or spacing system** — same
  reasoning; there is no UI surface for these to apply to.
- **A documentation site theme/generator** — this project's docs are plain Markdown files
  read directly from the repository; adopting a static-site generator is a future,
  separate decision with its own tradeoffs, not implied by anything in this document.
