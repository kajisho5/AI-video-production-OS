# Renaming this repository

The public site and the dashboard follow the repository's name on their own; a rename needs
only the small manual steps below.

## Follows the new name automatically (next deploy)

- **GitHub Pages paths.** `dashboard/web/vite.config.ts` takes the base path from
  `GITHUB_REPOSITORY`, so the dashboard is built for `/<new-name>/dashboard/`.
- **Landing page and redirect pages (`site/`).** The deploy workflow rewrites
  `https://kajisho5.github.io/AI-video-production-OS/` and `kajisho5/AI-video-production-OS`
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
