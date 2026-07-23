# 06 — Copy Rewrite Brief (P2 scene builders)

> Status: **pre-frozen** → ratified → frozen at P1-W3 (task T-012).
> Governs: every user-facing string the P2 scene builders write. Compliance is measured against `05-copy-budget.md` (per-tab caps §1, per-component caps §2, preflight rule §3, BANNED list §4, audit method §5). This brief adds no new budget; it operationalizes it.
> Cataloged against `workers/quests/src/page/` at commit d6e2909: 58 `.nar` narrative render sites and ~65 `.kv`/`gateRows`/`kvRows` render sites (≈53 distinct kv panels), plus scaffold chrome and inline card copy.
> Terms: **KEEP** = string ships unchanged. **REWRITE** = string ships, exact replacement given. **MOVE-TO-INSPECT** = string leaves its current surface and renders only inside the named Inspect group/sheet. **DELETE** = string never renders again (content either dies or is replaced by a glyph/token).

---

## 1. String inventory → disposition (per-surface rules + named exceptions)

Counts are of render sites cataloged at d6e2909. A "rule" applies to every string in its class; **named exceptions override rules and are listed exhaustively in §1.7.**

### 1.1 Shared chrome (scaffold.ts, client/freshness.ts, client/scene-engine.ts) — cap ≤ 25 words

| Rule | Strings | Disposition |
|---|---|---|
| C1 | Title `Mission Control`; 5 nav labels (`Mission` `Gate` `Tools` `Story` `Inspect`); 5 nav subtitles (`next move` `review` `act` `signals` `proof`); scene-badge chip label | KEEP |
| C2 | Brand subtitle `tenant cambium · branch arcs` | REWRITE → `cambium · branch arcs` |
| C3 | Freshness chip `derived Xm ago` / `derived Xh ago` / `freshness missing` / `stale refresh ignored` / `derived just now` | REWRITE → `fresh Xm` (or `fresh Xh`, `fresh now`); stale → `stale Xh`; missing → `no freshness`; ignored → `stale · refresh skipped` |
| C4 | Pull-to-refresh proof `Pull to refresh updates /api/quests/cambium; decisions stay behind signed actions.` (both copies: scaffold.ts, scene-engine.ts) | REWRITE → `pull to refresh · decisions stay signed` |
| C5 | `openSceneSheet` scene-badge sheet: SCENE_META summary narratives (4) + `summary`/`next`/`refresh` kv + Inspect-variant nar/kv | DELETE sheet entirely. Scene badge becomes a nav shortcut (tapping scrolls to the scene); its informational content already lives in Inspect `surface-contract` group. |
| C6 | Freshness sheet (`openFreshnessSheet`): nar + 5-row kv incl. `refresh command` = `quine write quests push --tenant cambium` | DELETE sheet. Freshness detail → MOVE-TO-INSPECT `freshness` group (rows already exist there). The `refresh command` row is chat-syntax — DELETE everywhere (BANNED §4.1), never moved. |

### 1.2 Mission tab (scenes/mission.ts + mission-control renderers in scenes/inspect.ts) — cap ≤ 90 words

| Rule | Strings | Disposition |
|---|---|---|
| M1 | BranchArcChip labels + mono counts; `N/17 quests` progress; `frontier clear`; questline stage titles; all StateTokens; meta-row labels (`Owner` `Gate` `Dispatch` `Promotion`); buttons `Review Gate` `Open Proof` | KEEP |
| M2 | Mission-card vision paragraph (`view.vision`, multi-sentence) | MOVE-TO-INSPECT-collapsed (see §3, N-02). Card keeps title + state token + orbit only. |
| M3 | Quest stem row evidence strings (`.ev`, one per ledger row, ~6–10 words each) | MOVE-TO-INSPECT → `quest-ledger` detail rows. Stem rows render as QuestlineTimeline stations: name ≤ 2 words + 1 state word. |
| M4 | `here → <arc> · <title>` frontier chip | REWRITE → `frontier · <arc>` (mono arc token) |
| M5 | `Active organ` detail (`<label> · <detail>`, up to ~8 words) | REWRITE → organ label only (≤ 2 words); detail → MOVE-TO-INSPECT `rails` group |
| M6 | `Suggested tool` card small (`/ts-status checks the branch before you assign or report the next mission step.`) | REWRITE → `branch status lives in Tools` (chat-syntax `/ts-status` deleted per BANNED §4.1) |
| M7 | `Loop controls` small (`title · runMode · boundaryColor · cadence` joined) | REWRITE → mono cadence token only, e.g. `daily · amber` (≤ 4 words) |
| M8 | `Blocked by` section: up to 5 rows of `state + label` (~7 words each) | DELETE as a standalone section. First blocker folds into the State Stack `Blocked by` row (label ≤ 4 words); full blocker list → MOVE-TO-INSPECT `branch-packets` group |
| M9 | ProofList row detail text (`row.detail \|\| row.source`, ~5–8 words per row) | MOVE-TO-INSPECT. Rows render label only per §2.1. |
| M10 | KPI pulse `<small>` line (`better: X` / `better-than-survival proof pending`) | REWRITE → `better · <mono>` when served, else DELETE the line |
| M11 | Quest/progress/frontier sheets (`openSheet`, `openProgressSheet`, `openFrontierSheet`): 3 kv panels (7 + 4 + 3 rows), 3 nar sites, `next action source`/`next action` rows | kv → MOVE-TO-INSPECT `quest-ledger` group. Narration → collapsed info sheet (§3, N-01). `Progress is derived from the served quest ledger, not browser-local completion.` → REWRITE → `progress comes from the served ledger` (info-sheet line). `The frontier points at the current active ledger row.` → DELETE (token carries it). |
| M12 | Mission empty state (`Mission control is waiting for branch packets.` + `Branch arcs appear only after branch packets reach the visual envelope.` + `Refresh`/`Inspect`) | REWRITE body → `branch packets have not reached this device` (title KEEP, buttons KEEP; 12-word empty-state cap) |

### 1.3 Gate tab (scaffold gate shell + client/signed-action.ts) — cap ≤ 110 words

| Rule | Strings | Disposition |
|---|---|---|
| G1 | Filter chip ids (`all` `review` `blocked` + branch ids) with mono counts; priority chips (`risk · X` `dependency · X` `score · N`, mono); subject ids (mono); StateTokens; `Queued` token | KEEP |
| G2 | Scaffold hero: `Gate · decisions` + `Review founder decisions tied to branches, missions, proof, consequence, and reversibility.` | REWRITE → title `Gate` + subtitle `founder decisions · proof first` (≤ 6 words) |
| G3 | `Receipt sync` copy (`Queued actions return here only after Worker queue, operator consumption, and Mini App refresh proof line up.`) | REWRITE → `receipts land after operator consumption` |
| G4 | GateStateStack subtitles: `founder confirmation` / `held for operator consumption` / `evidence before action` | REWRITE → `founder sign` / `awaits operator` / `evidence first` (≤ 3 words, §2.3) |
| G5 | Card action buttons: `Approve safely` `Reroll safely` `Confirm signed` `Details` | REWRITE → `Approve` `Reroll` `Confirm` `Inspect` (§2.2) |
| G6 | Queued-state subtitle `Awaiting operator consumption` | REWRITE → `awaits operator` |
| G7 | Stale chip `<updatedAt> · refresh before deciding` | REWRITE → `stale · refresh first` (+ mono timestamp) |
| G8 | Queue footer notes: `signed actions queue founder decisions; detail sheets carry audit proof.` and `No Gate items match X; urgent blockers stay visible under all.` | REWRITE → `signed decisions queue here · proof lives in Inspect`; empty-filter → `no rows match · blockers stay under all` |
| G9 | Hero idle: `Decision waiting` / `No founder decision is waiting; Mission and Inspect stay available.` | REWRITE → `Gate quiet` / `mission and inspect stay open` |
| G10 | Gate empty state body (`Gate is quiet. Evidence-backed approve and reroll choices appear here only after Cambium serves an open item.`) + `Decision lane`/`Founder action` facts | REWRITE body → `decisions appear here when Cambium serves open work` (≤ 12 words); the two gateFact rows → DELETE (tokens carry state); buttons `Mission` `Inspect` KEEP |
| G11 | Gate error state (`network failure` + `<source> unreachable; no local queue write.`) | KEEP (≤ 12 words + state token; mono route) |
| G12 | Card `gmeta` fact block — 8–11 rows × ~8 words (`Decision waiting` `Branch / mission` `Channel route` `Selected option` `Receipt expectation` `Latest receipt` `Approve/Reroll/Queued consequence` `Execution boundary` `Reversibility`) | MOVE-TO-INSPECT → `gates` group. None of it renders on the card. |
| G13 | `GateRowExpansionDetails` (State / Sync / Updated / Reversibility state) | MOVE-TO-INSPECT `gates` group (sync prose trimmed to tokens: `stale` / `queued` / `needs proof` / `ready`) |
| G14 | `GateRoutePill` + `GateReceiptSummary` + `GateLatestReceipt` on the card | MOVE-TO-INSPECT. Card keeps one `Proof` row (label KEEP `Proof attached` → REWRITE → `Proof`, ≤ 4 words) |
| G15 | Preflight sheet (`openGatePreflight`): narrative paragraph + 10–12-row kv incl. `initData status` row + `Waiting for explicit signed confirmation…` status line | kv wall + nar → DELETE (BANNED §4.7-adjacent: `initData status` is ritual copy; §3: no kv walls in sheets). Rebuild per §2.4: ONE consequence line + reversibility state token + `Inspect` link + `Confirm`/`Cancel`. Submit-status strings → REWRITE: `sending…` / `queued` / `refused · no write` (≤ 8 words each) |
| G16 | Result sheet (`openGateResultSheet`): titles (`Founder Decision Queued` etc.) + nar + 7–9-row kv + `Refresh receipt` button | Titles KEEP (`Founder decision queued` — flat case). nar → REWRITE per §3 N-04 (≤ 8 words). kv → MOVE-TO-INSPECT `gate receipts` (new subgroup of `gates`). Button → REWRITE `Refresh` |
| G17 | Failure sheet (`Decision Not Queued` + nar + 7-row kv) | Title → `Decision not queued` (KEEP wording, flat case). nar → REWRITE → `worker refused · no queue write · proof unchanged` (≤ 8 words). kv → MOVE-TO-INSPECT. `next step` row → DELETE (buttons carry it) |
| G18 | Auth-failure sheet (`Open inside Telegram` + nar mentioning initData + 3-row kv) | Title KEEP. nar → REWRITE → `signed actions run inside Telegram with founder auth` (no initData mention — BANNED §4.7). kv → DELETE |
| G19 | Inline `.gnote` queue results (`X founder decision queued for Y — key Z`, `refused: …`, `network failure — no local queue write.`) | REWRITE → receipt token + state flip, ≤ 8 words: `queued · <kind> · <mono key>` / `refused · no write` / `network failure · no write` |
| G20 | `skillPromotionAct` / `sideQuestAct` fire-and-forget posts with `queuing...` / `promotion queued for X — key Y` strings | REWRITE flow: both kinds route through the SAME preflight sheet as other gate actions (§2.4). Inline results → same receipt tokens as G19 |

### 1.4 Tools tab (scenes/tools.ts + scaffold ghead/gsub) — cap ≤ 80 words, zero command text

| Rule | Strings | Disposition |
|---|---|---|
| T1 | All chat-syntax strings (`/ts-run`, `/ts-approve`, `/ts-status`, … incl. `commandUsage()` output, `cargs`, `payload preview` rows), `Copy command text` buttons, `Copied command text`, `Copy unavailable`, clipboard-unavailable kv fallback | DELETE — BANNED §4.1, no exceptions, not even in Inspect |
| T2 | CMDS catalog descriptions rendered as chat commands (`Assign the next mission step`, `Send a decision back with reason`, …) | DELETE for act/digest/reference kinds (chat-only surface; the app does not advertise them). Live kinds (status/hermes/agents/work/handoffs) are rebuilt as action surfaces — see T4 |
| T3 | Scaffold `Tools · the operator toolbelt` + `the /ts-* command surface, run through the curios.self bot in Telegram.` | REWRITE → `Tools` + `live operator surfaces · read-only` |
| T4 | 5 live command cards + their sheets (status/services/agents/work/handoffs) | REWRITE cards as action surfaces: label ≤ 4 words (`Org status` `Services` `Agents` `Active work` `Handoffs`) + state token + result-feedback token on tap. Sheet kv/lists → MOVE-TO-INSPECT `tools` group |
| T5 | `toolSafetyRow` (`Safety before syntax: … ; expected result: … ; required proof: … . Tools does not send bot messages or mutate Paperclip.`) | REWRITE → single token line `read-only · signed decisions stay in Gate` (≤ 8 words) |
| T6 | Recommendation card (`Recommended next tool` + `/ts-handoffs · Founder decision context is the current blocker.` etc.) + `No mission recommendation yet` idle copy | REWRITE → `Suggested` + reason ≤ 6 words without command syntax (`a founder decision blocks this branch` / `proof rows need a progress receipt` / `mission ready to assign` / `refresh status first`). Idle → `no suggestion yet` |
| T7 | Context strip (`signed decisions stay in Gate` span + 3 tokens) and recent strip (`/ts-status` … buttons) | Context strip KEEP minus duplicate span (T5 token covers it). Recent strip → DELETE (command names are chat syntax) |
| T8 | Availability labels (`usable` `needs proof` `locked` `stale` `reference`) and disabled reasons (`live command data unavailable; pull to refresh or inspect Tools audit` etc.) | REWRITE → canonical StateToken subtitles (§2.3); disabled reasons → token + `Inspect` link only |
| T9 | `commandTargetSystem` / `commandExpectedReceipt` meta pairs on cards (`Paperclip handoffs`, `digest receipt or proof summary`, …) | MOVE-TO-INSPECT `tools` group detail rows |
| T10 | Card-sheet 10-row kv (`interaction`/`chat syntax`/`source`/`card group`/`target system`/`description`/`payload preview`/`expected receipt`/`mini app writes`/`signed action button`) — the canonical §3 anti-pattern | DELETE. Not moved: its useful residue (target system, expected receipt) already exists in Inspect `tools` rows |
| T11 | Live-sheet empty nars (`no Hermes service data.` / `no agents.` / `no active work.` / `nothing waiting on you.`) + unavailable nar (`org data unavailable: Paperclip gateway unreachable…`) | REWRITE → empty-state tokens ≤ 12 words: `no services served` / `no agents served` / `no open work served` / `no handoffs waiting`; unavailable → `live data unreachable · pull to refresh` + state token |
| T12 | Footer gnote `Use Tools to inspect, assign, coordinate, and report from the operator chat.` | DELETE (chat-era copy) |

### 1.5 Story tab (scenes/story.ts) — cap ≤ 70 words

| Rule | Strings | Disposition |
|---|---|---|
| S1 | Group names (`Mission wins` `New signals` `Lessons` `Drift`), filter chips with mono counts, branch filter chips (`all branches` `unassigned` + branch names), StateTokens, `StoryTimelineRail` (no text), digest counts (`Mission wins 3 · …` mono) | KEEP |
| S2 | Beat card body `<b>` = full beat text (multi-clause, up to ~15 words × up to 12 visible beats) | REWRITE on card → teaser ≤ 6 words (§3, N-05: outcome + proof cue, e.g. `mission moved · proof ready`). Full text → MOVE-TO-INSPECT `evidence` group |
| S3 | Beat card `<small>` (`<outcome> · <proof cue>`) | KEEP — this IS the teaser source; cap outcome ≤ 3 words, proof cue ≤ 3 words (current cues `Proof ready` / `Proof needed` / `Review evidence` already comply) |
| S4 | Story hero (`Latest change` + `<full beat text> · Open branch beat`) | REWRITE → `Latest change` + teaser ≤ 8 words (teaser only, no `Open branch beat`) |
| S5 | Beat sheet (`openStoryBeat`): nar = beat text + 12-row kv (+ warning/paperclip rows) + 2 nav buttons | nar + kv → MOVE-TO-INSPECT `evidence` group (beat sheet deleted; card tap routes to Inspect evidence sheet). `contradiction requires Inspect review before this becomes a win` → REWRITE → state token `blocked` + Inspect link. Buttons `Open Mission`/`Open Gate`/`Open Tools`/`Open Proof` KEEP as Inspect-sheet nav |
| S6 | Digest sheet nar (`Digest lists individual beats without hiding blockers.`) + `No story beats served.` | nar → DELETE (rows speak); empty nar KEEP |
| S7 | Stale banner (`Last story check is stale.` + `Refresh before using these beats for a decision.`) | REWRITE → `story stale` + `refresh before deciding` (token-led, ≤ 12 words total) |
| S8 | Empty states: `No branch story yet.` + `Wins, signals, lessons, and drift appear here after a branch has evidence.`; per-group `<group> is empty.` + `Nothing in this lane yet. Refresh after branch evidence changes.`; `No story beats in this group.` + `Switch groups or refresh after new branch evidence lands.` | REWRITE bodies → `beats land after branch evidence` / `nothing in this lane yet` / `switch groups or refresh` (titles KEEP; 12-word cap) |
| S9 | At-rest beat volume: unlimited groups render all beats | REWRITE structure: at rest render digest + latest change + max 6 signal rows; remainder reachable via group chips + Inspect. (Structure, not copy — noted here because it drives the word projection in §4.) |

### 1.6 Inspect tab (scenes/inspect.ts) — cap ≤ 260 words at rest

| Rule | Strings | Disposition |
|---|---|---|
| I1 | All kv panels and sheet narratives inside Inspect (38 `.nar` sites, ~40 kv panels): wake/sense/lane/stance/policy/decision-context/live-proof/completion-definition/side-quest/coordination/capture-plan/evidence-box/skill-labor/companion/branch-mission sheets | KEEP — Inspect is the detail home. Sheets are not counted at rest (05 §5). Prose kv values trimmed to mono/single-line where they are not already |
| I2 | Group summary details (9 primary + 2 secondary, up to 14 words each, e.g. `Refresh before trusting decisions; this story and proof map may be old.`) | REWRITE → ≤ 8 words each, flat declaratives, e.g. freshness → `proof window fresh · refresh after movement`; live proof → `N blockers need proof`; branch packets → `N packets trusted`; gates → `N decisions waiting`; action requests → `N requests projected`; policy → `blocked actions explained first`; tools → `N surfaces live` / `surfaces stale`; rails → `N proof rails`; evidence → `N evidence rows`; branch-fixtures → `fixtures calibrate layout only`; surface-contract → `scene coverage and proof links` |
| I3 | Maphead subtitle (`Proof map for blockers, packets, freshness, and evidence.`) | REWRITE → `proof · packets · freshness · evidence` |
| I4 | Section header `Tapestry proof links` | REWRITE → `Proof links` (≤ 2-word section-header cap) |
| I5 | `NO ACTION REQUESTS` + `No redacted ActionRequest rows are served yet.` | REWRITE → `no action requests` + `none served yet` (flat declaratives; no all-caps prose outside eyebrows) |
| I6 | Proof summary card (`Proof summary` + `N live blocker(s) · M branch packet(s) · redacted receipts required · next: X.` + `Open proof details`) | KEEP structure; REWRITE small → `N blockers · M packets · redacted receipts required` (drop `next:` clause into the sheet); button → `Open proof` |
| I7 | Pane switcher `Proof` / `System` | KEEP |
| I8 | Absorption targets: everything MOVE-TO-INSPECT above lands in these named groups — `quest-ledger` (new), `gates` (+ `gate receipts` rows), `evidence` (story beats), `tools` (live surfaces), `freshness` (chip detail). New group labels follow the ≤ 2-word section-header cap | (destination spec, no copy of its own) |

### 1.7 Named exceptions (exhaustive)

These individual strings deviate from their surface rule or are called out for explicit adjudication:

1. `Mission Control` — KEEP (title cap ≤ 4 words).
2. Nav subtitles `next move` / `review` / `act` / `signals` / `proof` — KEEP (counted once in chrome).
3. `Open inside Telegram` — KEEP title; only its narrative is rewritten (G18). No string anywhere else may name Telegram auth mechanics.
4. `Proof attached` (gate proof row) — REWRITE → `Proof` (G14), despite being within the old ≤ 4-word cap, for consistency with ProofList labels.
5. `no founder decisions waiting.` (gate empty title) — KEEP lowercase flat declarative; body rewritten per G10.
6. `Decision Not Queued` / `Original Queued Action Reused` / `ActionRequest Signed Confirmation Queued` / `Founder Decision Queued` — KEEP wording but REWRITE to sentence case (`Decision not queued`, `Original queued action reused`, `ActionRequest confirmation queued`, `Founder decision queued`).
7. `NO ACTION REQUESTS` — the only all-caps prose string in the app; REWRITE per I5. Eyebrows (`NEXT MISSION`) remain caps by design and are exempt.
8. Mono tokens — routes (`/api/gate/cambium`), hashes, idempotency keys, `9/17`, timestamps, branch/quest ids: KEEP everywhere including Inspect kv values; each counts as one word (05 §5).
9. `Refresh` / `Retry` / `Cancel` / `Inspect` / `Mission` single-word buttons — KEEP in every empty/error/sheet context.
10. `risk · review` / `dependency · founder-choice` / `score · 10` priority chips — KEEP (mono compound tokens, Gate only).
11. `quine write quests push --tenant cambium` and `quine write quests npc-event` and `npm run proof:tg-live-readiness` — command strings currently rendered in freshness sheet, Inspect skill/npc sheets, and live-proof rows: the freshness instance is DELETED (C6); Inspect instances are KEEP as mono reference values inside Inspect kv (they are operator-facing proof commands, not user chat syntax — adjudicated: Inspect is exempt from §4.1's user-facing intent, values render mono).
12. Glyph `aria-label`s (`state: <label>`, `progress X% · <kind>`, `signal rail <kind>`) — KEEP; not visible strings, but must still avoid BANNED words.

---

## 2. Founder-readable label tables

Canonical strings. Builders use these verbatim; anything not in these tables needs a new row ratified here first.

### 2.1 ProofList row labels (cap ≤ 4 words each; row = glyph + label + `›`)

Served proof requirements map to labels by pattern:

| Served requirement (pattern) | Label |
|---|---|
| deploy URL / preview link | `Deploy URL` |
| evidence / receipt artifact | `Evidence receipt` |
| readiness.json / readiness capture | `Readiness receipt` |
| device capture / device artifact | `Device capture` |
| release SHA / final build | `Release SHA` |
| Telegram auth / initData proof requirement | `Founder auth proof` |
| gate sign-off / approval record | `Gate sign-off` |
| KPI / survival evidence | `KPI proof` |
| branch packet gap | `Branch packet` |
| fallback (unmatched) | `Proof missing` |

Rules: label only on the row (no detail text — detail opens the Inspect sheet). Max 5 rows at rest (existing slice). Fallback never renders raw requirement text.

### 2.2 GateActionRow + action buttons (cap ≤ 3 words)

| Context | Button(s) |
|---|---|
| Mission bottom actions | `Review Gate` · `Open Proof` |
| Gate card — open item | `Approve` · `Reroll` · `Inspect` |
| Gate card — needs signed confirmation | `Confirm` · `Inspect` |
| Gate card — queued | (token `queued`) · `Inspect` |
| Preflight sheet | `Confirm` · `Cancel` |
| Result sheet | `Refresh` · `Mission` · `Inspect` |
| Failure sheet | `Mission` · `Inspect` |
| Empty/error states | `Refresh` (or `Retry`) · `Mission` · `Inspect` |
| Story/Inspect nav | `Open Mission` · `Open Gate` · `Open Tools` · `Open Proof` |
| Mission tool link | `Open Tools` |
| Branch loops | `Open controls` |

Banned replacements (old → new): `Approve safely` → `Approve`; `Reroll safely` → `Reroll`; `Confirm signed` → `Confirm`; `Details` → `Inspect`; `Refresh receipt` → `Refresh`; `Copy command text` → (deleted); `Confirm approve`/`Confirm reroll` → `Confirm`.

### 2.3 StateToken subtitles (cap ≤ 3 words; flat declaratives; no `!`)

| State kind | Canonical subtitle | Replaces |
|---|---|---|
| complete | `verified` | `complete`, `done` |
| active | `ready` | `usable`, `ready for founder review`, `in progress` |
| proof-needed | `needs proof` | `proof-needed`, `Gate review`, `needs gate review` |
| blocked | `blocked` | (KEEP) + `hard stop` |
| stale | `refresh first` | `stale`, `stale; refresh before decisions`, `old proof` |
| locked | `on hold` | `locked`, `permission held`, `waiting unlock` |
| queued | `awaits operator` | `Awaiting operator consumption`, `queued; awaiting operator consumption` |
| selected | `selected` | (KEEP) |
| idle | `waiting` | `idle`, `quiet rail`, `reference` |
| receipt | `receipt` | (KEEP, MissionStateStack proof row) |

Subtitle is context-free: the same kind renders the same words on every tab. Custom per-instance subtitles are disallowed; context belongs in the row label, not the token.

> Adjudication note: 05 §4.6 cites `waiting unlock` as a flat-declarative example, but 05 §4.4 bans the substring `unlock` and the §5 audit greps case-insensitive substrings. The canonical locked subtitle is therefore `on hold`; `waiting unlock` must not ship.

### 2.4 Preflight sheet — the single consequence line (cap ≤ 16 words, one sentence)

Every gate action kind — including `promote-skill` and `queue-side-quest`, which today bypass preflight — opens the same preflight sheet: **glyph + title + ONE consequence line + reversibility state token + `Inspect` link + `Confirm`/`Cancel`.** Nothing else textual.

| Kind | Title | Consequence line (exact; `{subject}`/`{option}` = mono token, 1 word) | Reversibility token |
|---|---|---|---|
| `approve` | `Approve gate item` | `Queues founder approval for {subject}; nothing mutates until an operator consumes the queue.` (13) | `until consumed` |
| `reroll` | `Reroll gate item` | `Queues a reroll request for {subject}; current work stays unchanged until operator consumption.` (13) | `until consumed` |
| `promote-skill` | `Promote skill` | `Queues skill promotion review for {skill}; the registry changes only after operator consumption.` (13) | `until consumed` |
| `queue-side-quest` | `Queue side quest` | `Queues side quest {id} for operator follow-up; nothing completes from this device.` (12) | `until consumed` |
| `confirm-action-request` | `Confirm action request` | `Queues signed confirmation for {option}; execution waits for operator consumption of the queue.` (13) | `until consumed` |

Rules:
- Served `consequence` strings from the envelope are **payload, not copy** — they travel in the POST body and may render as mono values inside Inspect kv, but the preflight sheet renders ONLY the lines above. The current 15–18-word semicolon strings (`queue founder approval for X; no Paperclip/org mutation until…`) never render.
- If a served item is genuinely irreversible, the reversibility token flips to `irreversible` with the peach blocked treatment (StateToken spec); the consequence line does not change.
- Post-submit feedback (success/refusal) ≤ 8 words: `receipt queued` / `decision queued · original reused` / `refused · no write` / `network failure · no write`.
- Redacted receipt rendering (userIdHash, actionKind, subjectHash, idempotencyHash, workerVersionId, capturedAt): receipt token + state flip, ≤ 8 words surrounding copy (05 §3); hashes render mono inside Inspect only.

---

## 3. Collapsed-narrative model

Paragraph narrative never renders on Mission/Gate/Tools/Story (BANNED §4.2). Each retired narrative gets exactly one of two homes: a **collapsed info sheet** (`<details>` closed at rest — not counted, 05 §5) attached to its owning component, or an **Inspect group sheet**. Each keeps a one-line teaser where the narrative used to be.

| # | Narrative (source) | New home | One-line teaser (rendered) |
|---|---|---|---|
| N-01 | Quest `row.narration` (quest detail sheet) | Collapsed info sheet on the quest's Inspect `quest-ledger` row | quest title + state word (timeline station) |
| N-02 | Mission vision paragraph (`view.vision`) | Collapsed info sheet `why this mission` on MissionCard | none on card (title + token + orbit carry it); sheet summary line `why this mission` |
| N-03 | Gate preflight narrative paragraphs (2 variants) | DELETED — replaced by §2.4 consequence line | the consequence line itself |
| N-04 | Gate result narratives (duplicate / confirm / founder variants) | Inspect `gates` → receipt rows | `decision queued · receipt in Inspect` (≤ 8 words) |
| N-05 | Story beat full text | Inspect `evidence` group sheet per beat | `<outcome> · <proof cue>` ≤ 6 words on the signal row |
| N-06 | Tools command guidance (2 variants: chat-command / reference) | DELETED with the command catalog | `read-only · signed decisions stay in Gate` |
| N-07 | Freshness narrative (`stale data is not live proof` / `fresh envelope data can support…`) | Inspect `freshness` group (rows exist) | freshness chip `fresh 2m` / `stale 3h` |
| N-08 | SCENE_META scene summaries (4) | DELETED (C5) | nav subtitles already carry scene meaning |
| N-09 | Quest progress / frontier narratives | Inspect `quest-ledger` group | `N/17 quests` / `frontier · <arc>` |
| N-10 | Gate detail-sheet narratives (3 variants: needs-signed / queued / default) | Inspect `gates` group sheet | `Proof` row label on the card |
| N-11 | Branch mission focus narrative (`branchMissionFocusNarrative`) | KEEP — already an Inspect sheet | branch chip label |
| N-12 | Skill-labor / companion (NPC) narratives | KEEP — already Inspect sheets | group row labels |

Teaser rules: ≤ 8 words, flat declarative, no BANNED words, no trailing ellipsis as a style device (real truncation ellipsis only, counted in full per 05 §5).

---

## 4. Per-tab word-cap compliance projection

Current counts are pre-audit estimates (DOM walk per 05 §5 lands with T-028; fixtures T-011). Projections assume §1 dispositions and §2/§3 strings applied. Counting excludes chrome (counted once) and sheet/preflight bodies (counted against 05 §3, not the tab).

| Tab | Current (est.) | Cap | Projected | Principal cuts |
|---|---|---|---|---|
| Mission | ~230–260 (3 branches, 5 proof rows, 5 blockers) | ≤ 90 | **~85** | vision → info sheet (−14); blockers section folded (−35); proof-row details removed (−30); quest evidence off stem (−40); meta/organ/tool-link trims (−25) |
| Gate | ~215–240 (1 decision card) | ≤ 110 | **~70** | gmeta fact block → Inspect (−80); expansion details → Inspect (−16); hero/progress/strip rewrites (−25); queue notes halved (−15); route/receipt pills → Inspect (−14) |
| Tools | ~290–320 (13 command cards) | ≤ 80 | **~60** | command catalog + syntax + copy buttons deleted (−180); safety row → token (−25); ghead/gsub rewrite (−12); recent strip deleted (−5); 13 cards → 5 action surfaces (−40) |
| Story | ~200–240 (12 beats × ~19 words) | ≤ 70 | **~60** | beat text → teasers (−120); hero rewrite (−8); at-rest cap of 6 signal rows (S9); stale/empty rewrites (−10) |
| Inspect | ~225–250 (9+2 group rows, AR grid, summary) | ≤ 260 | **~180** | group details ≤ 8 words (−55); maphead/section trims (−8); AR card span → teaser (−30). Headroom reserved for absorbed MOVE-TO-INSPECT rows, which render in sheets and do not count at rest |
| Chrome | ~32 | ≤ 25 | **~25** | brand subtitle (−1); freshness chip (−1); ptr proof (−5) |

If a fixture state pushes any tab over cap, the owning scene worker trims in this order: (1) visible row count (S9-style), (2) row detail to Inspect, (3) subtitle/secondary lines — never by shrinking type or hiding strings in `aria-hidden` to dodge the audit (05 §5 counts DOM strings; gaming the counter is a wave-gate failure).

---

## 5. BANNED-list compliance map (05 §4)

1. **Copy-paste command blocks** — satisfied by T1/T10/C6: every chat-syntax string, `Copy command text` button, and payload preview is DELETED app-wide. Adjudicated exception: operator proof commands as mono Inspect kv values (§1.7 #11).
2. **Paragraph narrative on primary surfaces** — satisfied by §3: 12 narrative classes re-homed; zero `.nar` on Mission/Gate/Tools/Story at rest.
3. **kv grids outside Inspect** — satisfied by M11/G12/G13/G15–G18/S5/T4/T10/C5/C6: every non-Inspect kv panel is deleted or moved; `gateRows`/`kvRows` helpers render only under the Inspect scene root.
4. **Generic AI copy** — catalog sweep found no current hits; §2 tables contain none. Audit greps stand.
5. **Emoji bullets** — none in current catalog; none introduced (glyphs + state tokens only).
6. **`!` in state labels** — none in current catalog; §2.3 subtitles are flat declaratives.
7. **Manual-initData ritual copy** — G15 deletes the `initData status` preflight row; G18 rewrites the auth-failure narrative; no string instructs pasting/setting initData anywhere.
8. **Redaction** — receipt rendering is hashes-only (§2.4); the ActionRequest `redaction` kv row (`no raw initData, callback nonce, bearer token, or Telegram chat id rendered`) KEEPs as the canonical statement; no new string may contain raw ids, tokens, or query strings.

## 6. Builder checklist (per scene PR)

1. Every string in your scene appears in §2 tables or carries a §1 rule/disposition — no orphan copy.
2. Buttons ≤ 3 words; ProofList rows ≤ 4 words; StateToken subtitles from §2.3 verbatim; consequence lines from §2.4 verbatim (subject tokens aside).
3. Zero `.nar`, zero `.kv`, zero chat syntax outside the Inspect scene root.
4. New strings carry the existing `data-component` hooks so the T-028 audit can classify them (button, proof row, eyebrow, token, teaser).
5. Run the string-count audit (T-028) against your fixtures (T-011) in all seven states before review; archive results next to the viewport-harness output.
