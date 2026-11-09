# Temperance hand-in-glove integration and architecture storytelling handoff

Date: 2026-11-02. Status: reviewed discovery and next-chat brief; integration not implemented by this handoff. Acceptance remains in each owning repository's ISA. This document is a public-safe synthesis of source contracts, not a copy of private runtime notes or state.

## Founder decisions and current delivery

The target is **portable Temperance core + optional personal/company glove**, explicitly selected by the founder. The product category remains AI operator system. The fuller story must explain organs, Koshas and infrastructure, and the website should become a larger interactive architecture experience. Use the founder's 5,000-word ceiling for website editorial copy; do not treat it as a Product Hunt field capacity.

**Current Product Hunt state supersedes the earlier unscheduled checkpoint:** the live reviews page and launch editor show **November 6, 2026, 12:01 AM PST**. The founder explicitly chose to preserve that schedule. This is November 6 at 1:31 PM in Asia/Kolkata. The agent did not schedule or reschedule it. Keep the date while editing copy; do not unschedule, reschedule, create another listing or advance a publication control. LumenBar remains untouched. Earlier unscheduled proofs are valid dated observations, not current instructions.

Product Hunt's existing Description editor visibly displays `303 / 500` when focused: the short description has a **500-character** limit. Do not use the reviews composer for maker/launch copy. Prepare longer architecture material for the website and a maker-comment draft, checking that destination's actual limit before saving it. No maker comment was posted or limit verified in this discovery.

Existing work to preserve:

- Product: `Sheshiyer/temperance_engine`, public main `42b391b44b7655972d9322d87aa3865956a5165e`, released VERSION0.8.0. The primary app tree is dirty and behind; no commits from it.
- Personal reference: `Sheshiyer/noesis-cambium`, source HEAD `5e764dbfebe1122d76753a42435c3d85e610553a`. Its checked-out runtime has56 dirty entries; `bin/te-vestibule.sh` and `bin/te-adytum.sh` differ from that source revision. Neither HEAD nor a dirty file proves the bytes a running process loaded.
- Website: `Sheshiyer/temperance_engine_landing_page`, production main `5c5838331b5b8d9207d0c26aeb67dce17e6fe411`. Cinematic restoration is draft PR https://github.com/Sheshiyer/temperance_engine_landing_page/pull/1 at `7e55a2673a01a0c9dd114b9b23bb9ca21499e91b`; verified code is its parent `c930af92d3176e0b0a2a9ad1b382c9c6273744d9`. Continue from this restoration, not the old static site.
- Review preview: https://temperance-engine-landing-page-mitxrimmj-sheshiyers-projects.vercel.app/ . It is a verified five-section baseline, not the requested larger architecture site. Production remains the prior deployment; no promotion is authorized by this handoff.
- Product Hunt: https://www.producthunt.com/products/temperance-engine?launch=temperance-engine ; existing editor https://www.producthunt.com/posts/temperance-engine/edit . Current tagline is “A shared operating layer for your AI coding tools”. Preserve identity, website, source, maker, art and tags while improving the story after source reconciliation.
- A clean application branch `codex/operator-positioning-review`, based on42b391b, has README introduction/badge alignment staged only. Its schedule label is now prepared for November6; current prepared README SHA-256 is `c8f928091c3c19b5805afb5b9ac94f0bf5a59f06f5724cc5304f1d51f25a2330`. It remains uncommitted/unpushed. Earlier prepared hash0d021793 is superseded.

## Ownership and language

Terminology: the existing V4 contract calls the portable Temperance product the **glove** and the selected profile the **hand**. The founder-selected “optional personal/company glove” option refers to that optional profile/overlay; preserve existing technical contract names rather than renaming or reversing their semantics.

The public product owns the generic kernel, modules, installers and adapters. Noesis Cambium owns the optional personal profile and host/company bindings. Cambium owns company WorkObjects, Gate, tenant admission and result lineage. Hermes remains a separate execution plant; OmniRoute owns provider credentials, models, combos and fallback. PAI and GSD retain their real names and upstream ownership. Manifest/Speculum is a projection, not another planner or launch authority.

Do not conflate three uses of “organ”: **advisory organs** such as Vestibule; **onboarding infrastructure modules** such as router/memory/tunnels; and **Cambium company operating organs** such as Genesis, Taste, Hands, Will, Cortex and Garden. They can be related through explicit adapters without becoming the same module or ownership authority.

Koshas are descriptive layers in the current code, not processes or enforceable security partitions:

| Kosha | Plain-language layer | Work it primarily classifies |
| --- | --- | --- |
| Annamaya | Substrate | Files, configuration and material changes; Build |
| Pranamaya | Execution and telemetry | Admitted execution lifecycle; Execute |
| Manomaya | Context and memory | Bounded evidence and orientation; Observe |
| Vijnanamaya | Reasoning and judgment | Think, Plan and Verify |
| Anandamaya | Purpose and learning | Proven outcomes and proposed lessons; Learn |

The seven-phase loop remains Observe → Think → Plan → Build → Execute → Verify → Learn. Cross-Kosha arrows express information flow; they do not grant access, dispatch, credentials or acceptance.

## Evidence-backed porting map

Sources below are relative to the owning repository at the pinned revision. Source presence, installation, runtime health, an actual provider attempt and acceptance are separate evidence levels.

| Area | Public product already has | Remaining integration/reconciliation |
| --- | --- | --- |
| Kosha/phase projection | `package/router/phase-projection.v4.ts` declares all five Koshas and maps the seven phases, with presentation-only authority | Private `router/v4-kernel-contract.ts`, `alchemy-stage-hub-map.v4.json`, `phase-combo-core.v4.json` and skill/dispatch contracts define a broader kernel. Those filenames are absent from the public tree. Reconcile functionally; filename absence does not mean every capability is missing. |
| Composition | `package/install-surface/src/composition/` implements strict identity/dependency/freshness validation, lifecycle, observations and owner projections | Private composition-root/module admission/dispatch wiring is a different structure. Reuse the public authority; do not introduce a second composition planner or ledger. |
| Six advisory organs | Public IDs, subscriptions, dependency ordering, injected handlers/atomic ledger, replay protection, cancellation and unsettled outcomes | Concrete scripts and the Thoughtseed-bound owner adapter remain private. The public runner provides no storage, process, network or provider adapter and is not a sandbox. |
| Containment | Optional `package/organ-guard/` source promotion and explicit install profile | Public822-line script matches declared private commit `b57931b11859cdd5ab39fa14160abf093dd2139f`, SHA-256 `289643f5955ec243564728bf952e36e768cc8cb20430aa3d64766a4b674ab478`. Private current source is988lines with later pressure/process/lock changes. Review these as a separate promotion; no whole-tree refresh. |
| Git/Hands | Public `src/execution/git-hands-envelope.ts` checks Git/worktree/ISA/task evidence and lease structure | Its output explicitly grants no execution, capacity or lease authority. The admitted executor and host enrollment path need their own portable adapter and proof. |
| Headless/remote | `package/headless/` shadow inspection and additional Python composition/observation source | The release holds Python runtime/ABI/command execution, native lifecycle and plant canary/release proofs. Do not present source inspection as accepted hosted execution. |
| Onboarding infrastructure | Required OmniRoute router and Temperance memory; modular local router, knowledge volume, vault/memory tunnels, Hermes A2A/tunnel; optional Obsidian REST/tunnel and Mail MCP | Actual endpoints, paths, account references and credentials belong in selected private bindings. Selection and health probes do not install or admit every module. |
| Routing | Release0.8.0 and `docs/COMPATIBILITY.md` make OmniRoute3.8.51 the default | V4 architecture/session prose still describes9router as successor/default. `te-*` aliases survive in historical adapters. Update prose/compatibility deliberately; no retired-alias activation or provider change. |
| Retired surfaces | Public composition code rejects `projection.constellation` | Composition prose still names it optional; other docs retain Superset-era language. Superset and Constellation are retired and excluded from integration targets. |

Advisory organ roles and adaptation constraints:

| Organ | Story and proposed portable responsibility | Boundary to preserve |
| --- | --- | --- |
| Vestibule | Session orientation from selected project/context evidence | Start with an injected, read-only orientation handler. Private script also has helper/refresh paths; do not import those as an implicit read route. |
| Adytum | Deeper interpretation and next-action proposals | Keep independent memory-plane provenance; do not merge or export personal stores. Depends on Vestibule. |
| Nutrix | Turn attributable outcomes into learning proposals | Distinguish a proposal from canonical memory writes or outcome acceptance. |
| Auspex | Diagnose organ/infrastructure health | Portable default is diagnostics-only; private repair behavior needs a separate authorized action. |
| Circulator | Review accumulated outcomes and lessons | Manual bounded review first. No weekly scheduler or automatic policy change. Depends on Nutrix. |
| Praeceptor | Propose better skills and workflows | Proposals are reviewable; promotion and provider inference need their own authority. Depends on Nutrix. |

## Integration sequence for the new chat

1. Recheck current remote heads, dirty work, in-flight feature branches/PRs and owning instructions. Preserve existing prepared README and website PR. Use clean isolated implementation branches; the installed personal runtime is a read-only reference in this task.
2. Reconcile the generic phase/kernel contract with the public composition/lifecycle implementation. Promote only pure state transitions, Kosha metadata, skill/lane intent and bounded receipt types needed by the public system. Parameterize personal aliases and roots. Keep adapters injected and missing optional capabilities honestly unsupported/held. Do not vendor an independent planner, acceptance writer or provider registry.
3. Prove a minimal portable run without Noesis, Cambium, a provider, a UI, private memory or mounted personal storage. Use synthetic fixtures and disposable state. Preserve exact run/phase identity, dependency ordering, source provenance, replay refusal and truthful terminal status. Do not manufacture an accepted result verifier where one is missing.
4. Adapt **one advisory organ first: Vestibule orientation only**, through a bounded public handler/context-provider interface. Prove lifecycle callback and consumer readback with synthetic inputs. Installation/rollback receipts and real callback linkage are separate from source tests. Keep the other five as declared/optional until their adapters and evidence exist.
5. Review later organ-guard changes as an independent source-promotion slice with attribution, retained policy semantics, pressure/cancellation/lock fixtures and explicit platform limits. No organ implementation, scheduled job, repair or hosted callback is activated automatically.
6. Reconcile current architecture docs and create a public capability matrix before expanding claims. Maintain the public release boundary; do not bump VERSION or claim a new qualified release just because a branch passes fixtures.
7. Expand the restored website and prepare channel copy from that matrix. Verify another preview in IAB and retain the public website until owner review. Product Hunt edits preserve the founder-confirmed November6 date and all listing identity/links/maker fields.

## Expanded interactive website brief

Keep the approved hero and recovered cinematic design as the starting point. Aim for2,500–3,500 words with a hard ceiling of5,000 editorial words, including expanded explanatory panels. Progressive disclosure should make the page useful without requiring a long uninterrupted read.

| Section | Content and interaction |
| --- | --- |
| 1. Product promise | Existing shared-operating-layer headline, concrete audience and primary exploration CTA |
| 2. One complete work cycle | A clearly labelled illustrative task; scrub/click through intent, work and proof without implying a live run |
| 3. Architecture at a glance | Accessible interactive graph of core, adapters, organs, infrastructure and external systems; readable list fallback |
| 4. Five Koshas | Select a layer to highlight relevant phases and responsibilities; plain-language names beside Sanskrit terms |
| 5. Seven phases | Stepper showing inputs, outputs, skill intent and verification responsibility; actual code evidence links |
| 6. Six advisory organs | Select an organ for role, dependencies, read/write behavior, owner and current porting/evidence state |
| 7. Infrastructure | Router, memory, local services, skills/search, tunnels and optional remote transport; generic topology only |
| 8. Core and glove | Toggle portable core / personal profile / company integration to show optional additions without importing private data |
| 9. Model routing | Explain native coordinator, per-step routing and provider ownership; no frozen provider/account roster |
| 10. Skills and workflows | Discovery, lazy loading, GSD/PAI and reusable lifecycle packs; examples tied to supported surfaces |
| 11. Memory and learning | Attributable evidence, separate memory planes and proposals; no claim of autonomous canonical-memory updates |
| 12. Evidence and control | ISA criteria, exact receipts, explicit approvals, cancellation/replay and rollback boundaries |
| 13. Available now / optional / held | Public capability matrix using shipped/draft/held/gap plus source/installed/runtime/accepted provenance |
| 14. Guided setup | Inspect → dry run → choose modules/profile → verify. Dependencies and platform requirements disclosed |
| 15. FAQ, docs and credits | Deployment/local-first questions, current release limits, dependency attribution, source and Product Hunt link |

Interactions are read-only educational projections. Do not add web buttons that dispatch real work, authenticate providers, read local private data or enable organs. Mark example receipts and runs as illustrative. Every interactive view must support keyboard access and reduced motion, preserve focus, work at320px, and expose equivalent text. Keep meaningful current motion rather than adding decorative controls. No fake metrics, testimonials, benchmark claims or fabricated terminal success.

A source-safe candidate short Product Hunt description for later review (not saved by this discovery):

> Temperance Engine gives AI coding tools a shared operating layer for project context, skills, model routing and verification. Its architecture maps seven work phases to five Koshas and defines optional organs for orientation, health and learning. Start with a portable core, add a personal or company profile, and choose the integrations you need.

The final description must reflect the new branch's actual public evidence, fit the confirmed500-character editor and retain the existing schedule. Longer maker copy should explain the architecture, why it exists, what is ready, and how to evaluate it; verify its actual channel limit first.

## Verification baseline and next gates

Executed from the clean application review checkout on42b391b (only README staged):

```sh
bun test package/router/phase-projection.v4.test.ts \
  package/router/surface-portability.test.ts \
  package/install-surface/test/composition.test.ts \
  package/install-surface/test/composition-lifecycle.test.ts \
  package/install-surface/test/composition-projection.test.ts \
  package/install-surface/test/composition-owner-projection.test.ts
```

Result: **85pass,0fail,415expect calls across6files**. These prove the current public source contracts only. Private fixtures, organ containment canaries, actual callbacks, installation, hosted authentication and clean-host acceptance were not run by this discovery.

New source work must additionally test illegal phase transitions, missing optional adapters, duplicate/dangling modules, rejected/private/cross-plant inputs, stale observations, wrong run identity, concurrent replay, ignored cancellation, callback/ledger failure, no implicit effects, no-profile startup, install preimages and rollback. Inspect fixture behavior before running any test that starts processes or touches host state.

Website verification must cover all interactive states, keyboard and reduced-motion equivalents, mobile overflow, links, canonical/social metadata, meaningful build tests and IAB readback. Preserve existing Vercel protection and production reference. Product Hunt verification must reopen the same launch, read back changed fields and confirm **the November6 schedule is unchanged**.

v1.1 clean-host, live hosted-router authentication, qualified long-context and durable recovery remain held. Historical product graphs remain rejected with no vault receipt. Current source tests, a schedule, the website preview and this handoff do not close those gates.
