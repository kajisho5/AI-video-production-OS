# Security Policy

## Reporting a vulnerability

Please report security vulnerabilities privately using GitHub's built-in reporting
flow, not a public issue:

1. Go to this repository's **Security** tab.
2. Select **Advisories** → **Report a vulnerability**.

This opens a private advisory visible only to the maintainer, so the details aren't
public until a fix is ready.

## Scope

This repository (`AI-video-production-OS`) is architecture, contracts, and a read-only
ecosystem dashboard (see `dashboard/README.md` for its own security notes on how it
handles GitHub tokens). It has no server, no user data store, and no published package
of its own today. If your report concerns one of the Skill repositories or
`video-production-agent` that this project describes, please report it in that
repository instead, using the same private-advisory flow.
