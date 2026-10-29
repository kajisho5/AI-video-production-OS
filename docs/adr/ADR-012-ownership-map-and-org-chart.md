# ADR-012: One Ownership Map in ecosystem.json; Generated Engines Allowed Behind Owners

Status: Accepted

## Context

Skills declared their scope only in their own contracts and SKILL.md files; nothing compared
them. The result was work with two owners (`video-production-agent` lists both
`ffmpeg-skill/cut` and `video-editing/cut` for the same operation), work with none (most of
ffmpeg-skill's 42 tools, filler removal, speaker diarization), and a roster that drifted from
reality (`REPOSITORY_MAP.md` still says 11 repositories and 21 ffmpeg tools).

The 2026-10-29 ecosystem review also decided which Skills to add (dubbing, publish, detection,
slide-sync, blender, artifacts, stepcap; voice-enhance, sound-design and diarization still to
be created; DVD/Blu-ray authoring as an optional install) and which engines generated media
may come from. `CAPABILITY_MATRIX.md` had declared AI-generated thumbnails refused by design.

## Decision

1. **`ecosystem.json` is the ownership map.** Every component names its `department` and what
   it `owns`. No two components own the same thing (enforced by
   `scripts/tests/test_ecosystem_manifest.py`). Work not in a component's `owns` is handed to
   the component that owns it, never re-implemented. `ffmpeg-skill` is the execution engine
   and owns only what no Skill above it owns.
2. **Status is explicit:** `active` (implemented), `scaffold` (repository exists, no package),
   `planned` (no repository; the installer reports and skips it). `optional` components are
   installed only with `--with-optional` (DVD/Blu-ray authoring only).
3. **Org charts are generated, not drawn:** `scripts/orgchart.mjs` renders
   `docs/ecosystem/org/*.png` from `ecosystem.json`.
4. **Generated media is allowed behind an owning Skill, through a named engine:**
   - AI narration: `dubbing-skill`, default engine Chatterbox Multilingual V3 (MIT, Japanese,
     watermarked output); VOICEVOX (external app, credit required, per-voice terms),
     Style-Bert-VITS2 (AGPL; run as a separate process) and Kokoro-82M (Apache-2.0, weak
     Japanese) as alternatives. Cloning a real person's voice requires a recorded consent.
   - BGM and sound effects: `sound-design-skill`, engine ACE-Step 1.5 (MIT, commercial use of
     output stated by the model card).
   - Thumbnail backgrounds: `thumbnail-skill`, engine FLUX.2 [klein] 4B (Apache-2.0; the 9B
     variant is non-commercial and not allowed). This supersedes the "no AI-generated
     thumbnails" line in `CAPABILITY_MATRIX.md` for background assets; composition stays
     deterministic.
   Every generated asset records its engine (and watermark or credit obligation) in the
   ProductionReceipt.

## Consequences

- Adding a Skill means adding it to `ecosystem.json`; the installer, dashboard roster test and
  org charts follow from that one edit.
- Ownership collisions fail CI instead of surfacing as two Skills doing the same job.
- `video-production-agent`'s hand-written routing must eventually be checked against `owns`
  (not done in this ADR).
- Engine licences were checked on the projects' own pages on 2026-10-29; they can change and
  must be re-checked before an engine version is upgraded.
