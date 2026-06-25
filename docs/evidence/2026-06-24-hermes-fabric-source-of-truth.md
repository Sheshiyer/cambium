# Hermes Fabric Bridge Source Of Truth Evidence - 2026-06-24

This evidence file follows the 2026-06-24 source-restoration plan. The resumed verification run recorded here happened on 2026-06-25 in Asia/Kolkata, with live probe response headers dated 2026-06-25 02:52:06 GMT.

## Source State

- Repo: `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/cambium`
- Branch/code-restoration commit: `codex/hermes-fabric-source-restoration` at `0436be3f8278d19583eae23befa5a2528390b039` (`fix: split fabric d1 baseline and legacy migration`).
- Evidence capture commit: `8d635cbd8dc515b7b908669e791a6139cfc02903` (`docs: record hermes fabric source restoration proof`). Later docs-only clarification commits may update this file; use `git log` for the current branch tip.
- Restored from backup patch: `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/cambium-backups/20260624T021305Z-feat-m5-phase-q-bridge-retirement-final/tracked-working-tree.patch`
- Backup integrity: `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/cambium-backups/20260624T021305Z-feat-m5-phase-q-bridge-retirement-final/SHA256SUMS.checked.txt` was present and listed `OK` for `tracked-working-tree.patch`, `staged-index.patch`, `untracked-files.tar.gz`, `status.porcelain.txt`, `untracked-origin-compare.tsv`, each split patch, and `README.txt`.
- Commit range summary: `origin/main` is an ancestor of this branch. The restoration range starts at `be893ff docs: add hermes fabric restoration plan`, reaches code restoration at `0436be3 fix: split fabric d1 baseline and legacy migration`, and records evidence at `8d635cb docs: record hermes fabric source restoration proof`.

## Local Verification

- `node --test workers/quests/src/handler.test.ts`: PASS on 2026-06-25 IST.
  - Summary: `tests 155`, `pass 155`, `fail 0`, `duration_ms 536.805167`.
- `npm test`: FAIL on 2026-06-25 IST because of the known unrelated asset-governance coverage gap.
  - Summary: `tests 527`, `pass 526`, `fail 1`, `duration_ms 1893.983792`.
  - Failing test: `bin/asset-governance.test.mjs` `tracked visual assets are covered by provenance groups`.
  - Uncovered tracked assets:
    - `apps/cambium-r3f/public/assets/meshy/image-to-3d/genesis/optimized/model-1536-grid160.glb`
    - `apps/cambium-r3f/public/assets/meshy/image-to-3d/genesis/optimized/model-1536-grid192.glb`
    - `apps/cambium-r3f/public/assets/meshy/image-to-3d/genesis/optimized/model-1536-grid256.glb`
    - `apps/cambium-r3f/public/assets/meshy/image-to-3d/genesis/optimized/model-1536-grid96.glb`
    - `apps/cambium-r3f/public/assets/meshy/image-to-3d/genesis/optimized/model-1536.glb`
    - `apps/cambium-r3f/public/assets/meshy/image-to-3d/rail-arc/optimized/model-1536.glb`
- `git diff --check`: PASS before and after writing this file.

## Live Route Probes

Only unauthenticated and public probes were run. No bearer tokens, signed bridge payloads, raw secrets, or private identifiers were used or recorded.

- `GET https://curious.thoughtseed.space/healthz`:
  - Status: `HTTP/2 200`
  - Body: `{"ok":true,"worker":"cambium-quests"}`
- `POST https://curious.thoughtseed.space/v1/bridge/assign-task` without auth:
  - Request body: `{"memberId":"mathis","task":{"taskId":"probe","projectId":"probe","title":"probe"}}`
  - Status: `HTTP/2 401`
  - Body: `{"error":"bad or missing bridge credential"}`
- `POST https://curious.thoughtseed.space/v1/fabric/consume` without auth:
  - Request body: `{"tenantId":"cambium"}`
  - Status: `HTTP/2 401`
  - Body: `{"error":"admin token required"}`

## Handoff Boundary

- Remote Thoughtseed/Hermes bridge: Public health and unauthenticated denial behavior were live-probed on 2026-06-25. The remote Worker is reachable and exposes the expected credential gates, but this run did not use a scoped Hermes assignment credential or full admin credential.
- Local Paperclip runtime: Kept separate from remote Thoughtseed/Hermes bridge status. This task did not probe local Paperclip runtime health, mutate local Paperclip state, or treat Paperclip state as proof of remote bridge consumption.
- Plexus credential custody: Kept out of Cambium source and evidence. This task did not inspect, paste, or move Plexus member tokens, Worker admin `BRIDGE_TOKEN`, `HERMES_ASSIGNMENT_TOKEN`, signed handoff payloads, or local secure-storage material.

## Remaining Gated Proof

- Scoped `HERMES_ASSIGNMENT_TOKEN` live consume: Still gated. This evidence proves source restoration locally and remote route availability/credential boundaries, not a live scoped consume with Hermes credentials.
- Admin review routes: Still gated. Review/admin routes require the full admin token and were intentionally not probed in this unauthenticated evidence pass.
