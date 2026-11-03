# Cambium operational loop — next-session handoff

4 November 2026, Asia/Calcutta. Status: Work-source and shared-direction code
implemented, reviewed and deployed; canonical Work decision pending.
The full signal → direction → approved work → result loop is **not accepted**. Continue this task; do not report the prior
Inbox test as an execution-loop test.

## Current live checkpoint

The separately approved founder-only30second read deadline is deployed as
`e6c399ab-f2da-479c-9b40-bce6629bdeee` at100%. All52bindings and runtime settings
match the previous version; rollback is `5f2c5dc7-e57a-47a8-89f3-0f64f6c29841`.
Zen Thoughtseed Labs now shows scoped source read and **Founder signing ready**.
Browser security was not changed. Use this profile; do not switch to Chrome.
Migration0103 was already applied during the initial5f2c rollout; do not repeat.

The maintained proposal form had a separate old-schema allowlist. Reviewed fix
`c6948057` accepts the exact operational Work intent while retaining legacy
bookkeeping. It rebuilds the maintained world bundle and refreshes six actual
local synthetic desktop/mobile IAB proofs. Curious tests, proof validation and
Worker dry run pass; full2717tests pass. A separate pinned rollout packet is
`FOUNDER-WORK-FORM-ROLLOUT-20261104.json`; owner rollout approval is pending.
Current production still has the old form parser. No Work is submitted/approved,
no native Work/direction live proof, and no admission or Hermes execution exists.

A finite next coding input is prepared locally on branch
`codex/cambium-code-pilot-input-20261104`, commit`c4cc221f`, base`d571ea92`:
reject whitespace-only shared signal titles. Exact two-file patch digest is in
the JSON; baseline RED and candidate8checks pass. This is input preparation,
not admission, hosted execution, a terminal result or semantic acceptance.

## Source checkpoint before rollout


PR428 merged at `d571ea92`. Continue branch
`codex/cambium-real-work-loop-20261104`, source `71005ef6`.
The explicit operational Work schema remains separate from founder bookkeeping.
It compiles against the observed head and uses the existing canonical Gate/D1
approval path. Only its coherent committed source emits Cambium Work; catalog
membership still grants nothing. The web Gate now displays these proposals.

Shared direction drafts have a real D1 store/migration, revision CAS, exact
operation receipts, scoped HTTP route and native composer. The saved draft pins
signal revisions and canonical D1 Work/head. The native button is available for
saved Cambium signals; no direction approval, admission or launch is implied.
Three review findings were fixed: transport size limit, canonical digest spelling
and updates to a Work that is the tenant root. Compatibility/torn-read and privacy
regressions are resolved. The full suite passed2714 at `0d51e581`; all34 Gate
checks cover the final proposal-list delta. Core265 (two opt-in skips), native43,
Worker dry run and clean signed native bundle pass. Real native direction UI and
save/readback still await deployment and sign-in.

Review `.planning/native-mac/WORK-DIRECTION-ROLLOUT-20261104.json` and
`CAMBIUM-WORK-INTENT-20261104.json`. The founder refreshed Cloudflare login;
fresh read-only head11/root and52binding Worker version23cf59d1 read succeeded.
No new migration, traffic change, graph write, admission, runner invocation or
rollout has occurred. Keep original migration0099 source-only. Production rollout
and the exact canonical Work decision are separate owner gates.

Actual Hermes release is `e3387543` (not local source09280487); installed code
has canary/document draft only and no Cambium/source-verification command.
Docker is available. Prepare the finite isolated coding capability against that
installed baseline; do not deploy unrelated newer Hermes features or use the
ordinary runner as a diagnostic.

## Owner request and settled choices

Wire the real `sapling:cambium` operational Work join and prove one small code
change with tests and a reviewable diff through the whole loop. Cambium owns
approval, launch coordination and readback. The founder explicitly selected
**the existing hosted Hermes runner** as execution owner. Hosted Phloem remains
`https://omniroute.thoughtseed.space`; bounded model work uses `noesis-free`,
including promotions only when admitted by OmniRoute to that pool. No paid
fallback or routing edits. The desktop coordinator retains its native model.

Both surfaces may create signals/draft directions; Cambium approves and launches.
Signal associations may start in Inbox, but approved work requires an exact
WorkObject and operational join. AI drafting is on request. Acceptance policy
is reusable by work type and pinned at approval; missing/failed/inconclusive
checks require review. Field Report spatial editing and peer migration remain
separate. Do not reopen these choices.

## Source and preservation

- Base: merged Cambium PR427, `b6652fcf991eba804cffeaa38d2d265c10218532`.
- Current branch: `codex/cambium-real-work-loop-20261104`; prior sign-in branch retained.
- The primary checkout is divergent and heavily dirty with concurrent catalog,
  planning and native work. Preserve it. This branch starts from remote main.
- Prior acceptance/rollback: `NATIVE-INBOX-ACTIVATION-20261103.md`.
- Current sign-in code/tests are on this branch; obtain its current HEAD and
  embedded build proof rather than assuming the first sign-in commit is final.
- Hermes source inspected read-only at `09280487ca12b18448ff236d160e070b8cd5dfbd`.
  Its primary checkout has planning/runtime metadata edits. Preserve those;
  start an isolated branch before any Hermes implementation.

## What is verified

The earlier real standard-mode Mac test verified founder sign-in, scoped
76-current/20-historical catalog, source digests, and signal capture/read/edit.
The retained signal is titled “Native Inbox activation verification”, revision
3, associated with `sapling:cambium`, and was read after refresh in the exact
project Inbox. It is a source annotation, not a task, approval or execution.
Sessions last 15 minutes and remain in memory. Reauthenticate for new live tests.

This branch adds Sign in to the main window and sidebar, applies the reviewed
profile only on that explicit action, routes to Connections, and shows Sign in
again after expiry. Invalid configuration refuses before browser presentation;
demo stays synthetic. Old owner invalidation must finish before a new shared
browser presentation starts; otherwise a late cancellation can cancel sign-in.
Core: 261 checks with two opt-in skips. Native: 43 tests, including four entry/
expiry tests. Build/signature and actual UI observations belong in the JSON
handoff's verification fields once collected. No new workflow execution follows
from these sign-in checks.

The signed candidate's buttons were observed in the actual Mac window. Clicking
the main button configured the reviewed owner and entered pending authentication.
The owner confirmed that a login/authentication window is visible. No fresh
session or complete browser grant is claimed for this candidate.

## Native UI cleanup — current build

The account screen now shows a compact sign-in/account card and named connected
sources. Standard mode has no permanent owner/status banner. Inbox uses project
names, an expandable searchable project picker and concise save feedback. Project
records show their name, category and available actions; a missing runtime Work
still visibly says it is not connected.

Open **Settings → Advanced → Open diagnostics** for owner URL/client/callback,
principal and tenant IDs, graph/catalog digests, runtime join counts, source
provenance and selected-record identifiers. These remain inspectable without
appearing throughout daily workflows. Done closes the separate sheet.

Current UI source is `90eb3c466702a95453712df5b026fa729e1bc7d6`; the JSON records its clean
bundle input digest. Core261 (two opt-in skips), native43, build and signature
checks pass. Actual Mac checks covered signed-out Connections and the Diagnostics
open/close path, plus labelled demo Projects/Inbox and named project choices.
The final copy-only build was reopened. No fresh live session or operational-loop
acceptance is implied. The original sign-in-only proposed patch below remains
separately pinned; it does not include this UI cleanup.

## Fresh runtime facts and actual gaps

Scoped read-only D1/control-plane checks on 4 November found:

- Zero `goal_graph_nodes` anchored to `sapling:cambium` in tenant `cambium`.
- `native_launch_admissions` and `native_launch_requests` tables absent.
- No launch-owner bindings in the deployed Worker metadata. Current `index.ts`
  composes native sessions but does not compose a `nativeLaunchHost`.
- Existing acceptance public-key and wave0 activation binding names are present.
  Presence alone does not prove their scope or eligibility for Cambium coding.
- The real served portfolio reports zero operational runtime joins.

The inspected Hermes source supports `canary.record`, service-agreement drafting,
and finite `source_verification.accept`. Its source-verification registrations
cover WTFMedia, ParkArea and Relovo, not Cambium. This is **source evidence**;
the installed runner revision/configuration and an eligible Cambium execution
capability still require bounded live readback. Queue delivery/intake ACK is not
terminal execution or semantic acceptance. Do not use the ordinary runner CLI as
a read-only probe: it can heartbeat, execute and ACK.

Founder bookkeeping intake intentionally allows only Lumen Bar and Temperance/
Hermes bookkeeping and refuses execution metadata. Keep that boundary. A free
model's suggestion to add loadout/admission metadata to this bookkeeping lane
was rejected; it is not an implementation instruction.

## Implement in dependency order

1. **Real Work source.** Prepare a narrowly scoped founder-reviewed operational
   Work intent for `sapling:cambium`, with required owner/state/proof/source
   fields, bound to the current D1 graph head. Reuse canonical Gate/CAS and its
   exact verified founder/tenant binding. Introduce an explicit operational-work
   schema/namespace if needed; catalog membership and bookkeeping may not mint
   this authority. The read adapter emits Work only from that approved source.
   Verify the exact ID in the actual native join report and Work dossier.
2. **Direction storage and UI.** Add revisioned shared direction drafts linked
   to exact signal IDs/revisions and selected evidence. Reuse native-session
   composition, tenant/principal isolation, operation receipts and revision CAS.
   Preserve the original signal. Bind the selected project to the served Work
   join. Make edits invalidate any earlier approval pins. Do not reuse a local
   JSON file as if it were a shared saved direction.
3. **Finite Hermes capability.** Extend the existing reviewed Hermes command/
   Temperance owner policy for the exact Cambium pilot; no arbitrary shell or
   generic repository-write command. Pin source/base commit, patch/input digest,
   WorkObject, loadout/cluster, acceptance policy and stop/budget bounds. Resolve
   runner/member and owner signing references through their existing owners.
   Verify the installed supported capability and status/receipt semantics.
4. **Approval and admission.** Extend the existing canonical founder review to
   include direction revision, signal revisions, Work join/head, expected artifact,
   policy ID/version/digest, budget and stop conditions. Approval and execution
   admission remain separate events. Add a reviewed owner admission producer;
   do not INSERT an active row manually or auto-approve as the founder.
5. **Launch adapter.** Reuse `native-launch.ts`, `native-launch-d1.ts` and the
   existing Hermes bridge claim/outcome/ACK protocols. Reserve the durable request
   before owner submit. The existing `NativeLaunchExecutionOwner` must support
   the exact `hermes-remote` capability and deduplicate on requestKey. A lost
   response permits status-only recovery, never redispatch. Migration 0099 is
   source-only at pickup; review/apply exactly the required migration with a
   recovery receipt after source and owner wiring are ready.
6. **Result and acceptance.** Read the original attempt's immutable artifact
   digest, reviewable diff and test receipts. Result ready is separate from
   accepted. Use existing terminal admission/foldback and attested acceptance
   owners; pin the policy and exact artifact/attempt. An executed transport
   attestation or successful inference cannot establish semantic acceptance.
7. **Real walkthrough.** Sign in, select the retained signal, save a direction,
   review/approve exact pins, obtain admission, launch on hosted Hermes, read
   terminal result and check acceptance/exception behavior. Save bounded evidence
   and update only criteria actually met. Keep token/cookie/native session IDs,
   private prompts, response bodies and host paths out of tracked receipts.

## Smallest proposed pilot

Use the prepared visible sign-in/expiry patch as a candidate input artifact, or
a similarly small owner-reviewed Cambium change. It is already local source;
do not retroactively claim its implementation ran through native approval.
If selected, the admitted Hermes task applies/verifies the pinned patch in its
isolated Cambium checkout and returns the diff, Core/native test receipts and
artifact digests. It may not merge, publish or deploy automatically. Review the
exact code diff and base before admitting that task.

Candidate patch SHA-256:
`b2a52eeb4974ed555d2d44197d50482136c93dd2f8861d0966c0660d88a3cf9f`.
Reproduce with `git diff --binary b6652fcf 1f64c646 -- apps/cambium-mac`.
This is a reviewable proposed input, not an admission or signed work packet.

## Relevant existing contracts

- `workers/quests/src/native-session-composition.ts`, `shared-signals.ts`.
- `workers/quests/src/goal-graph/compiler.ts`, `goal-graph-store.ts`,
  `founder-gate.ts`, `native-goal-intake.ts` (bookkeeping boundary only).
- `workers/quests/src/mission-fabric.ts`, `handler.ts` (served Work composition).
- `workers/quests/src/native-launch.ts`, `native-launch-d1.ts`, migration 0099.
- `workers/quests/src/terminal-admission.ts`, `wave0-owner-bindings.ts`,
  `hermes-execution-foldback.ts`, `accepted-work-unit-attestation.ts`.
- Hermes `src/contracts.ts`, `src/native-execution.ts`, `src/runner.ts`,
  `docs/runbooks/directive-queue-observability.md`.
- `FIELD-REPORT-INTEGRATION-PLAN.md` stages B/C remain the finite product plan;
  this handoff selects its next implementation slice, not a second planner.

## Verification and delivery boundaries

Test foreign tenant/principal, stale source/direction revision and graph head,
revoked membership, duplicate/changed operation, policy substitution, missing
capability, request/attempt replay, lost launch reply, original-attempt recovery,
missing artifact, stale/inconclusive checks and duplicate terminal receipts.
Run real SQLite store tests, cross-language wire checks and native tests. Use
an independent Git checkout for the full suite to avoid shared-worktree snapshot
races. Do not weaken existing authority/privacy checks to obtain green results.

No new bridge, resident organ, scheduler, global hook, routing mutation, private
key in the Mac, manual acceptance row or fabricated Work/receipt. Do not reopen
registration/migrations 0100–0102 or repeat the completed activation task.
Future PR merges and production/runner rollout require the applicable concrete
owner approval and rollback gates; a handoff grants neither automatically.

## Paste into the next session

Continue the Cambium operational-loop task from this handoff and its JSON state.
Preserve dirty primary work. Hosted Hermes is the selected executor; Phloem
noesis-free is inference only. Finish the real approved operational Work join,
revisioned directions, reviewed Hermes capability/admission adapter, then prove
signal → direction → approved work → result in the actual signed-in Mac app.
The prior Inbox test and new local sign-in entry are verified within their
recorded limits; the full operational loop remains unimplemented. Read current
source and live owner capabilities before effects. Keep bookkeeping-only and
execution authority separate. Update ISA and the existing structured continuation
with bounded facts and the next concrete action.
