---
task: Fitcheck vault and Cambium organ-status mapping
slug: fitcheck-vault-mapping
effort: advanced
effort_source: context-override
phase: complete
progress: 100
mode: algorithm
started: 2026-08-11
updated: 2026-08-11
---

## Problem

Fitcheck has durable material across a public landing repository, private wiki, separate HDILINT capability, Shopify, Explee, Cambium receipts, and the Thoughtseed Labs vault. The existing vault hub identifies Fitcheck but does not yet provide a single status and data-location map that Cambium's organ flow can reciprocally reference.

## Vision

A founder can open one Fitcheck vault status note and see which system owns each kind of data, its safe current status, and the next governed boundary—then follow one reciprocal pointer from Cambium's branch packet without exposing raw campaign or customer data.

## Out of Scope

This task does not write TeamForge, R2, D1, Shopify, Explee, GitHub, or Telegram; deploy a Mini App; relocate files; copy raw evidence or lead data; or change commercial, privacy, or public-claim truth.

## Constraints

- The vault is a durable document substrate, not live task or CRM state.
- `sapling:fitcheck` remains distinct from `program:hdilint`.
- No vault note may include secrets, raw provider payloads, contact identity, message content, machine-local paths, or a claim that an R2 sync just occurred.
- Current organ and quest states must exactly match the active Fitcheck packet.
- The change is additive and must preserve unrelated dirty worktree changes.

## Goal

Create one canonical Fitcheck operating-status map in the existing vault hub and a reciprocal Cambium packet map that identifies source ownership, safe status, and evidence boundaries for every material Fitcheck surface.

## Criteria

- [x] ISC-1: The vault Fitcheck hub remains at `40-products/fitcheck/README.md`.
- [x] ISC-2: A new vault operating-status note exists beneath the existing Fitcheck hub.
- [x] ISC-3: The new note declares `work_id: sapling:fitcheck`.
- [x] ISC-4: The new note declares a vault-relative `vault_path`.
- [x] ISC-5: The new note uses an allowed `source_of_truth` value.
- [x] ISC-6: The new note uses an allowed `sync_status` value.
- [x] ISC-7: The new note declares both-founder visibility.
- [x] ISC-8: The hub links to the new operating-status note.
- [x] ISC-9: The hub's updated date is 2026-08-11.
- [x] ISC-10: The status map identifies the public landing repository.
- [x] ISC-11: The status map identifies the private wiki repository.
- [x] ISC-12: The status map identifies HDILINT as a separate capability.
- [x] ISC-13: The status map identifies Shopify as an external state boundary.
- [x] ISC-14: The status map identifies Explee raw data as provider-held only.
- [x] ISC-15: The status map identifies Cambium as organ/quest projection owner.
- [x] ISC-16: The status map records the approved $99 monthly/$799 yearly commercial truth.
- [x] ISC-17: The status map labels Shopify's divergent public price as reconciliation pending.
- [x] ISC-18: The status map records only aggregate campaign observation.
- [x] ISC-19: The status map contains no contact identity or message body.
- [x] ISC-20: The status map contains no credential, token, or API key.
- [x] ISC-21: The status map contains no machine-local absolute path.
- [x] ISC-22: The status map does not claim an R2 write occurred in this task.
- [x] ISC-23: The Cambium Fitcheck packet contains a vault/evidence map section.
- [x] ISC-24: The Cambium map references the vault note by vault-relative path only.
- [x] ISC-25: The Cambium map preserves the distinct HDILINT owner.
- [x] ISC-26: The Cambium map points to the redacted Explee receipt, not raw data.
- [x] ISC-27: The Cambium map reflects the six organ statuses currently in the packet.
- [x] ISC-28: The Cambium map identifies external-wait and blocked work as unfinished.
- [x] ISC-29: The packet schema validator succeeds.
- [x] ISC-30: Markdown/frontmatter checks succeed for both changed repositories.
- [x] ISC-31: Git diff checks report no whitespace errors.
- [x] ISC-32: Anti: no external system, deployment, R2, or registry mutation is executed.

## Test Strategy

| isc | type | check | threshold | tool |
| --- | --- | --- | --- | --- |
| ISC-1..9 | structural | inspect vault paths/frontmatter/links | exact | rg, sed |
| ISC-10..18 | content | inspect system map and truth labels | exact | rg |
| ISC-19..22 | safety | scan forbidden data/path/action claims | zero matches | rg |
| ISC-23..28 | structural | inspect branch packet section | exact | rg, sed |
| ISC-29 | validation | validate product packets | exit 0 | npm |
| ISC-30..31 | lint | parse YAML and check diff | exit 0 | node, git |
| ISC-32 | boundary | inspect commands and handoff | no mutation | git/status |

## Features

| name | description | satisfies | depends_on | parallelizable |
| --- | --- | --- | --- | --- |
| vault-status-note | Add canonical human-readable Fitcheck data/status map | ISC-1..22 | vault schema and existing hub | false |
| cambium-reciprocal-map | Add one source/evidence map to Fitcheck branch packet | ISC-23..28 | vault-status-note | false |
| verification | Validate packet, metadata, safety boundaries | ISC-29..32 | both maps | false |

## Decisions

- 2026-08-11: refined: use `sapling:fitcheck` because it is the pre-existing packet and vault identity; do not invent a TeamForge project slug absent registry evidence.
- 2026-08-11: keep raw Explee records in Explee; only the existing redacted aggregate receipt may be referenced.

## Changelog

- 2026-08-11: conjectured that a new Fitcheck vault home was required; refuted by the existing `40-products/fitcheck/README.md`; learned that the safe change is an additive status note under the established hub; criterion now requires hub preservation and a reciprocal Cambium pointer.

## Verification

- `npm run validate:product-branches` validated all six packets.
- Ruby YAML parsing accepted both Fitcheck vault frontmatter blocks.
- Scoped safety scans found no credential, token, email address, machine-local path, or retired-price match in the Fitcheck vault files.
- Local pointer checks resolved the vault operating-status note, redacted Explee receipt, and Cortex contract.
- Scoped Cambium diff check passed. A whole-vault diff check reports only pre-existing trailing whitespace in the unrelated payroll settlement note, which was not modified.
