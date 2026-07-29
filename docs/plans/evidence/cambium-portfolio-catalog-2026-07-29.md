# Cambium Portfolio Catalog Local Evidence — 2026-07-29

Lifecycle: local, zero-traffic candidate evidence. This record does not
authorize Cloudflare deployment, Telegram configuration, tenant activation,
data migration, or production traffic.

Contract: [`portfolio-catalog-v1.md`](../../architecture/contracts/portfolio-catalog-v1.md)

## Candidate

- Branch: `codex/portfolio-registry-miniapp`
- Candidate base: `11d1c8a1421d4347da770e1f5e5e4da22c7c4f8d`
- Tenant: `cambium`
- Source registry schema: `thoughtseed.work-object-registry.v1`
- Source classification digest:
  `93b90ed7cee268ac7ee87321a88efefced7980349658cf3c640657a71c361281`
- Normalized catalog digest:
  `sha256:d9fe69f028e1d859ac094f420aedd7904b618dda255edc54e058d929e30df8f1`

The catalog digest is recomputed from canonical JSON over the complete
schema-versioned, bounded catalog payload, excluding only `catalogDigest`.
The route also recomputes a pair digest over the served Goal Graph digest and
catalog digest.

## Inventory proof

| Record class | Count |
| --- | ---: |
| Admitted Saplings | 12 |
| Admitted client Branches | 28 |
| Admitted internal Programs | 14 |
| Classification review records | 16 |
| Historical product surfaces | 19 |
| Operational-admission gaps | 47 |

The browser renders 89 portfolio records: 54 admitted WorkObjects plus 16
classification-review records plus 19 historical surfaces. The 89 count is
therefore not a second WorkObject count.

Fitcheck is rendered as `sapling:fitcheck` under parent tenant `cambium`.
`FitCheck` and `getfitcheck` remain display-only aliases with no tenant
authority.

## Authority and privacy proof

- The catalog is a read-only sidecar; it never becomes Mission Fabric or Goal
  Graph nodes.
- Exact type-aware canonical identifiers are the only operational join key.
  Names and aliases cannot join.
- The synthetic Mission Fabric dry run reports 2 exact matches, 52 catalog
  orphans, and 0 runtime orphans.
- Founder responses contain bounded detail and the exact join report.
- Allowlisted non-founder responses contain fixed aggregate counts only; the
  server omits identities, provenance, gaps, review records, historical
  surfaces, and joins.
- Route tests assert zero D1 and KV writes.
- Catalog-only records render `Goal Graph missing`, `assignments unmapped`,
  `skills unmapped`, and `loadout unmapped` rather than invented state.
- Gate receives read-only selected context and synthesizes no catalog action.

## Browser proof

The canonical viewport manifest contains 47 captures: 27 layout proofs and 20
clickability proofs. Portfolio assertions run at 320, 390, and 430 CSS pixels
against the checked-in 54-WorkObject catalog and require:

- four Canopy zones;
- exact 12/28/14/16/19 counts;
- all 89 admitted, review, and historical records in the DOM;
- Fitcheck's Cambium parent and non-authoritative aliases;
- selection persistence through Canopy, Mission, Flow, Workforce, and Forge;
- five 44px scene tabs; and
- zero horizontal document overflow.

The operating Canopy images are:

- [`operating-fabric-320-mobile.png`](../assets/tg-miniapp-viewport-proof/operating-fabric-320-mobile.png)
- [`operating-fabric-390-mobile.png`](../assets/tg-miniapp-viewport-proof/operating-fabric-390-mobile.png)
- [`operating-fabric-430-mobile.png`](../assets/tg-miniapp-viewport-proof/operating-fabric-430-mobile.png)

The canonical manifest contains 47 proofs (27 layout and 20 clickability)
bound to PAGE digest
`bb37ab93fb1c697a35ebb4311f3ff3974417517b55c19b27f97456c29feb6241`.

## Deterministic gates

| Gate | Result |
| --- | --- |
| Core tests after audit correction | PASS — 1493 passed, 0 failed |
| Canonical viewport proof | PASS — 47/47 |
| Telegram mobile contract | PASS — 15/15 |
| Text-density audit | PASS |
| Documentation sync | PASS — 6 pages, 91 components |
| Drift audit | PASS |
| Standalone audit and smoke | PASS |
| R3F tests | PASS — 99/99 |
| R3F build | PASS |
| Electron packaging contract | PASS — 5/5 |
| Deterministic release verification | PASS |
| Cato-compatible adversarial audit | PASS — no critical or remaining finding after explicit 503 fallback coverage |
| Independent real-browser QA | PASS — no remaining blocker after mobile navigation and tenant-join remediation |

The exact-200 client activation remains default-deny. The regression matrix
keeps the legacy shell visible and interactive for 401, 403, 503, non-200
success statuses, network failure, malformed JSON, missing delivery flags,
wrong-schema projections, and renderer failure.

## External boundary

No Cloudflare, Telegram, D1, KV, schema, tenant, allowlist, secret, menu,
origin, traffic, or zero-traffic candidate mutation occurred.

Founder-device proof and promotion remain blocked until the founder explicitly
authorizes either a temporary Telegram preview-origin/menu change or a staging
bot. Promotion and rollback rehearsal remain separate later gates.
