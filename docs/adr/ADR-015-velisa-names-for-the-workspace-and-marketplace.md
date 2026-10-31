# ADR-015: Velisa Names for the Install Workspace, and When the Marketplace Follows

Status: Accepted

## Context

The repository was renamed from `AI-video-production-OS` to `Velisa` on 2026-10-31 (`docs/RENAMING.md`). Two user-facing names still carried the old one:

- The install workspace. `install.sh` and `scripts/bootstrap.sh` read `$AVOS_HOME` and otherwise used `~/ai-video-os`. Existing installs live there, with a `.venv` whose scripts hold that absolute path and skill links in `~/.claude/skills` and `~/.agents/skills` that point into it.
- The Claude Code plugin marketplace `ai-video-production-os` and its meta plugin `video-production-os` (ADR-013). `video-production-agent` prints `/plugin install <skill>@ai-video-production-os` in every handoff for a missing Skill, and its tests assert that text.

## Decision

1. **`VELISA_HOME` first, `AVOS_HOME` as a fallback.** Both scripts resolve the workspace the same way: `--dir`, then `$VELISA_HOME`, then `$AVOS_HOME`. An empty value counts as unset, as `${AVOS_HOME:-…}` did before.
2. **New default `~/velisa-workspace`, old default kept when it is the only one.** With neither variable set, `~/ai-video-os` is used when it exists and `~/velisa-workspace` does not; otherwise `~/velisa-workspace`. An existing install is updated in place, never duplicated. Moving it is a manual, documented step (`docs/RENAMING.md`).
   - Not `~/velisa`: on macOS's default case-insensitive file system that is the same path as `~/Velisa`, where `git clone https://github.com/kajisho5/Velisa` puts a checkout of this repository. The installer would then clone every Skill into that checkout.
   - Not hidden (`~/.velisa`): the workspace holds the clones people open and edit, as `~/ai-video-os` did.
3. **The marketplace is renamed once, together with the agent.** Renaming it here alone would break the install commands `video-production-agent` prints. So it is renamed in one step, to `velisa` (marketplace) and `velisa` (meta plugin, directory `plugins/velisa/`, routing skill `velisa`), in `scripts/marketplace.py`, and the agent's handoff text changes to `@velisa` in a PR that is merged right after this one. Claude Code identifies a marketplace by its name, so every existing user reinstalls once; the commands are in `docs/RENAMING.md`.
   - Done on 2026-10-31 (Velisa #132, video-production-agent PR for `@velisa`). Until then the marketplace kept its old name.

## Consequences

- No existing install or shell profile needs a change. Plugin installations from the old marketplace `ai-video-production-os` do: one reinstall (`docs/RENAMING.md`).
- A machine with both `~/ai-video-os` and `~/velisa-workspace` uses the new one; the old one is left as it is.
- The README, the routing skill and the update notices show `@velisa`; the old name appears only in `docs/RENAMING.md` and historical records.
- `scripts/tests/test_ecosystem_manifest.py` checks the order above for both scripts.
