#!/usr/bin/env python3
"""
Proof-of-concept: does CAPABILITY_MODEL.md's Provider collision-resolution
policy actually resolve anything, when pointed at the REAL, already-published
contract data from qc-skill and media-analysis-skill (not synthetic
examples)?

This does NOT modify either Skill. It reads their real `contract --json`
output (already captured in this directory) and manually maps each Skill's
existing check/tool identifiers onto the OS-level Capability ids proposed in
CAPABILITY_MODEL.md's worked examples. That mapping step is itself a finding:
nothing in either Skill's real contract does this mapping today (see
FINDINGS.md), so a registry that wants Capability ids has to be told this
correspondence out-of-band, at least until every Skill publishes one.
"""
import json
from pathlib import Path

HERE = Path(__file__).parent


def load(name: str) -> dict:
    return json.loads((HERE / name).read_text())


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


def main():
    qc = load("qc-skill.contract.json")
    ma = load("media-analysis-skill.contract.json")

    print("=== Confirming the real data actually contains what CAPABILITY_TO_PROVIDERS claims ===")
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
          f"{'video.scene' in ' '.join(qc_checks).lower() or any('scene' in c for c in qc_checks)}")
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

    # --- Round 2: does mapping-to-Capability-id get easier with no collision? ----
    # Three MORE real, non-colliding Skills, to test the follow-up question from
    # docs/POC_CAPABILITY_CONTRACT.md's "Recommendation" section: is the manual
    # mapping step (Finding 3, above) specific to the qc-skill/media-analysis-skill
    # collision case, or does every Skill need it regardless of collision?
    print("\n\n=== Round 2: Capability-id extraction cost for three more real, "
          "non-overlapping Skills ===")

    ve = load("video-editing-skill.contract.json")
    ap = load("audio-production-skill.contract.json")
    ts = load("transcription-skill.contract.json")

    print("\n--- video-editing-skill: ZERO manual mapping needed ---")
    print("Its own contract's `operations` dict already carries a native")
    print("`capability` field per operation, in exactly the dotted-namespace shape")
    print("CAPABILITY_MODEL.md proposed (e.g. 'video.trim', not 'edit.trim' as this")
    print("project's own worked example guessed — the real Skill's own naming wins):")
    for name, spec in ve["operations"].items():
        print(f"    {name:<10} -> capability={spec.get('capability')!r}  (extracted automatically, no human judgment required)")

    print("\n--- audio-production-skill: manual mapping still needed ---")
    print("Its `operations` list has a `type` (e.g. 'NORMALIZE') and a `tool`")
    print("(e.g. 'ffmpeg-skill/loudness') but no native OS-level capability id field —")
    print("structurally similar to qc-skill/media-analysis-skill's situation, even")
    print("though audio-production-skill has no capability COLLISION with anyone:")
    sample_ops = [op for op in ap["operations"] if op["type"] in ("NORMALIZE", "GAIN", "MIX")]
    for op in sample_ops:
        guessed_id = {"NORMALIZE": "audio.normalize.loudness", "GAIN": "audio.gain", "MIX": "audio.mix"}[op["type"]]
        print(f"    type={op['type']:<10} tool={op['tool']!r:<28} -> a human would need to decide this is {guessed_id!r}")

    print("\n--- transcription-skill: manual mapping needed, plus its own naming drift ---")
    print(f"    id field used: 'id' = {ts.get('id')!r}  (NOT 'skill_id' — see Finding 5)")
    print(f"    flat capabilities list (not per-operation): {ts.get('capabilities')}")
    print("    -> 'speech_recognition' is the closest analog to an OS Capability id")
    print("       (e.g. transcribe.audio) but it names a general ABILITY, not one")
    print("       typed, invokable operation with its own input/output schema —")
    print("       still requires a human decision, just a smaller one.")

    print("\n=== Round 2 conclusion ===")
    print("Mapping cost is NOT determined by whether a Capability collision exists.")
    print("It is determined by whether a Skill's own contract generator already")
    print("emits a per-operation capability-shaped id. video-editing-skill happens to")
    print("(cost: ~zero). audio-production-skill, transcription-skill, qc-skill, and")
    print("media-analysis-skill do not (cost: one human decision per operation/check,")
    print("regardless of collision). See docs/POC_CAPABILITY_CONTRACT.md Finding 4.")


if __name__ == "__main__":
    main()
