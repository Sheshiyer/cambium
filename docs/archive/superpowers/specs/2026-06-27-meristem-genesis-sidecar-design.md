# Meristem Genesis Sidecar Design

Date: 2026-06-27
Status: Approved design, pending implementation plan

## Purpose

Ingest `Sheshiyer/meristem` into the Cambium flow as a contract-proven Genesis sidecar, not as vendored source and not as an immediate replacement for the active Genesis adapter.

The design preserves meristem as its own repository, extracts its transferable Brandmint contract and wisdom, adds a proof path for Cambium's Genesis handoff, and blocks replacement until meristem can prove the exact variable groups Cambium already requires.

## Current State

Cambium already has a composition seam for Genesis:

- `registry.json` defines Genesis as the brand brain.
- `composition/pipeline.json` expects Genesis to produce `brand_system`, `copy_system`, and `visual_system`.
- `adapters.json` currently points the Genesis adapter at `brandmint launch --waves 1-8`.
- `bin/lib/invoke.mjs` validates required variable groups at stage handoffs and fails closed on missing contracts.

Meristem is a separate Brandmint v2 repository with:

- Seven waves: foundation, strategy, identity, photography, illustration, content, synthesis.
- Shell-first runner entrypoint: `./runner/bm.sh`.
- Existing Thoughtseed outputs under `.brandmint/outputs/`.
- An asset manifest that records user-provided and generated assets.
- A working `launch --dry-run` path.
- Missing advertised `plan` and `resume` command targets, which must remain visible as runner blockers.

## Out Of Scope

- Do not copy meristem source into Cambium.
- Do not vendor meristem-generated assets into Cambium.
- Do not replace the active Genesis adapter in the first implementation.
- Do not mutate `registry.json`, `composition/pipeline.json`, or default `adapters.json` to route normal runs through meristem yet.
- Do not treat meristem's richer seven-wave outputs as proof unless they map to Cambium's three Genesis groups.

## Approved Approach

Use a contract-proof sidecar.

Cambium should record meristem as an external Genesis candidate and add a proof command that reads meristem outputs, maps them into Cambium's current Genesis contract, and fails closed unless the mapped payload satisfies the expected shape.

The first implementation should produce documentation and a proof target only. Active replacement happens later, after the proof target and tests pass.

## Alternatives Considered

### Runner-Fix First

Patch meristem's missing `plan` and `resume` commands before creating the Cambium proof shim.

This is cleaner upstream, but it delays the Cambium seam test. It also risks turning the intake into a meristem maintenance task before proving whether the repo is the right Genesis candidate.

### Wisdom Packet Only

Extract Brandmint lessons into Cambium docs and stop.

This is safest, but it leaves the replacement path vague. It captures ideas without creating a binary proof gate.

### Direct Replacement

Point Cambium's active Genesis adapter at meristem immediately.

This is rejected. Meristem has useful outputs, but its runner still has missing command targets and has not proven Cambium's `brand_system`, `copy_system`, and `visual_system` contract.

## Contract Mapping

The sidecar shim maps meristem outputs into Cambium's Genesis groups:

| Cambium group | Meristem sources | Intent |
| --- | --- | --- |
| `brand_system` | foundation, buyer persona, competitor analysis, value proposition, positioning, voice, story | Canonical brand identity, market, audience, values, positioning, and voice |
| `copy_system` | messaging framework, landing page copy, email sequences, ad creative, press release, product description | Reusable copy primitives and channel-specific campaign material |
| `visual_system` | color palette, typography, logo concept, visual language, photography, illustration, asset manifest | Visual rules, asset inventory, generated references, and path validation |

The shim may preserve meristem detail inside nested fields, but the top-level output must be a Cambium Genesis payload:

```json
{
  "brand_system": {},
  "copy_system": {},
  "visual_system": {}
}
```

## Proof Gates

The proof path fails closed at four gates.

### 1. Repo Gate

- Meristem path exists.
- Meristem commit SHA is recorded.
- Meristem working tree is clean, or the evidence packet explicitly records that it is dirty.

### 2. Runner Gate

- `./runner/bm.sh launch --config examples/brand-config.yaml --waves 1-2 --dry-run` succeeds.
- Missing `plan` and `resume` command targets are recorded as blockers.
- The proof command does not require a live paid generation run.

### 3. Artifact Gate

- Required `.brandmint/outputs/*.json` files exist.
- Every consumed output parses as JSON.
- Every consumed output has `status: "complete"`.
- Asset manifest validation reports `all_paths_exist: true`.

### 4. Cambium Contract Gate

- The shim emits parseable JSON.
- Top-level keys include `brand_system`, `copy_system`, and `visual_system`.
- The emitted payload passes Cambium's existing stage-contract validation.
- If a group is missing, empty, malformed, or inferred only from prose, the proof fails.

## Proposed Cambium Surfaces

First implementation:

- `docs/plans/2026-06-27-meristem-genesis-sidecar-intake.md`
  - Evidence packet with meristem SHA, runner gaps, output inventory, mapping table, and proof result.
- `scripts/meristem-genesis-contract.mjs`
  - Reads meristem outputs and emits Cambium Genesis JSON.
- Focused tests for the shim.
  - Prefer a new focused test if it keeps `bin/invoke.test.mjs` from becoming broader.

Later implementation, after proof:

- Disabled or explicit opt-in adapter entry for `genesis_meristem_candidate`.
- Active Genesis adapter replacement only after the candidate passes proof and review.

## Data Flow

```text
Sheshiyer/meristem
  -> Brandmint outputs + asset manifest
  -> Cambium meristem contract shim
  -> { brand_system, copy_system, visual_system }
  -> proof gate
  -> disabled Genesis candidate adapter
  -> later active Genesis replacement
```

## Error Handling

- Missing meristem path: fail with the expected path and setup instruction.
- Dirty meristem checkout: warn in the evidence packet; fail only if strict mode is requested.
- Missing output JSON: fail and list the missing outputs.
- Invalid output JSON: fail and list the failing file.
- Incomplete output status: fail and list files whose status is not `complete`.
- Missing asset path: fail and report the asset manifest's missing paths.
- Missing Cambium group: fail and list the absent top-level groups.
- Runner command gap: record as a blocker; do not hide it behind a successful artifact extraction.

## Test Strategy

- File probe: the design spec exists and names the sidecar contract.
- Command probe: meristem `launch --dry-run` succeeds for a sample config.
- Command probe: meristem `plan` and `resume` failures are captured in the intake evidence.
- JSON probe: consumed meristem outputs parse with `jq`.
- JSON probe: consumed outputs have `status: "complete"`.
- JSON probe: asset manifest reports `all_paths_exist: true`.
- Unit probe: shim fixture emits top-level `brand_system`, `copy_system`, and `visual_system`.
- Unit probe: shim fixture fails when any required group is missing.
- Integration probe: Cambium stage-contract validation accepts the emitted payload.
- Regression probe: normal Cambium `compose validate` still resolves current pipeline.

## Implementation Order

1. Write this approved design spec.
2. Write the meristem sidecar intake evidence packet.
3. Add fixture-driven tests for the contract shim.
4. Implement the shim with no live generation dependency.
5. Capture proof output in the intake evidence packet.
6. Add a disabled candidate adapter only after the proof command passes.
7. Revisit active Genesis replacement in a separate approved implementation plan.

## Acceptance Criteria

- Meristem remains a separate repo.
- Cambium gains a durable sidecar intake record.
- The shim proves only the current Cambium Genesis variable groups.
- Current Genesis remains active until the sidecar proof passes.
- Missing meristem runner commands remain visible blockers.
- The first implementation does not vendor generated assets or runtime state.
