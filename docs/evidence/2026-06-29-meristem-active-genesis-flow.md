# Meristem Active Genesis Flow Evidence

Date: 2026-06-29
Cambium branch: `docs/meristem-genesis-sidecar`
Meristem proof checkout: `/tmp/meristem-sidecar-proof`
Meristem SHA: `d447fb9c8dd3a5c1c4846f271b20bea6e421ce7f`

## Direct Shim Proof

Command:

```bash
node scripts/meristem-genesis-contract.mjs \
  --meristem-root /tmp/meristem-sidecar-proof \
  --brand-dir brands/thoughtseed \
  --out /tmp/meristem-active-genesis-output.json \
  --evidence-out /tmp/meristem-active-genesis-evidence.json
```

Verification:

```bash
jq -e '
  (.brand_system.brand_name | strings | length > 0) and
  (.copy_system.copy_slots.hero_headline | strings | length > 0) and
  (.visual_system.palette | type == "object" and length > 0)
' /tmp/meristem-active-genesis-output.json

jq -e '
  .status == "pass" and
  .assetManifest.allPathsExist == true and
  .meristemDirty == false
' /tmp/meristem-active-genesis-evidence.json
```

Result: both `jq -e` probes returned `true`.

Observed payload summary:

```json
{"brand":"Thoughtseed","headline":"Digital Wilderness","status":"/tmp/meristem-active-genesis-output.json"}
```

## Cambium Active Run Proof

Command:

```bash
node bin/compose.mjs run thoughtseed \
  --stage genesis \
  --execute \
  --input /tmp/meristem-sidecar-proof
```

Observed output:

```text
Cambium run - tenant: thoughtseed  (--execute)

  genesis  [idea -> brand-dna] . free  input from prior stage
     -> cd /Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/cambium && node scripts/meristem-genesis-contract.mjs --meristem-root /tmp/meristem-sidecar-proof --brand-dir brands/thoughtseed --out -
     spawned (exit 0)

1 spawned . 0 refused (fail-closed).
```

## Adapter State

Verification:

```bash
jq -e '
  .adapters.genesis.cmd == "node" and
  .adapters.genesis.output == "json:brand-dna" and
  .candidate_adapters.genesis_brandmint_legacy.disabled == true
' adapters.json
```

Result: `true`.
