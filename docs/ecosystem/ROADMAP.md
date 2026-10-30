# Ecosystem build roadmap

What every repository still needs, how the pieces connect, and the order to build them in. Written from a read-only audit of all 33 components on 2026-10-30 (source, tests, CI, contracts, the agent's adapters). Each repository carries an `ECOSYSTEM_ROADMAP.md` with PR-sized steps; this page is the map across them. `docs/ROADMAP.md` is the architecture roadmap (phases of the contract layer) and stays as it is.

**ffmpeg-skill is treated as complete.** Its 42 tools (contract v1.0, stability promise for 2.x) are the engine the others delegate to; no step below changes it. Several gaps are closed by *using* tools it already has, e.g. `render --export-timeline` (.otio / .fcpxml / .edl), `freeze`, `reverse`, `insert`, `audio --duck --voice`, `metadata` chapters.

## Where things stand

| Department | Repositories | Today |
|---|---|---|
| Command | video-production-agent | plans, approves, renders, records; brain = rules + Claude (API or the chat app via MCP); 10 adapters |
| Ingest | ingest-skill | active: verified single-read offload to several destinations, ASC MHL + xxHash64, card-aware inventory, `ingest fetch` (URL via yt-dlp); agent adapter not yet wired |
| Engine | ffmpeg-skill | 42 tools, complete; agent uses 15 directly |
| Visual | video-editing, color-grading, motion-graphics, subtitle, thumbnail | implemented and wired, with unexposed parameters and version drift |
| Visual | blender, remotion-ffmpeg, hyperframes | implemented, not wired |
| Audio | audio-production | implemented and wired (MIX, NR, DYNAMICS not planned) |
| Audio | voice-enhance, dubbing, sound-design | **empty scaffolds** |
| Recognition | transcription | implemented and wired (speaker_id always null) |
| Recognition | diarization, detection, slide-sync | **empty scaffolds** |
| Verification | qc, media-analysis | implemented and wired |
| Verification | artifacts | implemented, not wired, contract not in OS shape |
| Delivery | publish | **empty scaffold** |
| Delivery | 5 disc kits (optional) | implemented, standalone |
| Utility | imagemagick, stepcap | implemented, standalone |
| Governance | skillpact, system-intelligence | implemented, adopted by no other repo yet |

## Wiring

```
                      Claude Code / Claude Desktop (the brain in the chat, ADR-050)
                         │ MCP                      │ MCP (community, unofficial)
                         ▼                          ▼
 ingest-skill ──► video-production-agent ──► DaVinci Resolve MCP / Premiere Pro MCP
 (card offload)   plan → approve → render          ▲
                         │ adapters                │ .otio / FCP7 .xml / .edl + .srt
   ┌─────────────┬───────┼───────────┬─────────────┤
 recognize      visual   audio      verify      nle-bridge-skill (planned)
 transcription  editing  production qc          timeline export / round trip
 diarization    color    voice-enh. media-an.
 detection      motion   dubbing    artifacts
 slide-sync     subtitle sound-des.
                thumbnail
                         │ every media operation
                         ▼
                    ffmpeg-skill (42 tools)  ──►  publish-skill (upload, CONFIRM after QC)
```

- **Data flows.**
  - transcript → diarization (speaker ids) → subtitle (cues, locale shaping, translation) → dubbing (TTS per cue) → audio-production MIX.
  - detection boxes → ffmpeg-skill redact / crop.
  - slide-sync changes → ffmpeg-skill metadata chapters.
  - sound-design BGM → audio-production MIX.
- **Rule for a missing skill.**
  - The agent names the step as a handoff (ADR-051). For that, every job needs a SkillSpec, even when its skill is not built yet (agent step 1).
  - The routing skill in the marketplace (ADR-013) then prefers OS skills, falls back to other tools, and says so.

## Premiere Pro and DaVinci Resolve

Neither vendor ships a desktop MCP server. Community servers exist. Verified on 2026-10-30; the sources are in the research notes of PR #78.

| | DaVinci Resolve | Premiere Pro |
|---|---|---|
| Recommended server | [samuelgursky/davinci-resolve-mcp](https://github.com/samuelgursky/davinci-resolve-mcp) (MIT, most mature, compound mode) | [leancoderkavy/premiere-pro-mcp](https://github.com/leancoderkavy/premiere-pro-mcp) (MIT; eval tools off by default, token-authenticated UXP bridge, path confinement) |
| Requirement | **Resolve Studio**: external scripting is Studio-only, and free 21.1 moved Python scripting to Studio | Premiere 25.6+ for UXP; the CEP bridge works on older versions but CEP is being retired |
| Timeline import | `ImportTimelineFromFile`: AAF / EDL / FCP7 XML / FCPXML / OTIO | OTIO import (since 2024-10), FCP7 XML, EDL, AAF; **no native FCPXML** |

**How it connects.**
1. The agent exports the edit as a timeline.
   - Primary format: **OTIO**, which both NLEs import natively.
   - Fallback: **FCP7 XML** (carries cuts, tracks, markers and basic levels).
   - Subtitles always go as a sidecar **SRT**; no interchange format carries them.
   - Effects, speed ramps and titles do not survive interchange. They stay in the agent's ffmpeg path or are documented as manual steps.
2. Claude imports the files through the NLE's MCP server (Resolve `ImportTimelineFromFile` / Premiere OTIO import), adds markers and queues the render. The agent's MCP server and the NLE's server sit side by side in the same chat app.
3. Later, the human's edit comes back: the NLE exports OTIO, and the agent reads it as a new plan version.

**Build vs reuse.** Neither NLE is available yet (see Decided), so the interchange files come first and live control waits.
- **Later, reuse:** live NLE control. Don't fork the community servers. Pin a version, keep eval and script tools off, and opt out of telemetry where it exists.
- **Build, first in the agent:** `timeline_export` through ffmpeg-skill `render --export-timeline` (agent step 4). No new repository is needed for that.
- **Build, later as `nle-bridge-skill`:** round-trip ingest, FCP7 XML for Premiere, relink manifests and conform packages. This is `planned` in `ecosystem.json`; the repository does not exist yet.

**Risks.**
- **Resolve:** automation needs Studio.
- **Premiere:** CEP-based servers will break once CEP is retired.
- **Security:** arbitrary-script tools (`execute_extendscript`, `execute_lua`) and shared temp-directory IPC.
- **Licences:** one Resolve server has no licence and another is GPL-3.0. Do not copy code from either.

**Claude Desktop config with all three servers.** Paths are placeholders; check each server's README for its current install command.

```json
{"mcpServers": {
  "video-agent": {"command": "/abs/path/video-agent-mcp", "args": ["--workspace", "/abs/path/video-agent-work"]},
  "davinci-resolve": {"command": "<from samuelgursky/davinci-resolve-mcp setup>"},
  "premiere-pro": {"command": "<from leancoderkavy/premiere-pro-mcp setup>"}
}}
```

## Order of work

1. **Hygiene, every repo, small PRs.** Merge the open PRs first (agent #63, ingest-skill #1, OS #78).
   - **Version drift.** Each of these repos reports a different version than its release: motion-graphics, subtitle, thumbnail, transcription, media-analysis. Fix them together with the agent's version gates; motion-graphics breaks the agent the moment it is fixed alone.
   - **Contracts in the OS schema shape.** Needed for artifacts, ingest, remotion, blender, stepcap and the disc kits. hyperframes and imagemagick also lack `provides[]`.
   - **Other contract fields.** Add `dependencies` on ffmpeg-skill. Remove the duplicate ids in audio-production and motion-graphics.
2. **Agent: make the whole map visible.**
   - Add SkillSpecs for every job, so handoffs name packages.
   - Add the contract-backed check of the ffmpeg-skill catalog.
   - Add timeline export (OTIO), which is the Premiere/Resolve path.
   - Wire the parameters the satellites already offer.
3. **Recognition.**
   - diarization, with speaker ids end to end.
   - detection, which owns OCR for stepcap and slide-sync too.
   - slide-sync.
4. **Audio.**
   - Filler removal: transcription words → audio-production FILLER_REMOVE.
   - voice-enhance.
   - The translation decision, then dubbing.
   - sound-design.
5. **Delivery.**
   - publish-skill (CONFIRM after QC).
   - nle-bridge-skill (round trip).
   - ingest-skill adapter, MHL.
6. **Agent brain.**
   - requirements_extraction: plain-language brief → requirements, through the chat model or the API.
   - semantic deletion.
7. **Governance.**
   - system-intelligence reads ecosystem.json ownership and the contracts.
   - skillpact conformance runs as a non-blocking OS job.

## Decided by the owner (2026-10-30)

| Question | Decision |
|---|---|
| Who translates subtitles (字幕翻訳)? | **subtitle-skill**, as `ecosystem.json` already says. Its README's "translation is out of scope" is corrected. The MT engine gets an ADR in subtitle-skill. Dubbing builds on it. |
| Who owns the platform specs (配信プラットフォーム仕様)? | **ffmpeg-skill** keeps the table (`_platforms.py`; nothing in ffmpeg-skill changes). publish-skill reads it and owns only upload-side limits (アップロード制限: file size, duration, rate limits). |
| Who owns URL download (URL素材取得)? | **ingest-skill**. The agent's own yt-dlp call moves there; until then the agent keeps it. |
| Premiere / Resolve | Neither is available here. Build the **interchange files** first (OTIO, FCP7 XML, SRT), which open in either NLE later. Live control through the community MCP servers waits until the software is at hand. |

## Decisions only the owner can make

| Question | Options |
|---|---|
| Compliance checking | Recommendation: qc-skill judges against the spec, and ffmpeg-skill `check` is the engine's preflight. Record that split. |
| Overlay / PiP / titles | The jobs are split by name. video-editing owns still overlay, motion-graphics owns titles, and ffmpeg-skill owns B-roll and screen compositing. Templates in remotion and hyperframes stay inside their own compositions. |
| Engines for voice-enhance, diarization, detection, SFX | Each gets an ADR in its repo. The candidates listed there are unverified until that ADR checks the licences of both code and weights. |

## Tracking in the GitHub Project

The **AI Video Production Ecosystem** project (kajisho5 #1) is filled from this repository alone. `.github/workflows/project-sync.yml` runs hourly and adds every issue and pull request of the repositories in `ecosystem.json`. The other repositories need no setup. It needs the `PROJECT_TOKEN` secret here (see README, "GitHub Project"). Issues cut from the roadmap steps land in the project the same way.

## Per-repository roadmaps

Each repository's `ECOSYSTEM_ROADMAP.md` (added by its "Roadmap" PR): video-production-agent, ingest-skill, video-editing-skill, color-grading-skill, motion-graphics-skill, subtitle-skill, thumbnail-skill, blender-skill, remotion-ffmpeg-skill, hyperframes-skill, audio-production-skill, voice-enhance-skill, dubbing-skill, sound-design-skill, transcription-skill, diarization-skill, detection-skill, slide-sync-skill, qc-skill, media-analysis-skill, artifacts-skill, publish-skill, imagemagick-skill, stepcap, skillpact, system-intelligence, bdmvkit, vtskit, udfkit, dvdcc, oncemore. ffmpeg-skill has none, because it is complete.
