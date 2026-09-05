# ADR-011: The Ecosystem Dashboard Is a View, Not a Source of Truth

Status: Accepted

## Context

Every fact about this ecosystem's state already lives somewhere real: GitHub itself
(repository state, PRs, issues, CI runs, releases), each Skill's own Capability Contract,
and this project's own `docs/ecosystem/*.md` (`CURRENT_STATE.md`, `CROSS_REPO_STATUS.md`,
`WORK_QUEUE.md`, `DECISION_LOG.md`, `ECOSYSTEM_CHANGELOG.md`), which this project is
already obligated to keep current as durable, repository-based memory (established this
session, before the Dashboard was requested). `ARCHITECTURE.md` §8 lists "A UI" among
what is explicitly **not** in the OS kernel — "none exists today; none is assumed" — and
`DESIGN_SYSTEM.md` §7 defers any real visual design system "if and when a UI is actually
built."

A web-based Ecosystem Dashboard was requested to make this state visible from one place,
usable on desktop and mobile (including iPhone Safari), without becoming a second,
competing project-management system, and without exposing GitHub credentials to a
browser.

## Decision

**The Dashboard is a consumer of the ecosystem, architecturally identical in kind to an
Agent** (per ADR-003's Agent/OS boundary and ADR-010's "any conformant consumer" stance)
— it reads, it never writes. Concretely:

1. **No new authoritative state.** The Dashboard introduces exactly two new structured
   files, both in `docs/ecosystem/` alongside the prose documents already required to
   exist:
   - `registry.json` — the extensible list of known repositories (slug, type, role,
     `depends_on`), replacing what would otherwise be a hard-coded list in Dashboard
     code. This is a structured restatement of `CROSS_REPO_STATUS.md`'s "Repository
     roster" table, not a new fact.
   - `capability-status.json` — a structured mirror of capability/integration/maturity
     facts already recorded in prose across `CURRENT_STATE.md`, `CROSS_REPO_STATUS.md`,
     and `CAPABILITY_MATRIX.md` (see `MATURITY_MODEL.md`). Both files are maintained by
     whoever (human or agent) updates the ecosystem docs, in the same commit — never a
     separately-tracked, driftable system. If this pairing ever drifts, the prose
     documents win; the JSON is corrected to match, never the reverse.
2. **Everything else is fetched live from GitHub** (repository metadata, PRs, issues,
   Actions/CI status, releases) by a server-side aggregator, never hand-entered and
   never cached indefinitely.
3. **Data flow is strictly one-directional and layered**:

   ```
   GitHub API + registry.json + capability-status.json
           ↓
   aggregator (dashboard/aggregator/, Node + TypeScript, runs in CI only)
           ↓
   one normalized EcosystemSnapshot JSON file (dashboard/shared/types.ts's shape)
           ↓
   Dashboard UI (dashboard/, static React app, fetches only the JSON)
   ```

   The UI layer contains no GitHub API calls, no business logic for computing maturity
   or bottlenecks, and no knowledge of GitHub authentication — it renders an already-
   normalized model. This is the same "don't let UI components contain business logic"
   principle the task requested, applied concretely.
4. **The aggregator is the only thing that ever touches a GitHub token**, and it runs
   exclusively inside GitHub Actions (`.github/workflows/dashboard.yml`), never in the
   browser. A repository secret (`ECOSYSTEM_GITHUB_TOKEN`, a fine-grained PAT scoped
   read-only to the ecosystem's repositories) is optional — the aggregator falls back to
   unauthenticated GitHub API access (rate-limited to 60 requests/hour per IP) when the
   secret is absent, which is sufficient for manual/local runs but not for frequent
   scheduled runs at ecosystem scale. This satisfies "browser → safe server-side layer →
   GitHub API" literally: the "server-side layer" is the CI job itself, which is a
   standard, low-infrastructure pattern for a read-only static dashboard (sometimes
   called Jamstack) and requires no always-on server.
5. **Deployment is static.** The built frontend plus the latest generated snapshot JSON
   are published to GitHub Pages by the same workflow. No server process runs the
   Dashboard; a viewer's browser only ever performs plain HTTPS `GET`s against static
   files. This is the smallest architecture that satisfies every constraint (no token in
   the browser, works offline-capable as a PWA, needs no hosting budget beyond what a
   public GitHub repository already includes).
6. **Every field the aggregator cannot support with real evidence is `UNKNOWN`** in the
   normalized model — the UI renders `UNKNOWN` distinctly from a measured value (never a
   blank, a zero, or a guess). See `MATURITY_MODEL.md` for what is automatic today versus
   documented, and why.
7. **First version is read-only**, by construction: the aggregator only ever calls
   GitHub's read endpoints, and the UI issues no requests capable of mutating anything.
   Nothing in this architecture merges a PR, creates an issue, or changes a repository
   setting.

## Consequences

- Adding a new Skill, Agent, or Provider to the ecosystem requires exactly one edit — an
  entry in `registry.json` — never a Dashboard code change, satisfying the "must not
  require redesigning the Dashboard" requirement.
- `capability-status.json`'s documented (non-automatic) fields are only as fresh as the
  last time a human/agent updated them alongside the prose docs — this is an accepted,
  explicit limitation (see `MATURITY_MODEL.md`), not a silent gap; the Dashboard's own
  "last verified" timestamp per field makes this staleness visible rather than hidden.
- No dashboard-specific backend service exists to operate, patch, or scale — the only
  infrastructure is a scheduled GitHub Actions workflow and GitHub Pages, both already
  free at this project's scale.
- Because the UI never touches GitHub credentials, a future write-capable feature (e.g.
  "restart this CI run") would be a **new, separately-reviewed architectural decision**,
  not an incremental extension of this one — this ADR's boundary (`UI never holds a
  token`) would have to be deliberately revisited, not quietly crossed.
- The Dashboard depends on GitHub Pages being enabled for this repository (Settings →
  Pages → Source: GitHub Actions), a one-time manual step outside this project's own
  write access — documented in `dashboard/README.md`, not silently assumed to already be
  configured.
