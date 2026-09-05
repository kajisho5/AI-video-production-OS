# Plugin Model: The Minimal Foundation for Third-Party Skills

Status tags as elsewhere: **CURRENT**, **PROPOSED**, **FUTURE**, **UNKNOWN**. Per the
task brief, this document is explicitly **not a marketplace**. It designs the minimal
foundation that makes a third-party Skill possible and safe-by-structure to admit, and
stops there — no package index, no distribution channel, no discovery UI, no rating/
review system. Where a fuller mechanism is implied but not needed yet, that is named as
**FUTURE** and deliberately left undesigned, following the same discipline
`ARCHITECTURE.md` §10 applies to the Resource model.

## 1. Discovery

**CURRENT limitation, PROPOSED foundation, FUTURE automatic mechanism.**

Today, `video-production-agent`'s `Service.adapter()` registers each Skill adapter **by
hand** — there is, in the exact words of the codebase's own `skills/contract.py`, "no
package loader, plugin manager or dynamic import" (`REPOSITORY_MAP.md`). This is the
starting point this plugin model must eventually replace, named here explicitly as a
limitation, not hidden or apologized away: **manual registration is what exists today,
and it does not scale to third-party Skills an OS maintainer has never seen.**

The foundation this document proposes, without over-designing the eventual automatic
mechanism:

- A Skill **registers** by publishing a `CapabilityContract` (`SPEC.md` §1) at a known
  location. Two shapes are equally valid and neither is chosen over the other yet,
  because no evidence favors one:
  - A **directory the OS scans** — e.g. a configured list of Skill checkout paths, each
    expected to expose a `contract` command or a static contract file at a conventional
    location. This is the closer relative of what `ffmpeg-skill`'s adapters already do
    when locating a dependency checkout (env var → well-known paths, `SKILL_SPEC.md`
    §5) — this document generalizes that lookup mechanism from "one Skill finding one
    specific dependency" to "the OS finding any number of registered Skills."
  - An **explicit registration call** — a Skill (or its installer) tells the OS registry
    "I exist, here is my contract," analogous to a plugin calling a `register()` hook.
    This is closer to what a package manager's post-install hook would do.
- **What this document deliberately does not decide**: which of the two shapes above (or
  some hybrid) the OS eventually implements, what the scan/registration cadence is
  (on-demand vs. a maintained index), and how a Skill is de-registered or updated in
  place. This is real, acknowledged under-design — building it now would mean guessing
  at a shape with zero third-party Skills yet in existence to validate the guess against
  (mirroring the same restraint `ARCHITECTURE.md` §10 applies to the Resource model, and
  §12's open question about whether the conformance suite should be a harness or a spec).

**The one thing this document does commit to**: whichever discovery mechanism is
eventually built, it must require **zero OS core code changes** per new Skill — this is
the concrete test already stated in `ARCHITECTURE.md` §11 ("New, unimagined Skill
tomorrow, no OS core changes?") and is the entire reason `Service.adapter()`'s manual
registration is named as a gap to close rather than a pattern to keep.

## 2. Capability declaration

**Already defined — not redefined here.** See `SPEC.md` §1 for the `CapabilityContract`
shape and `CAPABILITY_MODEL.md` for what a Capability, Provider, Skill, and Runtime each
mean. A plugin (third-party Skill) declares capabilities exactly the same way any Skill
in the current ecosystem does — there is no separate, lesser, or different contract
format for "external" vs. "in-house" Skills. This uniformity is itself a design choice:
treating every Skill as a plugin from the OS's point of view (rather than privileging
the 10 audited Skills as somehow more trusted by default) is what makes third-party
compatibility possible without a special case.

## 3. Compatibility checking

**Already proven working — not a new mechanism.** `contract_version` negotiation
(§`VERSIONING.md` §2) is the exact `SUPPORTED_MIN`/`SUPPORTED_MAX` pattern already used
by 5 Skills' `ffmpeg-skill` adapters today. A plugin's compatibility with the rest of the
ecosystem — specifically, with any Skill it declares a dependency on — is checked the
same way: at startup, by comparing the located dependency's `contract_version` against
the plugin's declared range, failing fast and loudly if outside range. Nothing new is
introduced here; this section exists only to confirm the plugin model uses the same
mechanism as the rest of the ecosystem rather than inventing a parallel one.

## 4. Permission declaration

**PROPOSED — no repo declares this explicitly today.** Every audited Skill hardcodes its
`PathPolicy` roots in source (`REPOSITORY_MAP.md` finding 3; `CORE_PRIMITIVES.md` §11's
Workspace primitive). This works when the OS maintainer trusts every Skill's author
implicitly (true of all 10 audited Skills, all single-owner `kajisho5` repos today) and
stops working the moment a Skill's author is someone the OS operator has never met.

A plugin's Capability Contract should declare, as data, not just embed in
unreviewable source:

- **Filesystem roots**: which workspace root(s) it needs read access to, and which it
  needs write access to — the same information `SKILL_PROPOSAL.md` §1.5 asks a proposal
  author to state explicitly, generalized here into a contract field rather than prose
  in a proposal document.
- **Network access**: none, by ecosystem norm (`SPEC.md` §7 confirms no repo in the
  ecosystem talks to a network service today) — a plugin declaring any network need is a
  deviation from that norm and should be treated as exceptional, exactly as
  `SKILL_PROPOSAL.md` §1.5 requires extra scrutiny for it.
- **External tools/binaries**: which ones it invokes (mirroring `ffmpeg-skill`'s own
  `not_provided` self-declaration pattern, but pointed the other direction — declaring
  what it *does* need rather than what it doesn't provide).

**What this section does not yet define**: an enforcement mechanism that actually
*confines* a plugin to its declared permissions at runtime (e.g. an OS-level sandbox that
denies filesystem access outside declared roots regardless of what the plugin's own code
tries to do). See §6 — this is exactly the isolation gap this document is honest about.
Declaration without enforcement is still valuable (it makes the conformance suite's
workspace-confinement check in `SKILL_SPEC.md` §8 checkable against a stated permission
set instead of an assumed one), but it is not a security boundary by itself.

## 5. Provenance recording

**Already existing — not new.** Every `Artifact` records `produced_by: { capability_id,
provider_id, skill_id, skill_version, operation_id }` (`SPEC.md` §2), and every
`ProductionReceipt` records `skill_versions` and `tool_versions` for everything that ran
(`SPEC.md` §6). A plugin (third-party Skill) is recorded in provenance exactly the same
way an in-house Skill is — `skill_id` and `skill_version` do not distinguish "trusted"
from "third-party" origin today, and this document does not propose adding such a
distinction, because no evidence yet shows what an OS operator would even do with that
distinction (a policy question, not a schema question) — see §7's open question.

## 6. Isolation

**Honest limitation, not a design choice.** The universal pattern across all 11 audited
repos is **subprocess-based isolation only**: a process group per invocation (so a
timeout kills the whole tree), `shell=False`/list-argv exclusively, and workspace-
confined path policy (`ARCHITECTURE.md` §7). **No repo in the ecosystem uses containers,
VMs, or any OS-level sandbox (seccomp, namespaces, gVisor, etc.) beyond subprocess
isolation plus path policy** — confirmed absent everywhere, not merely undocumented.

This is a genuinely good pattern for the trust level the ecosystem operates at today —
every existing Skill is authored by the same single owner as the OS itself
(`REPOSITORY_MAP.md`: "all 11 repositories below are single-owner"). It is **not**
sufficient isolation for truly untrusted third-party code, and this document says so
plainly rather than presenting subprocess isolation as a security boundary it is not:

- A malicious or buggy plugin that stays within the FORBIDDEN_KEYS/PathPolicy contract's
  *letter* (never asks for a forbidden key, never requests a path outside its declared
  workspace) can still do damage a subprocess boundary alone cannot stop — consuming
  unbounded CPU/memory/disk (no repo enforces resource limits beyond a wall-clock
  timeout, an honest gap `qc-skill`'s own docs already admit), reading environment
  variables not explicitly scrubbed, or exploiting a vulnerability in a legitimately
  invoked external tool (e.g. a malicious media file crafted to exploit an `ffmpeg` CVE
  the Skill has no way to know about).
- The FORBIDDEN_KEYS/PathPolicy pattern (`SKILL_SPEC.md` §3) is a **contract-level**
  guarantee, enforceable by convention and conformance testing, not a **kernel-level**
  guarantee enforced regardless of what the plugin's own process actually does once
  spawned. A conformant plugin's own code chooses to honor the contract; nothing at the
  OS level currently *forces* it to.

**FUTURE, not designed here**: container- or sandbox-based isolation (e.g. running each
plugin invocation inside a locked-down container or microVM with an OS-enforced
filesystem/network/resource boundary independent of the plugin's own cooperation) would
close this gap. This document does not design that mechanism, because doing so now would
be solving a problem this ecosystem — currently 100% single-owner-authored Skills — does
not yet have real evidence it needs, exactly the restraint `ARCHITECTURE.md` §10 applies
elsewhere. **The moment a genuinely untrusted third party is expected to publish a Skill
that any operator can run, this gap becomes load-bearing and must be revisited before
that happens — not after.** This is flagged as a real security limit, not a footnote.

## 7. How the OS rejects an unsafe plugin

**PROPOSED, structural, not a code-quality judgment call** — directly answering the
question this document is scoped to answer, and consistent with `SKILL_PROPOSAL.md`
§1.9's "contract validation, not code review of internals."

A plugin is rejected — meaning: not admitted as OS-compatible, not registered as an
available Provider of any Capability — when it fails any of:

1. **Missing or invalid required contract fields.** Its `CapabilityContract` does not
   validate against `SPEC.md`'s shape (missing `skill_id`, `contract_version`, or any
   `capabilities[]` entry missing `id`, `input_schema`, `output_schema`, or `lifecycle`).
   This is a pure schema-validation check — deterministic, automatable, no human
   judgment involved.
2. **Failing the black-box conformance test suite** (`SKILL_SPEC.md` §8): does not
   reject FORBIDDEN_KEYS-equivalent parameters, does not confine outputs to a declared
   workspace, overwrites a declared input, cannot demonstrate absence of unsafe shell
   execution by the AST-walk-or-equivalent check where source is available (or fails the
   injection-probe fallback where it is not), does not report a `doctor` status, or
   declares an exact-version dependency pin instead of a range.
3. **Declaring a permission (§4) it does not actually confine itself to** — checkable
   today only as a documentation-consistency check (does the contract's declared
   filesystem roots match what its conformance-suite path-containment test actually
   enforces), not as a runtime-enforced guarantee, per the honest isolation gap in §6.

This is a **structural rejection**: every one of the three checks above is a
deterministic pass/fail an automated process can run without a human reading the
plugin's source or forming an opinion about its code quality, its choice of algorithm,
or its licensing. This is the same principle `SKILL_PROPOSAL.md` §1.9 states for the
proposal process generally, restated here specifically for the rejection side of the
same mechanism: **OS-compatibility is a contract-and-conformance fact, never a
maintainer's subjective code review.**

What this does **not** cover: a plugin that passes every structural check but is simply
bad at its job (produces low-quality output, has a poorly-designed API, is
unmaintained). Those are real concerns for anyone choosing to depend on a given plugin,
but they are not OS-compatibility concerns, and this document does not conflate the two
— exactly the distinction `ARCHITECTURE.md` §8 draws between the kernel (what the OS
enforces) and Skill business logic (what a Skill author is responsible for on their own).

## 8. Versioning

**Already defined — not redefined here.** See `VERSIONING.md` for the two-axis
(`skill.version` / `contract_version`) pattern and the pinned-range rule. A plugin
versions itself exactly the same way any Skill does; there is no separate versioning
regime for third-party Skills.

## 9. What this document deliberately does not define (the marketplace non-goals)

Per explicit task instruction, none of the following are designed here, and building
any of them now would be premature relative to the ecosystem's current state (zero
third-party Skills exist yet to design a marketplace around):

- A package index, registry service, or distribution channel for discovering plugins
  across organizations (as opposed to the single-operator directory-scan or
  registration-call foundation in §1).
- A rating, review, or trust-scoring system for plugins.
- A payment, licensing-fee, or monetization mechanism.
- An automatic-update mechanism for installed plugins.
- The concrete automatic discovery mechanism itself (§1's FUTURE gap) — only its
  minimal required property (zero OS core changes per new Skill) is committed to here.
- Sandboxed/containerized execution (§6's FUTURE gap) — named as a real limitation, not
  designed as a solution.
