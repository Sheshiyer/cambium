# Meristem Genesis Sidecar Intake

Date: 2026-06-27
Status: proof packet for sidecar implementation

## Source

- Repository: `https://github.com/Sheshiyer/meristem.git`
- Proof checkout: `/tmp/meristem-sidecar-proof`
- Role: external Genesis candidate for Cambium
- Approved design: `docs/superpowers/specs/2026-06-27-meristem-genesis-sidecar-design.md`
- Approved implementation plan: `docs/superpowers/plans/2026-06-27-meristem-genesis-sidecar-implementation.md`
- Promotion plan: `docs/plans/2026-06-29-meristem-active-genesis-flow.md`
- Meristem SHA observed during design: `d447fb9c8dd3a5c1c4846f271b20bea6e421ce7f`
- Meristem SHA observed during Task 3 proof: `d447fb9c8dd3a5c1c4846f271b20bea6e421ce7f`

## Intake Decision

Meristem was ingested as a sidecar contract source, not as vendored Cambium source.
This packet records the proof-only boundary that existed before promotion.
On 2026-06-29, the approved promotion plan moved Meristem into the active Cambium Genesis adapter while keeping Brandmint as disabled rollback metadata.

## Runner Evidence

| Probe | Result | Evidence |
| --- | --- | --- |
| `git -C /tmp/meristem-sidecar-proof rev-parse HEAD` | pass | `d447fb9c8dd3a5c1c4846f271b20bea6e421ce7f` |
| `./runner/bm.sh launch --config examples/brand-config.yaml --waves 1-2 --dry-run` | pass, exit `0` | Lists Wave 1 `foundation` spokes and Wave 2 `strategy` spokes. |
| `./runner/bm.sh plan --config examples/brand-config.yaml --waves 1-2 --dry-run` | blocked, exit `127` | `./runner/bm.sh: line 77: /tmp/meristem-sidecar-proof/orchestrator/plan.sh: No such file or directory` |
| `./runner/bm.sh resume --config examples/brand-config.yaml` | blocked, exit `127` | `./runner/bm.sh: line 74: /tmp/meristem-sidecar-proof/runner/resume.sh: No such file or directory` |

Launch dry-run output lists:

```text
Wave 1: foundation
  Spokes:
    - brand-foundation
    - buyer-persona
    - competitor-analysis
    - value-proposition
Wave 2: strategy
  Spokes:
    - brand-story
    - messaging-framework
    - product-positioning
    - voice-and-tone
```

## Contract Proof

Task 3 ran the Cambium shim and the contract-proof verification probes against the meristem sidecar:

```bash
MERISTEM_ROOT="${MERISTEM_ROOT:-/tmp/meristem-sidecar-proof}"
node scripts/meristem-genesis-contract.mjs \
  --meristem-root "$MERISTEM_ROOT" \
  --brand-dir brands/thoughtseed \
  --out /tmp/meristem-brand-dna.json \
  --evidence-out /tmp/meristem-genesis-evidence.json
jq 'keys' /tmp/meristem-brand-dna.json
jq -e '
  (.brand_system.brand_name | strings | length > 0) and
  (.brand_system.audience | strings | length > 0) and
  (.brand_system.positioning | strings | length > 0) and
  (.brand_system.promise | strings | length > 0) and
  (.brand_system.voice_principles | type == "array" and length > 0) and
  (.copy_system.copy_slots.hero_headline | strings | length > 0) and
  (.copy_system.copy_slots.hero_subhead | strings | length > 0) and
  (.copy_system.copy_slots.cta_primary | strings | length > 0) and
  (.visual_system.palette | type == "object" and length > 0) and
  (.visual_system.typography | type == "object" and length > 0) and
  (.visual_system.imagery_direction | type == "object" and length > 0) and
  (.visual_system.logo_usage | ((type == "object" and length > 0) or (type == "string" and length > 0)))
' /tmp/meristem-brand-dna.json
jq '.status, .requiredGroups, .consumedSkillCount, .assetManifest' /tmp/meristem-genesis-evidence.json
```

The generated Cambium payload emits exactly these top-level groups:

```json
[
  "brand_system",
  "copy_system",
  "visual_system"
]
```

The required Cambium Genesis schema probe above passed for:

- `brand_system.brand_name`
- `brand_system.audience`
- `brand_system.positioning`
- `brand_system.promise`
- `brand_system.voice_principles`
- `copy_system.copy_slots.hero_headline`
- `copy_system.copy_slots.hero_subhead`
- `copy_system.copy_slots.cta_primary`
- `visual_system.palette`
- `visual_system.typography`
- `visual_system.imagery_direction`
- `visual_system.logo_usage`

The stdout form was also checked by redirecting `--out -` to `/tmp/meristem-brand-dna-stdout.json` and running `jq 'keys'`.
It returned the same three top-level groups.

Proof evidence reports:

```json
{
  "status": "pass",
  "requiredGroups": ["brand_system", "copy_system", "visual_system"],
  "consumedSkillCount": 26,
  "assetManifest": {
    "allPathsExist": true,
    "userCount": 4,
    "generatedCount": 16
  },
  "meristemSha": "d447fb9c8dd3a5c1c4846f271b20bea6e421ce7f"
}
```

## Asset Manifest State

- `.brandmint/asset-manifest.json` exists under the meristem `brands/thoughtseed` sidecar output.
- Source manifest `validation.all_paths_exist` is `true`.
- Contract evidence preserves that state as `assetManifest.allPathsExist: true`.
- User-provided asset count is `4`.
- Generated asset count is `16`.

## Mapping Summary

| Cambium group | Meristem source family |
| --- | --- |
| `brand_system` | foundation, persona, competitors, value proposition, positioning, voice, story |
| `copy_system` | messaging, landing page, email sequences, ad copy, press release, product description |
| `visual_system` | palette, typography, logo, visual language, photography, illustration, social assets, asset manifest |

## Promotion Follow-up

The replacement gate was satisfied by `docs/plans/2026-06-29-meristem-active-genesis-flow.md`.
That plan promotes Meristem through `adapters.genesis`, preserves Brandmint as `candidate_adapters.genesis_brandmint_legacy.disabled`, and requires `compose run` proof plus focused and full Cambium tests before handoff.
