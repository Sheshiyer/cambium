# Portfolio Workbench Redesign

**Date:** 2026-08-01  
**Surface:** `apps/portfolio-cartographer/bundle.html`  
**Authority:** proposal-only, offline planning artifact

## Problem

The first Cartographer proves the complete portfolio and delivery contract, but it exposes the whole contract for every selected item. In the reproduced 35-item state that becomes 248 selects, 35 textareas, 35 pipeline cards, and 33,020 pixels of page height at 757px.

The interaction model is the defect: selection, planning, and delivery configuration are the same state.

## Source architecture

The redesign follows the Vault contracts:

- WorkObject classification and portfolio review originate in the Vault registry.
- Sapling promotion states and Program lifecycles remain type-specific source facts.
- `operationalStatus: paused` is a projection overlay, not a new lifecycle.
- `commercialReuse: white-labelable` is orthogonal to lifecycle.
- TeamForge owns canonical IDs and mappings.
- Huly and GitHub own live human task and engineering state.
- Cambium Goal Graph/D1 remains the operational writer.
- Hermes remains the Telegram transport and topic-map owner.

The artifact stores only reversible local planning intent and exports proposals.

## Explored interaction models

1. **Lifecycle Kanban:** highly scannable, but forces incompatible Sapling and Program states into shared columns.
2. **Quarterly roadmap:** strong long-term view, but weak for status review and reuse inventory.
3. **Command-palette table:** fast for experts, but poor at spatial recognition and touch use.
4. **Spatial portfolio map:** expressive, but expensive to navigate and difficult to make accessible.
5. **Smart-view workbench:** compact portfolio grid, saved semantic views, explicit bulk mode, and one focused drawer.

## Selected direction

Use the smart-view workbench.

The default loop is:

`scan → filter → tag → focus → plan → optionally inspect delivery → export`

Selection is no longer required to see a project. Bulk selection is a temporary explicit mode. Only one WorkObject can be focused, so only one Plan or Delivery form exists in the DOM.

## Information model

### Immutable source layer

- canonical WorkObject ID
- display name
- classification
- type-specific lifecycle or promotion state
- account or tenant identity
- linked WorkObjects
- source provenance

### Source-derived projection layer

- paused overlay
- source white-labelable reuse
- needs-review queue membership
- historical surface status

These appear as read-only chips labeled `source`.

### Local planning layer

- portfolio signal: `unplanned | ongoing | paused | completed | archived`
- horizon: `null | now | next | this-year | later | park`; `null` renders as Unscheduled and can never masquerade as an intentional Next plan
- priority: P1–P5
- custom tags
- next action
- desired evidence
- organ delivery settings inherited from the v1 decision packet

These appear as editable chips and fields labeled `local plan`.

## Smart views

- All work
- Ongoing
- Paused
- White-labelable
- Needs review
- Unplanned
- Historical

Counts are computed from the same filtered model as the cards. `White-labelable` includes source-derived reuse and explicit local reuse proposals, with different provenance labels.

## Layout

### Desktop

- compact left rail: brand, smart views, source receipt
- sticky top command bar: search, type filters, view mode, bulk mode, export
- primary content: responsive card grid or horizon board with an explicit Unscheduled lane plus five intentional planning horizons
- right-side detail drawer: Overview, Plan, Delivery

### Telegram-width

- smart views become a horizontally scrollable chip rail
- command bar collapses into two rows
- cards use one column
- detail drawer becomes an in-flow full-screen sheet
- no horizontal page overflow

## Card contract

Every card shows:

- name and canonical type
- source lifecycle/promotion state
- source overlay chips when present
- local portfolio signal
- horizon and priority when planned
- up to three local tags
- one focus action
- one quick-signal action group

Cards never render a textarea, organ selector, trigger selector, or pipeline form.

## Focused drawer

### Overview

Canonical identity, source provenance, links, tenant/account boundary, and visible authority explanation.

### Plan

One-click portfolio signal, horizon, priority, custom tags, next action, and desired evidence.

### Delivery

Organ, valid trigger, signal status, audience, pipeline stages, required skill hints, Telegram topic, Gate requirement, and Alerts escalation.

## Bulk mode

Bulk mode is off by default. When enabled, cards gain checkboxes and a sticky action bar. The action bar can set signal, set horizon, and add/remove one normalized tag. Exiting bulk mode clears the temporary selection but not planning data.

Every single-item and bulk write passes through the same prune rule: a default-equivalent or no-op candidate is deleted from local planning state. A one-step bulk undo restores the exact prior per-item records. This keeps Unscheduled distinct from explicit Next across the board, JSON, and reload.

## Migration

The v2 parser accepts:

- native `thoughtseed.portfolio-workbench.v2` packets
- legacy `thoughtseed.portfolio-cartographer.v1` packets

Legacy `selectedIds` become temporary migration context only. Their decisions migrate into per-item planning data; every legacy classification-proposal enum is preserved as explicit local intent, and they do not reopen 35 detail forms. Corrupt or unknown-WorkObject packets pause autosave until explicit Import or Reset so unreadable source data cannot be overwritten silently.

## Visual direction

An executive dashboard with editorial restraint:

- near-black green-tinted background retained for continuity
- warm paper surfaces for focused content
- acid-lime used only for editable local intent and primary focus
- cyan/blue for canonical source facts
- amber for review/paused signals
- violet for reusable IP
- system sans stack for offline reliability; mono only for IDs and receipts
- borders and hierarchy carry structure; animation is limited to drawer and chip state transitions

## Safety and proof

- no network primitives or external assets
- no Telegram, Cloudflare, D1, KV, TeamForge, Huly, or GitHub mutation
- explicit source/local provenance
- deterministic tests for migration, filtering, tags, Gate, Alerts, and export
- browser proof at 390, 768, and 1440 pixels
- restored 35-item state remains below 40 selects and 8,000 pixels at 757px
