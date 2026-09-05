# PoC: Capability Contract vs. real Skill data

Write-up and conclusions (three rounds, all 10 Skills): [`docs/POC_CAPABILITY_CONTRACT.md`](../../docs/POC_CAPABILITY_CONTRACT.md).

Everything in this directory is real and reproducible, not illustrative.

## Real contract data — all 10 Skills in the ecosystem

Captured verbatim from each Skill's own, unmodified `contract`/`skill` CLI command (or,
for `ffmpeg-skill`, its real `scripts/_contract.py --json` generator, since it is
Node-wrapped rather than a Python console script) against its local clone, then
pretty-printed for readability. Not hand-written, not fabricated.

- `qc-skill.contract.json`, `media-analysis-skill.contract.json` — Round 1, the known
  Capability-collision case.
- `video-editing-skill.contract.json`, `audio-production-skill.contract.json`,
  `transcription-skill.contract.json` — Round 2, three Skills with no capability
  overlap with each other or with Round 1's pair.
- `ffmpeg-skill.contract.json`, `color-grading-skill.contract.json`,
  `motion-graphics-skill.contract.json`, `subtitle-skill.contract.json`,
  `thumbnail-skill.contract.json` — Round 3, completing all 10.

## Tools

- `schema.json` — `docs/SPEC.md` §1's proposed `CapabilityContract` shape, transcribed
  as a real JSON Schema (kept in sync with `SPEC.md` as this PoC's findings amend it).
- `validate.py` — a small, zero-dependency validator (`python3 validate.py`) checking
  all ten real files above against `schema.json`.
- `registry_demo.py` (`python3 registry_demo.py`) — three parts:
  1. Implements `docs/CAPABILITY_MODEL.md`'s three-tier Provider collision policy and
     exercises it against the real capability overlap between `qc-skill` and
     `media-analysis-skill`.
  2. Compares Capability-id extraction cost across five Skills — automatic for
     `video-editing-skill` (a native per-operation `capability` field already exists),
     manual for the other four.
  3. A full ecosystem-wide summary table across all 10 Skills (id-field-name,
     `contract_version` presence, native-capability-id presence) — see Finding 8 in the
     write-up for what it actually shows: the ecosystem already has a common
     `<skill>/<tool>` identifier convention (3 Skills), and what's almost entirely
     missing is the cross-Skill Capability *grouping label* on top of it, not
     per-operation identifiers from scratch.

Both scripts are plain Python 3 standard library, no dependencies to install
(`thumbnail-skill`'s own real dependency, Pillow, was installed only so its `contract`
command could import at all — not a dependency of this PoC's own scripts).
