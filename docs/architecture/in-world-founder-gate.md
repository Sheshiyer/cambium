# In-world founder Gate (D17, 2026-10-23)

Status: **approved by the operator 2026-10-23; implemented in this change.**

## Goal

The founder decides inside the 3D Field Atlas, at the place the work belongs, instead of in a separate panel. Approve and Reject are clickable there. After a decision, the world lights the real path the work takes next. The 2D desk is retired, so the world is the only surface.

## Operator decisions (2026-10-22/23)

| Question | Decision |
|---|---|
| Placement | In the right place according to the growth model (`thoughtseed-labs/20-operations/growth`) |
| After approve | Light the real path from live state (read-only; the runner run keeps its own yes) |
| Expired proposals | Dimmed; Reject works; "request a fresh proposal" explains that it needs a new founder-chat message |
| 2D desk | Retired in the same Cambium PR |

## 1. Placement: decide where the work lives

A proposal is shown, and signable, at its **subject landmark**. The **Gate** in Purpose stays the founder's queue: it lists every pending decision and links to each one.

Placement is keyed by the **pinned loadout**, never by the work-object kind alone (`branch:` and `sapling:` both host source audits and GTM work). The Worker first checks the loadout against `GOAL_GRAPH_LOADOUT_AUTHORITY` (`workers/quests/src/goal-graph-loadout-registry.ts`): `workObjectId` must be eligible and, when the node carries an execution-admission cluster, that cluster must be authorized. A mismatch keeps the proposal at the Gate (`basis: fallback`).

| Loadout | Subject landmark | Why (growth model) |
|---|---|---|
| `loadout:*-source-audit` (e.g. `loadout:relovo-source-audit`) | **Plant / hands** | Hands routes skill-cluster loadouts and carries admitted, finite source-verification work (`department/cambium-temperance-organ-atlas.md`, `organ-map.md`) |
| `loadout:fitcheck-launch` | **Growth / launch-lead**, linked to **will** | Launch Lead is Will's dispatch desk for campaigns; Fitcheck's live GTM is approval-bound outreach (`organ-map.md`, `shared/fitcheck-golden-path.ts`) |
| Anything else, e.g. `loadout:iverif-observer` | **Purpose / gate** only | No mapped organ yet. Add a table row; don't guess |

The table lives in one shared module that the Worker projection and the world both import, and it is covered by tests. A new loadout needs one reviewed table row.

Current pending examples:
- Relovo source audit: beacon at Plant / hands.
- Fitcheck launch gates (×5): beacons at Growth / launch-lead.

## 2. The beacon: decide in the world

- A pending proposal raises a **beacon** on its subject landmark. Its state is visible from a distance: pending (lit), expiring soon (pulsing), expired (dimmed), signing (in flight).
- Walk up and press E/Inspect, and the landmark folio shows the same founder Inspect as today: digest, node, work object, loadout, every `executionAdmission*` key, admission state and window. It also shows **Approve** and **Reject**.
- Signing goes through the existing `CuriousGateBridge.sign()`: the same `/api/gate` or `/founder/api/gate` contract, nonce/expiry echo and receipt handling. Only where the folio opens changes. The Worker stays the only authority, so a beacon is exactly as safe as the Gate folio.
- The same rules close signing as today: no verified founder read, an inconsistent Inspect, a read in flight, or (Approve only) an expired window.
- **Chart → Founder Gate · N pending** and the Gate landmark list the decisions grouped by place. Selecting one walks or teleports the traveler to its beacon.

## 3. After a decision: light the real path

Each stage lights up as soon as live state proves it, never earlier. The order follows the system atlas edges (`shared/cambium-system-atlas.ts`) and `INTEGRATION.md`:

| Stage | Proven by | Lights |
|---|---|---|
| Approved and committed | Gate receipt `committed: true`; branch map head | Purpose / gate → Identity / **d1** |
| Directive queued | Bridge directive for the node's `executionAdmissionDirectiveId` | Identity / d1 → Plant / **hermes** |
| Runner claimed | Directive status `claimed` (lease) | Plant / hermes (pulse) |
| Receipt | Terminal `executed` outcome for that directive in D1 `bridge_executions` | Plant / hermes → Evidence / **proof** |
| Learning | The node's immutable foldback receipt reads back as an owner-attested accepted work unit (`temperance.accepted-work-unit.v1`), via the same read-only consumer as the mission fabric. Acceptance there requires the cortex projection, the exact goal/task/WorkObject binding and the admitted dispatch input digest. | Evidence / proof → Knowledge / **cortex** |

- A Reject lights only Gate → d1, in the "rejected" colour. Nothing is written to the graph.
- The path reads a new founder-only projection of this chain for the committed node. It reuses existing reads (branch map, bridge directive/execution status, foldback), adds no new writes, and offers no "run" button. The single runner execution still needs the operator's separate yes.

## 4. Expired proposals

- The beacon is dimmed. **Reject** still works.
- **Request a fresh proposal** opens a short explainer: post a new founder-chat message and submit it. Intake is idempotent per message, so resubmitting an old one returns the expired duplicate. Nothing is resubmitted automatically.

## 5. Retire the 2D desk

- Remove the "2D desk" top-bar control and the Mission Control/legacy scene entry points from the founder surface. `/` and `/founder` both open the 3D world.
- The legacy page byte pin, viewport proof and contract docs are updated in the same PR. Telegram Mini App sign-in keeps working in the 3D world.

## 6. Out of scope

- Any change to the approval contract, nonce/TTL, D1/KV schema or the runner.
- Auto-running the runner on approve.
- New organs or desks. Unmapped loadouts stay Gate-only.

## 7. Verification

- Unit tests:
  - the placement table (each mapped loadout, the authority mismatch case, the unknown fallback);
  - beacon states (pending, expiring, expired, signing);
  - sign() from a beacon posts the identical payload;
  - the path stages light only on proven state;
  - the 2D entry points are gone.
- Worker tests for the founder chain projection: founder-only, read-only, no secrets.
- `npm test`, `curious:test`/`curious:check`, the regenerated viewport proof and system atlas, and the drift audit.
- Deploy on the operator's yes, then a live check at `/founder`. A real sign-off still needs TeamForge to trust the founder Access app (the `teamforge-api` `TF_ACCESS_AUD` four-value change).

## Dependencies

- **TeamForge** must trust the founder app's audience (`f6d398e7…`) before any `/founder` signature works. At the last check it was still `ed7f7ecd` with three audiences.
