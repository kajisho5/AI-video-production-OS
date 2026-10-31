#!/usr/bin/env python3
"""Which repositories in ecosystem.json carry a SkillPact contract, and what their conformance run reported.

.github/workflows/skillpact-conformance.yml uses it twice (ADR-014):

    python3 scripts/skillpact-satellites.py list [--github-output]
        Every component that is not "planned" and has skill.contract.json at the root of its default
        branch (read from raw.githubusercontent.com, so there is no API rate limit). Prints a matrix
        {"include": [{"repo": ..., "apt": "..."}]}; "apt" names the Ubuntu packages for the binaries
        the contract requires, when this script knows them (APT below). A requirement it does not know
        is left to SkillPact, which names it as unmet on the runner.

    python3 scripts/skillpact-satellites.py summary DIR
        Reads the result-*.json files the matrix jobs wrote ({"repo", "level", "outcome"}) and prints a
        Markdown table for the job summary. It always exits 0: the job reports, it never blocks.

Standard library only.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTRACT = "skill.contract.json"
RAW = "https://raw.githubusercontent.com/{org}/{repo}/HEAD/" + CONTRACT

# Binary a contract may require -> Ubuntu package that provides it. Only what the satellites need.
APT = {
    "magick": "imagemagick",
    "convert": "imagemagick",
    "ffmpeg": "ffmpeg",
    "ffprobe": "ffmpeg",
    "exiftool": "libimage-exiftool-perl",
    "mediainfo": "mediainfo",
    "sox": "sox",
}

LEVELS = ("L3-signed", "L2-tested", "L1-declared")


def fetch(url: str) -> str | None:
    """Body of url, or None on 404. Any other failure raises: a broken lookup must not read as "no contract"."""
    try:
        with urllib.request.urlopen(url, timeout=30) as r:
            return r.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise


def apt_packages(contract: dict) -> list[str]:
    pkgs: list[str] = []
    for b in (contract.get("requirements") or {}).get("binaries") or []:
        for name in [b.get("name"), *(b.get("alternatives") or [])]:
            pkg = APT.get(name or "")
            if pkg:
                if pkg not in pkgs:
                    pkgs.append(pkg)
                break
    return pkgs


def satellites(manifest: dict, get=fetch) -> list[dict]:
    out = []
    for c in manifest.get("components", []):
        if c.get("status") == "planned":
            continue
        body = get(RAW.format(org=manifest["org"], repo=c["repo"]))
        if body is None:
            continue
        try:
            contract = json.loads(body)
        except ValueError:
            contract = {}  # SkillPact's validate step reports the broken file; the repo still gets a job
        out.append({"repo": c["repo"], "apt": " ".join(apt_packages(contract))})
    return out


def summary(results_dir: Path) -> str:
    rows = []
    for f in sorted(results_dir.glob("**/result-*.json")):
        try:
            rows.append(json.loads(f.read_text(encoding="utf-8")))
        except ValueError:
            continue
    lines = ["## SkillPact conformance (non-blocking)", ""]
    if not rows:
        lines.append("No repository in ecosystem.json has a `skill.contract.json` yet, or no job reported a result.")
        return "\n".join(lines) + "\n"
    lines += ["| repository | level | result |", "|---|---|---|"]
    for r in sorted(rows, key=lambda r: r.get("repo", "")):
        level = r.get("level") or "none"
        ok = level in LEVELS and r.get("outcome") == "success"
        lines.append(f"| `{r.get('repo')}` | `{level}` | {'pass (L1 or better)' if ok else 'below L1 or failed'} |")
    lines += ["", "Each repository's own job summary lists the findings and the test cases."]
    return "\n".join(lines) + "\n"


def main(argv: list[str] | None = None, get=fetch) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    ls = sub.add_parser("list")
    ls.add_argument("--manifest", default=str(ROOT / "ecosystem.json"))
    ls.add_argument("--github-output", action="store_true", help="also write matrix= and count= to $GITHUB_OUTPUT")
    sm = sub.add_parser("summary")
    sm.add_argument("dir")
    a = ap.parse_args(argv)

    if a.cmd == "summary":
        sys.stdout.write(summary(Path(a.dir)))
        return 0

    found = satellites(json.loads(Path(a.manifest).read_text(encoding="utf-8")), get)
    matrix = json.dumps({"include": found})
    print(matrix)
    if a.github_output and os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as f:
            f.write(f"matrix={matrix}\ncount={len(found)}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
