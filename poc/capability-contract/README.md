# PoC: Capability Contract vs. real Skill data

Write-up and conclusions (two rounds): [`docs/POC_CAPABILITY_CONTRACT.md`](../../docs/POC_CAPABILITY_CONTRACT.md).

Everything in this directory is real and reproducible, not illustrative.

## Real contract data (5 of the ecosystem's 10 Skills so far)

Captured verbatim from each Skill's own, unmodified `contract`/`skill` CLI command
against its local clone (e.g. `PYTHONPATH=src python3 -m qc_skill.cli contract --json`),
then pretty-printed for readability. Not hand-written, not fabricated.

- `qc-skill.contract.json`, `media-analysis-skill.contract.json` — Round 1, the known
  Capability-collision case.
- `video-editing-skill.contract.json`, `audio-production-skill.contract.json`,
  `transcription-skill.contract.json` — Round 2, three Skills with no capability
  overlap with each other or with Round 1's pair, added to test whether the Round 1
  mapping cost was collision-specific (it isn't — see Finding 4).

Not yet checked: `ffmpeg-skill`, `color-grading-skill`, `motion-graphics-skill`,
`subtitle-skill`, `thumbnail-skill`.

## Tools

- `schema.json` — `docs/SPEC.md` §1's proposed `CapabilityContract` shape, transcribed
  as a real JSON Schema (kept in sync with `SPEC.md` as this PoC's findings amend it).
- `validate.py` — a small, zero-dependency validator (`python3 validate.py`) checking
  all five real files above against `schema.json`.
- `registry_demo.py` (`python3 registry_demo.py`) — two parts:
  1. Implements `docs/CAPABILITY_MODEL.md`'s three-tier Provider collision policy and
     exercises it against the real capability overlap between `qc-skill` and
     `media-analysis-skill`.
  2. Compares Capability-id extraction cost across all five Skills — automatic for
     `video-editing-skill` (a native per-operation `capability` field already exists),
     manual for the other four.

Both scripts are plain Python 3 standard library, no dependencies to install.
