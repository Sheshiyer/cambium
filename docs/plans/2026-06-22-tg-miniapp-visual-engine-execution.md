# TG mini app visual engine execution ledger

Status: active execution
Date: 2026-06-22
Surface: `workers/quests/src/page.ts`

## Intent

Make the Telegram mini app Cambium's pocket visual map for the whole infinite-game engine: a lightweight, evidence-backed operating surface that carries the R3F organs, wake loop, cortex senses, gates, memory, relationships, and handoffs without copying the heavy 3D scene.

## Execution rule

The mini app may visualize only one of two things:

1. Real engine evidence already present in the served envelope, quest ledger, command data, gate queue, or bridge state.
2. An explicit gap state that names the missing signal.

It must not invent progress, rewards, wake events, NPC affinity, founder stance, or social proof.

## 2026-06-23 ecosystem clickability review

The reviewed top-level mini app scenes are:

- `Quests`: quest ledger rows open detail sheets today, while the progress header, current frontier summary, and freshness chip still need explicit source/provenance affordances in the next slice.
- `Map`: the operator map is the main ecosystem surface; tapestry, wake, lanes, stance, policy, decision context, live proof, side quests, coordination, senses, stages, evidence boxes, skill labors, and companions already have sheet-backed card patterns, while packet rails remain read-only until the rail behavior tasks.
- `Story`: story beats are card-like but read-only, so narrative, noesis, Paperclip, and forge events need explicit inspection behavior before they can be treated as clickable.
- `Gate`: approve and reroll are real Telegram-signed actions, but empty, unreachable, duplicate, and post-queue states must keep naming their Worker and policy provenance.
- `Commands`: live status, Hermes, agents, work, and handoff cards open sheets; reference commands, chat actions, and digest commands stay read-only/chat-command rows rather than inert pseudo-buttons.

Stale or weakly-mapped findings from this audit: stale freshness must not imply live proof, fixture-derived screenshots must remain layout evidence only, capture plans are not proof, read-only rows need visible interaction/provenance markers, and no row may claim readiness from templates, stale screenshots, diagnostics, or missing ecosystem data.

## Slice shipped first

The first implementation slice extends the existing Operator Map with:

- Today wake evidence derived from the current ledger envelope.
- Sense filters for signal, memory, risk, and drift.
- Evidence boxes derived from complete or active quest rows.
- Gap states such as `awaiting signal` and `explicit gap` when the envelope does not yet contain the required proof.

This intentionally turns missing telemetry into visible product information, so feature execution reveals what data contracts still need to exist.

## Slice shipped second

The second implementation slice extracts `shared/cambium-visual-contract.ts` as the shared vocabulary for:

- Organ stages: Genesis, Taste, Build, Ops, Cortex.
- Rails: handoff, runner, and memory-feed paths.
- Wake steps: ingest, route, act, viability, learn, persist.
- Senses: signal, memory, risk, drift.

The Telegram mini app now serializes this contract into its inline script, and R3F tests compare scene nodes and rails against the same source. This does not yet make R3F import the contract at runtime; it creates an executable drift alarm without perturbing the active visual engine bundle.

## Slice shipped third

The third implementation slice extends the pushed quest envelope with optional, fail-soft visual sections:

- `wake`: per-step proof/gap state derived from the quest ledger envelope.
- `lanes`: micro, meso, macro, and noesis counts parsed from `world.log`.
- `skills`: top forge telemetry rows from `.operator/<tenant>.skills.json`.
- `npc`: explicit relationship gaps, plus inherited founder progress when present.

The Telegram mini app now consumes these sections when present and keeps an honest fallback when old envelopes do not include them. Skill Labors and Companions are therefore visible as lightweight cards, but they still refuse to imply mastery or relationship state without telemetry.

## Slice shipped fourth

The fourth implementation slice covers stale/partial envelope behavior and the Gate chamber edge cases:

- The worker accepts stale or partial visual envelopes verbatim, without inventing absent `skills` or `npc` sections.
- The mini app has explicit guards for served wake data, missing lanes, missing skills, missing NPC relationship state, and stale `derivedAt`.
- Gate cards now preview evidence, approve/reroll consequences, reversibility, and idempotency keys before the founder taps.
- Gate actions now carry `evidence`, `consequence`, `reversibility`, and `idempotencyKey`, and duplicate queued taps return the original queued action instead of creating another one.

The gap exposed by this slice is upstream quality: Paperclip/open-item payloads do not yet guarantee rich evidence or consequence fields, so the mini app must still show "evidence missing from handoff" when that proof is not served.

## Slice shipped fifth

The fifth implementation slice adds a reusable no-fake-progress visual fixture and enriches upstream handoff payloads:

- `NO_FAKE_PROGRESS_VISUAL_FIXTURE` is a full 17-arc empty-garden envelope with zero completion, missing wake signals, zero lane counts, missing skills, and missing NPC relationships.
- The worker test now executes the mini app's inline script in a fake DOM and proves that this fixture renders explicit gaps, stale freshness, `0/17 quests`, and no invented success or relationship language.
- Paperclip open items now carry `evidence`, `approveConsequence`, `rerollConsequence`, `reversibility`, and `idempotencyHint`.
- Gate cards prefer those upstream fields and retain fallback gap text when older/open-item payloads are thin.

The gap exposed by this slice is that the fixture proves deterministic HTML/script rendering, not Telegram WebView layout fidelity. A real viewport or screenshot pass is still needed before claiming mobile polish.

## Slice shipped sixth

The sixth implementation slice adds a reproducible mobile viewport proof:

- `?scene=map|gate` deep links let the mini app open directly to proofable scenes without changing normal Telegram behavior.
- `npm run proof:tg-viewport` serves the real `PAGE` export and local fixture API, drives system Chrome over the DevTools Protocol, and writes mobile screenshots plus a manifest to `docs/plans/assets/tg-miniapp-viewport-proof/`.
- The proof covers the no-fake-progress Map scene and the Gate consequence scene at a 390 x 844 mobile viewport.
- Visual inspection of the first proof exposed two stage-card issues: title/detail text ran together, and stage text inherited browser-default button color. Both were fixed in the map CSS.

The gap exposed by this slice is that Chrome mobile viewport proof is not the same as a live Telegram WebView proof with real `initData`. It is strong enough for layout regressions, but not for Telegram shell/chrome behavior.

## Slice shipped seventh

The seventh implementation slice defines and renders the tenant-scoped stance rule:

- `stance` is now a first-class optional visual envelope section.
- The rule uses only parsed lane events from the current tenant's `world.log`; inherited founder arcs do not count.
- The stance window is the last 24 tenant lane events, with a minimum of 6 events before any stance label appears.
- Below the minimum, the mini app shows an explicit `STANCE GAP` card.
- With enough tenant history, the card shows a conservative label such as `MICRO-LED`, sample size, window, and lane ratios.

The gap exposed by this slice is that stance is still descriptive, not prescriptive: it visualizes recent lane history, but it does not yet recommend what the operator should do next.

## Slice shipped eighth

The eighth implementation slice upgrades Skill Labor cards from flat telemetry into conservative competence tiers:

- Skill rows now carry `tier`, `tierLabel`, `sampleSize`, `minimum`, `recentRate`, `recentWindow`, and optional `gap`.
- Under 3 uses, a skill is always `UNPROVEN` and the mini app shows the sample-size gap.
- Recent success below the forge decline threshold becomes `DECLINING`, using the same telemetry window as the skill forge.
- `RELIABLE` requires both total and recent success at or above two-thirds.
- `PRODUCTION` requires production registry status plus at least the full 5-use decline window at 80%+ total and recent success.
- Stale envelopes without tier fields fall back to sample-size and decline checks, so old skill rows do not become fake-ready by default.

The gap exposed by this slice is policy: tiers now describe observed skill labor quality, but they do not yet decide which labor should be invoked next or whether a founder should approve promotion to production.

## Slice shipped ninth

The ninth implementation slice makes the missing next-action policy visible instead of inventing a recommendation:

- `policy` is now a first-class visual envelope section.
- The current policy state is `missing`, with `action: null`.
- Policy blockers are derived from real visual evidence: insufficient stance samples, missing skill registry, absence of reliable/production skill tiers, and missing founder approval rules.
- The Telegram mini app now renders a compact `POLICY GAP` card under `next action`.
- The policy sheet can list blockers, so the operator can see why the visual engine is descriptive rather than prescriptive.
- Stale or partial envelopes without `policy` fall back to an explicit missing-policy card.
- The mobile viewport proof now includes `map-policy-gap-mobile.png`, a scrolled Map capture of the policy card.

The gap exposed by this slice is contract ownership: next-action recommendations need a real operator-policy source that maps stance ratios, quest frontier, skill tiers, gate state, and founder approval rules into a safe action. Until then, the app must show the gap, not an instruction.

## Slice shipped tenth

The tenth implementation slice creates the first operator-policy contract instead of leaving policy as UI-local logic:

- `bin/operator/quests/operator-policy.ts` is now the source for next-action evaluation.
- `docs/architecture/contracts/operator-policy-contract.md` defines v1 purpose, required signals, rule, guardrails, and open edge cases.
- The visual envelope now carries `source: "operator-policy"`, `rulesVersion`, `requiredSignals`, `blockers`, and `cautions`.
- Missing inputs now produce `status: "blocked"` rather than pretending the policy source itself is absent.
- A narrow `ready` policy exists only when there is an active quest frontier, ready tenant stance, and at least one reliable or production skill.
- Reliable-skill recommendations carry a caution that production promotion still requires a separate founder-approval policy.

The gap exposed by this slice is priority composition: v1 can choose a conservative action from quest frontier + stance + skill tier, but it still does not rank gate queue urgency, social/team signals, Mira relationship state, or cross-tenant priorities.

## Slice shipped eleventh

The eleventh implementation slice gives the operator policy a gate-aware priority rule without turning the mini app into an approval automaton:

- `operator-policy@v1.1` accepts Paperclip open items as gate candidates.
- Evidence-complete gate items outrank generic quest-frontier recommendations.
- The returned action is review-only: `Review gate item <id>: <title>`.
- Approve and reroll consequences remain visible in the signed Gate chamber, not in the Map recommendation text.
- Malformed gate items block policy instead of disappearing behind a generic next action.
- The viewport proof now includes `map-gate-priority-mobile.png`, a Map capture of the review-only gate priority card.

The gap exposed by this slice is queue ranking: v1.1 trusts the first Paperclip open item after enrichment, but it does not yet score multiple gate items by age, owner, risk, dependency, or founder preference.

## Slice shipped twelfth

The twelfth implementation slice turns the gate queue from array order into a deterministic attention guide:

- `operator-policy@v1.2` ranks complete gate items by status urgency, age, then id.
- Blocked/stuck/needs-review work outranks waiting work, which outranks open/active work.
- Older same-band items win before newer same-band items, giving the Map a light "guiding wind" instead of a hard command.
- Paperclip open items now expose `owner` and `updatedAt` as first-class fields, while retaining evidence and idempotency.
- Any malformed gate item still blocks policy, so queue scoring cannot hide a broken handoff.
- The envelope test proves a later `blocked` item outranks an earlier `open` item.

The gap exposed by this slice is priority semantics: v1.2 has status/age/id ordering, but it does not yet understand dependency graph, economic risk, founder preference, owner load, or cross-tenant urgency.

## Slice shipped thirteenth

The thirteenth implementation slice makes Skill Labor promotion policy visible without allowing automatic production promotion:

- Skill rows now carry a `promotion` state with `status`, `label`, `detail`, and `requiredApproval`.
- Validated skills with 5+ healthy uses at the production threshold show `FOUNDER REVIEW`.
- The mini app says `founder approval required` for those skills instead of calling them production.
- A skill shows `PRODUCTION` only when the registry already marks it `production` and the telemetry still satisfies the production threshold.
- Under-sampled, declining, or merely learning skills show `NO PROMOTION`.
- The viewport proof now includes `map-skill-promotion-mobile.png`, a scrolled Map capture of approval-gated skill promotion cards.

The gap exposed by this slice is approval workflow ownership: the visual engine can reveal which skills are ready for founder review, but it does not yet provide a signed production-promotion approval route or durable promotion decision record.

## Slice shipped fourteenth

The fourteenth implementation slice makes Mira relationship evidence tenant-safe and explicit:

- The visual envelope now derives Mira from tenant-scoped cortex memory rows.
- Mira becomes `inferred` only when current-tenant cortex memory explicitly mentions Mira, ICP, ideal-customer, customer-persona, or resonance signals.
- Cortex memories from other tenants do not count.
- When current-tenant cortex exists but does not mention Mira/ICP, the card shows a count-based missing state rather than a relationship level.
- The mini app continues to avoid terms like affinity, partner, or trusted advisor unless a future relationship contract serves them.
- The viewport proof now includes `map-mira-relationship-mobile.png`, a scrolled Map capture of a cortex-backed Mira card.

The gap exposed by this slice is relationship depth: the mini app can show that Mira has tenant-scoped evidence, but it still cannot show relationship stages, emotional beats, proactive advice, or long-term NPC progression until an NPC relationship/event contract exists.

## Slice shipped fifteenth

The fifteenth implementation slice gives Skill Labor production promotion a signed decision record without mutating the registry inside the mini app:

- The existing founder-gated queue now accepts `promote-skill` actions alongside approve/reroll gate actions.
- The skill sheet shows `Queue founder review` only for `promotion.status === "founder-review"`.
- The queued action carries evidence, consequence, reversibility, and an idempotency key.
- Duplicate promotion taps return the original queued action.
- The action record says the skill registry remains unchanged until an operator consumes/applies the queued decision.
- The viewport proof now includes `sheet-skill-promotion-mobile.png`, a clipped real bottom-sheet capture that proves the mobile sheet action is visible after tapping the Skill Labor card.

The gap exposed by this slice is application ownership: the mini app can queue a signed promotion review, but no operator consumer yet applies that decision to `.operator/<tenant>.skills.json` or writes a durable promotion audit trail.

## Slice shipped sixteenth

The sixteenth implementation slice adds the operator-owned consumer for signed Skill Labor promotion decisions:

- `quine write skills apply-promotions --tenant <id>` fetches queued `promote-skill` gate actions from the worker's internal gate queue.
- The consumer re-checks the current `.operator/<tenant>.skills.json` registry before applying a queued decision.
- A skill is promoted to `production` only when it is still `validated`, has five production-grade uses, is not declining, and meets the shared 80% lifetime/recent success threshold.
- The same production-readiness helper now drives both the visual `FOUNDER REVIEW` card and the operator consumer, reducing policy drift.
- Every processed promotion decision appends `.operator/<tenant>.skill-promotions.jsonl` before the remote gate action is consumed.
- Stale or renamed skills, declining telemetry, and already-production skills are recorded as audit results without unsafe mutation.
- `--dry-run` previews the same decisions without writing the registry, writing audit lines, or consuming remote gate actions.
- `scripts/refresh-quests.sh` now runs `quine write skills apply-promotions --tenant <id>` before each tenant ledger push, so the scheduled mini app refresh can show an approved skill as `PRODUCTION` after the operator consumes the queue.

The gap exposed by this slice is live proof: the consumer path is tested with worker-shaped gate responses, wired into the founder Mac refresh loop, and reachable against the production worker in dry-run mode (`checked: 0` queued promotions for `cambium` on June 22, 2026), but no live Telegram `initData` promotion has been queued and consumed end-to-end against production KV in this run.

## Slice shipped seventeenth

The seventeenth implementation slice reduces R3F/TG visual-contract drift:

- `apps/cambium-r3f/scripts/generate-scene-contract.mjs` now imports `shared/cambium-visual-contract.ts`.
- The generated R3F `sourceContract` now includes the shared visual stages, rails, wake steps, senses, and lanes under `sourceContract.visual`.
- `buildCambiumScene()` builds scene rails from `sourceContract.visual.rails` instead of a duplicated hardcoded rail list.
- R3F still keeps its richer scene-specific rendering details, including packet counts, tones, geometry, glyphs, references, QA policy, and camera behavior.
- The R3F scene-data test now asserts generated visual contract parity against the shared TG contract before checking runtime nodes and rails.

The gap exposed by this slice is stage metadata convergence: rail topology now has one source of truth, but R3F node titles and organ metadata still come from the composition pipeline while the TG mini app stage card labels come from the shared visual contract. That split is intentional for now because R3F needs richer organ/runtime metadata, but any future stage addition must update the shared contract first and then regenerate the R3F contract.

## Slice shipped eighteenth

The eighteenth implementation slice turns the stage-metadata convergence gap into a generator invariant:

- `apps/cambium-r3f/scripts/generate-scene-contract.mjs` now reconciles shared visual stages against R3F pipeline/crosscutting metadata before writing the generated contract.
- The generator now refuses to write if a shared visual stage lacks R3F metadata, if R3F has an unclaimed stage source, if a quest arc is unowned, or if a quest arc is claimed by multiple visual stages.
- The generated `sourceContract.visual.stageMetadata` now records each shared stage's visual title/detail/arcs alongside its R3F metadata source, organ, and richer R3F title.
- `apps/cambium-r3f/src/scene/scene-data.test.ts` now verifies that stage metadata follows shared visual stage order, preserves shared title/detail/arcs, keeps R3F organ/title metadata, and partitions the quest line arcs exactly once.

The viewport-proof rerun also clarified the remaining local proof blocker:

- `workers/quests/src/visual-viewport-proof.mjs` now probes `127.0.0.1`, `localhost`, and `::1`, forces Chrome's CDP bind address to loopback, and reports whether any process is actually listening on the requested CDP port.
- In this session, the proof still failed because local Google Chrome did not expose a DevTools listener: all loopback probes failed and `lsof` reported no process listening on the requested CDP port.
- A Chrome-only probe reproduced the same issue outside the app harness, and even `Google Chrome --version` hung, so the current failure is local Chrome CLI/CDP behavior rather than mini app rendering code.

## Slice shipped nineteenth

The nineteenth implementation slice closes the first side-quest gap without inventing hidden quests:

- The visual envelope now includes `sideQuests` from `pure-trigger-predicates`.
- Side quests are derived only from already-served evidence and explicit gaps: missing wake steps, insufficient stance sample, missing skill telemetry, founder-review skill promotion, open gate handoffs, blocked policy, and missing Mira evidence.
- Each side-quest row carries a trigger, detail, proof string, and origin so the card can be audited back to the signal that caused it.
- The Telegram mini app now renders a `side quests` section and a detail sheet with `trigger`, `origin`, and `proof` fields.
- Stale or old envelopes without `sideQuests` show an explicit missing-trigger gap instead of deriving decorative branches in the browser.
- The no-fake-progress fixture includes only gap-backed side quests such as `WAKE PROOF`, `STANCE SAMPLE`, `SKILL REGISTRY`, `POLICY UNBLOCK`, and `MIRA EVIDENCE`.

The gap exposed by this slice is side-quest actionability: the mini app can now reveal branch opportunities, but the branches are still visual prompts rather than independently executable quest contracts. Executable side quests need a durable trigger/action schema before they can be queued, expired, completed, or delegated.

## Slice shipped twentieth

The twentieth implementation slice gives side quests an executable contract shape without adding an unsafe queue:

- Every served side quest now carries `owner`, `action`, `lifetime`, and `completion` fields in addition to `trigger`, `origin`, and `proof`.
- Owners are conservative: `operator`, `founder`, or `system`.
- Actions are bounded to inspection, refresh, founder review, or evidence collection. They describe the allowed next move; they do not execute in the browser.
- Lifetimes state whether the branch lasts until the next refresh, until a queued decision is consumed, or until evidence arrives, with a stale-minute budget.
- Completion states name the proof that closes the branch: proof arrives, a queue item is consumed, or policy becomes ready.
- The side-quest detail sheet now shows owner, action, target, lifetime, completion, trigger, origin, and proof.
- The no-fake-progress fixture and tests now require these contract fields, so a future side quest cannot appear as a decorative prompt without ownership and completion evidence.

The gap exposed by this slice is execution runtime: side quests now have a durable trigger/action schema, but they still do not have an independent queue, expiration sweep, or completion ledger. For now they remain auditable visual contracts over existing evidence, while actual writes stay in the existing signed Gate and Skill promotion paths.

## Slice shipped twenty-first

The twenty-first implementation slice gives the operator policy dependency/risk-aware gate priority:

- Paperclip open items now carry a served `paperclip-priority@v1` signal with risk, dependency, score, and reasons.
- `operator-policy@v1.3` requires gate risk and dependency signals before it can recommend a gate review.
- Gate review ranking is now deterministic by status, dependency, risk, age, then id.
- Malformed gate items missing evidence, consequences, reversibility, idempotency, risk, or dependency block policy instead of falling through to generic frontier work.
- Ready gate policy details now include the served risk/dependency labels, and the mini app policy card surfaces that detail beside the review action.
- The viewport proof fixture and worker tests now exercise a critical `blocks-delivery` gate item, so priority semantics remain visible in the lightweight map.

The gap exposed by this slice is preference/load composition: v1.3 understands served gate urgency, but it still does not know founder preference, owner load, economic amount, team availability, or cross-tenant urgency. Those signals must be served explicitly before the policy can use them.

## Slice shipped twenty-second

The twenty-second implementation slice turns Sense filters into served visual-envelope data instead of browser-local inference:

- The visual envelope now includes `senses.source = "quest-ledger-envelope@v1"` with `signal`, `memory`, `risk`, and `drift` rows.
- Each sense row carries `on`, `detail`, `proof`, `source`, `evidence`, and optional `gap` fields.
- Signal is backed by the active quest frontier; memory is backed by tenant cortex count or open cortex-stage rows.
- Risk is backed by locked/pending quest rows and served Paperclip gate-risk priority signals.
- Drift is backed by `derivedAt` freshness, including explicit missing/stale gaps.
- The mini app now prefers served `env.senses.rows` and uses the old local inference only for stale/partial envelopes that predate the contract.
- The sense sheet now exposes served source/proof/evidence rows, so the user can audit why a sense is lit or absent.
- The no-fake-progress fixture now proves a lit frontier signal, missing memory, visible risk traces, and stale freshness without implying progress.

The gap exposed by this slice is sense ownership beyond the current ledger: the mini app now has a first-class sense contract, but richer senses such as economic risk, social trust, emotional/NPC state, and cross-tenant drift still need their own served evidence sources before they can appear.

## Slice shipped twenty-third

The twenty-third implementation slice turns evidence boxes into served insight rows:

- The visual envelope now includes `insights.source = "quest-ledger-evidence@v1"`.
- Insight rows carry `id`, `title`, `state`, `detail`, `proof`, `source`, `origin`, `quest`, `evidence`, and optional `gap`.
- The current derivation is intentionally conservative: the last three completed quest rows plus the active frontier become evidence boxes.
- Completed quest rows render as `ready`; the active frontier renders as `wait` until its quest is complete.
- Empty ledgers now serve an explicit `insights.status = "empty"` gap instead of letting the browser invent a box.
- The mini app now prefers served `env.insights.rows` and uses browser-local evidence-box inference only for stale/partial envelopes.
- The evidence-box sheet exposes source, proof, and served evidence rows so the card can be audited back to the quest ledger.
- The no-fake-progress fixture now serves `I · The Calling` as a waiting active-frontier insight, not a completed gift.

The gap exposed by this slice is durable insight ownership: evidence boxes are now first-class served rows, but they are still projections over quest evidence. A real gift/fragment table will be needed before the mini app can show reusable insights, deduplicate fragments across refreshes, or distinguish user-facing wisdom from operational proof.

## Slice shipped twenty-fourth

The twenty-fourth implementation slice makes the Wake loop inspectable instead of merely lit/unlit:

- `VisualWakeStep` now carries `source`, `proof`, `evidence`, and optional `gap` fields in addition to `id`, `status`, and `detail`.
- Ingest, route, act, viability, learn, and persist each expose the proof that made the step proved or missing.
- Route and act steps point back to quest-ledger rows; persist points to `derivedAt`; missing viability/learn steps name the absent evidence class.
- The mini app wake cards now prefer served wake proof fields and keep legacy local inference only for old partial envelopes.
- Wake cards are tappable, with a sheet that exposes step source, proof, and served evidence rows.
- The no-fake-progress fixture now includes explicit missing wake proofs for every step.

The gap exposed by this slice is event granularity: wake health is now auditable in the visual envelope, but there is still no durable wake-event table that records every ingest/route/act/viability/learn/persist transition over time. The current view is a latest-snapshot proof, not a historical wake trace.

## Slice shipped twenty-fifth

The twenty-fifth implementation slice gives companions an evidence-depth contract without adding false intimacy:

- NPC relationships now serve `stage`, `proof`, and `events` fields in the visual envelope.
- Mira stages are tenant-scoped and cortex-backed: `missing`, `sighted`, or `profile-backed`.
- Founder inheritance uses a separate `founder-backed` stage sourced only from inherited founder arcs.
- Stage labels describe proof depth, not affinity, loyalty, trust, friendship, or emotional closeness.
- The companion cards stay lightweight, while the sheet exposes stage, scope, proof, and up to four source events.
- The no-fake-progress fixture now carries explicit missing NPC stages, proofs, event arrays, and scopes.
- The viewport proof fixture now exercises the same relationship contract for the Mira capture path.

The gap exposed by this slice is longitudinal memory: the mini app can now show why a companion is missing, sighted, profile-backed, or founder-backed, but it still lacks a durable NPC event table, proactive advice protocol, contradiction handling, and emotional-beat model. Those features must arrive as served events before the interface speaks about deeper relationship progression.

## Slice shipped twenty-sixth

The twenty-sixth implementation slice gives NPC relationship depth a durable, operator-owned write model:

- `quine write quests npc-event <npc-id> <kind> --detail "..." [--advice "..."] [--tenant t]` appends `.operator/<tenant>.npc-events.jsonl`.
- The event schema is `cambium.npc-event.v1`, with tenant, NPC id, kind, source, detail, evidence, timestamp, optional contradiction target, and optional advice action.
- The writer rejects relationship-overclaiming language such as affinity, trusted advisor, partner, loyalty, friendship, romance, or love.
- The visual envelope now reads tenant-scoped NPC event history and merges it with cortex/founder evidence.
- Durable advice appears only when an advice event is served; otherwise the companion sheet shows `NO ADVICE`.
- Contradiction events move the relationship stage to `NEEDS REVIEW` and block advice until an operator resolves the evidence.
- The mini app remains read-only: it renders stage, proof, history, advice proof, events, and history rows, but writes stay in the quine/operator surface.
- The no-fake-progress and viewport fixtures now carry missing/served advice and history contracts.

The gap exposed by this slice is live operational proof: the local write/read/visual contract is tested, but there is not yet a production workflow where a real operator records NPC events over time and resolves contradictions from the live Telegram surface. Richer NPC adapters can now be added, but only if they write the same tenant-scoped event schema.

## Slice shipped twenty-seventh

The twenty-seventh implementation slice adds a deterministic NPC-history smoke for the actual mini app surface:

- The Worker page test now writes a Mira advice event through `quests.write("npc-event", ...)`, builds the visual envelope, renders `PAGE` in the same fake WebView VM used by the other mini app tests, and opens the companion sheet.
- The smoke proves the sheet shows `REVIEW ADVICE`, `operator-npc-events@v1`, the durable history row, and the advice detail.
- The same smoke then writes a contradiction event, rebuilds the envelope, reopens the sheet, and proves the map moves to `NEEDS REVIEW` while the sheet shows `ADVICE BLOCKED`.
- The smoke asserts that relationship-overclaiming terms do not appear in the rendered sheet.

The gap exposed by this slice is live-device provenance: the local smoke proves the operator-write -> envelope -> mini app sheet chain, but it still does not prove a production Telegram session with real `initData`, real Worker KV, and a real founder/operator device. That live proof remains a separate WebView/device gate.

## Slice shipped twenty-eighth

The twenty-eighth implementation slice makes the social/team surface visible without inventing social proof:

- The visual envelope now includes `social.source = "coordination-evidence@v1"` with tenant-scoped coordination rows.
- Rows can be served from Paperclip quest inputs, Paperclip open handoffs, founder-gate quest evidence, or client-handoff quest evidence.
- The mini app renders a compact `coordination` section and detail sheet with source, scope, proof, and served evidence rows.
- Empty or old envelopes show `SOCIAL GAP` instead of inferring a team, member presence, leaderboard, popularity, or social proof.
- The first supported scopes are deliberately narrow: `tenant-handoff-only`, `founder-gate-only`, and `client-handoff-only`.

The gap exposed by this slice is social authority: the map can visualize coordination evidence, but it still cannot show team availability, member presence, revocation state, or cross-tenant urgency until those signals are served explicitly and permission-scoped.

## Slice shipped twenty-ninth

The twenty-ninth implementation slice gives side quests an operator-owned runtime ledger without adding browser writes:

- `quine write quests side-quest <id> <queued|completed|expired> --detail "..." --proof "..." [--tenant t]` appends `.operator/<tenant>.side-quests.jsonl`.
- The event schema is `cambium.side-quest-event.v1`, with tenant, side quest id, status, source, detail, proof, timestamp, and optional target.
- The writer rejects reward/social-proof language such as reward, bonus, level up, hidden quest, leaderboard, popularity, social proof, or rank.
- The visual envelope now merges side-quest trigger predicates with the newest operator ledger event for each branch.
- Queued events older than the branch lifetime are rendered as `expired` during envelope derivation, using the served `derivedAt` timestamp rather than browser-local inference.
- The mini app side-quest sheet now shows `side quest history`, ledger source, status, event count, history proof, and recent operator events.
- The mini app still cannot write side-quest state; queue/completion/expiration writes stay in the operator surface.

The gap exposed by this slice is live runtime ownership: side quests now have durable local queue/completion/expiration evidence, but there is still no signed Telegram action for side-quest writes, no production KV-backed side-quest worker queue, and no delegation/member assignment model. Those must stay outside the mini app until permission and write authority are explicit.

## Slice shipped thirtieth

The thirtieth implementation slice adds a conservative decision-context layer for advanced priority signals without promoting those signals into operator policy:

- The visual envelope now includes `decisionContext.source = "decision-context@v1"`.
- The mini app renders `decision context` cards and a sheet with source, scope, proof, and served evidence rows.
- Six rows are always explicit: founder preference, owner load, economic risk, team availability, member revocation, and cross-tenant urgency.
- Owner load can be served from Paperclip open-item owners, but it is descriptive only.
- Economic commitment state can be served from project evidence, but the row still says amount/currency risk is not served.
- Cross-tenant urgency can show a tenant-registry count, but it remains a gap until real urgency scores exist.
- Founder preference, team availability, and member revocation stay gaps until real permission-scoped sources exist.
- `operator-policy@v1.3` is unchanged; decision context is not part of `requiredSignals`, action text, blockers, or cautions.

The gap exposed by this slice is priority authority: advanced context is now visible enough for a human to understand the missing dimensions, but it must not drive recommendations until preference, load/capacity, economic amount/currency, revocation, and urgency scores are served by explicit contracts.

## Slice shipped thirty-first

The thirty-first implementation slice turns wake health from latest-snapshot only into a durable operator history without letting history override current evidence:

- `quine write quests wake-event <step> <proved|missing> --detail "..." --proof "..." [--tenant t]` appends `.operator/<tenant>.wake-events.jsonl`.
- The event schema is `cambium.wake-event.v1`, with tenant, wake step, proved/missing status, source, detail, proof, timestamp, and optional target.
- The visual envelope now reads wake-event history and attaches a `history` object to each wake step.
- The current wake step `status` still comes from the latest served envelope evidence, not from history rows.
- The mini app wake sheet now shows `wake history`, event count, history proof, and recent operator events.
- Empty/old envelopes show that no operator wake events are served, preserving the latest-snapshot warning.

The gap exposed by this slice is live wake ownership: the local operator history can explain how wake proof changed across refreshes, but it is not yet a production Worker event stream and it is not written by Telegram. A future live wake pipeline needs signed/event-sourced ingest, route, act, viability, learn, and persist records.

## Slice shipped thirty-second

The thirty-second implementation slice adds signed side-quest queue routing without turning the browser into the side-quest ledger:

- The existing signed Telegram gate route now accepts `queue-side-quest` actions.
- Side-quest queue actions use the same founder `initData` verification, idempotency key, internal listing, and consume path as gate approvals and skill promotions.
- The mini app side-quest sheet can show `Queue side quest` for bounded action kinds: refresh, founder review, or evidence collection.
- The queued action carries served proof, consequence, reversibility, and an idempotency key.
- The side-quest ledger remains unchanged until an operator consumes the queue and writes `.operator/<tenant>.side-quests.jsonl`.
- The route deliberately does not mark side quests complete, award rewards, create hidden quests, or write browser-local history.

The gap exposed by this slice is queue consumption ownership: Telegram can now sign and queue a side-quest request, but the operator still needs an explicit consumer that translates `queue-side-quest` actions into safe local side-quest events after re-checking the current visual envelope.

## Slice shipped thirty-third

The thirty-third implementation slice adds the operator-owned consumer for signed side-quest queue actions:

- `quine write quests apply-side-quests --tenant <id>` fetches queued `queue-side-quest` actions from the Worker internal gate queue.
- The consumer rebuilds the current visual envelope before writing anything, then only accepts actions whose subject is still served as a current side-quest row.
- Accepted actions append a `cambium.side-quest-event.v1` event with `source: "founder-gate"`, action id, idempotency key, current row proof, and signed gate evidence.
- Stale, unknown, already-completed, non-queueable, or overclaiming actions are consumed as rejected without writing `.operator/<tenant>.side-quests.jsonl`.
- `--dry-run` previews the same decisions without writing local side-quest events or consuming remote gate actions.
- `scripts/refresh-quests.sh` now runs side-quest queue consumption before each tenant ledger push, so a queued Telegram action can become visible in the next mini app envelope only after the operator surface consumes it.

The gap exposed by this slice is live proof and richer assignment: the consumer is tested against Worker-shaped queue responses and wired into the founder Mac refresh loop, but this run still does not include a real Telegram tap -> production Worker KV -> local operator consume -> refreshed mini app proof packet. Member assignment, delegation, and completion semantics beyond `queued|completed|expired` remain intentionally outside the mini app until explicit authority and retention contracts exist.

## Slice shipped thirty-fourth

The thirty-fourth implementation slice turns the remaining live-proof gap into a machine-readable readiness audit:

- `npm run proof:tg-live-readiness` writes `docs/plans/assets/tg-miniapp-live-proof/readiness.json`.
- The readiness schema is `cambium.tg-live-proof-readiness.v1`.
- The audit separates deterministic local readiness from live Telegram/production Worker proof.
- It checks for real Telegram `initData`, a founder-device WebView artifact, production Worker token availability, explicit network-probe authorization, the mini app initData path, Worker initData validation, promotion and side-quest consumers, deterministic NPC smoke coverage, and local viewport-proof availability.
- The default command exits successfully while reporting `status: "blocked"` when live inputs are missing, so the artifact can be refreshed during local development.
- `npm run proof:tg-live-readiness:strict` is available for the moment we want a fail-closed live gate.
- The current readiness packet reports `ready: 7`, `blocked: 3`, `liveProofReady: false`.
- The blocked live items are real Telegram `initData`, a founder-device WebView artifact, and an authorized production Worker network probe.

The gap exposed by this slice is still the external live proof itself: the codebase can now say exactly what evidence is missing, but it has not captured a founder Telegram WebView session or exercised production Worker KV with a real signed action in this run.

## Slice shipped thirty-fifth

The thirty-fifth implementation slice promotes advanced priority context into policy only through an explicit contract:

- `operator-policy@v1.4` adds optional `operator-priority-signals@v1`.
- Visual `decisionContext` rows remain display context and are not consumed by policy.
- The policy accepts priority signals only when founder preference, owner capacity, economic amount/currency/risk, team availability, member revocation, and cross-tenant urgency are all served with proof.
- Incomplete priority signals block the recommendation instead of falling back to visual context.
- Active member revocation blocks the recommendation until access state is reviewed.
- Complete and safe priority signals can rank an already evidence-complete gate review and add auditable cautions.
- `gatherQuestInputs` now reads `.operator/<tenant>.priority-signals.json`.
- The visual `decisionContext` layer shows `operator-priority-signals` as the source only when that explicit contract is present.

The gap exposed by this slice is signal production: the policy can now consume real priority signals safely, but the repo still needs upstream producers for founder preference, capacity/availability, economic amount/currency, revocation, and cross-tenant urgency. Until those files are served, decision context remains visible but non-authoritative.

## Slice shipped thirty-sixth

The thirty-sixth implementation slice adds the operator-owned priority-signal producer without making priority mandatory:

- `quine write quests priority-signals` reads `.operator/<tenant>.priority-source.json`.
- The source schema is `operator-priority-source@v1`.
- The producer writes `.operator/<tenant>.priority-signals.readiness.json` for audit state.
- It writes `.operator/<tenant>.priority-signals.json` only when a complete source can produce policy authority, or when an existing/source-backed signal must be overwritten with an explicit blocked packet.
- Missing source plus no existing policy file skips policy authority, preserving optional priority semantics.
- Incomplete source overwrites stale complete signals with blocked `operator-priority-signals@v1`.
- Owner load derives open-item count from Paperclip open items plus explicit capacity proof.
- Cross-tenant urgency derives a bounded score from registered tenants plus blocking/critical open gate items.
- `push` refreshes priority signals before building the visual envelope, and `scripts/refresh-quests.sh` runs the producer before each tenant push.

The gap exposed by this slice is source capture: the repo now has the producer and stale-signal guard, but it still needs real operator/source documents for founder preference, owner capacity, economic amount/currency, team availability, revocation, and urgency proof before priority signals should be ready in normal operation.

## Slice shipped thirty-seventh

The thirty-seventh implementation slice adds explicit source capture for priority signals:

- `quine write quests priority-source` records `.operator/<tenant>.priority-source.json`.
- The command requires founder target/weight/proof, owner/capacity/proof, economic amount/currency/risk/proof, team available/required/proof, member revocation boolean/proof, and urgency proof.
- A complete capture immediately refreshes `.operator/<tenant>.priority-signals.json`.
- A partial capture is rejected and does not write `.priority-source.json`.
- If stale `.priority-signals.json` authority already exists, a rejected partial capture overwrites it with blocked `operator-priority-signals@v1`.
- The urgency score may be supplied, but the producer still bounds it and can lift it from tenant/open-gate pressure.

The gap exposed by this slice is real-source population: the repo can now capture source facts safely, but the facts themselves still have to be recorded by the operator or wired from upstream systems. Until real source capture happens for a tenant, decision context stays visible but non-authoritative.

## Slice shipped thirty-eighth

The thirty-eighth implementation slice adds read-only inspection for priority-source population:

- `quine write quests priority-audit` inspects `.operator/<tenant>.priority-source.json`, `.priority-signals.json`, and `.priority-signals.readiness.json`.
- The audit reports missing fields, whether a refresh would write a signal file, and whether stale signal authority would be blocked.
- The audit does not write source, readiness, or signal files.
- Tests prove missing-source audit, ready-source preview, and stale-authority preview remain read-only.
- The current local `cambium` audit reports `status: "skipped"`, missing `operator-priority-source@v1 file`, `sourceExists: false`, `signalExists: false`, and `readinessExists: true`.

The gap exposed by this slice is operational population: the system can now capture and audit source facts safely, but no current `cambium` priority source exists. The next step is either operator-entered source facts or upstream connectors for founder preference, owner capacity, economic exposure, availability, revocation, and urgency proof.

## Slice shipped thirty-ninth

The thirty-ninth implementation slice adds a non-authoritative priority source template:

- `quine write quests priority-template` prints an `operator-priority-source-template@v1` wrapper.
- `--write-template` writes `.operator/<tenant>.priority-source.template.json`.
- The template includes an inner `sourceDocument` shaped like `operator-priority-source@v1`, but the wrapper is not consumed by policy.
- Tests prove default template preview writes nothing and `--write-template` writes only the template file, not `.priority-source.json` or `.priority-signals.json`.
- The current local `cambium` template has `tenantCount: 3`, no suggested Paperclip gate target, no suggested owner, and TODO placeholders for all proof fields.

The gap exposed by this slice is still factual, not mechanical: the system now provides an audit, capture path, and safe template, but the real founder preference, owner capacity, economic exposure, team availability, member revocation, and urgency proof still need to be supplied before priority signals become authoritative.

## Slice shipped fortieth

The fortieth implementation slice makes founder-device proof a validated artifact instead of a loose file-presence check:

- `workers/quests/src/live-proof-readiness.mjs` now validates `docs/plans/assets/tg-miniapp-live-proof/telegram-webview.json` as `cambium.tg-device-proof.v1`.
- The device proof must match the tenant, use `source: "telegram-webview"`, include a fresh `capturedAt`, keep `telegram.initDataAgeSeconds <= 600`, and provide SHA-256 hashes for Telegram user id, raw initData, and screenshot evidence.
- The validator rejects raw `initData`, `query_id`, `auth_date`, `hash`, `signature`, `tgWebAppData`, and token-like leakage.
- `--device-proof` can point the readiness audit at an alternate capture file for a device run.
- `--write-device-template` writes `docs/plans/assets/tg-miniapp-live-proof/telegram-webview.template.json`.
- The template schema is `cambium.tg-device-proof-template.v1`, has `writesAuthority: false`, and is never counted as live proof.
- The current readiness packet still reports `ready: 7`, `blocked: 3`, and `liveProofReady: false`.
- Focused tests prove missing proof, template-only proof, raw initData leakage, valid proof, template writing, and redacted readiness output.

The gap exposed by this slice is now operational capture: the repo has the exact redacted evidence shape for a founder Telegram WebView run, but `telegram-webview.json` still needs to be populated from a real device session and paired with authorized production Worker probing.

## Slice shipped forty-first

The forty-first implementation slice binds the founder-device proof to screenshot bytes:

- `cambium.tg-device-proof.v1` now requires `screenshot.path`.
- `screenshot.path` must stay under `docs/plans/assets/tg-miniapp-live-proof`.
- The screenshot file must exist locally.
- `screenshot.sha256` must match the SHA-256 digest of that file.
- Valid proof evidence now includes the screenshot path and screenshot hash.
- Tests cover hash mismatch and a valid matching screenshot fixture.
- The readiness packet still reports `ready: 7`, `blocked: 3`, and `liveProofReady: false` because no real founder WebView artifact exists yet.

The gap exposed by this slice is provenance, not file shape: a future founder-device run must save the actual WebView screenshot file, hash it, and keep the redacted JSON artifact aligned with those bytes.

## Slice shipped forty-second

The forty-second implementation slice makes production Worker proof a redacted receipt instead of an authorization flag:

- `workers/quests/src/live-proof-readiness.mjs` now validates `docs/plans/assets/tg-miniapp-live-proof/worker-network-probe.json` as `cambium.worker-network-probe.v1`.
- `--worker-probe` can point readiness at an alternate Worker probe receipt.
- `--write-worker-template` writes `docs/plans/assets/tg-miniapp-live-proof/worker-network-probe.template.json`.
- The Worker template schema is `cambium.worker-network-probe-template.v1`, has `writesAuthority: false`, and is never counted as production proof.
- The required probe is the non-mutating `GET /internal/gate/<tenant>` internal list route.
- The receipt must match tenant, production Worker URL, fresh `capturedAt`, HTTP 200 status, `ok: true`, tenant-matching response shape, an actions array response shape, non-negative queued-action count, and a SHA-256 response digest.
- The validator rejects bearer headers, tokens, cookies, authorization fields, and secret-bearing payloads.
- `--allow-network` and `QUESTS_PUSH_TOKEN` now mean "allowed to capture"; they do not by themselves mark the Worker probe ready.
- Before the later live capture, the readiness packet still reported `ready: 7`, `blocked: 3`, and `liveProofReady: false`, with the Worker row blocked specifically on the missing `cambium.worker-network-probe.v1` receipt.

The gap exposed by this slice was live production capture: the codebase had the receipt shape for the production Worker list probe, but no authorized network run had produced `worker-network-probe.json` yet. Queue and consume proof remain separate signed live-smoke slices because `/consume` mutates production state.

## Slice shipped forty-third

The forty-third implementation slice adds a safe command path to capture the production Worker probe receipt:

- `workers/quests/src/live-proof-readiness.mjs --capture-worker-probe --allow-network --write` can call the production Worker non-mutating list route and write `worker-network-probe.json`.
- The capture path refuses to run without `--allow-network`.
- The capture path requires `QUESTS_PUSH_TOKEN` from the environment or `~/.claude/.env`, but never prints or stores the token.
- The captured receipt stores only route metadata, HTTP status, response-shape booleans, queued-action count, and a SHA-256 digest of the raw response body.
- The captured receipt omits bearer headers, raw response body, founder ids, queued action payloads, and any token-like material.
- Tests use fake fetch to prove the command uses authorization on the wire while writing only redacted metadata to disk.
- The normal `npm run proof:tg-live-readiness` command remains an offline/audit refresh and does not perform network IO.

The gap exposed by this slice was still external execution: the repo had a safe capture command, but it had not yet been run against production in this session. Slice fifty-first later captures the list receipt; the remaining guard is not to confuse that non-mutating proof with mutating queue/consume proof.

## Slice shipped forty-fourth

The forty-fourth implementation slice gives mutating signed-action proof its own receipt lane:

- `workers/quests/src/live-proof-readiness.mjs` now validates `docs/plans/assets/tg-miniapp-live-proof/signed-action-smoke.json` as `cambium.signed-action-smoke.v1`.
- `--signed-smoke` can point readiness at an alternate signed-action smoke receipt.
- `--write-signed-smoke-template` writes `docs/plans/assets/tg-miniapp-live-proof/signed-action-smoke.template.json`.
- The signed-smoke template schema is `cambium.signed-action-smoke-template.v1`, has `writesAuthority: false`, and is tracked separately from base WebView/Worker readiness.
- The receipt must prove four phases: Telegram signed submit, Worker internal list seeing the queued action, operator consume, and refreshed mini app visual envelope.
- The receipt stores only hashes, booleans, counts, command names, status codes, and visible marker hashes.
- The validator rejects raw `initData`, bearer headers, tokens, raw subjects, founder ids, queued ids, raw request bodies, and raw response bodies.
- The readiness packet now exposes `followups.signedActionSmoke` with schema `cambium.signed-action-smoke-readiness.v1`.
- Missing signed-action smoke proof does not block the base `summary.liveProofReady` calculation; it blocks the follow-up lane for promotion, side-quest, NPC, and gate-approval live smokes.

The gap exposed by this slice is lifecycle evidence: the repo now has a safe receipt shape for Telegram tap -> Worker queue/list -> operator consume -> mini app refresh, but no real signed action has been captured end to end against production.

## Slice shipped forty-fifth

The forty-fifth implementation slice adds a safe command path to capture the founder Telegram WebView device proof:

- `workers/quests/src/live-proof-readiness.mjs --capture-device-proof --screenshot docs/plans/assets/tg-miniapp-live-proof/<file>.png --platform ios --webview-url https://curious.thoughtseed.space/... --safe-area ... --write` can write `telegram-webview.json`.
- The command reads raw Telegram `initData` only from `TELEGRAM_INIT_DATA` or `TG_INIT_DATA`; it does not accept raw initData as a CLI argument or store it in the artifact.
- The capture path hashes the Telegram user id and raw initData, derives `telegram.initDataAgeSeconds`, strips the WebView URL query/hash, records only origin/path, and hashes the screenshot bytes.
- The screenshot path must stay under `docs/plans/assets/tg-miniapp-live-proof`, and the validator re-computes the SHA-256 digest before the artifact can count as ready.
- The command validates the generated artifact before writing, so missing platform, stale initData, missing screenshot, mismatched screenshot bytes, or unsafe fields fail before the readiness row can become ready.
- Focused tests prove missing env refusal, screenshot-directory refusal, URL query stripping, redacted artifact writing, screenshot hash matching, and validator acceptance.

The gap exposed by this slice is still founder-device execution: the repo now has the safe WebView capture command, but it has not been run with a real founder Telegram session in this environment. A future run needs fresh `TELEGRAM_INIT_DATA`/`TG_INIT_DATA`, the real screenshot saved under the proof directory, the device platform/safe-area notes, and then the production Worker receipt.

## Slice shipped forty-sixth

The forty-sixth implementation slice adds a safe command path for signed-action smoke receipts:

- `workers/quests/src/live-proof-readiness.mjs --capture-signed-smoke --allow-network --allow-mutation ... --write` can write `signed-action-smoke.json`.
- The command sends raw Telegram `initData` only in the signed `POST /api/gate/<tenant>` body and never stores it in the receipt.
- `--allow-network` and `--allow-mutation` are both required so a mutating Telegram queue proof cannot be captured accidentally.
- The command performs the Telegram submit and Worker list phases, then requires separately produced operator-consume and mini app refresh evidence through `--operator-command`, `--operator-audit`, `--operator-checked`, `--operator-consumed`, `--operator-rejected`, `--miniapp-envelope`, and `--visible-marker`.
- The command does not call `/consume`; operator-owned consumers still perform the re-check and consume step.
- The receipt stores only hashes, counts, booleans, command name, status codes, and digests: Telegram user id hash, initData hash, subject hash, idempotency-key hash, queued-id hash, response/body digests, operator audit digest, mini app envelope digest, and visible marker hash.
- Focused tests prove missing authorization refusal, redacted queue/list/consume/refresh proof writing, Worker bearer use on the wire, raw initData use only in the POST body, marker validation, and validator acceptance.
- The redaction validator rejected an early receipt note that contained token-like wording, so the capture note now uses neutral privacy language instead of repeating secret names inside the artifact.

The gap exposed by this slice is still live lifecycle execution: the repo can now produce a safe signed-action smoke receipt after the real phases happen, but this environment has not run a real Telegram tap, production Worker queue/list, operator consume, and refreshed mini app proof packet.

## Slice shipped forty-seventh

The forty-seventh implementation slice turns the remaining proof work into a machine-readable capture plan:

- `workers/quests/src/live-proof-readiness.mjs` now emits `capturePlan` with schema `cambium.tg-live-proof-capture-plan.v1`.
- `capturePlan.steps` covers `device-webview-proof`, `worker-list-proof`, and `signed-action-smoke`.
- Each step reports `blocked`, `ready-to-capture`, or `complete`.
- `complete` means the authoritative artifact already validates.
- `ready-to-capture` means prerequisites are present, but the artifact still has not been produced.
- The plan lists the redacted command shape, target artifact path, prerequisites, and privacy invariants for each proof lane.
- Device capture prerequisites include fresh Telegram env initData, screenshot path under the proof directory, device platform, and WebView URL.
- Worker capture prerequisites include Worker credential availability and explicit `--allow-network`.
- Signed-smoke prerequisites include fresh Telegram env initData, Worker credential availability, explicit `--allow-network`, explicit `--allow-mutation`, action fields, operator audit file, operator counts, mini app envelope file, and a visible marker that appears in the envelope.
- Focused tests prove default blocked capture-plan states, `ready-to-capture` states when all prerequisites are supplied, and no raw initData, founder id, WebView query, or token assignment leakage in the readiness JSON.

The gap exposed by this slice is external proof execution rather than planning: the readiness artifact can now say exactly how to run the next proof step and why it is blocked, but only real Telegram, Worker, operator, and refreshed mini app artifacts can move capture-plan steps from `ready-to-capture` to `complete`.

## Slice shipped forty-eighth

The forty-eighth implementation slice makes the Telegram mini app visualize the live-proof capture plan itself:

- `bin/quine/hyphae/quests.ts` now derives a `liveProof` visual-envelope node from `docs/plans/assets/tg-miniapp-live-proof/readiness.json`.
- The envelope is tenant-scoped; a missing readiness file or tenant mismatch becomes an explicit `LIVE PROOF GAP` instead of leaking another tenant's proof state.
- `liveProof.rows` exposes only redacted capture-plan data: step id/title/state, target receipt path, templated command, prerequisites, privacy rules, and the invariant that capture commands are not proof until receipts validate.
- `workers/quests/src/page.ts` now renders a lightweight `live proof` section inside the operator map, before side quests.
- Tapping a live-proof row opens a sheet with `capture plan · not proof`, source, write path, command, invariant, proof rule, prerequisites, and privacy constraints.
- The no-fake-progress visual fixture now includes blocked device, Worker, and signed-smoke capture rows.
- Tests prove the mini app renders blocked capture guidance, avoids live-proof overclaims, and that `buildVisualEnvelope` can surface a redacted readiness artifact without raw initData, bearer, or token assignment leakage.

The gap exposed by this slice is now purely operational: the mini app can show the live-proof work as part of the visual engine, but it still cannot mark the engine live-proven until the real founder WebView, production Worker, operator-consume, and refreshed-envelope receipts exist.

## Slice shipped forty-ninth

The forty-ninth implementation slice adds a lightweight completion-definition audit to the Telegram mini app:

- `workers/quests/src/page.ts` now renders a `tapestry audit` section at the top of the operator map.
- The audit summarizes the plan's required visual surfaces: active organ, wake health, quest frontier, evidence boxes, skill mastery, founder stance, Mira relationship, gate consequences, command state, memory sense, decision context, live proof, R3F contract, and freshness gaps.
- Each audit row is derived from the same envelope-backed section it summarizes, rather than from a separate status file.
- Tapping an audit row opens a `completion definition` sheet with source, requirement id, and proof text.
- The audit can show a row as `wait` while still making the gap visible; visibility of a gap is not treated as completion of the underlying proof.
- Focused tests prove the no-fake-progress fixture shows the audit rows, keeps blocked rows blocked, and exposes source-backed proof without claiming all requirements are complete.

The gap exposed by this slice is now clearer: the mini app can act as a pocket audit surface for the engine, but many rows intentionally remain wait-state until real evidence arrives. The audit is a map of the work, not a shortcut around the proof contracts.

## Slice shipped fiftieth

The fiftieth implementation slice tightens the mobile viewport proof and readiness boundary:

- `workers/quests/src/visual-viewport-proof.mjs` now supports multiple Chromium-family candidates instead of only one hard-coded Chrome path.
- The proof harness tries Google Chrome and Arc when no `CHROME_BIN` override is supplied.
- It writes `docs/plans/assets/tg-miniapp-viewport-proof/failure.json` when no browser exposes a Chrome DevTools Protocol endpoint.
- The failure receipt is explicitly diagnostic-only; old screenshots remain stale until `manifest.json` is regenerated by a passing run.
- The proof harness now captures `map-tapestry-audit-mobile.png` and scrolls to real selectors such as `[data-policy]`, `[data-skill="0"]`, and `[data-npc="0"]` instead of depending on brittle hard-coded scroll offsets.
- Local listener errors, including sandbox `EPERM` on `127.0.0.1`, now become structured failures instead of unhandled Node process crashes.
- `workers/quests/src/live-proof-readiness.mjs` now treats a newer viewport `failure.json` as a blocker even when an older `manifest.json` exists.
- The current readiness packet reports `ready: 6`, `blocked: 4`, and `liveProofReady: false`; the fourth blocked row is `viewport-layout-proof`.
- The escalated proof rerun tried both `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` and `/Applications/Arc.app/Contents/MacOS/Arc`; neither exposed a CDP listener on loopback.

The gap exposed by this slice is no longer ambiguous: the viewport proof is not merely stale, it is actively blocked by local browser/CDP behavior. The current mini app changes should not be claimed mobile-proofed until a passing run regenerates the manifest and screenshots.

## Slice shipped fifty-first

The fifty-first implementation slice captures the non-mutating production Worker list proof:

- `node workers/quests/src/live-proof-readiness.mjs --capture-worker-probe --allow-network --write` now produced `docs/plans/assets/tg-miniapp-live-proof/worker-network-probe.json`.
- The receipt is schema `cambium.worker-network-probe.v1`, tenant `cambium`, source `production-worker`, Worker URL `https://curious.thoughtseed.space`.
- The captured probe is `GET /internal/gate/cambium -> 200`.
- The response shape validated with `tenantMatches: true` and `actionsArray: true`.
- The current queued action count is `0`.
- The artifact stores only status, response shape, count, and `bodySha256`; credentials and raw response body are omitted.
- The readiness artifact now marks `worker-network-probe` ready and `capturePlan.steps.worker-list-proof` complete.
- The current readiness packet reports `ready: 7`, `blocked: 3`, and `liveProofReady: false`.
- The remaining blocked base rows are real Telegram initData, founder device WebView artifact, and stale viewport layout proof. The signed-action smoke remains a separate follow-up lane.

The gap exposed by this slice is sharper: production Worker queue/list reachability is proven, but there is still no founder Telegram WebView proof and no mutating signed-action queue/consume/refresh receipt.

## Slice shipped fifty-second

The fifty-second implementation slice narrows the local viewport-proof blocker:

- A direct unsandboxed Chrome listener probe launched `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` with `--headless=new`, `--remote-debugging-address=127.0.0.1`, and a fixed remote debugging port.
- The Chrome process started, but `lsof` found no process listening on the port and Chrome emitted no stderr.
- The same direct probe with old `--headless` also started Chrome but exposed no listener.
- A short headed probe without a headless flag also started Chrome but exposed no listener.
- The failure is therefore below `workers/quests/src/visual-viewport-proof.mjs`; the script is not merely choosing the wrong headless mode.
- Only Google Chrome and Arc are installed under `/Applications` among the configured Chromium-family candidates.

The gap exposed by this slice is environmental/browser-policy rather than proof-script logic: local viewport proof now needs either a Chromium-family binary that honors `--remote-debugging-port` on this machine, or a browser/runtime policy fix that lets Chrome expose CDP on loopback.

## Slice shipped fifty-third

The fifty-third implementation slice turns the viewport browser blocker into a machine-readable diagnostic receipt:

- `npm run proof:tg-viewport:diagnose` runs `workers/quests/src/visual-viewport-proof.mjs --diagnose-browser`.
- The diagnostic command writes `docs/plans/assets/tg-miniapp-viewport-proof/browser-diagnostics.json`.
- The receipt schema is `cambium.tg-viewport-browser-diagnostics.v1`.
- The default probe modes are `headless-new` and `headless-old`; a headed probe remains opt-in with `--include-headed-browser-probe` or `INCLUDE_HEADED_BROWSER_PROBE=1`.
- The escalated diagnostic run probed Google Chrome and Arc across both headless modes.
- The receipt reports `ready: 0`, `blocked: 4`, `total: 4`, and `cdpReady: false`.
- `workers/quests/src/live-proof-readiness.mjs` now includes `browser-diagnostics.json` as viewport evidence when present.
- The viewport readiness row remains blocked: diagnostics explain the blocker, but only a fresh `manifest.json` from a passing screenshot run can prove layout.

The gap exposed by this slice is proof provenance for failures: the team can now distinguish sandbox loopback failure, browser no-listener behavior, and a future working browser candidate without treating any diagnostic receipt as visual proof.

## Slice shipped fifty-fourth

The fifty-fourth implementation slice closes the local viewport proof blocker without weakening the live-proof boundary:

- `workers/quests/src/visual-viewport-proof.mjs` now includes cached Playwright `chrome-headless-shell` binaries as fallback candidates when no `CHROME_BIN` override is supplied.
- Screenshot capture now tries browser modes as well as browser binaries: `headless-new`, then `headless-old`, with headed probing still opt-in for diagnostics.
- Failure artifacts now record both browser candidates and browser modes, so a failed run explains exactly what was attempted.
- `workers/quests/src/live-proof-readiness.mjs` now treats a Chrome binary as only an attempt path; the viewport row is ready only when `manifest.json` exists and no newer `failure.json` supersedes it.
- `workers/quests/src/live-proof-readiness.test.ts` proves that Chrome-without-manifest remains blocked, while a real manifest is required for readiness.
- `npm run proof:tg-viewport:diagnose` now reports `cdpReady: true` on this machine, with Google Chrome `headless-old` as a valid CDP path.
- `npm run proof:tg-viewport` regenerated eight mobile proof screenshots from the real `PAGE` export: tapestry audit, no-fake-progress map, policy gap, gate priority, skill promotion map, skill promotion sheet, Mira relationship, and gate consequence.
- `npm run proof:tg-live-readiness` now reports `ready: 8`, `blocked: 2`, `total: 10`, and `liveProofReady: false`.

The gap exposed by this slice is now strictly live-device provenance: local viewport layout proof is fresh, but no real founder Telegram WebView artifact or fresh Telegram `initData` exists in this environment, so signed action smoke and live proof remain blocked.

## Feature gaps and edge cases

| Feature family | Current gap | Edge cases to handle | Execution invariant |
|---|---|---|---|
| Wake loop | Wake steps now serve latest source/proof/evidence/gap plus local operator wake-event history, but there is no production Worker event stream yet | Empty ledger, stale ledger, missing source, partial event pipeline, offline fetch, old envelopes without proof fields, latest snapshot contradicting older wake state, old proved history with current missing status, malformed wake step ids | Show proved steps with current source/proof/evidence; label missing steps as explicit gaps; history explains past operator observations but never overrides current status |
| Insight boxes | `insights` are now served from quest-ledger evidence, but no durable gift/fragment table exists yet | Repeated evidence, no completed rows, active row with pending evidence, stale boxes, old envelopes without `insights`, completed proof that should not become public wisdom | Boxes must prefer served source/proof/evidence rows; active frontier boxes stay `wait`; reusable gifts require a future fragment contract |
| Sense filters | `senses` are now served as visual-envelope rows, while advanced economic/social priority dimensions live in `decisionContext` rather than sense filters | Risk always high because locked rows exist, freshness missing, memory rows locked, all arcs complete, stale envelopes without `senses`, served proof contradicting local inference, context rows mistaken for filters | Senses must prefer served source/proof/evidence rows; browser-local inference is legacy fallback only; decision context rows do not change sense toggles |
| Founder stance | Tenant-scoped stance ratio now exists, but it is descriptive only | Sparse event history, mixed tenants, founder-level vs project-level activity, ties, inherited founder arcs, policy accidentally treating stance as instruction | Label stance only after 6+ current-tenant lane events; never infer from inherited founder progress |
| Next action policy | `operator-policy@v1.4` composes scored gate review priority with served risk/dependency plus quest frontier, tenant stance, skill tier, and optional complete `operator-priority-signals@v1`; the operator producer, capture command, audit command, and template exist, but real priority source facts are not yet populated | Ready stance with no reliable skills, reliable skills without promotion approval, stale envelopes, malformed gate items, all arcs complete, missing priority source, missing priority signals, rejected partial capture, read-only audit mistaken for capture, template file mistaken for source authority, multiple critical blockers, founder preference not served, owner overload visible but not capacity, economic state visible without amount, cross-tenant count visible without urgency, incomplete priority-signal file, stale complete priority file after source removal, active member revocation | Never show a recommendation unless the operator-policy source serves a ready action; gate recommendations are review-only and require evidence, consequences, reversibility, idempotency, risk, and dependency; `decisionContext` cannot change policy wording; only complete `operator-priority-signals@v1` can add ranking/cautions; incomplete source-backed signals and rejected captures block instead of preserving stale priority; audit can report gaps but cannot make policy ready; templates are scaffolds only |
| Skill Labors | Signed promotion review can be queued and consumed by the operator refresh loop, but production-KV proof is still pending | Skill rename, deprecated skills, low sample size, false mastery from repeated failures, stale envelopes without promotion fields, production status with weak telemetry, duplicate promotion taps, consume succeeds but local write fails, local write succeeds but consume fails | Under-sampled skills show `UNPROVEN`; declining skills show `DECLINING`; founder-review skills never become production inside the mini app; operator consumer re-checks registry telemetry before writing `production` |
| Mira relationship | Mira now has tenant-scoped cortex evidence plus durable NPC event history/advice/contradiction handling and deterministic mini app sheet smoke, and live-proof readiness records that Telegram device provenance is still missing | Stateless responses, private memory, tenant isolation, emotional overclaiming, non-Mira memory accidentally matching, stale cortex, duplicate memories, contradictory profile notes, unresolved advice after contradiction, fake-WebView parity drift, readiness artifact mistaken for live proof | Stages must be served from tenant cortex, founder arcs, or `.operator/<tenant>.npc-events.jsonl`; contradiction blocks advice; deterministic smoke and readiness packets must not be described as live Telegram proof |
| Gate chamber | Consequence preview, idempotency, and Paperclip-enriched open items now exist; real WebView layout still needs a viewport proof | Missing initData, non-founder user, duplicate action, stale queue item, reroll ambiguity, older thin open-item payloads | Every approval/reroll card must show evidence and reversibility, even when the evidence is an explicit missing-proof gap |
| Live Telegram proof | The mini app now visualizes the redacted live-proof capture plan, and the readiness audit can validate, scaffold, safely capture, and plan a redacted device-proof artifact, but no real founder WebView capture is present yet | Template mistaken for evidence, capture-plan `ready-to-capture` mistaken for evidence, mini app row styled as proof instead of guidance, raw initData pasted into artifacts, raw initData passed as CLI history, missing `TELEGRAM_INIT_DATA`/`TG_INIT_DATA`, tenant mismatch, stale capture, initData age exceeding Worker maxAge, direct Telegram user id exposure, WebView query/hash copied into proof, screenshot path outside proof directory, screenshot file missing, screenshot hash mismatch, local screenshot mistaken for WebView proof, network probe disabled | Only a complete `cambium.tg-device-proof.v1` artifact produced from fresh env initData with a matching local screenshot digest can mark the device row ready; templates, readiness manifests, capture plans, mini app guidance cards, and Chrome screenshots remain non-authoritative |
| Worker live proof | A redacted production Worker list-probe receipt now exists and validates ready, but it proves only non-mutating queue/list reachability | `--allow-network` mistaken for mutating evidence, missing token, bearer token stored in artifact, wrong Worker URL, wrong tenant, stale probe, template mistaken for proof, raw response bodies copied into docs, `/consume` accidentally used as a readiness probe, zero queued actions mistaken for a signed-action lifecycle proof, action payload privacy leakage | Only a complete `cambium.worker-network-probe.v1` receipt for `GET /internal/gate/<tenant>` can mark the Worker row ready; it proves status/shape/count/digest only; mutation routes stay reserved for explicit signed live smokes |
| Signed action smoke | The readiness audit can validate, scaffold, safely capture, and plan a redacted queue/list/consume/refresh receipt, but no live signed action has been captured end to end yet | Template mistaken for evidence, capture-plan `ready-to-capture` mistaken for evidence, capture run without `--allow-network`, capture run without `--allow-mutation`, raw subject stored, raw idempotency key stored, raw queued id stored, founder id stored, raw Worker response stored, token-like wording stored in notes, consume audit copied with private payload, duplicate queue treated as fresh proof, proof tool consuming the queue instead of the operator consumer, operator consume succeeds but refresh is stale, refresh marker missing from the mini app envelope, refresh marker does not correspond to the consumed action | Only a complete `cambium.signed-action-smoke.v1` receipt can mark the follow-up lane ready; the capture command may submit and list but must not consume; capture plans are run guidance, not evidence; base live readiness remains separate from mutating promotion/side-quest/NPC/gate smokes |
| Mobile viewport | Fresh Chrome mobile screenshots now exist and the readiness audit marks layout proof ready from a regenerated `manifest.json`; old `failure.json` and `browser-diagnostics.json` remain diagnostic history only | Browser default button styles, text wrapping, scene deep-link drift, Telegram chrome/safe-area differences, fixed bottom sheets that exist in DOM but are missed by full-surface capture, local Chrome/Arc CLI mode drift, diagnostic receipt mistaken for proof, direct Chrome probes starting a process without a listener, sandbox loopback `EPERM`, stale manifest newer/older ordering, readiness status confused with screenshots | Layout proof must use the real page export, real fixture API, selector-based scroll targets, saved artifacts, visible-geometry assertions for scripted interactions, and explicit CDP listener diagnostics when blocked; a newer failure receipt overrides an older manifest; diagnostics can explain blocked state but cannot replace screenshots; live readiness cannot substitute for screenshots |
| R3F sync | Runtime R3F now generates visual topology from `shared/cambium-visual-contract.ts`, and the generator reconciles shared stages against R3F metadata plus quest arc ownership | R3F route changes, arc remap, contract generator drift, old cache, shared contract forgotten in generator, new shared stage without pipeline metadata, duplicate quest arc ownership, pipeline title drift vs TG label | Keep drift tests green; shared contract owns visual topology and arc grouping; R3F may enrich but must not duplicate or silently orphan stages/arcs |
| Side quests | Side quests now merge pure trigger predicates with an operator-owned `.operator/<tenant>.side-quests.jsonl` runtime ledger, can queue signed `queue-side-quest` requests, the operator refresh loop can consume those requests after re-checking the current envelope, and live readiness now tracks the missing production proof | Expiring triggers, hidden quests, tenant-specific side quests, fake urgency, duplicate triggers, old envelopes without sideQuests, proof strings that look like rewards, action labels that imply browser execution, stale queued events, completion after expiration, unknown side quest ids, queued action for a branch that vanished before consumption, consume succeeds after local write, consume fails after local write, Paperclip unreachable during re-check, readiness artifact used as a queue result | Side quests appear only from served predicates with trigger, origin, proof, owner, action, lifetime, completion, and optional operator history; Telegram may queue a signed request, but only the operator consumer may write side-quest state after a current-envelope re-check and must never render reward/social-proof language; live readiness describes missing proof and cannot mark a branch queued |
| Social layer | Coordination rows now visualize Paperclip/handoff/founder-gate/client-handoff evidence, but no live team availability or member presence source exists yet | Privacy, cross-tenant leakage, leaderboards, revoked member token, old envelopes without `social`, handoff owner names shown outside tenant scope, popularity language creeping into copy | Social visuals must be opt-in, tenant-scoped, source/proof-backed, and must never render leaderboard, popularity, or generic social-proof claims |
| Decision context | Advanced priority dimensions are visible as source/proof-backed context; complete `operator-priority-signals@v1` can now make all six rows served and policy-consumable, and the producer/capture/audit/template commands expose ready/blocked/gap/source-scaffold state from explicit source state | Old envelopes without `decisionContext`, owner names mistaken for capacity, project commitment mistaken for economic risk score, tenant count mistaken for urgency, founder preference fabricated, revoked member state absent, context rows copied into policy text, malformed priority-source JSON, malformed priority-signal JSON, source missing after stale ready file, partial capture preserving stale authority, audit writing files, template writing authority, priority signals served but member revoked | Render served/gap rows exactly as context; empty envelopes show explicit gaps; only complete `operator-priority-signals@v1` may promote rows into `operator-policy` required signals; missing source with no prior file remains non-authoritative; rejected partial capture or incomplete/revoked priority state blocks recommendations; audit stays read-only; template writes only `.priority-source.template.json` |
| Tapestry audit | The mini app now shows a completion-definition audit, but it is only as strong as the rows it summarizes | Audit row marked ready while underlying proof is blocked, partial envelopes, stale freshness, live-proof guidance mistaken for live proof, R3F contract present while runtime proof is missing, gate row hidden when no open items exist | Audit rows must summarize existing source-backed sections, expose proof/source on tap, and remain wait-state when the underlying feature is visible but not proven |

## Next implementation slices

1. Start each live-proof run from the mini app `live proof` map section or the `capturePlan` field in `docs/plans/assets/tg-miniapp-live-proof/readiness.json`; treat `ready-to-capture` as run guidance, not proof.
2. Run `TELEGRAM_INIT_DATA=<fresh WebView value> node workers/quests/src/live-proof-readiness.mjs --capture-device-proof --screenshot docs/plans/assets/tg-miniapp-live-proof/<founder-device>.png --platform <ios|android|desktop> --webview-url <current Telegram WebView URL> --safe-area <notes> --write` after saving the real founder-device screenshot under the proof directory.
3. Keep `docs/plans/assets/tg-miniapp-live-proof/worker-network-probe.json` fresh by rerunning `node workers/quests/src/live-proof-readiness.mjs --capture-worker-probe --allow-network --write` only when the receipt expires or the Worker URL, tenant, or token changes; keep it scoped to non-mutating list-route proof.
4. Run `TELEGRAM_INIT_DATA=<fresh WebView value> node workers/quests/src/live-proof-readiness.mjs --capture-signed-smoke --allow-network --allow-mutation --action-kind <promote-skill|queue-side-quest|approve|reroll> --action-subject <subject> --action-idempotency-key <key> --operator-command "<consumer command>" --operator-audit <audit-file> --operator-checked <n> --operator-consumed <n> --operator-rejected <n> --miniapp-envelope <refreshed-envelope-file> --visible-marker <visible-card-marker> --write` after a real operator consume and refresh proof packet exist.
5. Add a live NPC-history smoke when production Worker KV, real Telegram `initData`, and device access are available.
6. Add a live signed-promotion smoke: Telegram tap -> worker queue -> `quine write skills apply-promotions` -> audit -> refreshed mini app card.
7. Populate real `.operator/<tenant>.priority-source.json` facts or wire upstream systems into `priority-source`: founder preference, capacity/availability, economic amount/currency, revocation, and urgency proof.
8. Keep viewport proof fresh by rerunning `npm run proof:tg-viewport:diagnose` and `npm run proof:tg-viewport` after mini app UI changes; treat a newer `failure.json` as superseding the manifest until screenshots regenerate.
9. Add a live signed side-quest smoke: Telegram tap -> Worker queue -> `quine write quests apply-side-quests` -> `.operator/<tenant>.side-quests.jsonl` event -> refreshed mini app history.
10. Promote local wake-event history into a production event stream only after signed Worker ingest and tenant-scoped retention rules are explicit.
11. Extend the tapestry audit only after adding a new source-backed section; never add audit rows that cannot point to a source/proof pair.

## Completion definition

The 90-point plan is complete only when the mini app can open as a pocket map and show, from current evidence, the active organ, wake health, quest frontier, evidence boxes, skill mastery, founder stance, Mira relationship, gate consequences, command state, memory senses, decision context, stale/offline gaps, and R3F-compatible visual contract without fabricated progress.
