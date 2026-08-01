# Portfolio Cartographer — Decision Artifact Design

**Status:** implementation draft  
**Scope:** local HTML artifact before Telegram integration  
**Authority:** proposal and instruction capture only

## Purpose

The Portfolio Cartographer lets the founder see the complete Thoughtseed portfolio, select any combination of WorkObjects, visually categorize what should happen when, connect those choices through the five canonical organ workflows, and export one precise instruction packet for the assistant.

The artifact does not create a tenant, change Vault classification, write the Goal Graph, send Telegram messages, or claim that proposed work has executed. It is the human decision layer immediately before those governed systems.

## Recommended Form

The artifact combines three interaction models:

1. **Portfolio ledger** — searchable, filterable cards for 12 Saplings, 28 client Branches, and 14 internal Programs, with review and historical material kept visibly separate.
2. **Decision matrix** — local planning horizon, priority, founder instruction, desired outcome, primary organ, trigger, status, and audience for each selected WorkObject.
3. **Pipeline canvas** — labeled connections from WorkObject through organ stages to the canonical Telegram topic, including Will approval and Alerts escalation.

This hybrid is preferred over a pure Kanban because relationships stay visible, and over a pure graph because bulk classification remains fast.

## Layout

### Header

- portfolio counts and source digest
- selected and configured counts
- save status
- import, export JSON, export Markdown, and reset controls

### Left rail — Portfolio

- text search
- classification and lifecycle filters
- select-visible and clear-selection actions
- cards showing canonical identity, lifecycle/promotion state, tenant status, account, and links
- separate drawers for 16 review records and 19 historical products

### Center — Decision matrix

- selected WorkObjects grouped by `now`, `next`, `later`, and `park`
- priority from one through five
- instruction and desired-outcome fields
- organ and trigger selectors constrained by canonical workflow definitions
- audience and signal-status selectors

### Right rail — Connected pipeline

- one pipeline card per configured WorkObject
- labeled path: WorkObject → organ → stages → Telegram topic
- Mini App Gate marker on client-audience Will paths
- Alerts marker on blocked, failed, or drifted paths
- canonical skill hints shown as requirements, never assignments

## Data Flow

```text
checked-in portfolio snapshot
        ↓
normalized read-only WorkObjects
        ↓
founder selection + local decisions
        ↓
connected pipeline preview
        ↓
JSON packet / Markdown instruction brief
        ↓
assistant review and governed integration later
```

Browser-local storage is the only persistence in this artifact. Import and export provide portability and an auditable handoff. The bundle performs no fetch, send, or mutation request.

## Error and Safety States

- Invalid imports are rejected without replacing the current state.
- Registry records without operational mappings display explicit gaps.
- Reset requires confirmation.
- Local category choices are labeled proposals.
- Client-audience Will paths show Gate-required.
- Blocked, failed, and drifted statuses route visually to Alerts.
- Unknown assignments, receipts, and tenant activation remain unknown.

## Verification

- exact canonical counts and identifiers
- unit tests for normalization, filtering, local decisions, import/export, and pipeline routing
- production bundle build
- single-file HTML bundle probe
- browser interaction at 390px, 768px, and 1440px
- keyboard/focus inspection
- zero runtime network requests
- source audit for prohibited Telegram, Cloudflare, D1, and KV mutation calls
