# ADR-013: Claude Code Marketplace, Update Notices, Codex Skills and Honest Fallback

Status: Accepted

## Context

The ecosystem was installable only with `install.sh`. Three needs were not met:

- A Skill author's update reached nobody unless they re-ran the installer. Nothing said that something had changed.
- People use single Skill repositories without the OS. The agent and the Skills must not assume that every other Skill is present.
- Claude Code users expect `/plugin install`. Codex users need the skills in Codex's skill directory.

Facts checked on 2026-10-30 against the Claude Code docs (code.claude.com/docs/en/plugins/*):

- A marketplace is `.claude-plugin/marketplace.json` in a git repository.
- A plugin entry with a `github` source and no `plugin.json` is valid. A repository with `SKILL.md` at its root then loads as a single skill.
- Plugin `dependencies` install together with the plugin.
- With no `version`, updates follow the commit SHA.
- Background auto-update is off for third-party marketplaces until the user turns it on. When it runs, Claude Code shows `Plugin updated: <name> · Run /reload-plugins to apply`.
- Anthropic's directory takes submissions from claude.ai/directory/manage (paid plan). The official `claude-plugins-official` marketplace does not take submissions there.

OpenAI's skills page (learn.chatgpt.com/docs/build-skills) lists `$HOME/.agents/skills` as the user skill location for Codex.

## Decision

1. **This repository is the marketplace `velisa`** (named `ai-video-production-os` until the rename in ADR-015). `scripts/marketplace.py` generates `.claude-plugin/marketplace.json` from `ecosystem.json`.
   - Each component with `"plugin": true` gets one entry, with a `github` source and no version.
   - The meta plugin `velisa` (formerly `video-production-os`) depends on every non-optional plugin, so one install brings the whole OS.
   - The meta plugin's routing skill has a "who owns what" table, which is regenerated from the same file.
   - `--check` and a unit test keep the generated files in step with `ecosystem.json`.
2. **Plugins carry skills, not runtimes.** Python packages, npm packages and CLIs still come from `install.sh` (`--no-claude-skills` when the plugins are used, so no skill appears twice).
3. **Update notices.** `scripts/skill-updates.py` compares every repository's default-branch head and highest version tag with the previous run.
   - Heads and tags are read with `git ls-remote`, so there is no API rate limit. Commit subjects come from the compare API.
   - `.github/workflows/skill-updates.yml` runs it daily. It keeps the state in the body of the `skill-updates` issue and comments there, mentioning the owner, only when something changed. GitHub's own notifications deliver it.
   - Claude Code's auto-update notice covers users of the marketplace.
4. **Codex.** `bootstrap.sh` links each skill (the root `SKILL.md` or `skills/<name>/SKILL.md`) into `~/.agents/skills` as well as `~/.claude/skills`.
5. **Fallback order, said out loud.** The routing skill orders the work this way:
   1. Use an installed OS Skill.
   2. Otherwise use another installed skill or a standard tool, and say that this step is outside the OS (no contract, no provenance, no OS QA).
   3. Otherwise do the work as the model only when it is safe, explain it and verify the output.

   At levels 2 and 3, the skill names the OS skill that would cover the job and how to install it. The agent's side is video-production-agent ADR-051: plan steps with no tool here become handoffs.

## Consequences

- Upstream repositories need no change to be listed.
- A repository gains a listing by getting `"plugin": true` once it has a skill.
- `video-production-agent` and `ingest-skill` are listed before their `SKILL.md` reaches their default branch. Until then they install with no skill (seen in a local install: 0 skills).
- Submission to Anthropic's directory is a manual step in the developer portal. It needs the owner's paid claude.ai account, and it is not done by this change.
