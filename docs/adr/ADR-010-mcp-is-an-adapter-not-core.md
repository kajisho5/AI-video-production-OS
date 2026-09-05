# ADR-010: MCP Is an External Interface Adapter, Not an OS-Core Dependency

Status: Accepted

## Context

`REPOSITORY_MAP.md` finding 5 and `ARCHITECTURE.md` §5 document MCP's actual footprint in
the ecosystem: it is used by exactly **1 of 11 repos** — `ffmpeg-skill`, whose `mcp/
server.py` is a stdio JSON-RPC 2.0 server. At least three other repos explicitly defer or
reject it as a goal: `media-analysis-skill`'s `docs/decisions.md` ADR-010 states "No MCP
server in 0.1.0... can be added as a thin wrapper over `run` later"; `motion-graphics-
skill`'s `docs/architecture.md` "explicitly lists 'MCP' among things it deliberately does
not do"; and `subtitle-skill`'s README likewise does not include it. This is direct,
already-occurred evidence against treating MCP as the ecosystem's interface layer.

At the same time, `ffmpeg-skill`'s MCP implementation demonstrates a genuinely valuable,
validated pattern, not just a one-off feature: `REPOSITORY_MAP.md` notes the MCP server
"holds no tool table and no schema of its own"; `tools/list` and argument mapping "are
derived live from the same contract generator used by the CLI" (`scripts/_contract.py`,
which "generates a live, machine-readable `ToolSpec` per script directly from that
script's own `argparse` parser — the schema cannot drift from the implementation because
it *is* the implementation, introspected"). MCP support in `ffmpeg-skill` is
contract-generated, not hand-written per tool.

## Decision

Treat MCP as one external interface adapter over the Capability Contract (`SKILL_SPEC.md`),
not an OS-core dependency. The OS formalizes the Capability Contract format precisely so
that any conformant Skill can get an MCP adapter, a CLI, and other-language bindings
generated from one contract — generalizing `ffmpeg-skill`'s proven pattern (contract-
generated `tools/list`) to the whole ecosystem, instead of MCP support remaining a
bespoke, one-off reimplementation as it is today, confined to `ffmpeg-skill` alone. Claude
Code, Codex, Gemini CLI, a web UI, or a human at a terminal are all equally valid
Agent-side consumers of the same contract; none is privileged.

## Consequences

- No Skill is required to hand-write an MCP server; one can be mechanically derived from
  its Capability Contract, the same way `ffmpeg-skill` already derives its `tools/list`
  from its `argparse`-introspected `ToolSpec`.
- Skills that have explicitly rejected MCP (`motion-graphics-skill`) remain fully
  conformant without ever implementing it — MCP support becomes optional and automatic,
  not mandatory and hand-built.
- The OS avoids coupling its core contracts to any one transport's evolution (MCP,
  HTTP, gRPC), consistent with `ARCHITECTURE.md` §8's exclusion of "a specific transport"
  from the kernel.

## Alternatives Considered

**Make MCP the OS's core interface layer** (e.g. require every Skill to expose an MCP
server as the canonical way of joining the ecosystem). Rejected on direct evidence: 10 of
11 repos do not implement one today, and three of those explicitly documented a decision
not to. Mandating MCP as core would contradict the ecosystem's own, already-recorded
design choices and would treat one adapter — used successfully by exactly one repo — as
though it were the whole contract, rather than one validated consumption pattern the
contract format now generalizes for any conformant Skill.
