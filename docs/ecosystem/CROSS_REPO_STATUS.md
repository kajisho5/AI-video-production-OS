# Cross-Repository Status

**Status: CURRENT / IMPLEMENTED** (this document; a snapshot re-verified against live
GitHub state at the time noted per section — not carried forward from memory). PR
states change continuously; treat the `Live tracker` link in each row as more current
than the prose here, and re-verify before acting on anything time-sensitive.

## Repository roster (12 known, of an ecosystem that is not closed)

| Repo | Role | Depends on |
|---|---|---|
| `ffmpeg-skill` | Execution foundation, 21 base tools | — |
| `video-editing-skill` | Editing operations | `ffmpeg-skill` |
| `audio-production-skill` | Audio processing | `ffmpeg-skill` |
| `color-grading-skill` | Colour operations | `ffmpeg-skill` |
| `subtitle-skill` | Subtitle generate/render | `ffmpeg-skill` (render only) |
| `motion-graphics-skill` | Titles/overlays/lower-thirds | `ffmpeg-skill` |
| `thumbnail-skill` | Thumbnail render/extract | `ffmpeg-skill` |
| `qc-skill` | Quality control checks | `ffmpeg`/`ffprobe` directly |
| `media-analysis-skill` | Media measurement/observation | `ffprobe`/`ffmpeg` directly |
| `transcription-skill` | Speech-to-text | local ASR engines (faster-whisper etc.) |
| `video-production-agent` | Orchestrator/Agent, consumes all of the above | all 10 Skills + `ffmpeg-skill` |
| `AI-video-production-OS` | Architecture, `registry/` library, this doc set | none (describes the others) |

New Skills may appear at any time — this roster is not authoritative on its own; re-check
`video-production-agent`'s README and its `VIDEO_AGENT_*_DIR` environment variables for the
Agent's own current integration list, which is the actual source of truth for "what the
Agent knows how to use."

## `provides` rollout PR tracker (Phase 2)

See `docs/ECOSYSTEM_CHANGELOG.md`'s own running "`provides` rollout: merge tracker" entry
for the full detail. **Complete as of 2026-09-06: all 10 Skills' `provides` PRs have
merged.** Two of the last four (`color-grading-skill#4`, `qc-skill#5`) needed a real
merge-conflict resolution — not just a mechanical `git merge` — because sibling feature
PRs in those same repos merged first: both cases involved an ADR-numbering collision
(resolved by renumbering) and a real gap in the new PR's own logic (a missing Capability
id for `color-grading-skill`'s `PRIMARY_CORRECTION` operation; 7 unaccounted-for checks
in `qc-skill`'s completeness test) that had to be fixed, not just merged around. See
`docs/ecosystem/DECISION_LOG.md` and `docs/ecosystem/capability-status.json` for the
full evidence trail.

## `AI-video-production-OS` itself

- **PR #1** (`claude/ai-video-production-os-arch-fck6fy` → `main`): the whole architecture
  + `registry/` + this doc set. Open, draft, no CI configured on this repo (0 checks), no
  review comments, `mergeable_state: clean`.

## `video-production-agent` — the most important repo not yet touched by this project's own PRs

**No PR has been opened against this repo by this project.** It has not needed one: its own
independent development (22+ merged PRs, 34 ADRs) already reached a working end-to-end
pipeline across all 9 Skills before this project's `provides`/`registry/` work started. See
`CURRENT_STATE.md` for what it actually does.

- Local clone: `/home/user/video-production-agent` (registered this session).
- `python3 -m unittest discover -s tests -p "test_unit.py"`: 187 tests, 184 passing. The 3
  failures are sandbox contamination (this session cloned/pip-installed
  `transcription-skill` etc. directly into the same Python environment, so
  `locate_transcription`-style "is this NOT installed" tests find it anyway) — not real
  bugs, and not evidence of anything wrong in the agent's own CI (which runs in a clean
  environment). Do not "fix" these without first confirming they reproduce in a clean
  checkout.
- Latest ADRs (34 total) show active, current development: ADR-033 (2026-09-05,
  `audio.extract` CONFIRM waiver) and ADR-034 (2026-09-05, revision review history) are
  the same day as this ecosystem-wide `provides` rollout — this repo is being actively
  developed in parallel with this project's own work, independently.
- Its `SkillRegistry` (`src/video_agent/skills/registry.py`) does **not** currently
  register `qc-skill` as a competing candidate for any of the same production-skill names
  `media-analysis-skill` fills (see `CURRENT_STATE.md` "UNKNOWN" section) — the ecosystem's
  one documented Capability collision does not appear to actually collide inside this
  Agent's own registered skill list. Not yet confirmed by reading every relevant ADR in
  full; flagged, not assumed.

## Environments and access notes

- This session's repo scope originally covered the 10 Skills + `AI-video-production-OS`;
  `video-production-agent` was added mid-session via `add_repo` (push access) and cloned to
  `/home/user/video-production-agent`.
- Every Skill repo also has a push-enabled clone under `/home/user/<repo>` from the
  `provides` rollout work, each currently checked out on its `claude/add-capability-provides-field`
  branch (some already merged upstream — those local clones are now behind `main` and
  should be treated as stale for anything beyond re-reading what was pushed).
