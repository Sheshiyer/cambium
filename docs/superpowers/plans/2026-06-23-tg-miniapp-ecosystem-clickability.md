# Cambium TG Mini App Ecosystem Clickability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn every stale, inert, or weakly-mapped Cambium Telegram mini app surface into an explicit ecosystem-backed view, sheet, or founder-safe action.

**Architecture:** Keep `workers/quests/src/page.ts` as the single served mini app shell for this wave, but move the page inventory and ecosystem link contract into testable data helpers before adding behavior. The Worker remains read-heavy and write-careful: visual rows render only served envelope data or explicit gap states, while mutations continue through Telegram-signed queue actions and operator consumers.

**Tech Stack:** TypeScript, Cloudflare Worker style handler tests with `node:test`, inline Telegram WebApp HTML/JS in `workers/quests/src/page.ts`, `bin/quine/hyphae/quests.ts` envelope generation, `bin/operator/quests/operator-policy.ts`, `shared/cambium-visual-contract.ts`, R3F contract sync, local Chrome viewport proof.

## Global Constraints

- Current top-level mini app scenes are `Quests`, `Map`, `Story`, `Gate`, and `Commands`; preserve those names unless a task explicitly renames a label with a test.
- No visual row may claim readiness from templates, stale screenshots, diagnostics, or capture plans.
- Every clickable card must open a sheet, queue a signed action, or clearly declare why it is read-only.
- Every non-clickable row must be rendered as read-only with visible provenance, not as an inert pseudo-button.
- Existing Worker action kinds stay exactly `approve`, `reroll`, `promote-skill`, and `queue-side-quest`.
- Raw Telegram `initData`, Worker credentials, user ids, queued ids, and response bodies must not be written to committed files.
- The mini app remains Telegram-first, read-heavy, write-careful, and attached to the existing `curios.self`/Hermes ecosystem surface.
- `thoughtseed-vault` R2 remains out of bounds for live mini app reads or writes.
- Dirty worktree state must be preserved; execution should happen from an isolated worktree created with `superpowers:using-git-worktrees`.

---

## Review Findings From Current Mini App

- `workers/quests/src/page.ts` currently serves five scenes: `sceneQ`, `sceneF`, `sceneS`, `sceneG`, and `sceneC`.
- `Quests` rows already open quest detail sheets, but the progress header, current frontier summary, and freshness chip do not explain their source paths.
- `Map` is the main operating surface and already has clickable cards for tapestry audit, wake, lanes, stance, next action, decision context, live proof, side quests, coordination, senses, stages, evidence boxes, skill labors, and companions.
- `Map` rail rows are visually card-like but are not clickable, so packet rails are currently inert.
- `Story` beats are rendered as non-clickable cards, so narrative, noesis, Paperclip, and forge events cannot be inspected.
- `Gate` has real signed actions for approve and reroll, but empty, unreachable, duplicate, and post-queue states need stronger ecosystem provenance.
- `Commands` live cards open sheets for status, Hermes, agents, work, and handoffs; reference commands, chat actions, and digest commands are visually card-like but inert.
- Current proof screenshots show stale fixture states such as `derived 4148h ago`, `org command data unavailable`, `0/6 decision signals served`, `0/1 boxes ready`, missing Mira, blocked live proof, and missing wake proof.
- Older docs establish the ecosystem map: Telegram Bot API, Hermes runtime, Paperclip, Cambium Worker/KV, Cloudflare Vectorize/Cortex, GitHub, Thoughtseed vault through Paperclip only, R3F visual engine, and Quine/operator CLIs.

## File Structure

- Modify `workers/quests/src/page.ts`: render semantics, click handlers, sheet bodies, command cards, story beats, rail cards, freshness source text, and interaction affordances.
- Modify `workers/quests/src/handler.test.ts`: DOM/script tests for every scene, stale row, clickable row, signed action, and read-only contract.
- Modify `workers/quests/src/visual-fixtures.ts`: fixture envelopes for fresh, stale, partial, command-rich, story-rich, rail-rich, and ecosystem-rich states.
- Create `workers/quests/src/mini-app-surface-contract.ts`: typed inventory of scenes, cards, ecosystem targets, interaction kinds, and proof requirements used by tests and docs.
- Modify `bin/quine/hyphae/quests.ts`: envelope source fields for commands, rails, story beats, freshness, ecosystem links, and provenance gaps.
- Modify `bin/operator/quests/operator-policy.ts`: policy provenance where next-action and gate rows need richer source mapping.
- Modify `shared/cambium-visual-contract.ts`: shared ecosystem labels for R3F/TG drift checks when organ/rail labels change.
- Modify `apps/cambium-r3f/scripts/generate-scene-contract.mjs`: keep generated source contract aligned with TG ecosystem labels.
- Modify `apps/cambium-r3f/src/scene/scene-data.test.ts`: prevent orphaned TG/R3F stage, rail, or ecosystem labels.
- Modify `workers/quests/src/visual-viewport-proof.mjs`: capture all five scenes plus critical sheets after this wave.
- Modify `docs/plans/2026-06-22-tg-miniapp-visual-engine-execution.md`: append the execution ledger for this wave.
- Modify `docs/plans/assets/tg-miniapp-viewport-proof/README.md`: document which screenshots prove clickability versus layout only.

## Shared Task Loop

Each task below uses this exact loop unless it states a narrower command:

- [ ] Step 1: Write the failing assertion in the listed test file.
- [ ] Step 2: Run the listed command and confirm it fails for the expected selector, field, or text.
- [ ] Step 3: Implement the smallest code change in the listed source file.
- [ ] Step 4: Run the listed command and confirm it passes.
- [ ] Step 5: Commit only the files named by the task with the listed commit message.

Use this base command for page behavior tasks:

```bash
node --test workers/quests/src/handler.test.ts
```

Use this base command for envelope tasks:

```bash
node --test bin/quine/hyphae/quests.test.ts workers/quests/src/handler.test.ts
```

Use this base command for policy tasks:

```bash
node --test bin/operator/quests/operator-policy.test.ts bin/quine/hyphae/quests.test.ts workers/quests/src/handler.test.ts
```

Use this base command for R3F drift tasks:

```bash
npm run r3f:test
```

## Task Catalog

### Foundation And Audit Contract

### Task 001: Create mini app surface contract file

**Task detail:** Files: create `workers/quests/src/mini-app-surface-contract.ts`; test `workers/quests/src/handler.test.ts`. Assert exported scene ids equal `quests,map,story,gate,commands`. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: add tg mini app surface contract`.
### Task 002: Add ecosystem target union

**Task detail:** Files: modify `workers/quests/src/mini-app-surface-contract.ts`; test `workers/quests/src/handler.test.ts`. Assert targets include `telegram`, `hermes`, `paperclip`, `cambium-worker`, `quine`, `operator-policy`, `cortex`, `r3f`, `github`, `vault-via-paperclip`, and `live-proof`. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: map mini app ecosystem targets`.
### Task 003: Add interaction kind union

**Task detail:** Files: modify `workers/quests/src/mini-app-surface-contract.ts`; test `workers/quests/src/handler.test.ts`. Assert interaction kinds equal `sheet`, `signed-action`, `chat-command`, `read-only`, and `external-proof`. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: define mini app interaction kinds`.
### Task 004: Inventory every current page section

**Task detail:** Files: modify `workers/quests/src/mini-app-surface-contract.ts`; test `workers/quests/src/handler.test.ts`. Assert section ids cover `quest-line`, `operator-map`, `story-feed`, `founder-gate`, and `command-center`. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `test: inventory mini app sections`.
### Task 005: Inventory Map subsections

**Task detail:** Files: modify `workers/quests/src/mini-app-surface-contract.ts`; test `workers/quests/src/handler.test.ts`. Assert Map subsection ids cover tapestry, wake, lanes, stance, policy, decision context, live proof, side quests, coordination, senses, stages, evidence boxes, skills, companions, and rails. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `test: inventory operator map subsections`.
### Task 006: Add stale-surface audit helper

**Task detail:** Files: modify `workers/quests/src/handler.test.ts`. Add helper `assertNoInertPseudoButtons(html: string)` that fails when `.cmd`, `.rail`, or `.beat` lacks a data interaction marker. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `test: detect inert mini app cards`.
### Task 007: Add ecosystem-source audit helper

**Task detail:** Files: modify `workers/quests/src/handler.test.ts`. Add helper `assertSheetHasSource(sheet: string, source: string)` and prove one existing Map sheet includes `source`. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `test: require sheet source provenance`.
### Task 008: Add redacted-action audit helper

**Task detail:** Files: modify `workers/quests/src/handler.test.ts`. Add helper `assertNoSecretLeak(html: string)` checking absence of `TELEGRAM_INIT_DATA=`, `TG_INIT_DATA=`, `QUESTS_PUSH_TOKEN=`, `Bearer `, and `hash=`. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `test: guard mini app secret leakage`.
### Task 009: Add screenshot manifest audit row

**Task detail:** Files: modify `workers/quests/src/visual-viewport-proof.mjs`; test `workers/quests/src/live-proof-readiness.test.ts`. Assert manifest distinguishes `layout-proof` from `clickability-proof`. Command: `node --test workers/quests/src/live-proof-readiness.test.ts`. Commit: `test: classify viewport proof intent`.
### Task 010: Document reviewed pages in execution ledger

**Task detail:** Files: modify `docs/plans/2026-06-22-tg-miniapp-visual-engine-execution.md`. Add a section listing the five scenes and stale/inert findings above. Command: `npm run render-docs:check`. Commit: `docs: record mini app stale surface review`.

### Global Navigation And Freshness

### Task 011: Add scene source labels to nav

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert each tab has `data-scene-source="tg-miniapp-scenes@v1"`. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: label mini app scene tabs`.
### Task 012: Add accessible scene titles

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert `sceneQ`, `sceneF`, `sceneS`, `sceneG`, and `sceneC` each expose `aria-labelledby`. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: add mini app scene labels`.
### Task 013: Add current-scene sheet affordance

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert tapping the active scene badge opens a sheet with scene source, ecosystem target, and refresh rule. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: add active scene provenance sheet`.
### Task 014: Explain stale freshness

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert stale chip text can open a sheet with `derivedAt`, source, stale threshold, and refresh command `quine write quests push --tenant cambium`. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: make freshness chip inspectable`.
### Task 015: Add fresh fixture

**Task detail:** Files: modify `workers/quests/src/visual-fixtures.ts`; test `workers/quests/src/handler.test.ts`. Add `FRESH_ECOSYSTEM_VISUAL_FIXTURE` with recent `derivedAt`, command data, beats, rails, and source proofs. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `test: add fresh ecosystem mini app fixture`.
### Task 016: Add stale fixture

**Task detail:** Files: modify `workers/quests/src/visual-fixtures.ts`; test `workers/quests/src/handler.test.ts`. Add `STALE_ECOSYSTEM_VISUAL_FIXTURE` with `derivedAt` older than six hours and explicit stale reasons. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `test: add stale ecosystem mini app fixture`.
### Task 017: Add offline fixture

**Task detail:** Files: modify `workers/quests/src/visual-fixtures.ts`; test `workers/quests/src/handler.test.ts`. Add `OFFLINE_ECOSYSTEM_VISUAL_FIXTURE` where commands, live proof, wake, and Paperclip are missing with explicit gaps. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `test: add offline ecosystem mini app fixture`.
### Task 018: Stop stale chip from looking ready

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert stale freshness chip uses class `stale` and sheet says `stale data is not live proof`. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `fix: separate stale freshness from readiness`.
### Task 019: Add pull-to-refresh provenance

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert pull-to-refresh state says it re-fetches `/api/quests/cambium` and does not write operator state. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: show refresh provenance`.
### Task 020: Add reduced-motion proof row

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert reduced-motion users still see scene state changes and no interaction disappears. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `test: preserve reduced motion interactions`.

### Quests Scene

### Task 021: Make quest progress summary clickable

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert tapping `#progress` opens a sheet with completed count, total count, source, and active quest id. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: inspect quest progress summary`.
### Task 022: Make frontier summary clickable

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert tapping `#here` opens a sheet with current arc, quest title, and evidence. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: inspect quest frontier summary`.
### Task 023: Add quest row ecosystem target

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert each `.q` row has `data-ecosystem-target="quine"`. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: map quest rows to quine`.
### Task 024: Add quest sheet source fields

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert quest sheet includes `source`, `status`, `arc`, `quest id`, and `evidence`. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: enrich quest detail provenance`.
### Task 025: Add quest sheet next ecosystem action

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert active quest sheet shows `next action source` from policy or explicit policy gap. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: link quest sheet to policy`.
### Task 026: Add empty ledger action clarity

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert empty ledger state shows `quine write quests push --tenant cambium` and does not render fake quest rows. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `fix: clarify empty quest ledger state`.
### Task 027: Add unreachable ledger action clarity

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert unreachable state names `/api/quests/cambium`, retry, and no local write. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `fix: clarify unreachable quest ledger state`.
### Task 028: Add quest line viewport capture

**Task detail:** Files: modify `workers/quests/src/visual-viewport-proof.mjs`; test `workers/quests/src/live-proof-readiness.test.ts`. Assert manifest includes `quests-line-mobile.png` from `?scene=quests`. Command: `node --test workers/quests/src/live-proof-readiness.test.ts`. Commit: `test: capture quests scene viewport proof`.

### Map Scene Core And Rails

### Task 029: Make map header inspectable

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert tapping `.mapbadge` opens active arc, organ, and shared visual contract source. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: inspect operator map header`.
### Task 030: Make rail rows clickable

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert each `.rail` has `data-rail` and opens a rail sheet. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: make map rails inspectable`.
### Task 031: Add rail ecosystem target

**Task detail:** Files: modify `shared/cambium-visual-contract.ts`, `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert rail sheet maps handoff, runner, and memory-feed rails to `paperclip`, `quine`, or `cortex`. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: map rails to ecosystem targets`.
### Task 032: Add rail source proof

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert rail sheet includes `shared/cambium-visual-contract.ts` as proof. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: show rail source proof`.
### Task 033: Add rail active frontier context

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert hot rail sheet identifies whether the rail touches the active organ. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: explain active rails`.
### Task 034: Add stage sheet ecosystem target

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert each stage sheet includes organ target `genesis`, `taste`, `build`, `ops`, or `cortex` plus matching source. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: map organ stages to ecosystem`.
### Task 035: Add stage sheet action hints

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert stage sheet shows read-only hints and no signed action button unless served by policy. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `fix: keep stage sheets read-only`.
### Task 036: Add stage no-row clarity

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert empty stage sheet says no quest rows mapped and names the contract source. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `fix: explain empty organ stages`.
### Task 037: Add R3F drift test for rail labels

**Task detail:** Files: modify `apps/cambium-r3f/src/scene/scene-data.test.ts`; source `shared/cambium-visual-contract.ts`. Assert all TG rail labels exist in R3F scene data. Command: `npm run r3f:test`. Commit: `test: prevent tg r3f rail drift`.
### Task 038: Regenerate R3F source contract

**Task detail:** Files: modify `apps/cambium-r3f/scripts/generate-scene-contract.mjs`, generated `apps/cambium-r3f/src/generated/source-contract.ts`. Command: `npm run r3f:test`. Commit: `chore: sync r3f ecosystem contract`.

### Map Tapestry Audit

### Task 039: Add clickability audit for every tapestry row

**Task detail:** Files: modify `workers/quests/src/handler.test.ts`. Assert `[data-tapestry]` count equals tapestry row count. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `test: cover tapestry row clickability`.
### Task 040: Add ecosystem target to tapestry rows

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert active organ maps to `r3f`, wake maps to `quine`, skill maps to `operator-policy`, Mira maps to `cortex`, command state maps to `hermes`, live proof maps to `live-proof`. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: map tapestry rows to ecosystem`.
### Task 041: Add stale source state to freshness gap row

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert freshness gap sheet shows `derivedAt`, threshold, and push command. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: explain freshness gaps`.
### Task 042: Add command-state tapestry link

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert command-state row opens the Commands source sheet when command data is missing. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: link command state tapestry row`.
### Task 043: Add live-proof tapestry link

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert live-proof tapestry row opens live-proof summary with readiness counts and blocked rows. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: link live proof tapestry row`.
### Task 044: Add decision-context tapestry link

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert decision-context tapestry row opens first missing decision context row when served count is zero. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: link decision context tapestry row`.
### Task 045: Add tapestry viewport capture

**Task detail:** Files: modify `workers/quests/src/visual-viewport-proof.mjs`; test `workers/quests/src/live-proof-readiness.test.ts`. Assert manifest keeps `map-tapestry-audit-mobile.png` and records clickability target count. Command: `node --test workers/quests/src/live-proof-readiness.test.ts`. Commit: `test: extend tapestry viewport proof`.

### Wake, Lanes, Senses, And Insight Boxes

### Task 046: Add wake sheet action mapping

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert missing wake sheet maps to side quest target `wake-proof` and quine command `quine write quests wake-event`. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: map wake gaps to quine actions`.
### Task 047: Add proved wake sheet source mapping

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert proved wake sheet shows operator wake event source and does not imply current proof came from history. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `fix: preserve wake current state provenance`.
### Task 048: Add wake event count to card labels

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert wake cards expose current status and history count in sheet, not crowded card text. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: surface wake history counts`.
### Task 049: Add lane sheet source rows

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert lane sheet includes `world.log`, count, ratio, and stance contribution. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: enrich lane sheets`.
### Task 050: Add lane gap sheet

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert missing lane sheet shows source `missing`, sample size zero, and no recommendation. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `fix: explain lane gaps`.
### Task 051: Add sense ecosystem mapping

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert signal maps to `quine`, memory maps to `cortex`, risk maps to `operator-policy`, and drift maps to `operator-policy`. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: map sense cards to ecosystem`.
### Task 052: Add sense empty-state specificity

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert memory sense empty state says `no tenant cortex rows served`, not generic unavailable. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `fix: clarify sense empty states`.
### Task 053: Add evidence box target mapping

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert evidence box sheet maps complete quest evidence to `quest-ledger-evidence@v1`. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: map evidence boxes to ledger source`.
### Task 054: Add evidence box gap action

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert no evidence box sheet names the missing insight source and avoids reward language. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `fix: explain evidence box gaps`.
### Task 055: Add durable insight source contract

**Task detail:** Files: modify `bin/quine/hyphae/quests.ts`, `workers/quests/src/handler.test.ts`. Assert insight rows can come from `operator-insights@v1` without deriving from quest rows. Command: `node --test bin/quine/hyphae/quests.test.ts workers/quests/src/handler.test.ts`. Commit: `feat: add durable insight source`.
### Task 056: Add insight source fixture

**Task detail:** Files: modify `workers/quests/src/visual-fixtures.ts`; test `workers/quests/src/handler.test.ts`. Assert fixture renders a served insight source with proof and no random reward wording. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `test: fixture durable insight source`.

### Stance, Policy, And Decision Context

### Task 057: Add stance sheet sample table

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert stance sheet includes sample size, minimum, window, dominant lane, and confidence. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: enrich stance sheet`.
### Task 058: Add stance gap action mapping

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert stance gap sheet maps to wake or world-log source instead of a recommendation. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `fix: map stance gaps without recommendations`.
### Task 059: Add policy sheet rules version

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert policy sheet includes `rulesVersion`, source, required signals, blockers, and cautions. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: show policy rules version`.
### Task 060: Add policy action target mapping

**Task detail:** Files: modify `bin/operator/quests/operator-policy.ts`, `workers/quests/src/page.ts`; test `bin/operator/quests/operator-policy.test.ts`. Assert gate review maps to `paperclip-open-items` and quest frontier maps to `quest-ledger`. Command: `node --test bin/operator/quests/operator-policy.test.ts workers/quests/src/handler.test.ts`. Commit: `feat: map policy actions to sources`.
### Task 061: Add policy blocked sheet clarity

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert blocked policy sheet says `no execution is queued from this card`. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `fix: clarify blocked policy card`.
### Task 062: Add decision context row click audit

**Task detail:** Files: modify `workers/quests/src/handler.test.ts`. Assert six decision context rows are rendered as clickable sheets. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `test: cover decision context clickability`.
### Task 063: Add decision context ecosystem mapping

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert founder preference maps to `operator-priority-source`, owner load to `paperclip-open-items`, economic risk to `project-evidence`, team availability to `operator-priority-source`, member revocation to `bridge-member-state`, and urgency to `operator-priority-signals`. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: map decision context ecosystem sources`.
### Task 064: Add decision context proof path text

**Task detail:** Files: modify `bin/quine/hyphae/quests.ts`, `workers/quests/src/page.ts`; test `bin/quine/hyphae/quests.test.ts`. Assert each row exposes the exact source path or explicit `missing`. Command: `node --test bin/quine/hyphae/quests.test.ts workers/quests/src/handler.test.ts`. Commit: `feat: expose decision context proof paths`.
### Task 065: Prevent decision context from mutating policy text

**Task detail:** Files: modify `bin/operator/quests/operator-policy.test.ts`; source `bin/operator/quests/operator-policy.ts`. Assert served decision context alone does not change policy wording. Command: `node --test bin/operator/quests/operator-policy.test.ts`. Commit: `test: decision context remains non-authoritative`.
### Task 066: Add priority source ownership sheet

**Task detail:** Files: modify `workers/quests/src/page.ts`, `docs/architecture/contracts/operator-policy-contract.md`; test `workers/quests/src/handler.test.ts`. Assert priority signal sheet names owner and proof requirements. Command: `node --test workers/quests/src/handler.test.ts && npm run render-docs:check`. Commit: `docs: explain priority source ownership`.

### Live Proof And Signed Actions

### Task 067: Add live proof summary sheet

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert live proof summary includes ready, blocked, total, liveProofReady, and invariant. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: inspect live proof summary`.
### Task 068: Add device proof ecosystem mapping

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert device WebView row maps to `telegram` and writes `docs/plans/assets/tg-miniapp-live-proof/telegram-webview.json`. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: map device proof row`.
### Task 069: Add Worker list proof mapping

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert Worker list row maps to `cambium-worker` and internal route `/internal/gate/cambium`. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: map worker list proof row`.
### Task 070: Add signed smoke proof mapping

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert signed smoke row maps to `telegram`, `cambium-worker`, and `quine`. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: map signed smoke proof row`.
### Task 071: Add live proof privacy sheet rows

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert privacy rows mention redacted hashes and do not expose raw initData. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: show live proof privacy rules`.
### Task 072: Add signed smoke action kind sheet

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert side quest, promote skill, approve, and reroll smoke phases can be listed without raw payload bodies. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: show signed smoke lifecycle`.
### Task 073: Add strict readiness blocked banner

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert liveProofReady false shows blocked banner and not `ready`. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `fix: prevent false live readiness`.
### Task 074: Add live proof viewport capture

**Task detail:** Files: modify `workers/quests/src/visual-viewport-proof.mjs`; test `workers/quests/src/live-proof-readiness.test.ts`. Assert manifest includes `map-live-proof-mobile.png`. Command: `node --test workers/quests/src/live-proof-readiness.test.ts`. Commit: `test: capture live proof viewport`.

### Side Quests And Coordination

### Task 075: Add side quest sheet ecosystem table

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert side quest sheet lists owner, action, target, lifetime, completion, trigger, origin, proof, and runtime source. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: enrich side quest sheet`.
### Task 076: Add side quest queue button provenance

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert queue button text is `Queue side quest` and sheet says registry is unchanged until operator consumes it. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: explain side quest queue behavior`.
### Task 077: Add side quest signed-action source mapping

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert queued side quest action carries evidence, consequence, reversibility, and idempotency key text. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: map side quest signed action`.
### Task 078: Add side quest runtime event filter

**Task detail:** Files: modify `bin/quine/hyphae/quests.ts`; test `bin/quine/hyphae/quests.test.ts`. Assert runtime history is tenant-scoped and cannot show another tenant's side quest events. Command: `node --test bin/quine/hyphae/quests.test.ts`. Commit: `test: isolate side quest runtime events`.
### Task 079: Add side quest overclaim regression

**Task detail:** Files: modify `workers/quests/src/handler.test.ts`; source `bin/quine/hyphae/quests.ts`. Assert mini app never renders reward, bonus, hidden quest, leaderboard, rank, or social proof from side quest rows. Command: `node --test workers/quests/src/handler.test.ts bin/quine/hyphae/quests.test.ts`. Commit: `test: prevent side quest overclaiming`.
### Task 080: Add coordination sheet owner load source

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert coordination rows name `paperclip-open-items` and scope `tenant-handoff-only`. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: enrich coordination sheets`.
### Task 081: Add active member availability row

**Task detail:** Files: modify `bin/quine/hyphae/quests.ts`, `workers/quests/src/page.ts`; test `bin/quine/hyphae/quests.test.ts`. Assert availability row is ready only from explicit source proof. Command: `node --test bin/quine/hyphae/quests.test.ts workers/quests/src/handler.test.ts`. Commit: `feat: add source-backed member availability`.
### Task 082: Add coordination gap clarity

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert coordination gap says no tenant handoff evidence served and avoids popularity language. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `fix: clarify coordination gaps`.

### Skill Labors And Promotion

### Task 083: Add full skill telemetry sheet

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert skill sheet includes status, tier, uses, success rate, recent rate, sample minimum, promotion status, and source path. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: enrich skill labor sheet`.
### Task 084: Add skill gap action mapping

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert missing skills map to `.operator/cambium.skills.json` and `quine write skills`. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: map skill gaps to operator store`.
### Task 085: Add skill promotion consequence table

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert promotion sheet includes consequence, reversibility, idempotency key, and founder approval requirement. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: explain skill promotion queue`.
### Task 086: Add production skill read-only state

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert production skills show no queue founder review button and include registry proof. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `fix: keep production skills read-only`.
### Task 087: Add declining skill caution

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert declining skills show caution and no promotion action. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: show declining skill caution`.
### Task 088: Add skill promotion viewport capture

**Task detail:** Files: modify `workers/quests/src/visual-viewport-proof.mjs`; test `workers/quests/src/live-proof-readiness.test.ts`. Assert manifest includes map and sheet captures for skill promotion. Command: `node --test workers/quests/src/live-proof-readiness.test.ts`. Commit: `test: capture skill promotion sheet proof`.

### Companions, Mira, And NPC Events

### Task 089: Add companion ecosystem mapping

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert Mira maps to `cortex` and `operator-npc-events`, founder-npc maps to `quest-ledger` and `operator-npc-events`. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: map companions to ecosystem`.
### Task 090: Add NPC history count on sheet

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert companion sheet includes event count, contradiction count, scope, and proof. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: enrich companion history sheet`.
### Task 091: Add NPC advice action mapping

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert advice action shows `review`, `collect-evidence`, or `hold` with target and proof. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: show npc advice actions`.
### Task 092: Add contradiction blocked state

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert contradiction sheet says advice is blocked by contradiction and names review target. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `fix: show npc contradiction block`.
### Task 093: Add duplicate Mira memory regression

**Task detail:** Files: modify `bin/quine/hyphae/quests.test.ts`; source `bin/quine/hyphae/quests.ts`. Assert duplicate Mira memories do not inflate confidence beyond unique event evidence. Command: `node --test bin/quine/hyphae/quests.test.ts`. Commit: `test: de duplicate mira memories`.
### Task 094: Add cross-tenant NPC leakage regression

**Task detail:** Files: modify `bin/quine/hyphae/quests.test.ts`; source `bin/quine/hyphae/quests.ts`. Assert another tenant's NPC events do not render in cambium. Command: `node --test bin/quine/hyphae/quests.test.ts workers/quests/src/handler.test.ts`. Commit: `test: prevent npc cross tenant leakage`.
### Task 095: Add companion viewport capture

**Task detail:** Files: modify `workers/quests/src/visual-viewport-proof.mjs`; test `workers/quests/src/live-proof-readiness.test.ts`. Assert manifest includes `map-companions-mobile.png`. Command: `node --test workers/quests/src/live-proof-readiness.test.ts`. Commit: `test: capture companion viewport proof`.

### Story Scene

### Task 096: Make story beats clickable

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert every `.beat` has `data-beat` and opens a story sheet. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: make story beats inspectable`.
### Task 097: Add story beat ecosystem mapping

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert heartbeat maps to `quine`, paperclip maps to `paperclip`, forge maps to `operator-skills`, noesis maps to `operator-narrative`, and quest maps to `quest-ledger`. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: map story beats to ecosystem`.
### Task 098: Add noesis beat sheet

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert noesis beat sheet includes lane, text, source, and no execution action. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: inspect noesis story beats`.
### Task 099: Add Paperclip beat sheet

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert Paperclip beat sheet includes source `paperclipActivityBeats` and no direct vault write. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: inspect paperclip story beats`.
### Task 100: Add story empty-state source

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert empty story says it falls back to complete quest rows and names `quest-ledger`. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `fix: explain story fallback source`.
### Task 101: Add narrative envelope source field

**Task detail:** Files: modify `bin/quine/hyphae/quests.ts`; test `bin/quine/hyphae/quests.test.ts`. Assert beats include source fields when produced from world log, deviations, or Paperclip. Command: `node --test bin/quine/hyphae/quests.test.ts workers/quests/src/handler.test.ts`. Commit: `feat: add narrative beat sources`.
### Task 102: Add story viewport capture

**Task detail:** Files: modify `workers/quests/src/visual-viewport-proof.mjs`; test `workers/quests/src/live-proof-readiness.test.ts`. Assert manifest includes `story-feed-mobile.png`. Command: `node --test workers/quests/src/live-proof-readiness.test.ts`. Commit: `test: capture story scene viewport`.

### Gate Scene

### Task 103: Add empty gate source sheet

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert empty gate state names `/internal/gate/cambium` and says no open items waiting. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: explain empty gate queue`.
### Task 104: Add unreachable gate source sheet

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert unreachable gate state names network failure and no local queue write. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `fix: explain gate queue unreachable`.
### Task 105: Add gate item source path

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert gate item card includes Paperclip source, owner, updatedAt, evidence, consequence, reversibility, and idempotency. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: enrich gate item provenance`.
### Task 106: Add approve action preflight sheet

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert approve preflight sheet shows action kind, subject, evidence, consequence, reversibility, and idempotency before POST. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: add approve preflight sheet`.
### Task 107: Add reroll action preflight sheet

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert reroll preflight sheet shows action kind, subject, evidence, consequence, reversibility, and idempotency before POST. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: add reroll preflight sheet`.
### Task 108: Add Telegram-auth failure sheet

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert missing initData response opens a sheet saying action must run inside Telegram. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `fix: explain telegram auth failures`.
### Task 109: Add duplicate queue result sheet

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert duplicate response says original queued action is reused and does not imply a new write. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: explain duplicate gate actions`.
### Task 110: Add gate viewport capture expansion

**Task detail:** Files: modify `workers/quests/src/visual-viewport-proof.mjs`; test `workers/quests/src/live-proof-readiness.test.ts`. Assert manifest includes gate page and approve/reroll preflight sheets. Command: `node --test workers/quests/src/live-proof-readiness.test.ts`. Commit: `test: capture gate action sheets`.

### Commands Scene

### Task 111: Make reference command cards inspectable

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert `/ts-agent`, `/ts-project`, and `/ts-vault` open sheets with chat syntax and source. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: inspect reference commands`.
### Task 112: Make chat action cards inspectable

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert `/ts-run`, `/ts-approve`, and `/ts-reject` open sheets marked `chat-command`, not mini app writes. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: inspect chat action commands`.
### Task 113: Make digest command cards inspectable

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert `/ts-standup`, `/ts-digest`, and `/ts-help` open sheets with chat usage and no signed action button. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: inspect digest commands`.
### Task 114: Add command copy-to-chat affordance

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert command sheets expose a `Copy command text` button when clipboard API is available and a read-only command text when unavailable. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: add command copy affordance`.
### Task 115: Add Telegram send-data guard

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert command copy does not call signed gate endpoint and does not invent a bot response. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `fix: keep commands as chat guidance`.
### Task 116: Add `/ts-status` live sheet source

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert status sheet names Paperclip command data and shows agents, work open, work done, arcs, and Hermes. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: enrich status command sheet`.
### Task 117: Add `/ts-hermes` live sheet source

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert Hermes sheet names Hermes runtime and service statuses. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: enrich hermes command sheet`.
### Task 118: Add `/ts-agents` live sheet source

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert agents sheet lists model and source `paperclipCommandsData`. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: enrich agents command sheet`.
### Task 119: Add `/ts-projects` live sheet source

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert projects sheet shows id, status, title, owner, and source. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: enrich projects command sheet`.
### Task 120: Add `/ts-handoffs` live sheet source

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert handoffs sheet shows id, status, title, source, and gate relation. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `feat: enrich handoffs command sheet`.
### Task 121: Add unavailable command sheet

**Task detail:** Files: modify `workers/quests/src/page.ts`; test `workers/quests/src/handler.test.ts`. Assert command unavailable sheet names Paperclip gateway unreachable and suggests pull-to-refresh only. Command: `node --test workers/quests/src/handler.test.ts`. Commit: `fix: explain unavailable command data`.
### Task 122: Add command viewport capture

**Task detail:** Files: modify `workers/quests/src/visual-viewport-proof.mjs`; test `workers/quests/src/live-proof-readiness.test.ts`. Assert manifest includes `commands-mobile.png` and one command sheet capture. Command: `node --test workers/quests/src/live-proof-readiness.test.ts`. Commit: `test: capture commands scene viewport`.

### Source Ownership, Docs, And Release Proof

### Task 123: Add ecosystem contract doc

**Task detail:** Files: create `docs/architecture/contracts/tg-miniapp-ecosystem-contract.md`; test `npm run render-docs:check`. Document scene ownership, targets, interaction kinds, and no-fake-progress rules. Command: `npm run render-docs:check`. Commit: `docs: add tg mini app ecosystem contract`.
### Task 124: Add contract link from visual execution ledger

**Task detail:** Files: modify `docs/plans/2026-06-22-tg-miniapp-visual-engine-execution.md`; test `npm run render-docs:check`. Add link to ecosystem contract and reviewed stale surfaces. Command: `npm run render-docs:check`. Commit: `docs: link tg ecosystem contract`.
### Task 125: Add viewport README clickability matrix

**Task detail:** Files: modify `docs/plans/assets/tg-miniapp-viewport-proof/README.md`; test `npm run render-docs:check`. List screenshots by scene, fixture, and clickability proof status. Command: `npm run render-docs:check`. Commit: `docs: document viewport clickability matrix`.
### Task 126: Add proof manifest schema check

**Task detail:** Files: modify `workers/quests/src/live-proof-readiness.test.ts`, `workers/quests/src/visual-viewport-proof.mjs`. Assert proof manifest includes scene, sheet selector, click target count, browser mode, and invariant. Command: `node --test workers/quests/src/live-proof-readiness.test.ts`. Commit: `test: validate viewport manifest schema`.
### Task 127: Regenerate all viewport proofs

**Task detail:** Files: update `docs/plans/assets/tg-miniapp-viewport-proof/*`; source `workers/quests/src/visual-viewport-proof.mjs`. Command: `npm run proof:tg-viewport`. Expected: manifest contains Quests, Map, Story, Gate, Commands, rails sheet, story sheet, command sheet, skill sheet, live proof sheet, and gate action sheet captures. Commit: `test: refresh tg mini app viewport proofs`.
### Task 128: Run live readiness non-strict

**Task detail:** Files: update `docs/plans/assets/tg-miniapp-live-proof/readiness.json`; source `workers/quests/src/live-proof-readiness.mjs`. Command: `npm run proof:tg-live-readiness`. Expected: liveProofReady remains false unless real Telegram proof exists; no raw secrets in JSON. Commit: `test: refresh tg live readiness`.
### Task 129: Run full local gate

**Task detail:** Files: no code change unless failures are fixed in their owning files. Command: `npm test && npm run render-docs:check && npm run r3f:test && npm run r3f:build`. Expected: all pass. Commit: `test: pass tg ecosystem clickability gates` only if fixes were needed after Task 128.
### Task 130: Prepare release evidence block

**Task detail:** Files: modify `docs/plans/2026-06-22-tg-miniapp-visual-engine-execution.md`; test `npm run render-docs:check`. Add evidence paths, commands run, stale rows fixed, remaining live Telegram blockers, and deploy decision. Command: `npm run render-docs:check`. Commit: `docs: record tg ecosystem clickability evidence`.

## Execution Order

1. Tasks 001-010: create the audit contract before touching behavior.
2. Tasks 011-020: make global navigation and freshness inspectable.
3. Tasks 021-028: close Quests scene inert surfaces.
4. Tasks 029-045: close Map core and rail inert surfaces.
5. Tasks 046-066: make Map evidence sections source-backed and inspectable.
6. Tasks 067-074: harden live proof surfaces without claiming live readiness.
7. Tasks 075-095: harden side quests, coordination, skills, and companions.
8. Tasks 096-122: close Story, Gate, and Commands inert surfaces.
9. Tasks 123-130: docs, viewport proofs, readiness, full gates, and release evidence.

## Self-Review

- Spec coverage: all five mini app pages are covered; stale freshness, stale proof, non-clickable commands, non-clickable story beats, non-clickable rails, missing decision signals, missing command data, missing wake evidence, missing skill telemetry, missing Mira/NPC evidence, and live-proof blockers each have implementation tasks.
- Placeholder scan: this plan contains no forbidden placeholder tokens, no generic error-handling task, and no task that says to write tests without naming the exact test file and command.
- Type consistency: interaction kinds are consistently `sheet`, `signed-action`, `chat-command`, `read-only`, and `external-proof`; ecosystem targets are consistently named in Task 002 and reused by later tasks.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-23-tg-miniapp-ecosystem-clickability.md`. Two execution options:

**1. Subagent-Driven (recommended)** - dispatch a fresh subagent per task group, review between groups, fast iteration.

**2. Inline Execution** - execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
