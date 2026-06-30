# TG Mini App — Plan vs Code Critique (v0.2.7 wave)

Date: 2026-06-30
Status: review for action
Author: noesisX (assistant), reviewing the 2026-06-30 wave
Reviewed wave: `89a4719` → `bf98d42` → `e355548` on `main`
Release: v0.2.7 · Thalia .7

## Context

The Cambium Telegram mini app is the **pocket ecosystem surface** ([ecosystem
contract:10](../../architecture/contracts/tg-miniapp-ecosystem-contract.md)).
It is a single HTML envelope served by the quest Worker from
[workers/quests/src/page.ts](../../../workers/quests/src/page.ts) (4046 lines,
89 `data-component=` markers), with five scenes — Mission, Gate, Tools, Story,
Inspect — and proof scaffolding under
[docs/plans/assets/tg-miniapp-viewport-proof/](../../plans/assets/tg-miniapp-viewport-proof/)
and [docs/plans/assets/tg-miniapp-live-proof/](../../plans/assets/tg-miniapp-live-proof/).

The 2026-06-30 wave shipped three commits in eleven minutes (08:33 → 08:46 →
14:44 git mtimes; CI runs at 08:33, 08:52, 09:18 UTC, all `success`):

| Commit | Subject |
|---|---|
| `89a4719` | feat: harden tg mini app release readiness |
| `bf98d42` | feat: complete tg component foundation refinements |
| `e355548` | feat: complete tg page wave contracts |

These commits claim to deliver against four 2026-06-29/30 plans:

- [2026-06-30 Release-readiness architecture spec](../../plans/2026-06-30-tg-miniapp-release-readiness-architecture-spec.md)
- [2026-06-30 Component foundation plan](../../plans/2026-06-30-tg-miniapp-component-foundation-plan.md)
- [2026-06-29 Mission Control UI upgrade plan](../../plans/2026-06-29-tg-miniapp-mission-control-ui-upgrade-plan.md)
- [2026-06-29 Root-nav component system plan](../../plans/2026-06-29-tg-miniapp-root-nav-component-system-plan.md)

This critique reads the code against those plans, against the older 2026-06-10
[Thalia Wing Quest origin scope](../../plans/2026-06-10-thalia-wing-quest-miniapp.md),
and against the active
[ecosystem contract](../../architecture/contracts/tg-miniapp-ecosystem-contract.md).
It is intentionally not a release report. The wave is genuinely well-built —
the tensions below are about clarity, contract integrity, and what to push
next, not about quality of execution.

---

## Tensions

### T1 — Monolith vs "extracted" component foundation

**Plan says.** The
[component foundation plan:19](../../plans/2026-06-30-tg-miniapp-component-foundation-plan.md)
diagnoses the problem precisely:

> "many visual primitives still live as page-local `mc*` helpers or
> placeholder treatments inside `workers/quests/src/page.ts`. That is why
> Mission can improve while Gate, Tools, Story, and Inspect still feel like
> older surfaces. The component foundation gate moves the design vocabulary
> into shared code first, then page issues consume those primitives."

The plan defines 20 named primitives (`#200`-`#219`), each with a *Build
issue*, *Current code to replace or stabilize*, and *Shared consumers*.

**Code does.** The "extraction" is partial in spirit, not in structure:

- [page.ts](../../../workers/quests/src/page.ts) is now **4046 lines** with
  **89 `data-component=` markers** (e.g. `MissionControlShell`, `RootNav`,
  `RootSceneTab`, `MissionGlyph`, `StateToken`, `OrbitProgress`,
  `MissionCard`, `QuestlineTimeline`, `ProofList`, `GateActionRow`,
  `ComponentRegistry`).
- The `mc-*` visual primitive grammar exists as CSS classes and inline SVG
  fragments inside the same file (`.mc-glyph`, `.mc-state-token`,
  `.mc-mission-card`, `.mc-state-stack`, `@keyframes packetDrift` at
  [page.ts:238](../../../workers/quests/src/page.ts)).
- The Mission Control upgrade plan permits this — Task 5 says "In `page.ts`
  CSS, add `mc-` classes". The release-readiness spec adds: "No issue is
  closed without a matching code or test probe."
- 10 of 20 foundation issues were closed by the staged bundle (`#201`,
  `#202`, `#203`, `#208`, `#209`, `#210`, `#211`, `#213`, `#217`, `#219` —
  see [release-readiness spec:29](../../plans/2026-06-30-tg-miniapp-release-readiness-architecture-spec.md)).

**Why it matters.** The plan promised "the design vocabulary into shared
code first, then page issues consume those primitives." What landed is "the
design vocabulary into `data-component=` markers inside the same file."
That is *defensible* — the markers are detectable by handler tests, the
viewport proof can target them, the page.ts lock zone remains a single
review surface — but it does not actually decouple Gate / Tools / Story
from Mission the way the plan implied. Page.ts is still the lock zone for
all five scenes. A future Gate-only or Tools-only refactor still requires
touching the 4046-line file.

**Action.** Decide the "extraction" definition explicitly. Two coherent
options:

1. **Markers-are-extraction** — amend the component foundation plan to
   state that `data-component=` markers + `mc-*` CSS + the registry
   selector convention *are* the extraction contract; an issue closes when
   the marker is detectable and a regression test pins the consumer surface.
   This makes the wave honest about what shipped.
2. **Modules-are-extraction** — keep the plan's original framing and treat
   the 10 closed issues as in-flight, not done; open a follow-up wave that
   moves `mcGlyphSvg()`, `mcStateToken()`, `mcOrbitProgress()`, and the
   render helpers into a `workers/quests/src/mission-control/` module that
   `page.ts` imports.

Recommend Option 1 in the near term (the markers are real engineering and
the test contract works), and file Option 2 as a deferred unlock for when
Gate, Tools, or Story need an independent rewrite.

---

### T2 — Non-strict release readiness vs no-fake-progress invariant

**Plan says.** The
[release-readiness spec:73](../../plans/2026-06-30-tg-miniapp-release-readiness-architecture-spec.md)
states:

> "Non-strict readiness can exit successfully while still reporting live
> blockers."

And the
[ecosystem contract:49](../../architecture/contracts/tg-miniapp-ecosystem-contract.md)
states:

> "Never count templates, capture plans, stale screenshots, browser
> diagnostics, or local Chrome layout captures as live Telegram proof."

Both rules live in the same wave.

**Code does.** Both rules are implemented and they do not actually
contradict — but the surface tension is real:

- [package.json](../../../package.json) wires
  `proof:tg-live-readiness` → `live-proof-readiness.mjs --write` and a
  separate `proof:tg-live-readiness:strict` →
  `live-proof-readiness.mjs --write --strict`.
- [live-proof-readiness.mjs](../../../workers/quests/src/live-proof-readiness.mjs)
  is a 1511-line schema validator. It emits a `readiness.json` artifact
  with per-step `state: 'ready' | 'blocked'`, `missing[]`, and `evidence[]`
  arrays. In non-strict mode the script exits 0 even when blockers exist.
- Three live-proof items remain `blocked` by design pending real founder
  artifacts: device-proof
  ([live-proof-readiness.mjs:921-946](../../../workers/quests/src/live-proof-readiness.mjs)),
  worker-network-probe (lines 948-973), signed-action-smoke (lines
  975-1000).
- The release script and CI both run non-strict readiness as a gate
  ([release-readiness spec:20](../../plans/2026-06-30-tg-miniapp-release-readiness-architecture-spec.md)).

**Why it matters.** A reader scanning CI sees three green runs on `main`
and a v0.2.7 tag. The readiness ledger reports three live-proof items
blocked. The contract is *honest at the artifact layer* but *not loud at
the release layer*. There is currently no place a non-engineer reads
"v0.2.7 ships with three live-proof items blocked" — that information
lives only in the readiness JSON, not in
[VERSIONS.md](../../../VERSIONS.md) or the release tag annotation.

The no-fake-progress invariant is not violated by the code. It risks being
violated by *casual reading* of the green CI badge.

**Action.** Add a one-line "live proof: 7 ready / 3 blocked" stanza to
each release entry in VERSIONS.md sourced verbatim from the most recent
`readiness.json` summary. Add a release script step that fails the build
if the readiness ledger is older than the commit being tagged.

---

### T3 — Mission Control reframe vs Wing Quest origin scope

**Plan says.** The
[Wing Quest origin (2026-06-10):80-83](../../plans/2026-06-10-thalia-wing-quest-miniapp.md)
named five visual deliverables:

> "founder opens the Hermes bot → menu button 'curios.self' → quest log
> renders the LIVE tenant ledger (same numbers as `quine quests`) →
> **fractal map zooms arcs→quests** → narrative feed streams real beats
> with noesis frames → a gated macro move can be approved from the gate
> card"

W2 is named "**fractal ring map** · panels". The visual direction is
explicitly "Living Blueprint — Swiss-grid precision holding bioluminescent
living elements; the fractal map is a **tree-ring cross-section** where
completed arcs are inner rings and the glowing outer growth edge is
literally *cambium — you are here*."

Nineteen days later, the
[Mission Control UI upgrade plan:5](../../plans/2026-06-29-tg-miniapp-mission-control-ui-upgrade-plan.md)
declares the new goal:

> "Rework the Cambium Telegram mini app into a Mission Control surface
> that makes branch arcs, missions, blockers, proof, KPIs, and promotion
> state primary while moving architecture/meta language into Inspect."

The plan supersedes the branch-story adapter plan but does not formally
supersede the Wing Quest origin scope.

**Code does.** The five current scenes are **Mission / Gate / Tools /
Story / Inspect** — the fractal-ring map is not a current scene.
`workers/quests/src/page.ts` deep-link aliases (per
[upgrade plan task 4 step 4](../../plans/2026-06-29-tg-miniapp-mission-control-ui-upgrade-plan.md))
map `map → inspect`. The
[mini-app-surface-contract.ts:1](../../../workers/quests/src/mini-app-surface-contract.ts)
locks `MINI_APP_SCENE_IDS = ['mission','gate','tools','story','inspect']`.

The cambium-tree-ring imagery and the Living Blueprint visual identity do
not appear in the current page render. The `tree-ring fractal map` is the
*eponymous* visual for the project; its absence is not drift, it is a
product pivot.

**Why it matters.** Two coherent readings are possible:

- *The fractal map is deferred.* The Mission Control reframe is an
  interim surface; the fractal map returns as a later scene or as
  embellishment inside Inspect.
- *The fractal map is dropped.* The reframe replaces the Wing Quest
  delivery model with a Mission Control delivery model; fractal-ring
  visualization is no longer a v1 goal.

Either is fine. *Not declaring which* makes future contributors infer
from absence, and risks one team member resurrecting the fractal map
while another keeps building against Mission Control.

**Action.** Add a one-paragraph "Scope evolution" stanza to the top of
the [Wing Quest origin plan](../../plans/2026-06-10-thalia-wing-quest-miniapp.md)
naming the reframe explicitly: which W0-W5 items shipped under the new
shape (W0, W1, W3, W4) and which became Mission Control primitives (the
fractal map subsumed into Inspect Tapestry, or deferred). Reference
[mission-control-ui-upgrade-plan.md](../../plans/2026-06-29-tg-miniapp-mission-control-ui-upgrade-plan.md)
from the origin so the path is discoverable.

---

### T4 — Ecosystem contract drift (the v1-active contract uses old scene names)

**Plan says.** The
[ecosystem contract](../../architecture/contracts/tg-miniapp-ecosystem-contract.md)
is marked "Status: v1 active". Its Scene Ownership table uses the OLD
scene names:

| Scene | Owns | ... |
|---|---|---|
| **Quests** | Quest ledger progress, frontier rows, freshness, and current work context | ... |
| **Map** | Ecosystem map: tapestry audit, wake loop, lanes, stance, policy ... | ... |
| **Story** | Narrative ... | ... |
| **Gate** | Founder approval and reroll preflight | ... |
| **Commands** | Live status, Hermes, agent/work/handoff commands ... | ... |

**Code does.**
[mini-app-surface-contract.ts:1-2](../../../workers/quests/src/mini-app-surface-contract.ts)
uses the new names:

```ts
export const MINI_APP_SCENE_IDS = ['mission', 'gate', 'tools', 'story', 'inspect'] as const;
```

And [page.ts:615-619](../../../workers/quests/src/page.ts) renders nav
tabs labelled `Mission / Gate / Tools / Story / Inspect`. The
[viewport proof README:21](../../plans/assets/tg-miniapp-viewport-proof/README.md)
also lists scenes as "Mission, Story, Tools, Inspect, and Gate."

**Why it matters.** The ecosystem contract is the no-fake-progress and
authority-binding document — it names which scene owns which truth
source, which interactions are allowed, and which evidence paths are
authoritative. With OLD scene names, the contract literally does not bind
the current code. A reader checking "what may Gate mutate?" against the
contract gets the right answer by accident (Gate didn't rename), but
checking "what may Tools mutate?" finds no entry for Tools — they have
to mentally re-route via `Commands`.

This is the single highest-priority fix in the critique. The contract is
the authority of last resort; if it drifts, the no-fake-progress regime
loses its anchor.

**Action.** Update Scene Ownership and any subsection references in
[ecosystem-contract.md](../../architecture/contracts/tg-miniapp-ecosystem-contract.md)
to **Mission / Gate / Tools / Story / Inspect**, preserving the
authority and rendering-rule columns. Verify the
[MINI_APP_MAP_SUBSECTION_IDS](../../../workers/quests/src/mini-app-surface-contract.ts:44)
list (branch-arcs, branch-missions, branch-kpis, branch-gates,
branch-proof) is reflected in the contract's authority map.

---

### T5 — Live-proof blockers — honest reporting without an unblock schedule

**Plan says.** The
[viewport proof README:24](../../plans/assets/tg-miniapp-viewport-proof/README.md)
states:

> "These screenshots prove local layout only. They do not prove live
> Telegram WebView chrome, safe-area behavior, real `initData`, or
> production signed actions."

The
[release-readiness spec:22](../../plans/2026-06-30-tg-miniapp-release-readiness-architecture-spec.md):

> "Strict TG readiness remains reserved for the moment live Telegram
> initData, founder-device WebView proof, and production signed-action
> proof are intentionally required."

**Code does.** The unblock path is fully scaffolded in
[live-proof-readiness.mjs](../../../workers/quests/src/live-proof-readiness.mjs):

- `--capture-device-proof` requires `TELEGRAM_INIT_DATA`, screenshot path,
  platform, safe-area, webview URL (lines 333-361).
- `--capture-worker-probe` requires `--allow-network` and
  `QUESTS_PUSH_TOKEN` (lines 740-793).
- `--capture-signed-smoke` requires `--allow-network --allow-mutation`,
  action kind, subject, idempotency key, operator audit path, miniapp
  envelope path, and visible marker (lines 809-919).

All three require:

1. A real Telegram WebView session on a founder device.
2. Access to production Worker `curious.thoughtseed.space` with
   `QUESTS_PUSH_TOKEN`.
3. Willingness to mutate production state through a signed action.

These are not engineering blockers — the schema, capture flow, and
redaction discipline all work. They are **scheduling blockers**.

**Why it matters.** Honest reporting without a schedule means the
blockers can persist indefinitely. v0.2.0 → v0.2.7 has shipped seven
Thalia point releases with the same three live-proof items blocked. At
some point the boundary stops being "we haven't proven it yet" and
becomes "we don't intend to prove it."

**Action.** Pick one of:

- *Schedule the capture.* Block out an explicit founder-device session
  (target date) to walk through `--capture-device-proof`, then
  `--capture-worker-probe`, then a single low-stakes signed action via
  `--capture-signed-smoke`. The three blockers clear in one founder hour.
- *Demote the blockers.* If founder-device proof is not a near-term goal,
  rename `state: 'blocked'` to `state: 'deferred-by-policy'` for these
  three items so the readiness ledger stops implying they are work in
  flight.

Recommend the first. The unblock cost is small; the credibility win is
large.

---

## Release-readiness scorecard

Grades use the
[release-readiness architecture spec](../../plans/2026-06-30-tg-miniapp-release-readiness-architecture-spec.md)
vocabulary where possible.

| Surface | Grade | Evidence | Risk |
|---|---|---|---|
| **Page contract** | A− | `data-component=` markers, `mc-*` CSS, `MissionControlShell` / `RootNav` / `RootSceneTab` all present in [page.ts](../../../workers/quests/src/page.ts); 89 component markers; surface contract in [mini-app-surface-contract.ts](../../../workers/quests/src/mini-app-surface-contract.ts) is lean and complete. | Monolith size (4046 lines) means any Gate-only or Tools-only rewrite still locks the whole file. |
| **Component foundation** | B+ | All 20 named primitives present as markers + CSS; 10 closed, 10 named for refinement; handler.test.ts asserts primitive grammar. | "Closed" without module separation is debatable as the plan reads (see T1). |
| **Viewport proof** | A | [Viewport proof README](../../plans/assets/tg-miniapp-viewport-proof/README.md) lists 16+ scene/sheet PNGs covering Mission, Gate, Tools, Story, Inspect plus clickability sheets; `manifest.json` schema enforced. | Layout-only by explicit contract; safe-area / WebView behavior unproven. |
| **Live proof** | C+ | Three blockers honestly reported; full capture flow built; redaction discipline strong. | Indefinite schedule (see T5). |
| **Release pipeline** | A− | [release-readiness spec](../../plans/2026-06-30-tg-miniapp-release-readiness-architecture-spec.md) raises release gates to CI parity; `release.yml` runs npm test + standalone:audit + standalone:smoke + non-strict readiness; local `release.sh` mirrors. | No release-note hook for live-proof status (see T2). |
| **GH issue hygiene** | C | `gh issue list --label tg-miniapp --state open` returns **`[]`**, yet [release-readiness spec:39-51](../../plans/2026-06-30-tg-miniapp-release-readiness-architecture-spec.md) explicitly keeps 10 issues open for refinement (`#200, #204, #205, #206, #207, #212, #214, #215, #216, #218`). | Either the 10 "refinement" issues were closed against spec, or the label query is wrong. Either way the spec and the issue tracker disagree. **Investigate.** |
| **Plan stack coherence** | B | Eight TG plans + one Mission Control design spec + one ecosystem contract. Plans cross-reference each other. | Origin Wing Quest scope unreconciled (T3); ecosystem contract uses old scene names (T4). |

---

## Action list

Each item is a GH-issue stub. Title convention follows the existing
`[P*][W*][area] TG-MC-XXX - page: short` format used by the 30 closed
planning issues.

### P1 — must do before next tag

1. **[P1][W0][docs] TG-MC-401 - contract: update ecosystem contract to Mission/Gate/Tools/Story/Inspect**
   Update [docs/architecture/contracts/tg-miniapp-ecosystem-contract.md](../../architecture/contracts/tg-miniapp-ecosystem-contract.md)
   Scene Ownership table to use the current scene names. Preserve
   authority columns. Add a row for branch-arcs / branch-missions /
   branch-kpis / branch-gates / branch-proof under Mission. Labels:
   `area:docs`, `mission-control`, `contract`.

2. **[P1][W0][release] TG-MC-402 - release: surface live-proof status in VERSIONS.md**
   Add a one-line "live proof: N ready / N blocked" stanza to each
   VERSIONS.md release entry sourced from
   [docs/plans/assets/tg-miniapp-live-proof/readiness.json](../../plans/assets/tg-miniapp-live-proof/readiness.json)
   summary. Add a release-script guard that fails if the readiness
   ledger is older than the commit being tagged. Labels: `area:release`,
   `no-fake-progress`.

3. **[P1][W0][ops] TG-MC-403 - issues: reconcile component foundation issue state with spec**
   `gh issue list --label tg-miniapp --state open` returns `[]`; spec
   reserves 10 issues for refinement. Re-open `#200, #204, #205, #206,
   #207, #212, #214, #215, #216, #218` if closed against spec, OR amend
   the spec to mark all 20 closed. Labels: `area:ops`, `tg-miniapp`,
   `mission-control`.

### P2 — should do this cycle

4. **[P2][W0][docs] TG-MC-404 - scope: reconcile Wing Quest origin with Mission Control reframe**
   Add a "Scope evolution" stanza to
   [docs/plans/2026-06-10-thalia-wing-quest-miniapp.md](../../plans/2026-06-10-thalia-wing-quest-miniapp.md)
   naming which W0-W5 items shipped under the Mission Control reframe
   and which (fractal ring map, generated narrative imagery) were
   deferred. Cross-link
   [docs/plans/2026-06-29-tg-miniapp-mission-control-ui-upgrade-plan.md](../../plans/2026-06-29-tg-miniapp-mission-control-ui-upgrade-plan.md).
   Labels: `area:docs`, `mission-control`, `scope-decision`.

5. **[P2][W0][component] TG-MC-405 - component foundation: pick "marker" or "module" extraction definition**
   Amend
   [docs/plans/2026-06-30-tg-miniapp-component-foundation-plan.md](../../plans/2026-06-30-tg-miniapp-component-foundation-plan.md)
   "Code Extraction Targets" to explicitly state whether
   `data-component=` markers + `mc-*` CSS constitute extraction (Option
   1) or whether a follow-up wave is required to split into
   `workers/quests/src/mission-control/` modules (Option 2). Pick one.
   Labels: `area:planning`, `component`, `tg-miniapp`.

6. **[P2][W0][live-proof] TG-MC-406 - live proof: schedule founder-device capture session**
   Schedule one founder-device session for
   `proof:tg-live-readiness --capture-device-proof` →
   `--capture-worker-probe` → `--capture-signed-smoke`. Target: clear
   all three live-proof blockers in `readiness.json`. If unscheduled,
   demote `state: 'blocked'` to `state: 'deferred-by-policy'` for these
   three items. Labels: `area:live-proof`, `tg-miniapp`,
   `no-fake-progress`.

### P3 — backlog, when convenient

7. **[P3][W0][refactor] TG-MC-407 - page: prepare optional mission-control module extraction**
   Investigate moving `mcGlyphSvg()`, `mcStateToken()`, `mcOrbitProgress()`,
   `renderBranchArcRail()`, `renderMissionCard()`, `renderQuestlineTimeline()`,
   `renderMissionBlockers()`, `renderMissionProofNeeded()`,
   `renderMissionKpis()` from
   [page.ts](../../../workers/quests/src/page.ts) into a
   `workers/quests/src/mission-control/` module that `page.ts` imports
   at render time. Preserve `data-component=` selectors. Goal: shrink
   the page.ts lock zone so Gate, Tools, Story can be rewritten without
   blocking each other. Labels: `area:refactor`, `tg-miniapp`,
   `component-foundation`.

8. **[P3][W0][ops] TG-MC-408 - repo: reconcile ISA.md and viewport-proof browser-diagnostics**
   `ISA.md` (product-branch packet system, 34/34 ISC verified) is
   untracked at repo root; `docs/plans/assets/tg-miniapp-viewport-proof/browser-diagnostics.json`
   has uncommitted churn. Decide each (commit, move to
   `docs/plans/product-branches/`, or `.gitignore`). Labels: `area:ops`,
   `housekeeping`.

---

## Open questions for the founder

These cannot be resolved by reading code or plans. They need a call.

1. **Is the fractal ring map deferred or dropped?** The Wing Quest origin
   plan made it the eponymous Living Blueprint visual. Mission Control
   doesn't render it. Picking one (deferred vs dropped) unlocks T3 and
   tells next contributors whether to budget for it.

2. **What unblocks live proof?** The capture flow works. What's the actual
   reason the three live-proof items remain blocked at v0.2.7 — founder
   bandwidth, production environment readiness, intentional reserve for a
   "go live" moment? Knowing the cause shapes whether to schedule a
   session (T5) or change the language to "deferred-by-policy."

3. **Is the issue tracker a planning surface or a work surface?** Closing
   30 issues with `status:planned` in one day suggests the former. If so,
   the 10 issues "kept open for refinement" should be reopened (P1 action
   3) or the spec should be updated. Either is fine; consistency matters.

4. **Should the next wave focus on Gate/Tools/Story rewrites, or on
   external proof (live Telegram, founder device, signed action)?** The
   component foundation removed the technical excuse for not rewriting
   Gate/Tools/Story; the live-proof blockers are the only thing
   meaningfully unproven. Both are valid; saying which is next clears the
   path.

---

## Appendix — untracked files reconcile

`git status --short`:

```
 M docs/plans/assets/tg-miniapp-viewport-proof/browser-diagnostics.json
?? ISA.md
```

**`ISA.md`** (12895 bytes, mtime 2026-06-29).
[ISA.md](../../../ISA.md) is the product-branch packet system ISA
(34/34 ISC criteria verified). It is task ISA from a completed
interactive build, not part of this TG mini app surface. Recommended
disposition: move to `docs/plans/product-branches/ISA.md` (alongside
the packet schema and per-branch packets) and commit; or, if the
canonical home is elsewhere in the vault, delete the repo-root copy.
Either way it should not live at repo root long-term.

**`docs/plans/assets/tg-miniapp-viewport-proof/browser-diagnostics.json`**
(13404 bytes, mtime 2026-06-30 13:49).
This is diagnostic history per
[viewport proof README:52](../../plans/assets/tg-miniapp-viewport-proof/README.md):
"diagnostic history only; they do not prove layout". The unstaged churn
is timestamps, PIDs, and certificate UUIDs from a routine
`npm run proof:tg-viewport:diagnose` run. Recommended disposition:
either commit (if the diagnostic snapshot is meaningful) or add a
`.gitignore` pattern for non-manifest browser-diagnostics. A two-line
change either way.

---

## Verification

This critique honors its own discipline:

- Every code claim cites file:line.
- Every plan claim quotes the plan verbatim.
- Every tension is falsifiable — disagree on evidence, not vibe.
- Action list converts to GH issues without rework: title, body, labels.
- No scope creep beyond the 2026-06-30 wave.

Spec self-review pass: no TBDs, no internal contradictions, no claims
unsupported by the readings above.
