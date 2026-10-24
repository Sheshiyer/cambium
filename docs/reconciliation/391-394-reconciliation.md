# Local reconciliation: live growth runtime plus merged Founder Gate

This candidate is local-only for independent review. No publication, remote migration, resource creation, upload, traffic assignment, credentials, Access policy, runner change or live proposal signing is included.

## Source pins and exact scope

Remote main was verified at 5dd3ab56e75db91a3b694de43e9e5ec39166529e (#394). All eleven reviewed file blobs matched, and its source tree is 0abc54afeb8c62e807709dcc748257aa4a5e7d74. The isolated branch uses a local snapshot commit with that exact tree because the remote merge object was unavailable locally; the snapshot is not represented as the remote commit identity. See reconciliation-baseline.json and the manifest.

The live Worker is 15622021-5fad-48e0-a0f2-4dc6ff9b6943. Its owner receipt pins source 3851c65dfaeecf3ab73756fe635f5af6dd4e7e14 and bundle SHA256 88c2788e875a5fc49bd4c2ce6e265cb847ab0d924e4268b1556a32e160ad4131. PR391 tip a8ecb1832f5bf097c276c690eb3f779d4436c171 adds only documentation/evidence after that source. This candidate selects thirteen files from the exact live source: eight runtime modules, two tests, the local synthetic smoke, migration0011 source and its contract. No historical owner handoff, production receipt or later branch material was imported. The source patch applied cleanly; handler combines existing live growth routes with #394's fail-closed host route and rejection nonce. Atlas fingerprints are refreshed for that combined handler. No other conflict repair was needed.

The standalone new Founder Gate modules and CLI remain unchanged from #394, including complete reviewed-row confirmation fingerprint and approval/rejection nonce checks. Existing growth authorization, quotas, D1 execution fences, native768 receipt admission, exact vector readback and legacy-index isolation are retained. Migration0011 is source preservation only: no remote migration command was run.

## Configuration preservation candidate

The separate wrangler.reconcile-393.jsonc declares exactly the eight already-live resource bindings, matching resource IDs from the metadata-only version readback. It has vars:{} and keep_vars:true. Wrangler version upload preserves secrets; no values are copied. The other38 already-live binding names are retained conditionally through variable/secret retention. The parity test checks all46 existing identities and runtime date/flags without reading or storing values. This is a source/config retention contract, not proof of a new deployed version's parity.

The original wrangler.labs.jsonc is unchanged. No new resource is created by this config. The config is not yet a replacement for the repository's canonical production runbook/profile gate. Global settings, schedule and observability parity still need independent metadata verification before any upload/traffic assignment; do not assume missing declarations are proven preservation. The compiled bundle is a dry-run artifact only.

An attempted broad live plain-text value snapshot was rejected before execution by automatic approval review because plain-text bindings may contain sensitive configuration/credentials. It was not retried or bypassed. The safer retention candidate above requires no live-value capture. Value-level equality is not claimed.

## Verification and remaining gates

598 combined growth/receipt/context/Gate/auth/graph/CLI tests pass, plus one binding metadata test. The existing synthetic local workerd smoke passes nine checks with isolated local KV/D1, no remote bindings, provider inference or execution. The first receipt's sourceCommit names the local parent snapshot; it ran the dirty candidate source whose exact hashes are in the review manifest. Subsequent committed-source receipts, if produced, supersede that provenance limitation.

Full package-selected per-file comparison: candidate174 files,168 pass; merged-main baseline171 files,165 pass. Both have exactly five matching script timeouts and the same viewport sandbox listener restriction. The viewport suite is rerun with loopback permitted separately. No full-suite green is claimed. Strict broad TypeScript checking reports59 normalized diagnostics on both candidate and base, including missing Node declarations and existing source errors; rendering differs at the same handler/index diagnostics after growth types are reachable. It is not a static-compile pass. Wrangler dry-run compilation passes.

Before publication or runtime work: independent review of this expanded candidate, resolve global-settings/preservation gates and full-suite/typecheck limitations, freeze the source/config/bundle manifest, then obtain exact subsequent authorization as required. Upload and traffic remain separate gates. Rollback for a future #393 rollout is current live15622021; the earlier b33a1a6e-6edc-412d-b974-10e437379dc0 is historical and must not replace it.
