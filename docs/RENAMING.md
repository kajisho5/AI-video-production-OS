# Renaming this repository

Renamed from `AI-video-production-OS` to `Velisa` on 2026-10-31; the old Pages URL
`https://kajisho5.github.io/AI-video-production-OS/` no longer resolves.

The public site and the dashboard follow the repository's name on their own; a rename needs
only the small manual steps below.

## Follows the new name automatically (next deploy)

- **GitHub Pages paths.** `dashboard/web/vite.config.ts` takes the base path from
  `GITHUB_REPOSITORY`, so the dashboard is built for `/<new-name>/dashboard/`.
- **Landing page and redirect pages (`site/`).** The deploy workflow rewrites
  `https://kajisho5.github.io/Velisa/` and `kajisho5/Velisa`
  in every HTML file to the current owner and name: canonical and Open Graph URLs, GitHub
  links, the install one-liner.
- **Repository list on the landing page.** Read from `ecosystem.json` copied into the site, not
  from a URL containing the repository name.
- **Git and the API.** GitHub redirects clones, pushes, web links and API calls from the old
  name, as long as no new repository takes the old name.

## Does not follow automatically

- **The old Pages URL stops working.** GitHub does not redirect project Pages after a rename:
  `https://kajisho5.github.io/AI-video-production-OS/` becomes a 404. Links already shared need
  to be replaced.
- **Files that name the repository** (update in one PR after the rename):
  - `docs/ecosystem/registry.json` (`slug`, `name`) and the OS entry in `ecosystem.json`;
  - `install.sh` (`REPO_URL`), `README.md` and other docs;
  - the `.claude-plugin` marketplace files, if they carry the repository name.
- **Other repositories** that mention this one in docs, CI or contracts. Most links keep
  working through GitHub's redirect; CI workflows that check this repository out by name
  should be updated. kajisho5/ffmpeg-skill is frozen and keeps relying on the redirect.

## Order

1. Rename in Settings → General.
2. Run the "Ecosystem Dashboard" workflow (or push to main) and check the new Pages URL.
3. One PR here for the files above, then the other repositories.

## Old names still in the tree (2026-10-31)

Found with `git grep -n -i -E "ai-video-production-os|video-production-os|AI Video Production|AVOS_HOME|ai-video-os|AI-video-production-OS\.icon"`.
Names that only described the project were changed to Velisa. These stay, on purpose:

| Where | Why it stays |
|---|---|
| `.claude-plugin/marketplace.json`, `scripts/marketplace.py`, `plugins/video-production-os/`, README, ADR-013, `scripts/skill-updates.py` (`ai-video-production-os`, `video-production-os`) | The marketplace and meta-plugin names. See "Plugin marketplace name" below. |
| `install.sh`, `scripts/bootstrap.sh`, their tests (`AVOS_HOME`, `~/ai-video-os`, `AI-video-production-OS/.git`) | Read only as fallbacks so installs made before the rename keep working. See "Workspace directory" below. |
| `scripts/tests` (`AVOS_TEST_BASH`) | A test-harness variable set by `install.yml`; users never see it. |
| `scripts/project-sync.py`, `scripts/skill-updates.py` (`User-Agent: ai-video-os-…`) | HTTP header values. Changing them changes no behaviour anyone relies on, but this cleanup changed no code behaviour beyond the workspace fallback. |
| `project-sync.yml`, README, `docs/ecosystem/ROADMAP.md`, `scripts/tests/test_project_sync.py` ("AI Video Production Ecosystem") | The title of the real GitHub Project (kajisho5 #1). Renaming the project on GitHub comes first. |
| `CHANGELOG.md` (v0.1 era entry), `docs/ECOSYSTEM_CHANGELOG.md` entries, `docs/ecosystem/CROSS_REPO_STATUS.md` (PR #1's branch `claude/ai-video-production-os-arch-fck6fy`) | Historical records: what the repository, its PR URLs and branches were called at the time. The `github.com/kajisho5/AI-video-production-OS/...` URLs redirect. |
| `dashboard/web/public/data/*-snapshot.json` | Generated data. The dashboard workflow regenerates them from GitHub on every deploy. |
| `poc/capability-contract/schema.json` (`$id`) | The identifier of a frozen proof-of-concept schema; changing an `$id` makes it a different schema. |
| `brand/AI-video-production-OS.icon/` | The pre-rename app icon (Icon Composer bundle, #82), not the Velisa mark. Renaming it would label the old design as Velisa's; the current marks are in `brand/velisa/`. |
| README ("Formerly AI Video Production OS"), `site/index.html` (`alternateName`), marketplace descriptions ("formerly …"), `docs/ARCHITECTURE.md` note | Say on purpose what the project used to be called, so old links and searches find it. |
| This file | Describes the rename. |

## Workspace directory (`VELISA_HOME`)

`install.sh` and `scripts/bootstrap.sh` pick the workspace in this order (ADR-015):

1. `--dir DIR`;
2. `$VELISA_HOME`;
3. `$AVOS_HOME`, the variable's name before the rename (still read, so existing shell profiles keep working);
4. `~/ai-video-os`, the pre-rename default, when it exists and `~/velisa-workspace` does not;
5. `~/velisa-workspace`.

So an existing install needs nothing: re-running `install.sh` updates `~/ai-video-os` (or `$AVOS_HOME`) in place.
To move to the new names when convenient:

```bash
mv ~/ai-video-os ~/velisa-workspace
rm -rf ~/velisa-workspace/.venv                 # its scripts carry the old absolute path; the installer makes a new one
export VELISA_HOME=~/velisa-workspace           # only if you had AVOS_HOME set; then drop AVOS_HOME
find ~/.claude/skills ~/.agents/skills -maxdepth 1 -lname '*/ai-video-os/*' -delete   # links into the old directory
~/velisa-workspace/Velisa/install.sh            # or the curl one-liner (a pre-rename checkout may be AI-video-production-OS/)
```

The installer never replaces a skill link that points somewhere else (it reports "not replaced"), which is why the
links into the old directory are removed first.

## Plugin marketplace name

The marketplace is still `ai-video-production-os` and the meta plugin still `video-production-os`. They are not
renamed yet because `video-production-agent` writes `/plugin install <skill>@ai-video-production-os` into every
handoff it prints for a missing Skill (its `skills/ecosystem.py` and tests). Renaming here alone would make those
commands fail. The rename happens once, in one change of `scripts/marketplace.py` (`MARKETPLACE_NAME`, `META`,
then `python3 scripts/marketplace.py` to regenerate) together with the agent, to `velisa` / `velisa`.
Changing the marketplace name means every existing user reinstalls. When it happens, they run:

```text
/plugin uninstall video-production-os@ai-video-production-os
/plugin uninstall <each skill you installed on its own>@ai-video-production-os
/plugin marketplace remove ai-video-production-os
/plugin marketplace add kajisho5/Velisa
/plugin install velisa@velisa
```
