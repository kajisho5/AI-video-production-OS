# ADR-014: Non-Blocking SkillPact Conformance of the Skills

Status: Accepted

## Context

SkillPact (kajisho5/skillpact) gives a Skill a machine-readable contract, `skill.contract.json`. The contract declares side effects, requirements and conformance tests, and it can be signed. A checker reports one of these levels:

- L1-declared: the contract is valid.
- L2-tested: the declared tests also pass in SkillPact's bubblewrap sandbox.
- L3-signed: the files are also covered by an integrity check and the author's signature.

Step 3 of skillpact's `ECOSYSTEM_ROADMAP.md` added a reusable GitHub Action for this check (kajisho5/skillpact#33). imagemagick-skill was its first user, and its own CI requires L2.

Step 4 asks the OS for a non-blocking conformance job, with L1 or better as the bar. The roadmap names qc-skill and ingest-skill as the first targets, but on 2026-10-31 only imagemagick-skill has a contract at its root, among all repositories in `ecosystem.json`.

## Decision

1. **`.github/workflows/skillpact-conformance.yml`** runs the check. It runs weekly, on demand, and when `ecosystem.json`, the workflow or its script changes.
2. **The list of repositories comes from `ecosystem.json`.** `scripts/skillpact-satellites.py list` takes every component that is not `planned` and has `skill.contract.json` on its default branch. It reads the file from raw.githubusercontent.com, so there is no API rate limit. A Skill that adds a contract is checked from the next run, with no change here. qc-skill and ingest-skill join this way.
3. **The bar is L1.** Each repository is checked out and run through the Action at `min-level: L1` with its tests on. A repository whose tests pass on the runner reaches L2. The Skill's own CI keeps its own, usually stricter, bar.
4. **Requirements.** The script maps the binaries a contract requires to Ubuntu packages, for example `magick`/`convert` to `imagemagick` and `ffmpeg`/`ffprobe` to `ffmpeg`, and the job installs those packages. SkillPact names any requirement that is still unmet on the runner, so an unknown binary shows up in the report. The job does not guess a package for it.
5. **Non-blocking.** Two things keep a failing Skill from failing the workflow: `continue-on-error` on the check step, and `continue-on-error` on the matrix job. The workflow is not a required check. A Skill below L1 shows as a warning and as a row in the summary table.
6. **Report.** Each repository's job summary holds SkillPact's own report: findings, test counts and the failing cases. A final job writes one table to the run's summary, with one row per repository giving its level and pass/fail.
7. **Pinning.** The Action is pinned to the full commit SHA of skillpact#33's merge commit (`90895aa3…`), as skillpact's README asks. Dependabot's `github-actions` entry moves it.

## Consequences

- The OS now sees the conformance level of every Skill that has a contract. Nothing blocks on it.
- Satellite tests run on this repository's runners with a read-only token (`contents: read`). Inside the job they run in SkillPact's sandbox.
- A requirement that has no entry in the script's package map stays unmet. That Skill can then reach only L1 here until an entry is added.
- SkillPact contracts are still not linked to the OS capability contract (skillpact roadmap step 2). This job checks the Skills; it does not feed the planner.
