---
task: "Implement Cambium product branch packet system"
slug: 20260629-024014_cambium-product-branch-packets
project: cambium
effort: E3
effort_source: classifier
phase: complete
progress: 34/34
mode: interactive
started: 2026-06-29T02:40:14Z
updated: 2026-06-29T03:01:15Z
---

## Problem

Cambium has a proven Fitcheck branch packet, but the packet shape is not yet reusable or machine-checkable. Without a shared schema, index, and local validation command, future products can drift into prose-only status notes, overclaim autonomy, or skip proof boundaries.

## Vision

Each standalone product can enter Cambium as an inspectable branch packet with the same operational spine: seed, organ routing, variable contract payload, services, evidence, gates, quest queue, and promotion rule. The packet layer should make the next product review feel boring in the best way: a validator says the shell is sound, and the human can focus on whether the evidence is strong.

## Out of Scope

- No EC2 runtime edits or new provider keys.
- No live Hermes, Plexus, Telegram, or Paperclip automation wiring.
- No product repo code changes unless a packet explicitly marks them as future work.
- No claim that Fitcheck, Vantyx, Snow Gloves OS, or IVerif is autonomous without live customer proof and app-action portability.
- No IVerif automation before claim/proof separation and compliance/security evidence exist.
- No replacement of the existing Fitcheck packet; the normalized packet must cross-reference it.

## Constraints

- Cambium remains the composition and proof ledger; product repos remain separate source surfaces.
- Packet files live under `docs/plans/product-branches/` and are readable as Markdown.
- Machine validation must run locally without secrets, network calls, or new npm dependencies.
- The validator must fail closed on missing required sections, unknown promotion states, missing packet files, or broken index references.
- Product claims must be marked as verified, blocked, pending, or no-signal rather than inferred from product intent.
- Promotion states must preserve the proof-only -> supervised branch -> autonomous branch ladder, with organ-service allowed for internal service surfaces.
- Fitcheck blockers from the existing packet remain explicit until separately closed.
- IVerif remains proof-only unless repo evidence supports promotion.

## Goal

Ship the first reusable Cambium product-branch proof packet system: a schema, local validator, product index, normalized Fitcheck packet, and initial Vantyx, Snow Gloves OS, and IVerif packets. The system is done when `npm run validate:product-branches` passes locally and each packet keeps promotion claims bound to inspected evidence.

## Criteria

- [x] ISC-1: `docs/plans/product-branches/schema.json` exists.
- [x] ISC-2: `schema.json` declares the packet schema id `cambium.product_branch_packet.v1`.
- [x] ISC-3: `schema.json` declares required packet metadata fields.
- [x] ISC-4: `schema.json` declares allowed promotion states.
- [x] ISC-5: `schema.json` declares all required Markdown sections.
- [x] ISC-6: `scripts/validate-product-branch-packets.mjs` exists.
- [x] ISC-7: The validator reads `schema.json` at runtime.
- [x] ISC-8: The validator fails when a required packet file is missing.
- [x] ISC-9: The validator fails when packet frontmatter is missing a required field.
- [x] ISC-10: The validator fails when a packet has an unknown promotion state.
- [x] ISC-11: The validator fails when a required packet section is missing.
- [x] ISC-12: The validator verifies index rows point at existing packet files.
- [x] ISC-13: `package.json` exposes `validate:product-branches`.
- [x] ISC-14: `docs/plans/product-branches/index.md` exists.
- [x] ISC-15: The index row for `fitcheck` points at `fitcheck.md`.
- [x] ISC-16: The index row for `vantyx` points at `vantyx.md`.
- [x] ISC-17: The index row for `snow-gloves-os` points at `snow-gloves-os.md`.
- [x] ISC-18: The index row for `iverif` points at `iverif.md`.
- [x] ISC-19: `docs/plans/product-branches/fitcheck.md` exists.
- [x] ISC-20: The Fitcheck packet cross-references the existing 2026-06-23 packet.
- [x] ISC-21: The Fitcheck packet keeps supervised branch status bounded by listed blockers.
- [x] ISC-22: `docs/plans/product-branches/vantyx.md` exists.
- [x] ISC-23: The Vantyx packet marks tenant proof as the next gate.
- [x] ISC-24: `docs/plans/product-branches/snow-gloves-os.md` exists.
- [x] ISC-25: The Snow Gloves OS packet uses organ-service status, not app autonomy.
- [x] ISC-26: `docs/plans/product-branches/iverif.md` exists.
- [x] ISC-27: The IVerif packet marks claim/proof separation before automation.
- [x] ISC-28: Every packet contains Product Seed, Organ Routing, Variable Contract Payload, Adapter / Service Map, Evidence Ledger, Gate Ledger, Quest Queue, and Promotion Rule sections.
- [x] ISC-29: Every packet includes a Promotion Rule section with the proof-only to supervised to autonomous ladder.
- [x] ISC-30: Every packet includes an Evidence Ledger that distinguishes inspected proof from blocked or no-signal claims.
- [x] ISC-31: `npm run validate:product-branches` exits 0.
- [x] ISC-32: `npm run validate` exits 0 after packet changes.
- [x] ISC-33: Anti: no packet claims autonomous branch readiness without live customer proof and app-action portability.
- [x] ISC-34: Anti: no packet introduces secrets, provider keys, or runtime credential values.

## Test Strategy

| ISC | Type | Check | Threshold | Tool |
| --- | --- | --- | --- | --- |
| ISC-1 | file | schema file present | exists | `test -f` |
| ISC-2 | content | schema id string | exact match | `node -e` |
| ISC-3 | content | metadata list contains required fields | all present | `node -e` |
| ISC-4 | content | promotion enum contains proof/supervised/autonomous/organ | all present | `node -e` |
| ISC-5 | content | section list contains packet sections | all present | `node -e` |
| ISC-6 | file | validator file present | exists | `test -f` |
| ISC-7 | content | validator references schema path | present | `rg` |
| ISC-8 | command | missing-file fixture fails | non-zero | temp copy + node script |
| ISC-9 | command | missing-frontmatter fixture fails | non-zero | temp copy + node script |
| ISC-10 | command | bad-promotion fixture fails | non-zero | temp copy + node script |
| ISC-11 | command | missing-section fixture fails | non-zero | temp copy + node script |
| ISC-12 | command | index references validated | pass | `npm run validate:product-branches` |
| ISC-13 | content | package script exists | exact key | `node -e` |
| ISC-14 | file | index exists | exists | `test -f` |
| ISC-15 | content | fitcheck row exists | path match | `rg` |
| ISC-16 | content | vantyx row exists | path match | `rg` |
| ISC-17 | content | snow row exists | path match | `rg` |
| ISC-18 | content | iverif row exists | path match | `rg` |
| ISC-19 | file | fitcheck packet exists | exists | `test -f` |
| ISC-20 | content | fitcheck backlink present | path present | `rg` |
| ISC-21 | content | fitcheck blockers retained | blocker names present | `rg` |
| ISC-22 | file | vantyx packet exists | exists | `test -f` |
| ISC-23 | content | tenant proof gate present | phrase present | `rg` |
| ISC-24 | file | snow packet exists | exists | `test -f` |
| ISC-25 | content | organ-service status present | phrase present | `rg` |
| ISC-26 | file | iverif packet exists | exists | `test -f` |
| ISC-27 | content | claim/proof gate present | phrase present | `rg` |
| ISC-28 | command | validator section checks | pass | `npm run validate:product-branches` |
| ISC-29 | content | promotion ladder present | phrase present | `rg` |
| ISC-30 | content | evidence ledger uses proof status labels | labels present | `rg` |
| ISC-31 | command | packet validator | exit 0 | `npm run validate:product-branches` |
| ISC-32 | command | existing Cambium validation | exit 0 | `npm run validate` |
| ISC-33 | anti-probe | autonomous claims absent | no forbidden ready claim | `rg` |
| ISC-34 | anti-probe | secrets absent in packet files | no credential patterns | `rg` |

## Features

| Name | Description | Satisfies | Depends On | Parallelizable |
| --- | --- | --- | --- | --- |
| PacketSchema | Define the machine-readable packet shape, metadata, sections, and promotion states. | ISC-1, ISC-2, ISC-3, ISC-4, ISC-5 | none | false |
| PacketValidator | Validate schema, index, packet files, and failure cases without secrets or dependencies. | ISC-6, ISC-7, ISC-8, ISC-9, ISC-10, ISC-11, ISC-12, ISC-13, ISC-28, ISC-31 | PacketSchema | false |
| PacketIndex | List product ids, roles, promotion states, gates, and packet paths. | ISC-14, ISC-15, ISC-16, ISC-17, ISC-18 | PacketSchema | true |
| FitcheckPacket | Normalize the existing Fitcheck branch packet without replacing the source packet. | ISC-19, ISC-20, ISC-21, ISC-29, ISC-30, ISC-33, ISC-34 | PacketSchema | true |
| NewProductPackets | Add Vantyx, Snow Gloves OS, and IVerif packets with bounded claims. | ISC-22, ISC-23, ISC-24, ISC-25, ISC-26, ISC-27, ISC-29, ISC-30, ISC-33, ISC-34 | PacketSchema | true |
| VerificationPass | Run focused packet validation and relevant Cambium validation. | ISC-31, ISC-32 | PacketValidator, PacketIndex, FitcheckPacket, NewProductPackets | false |

## Decisions

- 2026-06-29 02:42: Advisor gate attempted before implementation, but `bun ~/.claude/PAI/TOOLS/Inference.ts --mode advisor --auto-state` failed with `401 Invalid authentication credentials`; this is not treated as a valid sign-off.
- 2026-06-29 02:42: Packet validation will use Markdown frontmatter plus required headings so packet files stay human-readable while the validator remains dependency-free and fail-closed.

## Verification

- ISC-1: file probe — `PASS schema exists`.
- ISC-2: schema probe — `PASS schema id`.
- ISC-3: schema probe — `PASS metadata fields`.
- ISC-4: schema probe — `PASS promotion states`.
- ISC-5: schema probe — `PASS required sections`.
- ISC-6: file probe — `PASS validator exists`.
- ISC-7: source probe — `PASS validator reads schema`.
- ISC-8: negative validator probe — `missing-file: expected failure -> product branch packet validation failed: missing packet file for iverif`.
- ISC-9: negative validator probe — `missing-frontmatter-field: expected failure -> ... missing metadata fields: packet_owner`.
- ISC-10: negative validator probe — `bad-promotion-state: expected failure -> ... unknown promotion_state "autonomous-ready"`.
- ISC-11: negative validator probe — `missing-section: expected failure -> ... missing sections: Gate Ledger`.
- ISC-12: command probe — `validated 4 product branch packet(s) against cambium.product_branch_packet.v1`.
- ISC-13: package probe — `PASS package script`.
- ISC-14: file probe — `PASS index exists`.
- ISC-15: content probe — `PASS fitcheck row`.
- ISC-16: content probe — `PASS vantyx row`.
- ISC-17: content probe — `PASS snow row`.
- ISC-18: content probe — `PASS iverif row`.
- ISC-19: file probe — `PASS docs/plans/product-branches/fitcheck.md exists`.
- ISC-20: content probe — `PASS fitcheck source backlink`.
- ISC-21: content probe — `PASS fitcheck blockers`.
- ISC-22: file probe — `PASS docs/plans/product-branches/vantyx.md exists`.
- ISC-23: content probe — `PASS vantyx tenant proof gate`.
- ISC-24: file probe — `PASS docs/plans/product-branches/snow-gloves-os.md exists`.
- ISC-25: content probe — `PASS snow organ-service status`.
- ISC-26: file probe — `PASS docs/plans/product-branches/iverif.md exists`.
- ISC-27: content probe — `PASS iverif claim proof gate`.
- ISC-28: content and command probe — `PASS all required sections in packets` plus `npm run validate:product-branches`.
- ISC-29: content probe — `PASS promotion ladder in packets`.
- ISC-30: content probe — `PASS evidence status labels in packets`.
- ISC-31: command probe — `npm run validate:product-branches` exited 0 with `validated 4 product branch packet(s)`.
- ISC-32: command probe — `npm run validate` exited 0 with `registry + pipeline valid`.
- ISC-33: anti-probe — `PASS no forbidden autonomy-ready claim`.
- ISC-34: anti-probe — `PASS no credential values`.
- Full regression: command probe — `npm test` exited 0 with `tests 600`, `pass 600`, `fail 0`.

## Changelog

- 2026-06-29 | conjectured: Vantyx likely lived in the `10869` or `10869-space-v1` repo hinted by the surrounding workspace.
  refuted by: read-only product-context inspection found the current Vantyx surface in `Panaroma-Webapp` with brand source in `brandmint-v2/brands/vantyx`.
  learned: product packets must record repo/source routing explicitly so branch promotion does not inherit stale or nearby workspace assumptions.
  criterion now: ISC-23 and the Vantyx packet require tenant proof as the next gate rather than assuming readiness from adjacent repo names.
