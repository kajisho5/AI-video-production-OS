# Ecosystem Dashboard

**Status: CURRENT / IMPLEMENTED, v1 (read-only), 2026-09-05.** A web-based, mobile-first,
PWA-ready dashboard showing the real, live development/integration status of the whole
AI Video Production OS ecosystem from one place. See
[`docs/adr/ADR-011-ecosystem-dashboard.md`](../docs/adr/ADR-011-ecosystem-dashboard.md)
for the architecture decision this implements, and
[`docs/ecosystem/MATURITY_MODEL.md`](../docs/ecosystem/MATURITY_MODEL.md) for the
maturity ladder it renders.

## The one rule that shapes everything else

**The Dashboard is a view, not a source of truth.** It introduces exactly two small
structured JSON files (`docs/ecosystem/registry.json`, `docs/ecosystem/capability-status.json`)
that restate facts already required to exist in this project's prose documents
(`CROSS_REPO_STATUS.md`, `CURRENT_STATE.md`, `CAPABILITY_MATRIX.md`) — it never invents a
new independent tracking system. Everything else is fetched live from GitHub on every
run. See ADR-011 for the full reasoning.

## Architecture

```
GitHub API + docs/ecosystem/registry.json + docs/ecosystem/capability-status.json
        |
        v
dashboard/aggregator/   (Node + TypeScript, runs ONLY in CI)
        |  produces one normalized EcosystemSnapshot JSON
        v
dashboard/web/public/data/ecosystem-snapshot.json
        |  plain static file, no auth
        v
dashboard/web/   (Vite + React + TypeScript, static SPA)
        |
        v
  viewer's browser (desktop / iPad / iPhone Safari)
```

- **`dashboard/shared/types.ts`** — the one normalized `EcosystemSnapshot` shape both
  sides agree on. Neither side re-derives a fact the other already computed.
- **`dashboard/aggregator/`** — fetches GitHub state (repos, PRs, issues, CI runs,
  releases) via `@octokit/rest`, combines it with the two structured ecosystem-state
  files, computes each repo's `docs/ecosystem/MATURITY_MODEL.md` level and any
  explicit-evidence bottlenecks, and writes one JSON file. **This is the only code in
  this entire project that ever holds a GitHub token**, and it only ever runs inside
  GitHub Actions (`.github/workflows/dashboard.yml`) or a developer's own machine —
  never in a browser.
- **`dashboard/web/`** — a static React app that fetches exactly one URL
  (`data/ecosystem-snapshot.json`, same-origin, no auth) and renders it. No component
  calls GitHub, computes a maturity level, or holds any business logic beyond simple
  presentation — that discipline is what lets `dashboard/web`'s tests run without any
  network access at all.

## Why this is secure (no token ever reaches a browser)

1. `dashboard/aggregator` reads `process.env.GITHUB_TOKEN` and calls the GitHub API. It
   is a Node script, run only by `.github/workflows/dashboard.yml` (inside GitHub
   Actions, using the workflow's own ambient token or an optional
   `ECOSYSTEM_GITHUB_TOKEN` secret) or manually by a developer on their own machine.
2. Its only output is a JSON **data** file — no code, no credentials, no request logic.
   A token is used exclusively as an HTTP `Authorization` header value; it is never
   written into any field of the snapshot itself (verified by the CI workflow's own
   `grep` step, and by inspecting `dashboard/aggregator/src/github.ts`, which never puts
   `token` into a returned object).
3. `dashboard/web` never imports `@octokit/rest`, never reads `process.env.GITHUB_TOKEN`
   (it wouldn't be bundled into client JS in a Vite app unless explicitly prefixed
   `VITE_`, which nothing here does), and its only `fetch()` call
   (`src/hooks/useEcosystemSnapshot.ts`) targets a same-origin static path.
4. Verified directly: `dashboard/web/dist/assets/*.js` (the actual shipped bundle)
   contains no reference to `octokit`, `api.github.com`, or any token-shaped string —
   checked by hand during this feature's implementation and re-checked automatically by
   the CI workflow on every deploy.

## Running it yourself

```bash
# Generate a real snapshot (needs network access to api.github.com; a token raises the
# rate limit from ~60/hr to ~5000/hr but is not required for a one-off run)
cd dashboard/aggregator
npm install
GITHUB_TOKEN=<your token, or omit> npm run generate

# Serve the dashboard against that snapshot
cd ../web
npm install
npm run dev
```

```bash
# Tests (no network access needed for either — everything is fixture/mock-based)
cd dashboard/aggregator && npm test    # 38 tests
cd dashboard/web && npm test           # 12 tests
```

## Extending the ecosystem (adding a new Skill/Agent/Provider)

Edit **only** `docs/ecosystem/registry.json` — add one entry with `slug`, `name`,
`type`, `role`, `depends_on`. The next aggregation run picks it up automatically; no
Dashboard code changes. Optionally add a matching entry to
`docs/ecosystem/capability-status.json` for the documented (non-automatic) maturity
facts described in `MATURITY_MODEL.md` — until that entry exists, every documented
field for the new repo simply renders as `UNKNOWN`, never a guess.

## What "UNKNOWN" means, and where it comes from

Every field the aggregator cannot support with real evidence is `UNKNOWN` — rendered as
a distinct dashed chip in the UI (`StatusChip`), never a blank, a zero, or a silently
guessed value. Two different kinds of gap produce it:

- **Not yet fetchable automatically**: e.g. a Skill's own npm/PyPI published version
  (`MATURITY_MODEL.md` level 6) — the aggregator does not yet call a package registry
  API for this.
- **Not yet documented**: a repo listed in `registry.json` with no matching entry in
  `capability-status.json` yet.

## Maturity model, briefly

See `docs/ecosystem/MATURITY_MODEL.md` for the full definition. In short: 7 levels
(Proposed → Scaffolded → Contract Published → Capability Declared → OS Integrated →
Verified End-to-End → Distributed), each with named, checkable evidence. The OS Overview
shows a **distribution** across these levels — never a single invented percentage.

## Bottleneck detection, briefly

`dashboard/aggregator/src/bottlenecks.ts` — every bottleneck kind is one explicit rule
reading one specific field (CI conclusion, a PR's real `mergeable_state`, a documented
`provides_published: false`, ...), never a scored/weighted heuristic. See the module's
own tests for the exact rules.

## Design language

This is the first real UI this ecosystem has ever had — `docs/DESIGN_SYSTEM.md` §7
explicitly deferred a visual design system until one existed; `ADR-011` is that
decision. Deliberately restrained: dark-only, high information density, a handful of
load-bearing status colors (green=ok, amber=caution, red=bad/bottleneck, gray-dashed=
UNKNOWN, blue=neutral/in-progress), a monospace treatment for identifiers/numbers, no
illustration or marketing chrome. See `src/styles/tokens.css`.

## Mobile / PWA

- Mobile-first CSS (`src/styles/global.css`): single-column cards below 640px, a denser
  table only above 900px (`.desktop-only`/`.mobile-only`), 44px-minimum touch targets on
  every interactive element, collapsible sections (open by default on desktop, closed by
  default on mobile except the Overview and any non-empty Bottlenecks panel — the two
  highest-priority sections per the task's own information-architecture guidance).
  Verified with Playwright screenshots at 1400px (desktop) and 390px (iPhone) during
  implementation; a real horizontal-overflow bug (an unconstrained flex child) was found
  and fixed this way, not assumed absent.
- PWA: `vite-plugin-pwa` with a minimal `generateSW` strategy — the app shell is
  precached (works offline, shows the last-seen snapshot), the data JSON itself uses
  `NetworkFirst` with a 4s timeout (never serves a stale snapshot as if it were fresh
  when a network is available). `apple-touch-icon`, a maskable icon, and
  `apple-mobile-web-app-capable` are set for a real "Add to Home Screen" experience on
  iPhone Safari. Deliberately not built: background sync, push notifications, or any
  other PWA capability the task said not to over-engineer in v1.

## Known gaps (real, not hidden)

- **Resolved 2026-09-06: live and deployed.** `.github/workflows/dashboard.yml` has run
  for real against the live network (this development sandbox itself could not — its own
  GitHub access is restricted to an internal MCP tool channel, so `dashboard/aggregator`
  was verified with fixture/mock Octokit objects there instead, `test/github.test.ts` et
  al. — but the real CI environment has a genuine ambient token and unrestricted egress,
  and its first run succeeded once GitHub Pages was enabled). Live at
  `https://kajisho5.github.io/AI-video-production-OS/`, refreshed hourly and on every
  push to `main` that touches `dashboard/**` or the ecosystem state JSON files.
- **PR `mergeable_state` is only fetched for the first 8 open PRs per repo** (a bounded
  per-PR API call, to avoid an unbounded request count on a repo with many open PRs) —
  see `MAX_MERGEABILITY_CHECKS_PER_REPO` in `aggregator/src/github.ts`.
- **No snapshot history** — each run overwrites the previous one; no trend/velocity view
  exists yet (deliberately out of scope for v1, see `MATURITY_MODEL.md`'s "deliberately
  not part of this model").
- **The ecosystem graph is a simple tiered list**, not a rendered node-link diagram —
  deliberately, per the task's own "do not make this graph unnecessarily complicated in
  v1" instruction.

## Directory map

```
dashboard/
  shared/types.ts              normalized EcosystemSnapshot model (used by both sides)
  aggregator/
    src/
      config.ts                 loads registry.json / capability-status.json
      github.ts                  Octokit wrapper (the ONLY module touching a token)
      maturity.ts                 MATURITY_MODEL.md, pure
      bottlenecks.ts               explicit-evidence bottleneck rules, pure
      normalize.ts                  assembles RepoStatus / overview / graph
      agentStatus.ts                 builds AgentStatus from capability-status.json
      index.ts                        entrypoint (`npm run generate`)
    scripts/generate-example-snapshot.ts   real pipeline + real-as-of-2026-09-05 fixture data
    test/                             38 tests, no network
  web/
    src/
      hooks/useEcosystemSnapshot.ts   the ONLY fetch() call in the whole UI
      components/                      presentation only, no business logic
      styles/                           tokens.css (design tokens) + global.css
    public/icons/, public/data/        PWA icons, generated snapshot
    test/ + *.test.tsx                  12 tests, no network
```

## Related: the Ecosystem Control Room

This Dashboard answers "what is the OS/repos' current state" (maturity, CI, PRs). A
separate, additive page answers a different question — "where are we in the
*development process itself*, and what's next" — without replacing or duplicating this
one: see [`dashboard/control-room/README.md`](control-room/README.md). It reuses this
Dashboard's own `shared/types.ts` conventions (UNKNOWN as a first-class value, evidence
over guesses) and its already-generated `ecosystem-snapshot.json` for live GitHub facts,
and is served at `/control-room.html` alongside this Dashboard at `/`.
