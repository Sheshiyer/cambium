# 05 — Text-Density Budget + Banned Copy List

> Status: **pre-frozen** → ratified → frozen at P1-W1 (task T-004).
> Calibrated against the live bundle `workers/quests/src/page.ts` (~4,780 lines; 57 `.nar` narrative blocks, 48 `.kv` panels, copyable chat-command blocks in Tools) on 2026-07-24.
> Governing decisions (plan §1/§2): mobile-first, visual, action-driven; state is icon + color + rail style, never text alone; founder-device proof v2 = in-app signed gate action with redacted receipt (hashes only). Copy must not reintroduce the retired manual initData ritual.

## 1. Per-screen word caps (per tab)

Budget counts **all visible rendered strings in the active tab at rest** (default state, no sheet open, full scroll height), excluding shared chrome. See §5 for the counting rule.

| Tab | Word cap | Notes |
|---|---|---|
| Mission | ≤ 90 words | Hero card + orbit + questline timeline + freshness chip. Narrative lives in collapsed info sheets, not on the card. |
| Gate | ≤ 110 words | Decision queue as visual stack + GateActionRow. Consequence/reversibility compressed to state tokens + the preflight single line (§3). |
| Tools | ≤ 80 words | Action surfaces with button labels + result feedback tokens. Zero command text (see §4). |
| Story | ≤ 70 words | Beats as signal rows with state tokens; PacketFlow rails carry meaning, not captions. |
| Inspect | ≤ 260 words | **Largest budget — detail lives here.** ProofList, branch map, audit panels, raw routes/schemas. Still label-first, mono values. |
| Shared chrome (header/nav/chip rail) | ≤ 25 words | Title, 5 nav labels, subtitle, chip rail labels. Counted once, not per tab. |

Caps are ceilings, not targets. A screen that says less wins. Overflow is a wave-gate failure (T-028), not a warning.

## 2. Per-component string caps

| Element | Cap | Reference example |
|---|---|---|
| Eyebrow (caps label) | ≤ 2 words | `NEXT MISSION` |
| Title | ≤ 4 words | `Mission Control` |
| Subtitle | ≤ 6 words | `cambium · branch arcs` |
| Meta row — label | ≤ 2 words | `Owner:` `Gate:` |
| Meta row — value | ≤ 4 words | mono value, single line, ellipsis past that |
| Chip label (BranchArcChip) | ≤ 2 words + mono count | `Fitcheck 9/17` |
| Freshness chip | ≤ 2 words | `fresh 2m` |
| Section header | ≤ 2 words | `STATE STACK` `PROOF NEEDED` |
| State-token subtitle | ≤ 3 words | `needs gate review` `evidence missing` |
| **Button label** | **≤ 3 words** | `Review Gate` `Open Proof` `Approve` `Reroll` |
| **ProofList row label** | **≤ 4 words** | `Deploy URL` `Evidence receipt` |
| KPI label | ≤ 3 words | `Survival:` |
| KPI value | ≤ 5 words | `qualified waitlist` |
| Consequence line (preflight only) | ≤ 16 words, single sentence | see §3 |
| Empty / error state | ≤ 12 words + one action button | state token + plain cause + `Retry` |
| Toast / action feedback | ≤ 8 words | `Receipt queued` |

Two-line component captions (QuestlineTimeline stations) follow name ≤ 2 words + state-word = 1 word.

## 3. Preflight sheet rule (Gate actions)

- Exactly **ONE consequence line** (≤ 16 words) describing what the tap does, plus **ONE `Inspect` link** for the full detail. Nothing else textual.
- Reversibility is shown as a **state token** (`reversible` / `until consumed` / `irreversible`), never as a sentence. `irreversible` additionally triggers the peach blocked treatment per StateToken spec.
- **No kv walls.** The current 10-row `.kv` block (interaction / chat syntax / source / card group / target system / description / payload preview / expected receipt / mini app writes / signed action button) is the canonical anti-pattern and must not survive in any sheet. Key–value detail of that depth lives only in Inspect.
- Signed gate actions (approve / reroll / confirm) execute in-app via the gate client; the redacted receipt (hashes only: userIdHash, actionKind, subjectHash, idempotencyHash, workerVersionId, capturedAt) renders as a receipt token + state flip, ≤ 8 words of surrounding copy.

## 4. BANNED list (hard fail in review and in the §5 audit)

1. **Copy-paste command blocks.** No chat-syntax strings, no `Copy command text` buttons, no payload previews, anywhere in the app. Actions POST via the gate client in-app.
2. **Paragraph narrative on primary surfaces.** No `.nar`-style multi-sentence blocks on Mission/Gate/Tools/Story. Narrative moves to collapsed info sheets or Inspect.
3. **kv grids outside Inspect.** Key–value panels are Inspect-only.
4. **Generic AI copy.** Banned words include (case-insensitive, substring match): `powerful`, `seamless`, `modern and elegant`, `cutting-edge`, `leverage`, `unlock`, `supercharge`, `delight`.
5. **Emoji bullets.** No emoji as list markers or state indicators — glyphs and state tokens only.
6. **Exclamation marks in state labels.** State words are flat declaratives (`blocked`, `waiting unlock`); the warning glyph carries urgency, not punctuation. `!` is permitted only inside the frozen warning-triangle glyph artwork.
7. **Manual-initData ritual copy.** No string may instruct the user to paste, capture, or set `TELEGRAM_INIT_DATA` / `TG_INIT_DATA` or any initData value. Runtime auth is automatic and invisible in copy.
8. **Redaction violations.** No raw initData, raw user ids, tokens, or query strings in any user-facing string or artifact-bound string. Hashes only.

## 5. Measurement method — automated string-count audit

**Runner.** Validation subagent executes the audit every wave (T-028) and at every wave boundary, alongside the viewport harness (T-010). It renders each scene's fixtures (T-011) at mobile viewport in the seven fixture states and walks the DOM.

**Counting rule.**
- **Unit:** a *visible rendered string* = a text node in the served HTML that is not inside `display:none` / `visibility:hidden` / `aria-hidden="true"` subtrees and not inside collapsed `<details>`/info-sheet bodies at rest.
- **Attribution:** each string is attributed to the tab whose scene root contains it. Shared header/nav/chip-rail strings are attributed once to the `chrome` bucket. Bottom-sheet / preflight content is counted separately against §3, not against the opening tab's cap.
- **Words:** split on whitespace after trimming. Numbers and mono tokens (`9/17`, `fresh 2m`, a hash, a route, a URL) each count as one word. Ellipsized-overflow text counts in full (the DOM string, not the clipped render).
- **Per-element checks:** the audit also classifies strings by element (button, ProofList row, eyebrow, etc., via component `data-*` hooks) and fails any element over its §2 cap.

**Banned-list checks.** The audit additionally greps all rendered strings for §4 patterns: banned AI-copy words (case-insensitive), emoji in bullet/label positions, `!` in elements carrying a state class, `TELEGRAM_INIT_DATA` / `TG_INIT_DATA` / `initData` instructional copy, and kv-grid markup outside the Inspect scene root.

**Gate.** Any tab over cap, any element over cap, or any banned-list hit = wave-gate failure; the owning scene worker trims copy and the audit re-runs before merge. Results are archived per wave next to the viewport-harness output.
