---
schema: cambium.product_branch_packet.v1
product_id: lumen-bar
canonical_work_id: sapling:lumen-bar
identity_scope: canonical-work-object
branch_kind: product
name: LumenBar
role: Shipped Mac menu-bar product, proof-only inside Cambium
promotion_state: proof-only
current_gate: Product Hunt is scheduled for November 3, 2026 at 12:01 AM PST. Next loop is Temperance.
packet_owner: cambium
---

# LumenBar Branch Packet

LumenBar is a proof-only Cambium Sapling reverse-engineered from two product-loop runs. Test 1 accepted the LumenBar graph and wrote `thoughtseed-labs/20-operations/agent-outputs/lumenbar-product-loop.md`. Test 2 ran the same loop on Temperance Engine and the fence rejected it. No Temperance receipt was written.

The HITL decision is to keep LumenBar as the sapling and not launch Temperance from that graph. The public LumenBar home stays `https://lumenbar.thoughtseed.space`. The founder confirmed on 2026-11-01 that the Product Hunt launch is already scheduled. The YouTube film is already public. The open move is the listing website field.

This packet does not admit a D1 goal, mint a loadout digest, or deploy the quests worker.

## Product Seed

| Field | Value |
| --- | --- |
| product_id | `lumen-bar` |
| branch_kind | `product` |
| one_sentence_seed | A local macOS menu-bar app that warms every display through the evening, with no account and nothing sent off the Mac. |
| founder_intent | Record the accepted LumenBar product loop as a Cambium sapling and hold the rejected Temperance launch. |
| target_customer | A person who works late on a Mac and wants warmer light on each display. |
| pain_or_desire | Night Shift and one-screen filters leave a second monitor bright. |
| offer | Free notarized LumenBar 1.2.0 for Apple silicon, plus the public site. |
| survival_metric | One stranger can download the notarized disk image from the public release. |
| better_than_survival_metric | The Product Hunt listing names the live site and its preflight boxes are checked. |
| GTM_channel | Public GitHub release, `lumenbar.thoughtseed.space`, a Product Hunt launch that is already scheduled, and the public YouTube film. |
| constraints | Do not unschedule Product Hunt. Do not treat the rejected Temperance graph as a launch. Change only the listing website field. |
| third_party_apps | GitHub, Cloudflare Pages, Apple notarization, Product Hunt, YouTube. |
| autonomy_boundary | Proof-only. The graph may read and record. Publishing, DNS changes, and Product Hunt edits stay behind a separate founder approval. |
| approvals | Product Hunt website URL, four preflight boxes, YouTube visibility, and any Temperance release. |

## Organ Routing

| Organ | Owner | Input | Output | Proof Path | Current Gate | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Genesis | LumenBar brief | `lumen-bar/docs/BRIEF.md` | Product seed | Test 1 receipt | brief still says macOS 15+ and a graphite accent | pending |
| Taste | LumenBar site | Cinematic page in `lumen-bar-web` | Public home | `https://lumenbar.thoughtseed.space` | live title checked in test 1 | complete |
| Hands | App and site repos | `Sheshiyer/lumen-bar`, `Sheshiyer/lumen-bar-web` | Shipped app and site | Test 1 receipt | no Cambium deploy | complete |
| Will | Scheduled Product Hunt launch | `marketing/producthunt/LISTING.md` | Launch stays scheduled; website field is stale | Founder HITL 2026-11-01 | website field | ready-for-review |
| Cortex | Product-loop receipt | Accepted LumenBar graph | This packet | vault receipt | Temperance graph excluded | complete |
| Hermes | Founder command bus | HITL decision | No Telegram post from this packet | none | do not use Telegram as the graph viewer | pending |
| Garden | Weekly proof | Quest queue | One held gate reviewed | this packet | blocked until the listing URL is corrected | blocked |

## Variable Contract Payload

| Group | Current Source | Status |
| --- | --- | --- |
| `brand_system` | Lumen Ember accent in `Sources/LumenBar/UI/Theme.swift` | verified in test 1 |
| `copy_system` | Site hero and Product Hunt tagline | listing URL still points at the GitHub repo |
| `visual_system` | Product Hunt gallery and full-quality screenshots | verified as local assets |
| `section_plan` | Two-section cinematic site | shipped |
| `interaction_plan` | Download and film links | film link stays on the GitHub explainer file |
| `acceptance_checks` | Test 1 fence accepted; test 2 fence rejected | verified |

## Adapter / Service Map

`Tenant Mapping` values below are packet-local context namespaces, not tenant authority. LumenBar is not a Cambium runtime tenant.

| Provider / Route | Inputs | Outputs | Failure Modes | Tenant Mapping | Privacy Boundary |
| --- | --- | --- | --- | --- | --- |
| GitHub app repo | `Sheshiyer/lumen-bar` | Source and notarized release | Listing treats the repo as the website | `sapling:lumen-bar` | No Apple credentials in the packet |
| GitHub site repo | `Sheshiyer/lumen-bar-web` | Vite site source | Direct upload drifts from `main` | `sapling:lumen-bar` | No Cloudflare token in the packet |
| Cloudflare Pages | Built `dist` on Labs account | `lumenbar.thoughtseed.space` | Pages Git install error 8000011 | `sapling:lumen-bar` | Direct upload only |
| Product Hunt | Scheduled launch plus local listing kit | Listing stays scheduled | A website edit that also changes the schedule | none | Do not unschedule from this packet |
| Temperance graph | Test 2 read of `temperance_engine` | Rejected graph | A false v1.1 or showreel-only claim | not this sapling | Do not launch |

## Evidence Ledger

| Status | Evidence |
| --- | --- |
| verified | Test 1 fence accepted the LumenBar graph. Receipt: `thoughtseed-labs/20-operations/agent-outputs/lumenbar-product-loop.md`. |
| verified | Public home `https://lumenbar.thoughtseed.space` returned the LumenBar title during test 1. |
| verified | App repo `Sheshiyer/lumen-bar` and site repo `Sheshiyer/lumen-bar-web` are the two roots named in that receipt. |
| verified | The local Product Hunt listing website field is `https://lumenbar.thoughtseed.space`. The schedule was not changed. |
| blocked | YouTube `https://youtu.be/4UiXj3t8mwM` stays private. The site film link is the GitHub explainer file. |
| blocked | Test 2 fence rejected the Temperance graph. The glove row, the 0.7.0 changelog claim, and the explainer-source claim were false. |
| no-signal | No D1 goal commit, loadout digest, or quests-worker deploy exists for `sapling:lumen-bar`. |

## Gate Ledger

| Gate | Status | Required Proof |
| --- | --- | --- |
| Human approvals | pending | Founder already approved the read-only runs. A Product Hunt edit or Temperance launch needs a new approval. |
| Product Hunt | scheduled | Founder HITL 2026-11-01. The local website field now matches the live home. |
| YouTube | blocked | A file that says the explainer is public or unlisted. |
| Temperance launch | blocked | A later graph whose fence accepts the claims test 2 rejected. |
| Public claims | blocked | No new metric, customer, or launch claim beyond the accepted LumenBar receipt. |
| Credentials | blocked | Apple, Cloudflare, and Product Hunt credentials stay outside this packet. |

## Quest Queue

| quest_id | title | status |
| --- | --- | --- |
| lumenbar-product-loop-test-1 | Keep the accepted LumenBar graph as the sapling record | complete |
| temperance-product-loop-test-2 | Rerun Temperance only after the three rejected claims match the files | queued |
| lumenbar-film-public | Keep the public YouTube explainer as the film the founder named | complete |
| lumenbar-launch-macro | Product Hunt launch is scheduled for November 3, 2026 at 12:01 AM PST | complete |
| lumenbar-home-meso | Live home and the listing website are both https://lumenbar.thoughtseed.space | complete |
| lumenbar-website-micro | Update only the website field on the scheduled listing | complete |

Current frontier: one micro edit, the website field. Do not unschedule the launch. Do not rerun Temperance as a launch.

Garden cadence: none until the Product Hunt gate moves.

Cortex ingestion targets: this packet and the LumenBar receipt. The rejected Temperance graph stays in the run scratch file.

First real launch proof: a Product Hunt listing that names `https://lumenbar.thoughtseed.space` and has the preflight boxes checked.

## Loop Control Inputs

| loop_id | title | cadence | objective | metric | boundary_color | one_change_rule | state_file | stop_rule | model_route | proof_required |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| lumenbar-launch-loop | LumenBar scheduled-launch loop | one Octalysis tick: macro, then meso, then micro | Keep the scheduled launch, check the home evidence, then change the listing website field. | The listing website equals https://lumenbar.thoughtseed.space without a schedule change. | yellow | Select exactly one website-field edit on the scheduled listing. | .operator/branch-loops/lumenbar-launch-loop.md | Stop after that one edit, or if the edit would unschedule or republish the launch. | octalysis macro-meso-micro | Founder HITL that the launch is scheduled, plus the listing diff. |

## Branch Story Controls

| Control | Value |
| --- | --- |
| arc_title | `Scheduled Launch, One Website Field` |
| vision | LumenBar stays a local Mac product with one public site, and Cambium records the proof without posting it. |
| icp | Someone working late on a Mac who wants each display to warm on its own. |
| current_frontier | The launch stays scheduled. The local listing website field now matches the live home. |
| narrative_voice | Quiet product voice: warm light, no account, no invented metrics. |
| anti_claims | Do not claim the launch is unscheduled, and do not claim Temperance 0.7.0 completed a v1.1 launch. The YouTube film is already public. |

## Mission Control Inputs

| mission_id | title | type | owner | gate | proof_required | dispatch_target |
| --- | --- | --- | --- | --- | --- | --- |
| lumenbar-launch-macro | Macro · Product Hunt launch stays on its schedule | macro | founder | Founder HITL 2026-11-01 | the launch remains scheduled | cambium |
| lumenbar-home-meso | Meso · Live home and the listing website now match | meso | founder | URL match | marketing/producthunt/LISTING.md | cambium |
| lumenbar-website-micro | Micro · Website field updated on the local scheduled listing | micro | founder | Yellow one-change done | listing diff only, schedule untouched | cambium |
| lumenbar-record-test-1 | Record the accepted LumenBar product loop | proof | founder | Test 1 fence | lumenbar-product-loop.md | cambium |
| temperance-hold-test-2 | Hold the rejected Temperance graph | proof | founder | Test 2 fence | scratch graph.json with confirmed false | cambium |
| lumenbar-listing-url | Correct the Product Hunt website URL | implementation | founder | Product Hunt | listing file names lumenbar.thoughtseed.space | hermes |

## KPI Control Inputs

| kpi_id | label | survival | better_than_survival | source | current_state |
| --- | --- | --- | --- | --- | --- |
| lumenbar-download | Notarized download | the public 1.2.0 disk image remains linked | a stranger completes install without a security warning | GitHub release | shipped outside this packet |
| lumenbar-home | Official home | the live site title matches the product | the Product Hunt listing uses that same URL | test 1 receipt | site shipped, listing blocked |

## Policy / Permission Inputs

| permission | status | required_approval | failure_mode |
| --- | --- | --- | --- |
| product-loop read | approved | founder asked for the live runs | a rejected fence writes no receipt |
| product hunt schedule | approved | founder confirmed the launch is already scheduled | an edit that removes the schedule |
| temperance launch | blocked | a later accepted fence plus a separate publish approval | test 2 stays rejected |
| quests deploy | approved, not uploaded | founder approved the Labs deploy in the HITL gate | production traffic stays on the current version until a clean reviewed commit |

## Dispatch Inputs

| route | payload_hint | allowed_when | blocked_when |
| --- | --- | --- | --- |
| cambium-bridge-assignment | `lumenbar-record-test-1` as a proof-only sapling packet | test 1 receipt exists | a row would publish |
| cambium-bridge-assignment | `temperance-hold-test-2` as a held decision | test 2 fence reason is attached | the false v1.1 or showreel-only claims are repeated |
| hermes-topic-assignment | `lumenbar-listing-url` for a founder edit | the founder asks to edit the listing | the four preflight boxes are still unchecked |

## Proof Foldback

| proof_id | source_path | validates | promotes |
| --- | --- | --- | --- |
| lumenbar-test-1 | 20-operations/agent-outputs/lumenbar-product-loop.md | the accepted graph, live home, and held Product Hunt rows | keeps `sapling:lumen-bar` proof-only |
| temperance-test-2 | workflows/sapling-product-loop-2/scratch/graph.json | the fence rejection and the decision not to launch | does not create a Temperance sapling |
| lumenbar-listing-proof | future listing diff | the website URL matches the live home | unlocks a supervised-branch review only after approval |

## Promotion Rule

LumenBar is `proof-only` inside Cambium. The public app and site already exist outside this packet. The ladder remains `proof-only -> supervised branch -> autonomous branch`.

The Product Hunt launch stays on its current schedule. Do not promote LumenBar inside Cambium past proof-only, and do not launch Temperance, on the strength of this packet. The one allowed move is the listing website field. Test 2 is not a Temperance launch approval.
