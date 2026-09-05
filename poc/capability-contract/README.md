# PoC: Capability Contract vs. real Skill data

Write-up and conclusions: [`docs/POC_CAPABILITY_CONTRACT.md`](../../docs/POC_CAPABILITY_CONTRACT.md).

Everything in this directory is real and reproducible, not illustrative:

- `qc-skill.contract.json`, `media-analysis-skill.contract.json` — captured verbatim
  from the real, unmodified `contract --json` CLI command of each Skill's local clone
  (`PYTHONPATH=src python3 -m <package>.cli contract --json`), then pretty-printed for
  readability. Not hand-written, not fabricated.
- `schema.json` — `docs/SPEC.md` §1's proposed `CapabilityContract` shape, transcribed
  as a real JSON Schema.
- `validate.py` — a small, zero-dependency validator (`python3 validate.py`) checking
  the two real files above against `schema.json`.
- `registry_demo.py` — implements `docs/CAPABILITY_MODEL.md`'s three-tier Provider
  collision policy and exercises it against the real capability overlap between the two
  Skills above (`python3 registry_demo.py`).

Both scripts are plain Python 3 standard library, no dependencies to install.
