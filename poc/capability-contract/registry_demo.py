#!/usr/bin/env python3
"""
Proof-of-concept: does CAPABILITY_MODEL.md's Provider collision-resolution
policy actually resolve anything, when pointed at the REAL, already-published
contract data from qc-skill and media-analysis-skill (not synthetic
examples)? And, having checked all 10 real Skills' contracts (see
docs/POC_CAPABILITY_CONTRACT.md Rounds 1-3), what does the ecosystem's real
identifier landscape actually look like?

This does NOT modify any Skill. It reads real `contract`/`skill` CLI output
(already captured in this directory) and manually maps each Skill's existing
check/tool identifiers onto the OS-level Capability ids proposed in
CAPABILITY_MODEL.md's worked examples where no native one exists. That
mapping step is itself a finding: most Skills' real contracts don't do this
mapping today (see FINDINGS.md), so a registry that wants Capability ids has
to be told this correspondence out-of-band, at least until every Skill
publishes one.
"""
import json
from pathlib import Path

HERE = Path(__file__).parent


def load(name: str) -> dict:
    return json.loads((HERE / f"{name}.contract.json").read_text())


# --- The manual mapping a real registry would need today ------------------
# (capability_id, skill_id, provider_ref, source_field_in_real_contract)
CAPABILITY_TO_PROVIDERS = {
    "measure.audio.loudness": [
        ("qc-skill", "audio.integrated_loudness_within_tolerance", "checks[]"),
        ("media-analysis-skill", "media-analysis/loudness", "tools[].tool_id"),
    ],
    "measure.audio.silence": [
        ("qc-skill", "audio.leading_silence_within_tolerance", "checks[] (one of three silence checks)"),
        ("media-analysis-skill", "media-analysis/silence", "tools[].tool_id"),
    ],
    "measure.video.integrity": [
        ("qc-skill", "video.decodes_without_errors", "checks[]"),
        ("media-analysis-skill", "media-analysis/integrity", "tools[].tool_id"),
    ],
    "measure.video.freeze": [
        ("qc-skill", "video.freeze_frames_within_tolerance", "checks[]"),
        # media-analysis-skill has NO freeze-frame tool — confirmed absent below.
    ],
    "measure.video.scene_detection": [
        ("media-analysis-skill", "media-analysis/scenes", "tools[].tool_id"),
        # qc-skill has NO scene-detection check — confirmed absent below.
    ],
}


class Registry:
    """The minimal thing CAPABILITY_MODEL.md's collision policy needs to exist."""

    def __init__(self):
        self._providers: dict[str, list[str]] = {}

    def register(self, capability_id: str, provider_id: str) -> None:
        self._providers.setdefault(capability_id, [])
        if provider_id not in self._providers[capability_id]:
            self._providers[capability_id].append(provider_id)

    def resolve(self, capability_id: str, explicit_provider: str | None = None,
                default_policy: dict[str, str] | None = None):
        """The three-tier policy from CAPABILITY_MODEL.md, applied literally."""
        providers = self._providers.get(capability_id, [])
        if not providers:
            return ("ERROR", f"no Provider registered for {capability_id!r}")

        # Tier 1: Plan-time explicit choice.
        if explicit_provider:
            if explicit_provider in providers:
                return ("RESOLVED", explicit_provider, "explicit Plan-time choice")
            return ("ERROR", f"explicit provider {explicit_provider!r} is not a "
                              f"registered Provider of {capability_id!r} (registered: {providers})")

        # Tier 2: default-provider policy.
        if default_policy and capability_id in default_policy:
            chosen = default_policy[capability_id]
            if chosen in providers:
                return ("RESOLVED", chosen, "default-provider policy")

        # Tier 3: registry refusal if ambiguous.
        if len(providers) == 1:
            return ("RESOLVED", providers[0], "only one Provider available")
        return ("REFUSED", f"{len(providers)} Providers available for {capability_id!r} "
                            f"({providers}) and no explicit choice or default policy was given "
                            f"— CAPABILITY_MODEL.md requires this to fail loudly, not pick silently")


def round1_and_2():
    qc = load("qc-skill")
    ma = load("media-analysis-skill")

    print("=== ROUND 1: Confirming the real data actually contains the collision ===")
    qc_checks = set(qc["checks"])
    ma_tool_ids = {t["tool_id"] for t in ma["tools"]}
    for cap_id, providers in CAPABILITY_TO_PROVIDERS.items():
        for skill, ref, source in providers:
            if skill == "qc-skill":
                present = ref in qc_checks
            elif skill == "media-analysis-skill":
                present = ref in ma_tool_ids
            else:
                present = None
            print(f"  {cap_id:<32} {skill:<20} {ref:<45} present={present}")

    print("\n=== Confirming the two known ABSENCES (not a strict subset relationship) ===")
    print(f"  qc-skill has scene-detection check?      "
          f"{any('scene' in c for c in qc_checks)}")
    print(f"  media-analysis-skill has a freeze tool?  "
          f"{any('freeze' in t['tool_id'] for t in ma['tools'])}")

    print("\n=== Registering both Skills as Providers, per CAPABILITY_MODEL.md ===")
    registry = Registry()
    for cap_id, providers in CAPABILITY_TO_PROVIDERS.items():
        for skill, _ref, _source in providers:
            registry.register(cap_id, skill)
    for cap_id in CAPABILITY_TO_PROVIDERS:
        print(f"  {cap_id:<32} -> providers: {registry._providers[cap_id]}")

    print("\n=== Exercising the three-tier collision policy ===")
    scenarios = [
        ("measure.audio.loudness", None, None, "no explicit choice, no default policy"),
        ("measure.audio.loudness", "qc-skill", None, "explicit Plan-time choice = qc-skill"),
        ("measure.audio.loudness", None, {"measure.audio.loudness": "media-analysis-skill"}, "default-provider policy prefers media-analysis-skill"),
        ("measure.video.freeze", None, None, "only qc-skill provides this — single-Provider case"),
        ("measure.audio.loudness", "some-third-skill", None, "explicit choice names a Provider that never registered"),
    ]
    for cap_id, explicit, policy, label in scenarios:
        result = registry.resolve(cap_id, explicit_provider=explicit, default_policy=policy)
        print(f"  [{label}]")
        print(f"    resolve({cap_id!r}, explicit={explicit!r}, policy={policy!r})")
        print(f"    -> {result}")

    print("\n\n=== ROUND 2: Capability-id extraction cost for three non-overlapping Skills ===")
    ve = load("video-editing-skill")
    ap = load("audio-production-skill")
    ts = load("transcription-skill")

    print("\n--- video-editing-skill: ZERO manual mapping needed ---")
    for name, spec in ve["operations"].items():
        print(f"    {name:<10} -> capability={spec.get('capability')!r}  (extracted automatically)")

    print("\n--- audio-production-skill: manual mapping still needed ---")
    sample_ops = [op for op in ap["operations"] if op["type"] in ("NORMALIZE", "GAIN", "MIX")]
    for op in sample_ops:
        guessed_id = {"NORMALIZE": "audio.normalize.loudness", "GAIN": "audio.gain", "MIX": "audio.mix"}[op["type"]]
        print(f"    type={op['type']:<10} tool={op['tool']!r:<28} -> a human would decide this is {guessed_id!r}")

    print("\n--- transcription-skill: manual mapping needed, plus 'id' not 'skill_id' ---")
    print(f"    id field used: 'id' = {ts.get('id')!r}")
    print(f"    flat capabilities list (not per-operation): {ts.get('capabilities')}")


def round3_ecosystem_wide_summary():
    print("\n\n=== ROUND 3: ecosystem-wide summary across all 10 real Skills ===")
    names = ["qc-skill", "media-analysis-skill", "video-editing-skill", "audio-production-skill",
             "transcription-skill", "ffmpeg-skill", "color-grading-skill", "motion-graphics-skill",
             "subtitle-skill", "thumbnail-skill"]

    print(f"\n{'Skill':<24}{'id field':<14}{'contract_version':<20}{'native domain.verb capability id?'}")
    for n in names:
        d = load(n)
        if n == "ffmpeg-skill":
            idf, cv, dv = "skill.id (nested!)", repr(d.get("contract_version")), "no"
        else:
            idf = "skill_id" if "skill_id" in d else ("id-only" if "id" in d else "NEITHER")
            if "skill_id" in d and "id" in d:
                idf += "+id"
            cv = repr(d.get("contract_version"))
            ops = d.get("operations")
            dv = "no"
            if isinstance(ops, dict):
                sample = next(iter(ops.values()))
                if isinstance(sample, dict) and "capability" in sample:
                    dv = f"YES ({sample['capability']!r} style)"
        print(f"{n:<24}{idf:<14}{cv:<20}{dv}")

    have_cv = sum(1 for n in names if load(n).get("contract_version") not in (None,))
    print(f"\ncontract_version actually published: {have_cv}/10 Skills "
          f"(qc-skill, ffmpeg-skill, subtitle-skill — three different value types: int, '1.0', '1.0.0')")
    print("A native cross-Skill-style Capability id (domain.verb, e.g. 'video.trim') "
          "exists natively in exactly 1/10 Skills (video-editing-skill).")
    print("A native per-operation Tool id (skill/tool, e.g. 'ffmpeg-skill/audio') — a "
          "DIFFERENT, already-common convention — exists in 4/10 Skills (ffmpeg-skill, "
          "media-analysis-skill, thumbnail-skill, and partially qc-skill's checks[] "
          "strings, which are dotted but skill-internal, e.g. "
          "'audio.integrated_loudness_within_tolerance').")
    print("3/10 Skills (audio-production-skill, color-grading-skill, motion-graphics-skill) "
          "expose only ONE generic '<skill>/run' tool at the top level — their real, "
          "granular operations live one level deeper (an 'operations' list keyed by "
          "'type', e.g. NORMALIZE/HDR_TO_SDR) and are not independently addressable "
          "tool ids today, only request parameters to the single 'run' tool.")


if __name__ == "__main__":
    round1_and_2()
    round3_ecosystem_wide_summary()
